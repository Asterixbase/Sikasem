# Sikasem Design System

**Hybrid B+C — Sunlight Optimized for Outdoor Market Use**

Figma File: https://www.figma.com/design/4lfprfagF9R6Yisgy3MZkL

## Overview

This design package contains the complete UX redesign for Sikasem, a provision store management app targeting Ghanaian small retailers. The redesign addresses 49 original screens across 6 flow areas.

### Design Approach
- **Variation B (Modern/Efficient)** — Teal palette, light background, optimized for task speed
- **Variation C (Bold/Dark)** — Borrowed for scanner screens only (camera UIs work better dark)
- **Sunlight optimization** — All screens rated for outdoor readability (minimum score: 85/100)

## Folder Structure

```
sikasem-design/
├── README.md
├── design-screens/          # Original 49 PNG screens organized by flow
│   ├── 01-home/             # Dashboard, Sales, Analytics (12 screens)
│   ├── 02-stock/            # Scanner, Inventory, Suppliers (10 screens)
│   ├── 03-credit/           # Portfolio, Collections, Vault (11 screens)
│   ├── 04-tax/              # VAT, Invoices, GRA Export (5 screens)
│   ├── 05-more/             # Settings, Help, Reorder (4 screens)
│   └── 06-admin/            # Permissions, Security, Logs (7 screens)
├── design-system/           # Design system documentation
│   └── DESIGN_SYSTEM.md
├── tokens/                  # Expo/React Native design tokens (TypeScript)
│   ├── index.ts
│   ├── colors.ts            # Light + Dark theme colors
│   ├── typography.ts        # Font scale (9 levels)
│   └── spacing.ts           # Spacing, radius, grid, touch targets
├── docs/
│   ├── SIKASEM_UX_AUDIT.md  # Screen-by-screen audit (49 screens)
│   ├── SIKASEM_DESIGN_DELIVERABLE.pdf
│   ├── SUNLIGHT_OPTIMIZATION.md
│   └── CHANGELOG.md
└── figma/
    ├── sikasem_figma_components.js  # Figma Plugin API script: 11 component sets
    └── sikasem_figma_screens.js     # Figma Plugin API script: screen assembly
```

## Design Tokens

Import in your Expo/React Native app:

```typescript
import { colors, typography, spacing, radius } from './tokens';

// Light theme (main app)
const backgroundColor = colors.light.surface.background;

// Dark theme (scanner screens)
const scannerBg = colors.dark.surface.background;
```

## Screen Map

| Flow | Screens | Key Features |
|------|---------|-------------|
| Home | Dashboard, Sold Today, Analytics, Reports, Margins | Revenue hero, KPI grid, alerts |
| Stock | Scanner, Scan Result, Bulk OCR, Categories, Logs, Audit | AI classification, dark scanner |
| Credit | Portfolio, New Credit, ID Scan, WhatsApp, Vault, Payout | MoMo integration, collection target |
| Tax | VAT Dashboard, Invoice Scanner, Invoice List, GRA Export | OCR extraction, compliance |
| More | Settings, Help, Reorder, WhatsApp Order | Offline mode, supplier ordering |
| Admin | Permissions, System Health, Logs, Security Audit | Role-based access, audit trail |

## Sunlight Readability Scores

| Screen | Score | Grade | Key Optimization |
|--------|-------|-------|-----------------|
| Quick Sale POS | 95 | A+ | Oversized total, 48px payment buttons |
| Inventory Audit | 94 | A+ | Large count numbers, color+shape indicators |
| Low Stock Alerts | 93 | A+ | 28px checkboxes, shape-based severity |
| Dashboard | 92 | A | White-on-dark revenue hero, bold KPIs |
| Credit Portfolio | 91 | A | Bold amounts, high-contrast badges |
| Daily Batch | 90 | A | Clear payment breakdown |
| Scan Result | 90 | A | Clear form fields, 36px stock number |
| Product Detail | 89 | A | Saturated margin card, large prices |
| Barcode Scanner | 88 | A | Dark = no glare, bright green guides |
| Tax Dashboard | 86 | B+ | Dense but key amounts bold |
| Analytics | 85 | B+ | Charts enlarged with value labels |

## Navigation Structure (Unified)

```
Tab 1: HOME      (Dashboard, Analytics, Reports, Margins)
Tab 2: STOCK     (Scanner, Inventory, Suppliers, Audit)
Tab 3: [+] FAB   (Context: Quick Sale or Quick Scan)
Tab 4: CREDIT    (Portfolio, Vault, Collections, Payouts)
Tab 5: MORE      (Tax, Settings, Help, Admin, Reorder)
```

## Tech Stack

- Frontend: Expo / React Native
- Backend: FastAPI (Fly.io)
- Database: Supabase (PostgreSQL + Auth + Realtime)
- Cache: Redis
- External: MTN MoMo, Google Vision, Twilio, Firebase FCM

## Priority Fixes (from audit)

### P0 — Must Fix
1. Unify bottom navigation (5 configs → 1)
2. Fix currency inconsistencies (GHS throughout)
3. Touch targets ≥ 44px
4. Add empty/error/loading states
5. Confirmation dialogs for destructive actions

### P1 — Should Fix
6. Semantic color system
7. Reduce ALL-CAPS
8. Visual stepper for multi-step flows
9. Offline mode UI
10. Consolidate "More" tab

---
*Generated April 4, 2026 · Claude (Anthropic)*
