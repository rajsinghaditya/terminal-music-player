#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════
 *  Terminal Music Player — Entry Point (Day 1)
 * ═══════════════════════════════════════════════════════════
 *
 *  Usage:
 *    node src/index.js              → scans ./music
 *    node src/index.js ~/Music      → scans a custom directory
 *
 *  This version (Day 1) scans a directory for audio files
 *  and prints a formatted table of discovered tracks.
 *
 *  Concepts demonstrated:
 *  - CLI argument parsing (process.argv)
 *  - Async entry point with top-level error handling
 *  - Formatted console output (padEnd for alignment)
 */

const path = require('path');
const FileManager = require('./fileManager');

/**
 * Format seconds into MM:SS string.
 * @param {number} seconds
 * @returns {string} e.g. "03:45"
 */
function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
}

/**
 * Print a formatted table of songs to the console.
 * @param {Array} songs - Array of song metadata objects
 */
function printTrackTable(songs) {
  // Column headers
  const header = '  '
    + '#'.padEnd(5)
    + 'Title'.padEnd(30)
    + 'Artist'.padEnd(25)
    + 'Duration'.padEnd(10)
    + 'Format';

  const separator = '  ' + '─'.repeat(75);

  console.log(separator);
  console.log(header);
  console.log(separator);

  songs.forEach((song, index) => {
    // Truncate long strings to fit in columns
    const title = song.title.length > 27
      ? song.title.slice(0, 24) + '...'
      : song.title;

    const artist = song.artist.length > 22
      ? song.artist.slice(0, 19) + '...'
      : song.artist;

    const row = '  '
      + String(index + 1).padEnd(5)
      + title.padEnd(30)
      + artist.padEnd(25)
      + formatTime(song.duration).padEnd(10)
      + song.format;

    console.log(row);
  });

  console.log(separator);
}

/**
 * Main function — scans the music directory and displays results.
 */
async function main() {
  // Parse the music directory from CLI arguments
  // process.argv[0] = node, process.argv[1] = script path, [2] = user arg
  const musicDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(process.cwd(), 'music');

  console.log();
  console.log('  🎵 Terminal Music Player — Library Scanner');
  console.log('  Scanning: ' + musicDir);
  console.log();

  // Create a FileManager and scan for audio files
  const fileManager = new FileManager(musicDir);
  const songs = await fileManager.scan();

  if (songs.length === 0) {
    console.log('  ⚠️  No audio files found!');
    console.log();
    console.log('  To get started, add music files to:');
    console.log('  ' + musicDir);
    console.log();
    console.log('  Supported formats: MP3, WAV, FLAC, OGG, M4A, AAC, WMA');
    console.log();
    return;
  }

  // Display results
  console.log('  Found ' + songs.length + ' track(s):');
  console.log();
  printTrackTable(songs);

  // Show total duration
  const totalSeconds = songs.reduce((sum, s) => sum + (s.duration || 0), 0);
  console.log();
  console.log('  Total library duration: ' + formatTime(totalSeconds));
  console.log();
}

// Run the main function and handle any unhandled errors
main().catch((err) => {
  console.error('  ❌ Error:', err.message);
  process.exit(1);
});
