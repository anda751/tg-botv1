import axios from 'axios'

// ===== Tasks =====
export const taskApi = {
  getMyTasks: () =>
    axios.get('/tasks/my'),

  getHiddenTasks: () =>
    axios.get('/tasks/hidden'),

  getWaitingPickup: () =>
    axios.get('/tasks/waiting-pickup'),

  create: (data: { name: string; project: number }) =>
    axios.post('/tasks', { data }),

  submit: (taskId: number, formData: FormData) =>
    axios.post(`/tasks/${taskId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  progress: (taskId: number, formData: FormData) =>
    axios.post(`/tasks/${taskId}/progress`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  approve: (taskId: number) =>
    axios.post(`/tasks/${taskId}/approve`),

  reject: (taskId: number, reason: string) =>
    axios.post(`/tasks/${taskId}/reject`, { reason }),

  hide: (taskId: number) =>
    axios.post(`/tasks/${taskId}/hide`),

  restore: (taskId: number) =>
    axios.post(`/tasks/${taskId}/restore`),
}

// ===== Projects =====
export const projectApi = {
  getMyProjects: () => axios.get('/projects/my'),

  getAll: () => axios.get('/projects/all'),

  create: (data: { name: string; deadline: string }) =>
    axios.post('/projects', { data }),

  close: (projectId: number) =>
    axios.post(`/projects/${projectId}/close`),

  addMember: (projectId: number, userId: number) =>
    axios.post(`/projects/${projectId}/members`, { userId }),

  removeMember: (projectId: number, userId: number) =>
    axios.delete(`/projects/${projectId}/members/${userId}`),

  requestJoin: (projectId: number, note: string) =>
    axios.post(`/projects/${projectId}/join-requests`, { note }),

  getPendingJoinRequests: () =>
    axios.get('/projects/join-requests/pending'),

  approveJoinRequest: (requestId: number) =>
    axios.post(`/project-join-requests/${requestId}/approve`),

  rejectJoinRequest: (requestId: number, reason: string) =>
    axios.post(`/project-join-requests/${requestId}/reject`, { reason }),
}

// ===== Handover =====
export const handoverApi = {
  handover: (taskId: number, reason: string) =>
    axios.post(`/tasks/${taskId}/handover`, { reason }),

  pickup: (taskId: number) =>
    axios.post(`/tasks/${taskId}/pickup`),

  approve: (handoverId: number) =>
    axios.post(`/handover-requests/${handoverId}/approve`),

  cancel: (handoverId: number) =>
    axios.post(`/handover-requests/${handoverId}/cancel`),
}

// ===== Dashboard =====
export const dashboardApi = {
  summary: () => axios.get('/dashboard/summary'),
  pendingTasks: () => axios.get('/dashboard/pending-tasks'),
  underReview: () => axios.get('/dashboard/under-review'),
  staffOverview: () => axios.get('/dashboard/staff'),
}

// ===== Notifications =====
export const notificationApi = {
  getMy: () => axios.get('/notifications/my'),
  getHidden: () => axios.get('/notifications/hidden'),
  markRead: (notificationId: number) => axios.post(`/notifications/${notificationId}/read`),
  markAllRead: () => axios.post('/notifications/read-all'),
  hide: (notificationId: number) => axios.post(`/notifications/${notificationId}/hide`),
  hideRead: () => axios.post('/notifications/hide-read'),
  restore: (notificationId: number) => axios.post(`/notifications/${notificationId}/restore`),
}

// ===== Users =====
export const userApi = {
  register: (data: {
    username: string
    password: string
    email: string
    display_name: string
    role_app: 'manager' | 'staff'
    telegram_id?: string
    telegram_chat_id?: string
  }) => axios.post('/auth/register', data),

  login: (data: {
    identifier: string
    password: string
  }) => axios.post('/auth/login', data),

  me: () => axios.get('/profile/me'),

  updateMe: (data: {
    display_name: string
    telegram_id?: string
    telegram_chat_id?: string
    current_password?: string
    new_password?: string
    confirm_password?: string
  }) => axios.put('/profile/me', data),
}
