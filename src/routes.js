// import getRequestToken from './api/auth/routes/get_request_token';
// import getAccessToken from './api/auth/routes/get_access_token';
// import getTasks from './api/tasks/routes/get_tasks';
// import getTasksMe from './api/tasks/routes/get_tasks_for_me';
import getTasksReport from './api/tasks/routes/get_tasks_report';

const register = (server, options, next) => {
  // server.route(getTasks(server));
  // server.route(getTasksMe(server));
  server.route(getTasksReport(server));
  // server.route(getRequestToken(server));
  // server.route(getAccessToken(server));
  next();
};

register.attributes = {
  name: 'routes'
};

export default register;
