#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════
 *  Terminal Music Player — Entry Point (Day 2)
 * ═══════════════════════════════════════════════════════════
 *
 *  Usage:
 *    node src/index.js              → scans ./music
 *    node src/index.js ~/Music      → scans a custom directory
 *
 *  This is the fully interactive version. It provides:
 *  - Full-screen TUI with keyboard controls
 *  - Audio playback via macOS afplay
 *  - Shuffle, repeat, search
 *
 *  Concepts demonstrated:
 *  - readline in raw mode for single-keypress input
 *  - setInterval for periodic UI refresh
 *  - Coordinating multiple modules (Player, Playlist, UI, FileManager)
 *  - Graceful shutdown with signal handling
 */

const path = require('path');
const readline = require('readline');
const FileManager = require('./fileManager');
const Player = require('./player');
const Playlist = require('./playlist');
const UI = require('./ui');

// ── Application State ──────────────────────────────────────
const state = {
  tracks: [],       // All loaded tracks
  cursor: 0,        // Cursor position in track list
  playing: -1,      // Index of currently playing track (-1 = none)
  player: null,     // Player instance
  playlist: null,   // Playlist instance
  searchMode: false, // Whether we're in search mode
  searchQuery: '',  // Current search text
  searchResults: [],// Matching track indices
};

// ── Instances ──────────────────────────────────────────────
const ui = new UI();
let refreshTimer = null;

/**
 * Play the track at the current playlist position.
 */
function playCurrentTrack() {
  const track = state.playlist.currentTrack;
  if (!track) return;

  state.playing = state.playlist.currentIndex;
  state.cursor = state.playing;
  state.player.play(track);
}

/**
 * Handle 'next track' action.
 * Called by user pressing 'n' or when a track ends naturally.
 */
function handleNext() {
  const next = state.playlist.next();
  if (next) {
    playCurrentTrack();
  } else {
    // No more tracks — stop
    state.player.stop();
    state.playing = -1;
  }
}

/**
 * Handle 'previous track' action.
 */
function handlePrevious() {
  // If we're more than 3 seconds in, restart the current track
  if (state.player.elapsed > 3) {
    state.player.elapsed = 0;
    playCurrentTrack();
    return;
  }

  state.playlist.previous();
  playCurrentTrack();
}

/**
 * Handle keyboard input.
 * In raw mode, we receive individual key buffers.
 *
 * @param {Buffer} key - Raw key buffer from stdin
 */
function handleKey(key) {
  const str = key.toString();

  // ── Search Mode Input ──────────────────────────────
  if (state.searchMode) {
    if (str === '\x1b' || str === '\x1b[A' || str === '\x1b[B') {
      // Escape or arrow keys — exit search
      state.searchMode = false;
      state.searchQuery = '';
      state.searchResults = [];
    } else if (str === '\r' || str === '\n') {
      // Enter — jump to first result and exit search
      if (state.searchResults.length > 0) {
        state.cursor = state.searchResults[0];
      }
      state.searchMode = false;
    } else if (str === '\x7f' || str === '\b') {
      // Backspace
      state.searchQuery = state.searchQuery.slice(0, -1);
      state.searchResults = state.searchQuery
        ? state.playlist.search(state.searchQuery)
        : [];
    } else if (str.length === 1 && str >= ' ') {
      // Printable character
      state.searchQuery += str;
      state.searchResults = state.playlist.search(state.searchQuery);
      // Auto-scroll to first match
      if (state.searchResults.length > 0) {
        state.cursor = state.searchResults[0];
      }
    }
    return;
  }

  // ── Normal Mode Input ─────────────────────────────

  switch (str) {
    // ── Navigation ──
    case '\x1b[A': // Up arrow
      state.cursor = Math.max(0, state.cursor - 1);
      break;

    case '\x1b[B': // Down arrow
      state.cursor = Math.min(state.tracks.length - 1, state.cursor + 1);
      break;

    case '\x1b[5~': // Page Up
      state.cursor = Math.max(0, state.cursor - 10);
      break;

    case '\x1b[6~': // Page Down
      state.cursor = Math.min(state.tracks.length - 1, state.cursor + 10);
      break;

    case 'g': // Go to top
      state.cursor = 0;
      break;

    case 'G': // Go to bottom
      state.cursor = state.tracks.length - 1;
      break;

    // ── Playback ──
    case '\r': // Enter — play selected track
    case '\n':
      state.playlist.select(state.cursor);
      playCurrentTrack();
      break;

    case ' ': // Space — toggle pause
      state.player.togglePause();
      break;

    case 'n': // Next track
      handleNext();
      break;

    case 'p': // Previous track
      handlePrevious();
      break;

    // ── Volume ──
    case '+':
    case '=':
      state.player.adjustVolume(0.1);
      break;

    case '-':
    case '_':
      state.player.adjustVolume(-0.1);
      break;

    // ── Modes ──
    case 's': // Toggle shuffle
      state.playlist.toggleShuffle();
      state.tracks = state.playlist.tracks;
      // Update playing index to reflect new order
      if (state.player.currentSong) {
        state.playing = state.tracks.findIndex(
          t => t.path === state.player.currentSong.path
        );
      }
      break;

    case 'r': // Cycle repeat mode
      state.playlist.cycleRepeat();
      break;

    // ── Search ──
    case '/':
      state.searchMode = true;
      state.searchQuery = '';
      state.searchResults = [];
      break;

    // ── Quit ──
    case 'q':
    case '\x03': // Ctrl+C
      shutdown();
      break;
  }
}

