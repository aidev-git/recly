# Recly

Screen recorder and video editor for creators, built with Electron, React, and TypeScript.

Recly records your screen (with an optional webcam overlay, backgrounds, and cursor effects), then hands the recording straight to a full timeline editor — zoom regions, annotations, auto-captions, multi-track audio — without ever leaving the app. No cloud upload, no subscription, no account required.

## Why

Most screen recorders stop at "record and save." Recly treats the recording as the first step of a pipeline that ends in a finished, edited clip: auto-detected zoom-ins based on where your cursor actually paused, local Whisper transcription for captions, and an export pass that can run on hardware-accelerated WebCodecs instead of a plain MediaRecorder dump.

## Features

**Recording**
- Screen capture via `desktopCapturer`, with an experimental native Windows path (DXGI Desktop Duplication + WASAPI loopback, muxed through Media Foundation) for lower overhead
- Webcam overlay with 9 position presets, custom sizing, mirroring, shadow, and a manual sync-offset slider for drift correction
- Cursor telemetry recorded independently of the video, used later to auto-suggest zoom regions
- Click effects (spotlight, ripple, echo), custom cursor skins, live background presets
- Always-on-top HUD window with pause/resume/stop, global keyboard shortcuts, system tray controls

**Editing**
- Multi-track timeline: clips, zoom regions, and up to 4 independent audio lanes with rendered waveforms
- Zoom regions with 6 depth levels, per-region easing curves, and connected-zoom bridging between nearby regions
- Annotations: arrows, rectangles, blur/redaction, highlights, text, directional callouts, custom images
- Adjustable frame padding, corner radius, and drop shadow, independent of the recording background
- `.reclyproj` project format with a project library and OS-level file associations
- Full undo/redo history, remappable shortcuts, 11-language UI

**Captions**
- Local Whisper transcription via `@huggingface/transformers` — no server calls, no API key
- Word-level timestamps, grouped into readable caption cues
- 5 animation styles including karaoke-style per-word highlighting
- `.srt` export with timing remapped to the final edited sequence, not the raw recording

**Export**
- Legacy path: MediaRecorder + bundled ffmpeg
- Modern path (opt-in): WebCodecs-based export on top of `mediabunny`, decoding via hardware acceleration
- MP4 (multiple quality tiers, 24/30/60fps) or GIF output

## Tech stack

Electron 33 · React 18 · TypeScript 5 · Vite 5 · Tailwind CSS

## Getting started

```bash
npm install
npm run dev       # Vite + Electron, runs from source
```

```bash
npm run build      # tsc && vite build && electron-builder
```

`npm run build` produces `dist/`, `dist-electron/`, and a packaged installer under `release/`.

No environment variables or accounts are needed to run locally. The only network calls Recly makes are optional: downloading a Whisper model on first use, fetching in-app announcements, and checking GitHub Releases for updates. All of them fail silently offline.

## Project structure

```
electron/          main process — window management, IPC, native capture, project files
  native/             C++ Windows capture helper
  capture/            desktopCapturer + native capture bridging
  captions/           Whisper transcription
  project/            .reclyproj format, project library

src/                renderer — React UI
  components/editor/  timeline, clips, zoom, captions, annotations, export
  lib/                 canvas compositor, export pipelines, i18n, settings
  hooks/               recorder, editor history, theme, announcements
```

## Known limitations

- The native Windows capture path skips live compositing and doesn't support pause/resume
- Modern export's per-clip speed changes shift pitch slightly (playback-rate based, not time-stretch)
- Webcam sync offset is a one-time start-delay correction, not continuous re-sync
- Subtitle export is `.srt` only
- The extensions panel is a placeholder — no extension runtime yet

## Platform support

Packaging targets Windows (NSIS installer + portable), macOS (DMG/ZIP, hardened runtime, camera/mic entitlements), and Linux (AppImage). The native capture path is Windows-only; other platforms use Electron's standard `desktopCapturer`.

## License

No license file is published yet.
