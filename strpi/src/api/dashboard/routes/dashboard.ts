export default {
  routes: [
    {
      method: 'GET',
      path: '/dashboard/home',
      handler: 'dashboard.home',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/dashboard/reports',
      handler: 'dashboard.reports',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/dashboard/summary',
      handler: 'dashboard.summary',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/dashboard/pending-tasks',
      handler: 'dashboard.pendingTasks',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/dashboard/under-review',
      handler: 'dashboard.underReview',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/dashboard/staff',
      handler: 'dashboard.staffOverview',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/dashboard/staff-kpi',
      handler: 'dashboard.staffKpi',
      config: { auth: false },
    },
  ],
};
