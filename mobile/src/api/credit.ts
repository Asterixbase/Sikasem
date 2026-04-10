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

  listCustomers: () => api.get('/credit/customers'),

  customerScore: (customerId: string) =>
    api.get<{
      score: number; label: string; risk: string; color: string;
      sales_count: number; paid_count: number; overdue_count: number;
      outstanding_pesawas: number;
    }>(`/credit/customers/${customerId}/score`),

  voiceStockCount: (body: { audio_base64: string; format?: string }) =>
    api.post<{ transcript: string; product_name: string; quantity: number | null; confidence: number }>(
      '/ocr/voice', body
    ),
};
