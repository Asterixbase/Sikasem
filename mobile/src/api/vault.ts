import { api } from './client';

export const treasuryApi = {
  balance: () => api.get('/treasury/balance'),

  payout: (body: { amount_pesawas: number; recipient_phone: string; network: 'mtn' | 'telecel' | 'airteltigo' }) =>
    api.post('/treasury/payout', body),

  payouts: (limit = 20) =>
    api.get(`/treasury/payouts?limit=${limit}`),
};

/** @deprecated Use treasuryApi */
export const vaultApi = treasuryApi;
