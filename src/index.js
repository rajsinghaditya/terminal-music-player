#!/usr/bin/env node

const path = require('path');
const readline = require('readline');
const FileManager = require('./fileManager');
const Player = require('./player');
const Playlist = require('./playlist');
const UI = require('./ui');

const state = {
  tracks: [],
  cursor: 0,
  playing: -1,
  player: null,
  playlist: null,
  searchMode: false,
  searchQuery: '',
  searchResults: [],
};

const ui = new UI();
let refreshTimer = null;

function playCurrentTrack() {
  const track = state.playlist.currentTrack;
  if (!track) return;

  state.playing = state.playlist.currentIndex;
  state.cursor = state.playing;
  state.player.play(track);
}

function handleNext() {
  const next = state.playlist.next();
  if (next) {
    playCurrentTrack();
  } else {
    state.player.stop();
    state.playing = -1;
  }
}

function handlePrevious() {
  if (state.player.elapsed > 3) {
    state.player.elapsed = 0;
    playCurrentTrack();
    return;
  }

  state.playlist.previous();
  playCurrentTrack();
}

function handleKey(key) {
  const str = key.toString();

  if (state.searchMode) {
    if (str === '\x1b' || str === '\x1b[A' || str === '\x1b[B') {
      state.searchMode = false;
      state.searchQuery = '';
      state.searchResults = [];
    } else if (str === '\r' || str === '\n') {
      if (state.searchResults.length > 0) {
        state.cursor = state.searchResults[0];
      }
      state.searchMode = false;
    } else if (str === '\x7f' || str === '\b') {
      state.searchQuery = state.searchQuery.slice(0, -1);
      state.searchResults = state.searchQuery
        ? state.playlist.search(state.searchQuery)
        : [];
    } else if (str.length === 1 && str >= ' ') {
      state.searchQuery += str;
      state.searchResults = state.playlist.search(state.searchQuery);
      if (state.searchResults.length > 0) {
        state.cursor = state.searchResults[0];
      }
    }
    return;
  }

  switch (str) {
    case '\x1b[A':
      state.cursor = Math.max(0, state.cursor - 1);
      break;

    case '\x1b[B':
      state.cursor = Math.min(state.tracks.length - 1, state.cursor + 1);
      break;

    case '\x1b[5~':
      state.cursor = Math.max(0, state.cursor - 10);
      break;

    case '\x1b[6~':
      state.cursor = Math.min(state.tracks.length - 1, state.cursor + 10);
      break;

    case 'g':
      state.cursor = 0;
      break;

    case 'G':
      state.cursor = state.tracks.length - 1;
      break;

    case '\r':
    case '\n':
      state.playlist.select(state.cursor);
      playCurrentTrack();
      break;

    case ' ':
      state.player.togglePause();
      break;

    case 'n':
      handleNext();
      break;

    case 'p':
      handlePrevious();
      break;

    case '+':
    case '=':
      state.player.adjustVolume(0.1);
      break;

    case '-':
    case '_':
      state.player.adjustVolume(-0.1);
      break;

    case 's':
      state.playlist.toggleShuffle();
      state.tracks = state.playlist.tracks;
      if (state.player.currentSong) {
        state.playing = state.tracks.findIndex(
          t => t.path === state.player.currentSong.path
        );
      }
      break;

    case 'r':
      state.playlist.cycleRepeat();
      break;

    case '/':
      state.searchMode = true;
      state.searchQuery = '';
      state.searchResults = [];
      break;

    case 'q':
    case '\x03':
      shutdown();
      break;
  }
}

function shutdown() {
  if (state.player) {
    state.player.stop();
  }

  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  process.stdout.write('\x1b[?25h');
  process.stdout.write('\x1b[2J');
  process.stdout.write('\x1b[H');

  console.log();
  console.log('  👋 Thanks for using Terminal Music Player!');
  console.log();

  process.exit(0);
}

async function main() {
  const musicDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(process.cwd(), 'music');

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

  FileManager.sortBy(songs, 'title');

  state.tracks = songs;
  state.player = new Player();
  state.playlist = new Playlist(songs);

  state.player.on('trackEnd', () => {
    handleNext();
  });

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
  } else {
    console.error('  ❌ Terminal required. Cannot run in non-interactive mode.');
    process.exit(1);
  }

  process.stdout.write('\x1b[?25h');
  process.stdout.write('\x1b[?25l');
  process.stdout.write('\x1b[2J');

  process.stdin.on('data', handleKey);

  process.stdout.on('resize', () => {
    ui.render(state);
  });

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  ui.render(state);
  refreshTimer = setInterval(() => {
    ui.render(state);
  }, 500);
}

main().catch((err) => {
  process.stdout.write('\x1b[?25h');
  console.error('  ❌ Error:', err.message);
  process.exit(1);
});
