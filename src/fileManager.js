/**
 * ═══════════════════════════════════════════════════════════
 *  FileManager - Audio file discovery & metadata extraction
 * ═══════════════════════════════════════════════════════════
 *
 *  This module handles:
 *  1. Recursive directory traversal to find audio files
 *  2. Metadata extraction (title, artist, album, duration)
 *  3. Graceful fallback when metadata is unavailable
 *
 *  Concepts demonstrated:
 *  - fs module (readdirSync, existsSync, mkdirSync)
 *  - Recursive file system walking
 *  - Async/Await for I/O-bound operations
 *  - Dynamic ESM import inside CommonJS
 *  - Error handling with fallbacks
 */

const fs = require('fs');
const path = require('path');

// Audio file extensions we support
const SUPPORTED_EXTENSIONS = new Set([
  '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma',
]);

class FileManager {
  /**
   * Create a FileManager instance.
   * @param {string} musicDir - Absolute or relative path to the music folder
   */
  constructor(musicDir) {
    this.musicDir = musicDir || path.join(process.cwd(), 'music');
  }

  /**
   * Scan the music directory and return an array of song objects.
   * Each song object contains: path, title, artist, album, duration, format, bitrate.
   *
   * @returns {Promise<Array>} Array of song metadata objects
   */
  async scan() {
    const songs = [];

    // Create the music directory if it doesn't exist
    if (!fs.existsSync(this.musicDir)) {
      fs.mkdirSync(this.musicDir, { recursive: true });
      return songs;
    }

    // Step 1: Collect all audio file paths recursively
    const filePaths = this._collectAudioFiles(this.musicDir);

    // Step 2: Load the music-metadata library (ESM module)
    //         We use dynamic import() because music-metadata v8+
    //         is ESM-only and our project uses CommonJS (require)
    let mm;
    try {
      mm = await import('music-metadata');
    } catch (_) {
      mm = null; // If import fails, we'll use filename-based fallback
    }

    // Step 3: Parse metadata for each file
    for (const filePath of filePaths) {
      try {
        const meta = mm ? await this._parseMetadata(mm, filePath) : null;
        songs.push(meta || this._basicEntry(filePath));
      } catch (_) {
        // If metadata parsing fails for a file, use the filename instead
        songs.push(this._basicEntry(filePath));
      }
    }

    return songs;
  }

  /**
   * Recursively walk a directory and collect paths to audio files.
   * Skips hidden files (starting with '.') and unreadable directories.
   *
   * @param {string} dir - Directory to scan
   * @returns {string[]} Array of absolute file paths
   */
  _collectAudioFiles(dir) {
    const results = [];

    try {
      // Read directory entries with file type info (avoids extra stat calls)
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files like .DS_Store
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Recurse into subdirectories
          results.push(...this._collectAudioFiles(fullPath));
        } else if (entry.isFile()) {
          // Check if the file extension is a supported audio format
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (_) {
      // Silently skip directories we can't read (permission errors, etc.)
    }

    return results;
  }

  /**
   * Extract metadata from an audio file using the music-metadata library.
   * Returns a structured song object.
   *
   * @param {object} mm - The music-metadata module
   * @param {string} filePath - Path to the audio file
   * @returns {Promise<object>} Song metadata object
   */
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

  /**
   * Fallback: create a basic song object from the filename.
   * Used when music-metadata is unavailable or parsing fails.
   *
   * @param {string} filePath - Path to the audio file
   * @returns {object} Basic song object
   */
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

  /**
   * Sort an array of songs by a given field.
   *
   * @param {Array} songs - Array of song objects
   * @param {'title'|'artist'|'album'|'duration'} field - Field to sort by
   * @returns {Array} Sorted array (mutates in place and returns)
   */
  static sortBy(songs, field) {
    return songs.sort((a, b) => {
      if (field === 'duration') return (a.duration || 0) - (b.duration || 0);
      return (a[field] || '').localeCompare(b[field] || '');
    });
  }

  /**
   * Get the list of supported audio formats for display.
   * @returns {string[]}
   */
  static getSupportedFormats() {
    return [...SUPPORTED_EXTENSIONS].map(ext => ext.slice(1).toUpperCase());
  }
}

module.exports = FileManager;
