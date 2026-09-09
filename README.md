# Terminal Music Player

A simple terminal-based music player built with Node.js. In-class project.

## What it does

- Scans a folder for audio files (MP3, WAV, FLAC, OGG, M4A, AAC, WMA)
- Reads metadata like title, artist, album, and duration
- Displays a formatted track list in the terminal

## Setup

```bash
npm install
```

## Usage

```bash
# Scan the default ./music folder
npm start

# Scan a custom folder
node src/index.js ~/Music
```

Drop your audio files into the `music/` folder and run the player.

## Project Structure

```
src/
  index.js        — Entry point, CLI parsing, table display
  fileManager.js  — File discovery and metadata extraction
music/            — Drop audio files here
```

## License

MIT
