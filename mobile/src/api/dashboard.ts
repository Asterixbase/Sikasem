import { api } from './client';

export interface DashboardResponse {
  today_revenue_pesawas: number;
  sold_today_count: number;
  low_stock_count: number;
  avg_margin_pct: number;
  total_skus: number;
  alerts: Alert[];
  quick_actions: string[];
}
export interface Alert { type: string; message: string; urgency: string }

export interface SoldTodayItem {
  product_id: string; name: string; emoji: string; category: string;
  units_sold: number; transactions: number;
  revenue_pesawas: number; cogs_pesawas: number; margin_pct: number;
}
export interface SoldTodayResponse {
  sort: string; total_revenue_pesawas: number; total_cogs_pesawas: number;
  gross_profit_pesawas: number; items: SoldTodayItem[];
}

export interface LowStockItem {
  product_id: string; name: string; current_stock: number;
  daily_velocity: number; days_remaining: number;
  urgency: 'critical' | 'high' | 'normal'; suggested_order_qty: number;
}

export const dashboardApi = {
  get: () => api.get<DashboardResponse>('/reports/dashboard'),

  soldToday: (sort: 'rev' | 'units' | 'margin' = 'rev') =>
    api.get<SoldTodayResponse>(`/reports/dashboard/sold-today?sort=${sort}`),

  lowStock: (urgency: 'all' | 'critical' | 'high' | 'normal' = 'all') =>
    api.get<{ items: LowStockItem[] }>(`/reports/dashboard/low-stock?urgency=${urgency}`),
};
