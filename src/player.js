/**
 * ═══════════════════════════════════════════════════════════
 *  Player — Audio playback engine (Day 2)
 * ═══════════════════════════════════════════════════════════
 *
 *  Wraps macOS `afplay` for actual audio playback.
 *
 *  Features:
 *  - Play, pause (SIGSTOP/SIGCONT), stop
 *  - Volume control (afplay -v flag, 0.0–1.0)
 *  - Elapsed time tracking via setInterval
 *  - Emits 'trackEnd' when a song finishes naturally
 *
 *  Concepts demonstrated:
 *  - child_process.spawn for external process management
 *  - Unix signals (SIGSTOP, SIGCONT, SIGTERM)
 *  - EventEmitter for decoupled event-driven architecture
 *  - Timer-based progress estimation
 */

const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class Player extends EventEmitter {
  constructor() {
    super();

    /** @type {import('child_process').ChildProcess|null} */
    this._process = null;

    /** @type {object|null} Current song metadata */
    this.currentSong = null;

    /** @type {boolean} Whether playback is paused */
    this.paused = false;

    /** @type {boolean} Whether anything is currently playing */
    this.playing = false;

    /** @type {number} Elapsed seconds of current track */
    this.elapsed = 0;

    /** @type {number} Volume level 0.0 – 1.0 */
    this.volume = 0.5;

    /** @type {NodeJS.Timeout|null} Timer for tracking elapsed time */
    this._timer = null;
  }

  /**
   * Play an audio file.
   * If something is already playing, stop it first.
   *
   * @param {object} song - Song metadata object (must have .path and .duration)
   */
  play(song) {
    // Stop any currently playing track
    this.stop();

    this.currentSong = song;
    this.elapsed = 0;
    this.paused = false;
    this.playing = true;

    // Spawn afplay with volume flag
    // afplay uses a linear volume scale where 1 = normal
    this._process = spawn('afplay', ['-v', String(this.volume), song.path], {
      stdio: 'ignore',
    });

    // When the afplay process exits, the track has ended
    this._process.on('close', (code) => {
      // code 0 = normal completion, code null = we killed it
      const wasNaturalEnd = code === 0 && this.playing;
      this._cleanup();

      if (wasNaturalEnd) {
        this.emit('trackEnd');
      }
    });

    this._process.on('error', () => {
      this._cleanup();
    });

    // Start the elapsed-time timer (ticks every 500ms for smoother progress)
    this._startTimer();
  }

  /**
   * Toggle pause/resume.
   * Uses SIGSTOP to freeze afplay and SIGCONT to resume.
   */
  togglePause() {
    if (!this._process || !this.playing) return;

    if (this.paused) {
      // Resume
      this._process.kill('SIGCONT');
      this.paused = false;
      this._startTimer();
    } else {
      // Pause
      this._process.kill('SIGSTOP');
      this.paused = true;
      this._stopTimer();
    }
  }

  /**
   * Stop the current track entirely.
   */
  stop() {
    if (this._process) {
      this.playing = false; // Set before kill so 'close' handler knows we stopped
      // If paused, resume first so SIGTERM can be received
      if (this.paused) {
        this._process.kill('SIGCONT');
      }
      this._process.kill('SIGTERM');
      this._process = null;
    }
    this._cleanup();
  }

  /**
   * Adjust volume.
   * Since afplay doesn't support runtime volume changes,
   * we restart the track at the current position with the new volume.
   *
   * @param {number} delta - Amount to change (+0.1 or -0.1)
   */
  adjustVolume(delta) {
    this.volume = Math.max(0, Math.min(1, this.volume + delta));

    // If currently playing, restart at current position
    // (afplay doesn't support dynamic volume, so we restart)
    if (this.playing && this.currentSong && !this.paused) {
      const savedElapsed = this.elapsed;
      const song = this.currentSong;

      this.stop();

      this.currentSong = song;
      this.elapsed = savedElapsed;
      this.paused = false;
      this.playing = true;

      // afplay -t flag sets start time
      this._process = spawn('afplay', [
        '-v', String(this.volume),
        '-t', String(Math.max(0, song.duration - savedElapsed)),
        song.path,
      ], { stdio: 'ignore' });

      this._process.on('close', (code) => {
        const wasNaturalEnd = code === 0 && this.playing;
        this._cleanup();
        if (wasNaturalEnd) {
          this.emit('trackEnd');
        }
      });

      this._process.on('error', () => {
        this._cleanup();
      });

      this._startTimer();
    }
  }

  /**
   * Start the elapsed-time tracking timer.
   */
  _startTimer() {
    this._stopTimer();
    this._timer = setInterval(() => {
      this.elapsed += 0.5;
    }, 500);
  }

  /**
   * Stop the elapsed-time tracking timer.
   */
  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * Clean up internal state after a track ends.
   */
  _cleanup() {
    this._stopTimer();
    this.playing = false;
    this.paused = false;
  }
}

module.exports = Player;
