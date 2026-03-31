import { api } from './client';

export interface SaleItem { product_id: string; quantity: number; unit_price_pesawas: number }
export type PaymentMethod = 'cash' | 'momo' | 'credit';

export const salesApi = {
  create: (body: { items: SaleItem[]; payment_method: PaymentMethod; total_pesawas: number }) =>
    api.post('/sales', body),

  collectMomo: (body: { amount_pesawas: number; phone: string; reference: string }) =>
    api.post('/momo/collect', body),

  todayBatch: () =>
    api.get('/sales/batch/today'),

  search: (params: { q?: string; type?: string; from?: string; to?: string }) =>
    api.get('/transactions/search', { params }),
};
