# IBO Player for Android: build kit

This folder is everything needed to build **IBO Player**, an Android phone app in React Native
(Expo), from scratch. The app has:
- the **same backend connections, account model, user flow and rules** as the IBOPlayer smart-TV
  app;
- a **streaming-style mobile UI**: dark, artwork-first, rows of posters, bottom tabs;
- phone-only extras such as **downloads for offline viewing**, Picture-in-Picture and player
  gestures.

It was written from the TV app's source code, which the builder will not have. The protocol,
rules and texts here are extracted from that code, and the uncertainties are listed rather than
guessed.

**If you are an AI agent building the app, start with [AGENTS.md](AGENTS.md).**

## Contents

| Path | What it holds |
|---|---|
| [AGENTS.md](AGENTS.md) | working rules, reading order and definition of done for the building agent |
| **01-product/** | *what* to build |
| [vision.md](01-product/vision.md) | the product, goals, non-goals, audience, success criteria, store positioning |
| [current-app-inventory.md](01-product/current-app-inventory.md) | every screen of the TV app: contents, actions, states, messages (with locale keys) |
| [user-flows.md](01-product/user-flows.md) | every flow step by step, with diagrams, and its mobile version |
| [business-rules.md](01-product/business-rules.md) | the numbered rules (R-001…) the app must follow |
| [settings.md](01-product/settings.md) | every setting: options, default, storage key, effect |
| [player.md](01-product/player.md) | playback: URLs, engines, controls, resume, tracks, subtitles, errors, downloads |
| [new-features.md](01-product/new-features.md) | the phone-only features (N-01…) with acceptance criteria; v1 and v2 |
| **02-backend/** | *how* to talk to the servers (exact protocol) |
| [overview.md](02-backend/overview.md) | servers, server selection and failover, the start-up sequence |
| [device-and-auth.md](02-backend/device-and-auth.md) | device identity, captcha, login, payload encoding, account states |
| [ibo-api-reference.md](02-backend/ibo-api-reference.md) | every IBO backend endpoint, with requests and responses |
| [services.md](02-backend/services.md) | TMDB, image cache, subtitles (ibosub), analytics, Stararcs proxy, QR, language packs, weather |
| [xtream.md](02-backend/xtream.md) · [m3u.md](02-backend/m3u.md) · [stalker.md](02-backend/stalker.md) | the three playlist sources |
| [epg-and-catchup.md](02-backend/epg-and-catchup.md) | programme guide and replay |
| [data-models.md](02-backend/data-models.md) | TypeScript types, category rules, every locally stored key |
| [config.json](02-backend/config.json) · [config.md](02-backend/config.md) | every URL, app name and key the app needs |
| **03-design/** | *how it looks* |
| [design-system.md](03-design/design-system.md) | colours, type, spacing, artwork sizes, components, motion, brand use |
| [screens.md](03-design/screens.md) | the navigation map and a wireframe for every screen |
| **04-build/** | *how to build it* |
| [tech-stack.md](04-build/tech-stack.md) | the framework, libraries, tooling and Android configuration |
| [architecture.md](04-build/architecture.md) | the folder layout, layers, content-source interface, data flow, performance budgets |
| [roadmap.md](04-build/roadmap.md) | milestones M0–M8 with acceptance checks |
| [testing.md](04-build/testing.md) | fixtures, unit/component/E2E tests, the device checklist |
| [release.md](04-build/release.md) | versioning, builds, signing, the Play Store checklist |
| **05-reference/** | |
| [open-questions.md](05-reference/open-questions.md) | the decisions still open, each with a default to use until answered |
| [glossary.md](05-reference/glossary.md) | the terms used in this kit |
| [translations.md](05-reference/translations.md) + `locales/` | the TV app's 18 languages and how to use them |
| **assets/** | the logo, app icons, splash, store graphics and placeholders ([assets/README.md](assets/README.md)) |

## Status of the facts

- **The backend protocol and rules** are extracted from the TV app's code as of September 2026. The
  response examples use fake values, and their shapes are rebuilt from the fields the TV app
  reads (Q-response-shapes).
- **The design, stack, architecture and roadmap** are recommendations written for this project.
  Where a library version matters, the builder must check the current one.
- **Before going live, two backend questions must be answered**: which `app_type` an Android phone
  sends (Q-app-type), and the phone's device id format (Q-device-id). Development works fully
  against the fixtures without them.

## Security note

`02-backend/config.json` contains app-level keys and tokens (TMDB, image cache, …). They
are the same values the TV apps already ship to every TV. Treat the repository holding this kit
as private anyway. The kit contains no user credentials or playlist URLs.
