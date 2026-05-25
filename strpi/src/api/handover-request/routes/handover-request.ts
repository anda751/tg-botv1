export default {
  routes: [
    // Staff ส่งไม้ต่อ (ระบุ task id)
    { method: 'POST', path: '/tasks/:id/handover', handler: 'handover-request.handover', config: { auth: false } },

    // Staff ขอรับงาน (ระบุ task id)
    { method: 'POST', path: '/tasks/:id/pickup', handler: 'handover-request.pickup', config: { auth: false } },

    // Manager อนุมัติ Handover (ระบุ handover request id)
    { method: 'POST', path: '/handover-requests/:id/approve', handler: 'handover-request.approveHandover', config: { auth: false } },

    // Staff ยกเลิกคำขอ (ระบุ handover request id)
    { method: 'POST', path: '/handover-requests/:id/cancel', handler: 'handover-request.cancelHandover', config: { auth: false } },
  ],
};
