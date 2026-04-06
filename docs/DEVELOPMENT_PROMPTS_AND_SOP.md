# Sikasem — AI-Assisted Development: Prompts, Framework, SOP & ASO
**Version:** 1.0  
**Date:** 2026-04-06  
**Purpose:** Guide for using Claude Code (or any AI coding assistant) effectively on the Sikasem project

---

## Part 1 — Development Framework

### Principles
1. **Read before writing** — Always read the target file before editing it
2. **One fix at a time** — Isolate each bug in a separate prompt; don't bundle unrelated changes
3. **Backend + frontend together** — When a field is missing, fix the backend response AND the frontend render in one session
4. **Test the data path** — When something doesn't display, check: (a) backend returns it, (b) API client maps it, (c) frontend reads it
5. **Name things for Ghana** — Use local terminology (Treasury not Vault, GHS not "currency", MoMo not "mobile payment")
6. **Ship often** — Prefer small builds over large ones; easier to isolate regressions

### Build Workflow
```
Code change
    → git add + commit
    → git push origin master
    → eas build --platform ios --profile production --non-interactive
    → eas submit --platform ios --latest --non-interactive
    → fly deploy (if backend changed)
    → Test on TestFlight
    → Log any new issues in ISSUES_LOG.md
```

### File Ownership
| File | What it controls |
|------|----------------|
| `mobile/app.json` | Build number, bundle ID, permissions |
| `backend/app/api/auth.py` | OTP login, JWT role, superuser phones |
| `backend/app/api/reports.py` | Dashboard data, analytics |
| `backend/app/services/ocr.py` | Claude Vision prompts and pipeline |
| `mobile/src/constants/colors.ts` | Static colour palette |
| `mobile/src/store/theme.ts` | 4 themes, Zustand persistence |
| `mobile/src/hooks/useTheme.ts` | Dynamic theme hook for components |
| `mobile/src/store/auth.ts` | JWT decode, role, login/logout |
| `mobile/src/components/common/RoleGate.tsx` | Role-gated screen wrapper |

---

## Part 2 — Suggested Prompts

### Category: Bug Fixes

**Template — fix a screen that shows blank/NaN data:**
```
The [SCREEN_NAME] screen is showing [blank/NaN/wrong value] for [FIELD].
Read the screen file at [PATH] and the backend endpoint at [PATH].
Check what field names the backend returns vs what the frontend reads.
Fix the mismatch. Don't change anything else.
```

**Template — fix a crash:**
```
The [SCREEN] screen crashes with "[ERROR MESSAGE]".
Read [FILE_PATH]. Find where [ERROR] can occur.
Add a defensive guard. Do not refactor surrounding code.
```

**Template — fix navigation not going back:**
```
The back button on [SCREEN] does not work.
Read [FILE_PATH]. Check whether router.replace() was used instead of router.push().
If so, change it to router.push() so the previous screen remains in history.
```

---

### Category: New Screens

**Template — new list screen:**
```
Create a new screen at mobile/app/(main)/[SCREEN_NAME].tsx.
It should:
- Use ScreenHeader with a back button titled "[TITLE]"
- Fetch data from GET /v1/[endpoint] using useQuery with queryKey ['[key]']
- Show a FlatList of [items] with [FIELDS] displayed
- Show LoadingState while loading, ErrorState on error, empty state when list is empty
- Use Colors, Typography, Spacing, Radius from @/constants
Follow the pattern in mobile/app/(main)/low-stock.tsx exactly.
```

**Template — new form screen:**
```
Create a new screen at mobile/app/(main)/[SCREEN_NAME].tsx.
It should:
- Accept params: [PARAM_LIST] via useLocalSearchParams
- Have form fields: [FIELD_LIST] using FormInput from @/components
- Submit via POST to /v1/[endpoint] using useMutation or direct api call
- Show validation errors inline
- On success, navigate to [TARGET_SCREEN]
- Use the same structure as mobile/app/(main)/scan-result.tsx
```

---

### Category: Backend Endpoints

**Template — new GET endpoint returning list:**
```
Add a GET endpoint to backend/app/api/[ROUTER_FILE].py.
Route: GET /v1/[path]
Auth: Depends(get_current_shop)
Query: Select [MODEL] where shop_id == shop.id, ordered by [FIELD] desc, limit [N]
Return: list of dicts with fields: [FIELD_LIST]
All monetary values must be in pesawas (integer). No floats for money.
Do not add fields that don't exist in the model.
```

**Template — fix N+1 query:**
```
The endpoint [ROUTE] has an N+1 database problem.
Read backend/app/api/[FILE].py.
Replace the per-item sequential queries with either:
(a) asyncio.gather() for concurrent independent queries, or
(b) a single JOIN/GROUP BY query that aggregates all items at once.
Follow the pattern in the dashboard endpoint in reports.py.
```

