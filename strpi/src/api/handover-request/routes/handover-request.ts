export default {
  routes: [
    { method: 'POST', path: '/tasks/:id/handover', handler: 'handover-request.handover', config: { auth: false } },
    { method: 'POST', path: '/tasks/:id/pickup', handler: 'handover-request.pickup', config: { auth: false } },
    { method: 'POST', path: '/handover-requests/:id/approve', handler: 'handover-request.approveHandover', config: { auth: false } },
    { method: 'POST', path: '/handover-requests/:id/reject', handler: 'handover-request.rejectHandover', config: { auth: false } },
    { method: 'POST', path: '/handover-requests/:id/cancel', handler: 'handover-request.cancelHandover', config: { auth: false } },
  ],
};
