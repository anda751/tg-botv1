import axios from 'axios'

// ===== Tasks =====
export const taskApi = {
  getMyTasks: () =>
    axios.get('/tasks', {
      params: { 'filters[current_owner]': true, populate: 'project,current_owner' },
    }),

  getWaitingPickup: () =>
    axios.get('/tasks', {
      params: { 'filters[status_task]': 'waiting_pickup', populate: 'current_owner,task_log' },
    }),

  create: (data: { name: string; project: number }) =>
    axios.post('/tasks', { data }),

  submit: (taskId: number, formData: FormData) =>
    axios.post(`/tasks/${taskId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  approve: (taskId: number) =>
    axios.post(`/tasks/${taskId}/approve`),

  reject: (taskId: number, reason: string) =>
    axios.post(`/tasks/${taskId}/reject`, { reason }),
}

// ===== Projects =====
export const projectApi = {
  getMyProjects: () => axios.get('/projects/my'),

  getAll: () => axios.get('/projects', { params: { populate: 'creator,members' } }),

  create: (data: { name: string; deadline: string }) =>
    axios.post('/projects', { data }),

  close: (projectId: number) =>
    axios.post(`/projects/${projectId}/close`),

  addMember: (projectId: number, userId: number) =>
    axios.post(`/projects/${projectId}/members`, { userId }),

  removeMember: (projectId: number, userId: number) =>
    axios.delete(`/projects/${projectId}/members/${userId}`),
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
  pendingApproval: () => axios.get('/dashboard/pending-approval'),
}

// ===== Users =====
export const userApi = {
  register: (data: {
    email: string
    display_name: string
    telegram_id: string
    telegram_chat_id: string
  }) => axios.post('/auth/telegram/register', data),

  me: () => axios.get('/users/me/profile'),

  approve: (userId: number) =>
    axios.post(`/users/${userId}/approve`),

  reject: (userId: number, reason: string) =>
    axios.post(`/users/${userId}/reject`, { reason }),
}