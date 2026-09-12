/**
 * ═══════════════════════════════════════════════════════════
 *  UI — Terminal User Interface Renderer (Day 2)
 * ═══════════════════════════════════════════════════════════
 *
 *  Handles all visual output — the track list, progress bar,
 *  now-playing display, and help text.
 *
 *  Features:
 *  - Full-screen terminal rendering with ANSI escape codes
 *  - Color theme using raw escape sequences (no dependencies)
 *  - Scrollable track list that follows the cursor
 *  - Progress bar with elapsed/total time
 *  - Status indicators for shuffle, repeat, volume
 *  - Terminal resize handling
 *
 *  Concepts demonstrated:
 *  - ANSI escape codes for colors and cursor control
 *  - Calculating visible "windows" for scrollable lists
 *  - String formatting and alignment
 */

/**
 * ANSI escape code helpers.
 * These produce colored/styled text without any dependencies.
 */
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground colors
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgCyan: '\x1b[46m',
  bgBlack: '\x1b[40m',

  // Cursor control
  clear: '\x1b[2J',       // Clear entire screen
  home: '\x1b[H',         // Move cursor to top-left
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

class UI {
  constructor() {
    /** @type {number} Current scroll offset for the track list */
    this.scrollOffset = 0;
  }

  /**
   * Get the current terminal dimensions.
   * @returns {{ rows: number, cols: number }}
   */
  getSize() {
    return {
      rows: process.stdout.rows || 24,
      cols: process.stdout.columns || 80,
    };
  }

  /**
   * Render the full screen.
   *
   * @param {object} state - Current application state
   * @param {Array}  state.tracks    - All tracks in the playlist
   * @param {number} state.cursor    - Cursor position in the track list
   * @param {number} state.playing   - Index of currently playing track (-1 if none)
   * @param {object} state.player    - Player instance (for elapsed, paused, volume)
   * @param {object} state.playlist  - Playlist instance (for shuffle, repeat)
   * @param {string} state.searchQuery - Active search query (empty string if none)
   * @param {number[]} state.searchResults - Indices matching the search
   */
  render(state) {
    const { rows, cols } = this.getSize();
    const lines = [];

    // ── Header ──────────────────────────────────────────
    lines.push('');
    lines.push(this._renderHeader(state, cols));
    lines.push(this._renderNowPlaying(state, cols));
    lines.push(c.cyan + '  ' + '─'.repeat(Math.min(cols - 4, 76)) + c.reset);

    // ── Progress Bar ────────────────────────────────────
    lines.push(this._renderProgressBar(state, cols));
    lines.push('');

    // ── Track List ──────────────────────────────────────
    // Calculate how many rows we have for the track list
    const headerLines = lines.length;
    const footerLines = 4; // status + controls + padding
    const trackAreaHeight = Math.max(3, rows - headerLines - footerLines);

    // Ensure cursor is visible in the scroll window
    this._adjustScroll(state.cursor, trackAreaHeight, state.tracks.length);

    // Column header
    lines.push(
      c.dim + '  '
      + '#'.padEnd(5)
      + 'Title'.padEnd(30)
      + 'Artist'.padEnd(22)
      + 'Duration'.padEnd(10)
      + 'Format'
      + c.reset
    );

    // Track rows
    const end = Math.min(this.scrollOffset + trackAreaHeight, state.tracks.length);
    for (let i = this.scrollOffset; i < end; i++) {
      lines.push(this._renderTrackRow(state, i, cols));
    }

    // Pad remaining space
    const renderedTracks = end - this.scrollOffset;
    for (let i = renderedTracks; i < trackAreaHeight; i++) {
      lines.push('');
    }

    // ── Status Line ─────────────────────────────────────
    lines.push(c.cyan + '  ' + '─'.repeat(Math.min(cols - 4, 76)) + c.reset);
    lines.push(this._renderStatusLine(state, cols));

    // ── Controls Help ───────────────────────────────────
    lines.push(this._renderControls(state));

    // ── Write to terminal ───────────────────────────────
    // Move cursor to home position and write all lines
    let output = c.home;
    for (let i = 0; i < rows; i++) {
      if (i < lines.length) {
        // Truncate line to terminal width and clear rest of line
        const line = this._truncate(lines[i], cols);
        output += line + '\x1b[K\n'; // \x1b[K clears to end of line
      } else {
        output += '\x1b[K\n';
      }
    }
    process.stdout.write(output);
  }

  /**
   * Render the header bar.
   */
  _renderHeader(state, cols) {
    const title = '  🎵  Terminal Music Player';
    const trackCount = `${state.tracks.length} track${state.tracks.length !== 1 ? 's' : ''}`;
    return c.bold + c.cyan + title + c.reset + c.dim + '  •  ' + trackCount + c.reset;
  }

  /**
   * Render the "Now Playing" line.
   */
  _renderNowPlaying(state, cols) {
    if (state.playing < 0 || !state.player.currentSong) {
      return c.dim + '  ♪  Nothing playing' + c.reset;
    }

    const song = state.player.currentSong;
    const statusIcon = state.player.paused ? '⏸ ' : '▶ ';
    const title = song.title.length > 35 ? song.title.slice(0, 32) + '...' : song.title;
    const artist = song.artist;

    return '  '
      + c.green + c.bold + statusIcon + title + c.reset
      + c.dim + '  —  ' + artist + c.reset;
  }

