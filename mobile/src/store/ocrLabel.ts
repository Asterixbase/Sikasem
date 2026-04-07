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
  /** Barcode (or '__manual__') for which camera was launched.
   *  Stored here — not in a useRef — so it survives component remounts. */
  launchedForBarcode: string | null;
  setResult: (r: OcrLabelResult) => void;
  setLaunchedForBarcode: (barcode: string | null) => void;
  /** Clears result AND resets launchedForBarcode so the next scan can launch fresh. */
  clear: () => void;
}

export const useOcrLabelStore = create<OcrLabelStore>(set => ({
  result: null,
  launchedForBarcode: null,
  setResult: (r) => set({ result: r }),
  setLaunchedForBarcode: (barcode) => set({ launchedForBarcode: barcode }),
  clear: () => set({ result: null, launchedForBarcode: null }),
}));
