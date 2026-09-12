# 🎵 Terminal Music Player

A fully interactive terminal-based music player built with Node.js. In-class project.

## Features

- **Audio Playback** — Play, pause, stop with real-time progress tracking
- **Interactive TUI** — Full-screen terminal interface with ANSI colors
- **Keyboard Controls** — Single-keypress navigation and playback
- **Shuffle & Repeat** — Fisher-Yates shuffle, repeat one/all modes
- **Search** — Filter tracks by title or artist in real time
- **Metadata Display** — Reads title, artist, album, and duration from files
- **Zero Extra Dependencies** — Uses only `music-metadata` + Node.js built-ins

## Setup

```bash
npm install
```

## Usage

```bash
# Play from the default ./music folder
npm start

# Play from a custom folder
node src/index.js ~/Music

# Install globally (optional)
npm link
tmusic ~/Music
```

Drop your audio files (MP3, WAV, FLAC, OGG, M4A, AAC, WMA) into the `music/` folder and run the player.

## Keyboard Controls

| Key        | Action                     |
|------------|----------------------------|
| `↑` / `↓`  | Navigate track list        |
| `Enter`    | Play selected track        |
| `Space`    | Pause / Resume             |
| `n`        | Next track                 |
| `p`        | Previous track             |
| `+` / `-`  | Volume up / down           |
| `s`        | Toggle shuffle             |
| `r`        | Cycle repeat (off/all/one) |
| `/`        | Search tracks              |
| `g` / `G`  | Jump to top / bottom       |
| `PgUp/PgDn`| Scroll by 10 tracks        |
| `q`        | Quit                       |

## Project Structure

```
src/
  index.js        — Entry point, keyboard input, main loop
  fileManager.js  — File discovery and metadata extraction
  player.js       — Audio playback engine (afplay wrapper)
  playlist.js     — Queue management, shuffle, repeat
  ui.js           — Terminal UI renderer (ANSI colors)
music/            — Drop audio files here
```

## Architecture

```
┌─────────────────────────────────────────────┐
│                  index.js                   │
│         (input handling + main loop)        │
├──────────┬──────────┬──────────┬────────────┤
│  ui.js   │player.js │playlist.js│fileManager│
│ (render) │ (audio)  │ (queue)   │  (scan)   │
└──────────┴──────────┴──────────┴────────────┘
```

## Requirements

- **macOS** (uses `afplay` for audio playback)
- **Node.js** 18+

## Day 1 vs Day 2

| Day 1                         | Day 2                            |
|-------------------------------|----------------------------------|
| File scanning & metadata      | Audio playback via afplay        |
| Formatted table output        | Interactive full-screen TUI      |
| One-shot CLI tool             | Keyboard-driven navigation       |
|                               | Shuffle & repeat modes           |
|                               | Search & progress bar            |
|                               | Volume control                   |

## License

MIT
