const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class Player extends EventEmitter {
  constructor() {
    super();
    this._process = null;
    this.currentSong = null;
    this.paused = false;
    this.playing = false;
    this.elapsed = 0;
    this.volume = 0.5;
    this._timer = null;
  }

  play(song) {
    this.stop();

    this.currentSong = song;
    this.elapsed = 0;
    this.paused = false;
    this.playing = true;

    this._process = spawn('afplay', ['-v', String(this.volume), song.path], {
      stdio: 'ignore',
    });

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

  togglePause() {
    if (!this._process || !this.playing) return;

    if (this.paused) {
      this._process.kill('SIGCONT');
      this.paused = false;
      this._startTimer();
    } else {
      this._process.kill('SIGSTOP');
      this.paused = true;
      this._stopTimer();
    }
  }

  stop() {
    if (this._process) {
      this.playing = false;
      if (this.paused) {
        this._process.kill('SIGCONT');
      }
      this._process.kill('SIGTERM');
      this._process = null;
    }
    this._cleanup();
  }

  adjustVolume(delta) {
    this.volume = Math.max(0, Math.min(1, this.volume + delta));

    if (this.playing && this.currentSong && !this.paused) {
      const savedElapsed = this.elapsed;
      const song = this.currentSong;

      this.stop();

      this.currentSong = song;
      this.elapsed = savedElapsed;
      this.paused = false;
      this.playing = true;

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

  _startTimer() {
    this._stopTimer();
    this._timer = setInterval(() => {
      this.elapsed += 0.5;
    }, 500);
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _cleanup() {
    this._stopTimer();
    this.playing = false;
    this.paused = false;
  }
}

module.exports = Player;
