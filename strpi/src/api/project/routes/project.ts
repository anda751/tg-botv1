export default {
  routes: [
    { method: 'GET',    path: '/projects/all',                handler: 'project.all',           config: { auth: false } },
    { method: 'GET',    path: '/projects',                    handler: 'project.find',          config: { auth: false } },
    { method: 'GET',    path: '/projects/my',                 handler: 'project.myProjects',    config: { auth: false } },
    { method: 'GET',    path: '/projects/:id',                handler: 'project.findOne',       config: { auth: false } },
    { method: 'POST',   path: '/projects',                    handler: 'project.create',        config: { auth: false } },
    { method: 'POST',   path: '/projects/:id/close',          handler: 'project.closeProject',  config: { auth: false } },
    { method: 'POST',   path: '/projects/:id/members',        handler: 'project.addMember',     config: { auth: false } },
    { method: 'DELETE', path: '/projects/:id/members/:userId',handler: 'project.removeMember',  config: { auth: false } },
  ],
};
