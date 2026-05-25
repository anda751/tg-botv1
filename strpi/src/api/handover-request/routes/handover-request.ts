export default {
  routes: [
    // Staff ส่งไม้ต่อ (ระบุ task id)
    { method: 'POST', path: '/tasks/:id/handover', handler: 'handover-request.handover', config: {} },

    // Staff ขอรับงาน (ระบุ task id)
    { method: 'POST', path: '/tasks/:id/pickup', handler: 'handover-request.pickup', config: {} },

    // Manager อนุมัติ Handover (ระบุ handover request id)
    { method: 'POST', path: '/handover-requests/:id/approve', handler: 'handover-request.approveHandover', config: {} },

    // Staff ยกเลิกคำขอ (ระบุ handover request id)
    { method: 'POST', path: '/handover-requests/:id/cancel', handler: 'handover-request.cancelHandover', config: {} },
  ],
};
