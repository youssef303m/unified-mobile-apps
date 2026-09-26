# Instructions for the AI agent building this app

You are building **IBO Player for Android**, a React Native (Expo) app, from this kit. The kit is
the only source of truth: you do not have the TV app's code, and you will not get it. Everything you
need is in these files. Where a detail is missing or contradictory, check
05-reference/open-questions.md. If the question is not there, add it, pick the safest option,
record the choice in `docs/decisions.md`, and carry on.

## Read first, in this order

1. `README.md`: what is where.
2. `01-product/vision.md`, then `new-features.md`.
3. `04-build/tech-stack.md`, `architecture.md` and `roadmap.md`.
4. For the milestone you are on, read the files the roadmap names **fully** before coding.

## Working rules

1. **Follow the roadmap order** (04-build/roadmap.md). Do not start a milestone before the previous
   one's acceptance checks pass. Keep `docs/progress.md` up to date after every task.
2. **The backend protocol is exact.** Implement URLs, parameters, headers, encryption and response
   parsing precisely as written in 02-backend/. Do not "improve" parameter names, encodings or
   request order. The servers are live, shared with the TV apps, and cannot change for you.
3. **Business rules are requirements.** Every rule in 01-product/business-rules.md (R-xxx) is
   implemented in the service layer, never in a screen, with a test named after the rule id.
4. **Parity first, then new features.** The phone app does everything the TV app does (with touch
   equivalents), then adds the phone features in new-features.md. Anything else is out of scope
   unless the owner asks.
5. **Design tokens only.** No hard-coded colours, sizes or font names in components
   (03-design/design-system.md). No Netflix branding.
6. **Strings come from the locale files.** Reuse TV keys, and add new ones as `mobile_*` in
   `en.json` only (05-reference/translations.md). No user-visible string literals in components.
7. **Never call real IBO or IPTV servers from tests.** Use the fixtures (04-build/testing.md). Do not
   hard-code or commit real playlist credentials. The keys in 02-backend/config.json are app-level
   keys the TV apps already ship. Keep them in `src/config.ts`, generated from that file, not
   scattered through the code.
8. **Verify library APIs** against the installed version before using them.
9. **Small, typed, tested.** TypeScript strict, no `any`. Functions short and single-purpose; a
   test with every service change.
10. **Do not swallow errors.** Map them to the typed errors (04-build/architecture.md) and show the
    matching localized message.
11. **Security:**
    - Treat stream URLs (Xtream URLs contain the username and password) and portal MACs as secrets.
      Never log them in release builds, never send them to analytics or crash reports, never share
      them.
    - Keep MMKV encrypted.

## Definition of done (every task)

- Type check, lint and tests pass. The new behaviour has tests (the rule ids where they apply).
- The screen works in English and Arabic (RTL), at a font scale of 1.3, and on a 360dp-wide phone.
- The loading, empty and error states exist.
- `docs/progress.md` is updated.
