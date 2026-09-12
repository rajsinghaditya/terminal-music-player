const RepeatMode = {
  OFF: 'off',
  ONE: 'one',
  ALL: 'all',
};

class Playlist {
  constructor(songs = []) {
    this._original = [...songs];
    this.tracks = [...songs];
    this.currentIndex = 0;
    this.shuffled = false;
    this.repeatMode = RepeatMode.OFF;
  }

  get currentTrack() {
    if (this.tracks.length === 0) return null;
    return this.tracks[this.currentIndex] || null;
  }

  get length() {
    return this.tracks.length;
  }

  next() {
    if (this.tracks.length === 0) return null;

    if (this.repeatMode === RepeatMode.ONE) {
      return this.currentTrack;
    }

    if (this.currentIndex < this.tracks.length - 1) {
      this.currentIndex++;
      return this.currentTrack;
    }

    if (this.repeatMode === RepeatMode.ALL) {
      this.currentIndex = 0;
      return this.currentTrack;
    }

    return null;
  }

  previous() {
    if (this.tracks.length === 0) return null;

    if (this.repeatMode === RepeatMode.ONE) {
      return this.currentTrack;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.currentTrack;
    }

    if (this.repeatMode === RepeatMode.ALL) {
      this.currentIndex = this.tracks.length - 1;
      return this.currentTrack;
    }

    return this.currentTrack;
  }

  select(index) {
    if (index >= 0 && index < this.tracks.length) {
      this.currentIndex = index;
      return this.currentTrack;
    }
    return null;
  }

  toggleShuffle() {
    const current = this.currentTrack;

    if (!this.shuffled) {
      this.tracks = [...this._original];
      this._fisherYatesShuffle(this.tracks);

      if (current) {
        const idx = this.tracks.findIndex(t => t.path === current.path);
        if (idx > 0) {
          [this.tracks[0], this.tracks[idx]] = [this.tracks[idx], this.tracks[0]];
        }
        this.currentIndex = 0;
      }

      this.shuffled = true;
    } else {
      this.tracks = [...this._original];

      if (current) {
        const idx = this.tracks.findIndex(t => t.path === current.path);
        this.currentIndex = idx >= 0 ? idx : 0;
      }

      this.shuffled = false;
    }
  }

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

  sortBy(field) {
    this.tracks.sort((a, b) => {
      if (field === 'duration') return (a.duration || 0) - (b.duration || 0);
      return (a[field] || '').localeCompare(b[field] || '');
    });
    this._original = [...this.tracks];
    this.currentIndex = 0;
    this.shuffled = false;
  }

  _fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

module.exports = Playlist;
module.exports.RepeatMode = RepeatMode;
