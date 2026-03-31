import { api } from './client';

export const adminApi = {
  systemHealth: () => api.get('/admin/system/health'),

  logs: (filter: 'all' | 'critical' | 'warnings' = 'all') =>
    api.get(`/admin/logs?filter=${filter}`),

  logDetail: (id: string) =>
    api.get(`/admin/logs/${id}`),

  securityAudit: () => api.get('/security/audit'),

  runAudit: () => api.post('/security/audit/run'),

  roles: () => api.get('/admin/roles'),

  updateRole: (roleId: string, permissions: Record<string, boolean>) =>
    api.put(`/admin/roles/${roleId}`, { permissions }),

  accessLogs: (filter: 'logins' | 'alerts' | 'role' = 'logins') =>
    api.get(`/security/access-logs?filter=${filter}`),

  shops: {
    get: (id: string) => api.get(`/shops/${id}`),
    update: (id: string, body: { name?: string; location?: string; logo?: string }) =>
      api.patch(`/shops/${id}`, body),
    members: (id: string) => api.get(`/shops/${id}/members`),
    addMember: (id: string, body: { phone: string; role: string }) =>
      api.post(`/shops/${id}/members`, body),
    removeMember: (id: string, memberId: string) =>
      api.delete(`/shops/${id}/members/${memberId}`),
  },
};
