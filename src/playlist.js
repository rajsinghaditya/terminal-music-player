/**
 * ═══════════════════════════════════════════════════════════
 *  Playlist — Queue management, shuffle & repeat (Day 2)
 * ═══════════════════════════════════════════════════════════
 *
 *  Manages the ordered list of tracks and controls playback
 *  order including shuffle and repeat modes.
 *
 *  Features:
 *  - Ordered track list with current-track pointer
 *  - Shuffle using Fisher-Yates algorithm
 *  - Repeat modes: off, one, all
 *  - Search/filter tracks by title or artist
 *
 *  Concepts demonstrated:
 *  - Fisher-Yates (Knuth) shuffle algorithm
 *  - State management with enums
 *  - Array manipulation and index tracking
 */

/** Repeat mode constants */
const RepeatMode = {
  OFF: 'off',
  ONE: 'one',
  ALL: 'all',
};

class Playlist {
  /**
   * Create a Playlist.
   * @param {Array} songs - Array of song metadata objects from FileManager
   */
  constructor(songs = []) {
    /** @type {Array} Original unshuffled track list */
    this._original = [...songs];

    /** @type {Array} Active track list (may be shuffled) */
    this.tracks = [...songs];

    /** @type {number} Index of the currently selected/playing track */
    this.currentIndex = 0;

    /** @type {boolean} Whether shuffle is enabled */
    this.shuffled = false;

    /** @type {string} Current repeat mode */
    this.repeatMode = RepeatMode.OFF;
  }

  /**
   * Get the currently selected track.
   * @returns {object|null}
   */
  get currentTrack() {
    if (this.tracks.length === 0) return null;
    return this.tracks[this.currentIndex] || null;
  }

  /**
   * Get the total number of tracks.
   * @returns {number}
   */
  get length() {
    return this.tracks.length;
  }

  /**
   * Move to the next track based on repeat/shuffle settings.
   * Returns the next track, or null if we've reached the end
   * (and repeat is off).
   *
   * @returns {object|null} Next song or null
   */
  next() {
    if (this.tracks.length === 0) return null;

    // Repeat one: stay on the same track
    if (this.repeatMode === RepeatMode.ONE) {
      return this.currentTrack;
    }

    // Move forward
    if (this.currentIndex < this.tracks.length - 1) {
      this.currentIndex++;
      return this.currentTrack;
    }

    // We're at the end
    if (this.repeatMode === RepeatMode.ALL) {
      // Wrap around to the beginning
      this.currentIndex = 0;
      return this.currentTrack;
    }

    // Repeat off — no more tracks
    return null;
  }

  /**
   * Move to the previous track.
   * @returns {object|null}
   */
  previous() {
    if (this.tracks.length === 0) return null;

    if (this.repeatMode === RepeatMode.ONE) {
      return this.currentTrack;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.currentTrack;
    }

    // We're at the beginning
    if (this.repeatMode === RepeatMode.ALL) {
      this.currentIndex = this.tracks.length - 1;
      return this.currentTrack;
    }

    // Stay at beginning
    return this.currentTrack;
  }

  /**
   * Select a specific track by index.
   * @param {number} index
   * @returns {object|null}
   */
  select(index) {
    if (index >= 0 && index < this.tracks.length) {
      this.currentIndex = index;
      return this.currentTrack;
    }
    return null;
  }

  /**
   * Toggle shuffle on/off.
   *
   * When enabling shuffle:
   *  - Save the current track identity
   *  - Shuffle using Fisher-Yates
   *  - Put the current track at position 0
   *
   * When disabling shuffle:
   *  - Restore original order
   *  - Find and restore the current track's position
   */
  toggleShuffle() {
    const current = this.currentTrack;

    if (!this.shuffled) {
      // Enable shuffle
      this.tracks = [...this._original];
      this._fisherYatesShuffle(this.tracks);

      // Move the current track to position 0 so it doesn't change
      if (current) {
        const idx = this.tracks.findIndex(t => t.path === current.path);
        if (idx > 0) {
          [this.tracks[0], this.tracks[idx]] = [this.tracks[idx], this.tracks[0]];
        }
        this.currentIndex = 0;
      }

      this.shuffled = true;
    } else {
      // Disable shuffle — restore original order
      this.tracks = [...this._original];

      // Find where the current track is in the original order
      if (current) {
        const idx = this.tracks.findIndex(t => t.path === current.path);
        this.currentIndex = idx >= 0 ? idx : 0;
      }

      this.shuffled = false;
    }
  }

  /**
   * Cycle through repeat modes: off → all → one → off
   * @returns {string} The new repeat mode
   */
  cycleRepeat() {
    if (this.repeatMode === RepeatMode.OFF) {
      this.repeatMode = RepeatMode.ALL;
    } else if (this.repeatMode === RepeatMode.ALL) {
      this.repeatMode = RepeatMode.ONE;
    } else {
      this.repeatMode = RepeatMode.OFF;
    }
    return this.repeatMode;
  }

  /**
   * Search tracks by title or artist.
   * Returns indices into the current tracks array.
   *
   * @param {string} query - Search string (case-insensitive)
   * @returns {number[]} Array of matching track indices
   */
  search(query) {
    const q = query.toLowerCase();
    const results = [];
    for (let i = 0; i < this.tracks.length; i++) {
      const t = this.tracks[i];
      if (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q)
      ) {
        results.push(i);
      }
    }
    return results;
  }

  /**
   * Sort tracks by a given field.
   * @param {'title'|'artist'|'album'|'duration'} field
   */
  sortBy(field) {
    this.tracks.sort((a, b) => {
      if (field === 'duration') return (a.duration || 0) - (b.duration || 0);
      return (a[field] || '').localeCompare(b[field] || '');
    });
    this._original = [...this.tracks];
    this.currentIndex = 0;
    this.shuffled = false;
  }

  /**
   * Fisher-Yates (Knuth) shuffle — in-place, unbiased.
   * @param {Array} arr
   */
  _fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

// Export the class and the repeat mode constants
module.exports = Playlist;
module.exports.RepeatMode = RepeatMode;
