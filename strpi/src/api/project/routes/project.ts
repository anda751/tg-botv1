export default {
  routes: [
    { method: 'GET',    path: '/projects/all',                handler: 'project.all',           config: {} },
    { method: 'GET',    path: '/projects',                    handler: 'project.find',          config: {} },
    { method: 'GET',    path: '/projects/my',                 handler: 'project.myProjects',    config: {} },
    { method: 'GET',    path: '/projects/:id',                handler: 'project.findOne',       config: {} },
    { method: 'POST',   path: '/projects',                    handler: 'project.create',        config: {} },
    { method: 'POST',   path: '/projects/:id/close',          handler: 'project.closeProject',  config: {} },
    { method: 'POST',   path: '/projects/:id/members',        handler: 'project.addMember',     config: {} },
    { method: 'DELETE', path: '/projects/:id/members/:userId',handler: 'project.removeMember',  config: {} },
    { method: 'POST',   path: '/projects/:id/join-requests',  handler: 'project.requestJoin',   config: {} },
    { method: 'GET',    path: '/projects/join-requests/pending', handler: 'project.pendingJoinRequests', config: {} },
    { method: 'POST',   path: '/project-join-requests/:id/approve', handler: 'project.approveJoinRequest', config: {} },
    { method: 'POST',   path: '/project-join-requests/:id/reject', handler: 'project.rejectJoinRequest', config: {} },
  ],
};
