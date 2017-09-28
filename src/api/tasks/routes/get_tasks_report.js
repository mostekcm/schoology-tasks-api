import _ from 'lodash';
import Joi from 'joi';
import moment from 'moment';
import uuid from 'uuid';
import superagent from 'superagent';
import Promise from 'bluebird';
import PromiseThrottle from 'promise-throttle';
import SuperAgentPromise from 'superagent-promise';
import Boom from 'boom';

import logger from '../../../logger';
import UserService from '../../../service/UserService';

const request = SuperAgentPromise(superagent, Promise);
const promiseThrottle = new PromiseThrottle({
  requestsPerSecond: 5,
  promiseImplementation: Promise
});

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

  logger.debug('Requestion url: ', url);

  return request
    .get(url)
    .set('Authorization', oauthHeader)
    .set('Accept', 'application/json');
};

const fetchAssignments = (section, reply, user, assignments) =>
  getUrl(`https://api.schoology.com/v1/sections/${section.id}/assignments?limit=200`, user)
    .then((assignmentResult) => {
      const assignmentsFromResults = _.map(assignmentResult.body.assignment, assignment => _.assign({}, assignment, {
        course_title: section.course_title,
        section_id: section.id
      }));
      assignments.push(...assignmentsFromResults);
      return assignments;
    })
    .catch(reply);

const getAssignments = (sections, reply, user) => {
  const assignments = [];
  const assignmentPromises = [];

  sections.forEach(section =>
    assignmentPromises.push(promiseThrottle.add(fetchAssignments.bind(this, section, reply, user, assignments))));

  return Promise.all(assignmentPromises)
    .then(() => assignments);
};

const fetchGrades = (sectionId, user, grades) =>
  getUrl(`https://api.schoology.com/v1/users/${user.uid}/grades?section_id=${sectionId}`, user)
    .then((gradeResult) => {
      const sectionRes = gradeResult.body.section;
      if (sectionRes.length === 1) {
        if (sectionRes[0].period[0].assignment) {
          _.assign(grades, _.groupBy(sectionRes[0].period[0].assignment, assignment => assignment.assignment_id));
        }
      }
    })
    .catch(gradeErr => logger.error(`for section ${sectionId}, got an error: ${gradeErr.message}`));

const getGrades = (sections, assignments, user) => {
  const grades = {};

  const gradePromises = [];
  sections.forEach((section) => {
    const sectionId = section.id;
    logger.info('Getting grades for section: ', sectionId);
    gradePromises.push(promiseThrottle.add(fetchGrades.bind(this, sectionId, user, grades)));
  });

  return Promise.all(gradePromises)
    .then(() => ({
      sections, assignments, grades
    }));
};

const fetchSubmissions = (assignment, user, completedAssignments, incompleteAssignments) =>
  getUrl(`https://api.schoology.com/v1/section/${assignment.section_id}/submissions/${assignment.grade_item_id}/${user.uid}`, user)
    .then((submissionResult) => {
      if (submissionResult.body.revision.length > 0) {
        return completedAssignments.push(assignment);
      }

      return incompleteAssignments.push(assignment);
    })
    .catch(submissionErr => logger.error(`submission error: ${submissionErr.message}`));

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

    const requestUser = req.auth.credentials.usersMap[req.query.user];

    if (!requestUser) {
      return reply(Boom.forbidden(`You do not have permission to view '${req.query.user}'`));
    }

    const userService = new UserService();
    userService.getUser(requestUser)
      .then((user) => {
        try {
          const sectionsUrl = `https://api.schoology.com/v1/users/${user.uid}/sections`;
          getUrl(sectionsUrl, user)
            .then((sectionResult) => {
              /* OK, now we have events, let's look for the grades that are associated with them */

              const sections = sectionResult.body.section;
              logger.debug('sections: ', sections);

              getAssignments(sections, reply, user)
                .then(assignments => getGrades(sections, assignments, user))
                .then((gradeResults) => {
                  logger.debug('all grade promises are done');
                  const ungradedAssignments = _.filter(gradeResults.assignments, assignment => !gradeResults.grades[assignment.id]);
                  const gradedAssignments = _.filter(gradeResults.assignments, assignment => !!gradeResults.grades[assignment.id]);

                  const completedAssignments = [];
                  const incompleteAssignments = [];
                  const submissionPromises = [];

                  ungradedAssignments.forEach((assignment) => {
                    logger.debug('ungraded: ', assignment);
                    submissionPromises.push(promiseThrottle.add(fetchSubmissions.bind(this, assignment, user, completedAssignments, incompleteAssignments)));
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
