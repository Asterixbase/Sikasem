import { api } from './client';

export interface Product {
  product_id: string; sku: string; name: string; emoji: string;
  category_breadcrumb: string; current_stock: number;
  urgency: string; daily_velocity: number; margin_pct: number;
  buy_price_pesawas: number; sell_price_pesawas: number;
  supplier_history: { name: string; date: string; unit_cost_pesawas: number; best: boolean }[];
}

export interface CategorySuggestResponse {
  suggestion: { category_id: string; name: string; breadcrumb: string; confidence: number };
  alternatives: { category_id: string; name: string; confidence: number }[];
  full_tree: CategoryNode[];
}
export interface CategoryNode { id: string; name: string; children: CategoryNode[] }

export const productsApi = {
  getByBarcode: (code: string) =>
    api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`),

  getById: (id: string) =>
    api.get<Product>(`/products/${id}`),

  update: (id: string, body: { sell_price_pesawas?: number; buy_price_pesawas?: number }) =>
    api.patch<Product>(`/products/${id}`, body),

  create: (body: {
    name: string; barcode: string; category_id: string;
    sell_price_pesawas: number; buy_price_pesawas: number; initial_stock: number;
  }) => api.post<Product>('/products', body),

  suggestCategory: (body: { name: string; brand?: string; barcode?: string }) =>
    api.post<CategorySuggestResponse>('/categories/suggest', body),

  getCategories: () =>
    api.get<{ tree: CategoryNode[] }>('/categories'),

  createCategory: (body: { name: string; parent_id?: string }) =>
    api.post<CategoryNode>('/categories', body),

  getProducts: (params?: { limit?: number; q?: string }) =>
    api.get('/products', { params }),

  priceHistory: (id: string) =>
    api.get(`/products/${id}/price-history`),
};
