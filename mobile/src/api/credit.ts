import { api } from './client';

export const creditApi = {
  ocrExtractId: (body: { image_base64: string }) =>
    api.post('/ocr/extract?mode=id_card', body),

  createCustomer: (body: {
    full_name: string; id_type: string; id_number: string;
    phone: string; momo_phone?: string;
  }) => api.post('/credit/customers', body),

  createSale: (body: {
    customer_id: string; amount_pesawas: number; due_date: string;
    momo_auto_request: boolean;
    items: { product_id: string; quantity: number; unit_price_pesawas: number }[];
  }) => api.post('/credit/sales', body),

  list: () => api.get('/credit/sales'),

  getById: (id: string) => api.get(`/credit/sales/${id}`),

  updateStatus: (id: string, status: 'paid' | 'written_off' | 'overdue') =>
    api.patch(`/credit/sales/${id}/status`, { status }),

  momoRequest: (id: string) =>
    api.post(`/credit/sales/${id}/momo-request`, { manual: true }),

  whatsapp: (id: string) =>
    api.post<{ wa_url: string; message_text: string; recipient_phone: string; recipient_name: string }>(
      `/credit/sales/${id}/whatsapp`
    ),

  collections: () => api.get('/credit/collections'),
};
