const fs = require('fs');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set([
  '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma',
]);

class FileManager {
  constructor(musicDir) {
    this.musicDir = musicDir || path.join(process.cwd(), 'music');
  }

  async scan() {
    const songs = [];

    if (!fs.existsSync(this.musicDir)) {
      fs.mkdirSync(this.musicDir, { recursive: true });
      return songs;
    }

    const filePaths = this._collectAudioFiles(this.musicDir);

    let mm;
    try {
      mm = await import('music-metadata');
    } catch (_) {
      mm = null;
    }

    for (const filePath of filePaths) {
      try {
        const meta = mm ? await this._parseMetadata(mm, filePath) : null;
        songs.push(meta || this._basicEntry(filePath));
      } catch (_) {
        songs.push(this._basicEntry(filePath));
      }
    }

    return songs;
  }

  _collectAudioFiles(dir) {
    const results = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          results.push(...this._collectAudioFiles(fullPath));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (_) {}

    return results;
  }

  async _parseMetadata(mm, filePath) {
    const metadata = await mm.parseFile(filePath);
    const name = path.basename(filePath, path.extname(filePath));

    return {
      path: filePath,
      title: metadata.common.title || name,
      artist: metadata.common.artist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album',
      duration: metadata.format.duration || 0,
      format: path.extname(filePath).slice(1).toUpperCase(),
      bitrate: metadata.format.bitrate
        ? Math.round(metadata.format.bitrate / 1000)
        : 0,
    };
  }

  _basicEntry(filePath) {
    const name = path.basename(filePath, path.extname(filePath));

    return {
      path: filePath,
      title: name,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      duration: 0,
      format: path.extname(filePath).slice(1).toUpperCase(),
      bitrate: 0,
    };
  }

  static sortBy(songs, field) {
    return songs.sort((a, b) => {
      if (field === 'duration') return (a.duration || 0) - (b.duration || 0);
      return (a[field] || '').localeCompare(b[field] || '');
    });
  }

  static getSupportedFormats() {
    return [...SUPPORTED_EXTENSIONS].map(ext => ext.slice(1).toUpperCase());
  }
}

module.exports = FileManager;
