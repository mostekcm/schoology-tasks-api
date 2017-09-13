'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _uuid = require('uuid');

var _uuid2 = _interopRequireDefault(_uuid);

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _superagentPromise = require('superagent-promise');

var _superagentPromise2 = _interopRequireDefault(_superagentPromise);

var _boom = require('boom');

var _boom2 = _interopRequireDefault(_boom);

var _logger = require('../../../logger');

var _logger2 = _interopRequireDefault(_logger);

var _UserService = require('../../../service/UserService');

var _UserService2 = _interopRequireDefault(_UserService);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var request = (0, _superagentPromise2.default)(_superagent2.default, _bluebird2.default);

var getUrl = function getUrl(url, user) {
  var headers = {
    oauth_consumer_key: user.key,
    oauth_signature_method: 'PLAINTEXT',
    oauth_timestamp: (0, _moment2.default)().unix(),
    oauth_nonce: _uuid2.default.v4(),
    oauth_version: '1.0'
  };

  var oauthHeader = 'Oauth realm="Schoology API", ' + (0, _lodash2.default)(headers).keys().sort().map(function (key) {
    return key + '=' + headers[key];
  }).join(', ') + (', oauth_signature=' + user.secret + '%26');

  console.log('for request ' + url + ', oauth header: ' + oauthHeader);

  return request.get(url).set('Authorization', oauthHeader).set('Accept', 'application/json');
};

var getAssignments = function getAssignments(sections, reply, user) {
  var assignments = [];
  var assignmentPromises = [];

  sections.forEach(function (section) {
    var sectionId = section.id;
    return assignmentPromises.push(getUrl('https://api.schoology.com/v1/sections/' + sectionId + '/assignments?limit=200', user).then(function (assignmentResult) {
      assignments = _lodash2.default.concat(assignments, _lodash2.default.map(assignmentResult.body.assignment, function (assignment) {
        return _lodash2.default.assign({}, assignment, {
          course_title: section.course_title,
          section_id: sectionId
        });
      }));
      return assignments;
    }).catch(reply));
  });

  return _bluebird2.default.all(assignmentPromises).then(function () {
    return assignments;
  });
};

var getGrades = function getGrades(sections, assignments, user) {
  var grades = {};

  var gradePromises = [];
  sections.forEach(function (section) {
    var sectionId = section.id;
    console.log('Carlos, getting grades for section: ', sectionId);
    gradePromises.push(getUrl('https://api.schoology.com/v1/users/' + user.uid + '/grades?section_id=' + sectionId, user).then(function (gradeResult) {
      var sectionRes = gradeResult.body.section;
      console.log('carlos, gradeResult for section ' + sectionId + ': ', sectionRes);
      if (sectionRes.length === 1) {
        if (sectionRes[0].period[0].assignment) {
          grades = _lodash2.default.assign({}, grades, _lodash2.default.groupBy(sectionRes[0].period[0].assignment, function (assignment) {
            return assignment.assignment_id;
          }));
        }
      }
    }).catch(function (gradeErr) {
      return _logger2.default.error('for section ' + sectionId + ', got an error: ' + gradeErr.message);
    }));
  });

  return _bluebird2.default.all(gradePromises).then(function () {
    return {
      sections: sections, assignments: assignments, grades: grades
    };
  });
};

exports.default = function () {
  return {
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
          user: _joi2.default.string().max(1000).allow('').default(''),
          url: _joi2.default.string().max(1000).allow('').default(''),
          q: _joi2.default.string().max(1000).allow('').default(''),
          field: _joi2.default.string().max(1000).allow('').default('')
        }
      }
    },
    handler: function handler(req, reply) {
      var startDate = req.query.startDate ? req.query.startDate : (0, _moment2.default)('2017-09-01T00:00:00Z');
      _logger2.default.info('Requesting tasks report for ', startDate);

      var uid = req.auth.credentials['http://schoology-tasks-api/uid/' + req.query.user];

      if (!uid) {
        return reply(_boom2.default.forbidden('You do not have permission to view \'' + req.query.user + '\''));
      }

      var userService = new _UserService2.default();
      userService.getUser(uid).then(function (user) {
        try {
          var sectionsUrl = 'https://api.schoology.com/v1/users/' + user.uid + '/sections';
          console.log('Carlos, event URL: ', sectionsUrl);
          getUrl(sectionsUrl, user).then(function (sectionResult) {
            /* OK, now we have events, let's look for the grades that are associated with them */

            var sections = sectionResult.body.section;
            console.log('sections: ', sections);

            getAssignments(sections, reply, user).then(function (assignments) {
              return getGrades(sections, assignments, user);
            }).then(function (gradeResults) {
              console.log('carlos all grade promises are done');
              var ungradedAssignments = _lodash2.default.filter(gradeResults.assignments, function (assignment) {
                return !gradeResults.grades[assignment.id];
              });
              var gradedAssignments = _lodash2.default.filter(gradeResults.assignments, function (assignment) {
                return !!gradeResults.grades[assignment.id];
              });

              var completedAssignments = [];
              var incompleteAssignments = [];
              var submissionPromises = [];

              ungradedAssignments.forEach(function (assignment) {
                console.log('ungraded: ', assignment);
                submissionPromises.push(getUrl('https://api.schoology.com/v1/section/' + assignment.section_id + '/submissions/' + assignment.grade_item_id + '/' + user.uid, user).then(function (submissionResult) {
                  if (submissionResult.body.revision.length > 0) {
                    return completedAssignments.push(assignment);
                  }

                  return incompleteAssignments.push(assignment);
                }).catch(function (submissionErr) {
                  return _logger2.default.error('submission error: ' + submissionErr.message);
                }));
              });

              return _bluebird2.default.all(submissionPromises).then(function () {
                return reply({
                  totals: {
                    gradedCount: gradedAssignments.length,
                    submittedNotGradedCount: completedAssignments.length,
                    incompleteAssignmentCount: incompleteAssignments.length
                  },
                  ungradedAssignments: { completedAssignments: completedAssignments, incompleteAssignments: incompleteAssignments },
                  gradedAssignments: gradedAssignments
                });
              }).catch(reply);
            });
          }).catch(function (err) {
            _logger2.default.error('Could not get events because: ' + err.message);
            return reply({ message: err.message });
          });
        } catch (err) {
          _logger2.default.error('request threw exception: ' + err.message);
          return reply(err);
        }

        return null;
      });
      return null;
    }
  };
};