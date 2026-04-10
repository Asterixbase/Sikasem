import { api } from './client';

export const notificationsApi = {
  registerToken: (token: string) =>
    api.post('/notifications/register', { token }),

  deregisterToken: (token: string) =>
    api.delete('/notifications/token', { data: { token } }),
};
