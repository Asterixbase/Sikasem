import { create } from 'zustand';

interface CategoryPickStore {
  categoryId: string | null;
  categoryName: string | null;
  /** Set the picked category and mark it as fresh (not yet consumed). */
  setPick: (id: string, name: string) => void;
  /** Clear after scan-result has consumed the pick. */
  clear: () => void;
}

export const useCategoryPickStore = create<CategoryPickStore>(set => ({
  categoryId: null,
  categoryName: null,
  setPick: (id, name) => set({ categoryId: id, categoryName: name }),
  clear: () => set({ categoryId: null, categoryName: null }),
}));
