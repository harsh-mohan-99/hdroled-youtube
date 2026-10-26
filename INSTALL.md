# Install HDROLED — Lighter or Featured

Choose **v1.2 Lighter** for compact manual picture/sound controls, or **v2.0 Featured** for movable page controls, fractional levels, independent video settings and automatic quality handling. [Download either edition](https://github.com/harsh-mohan-99/hdroled-youtube/releases). Install one edition at a time.

## Chrome, Edge, Brave, Opera and Vivaldi

1. Download your edition's **Chromium ZIP** and extract it to a folder you will keep.
2. Disable any older HDROLED/Luma copies.
3. Open the browser's extensions page: `chrome://extensions`, `edge://extensions`, `brave://extensions`, `opera://extensions` or `vivaldi://extensions`.
4. Enable **Developer mode** → **Load unpacked** → select the extracted folder containing `manifest.json`.
5. Refresh existing YouTube tabs. Pin HDROLED through the Extensions menu if desired.
6. Start playback and open the browser-toolbar extension icon. Lighter uses its compact popup. In Featured, click the **HDROLED logo** to open movable controls over YouTube; drag the handle to move them and close with × or Escape.

## Firefox 140+

1. Download the separate **Firefox ZIP**, not the Chromium package.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
3. Select the Firefox ZIP, or extract it and select its `manifest.json`.
4. Refresh YouTube and open HDROLED. Grant YouTube site access if requested.

Temporary installation disappears when Firefox restarts. These packages are unsigned; permanent installation requires Mozilla signing. No browser-store listing is implied.

## Installing from source

- Default `main` or tag `v2.0.0`: Featured source is in `extension/`.
- Branch `release/lighter-v1.2` or tag `v1.2.0`: Lighter source is in `extension/`.
- In Chromium, select that `extension/` folder when choosing Load unpacked.
- Firefox source users should run `python scripts/package.py` and load the generated Firefox ZIP from `dist/`, because it has the Firefox background manifest.
- GitHub's automatically generated **Source code ZIP** contains a repository folder; it is not a store-ready runtime ZIP.

## Updating or switching editions

1. Keep your previous folder/ZIP if you want to return to it.
2. Disable/remove the old extension copy before enabling the new edition.
3. Extract the new package and load its manifest folder. If updating the same unpacked folder, click **Reload** on the extensions page.
4. **Refresh every already-open YouTube tab** to remove old injected styles/audio graphs and load the new handler.
5. Reopen controls and check picture/sound status. Preferences can differ between editions; Featured keeps video choices for the browser session.

## Controls and troubleshooting

- Picture and sound have separate switches and strength sliders. Show original temporarily bypasses both without erasing levels.
- Featured's video slider stays visible while the rest fades during adjustment. Its Auto optimization button controls small automatic adjustments and quality recovery; manual choices take priority.
- If a popup will not open, pause playback and retry; verify enabled/pinned status and refresh YouTube. Featured's opening path does not wait for setting saves or disable the toolbar during reconnection.
- If sound requests activation, click the playing video once. DRM, CORS, autoplay or competing audio extensions can prevent processing; read the status.
- Native Picture-in-Picture or native video fullscreen can hide page overlays. Exit that mode and reopen controls.
- Removal: uninstall in the browser's extension manager and refresh affected YouTube tabs. There are no system settings or drivers to revert.

Safari/Apple and mobile browsers are excluded. See [README](README.md), [Privacy](PRIVACY.md) and [Security](SECURITY.md).
