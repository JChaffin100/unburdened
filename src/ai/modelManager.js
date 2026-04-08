/**
 * Gemma 4 E2B model management via OPFS.
 * The model is streamed directly into Origin Private File System — never buffered in memory.
 * Never store model files in the service worker cache.
 */

const MODEL_FILE_NAME = 'gemma4-e2b.bin';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/llm_inference/gemma-2b-it-gpu-int4/float16/1/gemma-2b-it-gpu-int4.bin';

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
 * Stream-download the model directly into OPFS.
 * Never buffers the full model in memory.
 *
 * @param {function} onProgress - called with (bytesReceived, totalBytes)
 * @param {AbortSignal} signal - optional abort signal
 */
export async function downloadModel(onProgress, signal) {
  const root = await getOPFSRoot();
  const fileHandle = await root.getFileHandle(MODEL_FILE_NAME, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    const response = await fetch(MODEL_URL, { signal });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const total = parseInt(response.headers.get('content-length') || '0', 10);
    let received = 0;

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      received += value.byteLength;
      if (onProgress) onProgress(received, total);
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