  /**
   * Render the progress bar.
   *
   * Looks like:  ━━━━━━━━━━━━━░░░░░░░░░░  02:31 / 04:15
   */
  _renderProgressBar(state, cols) {
    const barWidth = Math.min(cols - 24, 50);
    const elapsed = state.player.elapsed || 0;
    const duration = state.player.currentSong?.duration || 0;

    if (duration <= 0 || state.playing < 0) {
      // No track playing — empty bar
      const emptyBar = c.dim + '░'.repeat(barWidth) + c.reset;
      return '  ' + emptyBar + '  --:-- / --:--';
    }

    const progress = Math.min(elapsed / duration, 1);
    const filled = Math.round(progress * barWidth);
    const remaining = barWidth - filled;

    const bar =
      c.cyan + '━'.repeat(filled) +
      c.dim + '░'.repeat(remaining) + c.reset;

    const timeStr =
      c.white + this._formatTime(elapsed) +
      c.dim + ' / ' +
      c.white + this._formatTime(duration) + c.reset;

    return '  ' + bar + '  ' + timeStr;
  }

  /**
   * Render a single track row.
   */
  _renderTrackRow(state, index, cols) {
    const track = state.tracks[index];
    const isCursor = index === state.cursor;
    const isPlaying = index === state.playing;
    const isSearchMatch = state.searchResults && state.searchResults.includes(index);

    // Pointer indicator
    let pointer = '  ';
    if (isCursor && isPlaying) pointer = c.green + c.bold + '▶ ' + c.reset;
    else if (isCursor) pointer = c.cyan + '› ' + c.reset;
    else if (isPlaying) pointer = c.green + '♪ ' + c.reset;
    else pointer = '  ';

    // Truncate fields
    let title = track.title.length > 27 ? track.title.slice(0, 24) + '...' : track.title;
    let artist = track.artist.length > 19 ? track.artist.slice(0, 16) + '...' : track.artist;

    // Apply styling
    let style = '';
    let endStyle = c.reset;
    if (isPlaying) {
      style = c.green + c.bold;
    } else if (isCursor) {
      style = c.white + c.bold;
    } else if (isSearchMatch) {
      style = c.yellow;
    } else {
      style = c.dim;
    }

    const num = String(index + 1).padEnd(5);
    const dur = this._formatTime(track.duration).padEnd(10);
    const fmt = track.format;

    return pointer
      + style
      + num
      + title.padEnd(30)
      + artist.padEnd(22)
      + dur
      + fmt
      + endStyle;
  }

  /**
   * Render the status line (shuffle, repeat, volume).
   */
  _renderStatusLine(state, cols) {
    const parts = [];

    // Volume
    const volBars = Math.round(state.player.volume * 10);
    const volDisplay = '█'.repeat(volBars) + '░'.repeat(10 - volBars);
    parts.push(c.cyan + '  Vol ' + c.white + volDisplay + c.reset);

    // Shuffle
    if (state.playlist.shuffled) {
      parts.push(c.yellow + '🔀 Shuffle' + c.reset);
    }

    // Repeat
    if (state.playlist.repeatMode === 'one') {
      parts.push(c.magenta + '🔂 Repeat One' + c.reset);
    } else if (state.playlist.repeatMode === 'all') {
      parts.push(c.magenta + '🔁 Repeat All' + c.reset);
    }

    // Search
    if (state.searchQuery) {
      parts.push(c.yellow + '🔍 "' + state.searchQuery + '"' + c.reset);
    }

    return parts.join(c.dim + '  │  ' + c.reset);
  }

  /**
   * Render the controls help bar.
   */
  _renderControls(state) {
    if (state.searchMode) {
      return c.dim + '  Type to search  •  Enter: jump  •  Esc: cancel' + c.reset;
    }

    return c.dim
      + '  ↑↓: navigate  •  Enter: play  •  Space: pause  •  '
      + 'n/p: next/prev  •  +/-: vol  •  s: shuffle  •  r: repeat  •  /: search  •  q: quit'
      + c.reset;
  }

  /**
   * Adjust scroll offset to keep the cursor visible.
   */
  _adjustScroll(cursor, viewHeight, totalTracks) {
    if (cursor < this.scrollOffset) {
      this.scrollOffset = cursor;
    } else if (cursor >= this.scrollOffset + viewHeight) {
      this.scrollOffset = cursor - viewHeight + 1;
    }
    // Clamp
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, totalTracks - viewHeight));
    if (this.scrollOffset < 0) this.scrollOffset = 0;
  }

  /**
   * Format seconds as MM:SS.
   * @param {number} sec
   * @returns {string}
   */
  _formatTime(sec) {
    if (!sec || sec <= 0) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
  }

  /**
   * Truncate a string (strip ANSI codes for length measurement).
   * @param {string} str
   * @param {number} maxLen
   * @returns {string}
   */
  _truncate(str, maxLen) {
    // For now, we just return the string.
    // ANSI codes make precise truncation complex,
    // but our rows are designed to fit in ~80 cols.
    return str;
  }
}

module.exports = UI;
