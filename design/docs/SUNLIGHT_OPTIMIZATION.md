# Sunlight Optimization Guide

## Why This Matters
Sikasem users are Ghanaian market traders who work outdoors. Direct sunlight washes out phone screens, making standard app UIs difficult to read. Every screen was optimized for outdoor readability.

## Design Rules Applied

### Typography
- **Font weight 700+** for all key data (amounts, quantities, status labels)
- **Minimum 13px** for body text, **26px+** for hero numbers
- No thin/light font weights anywhere in the app

### Color & Contrast
- **High saturation** status colors (not pastels)
- **White/very light backgrounds** with dark text (outperforms reversed in sun)
- **Shape + color** indicators everywhere (never color alone)
- Border width **1.5px+** (thin 1px borders disappear in glare)

### Touch Targets
- **Minimum 44px** for all interactive elements
- **48px recommended** for primary actions
- **28px checkboxes** (up from 24px standard)

### Scanner Screens (Dark Theme)
Dark backgrounds eliminate screen glare by not reflecting ambient light.
Green (#10B981) scan guides are among the most visible colors in direct sunlight.
Camera viewfinders perform better with dark surrounds as they reduce the pupil's need to adjust.

## Screen-by-Screen Scores

A+ (93-95): Quick Sale, Inventory Audit, Low Stock — maximum contrast, oversized targets
A  (88-92): Dashboard, Credit, Scanner, Product, Batch, Scan Result — bold hierarchy
B+ (85-87): Analytics, Tax — data-dense but key info still bold
