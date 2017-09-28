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

var _promiseThrottle = require('promise-throttle');

var _promiseThrottle2 = _interopRequireDefault(_promiseThrottle);

var _superagentPromise = require('superagent-promise');

var _superagentPromise2 = _interopRequireDefault(_superagentPromise);

var _boom = require('boom');

var _boom2 = _interopRequireDefault(_boom);

var _logger = require('../../../logger');

var _logger2 = _interopRequireDefault(_logger);

var _UserService = require('../../../service/UserService');

var _UserService2 = _interopRequireDefault(_UserService);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var request = (0, _superagentPromise2.default)(_superagent2.default, _bluebird2.default);
var promiseThrottle = new _promiseThrottle2.default({
  requestsPerSecond: 5,
  promiseImplementation: _bluebird2.default
});

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

  _logger2.default.debug('Requestion url: ', url);

  return request.get(url).set('Authorization', oauthHeader).set('Accept', 'application/json');
};

var fetchAssignments = function fetchAssignments(section, reply, user, assignments) {
  return getUrl('https://api.schoology.com/v1/sections/' + section.id + '/assignments?limit=200', user).then(function (assignmentResult) {
    var assignmentsFromResults = _lodash2.default.map(assignmentResult.body.assignment, function (assignment) {
      return _lodash2.default.assign({}, assignment, {
        course_title: section.course_title,
        section_id: section.id
      });
    });
    assignments.push.apply(assignments, _toConsumableArray(assignmentsFromResults));
    return assignments;
  }).catch(reply);
};

var getAssignments = function getAssignments(sections, reply, user) {
  var assignments = [];
  var assignmentPromises = [];

  sections.forEach(function (section) {
    return assignmentPromises.push(promiseThrottle.add(fetchAssignments.bind(undefined, section, reply, user, assignments)));
  });

  return _bluebird2.default.all(assignmentPromises).then(function () {
    return assignments;
  });
};

var fetchGrades = function fetchGrades(sectionId, user, grades) {
  return getUrl('https://api.schoology.com/v1/users/' + user.uid + '/grades?section_id=' + sectionId, user).then(function (gradeResult) {
    var sectionRes = gradeResult.body.section;
    if (sectionRes.length === 1) {
      if (sectionRes[0].period[0].assignment) {
        _lodash2.default.assign(grades, _lodash2.default.groupBy(sectionRes[0].period[0].assignment, function (assignment) {
          return assignment.assignment_id;
        }));
      }
    }
  }).catch(function (gradeErr) {
    return _logger2.default.error('for section ' + sectionId + ', got an error: ' + gradeErr.message);
  });
};

var getGrades = function getGrades(sections, assignments, user) {
  var grades = {};

  var gradePromises = [];
  sections.forEach(function (section) {
    var sectionId = section.id;
    _logger2.default.info('Getting grades for section: ', sectionId);
    gradePromises.push(promiseThrottle.add(fetchGrades.bind(undefined, sectionId, user, grades)));
  });

  return _bluebird2.default.all(gradePromises).then(function () {
    return {
      sections: sections, assignments: assignments, grades: grades
    };
  });
};

var fetchSubmissions = function fetchSubmissions(assignment, user, completedAssignments, incompleteAssignments) {
  return getUrl('https://api.schoology.com/v1/section/' + assignment.section_id + '/submissions/' + assignment.grade_item_id + '/' + user.uid, user).then(function (submissionResult) {
    if (submissionResult.body.revision.length > 0) {
      return completedAssignments.push(assignment);
    }

    return incompleteAssignments.push(assignment);
  }).catch(function (submissionErr) {
    return _logger2.default.error('submission error: ' + submissionErr.message);
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

      var requestUser = req.auth.credentials.usersMap[req.query.user];

      if (!requestUser) {
        return reply(_boom2.default.forbidden('You do not have permission to view \'' + req.query.user + '\''));
      }

      var userService = new _UserService2.default();
      userService.getUser(requestUser).then(function (user) {
        try {
          var sectionsUrl = 'https://api.schoology.com/v1/users/' + user.uid + '/sections';
          getUrl(sectionsUrl, user).then(function (sectionResult) {
            /* OK, now we have events, let's look for the grades that are associated with them */

            var sections = sectionResult.body.section;
            _logger2.default.debug('sections: ', sections);

            getAssignments(sections, reply, user).then(function (assignments) {
              return getGrades(sections, assignments, user);
            }).then(function (gradeResults) {
              _logger2.default.debug('all grade promises are done');
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
                _logger2.default.debug('ungraded: ', assignment);
                submissionPromises.push(promiseThrottle.add(fetchSubmissions.bind(undefined, assignment, user, completedAssignments, incompleteAssignments)));
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