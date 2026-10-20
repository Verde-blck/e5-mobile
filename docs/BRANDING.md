# Branding

The app follows the web dashboard's look: the same two brand colours, the same three typefaces, the
same dot-grid canvas with its faint brand washes, and the same "Command Centre" sign-in panel.

| What | Where |
|---|---|
| Colours (teal `#0A6659`, deep green `#0C352F`) | `tailwind.config.js` (`brand-*`), `src/shared/brand/mark.ts` |
| Type: Inter (UI), Epilogue (headings), Geist Mono (readings, IDs, timers, tabular figures) | `tailwind.config.js` `fontFamily`, loaded in `src/app/_layout.tsx` |
| Page backdrop: dot grid + teal wash (top-left) + deep-green wash (top-right), from the web's `.app-canvas` | `src/shared/components/AppCanvas.tsx`, used by `Screen` |
| Sign-in hero: constellation of helmets, a route, a geofence and readings | `src/shared/components/BrandConstellation.tsx`, `src/app/sign-in.tsx` |
| Product mark (mint tile with a hard hat) | `src/shared/components/BrandMark.tsx`; vector sources in `assets/brand/source/` |
| Company logo (E5 ENERGY) | `assets/brand/e5-energy-logo.png`, `CompanyLogo` in `src/shared/components/Logo.tsx` |
| Launcher icon, adaptive icon (+ themed monochrome), splash, notification icon, favicon | `assets/*.png`, configured in `app.json` |

## The company logo is an interim

`assets/brand/e5-energy-logo.png` is a crop of the logo from a screenshot of the web sign-in page (96 x 56
pixels, enlarged), so it is soft on a high-density screen. **Replace that one file with the original** (a
transparent PNG at 3x or better, or anything with about the same proportions) and every place it appears is
fixed: `CompanyLogo` reads the file's own size. It appears on the sign-in card and in More > About.

## Rules kept on purpose

- Alarm red and amber stay the most salient colours on screen. The canvas is faint for that reason, and E5's
  orange is deliberately not a UI colour (it appears only inside the logo).
- Numbers that refresh (readings, IDs, timers) use tabular figures so the layout doesn't jitter.

## Orientation

The app is locked to **portrait** (`orientation` in `app.json`). Layouts that split into two panes (map and
list, editor and map) still exist for screens at least 840 dp wide, which in portrait means only the largest
tablets, and the browser preview.

## Start-up

Styles import first; fonts load before anything renders; the splash screen stays up until fonts and the saved
session are both ready. A saved-session check that can't reach the server gives up after 6 seconds and uses the
saved profile, so a dead network can't hold the splash screen.
