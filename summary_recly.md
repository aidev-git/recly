# Recly — Build Summary

**What this is:** Recly is a from-scratch, clean-room screen recorder + editor for creators, built as an original Electron/React/TypeScript application. It was written independently against public API documentation (Electron, Web APIs, Windows SDK, WebCodecs, Whisper/transformers.js) — no proprietary source code or compiled binaries from any other product were copied, referenced, or decompiled at any point. Every file listed below is original code, wired to genuine open-source libraries.

You own 100% of this codebase. The only two things to be aware of if you ever redistribute it: it bundles GPL/LGPL-family libraries (ffmpeg-static, and optionally Whisper model weights) as separate linked processes/data — normal, standard practice — and there's no `LICENSE` file yet (deliberately deferred, not forgotten).

- **Stack:** Electron 33, React 18, TypeScript 5, Vite 5, Tailwind CSS
- **Version:** 0.1.0
- **Platform today:** Windows (native capture path); macOS/Linux supported via the standard Electron `desktopCapturer` path
- **Commits:** 32, from initial MVP to current state (`git log --oneline` in this repo has the full trail)

---

## 1. How the app is put together

```
electron/          — main process (Node/Electron side)
  main.ts             — app lifecycle, window orchestration, ~70 IPC handlers
  menu.ts             — native OS application menu
  preload.ts          — contextBridge API surface exposed to the renderer as `window.recly`
  windows/            — BrowserWindow factories (recorder, editor, HUD, settings, countdown)
  capture/            — desktopCapturer source listing + native-capture bridging
  native/             — C++ Windows capture helper (source + compiled binary)
  cursor/             — global cursor/click telemetry recording (uiohook-napi)
  captions/           — Whisper transcription (transformers.js)
  export/             — legacy MediaRecorder+ffmpeg export pipeline
  project/            — .reclyproj file format, project library, sidecar files
  announcements.ts    — in-app announcement fetching/caching
  updater.ts          — electron-updater wrapper (GitHub Releases)
  permissions.ts       — macOS screen-recording/accessibility permission helpers
  shortcuts.ts        — global keyboard shortcuts (start/stop/pause via OS-level hook)
  tray.ts             — system tray icon/menu
  screenInfo.ts       — display/DPI enumeration

src/                — renderer process (React UI)
  components/         — recorder UI, HUD, settings window, source picker
  components/editor/  — the full video editor (timeline, clips, zoom, captions, annotations, export)
  components/announcements/ — announcement dialog + in-editor banner
  hooks/               — useRecorder, useEditorHistory, useI18n, useTheme, useAnnouncements, useUpdateToast, useCursorTelemetry
  lib/                 — compositor (canvas rendering engine), fastExport, modernExport, subtitle export, i18n, settings, waveform, cursor motion presets
  lib/i18n/locales/    — 11 fully translated language files
  content/announcements.ts — bundled (offline-available) announcements
```

---

## 2. Recording

- **Screen capture, two paths:**
  - **Standard path** (all platforms) — Electron's `desktopCapturer` + `getUserMedia`, composited live via Canvas.
  - **Native path** (Windows, experimental toggle) — a hand-written C++ helper (`electron/native/capture-record/main.cpp`) using **DXGI Desktop Duplication** for the screen and **WASAPI loopback** for system audio, muxed together through **Media Foundation's Sink Writer** into one MP4 (H.264 video + AAC audio streams). This path has lower overhead but doesn't composite webcam/backgrounds/click-effects in real time — those get applied afterward in the editor instead. Pause/resume isn't supported in this mode (disclosed in the UI).
