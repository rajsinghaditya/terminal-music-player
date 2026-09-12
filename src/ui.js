const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgCyan: '\x1b[46m',
  bgBlack: '\x1b[40m',
  clear: '\x1b[2J',
  home: '\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

class UI {
  constructor() {
    this.scrollOffset = 0;
  }

  getSize() {
    return {
      rows: process.stdout.rows || 24,
      cols: process.stdout.columns || 80,
    };
  }

  render(state) {
    const { rows, cols } = this.getSize();
    const lines = [];

    lines.push('');
    lines.push(this._renderHeader(state, cols));
    lines.push(this._renderNowPlaying(state, cols));
    lines.push(c.cyan + '  ' + '─'.repeat(Math.min(cols - 4, 76)) + c.reset);
    lines.push(this._renderProgressBar(state, cols));
    lines.push('');

    const headerLines = lines.length;
    const footerLines = 4;
    const trackAreaHeight = Math.max(3, rows - headerLines - footerLines);

    this._adjustScroll(state.cursor, trackAreaHeight, state.tracks.length);

    lines.push(
      c.dim + '  '
      + '#'.padEnd(5)
      + 'Title'.padEnd(30)
      + 'Artist'.padEnd(22)
      + 'Duration'.padEnd(10)
      + 'Format'
      + c.reset
    );

    const end = Math.min(this.scrollOffset + trackAreaHeight, state.tracks.length);
    for (let i = this.scrollOffset; i < end; i++) {
      lines.push(this._renderTrackRow(state, i, cols));
    }

    const renderedTracks = end - this.scrollOffset;
    for (let i = renderedTracks; i < trackAreaHeight; i++) {
      lines.push('');
    }

    lines.push(c.cyan + '  ' + '─'.repeat(Math.min(cols - 4, 76)) + c.reset);
    lines.push(this._renderStatusLine(state, cols));
    lines.push(this._renderControls(state));

    let output = c.home;
    for (let i = 0; i < rows; i++) {
      if (i < lines.length) {
        const line = this._truncate(lines[i], cols);
        output += line + '\x1b[K\n';
      } else {
        output += '\x1b[K\n';
      }
    }
    process.stdout.write(output);
  }

  _renderHeader(state, cols) {
    const title = '  🎵  Terminal Music Player';
    const trackCount = `${state.tracks.length} track${state.tracks.length !== 1 ? 's' : ''}`;
    return c.bold + c.cyan + title + c.reset + c.dim + '  •  ' + trackCount + c.reset;
  }

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

  _renderProgressBar(state, cols) {
    const barWidth = Math.min(cols - 24, 50);
    const elapsed = state.player.elapsed || 0;
    const duration = state.player.currentSong?.duration || 0;

    if (duration <= 0 || state.playing < 0) {
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

  _renderTrackRow(state, index, cols) {
    const track = state.tracks[index];
    const isCursor = index === state.cursor;
    const isPlaying = index === state.playing;
    const isSearchMatch = state.searchResults && state.searchResults.includes(index);

    let pointer = '  ';
    if (isCursor && isPlaying) pointer = c.green + c.bold + '▶ ' + c.reset;
    else if (isCursor) pointer = c.cyan + '› ' + c.reset;
    else if (isPlaying) pointer = c.green + '♪ ' + c.reset;

    let title = track.title.length > 27 ? track.title.slice(0, 24) + '...' : track.title;
    let artist = track.artist.length > 19 ? track.artist.slice(0, 16) + '...' : track.artist;

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

    return pointer + style + num + title.padEnd(30) + artist.padEnd(22) + dur + fmt + endStyle;
  }

  _renderStatusLine(state, cols) {
    const parts = [];

    const volBars = Math.round(state.player.volume * 10);
    const volDisplay = '█'.repeat(volBars) + '░'.repeat(10 - volBars);
    parts.push(c.cyan + '  Vol ' + c.white + volDisplay + c.reset);

    if (state.playlist.shuffled) {
      parts.push(c.yellow + '🔀 Shuffle' + c.reset);
    }

    if (state.playlist.repeatMode === 'one') {
      parts.push(c.magenta + '🔂 Repeat One' + c.reset);
    } else if (state.playlist.repeatMode === 'all') {
      parts.push(c.magenta + '🔁 Repeat All' + c.reset);
    }

    if (state.searchQuery) {
      parts.push(c.yellow + '🔍 "' + state.searchQuery + '"' + c.reset);
    }

    return parts.join(c.dim + '  │  ' + c.reset);
  }

  _renderControls(state) {
    if (state.searchMode) {
      return c.dim + '  Type to search  •  Enter: jump  •  Esc: cancel' + c.reset;
    }

    return c.dim
      + '  ↑↓: navigate  •  Enter: play  •  Space: pause  •  '
      + 'n/p: next/prev  •  +/-: vol  •  s: shuffle  •  r: repeat  •  /: search  •  q: quit'
      + c.reset;
  }

  _adjustScroll(cursor, viewHeight, totalTracks) {
    if (cursor < this.scrollOffset) {
      this.scrollOffset = cursor;
    } else if (cursor >= this.scrollOffset + viewHeight) {
      this.scrollOffset = cursor - viewHeight + 1;
    }
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, totalTracks - viewHeight));
    if (this.scrollOffset < 0) this.scrollOffset = 0;
  }

  _formatTime(sec) {
    if (!sec || sec <= 0) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
  }

  _truncate(str, maxLen) {
    return str;
  }
}

module.exports = UI;
