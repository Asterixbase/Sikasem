# Sikasem — Agency Handover & Technical Audit
**Version:** 1.3.0  
**Date:** 2026-04-06  
**Prepared by:** Product Owner / AI-assisted development  
**Purpose:** Full technical handover to a development agency for continued build-out

---

## 1. Product Overview

**Sikasem** is a mobile-first retail management platform for Ghanaian small shop owners. It digitises day-to-day shop operations including inventory management, sales recording, credit tracking, tax compliance, and treasury management.

**Target users:** Informal and semi-formal retail shops across Ghana (provision shops, pharmacies, hardware stores, market traders).

**App Store:** `gh.sikasem.app` · App Store ID: `6761470903`  
**EAS Project:** `@jeffrey102000/sikasem`  
**GitHub:** `Asterixbase/Sikasem`

---

## 2. Technology Stack

### Mobile (React Native / Expo)
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Expo (EAS Build + Submit) | SDK 52 |
| Navigation | Expo Router v4 | ~4.0.22 |
| State management | Zustand | 5.0.2 |
| Server state | TanStack React Query | 5.62.7 |
| HTTP client | Axios | 1.7.9 |
| Secure storage | expo-secure-store | 14.0.1 |
| Camera / OCR | expo-camera | 16.0.18 |
| Offline queue | Custom Zustand store + AsyncStorage | — |
| Theming | Custom Zustand + AsyncStorage | — |

### Backend (Python / FastAPI)
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | FastAPI | Latest |
| ORM | SQLAlchemy (async) | Latest |
| Database | PostgreSQL via Supabase | — |
| Auth | OTP (Twilio SMS) + JWT | — |
| OCR | Anthropic Claude Vision API | claude-haiku-4-5 / claude-sonnet-4-6 |
| Deployment | Fly.io | — |
| Config | Pydantic Settings | — |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Supabase | PostgreSQL database + auth user records |
| Fly.io | FastAPI backend hosting (`sikasem-api.fly.dev`) |
| Expo EAS | Build + TestFlight submission pipeline |
| Twilio | SMS OTP delivery |
| Anthropic | Claude Vision for OCR (labels, invoices, ID cards) |

---

## 3. Repository Structure

```
Sikasem/
├── mobile/                     # Expo React Native app
│   ├── app/
│   │   ├── _layout.tsx         # Root layout — auth gate
│   │   ├── index.tsx           # Entry redirect
│   │   ├── otp-verify.tsx      # Login screen
│   │   └── (main)/
│   │       ├── _layout.tsx     # Main Stack layout
│   │       ├── (tabs)/         # Bottom tab screens
│   │       │   ├── dash.tsx    # Dashboard (home)
│   │       │   ├── sale.tsx    # Sale entry
│   │       │   ├── scan.tsx    # Barcode scanner
│   │       │   ├── credit-list.tsx
│   │       │   └── settings.tsx
│   │       ├── scan-result.tsx # New/edit product
│   │       ├── camera-label.tsx # OCR label camera
│   │       ├── treasury.tsx    # Treasury (owner only)
│   │       ├── tax.tsx         # Tax compliance
│   │       ├── analytics.tsx   # Reports
│   │       ├── search.tsx      # Transaction search
│   │       └── [40+ other screens]
│   └── src/
│       ├── api/                # Axios API clients
│       ├── components/         # Shared UI components
│       ├── constants/          # Colors, Typography, Spacing
│       ├── hooks/              # useRole, useTheme, useOfflineSync
│       ├── store/              # Zustand stores (auth, cart, ocrLabel, theme)
│       └── utils/              # date.ts, layout.ts
│
├── backend/                    # FastAPI API
│   └── app/
│       ├── api/                # Route handlers
│       │   ├── auth.py         # OTP login, /me
│       │   ├── reports.py      # Dashboard, analytics
│       │   ├── transactions.py # Search
│       │   ├── sales.py
│       │   ├── inventory.py
│       │   ├── vault.py        # Treasury (require_owner)
│       │   ├── tax.py
│       │   ├── ocr.py          # Claude Vision endpoint
│       │   └── [others]
│       ├── core/
│       │   ├── config.py       # Env vars via Pydantic
│       │   ├── database.py     # Async SQLAlchemy session
│       │   ├── deps.py         # get_current_shop, require_owner
│       │   └── security.py     # JWT create/decode, OTP
│       ├── models/             # SQLAlchemy ORM models
│       ├── schemas/            # Pydantic request/response schemas
│       └── services/           # ocr.py (Claude Vision service)
│
└── docs/                       # This folder
```

