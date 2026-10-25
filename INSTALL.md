# Install HDROLED 1.0

## Chrome, Edge, Brave, Opera and Vivaldi

1. Download the repository ZIP or a packaged Chromium ZIP and extract it to a folder you will keep.
2. Disable/remove earlier HDROLED and Luma builds. Refresh open YouTube tabs to remove old injected styles and audio routing.
3. Open the appropriate page:

| Browser | Extensions page |
| --- | --- |
| Chrome | `chrome://extensions` |
| Edge | `edge://extensions` |
| Brave | `brave://extensions` |
| Opera | `opera://extensions` |
| Vivaldi | `vivaldi://extensions` |

4. Turn on **Developer mode**. Choose **Load unpacked**.
5. If using the repository download, select **`extension/`**. If using the packaged Chromium ZIP, select the extracted folder containing **`manifest.json`**.
6. Review the YouTube-only site-access permission, then pin HDROLED from the browser's Extensions menu.
7. Refresh YouTube, start a video and click **Enable HDROLED**. If requested, click the video once so the browser permits audio processing.
8. Click **Show original** for an A/B comparison of both picture and sound. Click **Back to HDROLED** to restore processing.

Keep the unpacked folder in place. Moving or deleting it can break the installation.

## Firefox 140+

1. Generate the Firefox package using `python scripts/package.py`, or use a provided Firefox ZIP.
2. For temporary local testing, open **`about:debugging#/runtime/this-firefox`**.
3. Choose **Load Temporary Add-on** and select the Firefox ZIP or its extracted `manifest.json`.
4. Grant YouTube site access if requested, refresh YouTube and test the two controls.
5. Temporary installations disappear when Firefox restarts. Permanent installation in normal Firefox requires a Mozilla-signed build; this review candidate is not signed.

## Updating and removal

- To update, replace the existing unpacked files, click the browser's extension Reload button, and refresh YouTube tabs. A fresh source path may create a separate extension ID; disable the old copy.
- To remove, choose Remove on the extension-management page and refresh YouTube. This removes its saved preferences and injected processing after reload.
- No PC restore procedure is required for this extension: it never writes system display/audio/power settings. Unrelated settings changed by other programs are not controlled by Show original.

## Common fixes

### Clicking the extension does not open it

1. Pause the YouTube video, then click the HDROLED icon again.
2. If the icon is hidden, open the browser's Extensions menu and choose or pin HDROLED.
3. Refresh the YouTube page and retry. Check that HDROLED is enabled on the browser's extensions page and that older copies are disabled.
4. If it still will not open, close and reopen that YouTube tab or restart the browser. Pausing is a troubleshooting step, not a guaranteed fix for a browser popup problem.

### A new YouTube page does not connect

After opening a new YouTube video/page, refresh it once if the extension does not reconnect, then play the video and open HDROLED again. Repeat this on each new page where the problem occurs. YouTube can change pages without a full reload, so refreshing can clear an older page/audio context. The extension does not force automatic reloads or interrupt playback.

### Picture or sound is unchanged

- Confirm the main switch is ON and Show original is not selected.
- Click the playing video once if sound status requests audio activation.
- Test a normal YouTube video; DRM, native Picture-in-Picture and incompatible sources can behave differently.
- Disable other picture/audio enhancer extensions while testing, then refresh the page.

## What to check before sharing

Confirm that Enable works, Show original changes picture **and** sound, the source resolution is correct, sound status reflects actual processing, and reduced-motion mode disables decorative animation. Test a quiet dialogue scene and a loud action scene at a comfortable player volume. Do not publish screenshots containing your account name, avatar, notifications or private recommendations.
