import { api } from './client';

export type MovementType = 'purchase' | 'adjustment' | 'sale';
export type AdjustReason = 'damage' | 'loss' | 'correction' | 'expired';

export const inventoryApi = {
  movements: (limit = 20) =>
    api.get(`/inventory/movements?limit=${limit}`),

  addMovement: (body: {
    product_id: string;
    movement_type: MovementType;
    quantity: number;
    unit_cost_pesawas?: number;
    adjustment_sign?: '+' | '-';
    reason?: AdjustReason;
    notes?: string;
  }) => api.post('/stock/movements', body),

  audit: () => api.get('/inventory/audit'),

  confirmAudit: (body: {
    audit_id: string;
    signed_by: string;
    items: { product_id: string; actual_qty: number }[];
  }) => api.post('/inventory/audit/confirm', body),
};