---

## 4. Authentication & Security

### OTP Login Flow
1. User enters phone number (E.164 format)
2. Backend generates 6-digit OTP, hashes it (bcrypt), stores in `otp_codes` table, sends via Twilio
3. User enters code → backend verifies hash → issues JWT
4. JWT stored in `expo-secure-store` (encrypted iOS keychain / Android Keystore)
5. JWT carries: `sub` (user_id), `shop_id`, `phone`, `role`, `exp`

### Dev Bypass
- OTP code `000000` works when `TWILIO_ENABLED=false` in environment

### Role-Based Access Control
| Role | Treasury | Reports | Inventory | Sales/Scan |
|------|----------|---------|-----------|-----------|
| `superuser` | ✅ | ✅ | ✅ | ✅ |
| `owner` | ✅ | ✅ | ✅ | ✅ |
| `manager` | ❌ | ✅ | ✅ | ✅ |
| `staff` | ❌ | ❌ | Read-only | ✅ |

### Superuser Phones
Defined in `backend/app/api/auth.py`:
```python
SUPERUSER_PHONES = {"+447863482507"}
```
These phones always receive `role=superuser` in their JWT.

### Security Considerations for Agency
- JWTs are short-lived (check `EXPIRE_MINUTES` in `config.py`)
- Refresh token mechanism: **not yet implemented** — users get logged out on expiry
- No rate limiting on OTP send endpoint — **recommend adding**
- ANTHROPIC_API_KEY stored as Fly.io secret — never committed to repo
- All financial endpoints require authenticated JWT; Treasury additionally requires `role=owner`

---

## 5. Key Data Models

### Product
```
id, shop_id, name, barcode, emoji, category_id,
sell_price_pesawas, buy_price_pesawas, current_stock,
created_at
```
_All monetary values stored in pesawas (1 GHS = 100 pesawas)_

### Sale + SaleItem
```
Sale: id, shop_id, reference, total_pesawas, payment_method (cash/momo/credit), created_at
SaleItem: id, sale_id, product_id, quantity, unit_price_pesawas
```

### CreditSale
```
id, shop_id, reference, customer_name, customer_phone, amount_pesawas,
due_date, status (pending/paid/overdue), created_at
```

### VaultPayout (Treasury)
```
id, shop_id, recipient_phone, amount_pesawas, status, created_at
```

### ShopMember
```
id, shop_id, user_id, role (owner/manager/staff)
```

---

## 6. OCR Pipeline

Three OCR modes, all using Claude Vision:

| Mode | Hint | Model | Fallback |
|------|------|-------|---------|
| Product label | `product_label` | claude-haiku-4-5 | claude-sonnet-4-6 if confidence < 0.70 |
| Tax invoice | `invoice` | claude-haiku-4-5 | claude-sonnet-4-6 |
| Ghana ID card | `id_card` | claude-haiku-4-5 | claude-sonnet-4-6 |
| Bulk count | `bulk_scan` | claude-haiku-4-5 | claude-sonnet-4-6 |

Price extraction: all GHS values converted to pesawas (× 100) before storage.

---

## 7. Theme System

4 colour themes stored in `src/store/theme.ts` (Zustand + AsyncStorage):

| Theme | Primary | Use case |
|-------|---------|---------|
| Ocean | `#0F766E` | Default teal |
| Midnight | `#2563EB` | Blue/corporate |
| Amber | `#B45309` | Warm/gold |
| Savanna | `#65A30D` | Earth/green |

Theme is applied via `useTheme()` hook (`src/hooks/useTheme.ts`) which returns a Colors-compatible object with the dynamic primary overrides. **Important:** `StyleSheet.create()` is static — any component needing theme must use `useTheme()` and apply the primary via inline `style` prop.

