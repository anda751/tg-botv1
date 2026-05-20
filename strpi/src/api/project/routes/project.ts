export default {
  routes: [
    { method: 'GET',    path: '/projects',                    handler: 'project.find'         },
    { method: 'GET',    path: '/projects/my',                 handler: 'project.myProjects'   },
    { method: 'GET',    path: '/projects/:id',                handler: 'project.findOne'      },
    { method: 'POST',   path: '/projects',                    handler: 'project.create'       },
    { method: 'POST',   path: '/projects/:id/close',          handler: 'project.closeProject' },
    { method: 'POST',   path: '/projects/:id/members',        handler: 'project.addMember'    },
    { method: 'DELETE', path: '/projects/:id/members/:userId',handler: 'project.removeMember' },
  ],
};