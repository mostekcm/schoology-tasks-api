'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _post_creds = require('./api/auth/routes/post_creds');

var _post_creds2 = _interopRequireDefault(_post_creds);

var _get_tasks_report = require('./api/tasks/routes/get_tasks_report');

var _get_tasks_report2 = _interopRequireDefault(_get_tasks_report);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import getRequestToken from './api/auth/routes/get_request_token';
// import getAccessToken from './api/auth/routes/get_access_token';
var register = function register(server, options, next) {
  server.route((0, _post_creds2.default)(server));
  // server.route(getTasksMe(server));
  server.route((0, _get_tasks_report2.default)(server));
  // server.route(getRequestToken(server));
  // server.route(getAccessToken(server));
  next();
};
// import getTasksMe from './api/tasks/routes/get_tasks_for_me';


register.attributes = {
  name: 'routes'
};

exports.default = register;