---

## 8. Offline Support

Implemented for the sale flow only:
- `src/store/offlineQueue.ts` — Zustand store with AsyncStorage persistence
- Failed sale POST requests are queued with full payload
- `useOfflineSync` hook polls for network reconnection and retries queued sales
- Offline banner shown in tab bar when pending sales exist

**Not yet offline-capable:** inventory edits, credit updates, treasury operations.

---

## 9. Environment Variables Required

### Backend (Fly.io secrets)
```
DATABASE_URL=          # Supabase PostgreSQL connection string
JWT_SECRET=            # Secret for signing JWTs
ANTHROPIC_API_KEY=     # Claude Vision API
TWILIO_ACCOUNT_SID=    # Twilio SMS
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_ENABLED=true    # Set false to use 000000 bypass
```

### Mobile (EAS environment / `.env`)
```
EXPO_PUBLIC_API_URL=https://sikasem-api.fly.dev/v1
EXPO_PUBLIC_ENV=production
```

---

## 10. Build & Deployment

### Mobile
```bash
# Build for iOS
cd mobile
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --latest

# Build for Android (not yet done)
eas build --platform android --profile production
```

### Backend
```bash
cd backend
fly deploy
```

### Database Migrations
SQLAlchemy `Base.metadata.create_all()` is used on startup — **no Alembic migrations yet**. Agency should implement proper migration tooling before any schema changes.

---

## 11. Outstanding Work (Prioritised)

### P0 — Critical for launch
| # | Task |
|---|------|
| 1 | Android build + testing |
| 2 | JWT refresh token (auto-logout UX is poor) |
| 3 | Staff invitation flow (Settings → Invite Team Member) |
| 4 | OTP rate limiting on backend |
| 5 | Proper database migration system (Alembic) |

### P1 — High priority
| # | Task |
|---|------|
| 6 | Push notifications for low stock + overdue credits |
| 7 | GRA VFRS-compliant tax export (CSV/PDF) |
| 8 | WhatsApp Business API integration (real messages) |
| 9 | Category picker state persistence on back navigation |
| 10 | Offline support for inventory and credit operations |

### P2 — Medium priority
| # | Task |
|---|------|
| 11 | Analytics charts (revenue trends, top products) |
| 12 | Multi-shop support (owner with multiple locations) |
| 13 | Supplier management and reorder automation |
| 14 | Receipt printing (Bluetooth thermal printer) |
| 15 | Customer loyalty / repeat purchase tracking |

### P3 — Nice to have
| # | Task |
|---|------|
| 16 | Dark mode |
| 17 | Biometric app lock |
| 18 | CSV/Excel export for all reports |
| 19 | In-app upgrade to Pro (payment integration) |
| 20 | Multi-language support (Twi, Ga, Hausa) |

---

## 12. Testing Status

| Area | Status |
|------|-------|
| Manual testing (iOS TestFlight) | ✅ Ongoing (builds 13–29) |
| Unit tests | ❌ None written |
| Integration tests | ❌ None written |
| End-to-end tests | ❌ None written |
| Android testing | ❌ Not started |
| Performance testing | 🔶 Manual load observation only |

**Recommendation:** Agency should establish a testing baseline before major feature work. Suggest Detox for E2E on mobile and Pytest for backend.

---

## 13. Code Quality Notes

- TypeScript strict mode: partially enforced (`tsc --noEmit` passes but some `any` casts exist in screens)
- No ESLint config present — agency should add
- `StyleSheet.create()` used throughout — theme-sensitive colors must use `useTheme()` inline (documented pattern)
- API error handling is inconsistent across screens — some show Alert, some silently reroute
- No logging/analytics SDK (e.g. Sentry, PostHog) — add before launch

---

## 14. Contacts & Accounts

| Resource | Owner |
|----------|-------|
| Apple Developer Account | Jeffrey Mensah-Roberts (Individual) — CKT7B7ZGUZ |
| Expo EAS | @jeffrey102000 |
| GitHub | Asterixbase/Sikasem |
| Fly.io | sikasem-api |
| Supabase | (product owner) |
| Twilio | (product owner) |
| Anthropic API | (product owner) |
