export default {
  routes: [
    // Staff ส่งไม้ต่อ (ระบุ task id)
    { method: 'POST', path: '/tasks/:id/handover', handler: 'handover-request.handover' },

    // Staff ขอรับงาน (ระบุ task id)
    { method: 'POST', path: '/tasks/:id/pickup', handler: 'handover-request.pickup' },

    // Manager อนุมัติ Handover (ระบุ handover request id)
    { method: 'POST', path: '/handover-requests/:id/approve', handler: 'handover-request.approveHandover' },

    // Staff ยกเลิกคำขอ (ระบุ handover request id)
    { method: 'POST', path: '/handover-requests/:id/cancel', handler: 'handover-request.cancelHandover' },
  ],
};