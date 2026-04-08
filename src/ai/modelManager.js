/**
 * Gemma 2B IT GPU INT4 model management via OPFS.
 *
 * The model is distributed by Google through Kaggle under a gated license.
 * Users must sign in to Kaggle and accept the Gemma terms before downloading.
 * Once downloaded externally, the user imports the file into this app and it
 * is streamed directly into Origin Private File System — never buffered fully
 * in memory, never fetched anonymously from the PWA.
 */

export const MODEL_FILE_NAME = 'gemma-2b-it-gpu-int4.bin';

/**
 * Official Kaggle distribution page for Gemma 2B IT GPU INT4.
 * Users must be signed in and have accepted the Gemma license to download.
 */
export const KAGGLE_MODEL_URL =
  'https://www.kaggle.com/models/google/gemma/tfLite/gemma-2b-it-gpu-int4';

/** Check if WebGPU is available. */
export function isWebGPUSupported() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

/** Get the OPFS root directory handle. */
async function getOPFSRoot() {
  return navigator.storage.getDirectory();
}

/** Check if the model file exists in OPFS. */
export async function isModelDownloaded() {
  try {
    const root = await getOPFSRoot();
    await root.getFileHandle(MODEL_FILE_NAME);
    return true;
  } catch {
    return false;
  }
}

/** Get the approximate size of the model file in OPFS (bytes). */
export async function getModelSize() {
  try {
    const root = await getOPFSRoot();
    const handle = await root.getFileHandle(MODEL_FILE_NAME);
    const file = await handle.getFile();
    return file.size;
  } catch {
    return 0;
  }
}

/**
 * Import a user-selected model file into OPFS.
 * Streams the File object directly into storage — never holds the full
 * file buffer in memory at once.
 *
 * @param {File} file          - File object from an <input type="file"> picker
 * @param {function} onProgress - called with (bytesWritten, totalBytes)
 * @param {AbortSignal} [signal] - optional abort signal
 */
export async function importModelFile(file, onProgress, signal) {
  const root = await getOPFSRoot();
  const fileHandle = await root.getFileHandle(MODEL_FILE_NAME, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    const total = file.size;
    let written = 0;
    const CHUNK = 2 * 1024 * 1024; // 2 MB chunks

    const stream = file.stream();
    const reader = stream.getReader();

    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;

      // Write in sub-chunks to keep the progress bar smooth
      let offset = 0;
      while (offset < value.byteLength) {
        const slice = value.subarray(offset, offset + CHUNK);
        await writable.write(slice);
        written += slice.byteLength;
        offset += slice.byteLength;
        if (onProgress) onProgress(written, total);
      }
    }

    await writable.close();
    return true;
  } catch (err) {
    await writable.abort();
    // Clean up partial file on failure
    try {
      const root2 = await getOPFSRoot();
      await root2.removeEntry(MODEL_FILE_NAME);
    } catch {}
    throw err;
  }
}

/** Delete the model from OPFS. */
export async function deleteModel() {
  try {
    const root = await getOPFSRoot();
    await root.removeEntry(MODEL_FILE_NAME);
  } catch {
    // Already gone — fine
  }
}

/** Get a File object for the model from OPFS (used by MediaPipe). */
export async function getModelFile() {
  const root = await getOPFSRoot();
  const handle = await root.getFileHandle(MODEL_FILE_NAME);
  return handle.getFile();
}

/** Format bytes as a human-readable string. */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