/**
 * Clean up and exit gracefully.
 */
function shutdown() {
  // Stop playback
  if (state.player) {
    state.player.stop();
  }

  // Stop the refresh timer
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  // Restore terminal state
  process.stdout.write('\x1b[?25h'); // Show cursor
  process.stdout.write('\x1b[2J');   // Clear screen
  process.stdout.write('\x1b[H');    // Move to home

  console.log();
  console.log('  👋 Thanks for using Terminal Music Player!');
  console.log();

  process.exit(0);
}

/**
 * Main entry point.
 */
async function main() {
  // Parse CLI arguments
  const musicDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(process.cwd(), 'music');

  // Scan for audio files
  const fileManager = new FileManager(musicDir);
  const songs = await fileManager.scan();

  if (songs.length === 0) {
    console.log();
    console.log('  🎵 Terminal Music Player');
    console.log();
    console.log('  ⚠️  No audio files found!');
    console.log();
    console.log('  To get started, add music files to:');
    console.log('  ' + musicDir);
    console.log();
    console.log('  Supported formats: ' + FileManager.getSupportedFormats().join(', '));
    console.log();
    return;
  }

  // Sort by title by default
  FileManager.sortBy(songs, 'title');

  // Initialize modules
  state.tracks = songs;
  state.player = new Player();
  state.playlist = new Playlist(songs);

  // When a track ends naturally, auto-play next
  state.player.on('trackEnd', () => {
    handleNext();
  });

  // ── Set up terminal ──────────────────────────────────
  // Enable raw mode so we get individual keypresses
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
  } else {
    console.error('  ❌ Terminal required. Cannot run in non-interactive mode.');
    process.exit(1);
  }

  // Hide cursor for a cleaner UI
  process.stdout.write('\x1b[?25h'); // Ensure cursor is shown first
  process.stdout.write('\x1b[?25l'); // Then hide it
  process.stdout.write('\x1b[2J');   // Clear screen

  // Listen for keypresses
  process.stdin.on('data', handleKey);

  // Handle terminal resize
  process.stdout.on('resize', () => {
    ui.render(state);
  });

  // Handle signals for graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // ── Start the UI refresh loop ─────────────────────────
  // Re-render every 500ms to update the progress bar
  ui.render(state);
  refreshTimer = setInterval(() => {
    ui.render(state);
  }, 500);
}

// Run
main().catch((err) => {
  // Restore cursor on error
  process.stdout.write('\x1b[?25h');
  console.error('  ❌ Error:', err.message);
  process.exit(1);
});
