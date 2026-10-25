# Contributing

Keep the extension YouTube-only, preserve the two-button interface, and avoid system-setting access or remote dependencies.

1. Explain the playback scenario or UI issue in a focused issue.
2. Make a small change and add a meaningful behavior test.
3. Run `npm test` and `python scripts/package.py`.
4. Manually test YouTube playback, sound startup, Original A/B, navigation and fullscreen. State which browsers you actually tested.
5. If changing audio, document configured gain separately from measured loudness. Do not promise voice isolation or clipping-proof output.
6. For screenshots, use the same paused frame and identical source quality/window size. Remove personal information and retain media attribution.

Do not add PC helpers, personal backups, credentials, browser profiles or private account information to commits.