- **Webcam overlay** — independent device picker, position presets (9 positions including custom), adjustable size/roundness/margin, mirroring, drop shadow with adjustable opacity, "react to zoom" scaling, and a manual **sync-offset** slider to correct for capture start-time drift between screen and webcam streams.
- **Cursor telemetry** — every mouse move/down/up is recorded (position + timestamp) via a global input hook (`uiohook-napi`), independent of the video itself, later used to auto-suggest zoom regions.
- **Click effects** — spotlight / ripple / echo / none, each with its own color, scale, opacity, and duration settings, plus a "click bounce" cursor-scale animation.
- **Cursor skins** — dot, macOS, Windows 11, Tahoe, Tahoe (inverted), Figma, or a **custom uploaded image**, with adjustable size, smoothing, sway, and motion blur, and selectable motion presets (focused vs. smooth).
- **Background (live, while recording)** — 30 curated gradient presets, or a solid color, or a video file, with adjustable blur.
- **Crop** — full frame, fixed aspect ratios (16:9, 1:1), or a free-form 4-handle drag crop.
- **HUD overlay** — a separate always-on-top, click-through window (draggable, with real hit-testable controls) showing recording/paused state with pause/resume/stop controls, using `setIgnoreMouseEvents` passthrough so it never blocks the app underneath.
- **Global shortcuts** — remappable, OS-level (work even when Recly isn't focused): start/stop and pause/resume.
- **Countdown overlay** before recording starts.
- **System tray** icon with quick controls.

---

## 3. Editing

- **Multi-track timeline** (`MultiTrackTimeline.tsx`) — unified drag-and-drop engine covering clips, zoom regions, and up to **4 independent audio lanes**, with a rendered waveform of the actual recorded audio.
- **Clips** — split at playhead, reorder, delete, trim in/out, per-clip **speed** (with quick presets: 0.25x–2x), and per-clip **mute** (excludes just that clip's own audio from the export mix without deleting the segment).
- **Zoom regions** — auto-detected from cursor telemetry (idle-cluster heuristic: sustained low cursor movement becomes a zoom-in) or added manually at the playhead. Each region has an independent focus point, **6 depth levels** (1.25x–5.0x), separate in/out easing curves (linear/glide/smooth/snappy/signature) and durations, plus **connected-zoom bridging** so two nearby regions blend into each other instead of resetting to 1x in between.
- **Crop** — full-frame, fixed aspect, or free-form with 4 independent drag handles, editable directly on the canvas.
- **Annotations** — arrow, rectangle, blur (privacy redaction), highlight, text, directional "figure" callouts (8 directions), and inserted images. Text supports bold/italic/underline, alignment, custom background color, and border radius. Layering (bring-to-front/send-to-back) and a custom font upload are supported.
- **Frame styling** — drop shadow, corner radius, and independently adjustable **padding on all 4 sides** (linked or unlinked) so the recording frame can float inset from the canvas edge when a background is visible.
- **Backgrounds (editor-time)** — same 30-preset gradient library, or solid color, or a full background **video** loop, with blur — independently settable from what was used live during recording.
- **Standalone audio regions** — import background music/SFX as separate audio tracks, with volume, loudness normalization, and multi-lane placement, mixed into the export independently of the screen recording's own audio.
- **Undo/redo** history stack across all editor actions.
- **Project save/load** — `.reclyproj` file format (JSON, versioned) plus a **project library/browser dialog**; projects are double-clickable file associations on Windows (single-instance-lock routing) and macOS (`open-file` event).
- **Remappable editor shortcuts** with live conflict detection against existing bindings.
- **Theme** — light/dark/system, plus full **11-language i18n** (English, Spanish, French, German, Italian, Dutch, Portuguese-BR, Russian, Korean, Chinese Simplified, Chinese Traditional) — verified key-parity across all locale files.

---

## 4. Auto-captions (local Whisper, no cloud, no native compiler)

- Runs entirely on-device via `@huggingface/transformers` (ONNX runtime), no server calls, no API keys.
- **3 model sizes** (tiny/base/small) — user picks the accuracy/speed/download-size trade-off, each cached independently.
- **Word-level timestamps** (`return_timestamps: "word"`) — verified empirically against real speech audio, not assumed from docs — then reassembled into readable caption cues via a custom grouping algorithm (new cue on a >700ms pause, ≥14 words, or >6s duration).
- **Language selection** — full language list or auto-detect.
- **Styling** — position (top/center/bottom) with offset, max width, max rows, font size (auto or fixed), text/background color and opacity, box corner radius.
- **5 animation styles** — fade, pop, slide-up, typewriter, and **karaoke** (per-word highlight driven by the real word-level timing).
- **Subtitle export** — `.srt` sidecar file alongside the exported video, with cue timing correctly remapped from raw source time to the final edited/trimmed sequence time (so cues line up even after cutting/reordering/speed-changing clips).

---

## 5. Export

Two selectable encoder backends:

- **Legacy** — MediaRecorder + bundled `ffmpeg-static`, maximum compatibility.
- **Modern** (default-off, opt-in) — a **WebCodecs-based, decode-driven fast export pipeline** (`fastExport.ts`, built on `mediabunny`) that decodes source video via hardware acceleration and re-encodes only what's needed, running meaningfully faster than realtime. Known, disclosed trade-off: per-clip speed changes use `OfflineAudioContext` playback-rate adjustment, which shifts pitch slightly (unlike a proper time-stretch) — called out directly in the UI hint text.
  - This path required discovering and fixing a real Electron platform limitation: `file://` URLs don't answer HTTP range requests, which silently broke backward-seeking (reordered clips) under mediabunny's default streaming source — fixed by switching to a `BlobSource` (fetch-once, shared random-access buffer).
- **Formats:** MP4 (quality tiers: medium/good/high/source; frame rate: 24/30/60) or GIF (frame rate 15–30; size presets medium/large/original; loop toggle).
- **Metrics** shown after export: duration taken and output file size.
- **Optional caption sidecar** (`.srt`) written alongside the video on request.

---

## 6. Platform / packaging

- **electron-builder** config covers Windows (NSIS installer + portable, explicit `artifactName`), macOS (DMG + ZIP, multi-arch, hardened runtime, entitlements, camera/mic usage descriptions), and Linux (AppImage, correct icon, `AudioVideo` category).
- **File associations** — `.reclyproj` opens directly into the editor on double-click, on both Windows and macOS.
- **Auto-updater** — full `electron-updater` wrapper against GitHub Releases: check/download/install-and-restart flow with an in-app toast UI, tested end-to-end against a real packaged build via a Chrome DevTools Protocol harness (since no public release existed yet to test against organically).
- **In-app announcements** — remote (HTTPS, capped/cached) + bundled fallback, with per-announcement dismissal, impression tracking, audience targeting, and date/version gating.
- **macOS permissions helpers** — screen-recording and accessibility permission status checks + direct links into System Settings.
- **Extensions panel** — present as a placeholder tab in the editor, intentionally disabled (no extension runtime built yet).

---

## 7. Architecture notes worth knowing

- **Source-time vs. sequence-time duality** (`sequenceTime.ts`) — every timed thing (zoom regions, captions, audio regions) is stored against the *raw recording's* timeline, then mapped through the current clip list to *edited output* time on demand. This means trimming, reordering, or speed-changing clips doesn't require rewriting every other timed element — it just changes how they're re-projected.
- **~70 IPC channels** across `main.ts`/`preload.ts`, all namespaced `recly:*`.
- **Verification discipline used throughout the build:** locale key-parity checks, IPC channel-name diffing, `tsc --noEmit`, `vite build`, launch smoke tests, and periodic full `electron-builder` packages — plus, where relevant, actual runtime testing (real TTS-generated speech for Whisper timing, real WASAPI capture with real system audio, CDP-driven black-box testing of the packaged app).
- **Known, disclosed scope limits** (not bugs — deliberate, documented trade-offs): native-capture mode skips live compositing and pause/resume; modern export's speed-change audio isn't pitch-preserving; webcam sync-offset is a one-time start delay, not a rolling re-sync buffer; subtitle export is `.srt` only (no `.vtt`); extensions are a placeholder only.

---

## 8. Running it

```bash
npm install       # pulls all deps; the one native binary (Windows capture helper) is already committed
npm run dev       # Vite + Electron, runs straight from source — day-to-day development
npm run build     # tsc && vite build && electron-builder — produces dist/, dist-electron/, release/ (installer)
```

No `.env`, no secrets, no accounts required to run locally. Whisper models download from Hugging Face on first caption generation and are cached locally after that. The only outbound network calls at runtime are: (optional) Whisper model download, (optional) remote announcements fetch, and (optional) GitHub Releases update check — all silently harmless if offline.
