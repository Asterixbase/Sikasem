# Sikasem App — Issues Log
**Project:** Sikasem v1.3.0 — Ghanaian Retail Management App  
**Platform:** iOS (TestFlight) · Android (planned)  
**Repo:** Asterixbase/Sikasem  
**Last Updated:** 2026-04-06  
**Current Build:** 29 (TestFlight)

---

## Legend
| Status | Meaning |
|--------|---------|
| ✅ Fixed | Resolved and shipped in a build |
| 🔶 Partial | Mitigated but not fully resolved |
| ❌ Open | Known issue, not yet addressed |
| 🧪 In Testing | Fix shipped, awaiting test confirmation |

---

## Build History Summary
| Build | Date | Notes |
|-------|------|-------|
| 13 | Pre-session | First working build — login + basic navigation |
| 14 | Pre-session | Design system tokens, OCR wiring, offline queue |
| 15 | Pre-session | Splash screen colour fix |
| 20–21 | Pre-session | N+1 database performance fix |
| 22–25 | Session | Treasury, RBAC, OCR fixes, UX polish |
| 26 | 2026-04-05 | Theme system (4 colours), superuser role |
| 27 | 2026-04-06 | Product-name search, dashboard live data |
| 28 | 2026-04-06 | Log Out button added to Settings |
| 29 | 2026-04-06 | Theme propagation fix, OCR refill fix |

---

## Issue Log

### ISS-001 — Dashboard tiles not centred
- **Build found:** 13  
- **Build fixed:** 14  
- **Status:** ✅ Fixed  
- **Description:** Metric tiles (items sold, low stock, margin, SKUs) were not evenly spaced and did not form a proper 2×2 grid.  
- **Root cause:** Two separate row `<View>` elements instead of a single `flexWrap: 'wrap'` grid. MetricTile margin was asymmetric.  
- **Fix:** Merged both rows into one `tilesGrid` with `flexDirection: 'row', flexWrap: 'wrap'`.

---

### ISS-002 — Collection logs crash ("undefined is not a function")
- **Build found:** 13  
- **Build fixed:** 14  
- **Status:** ✅ Fixed  
- **Description:** Tapping "View Collection Log" crashed the app with "undefined is not a function".  
- **Root cause:** `data?.collections ?? data ?? []` fell through to the raw object when backend returned `{ total: 0 }` without a `collections` array key. Calling `.filter()` on a plain object throws.  
- **Fix:** `const raw = data?.collections ?? data; const collections = Array.isArray(raw) ? raw : [];` Also added defensive `getInitials()` guard against null names.

---

### ISS-003 — No bulk scan / label OCR option from scan screen
- **Build found:** 13  
- **Build fixed:** 14  
- **Status:** ✅ Fixed  
- **Description:** The scan screen had no way to switch to LABEL OCR or BULK COUNT modes.  
- **Fix:** Added 3-tab mode strip at bottom of scan screen (BARCODE / LABEL OCR / BULK COUNT). OCR and Bulk tabs navigate to `bulk.tsx`.

---

### ISS-004 — No way to add products without scanning a barcode
- **Build found:** 13  
- **Build fixed:** 14  
- **Status:** ✅ Fixed  
- **Description:** Users with no barcode had no entry point to add new inventory items.  
- **Fix:** Added "＋ Add Item Manually" shortcut below the scan frame in `scan.tsx`, navigating to `scan-result` with no barcode param.

---

### ISS-005 — Severe loading lag (N+1 database queries)
- **Build found:** 20  
- **Build fixed:** 21  
- **Status:** ✅ Fixed  
- **Description:** Dashboard and report screens took 8–15 seconds to load. Each product was generating a separate SQL query, resulting in 52+ round trips per dashboard load.  
- **Root cause:** Sequential `await db.execute()` loops per product for velocity, margins, and stock calculations.  
- **Fix:** Replaced all sequential queries with `asyncio.gather()` for concurrent execution and `GROUP BY` / `JOIN` queries for batch aggregation. Dashboard now runs 6 queries in parallel.

---

### ISS-006 — "Vault" terminology unfamiliar to Ghanaian users
- **Build found:** 22  
- **Build fixed:** 22  
- **Status:** ✅ Fixed  
- **Description:** The financial module was named "Vault" — not a term Ghanaian shop owners associate with business finance.  
- **Fix:** Renamed to "Treasury" throughout — screen title, navigation route (`/treasury`), API endpoint (`/treasury`), tab icon, API client (`treasuryApi`).

---

