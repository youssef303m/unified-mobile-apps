# Design system

The app is a dark, content-first streaming UI in the style of the big streaming apps: full-bleed
artwork, horizontal rows of posters, a hero banner, a bottom tab bar, and very little chrome.
"Netflix-like" describes the **interaction model and density**, never the branding. Do not use
Netflix's name, logo, fonts (Netflix Sans), "N" mark, red (#E50914) or any of its artwork.
The brand is IBOPlayer: its red comes from the IBO logo.

All values below are the source of truth. Implement them once as a theme module
(`src/theme/tokens.ts`) and never hard-code a colour or size in a component.

## 1. Colour tokens

The app is **dark only** in v1. Android's system light mode does not change it.

### Brand

| Token | Value | Use |
|---|---|---|
| `brand.primary` | `#BF242E` | the logo red: primary buttons, active tab icon, progress bars, focus rings, the live dot |
| `brand.primaryPressed` | `#950606` | pressed state of primary buttons (the TV app's `brand-primary`) |
| `brand.deep` | `#690101` | gradients behind the hero, splash glow |
| `brand.accent` | `#C0392B` | secondary accents (badges such as "NEW", "CATCH-UP") |
| `brand.light` | `#FF8484` | red text on dark surfaces where `brand.primary` fails contrast (small text only) |
| `brand.logoGrey` | `#323232` | the "TV" triangle of the logo on light backgrounds |

### Neutrals and surfaces

| Token | Value | Use |
|---|---|---|
| `bg.base` | `#000000` | screen background (and the status and navigation bars) |
| `bg.elevated` | `#141414` | the tab bar, bottom sheets, modals |
| `surface.1` | `#1F1F1F` | cards, inputs, list rows |
| `surface.2` | `#2B2B2B` | pressed rows, chips, the skeleton shimmer base |
| `surface.3` | `#3A3A3A` | dividers on surfaces, the skeleton shimmer highlight |
| `border.subtle` | `rgba(255,255,255,0.08)` | hairlines |
| `scrim.top` | `linear 180°: rgba(0,0,0,0.7) → transparent` | behind the header over the hero artwork |
| `scrim.bottom` | `linear 0°: #000 → transparent` (60% of the hero height) | the hero fading into the rows |

### Text

| Token | Value | Use |
|---|---|---|
| `text.primary` | `#FFFFFF` | titles, body |
| `text.secondary` | `#B3B3B3` | metadata (year · rating · duration), captions |
| `text.tertiary` | `#808080` | disabled, placeholders |
| `text.onPrimary` | `#FFFFFF` | text on `brand.primary` |
| `text.inverse` | `#000000` | text on the white "Play" button |

### Status

| Token | Value | Use |
|---|---|---|
| `status.success` | `#46D369` | downloaded, active subscription |
| `status.warning` | `#F5B50A` | expiry soon (the TV app's expiry card) |
| `status.danger` | `#E5484D` | errors, expired account (distinct from the brand red, so errors never look like buttons) |
| `status.info` | `#3E8EF7` | info toasts |

Contrast: `text.secondary` on `bg.base` is 9.9:1, and `text.onPrimary` on `brand.primary` is 5.9:1
(both pass WCAG AA). Never put `brand.primary` text smaller than 18sp on black. Use
`brand.light` for smaller red text.

## 2. Typography

Font: **Inter** (SIL Open Font License, bundled with `expo-font`: weights 400, 500, 600, 700
and 800). Fall back to Roboto. Arabic, Persian and Urdu use **Noto Sans Arabic**, and Hindi uses
**Noto Sans Devanagari** (also OFL), because Inter has no glyphs for those scripts. Pick the
family from the active language.

| Style | Size / line height (sp) | Weight | Use |
|---|---|---|---|
| `display` | 32 / 38 | 800 | the hero title when there is no title logo |
| `h1` | 24 / 30 | 700 | the screen title (Settings, My List) |
| `h2` | 20 / 26 | 700 | the details page title |
| `h3` | 17 / 22 | 700 | row titles ("Continue Watching") |
| `body` | 15 / 21 | 400 | synopsis, settings rows |
| `bodyStrong` | 15 / 21 | 600 | button labels, list titles |
| `meta` | 13 / 18 | 500 | the metadata line, chips |
| `caption` | 11 / 14 | 600 | badges, the tab bar labels (uppercase for badges only) |

Respect the system font scale up to 1.3×. Beyond that, cap the scale (`maxFontSizeMultiplier = 1.3`)
on poster captions and the tab bar only.

## 3. Spacing, radius, elevation

- **Spacing scale (dp):** 2, 4, 8, 12, 16, 20, 24, 32, 40, 56. The screen side gutter is **16**. Rows
  are 24 apart, and the gap between posters is **8**.
- **Radius:** posters 6, cards 8, buttons 6, chips 16 (pill), bottom sheets 16 (top corners), inputs 8.
- **Elevation:** almost none. Separate surfaces by colour (`surface.1/2/3`), not by shadow. Only the
  bottom sheet and the mini player get a shadow (`0 -4 16 rgba(0,0,0,0.5)`).
- **Touch targets:** at least 48×48dp, even when the icon is 24dp.

## 4. Artwork sizes

| Element | Aspect | Size on a 360dp-wide phone | Source field |
|---|---|---|---|
| Poster (movies, series) | 2:3 | 110 × 165 | `stream_icon` / `cover` (movies and series). If it is missing, use a TMDB poster (see 02-backend/services.md), then `assets/brand/splash-portrait-720x1280.png` cropped |
| Continue-watching card | 16:9 | 150 × 84 + a 3dp progress bar | the backdrop (`backdrop_path[0]`), else the poster |
| Hero | 2:3 artwork, full width | 360 × 480, fading into black | backdrop or poster (TMDB for quality) |
| Live channel logo | 1:1 (letterboxed) | 56 × 56 on `surface.1`, contain | `stream_icon` |
| Live "now" card | 16:9 | 200 × 112 | channel logo centred on `surface.2` with the EPG title under it |
| Episode still | 16:9 | 128 × 72 | `movie_image` / episode `info.movie_image`, else the series backdrop |
| Backdrop (details page) | 16:9 | full width | `backdrop_path[0]` → TMDB backdrop → `assets/images/backdrop-placeholder-1920x1080.png` |

Load all images through `expo-image` with memory and disk caching, a 200ms fade-in, and the
`surface.2` colour as the placeholder. IPTV artwork URLs are often broken or `http://`, so allow
cleartext traffic (see 04-build/tech-stack.md) and fall back silently.

## 5. Core components

Build these in `src/components/` before any screen. Each has a story in the in-app component
gallery (a dev-only screen).

| Component | Anatomy and behaviour |
|---|---|
| `PosterCard` | the 2:3 image, radius 6, an optional corner badge (`NEW`, a lock icon for parental, a downloaded tick). Pressed state: scale 0.96, 120ms. A long press opens `QuickActionsSheet`. |
| `ContinueCard` | the 16:9 image with a progress bar pinned to the bottom (`brand.primary` on `rgba(255,255,255,0.3)`), and the title plus "S2:E5" under it. A ⋮ button opens "Remove from row" and "Details". |
| `ContentRow` | an `h3` title plus an optional "See all ›" link, and a horizontal `FlashList` of cards with 16dp side insets. Its skeleton is 4 grey cards. |
| `HeroBanner` | the artwork with both scrims, the title (or TMDB logo image), a genre line (`meta`, " • " separated), then three actions: **＋ My List** (icon + caption), a **Play** button (white fill, black text, ▶ icon), and **ⓘ Info**. |
| `CategoryChips` | a horizontal pill list under the header: "Movies ▾" opens the category picker sheet. Selected: white fill, black text. Idle: 1dp `text.tertiary` outline. |
| `TopBar` | transparent over the hero, turning into `bg.elevated` at 90% opacity after 40dp of scroll. Left: the logo (`assets/brand/logo-dark-bg-512.png` at 28dp tall). Right: Cast (v2), Search, and the profile avatar. |
| `TabBar` | 5 tabs on `bg.elevated`. The icons are outline when idle and filled plus `text.primary` when active, with `caption` labels. A download-count badge appears on My List. |
| `ChannelRow` | the logo (56), the channel number and name (`bodyStrong`), the now-playing title with a thin progress bar and times (`meta`), and a ♥ favourite toggle on the right. Pressed: `surface.2`. |
| `EpgTimeline` | a horizontally scrolling time grid (1 hour = 240dp), with rows of the same height as `ChannelRow`, a now-line in `brand.primary`, a catch-up icon on past programmes that have an archive, and sticky channel logos. |
| `EpisodeRow` | the still (128×72) with a progress bar, "1. Title", the duration, a 2-line synopsis, and a download button (states: idle ↓, queued, downloading with a ring progress, done ✓, error !). |
| `PrimaryButton` / `SecondaryButton` | height 44, radius 6. Primary: white fill, black text (streaming-app style Play). Brand: `brand.primary` fill. Secondary: `surface.2`. |
| `SettingsRow` | the icon, title, value (`text.secondary`) and chevron, or a switch. Grouped in sections with `caption` headers. |
| `BottomSheet` | `@gorhom/bottom-sheet`, the `bg.elevated` background, a drag handle, and the 16dp top radius. Used for category pickers, audio and subtitle tracks, quality, sort, and playlist switching. |
| `PinPad` | 4 dots and a 3×4 numeric keypad. It shakes on a wrong PIN. It is used for parental control (see 01-product/business-rules.md). |
| `Toast` | a bottom snackbar above the tab bar, `surface.2`, 4s. It replaces the TV app's toasts (same texts, from the locale files). |
| `EmptyState` | a centred icon, `h3` title and `body` text, with an optional action button. |
| `Skeleton` | a shimmer (1.2s loop) with the same geometry as the real component. |

## 6. Iconography

Use `lucide-react-native` (ISC licence): 24dp, 2dp stroke, `text.primary`. Use filled variants
only for the active tab and a toggled state (♥ favourite, ✓ in My List). The live badge is a
6dp `brand.primary` dot plus a white `caption` "LIVE".

## 7. Motion

- **Screen transitions:** the native stack default (a horizontal slide), 250ms. The details page
  opens as a modal-style push from the bottom on Android 14+ predictive back, if supported by the
  navigation library.
- **Hero crossfade:** 400ms when the featured item changes (which is never automatic in v1).
- **Row posters:** a press scale of 0.96 in 120ms, `Easing.out(Easing.quad)`.
- **Player controls:** fade in and out in 200ms, and auto-hide after 4s of no touch.
- **Reduce motion:** honour `AccessibilityInfo.isReduceMotionEnabled()`. Remove the shimmer and
  the scale effects, and keep the fades.

## 8. Brand usage

- **Splash:** black background with `assets/brand/splash-logo-dark-bg-1024.png`. It is the dark-screen
  version of the logo, whose "TV" triangle is light grey so it shows on black. This matches the TV
  app's splash `splash-portrait-720x1280.png`.
- **In-app logo:** use `logo-dark-bg-512.png` on dark screens. Use `logo-light-bg-512.png` or the
  original `logo-512.png` only on white.
- **App icon:** `icon-1024.png` (the logo on white, as on the TV stores). For Android adaptive icons,
  `adaptive-icon-foreground-1024.png` is the transparent foreground with the logo inside the 66%
  safe zone, on a `#FFFFFF` background colour.
- Do not recolour the red, add effects, or rotate the mark. See `assets/README.md` for every file.
