import { create } from 'zustand';

interface OcrLabelField { value: string | number | null; confidence: number }

interface OcrLabelResult {
  product_name?: OcrLabelField;
  brand?: OcrLabelField;
  sell_price?: OcrLabelField;
  buy_price?: OcrLabelField;
  quantity?: OcrLabelField;
  barcode?: OcrLabelField;
  confidence?: number;
}

interface OcrLabelStore {
  result: OcrLabelResult | null;
  setResult: (r: OcrLabelResult) => void;
  clear: () => void;
}

export const useOcrLabelStore = create<OcrLabelStore>(set => ({
  result: null,
  setResult: (r) => set({ result: r }),
  clear: () => set({ result: null }),
}));
