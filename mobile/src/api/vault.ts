import { api } from './client';

export const vaultApi = {
  balance: () => api.get('/vault/balance'),

  payout: (body: { amount_pesawas: number; recipient_phone: string; network: 'mtn' | 'telecel' }) =>
    api.post('/vault/payout', body),

  payouts: (limit = 20) =>
    api.get(`/vault/payouts?limit=${limit}`),
};
