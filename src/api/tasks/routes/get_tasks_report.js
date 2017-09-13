import _ from 'lodash';
import Joi from 'joi';
import moment from 'moment';
import uuid from 'uuid';
import superagent from 'superagent';
import Promise from 'bluebird';
import SuperAgentPromise from 'superagent-promise';
import Boom from 'boom';

import logger from '../../../logger';
import UserService from '../../../service/UserService';

const request = SuperAgentPromise(superagent, Promise);

const getUrl = (url, user) => {
  const headers = {
    oauth_consumer_key: user.key,
    oauth_signature_method: 'PLAINTEXT',
    oauth_timestamp: moment().unix(),
    oauth_nonce: uuid.v4(),
    oauth_version: '1.0'
  };

  const oauthHeader = 'Oauth realm="Schoology API", ' +
    _(headers)
      .keys()
      .sort()
      .map(key => `${key}=${headers[key]}`)
      .join(', ') +
    `, oauth_signature=${user.secret}%26`;

  console.log(`for request ${url}, oauth header: ${oauthHeader}`);

  return request
    .get(url)
    .set('Authorization', oauthHeader)
    .set('Accept', 'application/json');
};

const getAssignments = (sections, reply, user) => {
  let assignments = [];
  const assignmentPromises = [];

  sections.forEach((section) => {
    const sectionId = section.id;
    return assignmentPromises.push(
      getUrl(`https://api.schoology.com/v1/sections/${sectionId}/assignments?limit=200`, user)
        .then((assignmentResult) => {
          assignments = _.concat(assignments, _.map(assignmentResult.body.assignment, assignment => _.assign({}, assignment, {
            course_title: section.course_title,
            section_id: sectionId
          })));
          return assignments;
        })
        .catch(reply));
  });

  return Promise.all(assignmentPromises)
    .then(() => assignments);
};

const getGrades = (sections, assignments, user) => {
  let grades = {};

  const gradePromises = [];
  sections.forEach((section) => {
    const sectionId = section.id;
    console.log('Carlos, getting grades for section: ', sectionId);
    gradePromises.push(getUrl(`https://api.schoology.com/v1/users/${user.uid}/grades?section_id=${sectionId}`, user)
      .then((gradeResult) => {
        const sectionRes = gradeResult.body.section;
        console.log(`carlos, gradeResult for section ${sectionId}: `, sectionRes);
        if (sectionRes.length === 1) {
          if (sectionRes[0].period[0].assignment) {
            grades = _.assign({}, grades, _.groupBy(sectionRes[0].period[0].assignment, assignment => assignment.assignment_id));
          }
        }
      })
      .catch(gradeErr => logger.error(`for section ${sectionId}, got an error: ${gradeErr.message}`)));
  });

  return Promise.all(gradePromises)
    .then(() => ({
      sections, assignments, grades
    }));
};

export default () => ({
  method: 'GET',
  path: '/api/tasks/report',
  config: {
    auth: {
      strategies: ['jwt'],
      scope: ['read:tasks']
    },
    description: 'Get all tasks in the system.',
    tags: ['api'],
    validate: {
      query: {
        user: Joi.string().max(1000).allow('').default(''),
        url: Joi.string().max(1000).allow('').default(''),
        q: Joi.string().max(1000).allow('').default(''),
        field: Joi.string().max(1000).allow('').default('')
      }
    }
  },
  handler: (req, reply) => {
    const startDate = req.query.startDate ? req.query.startDate : moment('2017-09-01T00:00:00Z');
    logger.info('Requesting tasks report for ', startDate);

    const uid = req.auth.credentials[`http://schoology-tasks-api/uid/${req.query.user}`];

    if (!uid) {
      return reply(Boom.forbidden(`You do not have permission to view '${req.query.user}'`));
    }

    const userService = new UserService();
    userService.getUser(uid)
      .then((user) => {
        try {
          const sectionsUrl = `https://api.schoology.com/v1/users/${user.uid}/sections`;
          console.log('Carlos, event URL: ', sectionsUrl);
          getUrl(sectionsUrl, user)
            .then((sectionResult) => {
              /* OK, now we have events, let's look for the grades that are associated with them */

              const sections = sectionResult.body.section;
              console.log('sections: ', sections);

              getAssignments(sections, reply, user)
                .then(assignments => getGrades(sections, assignments, user))
                .then((gradeResults) => {
                  console.log('carlos all grade promises are done');
                  const ungradedAssignments = _.filter(gradeResults.assignments, assignment => !gradeResults.grades[assignment.id]);
                  const gradedAssignments = _.filter(gradeResults.assignments, assignment => !!gradeResults.grades[assignment.id]);

                  const completedAssignments = [];
                  const incompleteAssignments = [];
                  const submissionPromises = [];

                  ungradedAssignments.forEach((assignment) => {
                    console.log('ungraded: ', assignment);
                    submissionPromises.push(getUrl(`https://api.schoology.com/v1/section/${assignment.section_id}/submissions/${assignment.grade_item_id}/${user.uid}`, user)
                      .then((submissionResult) => {
                        if (submissionResult.body.revision.length > 0) {
                          return completedAssignments.push(assignment);
                        }

                        return incompleteAssignments.push(assignment);
                      })
                      .catch(submissionErr => logger.error(`submission error: ${submissionErr.message}`)));
                  });

                  return Promise.all(submissionPromises)
                    .then(() => reply({
                      totals: {
                        gradedCount: gradedAssignments.length,
                        submittedNotGradedCount: completedAssignments.length,
                        incompleteAssignmentCount: incompleteAssignments.length
                      },
                      ungradedAssignments: { completedAssignments, incompleteAssignments },
                      gradedAssignments
                    }))
                    .catch(reply);
                });
            })
            .catch((err) => {
              logger.error(`Could not get events because: ${err.message}`);
              return reply({ message: err.message });
            });
        } catch (err) {
          logger.error('request threw exception: ' + err.message);
          return reply(err);
        }

        return null;
      });
    return null;
  }
});
