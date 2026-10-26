# Privacy

HDROLED 1.1 runs only on top-level `https://www.youtube.com/*` and `https://m.youtube.com/*` pages.

- Saves local picture/sound on/off preferences, separate picture/sound strengths, original/bypass and a derived enabled flag for compatibility with the 1.0 setting.
- Temporarily reads player/source dimensions, browser-reported screen dimensions and processing state for its popup.
- Processes supported audio locally using Web Audio. It does not request microphone access, record audio, capture the screen or upload media.
- Does not collect browsing history, account information, analytics or telemetry.
- Does not use accounts, backend services, cookies, external fonts or remote code.
- Does not change power plans, battery settings, system volume, drivers, monitor calibration, HDR mode or operating-system themes. All picture/audio treatment belongs to the currently accessible YouTube page.

YouTube and the browser still make their ordinary requests independently. Existing OS/GPU/monitor settings can influence appearance; HDROLED neither reads nor restores those settings.

The build/package scripts only read project files and write local ZIPs. No standalone PC display helper, calibration backup, driver installer or registry script is part of this repository or its extension packages.
