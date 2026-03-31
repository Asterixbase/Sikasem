import { api } from './client';

export const analyticsApi = {
  margins: (days = 30) =>
    api.get(`/reports/margins?days=${days}`),

  salesReport: (period: '7d' | '30d' | '90d' = '30d') =>
    api.get(`/reports/sales?period=${period}`),

  supplierPrices: () =>
    api.get('/reports/supplier-prices'),

  analytics: () =>
    api.get('/reports/analytics'),

  retailInsights: () =>
    api.get('/reports/retail-insights'),

  reorderSuggestions: () =>
    api.get('/reorder/suggestions'),

  whatsappOrder: (items: string) =>
    api.get(`/reorder/whatsapp-order?items=${items}`),
};
