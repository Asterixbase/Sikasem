/**
 * Sikasem Tier Store — Zustand + AsyncStorage
 * Tracks the user's subscription tier and any superuser active-tier override.
 * Also stores the chosen app logo variant (A / B / C).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TierId = 'starter' | 'growth' | 'pro';
export type LogoVariant = 'A' | 'B' | 'C';

// ── Tier display config ───────────────────────────────────────────────────────
export interface TierConfig {
  label: string;
  tagline: string;
  price: string;
  emoji: string;
  color: string;
  features: string[];
  notIncluded: string[];
}

export const TIER_CONFIG: Record<TierId, TierConfig> = {
  starter: {
    label: 'Starter',
    tagline: 'Sell smarter from day one',
    price: 'Free',
    emoji: '🌱',
    color: '#0F766E',
    features: [
      'Barcode scan & sell',
      'Basic stock tracking',
      'Credit sales & customers',
      'Daily sales summary',
    ],
    notIncluded: ['Reports & analytics', 'OCR scanning', 'Treasury', 'Tax filing'],
  },
  growth: {
    label: 'Growth',
    tagline: 'Scale with data and insights',
    price: 'GHS 49/mo',
    emoji: '📈',
    color: '#1D4ED8',
    features: [
      'Everything in Starter',
      'Sales reports & analytics',
      'OCR invoice scanning',
      'Inventory management',
      'Reorder management',
      'Bulk counting',
    ],
    notIncluded: ['Treasury & vault', 'GRA tax filing', 'Team management'],
  },
  pro: {
    label: 'Pro',
    tagline: 'Full retail management suite',
    price: 'GHS 99/mo',
    emoji: '💎',
    color: '#7C3AED',
    features: [
      'Everything in Growth',
      'Treasury & vault',
      'GRA VAT tax filing',
      'Team management',
      'Priority WhatsApp support',
    ],
    notIncluded: [],
  },
};

// ── Feature flags per tier ────────────────────────────────────────────────────
export type TierFeature =
  | 'reports'
  | 'reorder'
  | 'ocr'
  | 'inventory'
  | 'bulk_scan'
  | 'daily_reports'
  | 'treasury'
  | 'tax'
  | 'team'
  | 'search'
  | 'notifications';

const FEATURES: Record<TierId, TierFeature[]> = {
  starter: ['search', 'notifications'],
  growth: [
    'reports', 'reorder', 'ocr', 'inventory',
    'bulk_scan', 'daily_reports', 'search', 'notifications',
  ],
  pro: [
    'reports', 'reorder', 'ocr', 'inventory',
    'bulk_scan', 'daily_reports', 'search', 'notifications',
    'treasury', 'tax', 'team',
  ],
};

// ── Logo variant descriptions ─────────────────────────────────────────────────
export const LOGO_DESCRIPTIONS: Record<LogoVariant, { title: string; desc: string }> = {
  A: { title: '"S" Monogram',    desc: 'Bold letter S in a teal circle — clean and professional' },
  B: { title: '"SK" Initials',   desc: 'Sika initials in a rounded square — culturally grounded' },
  C: { title: 'Layered Ring',    desc: 'Stacked circle marks — modern and distinctive' },
};

// ── Store ─────────────────────────────────────────────────────────────────────
interface TierState {
  tier: TierId;
  activeTier: TierId | null; // superuser override — null = use actual tier
  logoVariant: LogoVariant;
  hasChosen: boolean;        // true after user completes the landing screen

  setTier: (t: TierId) => void;
  setActiveTier: (t: TierId | null) => void;
  setLogoVariant: (v: LogoVariant) => void;
  markChosen: () => void;
  effectiveTier: () => TierId;
  can: (feat: TierFeature) => boolean;
}

export const useTierStore = create<TierState>()(
  persist(
    (set, get) => ({
      tier: 'growth',
      activeTier: null,
      logoVariant: 'C',
      hasChosen: false,

      setTier: (tier) => set({ tier }),
      setActiveTier: (activeTier) => set({ activeTier }),
      setLogoVariant: (logoVariant) => set({ logoVariant }),
      markChosen: () => set({ hasChosen: true }),

      effectiveTier: () => get().activeTier ?? get().tier,

      can: (feat: TierFeature) => {
        const t = get().activeTier ?? get().tier;
        return FEATURES[t].includes(feat);
      },
    }),
    {
      name: 'sikasem-tier',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        tier: s.tier,
        logoVariant: s.logoVariant,
        hasChosen: s.hasChosen,
      }),
    }
  )
);