---

### Category: Theme & UI

**Template — apply theme to a screen:**
```
Read mobile/app/(main)/[SCREEN].tsx.
This screen uses Colors.g (primary colour) in static StyleSheet.create() styles.
Import useTheme from @/hooks/useTheme.
Call const C = useTheme() inside the component.
Replace all StyleSheet references to Colors.g with inline style { color: C.g } or { backgroundColor: C.g }.
Do not change any other colours or layout.
```

**Template — add a new theme:**
```
Read mobile/src/store/theme.ts.
Add a new theme to the THEMES object with:
  id: '[ID]'
  label: '[LABEL]'
  swatch: '[HEX]'
  primary: '[HEX]'
  accent: '[HEX]'
  bgLight: '[HEX]'
  bgDeep: '[HEX]'
  scanPrimary: '[HEX]'
Also add it to the ThemeId type.
```

---

### Category: Role & Permissions

**Template — restrict a screen to a role:**
```
Read mobile/app/(main)/[SCREEN].tsx and mobile/src/components/common/RoleGate.tsx.
Wrap the main content of [SCREEN] in a <RoleGate allowed={['owner']} feature="[FEATURE NAME]">.
The outer component should render RoleGate directly and the inner content component renders the actual screen.
Follow the pattern in mobile/app/(main)/treasury.tsx.
```

**Template — add a new role gate on the backend:**
```
Read backend/app/core/deps.py.
Add a new dependency function require_[ROLE]() following the pattern of require_owner().
It should decode the JWT role and raise HTTP 403 if the role is not [ROLE] or superuser.
Then add Depends(require_[ROLE]) to the endpoint in [ROUTER_FILE].
```

---

### Category: OCR

**Template — improve OCR extraction for a field:**
```
The OCR pipeline in backend/app/services/ocr.py is not extracting [FIELD] correctly.
Read the _PRODUCT_LABEL_PROMPT or _INVOICE_PROMPT.
Update the prompt to give Claude more specific instructions about [FIELD]:
- What it looks like on Ghanaian [labels/invoices]
- Alternative formats it might appear in
- Whether to guess if unclear
Do not change the JSON structure — only update the prompt text.
```

---

### Category: Build & Deploy

**Standard build + submit prompt:**
```
Bump mobile/app.json buildNumber and versionCode to [N].
Commit with message "chore: bump to build [N]".
Push to GitHub master.
Run eas build --platform ios --profile production --non-interactive in the background.
When the build completes, run eas submit --platform ios --latest --non-interactive.
```

**Backend deploy prompt:**
```
The backend has been updated. Run fly deploy from the backend/ directory.
Tell me when it's live and report the deployed URL.
```

---

## Part 3 — Standard Operating Procedure (SOP)

### SOP-001: Starting a New Development Session

1. **Read ISSUES_LOG.md** — know what's open before writing code
2. **Check the last build number** in `mobile/app.json`
3. **Check git log** — `git log --oneline | head -10` to see recent changes
4. **Confirm backend is deployed** — open `https://sikasem-api.fly.dev/docs` to verify API is live
5. **Brief Claude** — share screenshots, error messages, or specific issue IDs

---

### SOP-002: Reporting a Bug

When reporting a bug, always include:
1. **Build number** where the bug was seen
2. **Screen name** (use the tab/screen title shown in the app)
3. **What you expected** vs **what happened**
4. **A screenshot** if possible — annotate with arrows/text
5. **Steps to reproduce** (e.g. "Tap Scan → scan Indomie barcode → tap Save")

**Example well-formed bug report:**
```
Build 29, scan-result screen.
Expected: After scanning label, Product Name and Sell Price fill in automatically.
Actual: Fields remain blank. No error shown.
Steps: Scan unknown barcode → camera launches → take photo of Indomie packet → Back → fields empty.
```

---

### SOP-003: Accepting a Fix

Before marking an issue as resolved:
1. Update to the latest TestFlight build
2. Reproduce the original bug steps
3. Confirm the fix works
4. Check the fix hasn't broken adjacent screens (smoke test)
5. Update ISSUES_LOG.md status to ✅ Fixed

---

### SOP-004: Build Release Checklist

Before triggering a build:
- [ ] All code changes committed and pushed to GitHub master
- [ ] `app.json` buildNumber and versionCode incremented
- [ ] Backend deployed if any backend files changed (`fly deploy`)
- [ ] ISSUES_LOG.md updated with what this build fixes
- [ ] No TypeScript errors (`npx tsc --noEmit` in mobile/)

