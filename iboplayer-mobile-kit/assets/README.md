# Assets

Everything here comes from the IBOPlayer TV app. The files under `brand/` whose names start with
`icon-`, `adaptive-`, `splash-logo-`, `logo-*-bg-` and `play-store-` were generated from the TV
app's 512px logo. **No vector (SVG) version of the logo exists**; see
05-reference/open-questions.md. The largest source is 512×512, so do not display the logo larger
than about 512px on screen. The 1024 icon files are upscaled for the stores' size requirements.

## brand/

| File | Size | Use |
|---|---|---|
| `logo-512.png` | 512×512 | the original TV logo: red "bi" play shape and a dark-grey "TV" triangle, on white |
| `logo-light-bg-512.png` | 512×512, transparent | the same logo with a transparent background, for light surfaces |
| `logo-dark-bg-512.png` | 512×512, transparent | **the in-app logo** on dark screens: the "TV" triangle is light grey with black text (as on the TV splash) |
| `logo-small-239x169.png` | 239×169 | the TV app's small logo (dark-screen colours); fine for small headers |
| `launcher-117.png` | 117×117 | the TV launcher icon (reference only) |
| `icon-1024.png` | 1024×1024 | Expo `icon`: the logo on white, full bleed (the launcher applies its mask) |
| `adaptive-icon-foreground-1024.png` | 1024×1024, transparent | Expo `android.adaptiveIcon.foregroundImage`. The logo sits inside the 66% safe zone. Use `backgroundColor: "#FFFFFF"` |
| `splash-logo-dark-bg-1024.png` | 1024×1024, transparent | Expo `splash.image` with `backgroundColor: "#000000"`, `resizeMode: "contain"`, shown at about 200dp wide |
| `splash-portrait-720x1280.png` | 720×1280 | the TV app's portrait splash (the logo centred on black). A reference for the splash look, and a poster fallback |
| `play-store-icon-512.png` | 512×512 | the Play Store listing icon |
| `play-store-feature-graphic-1024x500.png` | 1024×500 | the Play Store feature graphic. Regenerate it if the tagline changes |
| `ibo-dev-wordmark.png` | 80×43 | the "_dev." developer wordmark shown on the TV about/account screens |

Missing, and to create in the project:
- **Android notification icon:** needs a white-on-transparent silhouette. Draw it as a simple
  vector: the rounded play triangle with the "bi" mark cut out. Place it in
  `assets/notification-icon.png` (96×96) for `expo-notifications`, which download notifications use.
- **Play Store screenshots:** take them from the finished app.

## images/

| File | Use |
|---|---|
| `backdrop-placeholder-1920x1080.png` | the backdrop fallback on details pages (the TV app's `default_movie_bg`) |
| `imdb-logo.png` | next to the IMDb/TMDB rating on details pages (TV app parity) |
| `avatar.svg` | the default profile avatar (top-right of the Home header, Account page) |

## app.config.ts excerpt

```ts
export default {
  name: "IBO Player",
  slug: "iboplayer-mobile",
  scheme: "iboplayer",
  icon: "./assets/brand/icon-1024.png",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/brand/splash-logo-dark-bg-1024.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  android: {
    package: "com.iboplayer.mobile", // placeholder: confirm with the owner (see open-questions)
    adaptiveIcon: {
      foregroundImage: "./assets/brand/adaptive-icon-foreground-1024.png",
      backgroundColor: "#FFFFFF",
    },
  },
};
```

Check the current Expo docs for the exact splash config shape: newer SDKs configure the splash
through the `expo-splash-screen` config plugin instead of the top-level `splash` key.
