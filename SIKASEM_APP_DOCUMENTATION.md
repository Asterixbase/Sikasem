# Sikasem App — Comprehensive Technical & Product Documentation
**Version:** 1.3.0 | **Last Updated:** April 2026 | **Build:** 51

---

## Table of Contents
1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Infrastructure & Deployment](#3-infrastructure--deployment)
4. [Backend — API Reference](#4-backend--api-reference)
5. [Mobile App — Screen Map](#5-mobile-app--screen-map)
6. [Navigation & Routing Wiring](#6-navigation--routing-wiring)
7. [State Management](#7-state-management)
8. [Authentication Flow](#8-authentication-flow)
9. [Key Feature Flows](#9-key-feature-flows)
10. [Tier System](#10-tier-system)
11. [Build History & Major Fixes](#11-build-history--major-fixes)
12. [Known Patterns & Gotchas](#12-known-patterns--gotchas)
13. [ASO — App Store Optimisation](#13-aso--app-store-optimisation)
14. [Resumption Checklist](#14-resumption-checklist)

---

## 1. Product Overview

**Sikasem** ("Money" in Twi) is a Ghanaian retail shop management app for small and medium business owners. It replaces paper-based stock books, manual VAT records, and ad-hoc credit notebooks with a mobile-first digital system.

### Target User
- Single or multi-person retail shops in Ghana (provisions, fashion, electronics, food retail)
- Shop owner or shop assistant with a smartphone
- Primarily iOS (TestFlight), Android build planned

### Core Value Propositions
1. **Scan & Sell** — Barcode scan identifies product, auto-fills price, records sale
2. **Credit tracking** — Customers who buy on credit are tracked with due dates & WhatsApp reminders
3. **Inventory intelligence** — Low stock alerts, reorder suggestions sent via WhatsApp to supplier
4. **VAT compliance** — Automated GRA VAT return preparation and GRA e-Tax portal deep link
5. **Treasury / Vault** — Daily MoMo payouts, cash balance tracking
6. **AI assistant (Sika)** — Claude Haiku-powered chat with live shop context

### Currency
All monetary values stored in **pesawas** (1 GHS = 100 pesawas) in the database and API. Display layer divides by 100 and formats with 2 decimal places.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│               iOS App (Expo / React Native)           │
│  expo-router v4 file-based routing                    │
│  TanStack Query v5 (server state)                     │
│  Zustand v5 (client state)                            │
│  Axios (HTTP, JWT auto-refresh)                       │
└────────────────────┬─────────────────────────────────┘
                     │ HTTPS / REST
                     ▼
┌──────────────────────────────────────────────────────┐
│          FastAPI Backend — sikasem-api.fly.dev        │
│  Python 3.12 / FastAPI 0.115                          │
│  SQLAlchemy 2.0 async + asyncpg                       │
│  Alembic migrations                                   │
│  slowapi rate limiting (300 req/min)                  │
│  Sentry error tracking                                │
│  APScheduler (nightly jobs)                           │
└──────────┬──────────────────────────┬────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌───────────────────────────┐
│  Supabase        │      │  External Services         │
│  PostgreSQL DB   │      │  Twilio — OTP SMS          │
│  (primary_region │      │  MTN MoMo API              │
│   jnb, S Africa) │      │  Anthropic Claude Haiku    │
└──────────────────┘      │  (OCR + AI chat)           │
                          │  Sentry (error tracking)   │
                          └───────────────────────────┘
```

---

## 3. Infrastructure & Deployment

### Backend
| Item | Value |
|---|---|
| Host | Fly.io — app name `sikasem-api` |
| Region | `jnb` (Johannesburg — lowest latency to Ghana) |
| URL | `https://sikasem-api.fly.dev` |
| API base | `https://sikasem-api.fly.dev/v1` |
| Machine | shared-cpu-1x, 512 MB RAM |
| Min machines | 1 (always on, no cold starts) |
| Health check | `GET /health` every 30s |
| Deploy command | `fly deploy --remote-only` (from `C:\Users\jeffr\Sikasem\backend`) |
| Docs (dev only) | `https://sikasem-api.fly.dev/docs` |

### Backend Environment Variables (Fly.io Secrets)
```
DATABASE_URL          — Supabase PostgreSQL connection string
SECRET_KEY            — JWT signing key
TWILIO_ACCOUNT_SID    — OTP SMS
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
MOMO_SUBSCRIPTION_KEY — MTN MoMo disbursement
MOMO_API_USER
MOMO_API_KEY
ANTHROPIC_API_KEY     — Claude Haiku (OCR + AI chat)
REDIS_URL             — Rate limiting (memory:// if not set)
SENTRY_DSN            — Error tracking
```

### Mobile App
| Item | Value |
|---|---|
| Platform | iOS (primary), Android (configured, not submitted) |
| Bundle ID | `gh.sikasem.app` |
| App Store ID | `6761470903` |
| EAS Project ID | `1947107d-be44-4542-9eb2-865c4434e860` |
| EAS Account | `jeffrey102000` |
| GitHub Repo | `https://github.com/Asterixbase/Sikasem` |
| Mobile dir | `C:\Users\jeffr\Sikasem\mobile` |
| Backend dir | `C:\Users\jeffr\Sikasem\backend` |
| API URL (prod) | `EXPO_PUBLIC_API_URL=https://sikasem-api.fly.dev/v1` |
| Current version | 1.3.0 (build 51) |
| TestFlight link | App Store Connect > Apps > Sikasem > TestFlight |
| Build command | `eas build --platform ios --profile production --non-interactive` |
| Submit command | `eas submit --platform ios --latest --non-interactive` |

---

## 4. Backend — API Reference

All routes prefixed with `/v1`. JWT Bearer token required on all routes except `/auth/*` and `/health`.

### Auth — `/v1/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/auth/request-otp` | Send OTP via Twilio SMS to phone number |
| POST | `/auth/verify-otp` | Verify OTP → returns `access_token` + `refresh_token` + shop info |
| POST | `/auth/refresh` | Rotate tokens (refresh_token → new pair) |
| POST | `/auth/logout` | Invalidate refresh token |

### Dashboard — `/v1/reports`
| Method | Path | Description |
|---|---|---|
| GET | `/reports/dashboard` | Today's revenue, sold count, low stock count, avg margin, recent sales, alerts, top product |
| GET | `/reports/sold-today?sort=rev\|units\|margin` | Ranked products sold today |
| GET | `/reports/low-stock?urgency=all\|critical\|high\|normal` | Low stock items with days remaining |
| GET | `/reports/daily?date=YYYY-MM-DD` | Full daily report: POS vs stock reconciliation |

### Products — `/v1/products`
| Method | Path | Description |
|---|---|---|
| GET | `/products` | List all products (paginated, `?q=`, `?limit=`) |
| POST | `/products` | Create product (name, barcode, category_id, sell/buy price pesawas, initial_stock) |
| GET | `/products/{id}` | Single product detail with supplier history |
| PATCH | `/products/{id}` | Update sell/buy price |
| GET | `/products/barcode/{code}` | Lookup by barcode |
| GET | `/products/{id}/price-history` | Price change log |

### Categories — `/v1/categories`
| Method | Path | Description |
|---|---|---|
| GET | `/categories` | Full category tree |
| POST | `/categories` | Create category (name, optional parent_id) |
| POST | `/categories/suggest` | AI category suggestion (name, brand, barcode) → top suggestion + alternatives |

### Sales — `/v1/sales`
| Method | Path | Description |
|---|---|---|
| POST | `/sales` | Record sale (items[], payment_method, customer_phone optional) |
| GET | `/sales/search?q=&type=` | Transaction search (sales, credits, payouts, stock-in) |

### Inventory / Stock — `/v1/inventory`, `/v1/stock`
| Method | Path | Description |
|---|---|---|
| POST | `/stock/movements` | Record stock movement (product_id, quantity, type: stock_in/stock_out, source) |
| GET | `/inventory/logs` | Stock movement history |
| POST | `/inventory/adjust` | Manual inventory adjustment (quantity delta, reason) |
| GET | `/inventory/audit` | Audit comparison: system count vs manual count |

### Credit — `/v1/credit`
| Method | Path | Description |
|---|---|---|
| GET | `/credit` | List all credit accounts |
| POST | `/credit` | Create credit sale |
| GET | `/credit/{id}` | Credit detail + payment history |
| POST | `/credit/{id}/collect` | Record partial/full payment |
| GET | `/credit/collection-logs` | All collection events |
| GET | `/credit/analytics` | Credit portfolio overview |

### Tax — `/v1/tax`
| Method | Path | Description |
|---|---|---|
| GET | `/tax/dashboard` | VAT summary: output_vat, input_vat, net_vat (pesawas), invoice count, recent invoices |
| GET | `/tax/periods/{year}/{month}/export/csv` | GRA-formatted VAT CSV download |
| POST | `/tax/invoices` | Record supplier invoice (for input VAT) |
| GET | `/tax/invoices` | List invoices for period |

### Treasury / Vault — `/v1/treasury`
| Method | Path | Description |
|---|---|---|
| GET | `/treasury/balance` | Current cash + MoMo balance |
| POST | `/treasury/momo-payout` | Initiate MTN MoMo disbursement |
| GET | `/treasury/payout-history` | Past payouts |

### AI — `/v1/ai`
| Method | Path | Description |
|---|---|---|
| POST | `/ai/chat` | Sika AI chat (message + history → reply). Uses Claude Haiku with live shop snapshot as system context |
| GET | `/ai/shift-summary` | End-of-day WhatsApp-ready handover summary. Claude Haiku generates formatted text with revenue, payments, credit, low stock |

### OCR — `/v1/ocr`
| Method | Path | Description |
|---|---|---|
| POST | `/ocr/extract` | Extract product data from base64 image. `?hint=invoice` for label/invoice OCR, `?hint=bulk_scan` for bulk count. Returns structured fields with confidence scores |

### Reorder — `/v1/reorder`
| Method | Path | Description |
|---|---|---|
| GET | `/reorder/suggestions` | Items below reorder threshold with suggested qty, matched supplier, urgency |

### Shops — `/v1/shops`
| Method | Path | Description |
|---|---|---|
| GET | `/shops/me` | Current shop profile |
| PATCH | `/shops/me` | Update shop name, theme |

### Admin — `/v1/admin`
| Method | Path | Description |
|---|---|---|
| POST | `/admin/seed` | Load demo data for testing |
| GET | `/security/audit` | Security event log |
| GET | `/admin/system-health` | System health metrics |

---

## 5. Mobile App — Screen Map

### Tab Screens (always visible in bottom nav)
| File | Tab | Description |
|---|---|---|
| `(tabs)/dash.tsx` | 🏠 Home | Dashboard: revenue hero, 2×2 metric tiles, alerts, recent sales, quick actions |
| `(tabs)/sale.tsx` | 💰 Sales | Cart-based POS: scan or search product, add to cart, checkout (cash/MoMo/credit) |
| `(tabs)/scan.tsx` | ⊙ Scan | Barcode scanner: scans → looks up product → routes to skus (known) or scan-result (new) |
| `(tabs)/credit-list.tsx` | 💳 Credit | Credit book: list of customers with outstanding balances |
| `(tabs)/settings.tsx` | ⚙️ Settings | Theme, tier, shop profile, developer tools |

### Stack Screens (drill-down, have back navigation)
| File | Route | Description |
|---|---|---|
| `scan-result.tsx` | `/scan-result` | New/update product form: name, price, category, stock. Auto-launches camera-label for unknown barcodes. Accepts `name` + `initialStock` params from voice count flow |
| `skus.tsx` | `/skus?id=X` | Single product detail OR full product list if `id=all` |
| `bulk.tsx` | `/bulk?mode=ocr\|bulk` | Camera-based bulk count (OCR) or label OCR. Has voice count mic button |
| `bulk-result.tsx` | `/bulk-result` | Review OCR/voice count result, adjust qty, confirm → creates stock movement OR routes to scan-result if new product |
| `camera-label.tsx` | `/camera-label` | Full-screen camera for label/invoice OCR, returns data via `ocrLabel` Zustand store |
| `cat.tsx` | `/cat` | Category tree picker, returns selection via `categoryPick` Zustand store |
| `inv-adjust.tsx` | `/inv-adjust?id=X` | ±quantity stepper for manual inventory correction |
| `inv-logs.tsx` | `/inv-logs` | Stock movement history log |
| `inv-audit.tsx` | `/inv-audit` | System count vs manual count audit |
| `inv-ext.tsx` | `/inv-ext` | Invoice extraction review (from label OCR) |
| `inv-list.tsx` | `/inv-list` | Invoice archive with search |
| `inv.tsx` | `/inv` | Quick invoice entry |
| `sold-today.tsx` | `/sold-today` | Ranked products sold today (by revenue/units/margin) |
| `low-stock.tsx` | `/low-stock` | Low stock alerts filterable by urgency |
| `margins.tsx` | `/margins` | Profit margins by category and product |
| `analytics.tsx` | `/analytics` | Full analytics dashboard |
| `sales-report.tsx` | `/sales-report` | Detailed sales report |
| `retail-insights.tsx` | `/retail-insights` | 7/30/90-day retail insights |
| `daily-reports.tsx` | `/daily-reports` | Daily POS vs stock reconciliation report |
| `daily-batch.tsx` | `/daily-batch` | End-of-day batch operations |
| `tax.tsx` | `/tax` | VAT compliance dashboard: output/input VAT tiles, deadline, submit CTA |
| `gra.tsx` | `/gra` | GRA VAT filing: step guide, CSV download, PDF audit report, portal deep link |
| `treasury.tsx` | `/treasury` | Treasury balance overview |
| `vault.tsx` | `/vault` | Vault/savings balance |
| `momo-payout.tsx` | `/momo-payout` | Initiate MTN MoMo payout |
| `payout-history.tsx` | `/payout-history` | Payout transaction history |
| `reorder.tsx` | `/reorder` | Reorder suggestions checklist → WhatsApp order |
| `wa-order.tsx` | `/wa-order` | WhatsApp order preview and send |
| `whatsapp.tsx` | `/whatsapp` | General WhatsApp integration |
| `credit-new.tsx` | `/credit-new` | New credit customer form |
| `credit-step2.tsx` | `/credit-step2` | Credit sale step 2: amount, due date (DD-MM-YYYY display / YYYY-MM-DD API) |
| `credit-detail.tsx` | `/credit-detail?id=X` | Credit account detail + payment collection |
| `credit-ok.tsx` | `/credit-ok` | Credit sale confirmation |
| `collection-logs.tsx` | `/collection-logs` | All credit collection events |
| `sale-ok.tsx` | `/sale-ok` | Sale confirmation with WhatsApp receipt option and phone input |
| `search.tsx` | `/search` | Transaction search across sales, credits, payouts, stock-in |
| `ai-chat.tsx` | `/ai-chat` | Sika AI assistant chat UI with typing indicator and shift summary share |
| `id-scan.tsx` | `/id-scan` | Ghana Card / ID scanning (OCR) |
| `price-history.tsx` | `/price-history` | Product price change history |
| `sup.tsx` | `/sup` | Supplier management |
| `help.tsx` | `/help` | Help & FAQ |
| `admin-system.tsx` | `/admin-system` | Admin: system health, seed data |
| `system-logs.tsx` | `/system-logs` | System event logs |
| `access-logs.tsx` | `/access-logs` | User access logs |
| `security-audit.tsx` | `/security-audit` | Security audit log |
| `permissions.tsx` | `/permissions` | User permissions management |
| `log-detail.tsx` | `/log-detail` | Individual log entry detail |

### Auth Screens (outside (main) stack)
| File | Route | Description |
|---|---|---|
| `landing.tsx` | `/landing` | App landing / onboarding |
| `otp-verify.tsx` | `/otp-verify` | OTP entry screen |
| `index.tsx` | `/` | Auth gate: redirects to landing or dash |

---

## 6. Navigation & Routing Wiring

### Router Structure
```
app/
├── _layout.tsx          — Root stack, auth guard
├── index.tsx            — Auth redirect logic
├── landing.tsx          — Onboarding / phone entry
├── otp-verify.tsx       — OTP verification
└── (main)/
    ├── _layout.tsx      — Main stack (headerShown: false)
    ├── (tabs)/
    │   ├── _layout.tsx  — Bottom tab navigator (5 tabs)
    │   ├── dash.tsx
    │   ├── sale.tsx
    │   ├── scan.tsx
    │   └── ...
    └── [all stack screens].tsx
```

### Bottom Tab Bar
5 tabs with a custom `ScanFAB` in the centre position:
- **Home** (🏠) → `dash`
- **Sales** (💰) → `sale`
- **Scan** (⊙ squared button, theme primary colour) → `scan`
- **Credit** (💳) → `credit-list`
- **Settings** (⚙️) → `settings`

The scan button uses `tabBarButton` with a custom `TouchableOpacity` wrapped in `flex: 1` container for even spacing. `borderRadius: 14` gives a rounded-square shape.

### Critical Navigation Rules
- From any stack screen back to dashboard: use `router.dismissAll()` — never `router.replace('/(main)/dash')` (crashes in Expo Router v4 stack context)
- From `bulk.tsx` to `bulk-result.tsx`: use `router.push` (not replace) — keeps `BulkScreen` mounted so camera unmounts cleanly via `useFocusEffect` blur callback
- `staleTime: 60_000` on all drilldown screens prevents blank LoadingState on back-navigation
- Use `isLoading && !data` pattern (not just `isLoading`) so cached data renders instantly on re-visit

---

## 7. State Management

### Zustand Stores (`src/store/`)
| Store | File | Purpose |
|---|---|---|
| `useAuthStore` | `auth.ts` | JWT tokens (access/refresh), user id, shop id, logout handler |
| `useCartStore` | `cart.ts` | POS cart items, totals, payment method |
| `useCategoryPickStore` | `categoryPick.ts` | Cross-screen category selection handoff (cat.tsx → scan-result.tsx) |
| `useOcrLabelStore` | `ocrLabel.ts` | Camera label OCR result handoff (camera-label.tsx → scan-result.tsx). Tracks `launchedForBarcode` to prevent double-launch |
| `useOfflineQueueStore` | `offlineQueue.ts` | Queued sales when offline, syncs on reconnect |
| `useThemeStore` / `useThemePalette` | `theme.ts` | App theme (teal default, blue, purple variants). `useThemePalette` returns `{ primary, scanPrimary }` |
| `useTierStore` | `tier.ts` | Subscription tier (starter/growth/pro), `can(feature)` gating, logo variant, superuser override |

### SecureStore Keys (sensitive, iOS Keychain)
```
sikasem_access_token   — JWT access token
sikasem_refresh_token  — JWT refresh token
sikasem_shop_id        — Current shop UUID
sikasem_user_id        — Current user UUID
```

### TanStack Query Key Conventions
```
['dashboard']          — Dashboard data (staleTime: 60s)
['sold-today', sort]   — Sold today list
['low-stock', urgency] — Low stock alerts
['margins', period]    — Margin data
['tax-dashboard']      — VAT summary
['products-all']       — All products list
['product', id]        — Single product
['search', q, type]    — Transaction search
['reorderSuggestions'] — Reorder items
```

---

## 8. Authentication Flow

```
1. App launches → _layout.tsx checks SecureStore for access_token
2. No token → redirect to /landing
3. User enters Ghana phone number (0XX format)
4. POST /v1/auth/request-otp  { phone: "+233XX" }  (converted from 0XX)
5. Twilio sends SMS OTP (6 digits, 10 min expiry)
6. User enters OTP → POST /v1/auth/verify-otp { phone, otp }
7. Backend returns { access_token, refresh_token, shop_id, user_id }
8. Tokens stored in SecureStore (iOS Keychain)
9. All API requests inject Bearer token via Axios request interceptor
10. On 401: Axios response interceptor auto-refreshes token
    - Single in-flight refresh (queue pattern prevents parallel refreshes)
    - On refresh fail: clearTokens() + router to landing
```

---

## 9. Key Feature Flows

### Scan & Sell Flow
```
Tab: Scan (scan.tsx)
  → Scans barcode
  → GET /products/barcode/{code}
  → Found: route to /skus?id={product_id}   (view/update product)
  → Not found: route to /scan-result?barcode={code}
      → Auto-launches camera-label.tsx (once per barcode, guarded by ocrLabel store)
      → OCR extracts product fields from label photo
      → User confirms name, price, category
      → Category auto-suggested via POST /categories/suggest (debounced 500ms on name change)
      → Manual category picker via /cat (returns via categoryPick store)
      → POST /products → product created → router.replace('/(main)/(tabs)/dash')
```

### Voice Count Flow (Bulk)
```
bulk.tsx (BULK COUNT mode)
  → Tap 🎙️ mic button
  → Modal opens with autoFocus TextInput
  → User types or uses iOS keyboard dictation
  → Parse: "Coca-Cola, 24" → { name: "Coca-Cola", qty: 24 }
  → Live preview shows PRODUCT / QTY
  → Tap Confirm
  → useFocusEffect blur fires (camera deactivates)
  → router.push to /bulk-result with JSON data
  
bulk-result.tsx
  → Shows product name, detected qty, confidence bars
  → User adjusts qty if needed
  → Tap "Confirm N pcs"
  → Has product_id (OCR scan)? → POST /stock/movements → router.dismissAll()
  → No product_id (voice)? → router.push /scan-result?name=X&initialStock=N
  
scan-result.tsx (voice entry mode)
  → isVoiceEntry=true (no barcode, has nameParam)
  → Name pre-filled, stock pre-filled
  → Status banner: 🎙️ "New product from voice count · N pcs confirmed"
  → Category AI suggestion fires from name
  → User selects/confirms category
  → POST /products → product created
```

### Credit Sale Flow
```
credit-list.tsx → "New Credit" button
  → credit-new.tsx: customer name, phone (Ghana format)
  → credit-step2.tsx: product/amount, due date
      Display: DD-MM-YYYY  |  API: YYYY-MM-DD (separate state)
      Shortcuts: 7d / 14d / 30d / 60d from today
  → POST /credit
  → credit-ok.tsx: confirmation with WhatsApp reminder option
```

### VAT Filing Flow
```
tax.tsx
  → Dynamic period label (current month/year, not hardcoded)
  → Dynamic deadline (last day of following month, days countdown)
  → "Submit VAT Return" CTA → gra.tsx

gra.tsx
  → Step guide: Download CSV → Login to portal → File Return → Upload
  → "Submit on GRA e-Tax Portal" → Alert → Linking.openURL('https://etax.gra.gov.gh')
  → "Download VAT CSV" → GET /tax/periods/{year}/{month}/export/csv → Share sheet
  → "Download PDF Audit Report" → buildAuditHtml() → Share sheet
  → CSV preview (Part A Sales, Part B Purchases)
```

### Reorder Flow
```
reorder.tsx
  → GET /reorder/suggestions
  → Checklist with urgency colour coding (red/amber/green)
  → Select items → Preview WhatsApp Order
  → wa-order.tsx → formatted WA message with items, quantities, supplier
  → wa.me/{supplier_number}?text=... → opens WhatsApp
```

### AI Chat (Sika)
```
ai-chat.tsx
  → POST /ai/chat { message, history[] }
  → Backend builds shop snapshot (today revenue, low stock, top products, credit)
  → Claude Haiku generates 2-4 sentence practical reply in plain text
  → Chat bubble UI with typing indicator
  → "📋 Shift" button → GET /ai/shift-summary → native Share sheet (WhatsApp etc.)
```

---

## 10. Tier System

Three subscription tiers, gated via `useTierStore.can(feature)`:

| Feature Key | Starter (Free) | Growth (GHS 49/mo) | Pro (GHS 99/mo) |
|---|---|---|---|
| Scan & sell | ✅ | ✅ | ✅ |
| Credit sales | ✅ | ✅ | ✅ |
| Daily summary | ✅ | ✅ | ✅ |
| `reports` (Analytics/Reports) | ❌ | ✅ | ✅ |
| `daily_reports` | ❌ | ✅ | ✅ |
| `ocr` (Bulk/Label OCR) | ❌ | ✅ | ✅ |
| `reorder` | ❌ | ✅ | ✅ |
| `search` | ❌ | ✅ | ✅ |
| `treasury` | ❌ | ❌ | ✅ |
| `tax` (GRA VAT) | ❌ | ❌ | ✅ |
| `team` management | ❌ | ❌ | ✅ |

Superuser override: `useTierStore.setOverrideTier()` bypasses gating (used in dev/testing). Quick actions on dashboard are filtered by `can(feature)`.

---

## 11. Build History & Major Fixes

### Chronological Build Log

| Build | Key Changes | Critical Fixes |
|---|---|---|
| 1–10 | Initial scaffolding, auth, basic scan & sell | — |
| 11–20 | Credit system, OCR integration, MoMo | — |
| 21–30 | Analytics, treasury, tax screens | — |
| 31–38 | Offline queue, WhatsApp integration, reorder | — |
| 39 | Barcode scan + product lookup wired to backend | Fixed barcode 404 routing |
| 40 | Sale flow + cart overhaul | Fixed cart total calculation |
| 41 | MoMo payout, sale-ok WhatsApp receipt with phone input | Fixed file-system import crash |
| 42 | Voice dictation (bulk) redesign + AI Sika + HTML demo | Replaced expo-av with keyboard dictation modal |
| 43 | Bug fixes (5): voice crash, date format, FAB invisible, dashboard lag, electronic VAT | `setTimeout(350)` for modal nav, DD-MM-YYYY display split state, safe-area insets, `staleTime: 60s` |
| 44 | Voice crash (2nd attempt), Total SKUs drilldown, UI polish | `InteractionManager.runAfterInteractions()`, skus.tsx product list mode, dynamic tax dates |
| 45 | App icon — teal background + white circle S lettermark | Replaced blank green icon |
| 46 | Voice crash (3rd attempt) | `CameraView active={false}` before modal close |
| 47 | Voice crash (definitive fix) | `useFocusEffect` + `router.push`: camera deactivates on screen blur before nav starts |
| 48 | Scan button rounded-square + tab bar spacing | `borderRadius: 14`, `flex: 1` wrapper on ScanFAB |
| 49 | Bulk result crash on confirm + tab bar even spacing | Wrong route `/(main)/dash` → `/(main)/(tabs)/dash`; ScanFAB flex wrapper |
| 50 | Bulk result confirm crash (definitive fix) | `router.dismissAll()` replaces `router.replace()` which crashes from stack context; skip API if no product_id |
| 51 | Voice count → category picker → product creation | Route to scan-result with name+stock pre-filled; AI category suggestion fires from voice product name |

### Root Causes Reference

**CameraView crash on navigation:**
- Root cause: Any navigation that unmounts `BulkScreen` while modal animation is running tears down the CameraView native module
- Failed approaches: `setTimeout(350ms)`, `active={false}`, `InteractionManager`
- Working fix: `useFocusEffect` registers blur callback → camera deactivates before transition. `router.push` (not replace) keeps screen mounted during nav, camera reactivates on back

**FAB / buttons invisible on tax screen:**
- Root cause: `if (error) return <ErrorState />` early return prevented the root `<View>` from ever rendering, making all absolutely-positioned elements (FAB) unreachable
- Fix: Remove early error returns; use `data ?? {}` fallback; FAB always inside root View

**Tab bar uneven spacing:**
- Root cause: `tabBarButton` with fixed `width: 60` doesn't participate in flex layout
- Fix: Wrap `TouchableOpacity` in `<View style={{ flex: 1 }}>` so it shares space equally

**Dashboard drilldown showing blank loading screen:**
- Root cause: `staleTime: 0` (default) triggers refetch on every mount, showing `<LoadingState>` before data arrives
- Fix: `staleTime: 60_000` on sold-today, low-stock, margins + `isLoading && !data` pattern

**`router.replace('/(main)/dash')` crash:**
- Root cause: From inside a stack screen, replacing to a tab route is unreliable in Expo Router v4
- Fix: `router.dismissAll()` which pops all stack screens and returns to tab root

---

## 12. Known Patterns & Gotchas

### Pricing
- Always store in **pesawas** (integer): `Math.round(parseFloat(ghsString) * 100)`
- Always display as **GHS**: `(pesawas / 100).toFixed(2)`
- Never store as float in DB — use INTEGER column

### Dates
- API always expects `YYYY-MM-DD`
- Display always `DD-MM-YYYY` (Ghanaian convention)
- Use **two separate state variables**: `dueDate` (API) and `dueDateDisplay` (UI)
- Shortcut buttons: compute `YYYY-MM-DD` and `DD-MM-YYYY` simultaneously

### Phone Numbers
- Store and send as E.164: `+233XXXXXXXXX`
- User enters: `0XXXXXXXXX` (10 digits)
- Convert: strip leading `0`, prepend `+233`
- WhatsApp URL: `wa.me/233XXXXXXXXX?text=...` (no `+`)

### Reconciliation / "Difference" not "Delta"
- Reconciliation discrepancy banner uses "Difference" not "delta" (not common in Ghana)

### Category Suggestion
- Debounced 500ms on product name change
- Fires automatically from scan-result.tsx `useEffect([name])`
- Also fires in voice entry mode (name pre-filled from voice)
- Manual override via cat.tsx picker → `categoryPick` Zustand store handoff

### Camera Screens
- Always use `useFocusEffect` to manage `active` state on `CameraView`
- Never navigate with `router.replace` from a screen containing `CameraView`
- Use `router.push` to preserve the screen in stack, or `router.back()` to go back

### Colors (from `Colors` constant)
- `Colors.g` — Sikasem primary teal `#0F766E`
- `Colors.g2` — Success green `#059669`
- `Colors.gy` — Background grey
- `Colors.gy2` — Divider grey
- `Colors.w` — White
- `Colors.t` — Primary text
- `Colors.t2` — Secondary text
- `Colors.t3` — Placeholder text
- `Colors.at` — Amber (warning)
- `Colors.rt` — Red (danger)
- `Colors.bt` — Blue teal (info)

---

## 13. ASO — App Store Optimisation

### App Name
**Sikasem — Shop Manager**

### Subtitle (30 chars max)
`Sell · Stock · Tax · Credit`

### Promotional Text (170 chars)
```
The smart way to run your shop in Ghana. Scan barcodes, track stock, manage credit, file VAT, and grow your business — all in one app.
```

### Description (4000 chars)
```
SIKASEM — THE COMPLETE SHOP MANAGEMENT APP FOR GHANA

Run your shop like a pro. Sikasem gives you the tools to sell faster, track smarter, and stress less — all from your phone.

SCAN & SELL IN SECONDS
Point your camera at any barcode and Sikasem instantly identifies the product, fills in the price, and records the sale. Accept cash, MoMo, or credit with one tap.

SMART INVENTORY
Know exactly what you have and what you're running low on. Sikasem tracks every item sold and sends you reorder alerts before you run out. Generate supplier orders and send them directly via WhatsApp.

CREDIT MANAGEMENT
Keep track of customers who buy on credit. Set due dates, send WhatsApp payment reminders, and record collections — all in one place. No more lost notebooks.

VAT COMPLIANCE MADE EASY
Sikasem automatically calculates your output and input VAT for every month. Download your GRA-formatted CSV in one tap and file your return on the GRA e-Tax portal.

AI SHOP ASSISTANT (SIKA)
Ask Sika anything about your shop — today's best seller, profit margins, which products to reorder. Get instant, practical answers based on your real shop data.

BULK STOCK COUNTING
Use your camera or voice to count stock fast. Say "Coca-Cola, 24" and Sikasem records 24 Coca-Cola. No typing, no delays.

TREASURY & MOMO PAYOUTS
Track your cash and MoMo balance. Send daily payouts to yourself or your team directly from the app using MTN Mobile Money.

DAILY REPORTS
See a full breakdown of every day's sales, stock movements, and collections. Share a WhatsApp-ready handover message at end of shift.

FREE TO START — GROW AS YOU GO
• Starter (Free): Scan, sell, credit, daily summary
• Growth (GHS 49/mo): Analytics, OCR, reorder, reports
• Pro (GHS 99/mo): Treasury, VAT filing, team management

Built in Ghana, for Ghana.
```

### Keywords (100 chars)
```
shop,inventory,stock,barcode,VAT,GRA,Ghana,MoMo,credit,retail,sales,POS,reorder,tax,receipt
```

### Category
Primary: **Business**
Secondary: **Finance**

### Age Rating
4+ (no objectionable content)

### Privacy Policy URL
To be added — must be published before App Store submission

### Support URL
GitHub Issues: `https://github.com/Asterixbase/Sikasem/issues`

### App Icon
1024×1024 PNG: Teal background `#0F766E`, white circle, dark green S lettermark in Arial Bold.
Located: `mobile/assets/icon.png` and `mobile/assets/adaptive-icon.png`

### Screenshots Needed (iOS)
- 6.7" (iPhone 15 Pro Max) — required
- 6.1" (iPhone 15) — required  
- Recommended screens to capture:
  1. Dashboard with revenue hero + metric tiles
  2. Scan screen with camera viewfinder
  3. Sale screen / POS cart
  4. Credit list / credit book
  5. Tax VAT summary
  6. AI chat (Sika)

---

## 14. Resumption Checklist

When picking Sikasem back up, do this in order:

### 1. Verify Environment
```bash
# Check backend is running
curl https://sikasem-api.fly.dev/health

# Check latest build in TestFlight
# App Store Connect > Apps > Sikasem > TestFlight

# Current build number
grep buildNumber mobile/app.json
```

### 2. Key Directories
```
C:\Users\jeffr\Sikasem\           — Monorepo root
C:\Users\jeffr\Sikasem\mobile\    — Expo React Native app
C:\Users\jeffr\Sikasem\backend\   — FastAPI backend
```

### 3. Run Backend Locally (if needed)
```bash
cd C:\Users\jeffr\Sikasem\backend
# Set env vars in .env file
uvicorn app.main:app --reload --port 8000
# Docs at http://localhost:8000/docs
```

### 4. Deploy Backend
```bash
cd C:\Users\jeffr\Sikasem\backend
fly deploy --remote-only
```

### 5. Build & Submit Mobile
```bash
cd C:\Users\jeffr\Sikasem\mobile
# Bump buildNumber in app.json first
eas build --platform ios --profile production --non-interactive
eas submit --platform ios --latest --non-interactive
```

### 6. Open Issues at Pause Point (Build 51)
- Voice count → product creation flow working (Build 51)
- No Android build submitted yet (Android config exists in app.json, never built)
- GRA VAT portal submission is deep-link only (no GRA public API exists for programmatic filing)
- Twilio OTP: ensure TWILIO_FROM_NUMBER is a Ghana-capable number
- Privacy policy page needs to be published for App Store public release
- Screenshots for App Store listing not yet captured

### 7. File Locations for Core Logic
| What | Where |
|---|---|
| API base URL | `mobile/src/api/client.ts` line 18 |
| Auth flow | `mobile/src/api/auth.ts` + `mobile/src/store/auth.ts` |
| All quick actions | `mobile/app/(main)/(tabs)/dash.tsx` — `ALL_QUICK_ACTIONS` array |
| Tier feature gates | `mobile/src/store/tier.ts` — `TierFeature` type + `can()` function |
| Category suggestion | `mobile/app/(main)/scan-result.tsx` — `useEffect([name])` |
| Voice parse logic | `mobile/app/(main)/bulk.tsx` — `parseVoiceText()` |
| Currency formatting | Throughout — `(pesawas / 100).toFixed(2)` |
| Color constants | `mobile/src/constants/colors.ts` |
| Typography scale | `mobile/src/constants/typography.ts` |
| Spacing scale | `mobile/src/constants/spacing.ts` |

---

*Document generated April 2026. Reflects codebase at Build 51, v1.3.0.*
*GitHub: https://github.com/Asterixbase/Sikasem*
*Maintained by: Jeffrey Mensah-Roberts*