After TestFlight processing:
- [ ] Update app on test device
- [ ] Smoke test: login → dashboard → scan → settings
- [ ] Verify specific fixes for this build
- [ ] Record build result in session notes

---

### SOP-005: Adding a New Screen

1. Decide route: `app/(main)/[screen-name].tsx`
2. Check if a similar screen exists to use as template
3. Create the screen file
4. Register it in `app/(main)/_layout.tsx` if needed (Stack screens auto-register in Expo Router v4)
5. Add navigation from the appropriate existing screen
6. Add a backend endpoint if the screen needs new data
7. Test the navigation forward and back button
8. Add to ISSUES_LOG.md if it closes an open issue

---

## Part 4 — ASO (App Store Optimisation) Document

### App Metadata

**App Name:** Sikasem  
**Subtitle:** Shop Manager for Ghana  
**Bundle ID:** gh.sikasem.app

---

### Short Description (30 chars for subtitle)
```
Shop Manager for Ghana
```

### App Store Description (4000 chars max)

```
Sikasem is the all-in-one shop management app built for Ghanaian traders.

Whether you run a provision shop in Accra, a pharmacy in Kumasi, or a market stall in Tamale — Sikasem helps you track every sale, manage your stock, and stay on top of your finances.

KEY FEATURES

📷 Smart Scanning
Scan product barcodes instantly. New products? Point the camera at the label and Sikasem reads the name and price for you — powered by AI.

💰 Fast Sales Recording
Record sales in seconds. Split between Cash and MoMo. See today's total the moment you open the app.

📦 Inventory Management
Know your stock levels at all times. Get alerts before you run out. Track which products sell fastest.

💳 Credit Sales
Record customer credit sales with due dates. Get dashboard alerts when payments are overdue.

🧾 Tax Compliance
Scan supplier invoices and let Sikasem calculate your VAT, NHIL, and GETFund obligations automatically.

🏦 Treasury Management
Track your cash flow, record MoMo payouts, and understand your daily profit margin — all in one place.

📊 Business Reports
See your top-selling products, profit margins, and revenue trends. Know your numbers without a spreadsheet.

🔒 Built for Your Team
Assign roles to staff and managers. Control who can see your financial data. Your treasury stays private.

BUILT FOR GHANA
- Prices in GHS (Ghana Cedis)
- MoMo and Cash payment methods
- GRA VAT-ready tax tracking
- Works in low connectivity areas

Download Sikasem and digitise your shop today.
```

---

### Keywords (100 chars max)
```
shop,inventory,ghana,sales,stock,momo,receipt,market,retail,pos,account,trader,ghs,tax,vat
```

### Categories
- **Primary:** Business
- **Secondary:** Finance

---

### Screenshots — Required Screens (iPhone 6.9")
Priority order for App Store screenshots:

| # | Screen | Caption |
|---|--------|---------|
| 1 | Dashboard with revenue hero | "Know your sales the moment you open the app" |
| 2 | Barcode scan in action | "Scan any barcode — AI fills in the product" |
| 3 | Sale entry screen | "Record a sale in under 10 seconds" |
| 4 | Low stock alerts | "Never run out — get alerts before you do" |
| 5 | Treasury screen | "Track your cash flow and payouts" |
| 6 | Tax compliance journal | "Stay GRA-ready with automatic VAT tracking" |
| 7 | Settings — role & theme | "Control who sees what. Pick your colour." |

---

### Ratings & Reviews Strategy
- Prompt for review after 3rd successful sale (non-intrusive, in-app)
- Prompt again after 30 days if no review given
- Respond to all reviews within 48 hours
- Target rating: 4.5+

---

### Localisation Priority
1. English (current)
2. Twi (Akan — largest language group in Ghana)
3. Ga (Accra market)
4. Hausa (Northern Ghana / cross-border traders)

---

### Monetisation Model (Planned)
| Tier | Price | Features |
|------|-------|---------|
| Free | GHS 0 | Up to 50 SKUs, basic sales, basic reports |
| Sikasem Pro | GHS 49/mo | Unlimited SKUs, OCR scanning, GRA export, team roles |
| Enterprise | Custom | Multi-location, API access, dedicated support |

---

### Competitive Positioning
**Competitors in Ghana:**
- Manual notebook / Excel (primary competitor — no switching cost)
- QuickBooks (too complex, no MoMo, USD pricing)
- mPOS apps (payment only, no inventory)

**Sikasem differentiators:**
- Built specifically for Ghana (MoMo, GHS, GRA tax, Ghanaian product labels)
- AI label scanning — no typing required
- Works offline
- Role-based team access
- Affordable local pricing
