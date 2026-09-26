# Translations

`locales/` holds the TV app's 18 languages, with the brand name already filled in
(IBOPlayer):

`ar da de en es fa fi fr hi it nl no pl pt ru sv tr ur`

- Each file is a flat JSON object, `{ "key": "text" }`. `en.json` is the master list: 470 keys.
  Every other file has 410; the 60 keys missing from them fall back to English.
- There are no placeholders in the strings. The TV app builds sentences with numbers by joining
  strings in code (for example the expiry countdown). Keep that approach for the existing keys,
  or replace such a sentence with a new key that uses i18next interpolation (`{{count}}`) and add
  it as described below.
- ar, fa and ur are right-to-left.

## Setup

- i18next with `fallbackLng: "en"`, `returnEmptyString: false`, and `keySeparator: false` (keys contain
  dots and dashes, and are not nested).
- **Language at first launch:** the device language (`expo-localization`) if it is one of the 18,
  else English. The user can change it in Settings → Language. Store it under the same key the TV
  app uses (see 01-product/settings.md).
- **RTL:** when switching to or from ar, fa or ur, call `I18nManager.forceRTL(...)`, then reload
  the app (`expo-updates` `reloadAsync`, or `DevSettings.reload` in development). Every layout
  must use `start`/`end`, never `left`/`right`. The player seek bar and the poster rows do **not**
  mirror (streaming-app convention); the text and navigation do.
- **Server language packs:** the TV app can also receive language packs from the IBO panel, which
  override or extend these files (see 02-backend/services.md). Apply them on top of the bundled
  file with `i18next.addResourceBundle(lang, "translation", words, true, true)`.

## Using the TV strings

Reuse an existing key whenever the meaning matches. The support team and the website use the same
wording, and the key is already translated into 17 languages. 01-product/current-app-inventory.md
quotes the keys used on each screen.

Keys that only make sense on a TV (remote colour buttons, "press OK", on-screen keyboard, exit
dialog) are simply not used. Do not delete them from the files: keeping the files identical to
the TV app's makes future syncs a copy.

## New strings for the phone app

New features (downloads, tabs, gestures, My List, …) need new keys:

1. Add the key to `en.json` with a `mobile_` prefix (for example `mobile_download_start`).
   Use i18next interpolation for numbers (`"mobile_downloads_count": "{{count}} downloads"`)
   and plurals (`_one` / `_other` suffixes).
2. Do not machine-translate into the other 17 files. They fall back to English until a translator
   fills them in.
3. Keep a list of the added keys in `docs/new-strings.md` in the new project, so they can be sent
   for translation in one batch.
