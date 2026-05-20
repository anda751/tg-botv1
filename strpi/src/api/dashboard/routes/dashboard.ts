export default {
  routes: [
    {
      method: 'GET',
      path: '/dashboard/summary',
      handler: 'dashboard.summary',
    },
    {
      method: 'GET',
      path: '/dashboard/pending-tasks',
      handler: 'dashboard.pendingTasks',
    },
    {
      method: 'GET',
      path: '/dashboard/under-review',
      handler: 'dashboard.underReview',
    },
    {
      method: 'GET',
      path: '/dashboard/staff',
      handler: 'dashboard.staffOverview',
    },
    {
      method: 'GET',
      path: '/dashboard/pending-approval',
      handler: 'dashboard.pendingApproval',
    },
  ],
};