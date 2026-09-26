# Product vision

## What IBOPlayer is

IBOPlayer is a **media player for IPTV playlists that the user already owns**. It does not sell or
provide channels or content. The user (or their reseller) adds a playlist on the IBOPlayer website
against the device's id. The app then registers the device with the IBO backend, receives that
device's playlists and account status, and plays them.

- **Xtream Codes accounts:** a server, username and password.
- **M3U URLs.**
- **Stalker/MAC portals:** a portal URL and a MAC address.

Today it runs on smart TVs: Samsung Tizen, LG webOS, Hisense VIDAA, Philips/Zeasn, TitanOS and
VegaOS. This project brings the **same product** to Android phones.

## Goals

1. **Same backend, same account.** The phone is just another device on the IBO backend. It uses
   the same registration, activation, trial and expiry model, the same playlists and portals, and
   the same website for adding playlists. No backend changes should be needed for v1, other than
   the open questions in 05-reference/open-questions.md, such as which device type the phone
   reports.
2. **Same user flow and rules.** Everything a TV user can do, a phone user can do, following
   the same business rules (01-product/business-rules.md). The only exceptions are TV-only
   mechanics that have a better touch equivalent, such as remote colour keys and on-screen
   keyboards.
3. **A modern streaming-app experience.** Dark, artwork-first, rows of posters, a hero banner,
   bottom tabs, fast search, gestures in the player: the interaction model users know from the big
   streaming apps, in IBOPlayer's brand (03-design/).
4. **Things only a phone can do:** downloads for offline viewing, Picture-in-Picture, background
   audio, share, and (v2) casting. See new-features.md.

## Non-goals (v1)

- Selling, recommending or linking to content or playlist providers.
- Content that does not come from the user's own playlist. TMDB is used only to enrich the metadata
  and artwork of items the playlist already contains, exactly as the TV app does.
- Accounts and profiles beyond what the IBO backend already has: one device, one account.
  Profiles are a v2 idea, device-local only.
- iOS, Android TV and tablet-specific layouts.
- A light theme.

## Audience

- The current IBOPlayer TV users who want the same playlists on their phone.
- New users who find the app on the Play Store and activate it the same way as on a TV.
- They use it on the go and on unreliable networks, often on mid-range Android phones. Catalogues
  are huge (tens of thousands of channels), and content is very international: 18 UI languages,
  three of them right-to-left.

## Success criteria for v1

- A TV user can activate the phone, see their playlists, and play live TV, a movie and an episode
  within 2 minutes of installing, without a manual.
- Every flow in 01-product/user-flows.md works on Xtream, M3U and Stalker sources.
- Every rule in 01-product/business-rules.md has a passing test.
- The crash-free session rate is at least 99.5% in the internal beta.
- A downloaded movie plays in airplane mode.

## Store listing (draft)

- **Title:** IBO Player
- **Short description:** Play your own IPTV playlists: live TV, movies and series, anywhere.
- **Must say:** "IBO Player does not provide any content. You need your own playlist or portal."
  This matches the TV stores' positioning and is required by Google Play's policy for media players.
