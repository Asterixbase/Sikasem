# Changelog: Improvements from Original PNGs

## Navigation
- [x] Unified bottom navigation from 5 inconsistent configs to 1 persistent 5-tab bar
- [x] Consistent back button placement and sizing (44px touch target)

## Accessibility
- [x] All touch targets standardized to minimum 44px (was 30-36px on filter chips)
- [x] All filter chips now 40px height minimum
- [x] Checkboxes enlarged to 28px

## Color & Visual
- [x] Created semantic color token system replacing ad-hoc color usage
- [x] Reduced ALL-CAPS labels to sentence case for improved readability
- [x] Added visual hierarchy through consistent typography scale (9 levels)
- [x] Status indicators use shape + color (not color alone) for sunlight readability

## Data & Currency
- [x] Fixed currency display inconsistencies (GHS throughout)
- [x] Removed "GHS GHS" bug on Vault screen
- [x] Consistent currency symbol usage

## Components
- [x] Converted text-link CTAs (Update Stock, Edit Price) to proper buttons
- [x] Standardized card components: elevated, outlined, and flat variants
- [x] Alert cards with left border + dot severity indicators
- [x] Quantity stepper with large +/- buttons

## Flows
- [x] Added selection checkboxes to Low Stock screen for batch ordering
- [x] Improved scanner UI with animated scan line and clearer mode switching
- [x] Made Quick Sale POS flow end-to-end interactive with confirmation state
- [x] Added stepper context to multi-step flows (credit creation)

## Layout
- [x] Added spacing and padding system (8px base grid) throughout
- [x] Dark mode for scanner screens (borrowed from Variation C)
- [x] Sunlight readability scores for all screens

## Design System
- [x] Prepared dark mode tokens for scanner screens
- [x] Created 11 reusable component sets with variants
- [x] TypeScript token exports for Expo/React Native
