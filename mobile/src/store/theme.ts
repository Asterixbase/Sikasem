/**
 * Sikasem Theme Store — Zustand + AsyncStorage
 * 4 colour themes for brand testing.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeId = 'ocean' | 'midnight' | 'amber' | 'savanna';

export interface ThemePalette {
  id: ThemeId;
  label: string;
  swatch: string;   // hex for the preview dot
  // Primary brand colours
  primary:   string;   // replaces Colors.g
  accent:    string;   // replaces Colors.g2
  bgLight:   string;   // replaces Colors.gl
  bgDeep:    string;   // replaces Colors.gx
  scanPrimary: string; // replaces Colors.scanPrimary
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  ocean: {
    id:          'ocean',
    label:       'Ocean',
    swatch:      '#0F766E',
    primary:     '#0F766E',
    accent:      '#059669',
    bgLight:     '#F0FDFA',
    bgDeep:      '#CCFBF1',
    scanPrimary: '#10B981',
  },
  midnight: {
    id:          'midnight',
    label:       'Midnight',
    swatch:      '#3B82F6',
    primary:     '#2563EB',
    accent:      '#7C3AED',
    bgLight:     '#EFF6FF',
    bgDeep:      '#DBEAFE',
    scanPrimary: '#60A5FA',
  },
  amber: {
    id:          'amber',
    label:       'Amber',
    swatch:      '#B45309',
    primary:     '#B45309',
    accent:      '#D97706',
    bgLight:     '#FFFBEB',
    bgDeep:      '#FEF3C7',
    scanPrimary: '#F59E0B',
  },
  savanna: {
    id:          'savanna',
    label:       'Savanna',
    swatch:      '#65A30D',
    primary:     '#65A30D',
    accent:      '#4D7C0F',
    bgLight:     '#F7FEE7',
    bgDeep:      '#ECFCCB',
    scanPrimary: '#84CC16',
  },
};

interface ThemeState {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  palette: () => ThemePalette;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeId: 'ocean',
      setTheme: (id: ThemeId) => set({ themeId: id }),
      palette: () => THEMES[get().themeId],
    }),
    {
      name: 'sikasem-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ themeId: state.themeId }),
    }
  )
);

/**
 * Returns the full Colors object with current theme overrides applied.
 * Import this wherever you need dynamic brand colours.
 */
export function useThemePalette(): ThemePalette {
  return useThemeStore(s => THEMES[s.themeId]);
}
