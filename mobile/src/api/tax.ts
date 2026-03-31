import { api } from './client';

export const taxApi = {
  dashboard: () => api.get('/tax/dashboard'),

  profile: () => api.get('/tax/profile'),

  ocrExtractInvoice: (body: { image_base64: string; period: string }) =>
    api.post('/tax/invoices/ocr-extract', body),

  saveInvoice: (body: Record<string, unknown>) =>
    api.post('/tax/invoices', body),

  listInvoices: (period: string) =>
    api.get(`/tax/invoices?period=${period}`),

  exportGraCsv: (year: number, month: number) =>
    api.get(`/tax/periods/${year}/${month}/export/csv`, {
      responseType: 'blob',
    }),
};