### ISS-007 — No role-based access control
- **Build found:** 22  
- **Build fixed:** 22  
- **Status:** ✅ Fixed  
- **Description:** All users could access all screens regardless of their role. Treasury and financial data were visible to staff and inventory managers.  
- **Fix:** Implemented full RBAC system:
  - JWT now carries `role` claim (owner / manager / staff / superuser)
  - `RoleGate` component wraps protected screens with a locked overlay
  - `useRole()` hook provides permission helpers
  - Treasury restricted to `owner` + `superuser`
  - Backend `require_owner` dependency added to all `/treasury/*` endpoints

---

### ISS-008 — OCR label scanner not populating product fields
- **Build found:** 22  
- **Build fixed:** 22 (partial) → 29 (full)  
- **Status:** 🧪 In Testing (Build 29)  
- **Description:** After scanning a product label with the camera, the product fields (name, price, etc.) on scan-result were not being filled in.  
- **Root cause (multiple):**  
  1. **Race condition:** `useFocusEffect` with `[ocrResult]` dependency read stale React state when `router.back()` fired before re-render.  
  2. **Prompt quality:** OCR prompt didn't explicitly handle Ghanaian price formats (GH₵, GHS).  
  3. **Re-launch bug (Build 29):** `useEffect [barcode]` re-ran on re-mount (after returning from camera-label), calling `getByBarcode` → 404 → launching camera again before `useFocusEffect` could read the store.  
- **Fixes:**  
  - Build 22: `useOcrLabelStore.getState()` in `useFocusEffect` (no React dependency), improved OCR prompt  
  - Build 29: `cameraLaunchedRef` prevents re-launch; store checked before auto-launch; `useFocusEffect` deps removed

---

### ISS-009 — Barcode scanner showing error alert for unknown barcodes
- **Build found:** 23  
- **Build fixed:** 23  
- **Status:** ✅ Fixed  
- **Description:** Scanning an unknown barcode showed "Could not look up barcode" error alert instead of routing to the new product entry screen.  
- **Root cause:** `getByBarcode` API error was caught and shown as an alert.  
- **Fix:** Any error from `getByBarcode` now silently routes to `scan-result` with the barcode param (treating it as a new product).

---

### ISS-010 — Label OCR "← Back" button not working
- **Build found:** 23  
- **Build fixed:** 23  
- **Status:** ✅ Fixed  
- **Description:** Tapping Back on the Label OCR camera screen had no effect — there was no history to return to.  
- **Root cause:** Used `router.replace()` to navigate to `bulk.tsx`, which replaced the scan screen in the history stack.  
- **Fix:** Changed to `router.push()` so the scan screen remains in history.

---

### ISS-011 — Filter chip bar stretching full screen height when list is empty
- **Build found:** 23  
- **Build fixed:** 23  
- **Status:** ✅ Fixed  
- **Description:** Chip filter bars (e.g. on Low Stock screen) stretched vertically to fill the screen when there were no items below them.  
- **Root cause:** `alignItems: 'center'` in `contentContainerStyle` of a horizontal `ScrollView` caused the bar to fill available height.  
- **Fix:** Added `barOuter: { flexGrow: 0, flexShrink: 0 }` on the `ScrollView` itself.

---

### ISS-012 — Dates displaying as YYYY/MM/DD instead of DD/MM/YYYY
- **Build found:** 23  
- **Build fixed:** 23  
- **Status:** ✅ Fixed  
- **Description:** All date fields in the app showed YYYY/MM/DD format (e.g. "2026/04/01") instead of the Ghanaian/UK standard DD/MM/YYYY.  
- **Root cause:** `toLocaleDateString('en-GB')` is inconsistent across React Native JS engines and returned ISO-adjacent format on some iOS devices.  
- **Fix:** Replaced all date formatting with manual `parseIso()` string builder in `src/utils/date.ts`.

---

### ISS-013 — Tax journal showing "GHS NaN" for all amounts
- **Build found:** 23  
- **Build fixed:** 23  
- **Status:** ✅ Fixed  
- **Description:** Tax compliance journal rows showed "GHS NaN" for vendor name and all amounts.  
- **Root cause:** Frontend was reading `inv.vendor`, `inv.amount`, `inv.vat` but backend returns `inv.vendor_name`, `inv.total_amount_pesawas`, `inv.vat_amount_pesawas`.  
- **Fix:** Updated `tax.tsx` to use the correct field names with explicit mapping.

---

### ISS-014 — No settings cog or user profile access from dashboard
- **Build found:** 24  
- **Build fixed:** 24  
- **Status:** ✅ Fixed  
- **Description:** Users had no quick way to reach Settings from the main dashboard.  
- **Fix:** Added settings cog (⚙️) and avatar button to the dashboard app bar, both navigating to Settings.

---

