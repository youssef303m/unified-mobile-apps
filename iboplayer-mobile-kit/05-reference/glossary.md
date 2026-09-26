# Glossary

| Term | Meaning |
|---|---|
| **IBO backend / panel** | IBOPlayer's own servers. They register devices, hold each device's playlists, portals and account status, and serve language packs and notices. Several mirror domains exist (02-backend/overview.md) |
| **Device id / MAC** | the identifier a device is registered under. On TVs it is the TV's MAC address. The user types it on the website to add playlists. The phone equivalent is decided in 02-backend/device-and-auth.md |
| **Device key** | a short numeric key shown next to the device id, which the website asks for together with it |
| **Activation / trial / expired** | account states returned by the backend. They decide whether content is reachable (01-product/business-rules.md) |
| **Playlist** | a content source the user added on the website. It is one of three types, listed below |
| **Xtream (XC)** | a playlist type: server URL, username and password, read through `player_api.php` (02-backend/xtream.md) |
| **M3U** | a playlist type: a URL to an `#EXTM3U` text file listing streams (02-backend/m3u.md) |
| **Stalker / MAC portal / Ministra** | a playlist type: a portal URL plus a MAC address, using the STB (set-top box) JSON API with handshake tokens (02-backend/stalker.md) |
| **Portal** | the app's word for a Stalker playlist, managed on its own page |
| **Live / VOD / Series** | the three kinds of content: TV channels, movies, and series with seasons and episodes |
| **Category** | a group of items of one kind, as defined by the source (`category_id`, M3U `group-title`, Stalker genre) |
| **Load on demand** | a playlist setting: fetch each category's items when it is opened, instead of the whole catalogue at once. Stalker always works this way |
| **EPG** | Electronic Programme Guide: the programme schedule per live channel (02-backend/epg-and-catchup.md) |
| **Catch-up / Replay / timeshift / archive** | watching a past programme of a live channel, from the provider's archive (`tv_archive`) |
| **Sports** | a Live section built by detecting sports categories by keyword (SportsFilterService); enabled for IBOPlayer |
| **Parental control / PIN** | a 4-digit PIN that locks adult and chosen categories (business-rules.md) |
| **Stararcs** | a "smart proxy" service the app can route streams through (02-backend/services.md) |
| **TMDB** | The Movie Database: metadata and artwork used to enrich movies and series, and to look up subtitles |
| **ibosub** | the subtitles service used to fetch external SRT subtitles by TMDB id (01-product/player.md) |
| **storage_id / `gz3rYzUIC7_`** | the prefix of every key the IBOPlayer TV app stores locally. The phone app reuses the key names (02-backend/data-models.md) |
| **Home contract / sections** | TV implementation terms: the section names `live`, `vod`, `series`, `replay`, `sports`, `live_favorites`, `playlists`, `settings`, `portals`, `stararcs`. Handy as route and analytics names |
| **Parity** | "does what the TV app does, following the same rules" |
| **R-xxx** | a numbered business rule in 01-product/business-rules.md |
| **N-xx** | a numbered new (phone-only) feature in 01-product/new-features.md |
| **`Q-<name>`** | an open question in 05-reference/open-questions.md, with its default answer |