### ISS-015 — Dashboard only showed one urgency level of stock alerts
- **Build found:** 24  
- **Build fixed:** 24  
- **Status:** ✅ Fixed  
- **Description:** Stock alerts only showed one severity. Dashboard needed to surface a mix of critical (red), warning (amber), and info alerts.  
- **Fix:** Backend now classifies alerts as `critical` (0 stock or ≤2 days left) or `warning` (≤7 days or ≤5 units). Frontend maps both `warning` and `high` urgency to amber cards.

---

### ISS-016 — Search returns no results for product names
- **Build found:** 27  
- **Build fixed:** 27  
- **Status:** ✅ Fixed  
- **Description:** Searching "Indomie" in the Search Transactions screen returned blank results even when Indomie sales existed.  
- **Root cause:** Backend only matched against `sale.reference` (e.g. "SALE-ABC123"), not against product names in line items.  
- **Fix:** Backend now JOINs `sale_items → products` and checks `lower(product.name).contains(q)` to find all sales containing the searched product.

---

### ISS-017 — Dashboard missing live data (cash/MoMo split, daily change, recent sales)
- **Build found:** 27  
- **Build fixed:** 27  
- **Status:** ✅ Fixed  
- **Description:** Dashboard hero card showed 0 for cash and MoMo breakdowns. Revenue % change vs yesterday never appeared. No recent activity feed.  
- **Root cause:** Backend `/reports/dashboard` endpoint never calculated or returned `today_cash_pesawas`, `today_momo_pesawas`, `revenue_change_pct`, `sold_change`, `recent_sales`, `top_product_today`, or `shop_name`.  
- **Fix:** Dashboard endpoint expanded with additional concurrent queries returning all missing fields. Frontend updated to render top seller card and recent sales feed.

---

### ISS-018 — No Log Out button in Settings
- **Build found:** 28  
- **Build fixed:** 28  
- **Status:** ✅ Fixed  
- **Description:** Users had no way to log out of the app from the Settings screen.  
- **Fix:** Added "Log Out" button (red border) at the bottom of Settings with a confirmation dialog.

---

### ISS-019 — Superuser role not applied after backend change
- **Build found:** 27  
- **Build fixed:** 28 (backend) + 29 (confirmed)  
- **Status:** 🧪 In Testing  
- **Description:** Phone `+447863482507` was showing as `staff` role despite backend superuser logic being deployed.  
- **Root cause:** Backend had not been redeployed after superuser code was added. Old JWT in SecureStore persisted.  
- **Fix:** Backend redeployed to Fly.io. User must log out and log back in to receive new JWT with `role=superuser`.

---

### ISS-020 — Theme colours not propagating to all screens
- **Build found:** 29 (identified)  
- **Build fixed:** 29  
- **Status:** 🧪 In Testing  
- **Description:** Changing theme in Settings updated the dashboard hero card and FAB but left most screens (filter chips, loading spinners, scan corners, metric tile positive values) using the hardcoded teal colour.  
- **Root cause:** `StyleSheet.create()` bakes colours at module load time. Components referenced `Colors.g` statically.  
- **Fix:** Created `useTheme()` hook returning dynamic Colors override. Updated `FilterChip`, `MetricTile`, `LoadingState`, `ErrorState`, and `scan.tsx` to use inline styles from `useTheme()`.

---

## Open Issues / Known Gaps

### ISS-021 — Android build not yet produced
- **Status:** ❌ Open  
- **Description:** All builds have been iOS-only. Android `.apk`/`.aab` has not been generated or tested.

### ISS-022 — Category picker returns to scan-result but category not always persisted
- **Status:** ❌ Open  
- **Description:** After selecting a category in `cat.tsx` and returning, the `categoryId` state is sometimes reset if the screen is re-mounted.

### ISS-023 — No push notifications for stock alerts or overdue credits
- **Status:** ❌ Open  
- **Description:** Low stock and overdue credit alerts only visible on dashboard. No background push notification system implemented.

### ISS-024 — WhatsApp order sharing not wired to real WhatsApp API
- **Status:** ❌ Open  
- **Description:** WhatsApp integration screens exist but use simulated messages rather than a real WhatsApp Business API integration.

### ISS-025 — Staff invitation flow is placeholder
- **Status:** ❌ Open  
- **Description:** "Invite Team Member" in Settings shows an alert saying "coming soon". No actual invitation or onboarding flow for staff/manager roles.

### ISS-026 — Offline queue not surfacing sync errors to user
- **Status:** ❌ Open  
- **Description:** The offline sale queue syncs on reconnect but does not surface individual sync failures to the user (e.g. if a product was deleted while offline).

### ISS-027 — GRA VAT export is UI-only
- **Status:** ❌ Open  
- **Description:** The GRA tax export screen exists but does not generate a compliant VFRS export file.
