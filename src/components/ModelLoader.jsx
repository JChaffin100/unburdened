import { useState, useRef } from 'react';
import {
  importModelFile,
  isWebGPUSupported,
  formatBytes,
  KAGGLE_MODEL_URL,
} from '../ai/modelManager.js';

/**
 * ModelLoader
 *
 * Three-state Kaggle onboarding flow:
 *   idle     → explain gated access, offer "Download from Kaggle" + "I already downloaded it"
 *   import   → file picker + progress bar as the file is streamed into OPFS
 *   done     → success confirmation
 *   error    → error message + retry
 *
 * Props:
 *   onDone   — called when the model has been successfully imported into OPFS
 *   onSkip   — called when the user chooses "Set up later"
 *   alreadyInstalled — if true, skip the intro and jump straight to the import state
 */
export default function ModelLoader({ onDone, onSkip, alreadyInstalled = false }) {
  const [state, setState] = useState(alreadyInstalled ? 'import' : 'idle');
  const [written, setWritten] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef(null);
  const fileRef = useRef(null);

  const webGPU = isWebGPUSupported();

  // ── No WebGPU ──────────────────────────────────────────────────────────────
  if (!webGPU) {
    return (
      <div className="model-loader">
        <div className="model-no-webgpu">
          <p>Your browser does not support WebGPU.</p>
          <p>
            Please use <strong>Chrome on Android</strong> (or a desktop Chromium browser
            with WebGPU enabled) to use the AI companion.
          </p>
          <p>
            You can still use Unburdened to track areas and commitments — the AI chat
            will be unavailable until you access it from a supported browser.
          </p>
        </div>
        {onSkip && (
          <button className="btn btn-ghost btn-full" onClick={onSkip}>
            Set up later
          </button>
        )}
      </div>
    );
  }

  // ── File import handler ────────────────────────────────────────────────────
  async function handleFileSelected(file) {
    if (!file) return;

    // Validation: Check extension
    if (!file.name.toLowerCase().endsWith('.bin')) {
      setState('error');
      setErrorMsg('Invalid file type. Please select the .bin file from the TFLite download.');
      return;
    }

    // Validation: Check size (prevent importing unquantized 3.7GB+ models)
    if (file.size > MAX_MODEL_SIZE_BYTES) {
      setState('error');
      setErrorMsg(`This file is too large (${formatBytes(file.size)}). You likely downloaded the "F16" or "Keras" version. Please download the "gemma-1.1-2b-it-gpu-int4" TFLite variation.`);
      return;
    }

    setState('importing');
    setErrorMsg('');
    setWritten(0);
    setTotal(file.size);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await importModelFile(
        file,
        (recv, tot) => {
          setWritten(recv);
          setTotal(tot);
        },
        controller.signal
      );
      setState('done');
      if (onDone) onDone();
    } catch (err) {
      if (err.name === 'AbortError') {
        setState('import');
      } else {
        setState('error');
        setErrorMsg(err.message || 'Import failed. Please try again.');
      }
    }
  }

  function cancelImport() {
    abortRef.current?.abort();
  }

  const pct = total > 0 ? Math.round((written / total) * 100) : 0;

  // ── Idle: explain Kaggle gated access ─────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="model-loader">
        <div className="model-kaggle-info">
          <span className="model-kaggle-icon">🔒</span>
          <p className="model-kaggle-text">
            This app runs locally with the <strong>Gemma 2B IT GPU INT4</strong> model.
            Google distributes it through Kaggle under a gated license — you must{' '}
            <strong>sign in and accept the terms</strong> before downloading. After
            downloading, return here and import the file to finish setup.
          </p>
        </div>

        <div className="model-kaggle-actions">
          <a
            href={KAGGLE_MODEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-full"
            id="kaggle-download-btn"
          >
            🌐 Download from Kaggle
          </a>
          <button
            className="btn btn-outline btn-full"
            id="already-downloaded-btn"
            onClick={() => setState('import')}
          >
            I already downloaded it
          </button>
        </div>

        {onSkip && (
          <button className="btn btn-ghost btn-full" onClick={onSkip} id="model-skip-btn">
            Set up later
          </button>
        )}
      </div>
    );
  }

  // ── Import: file picker ────────────────────────────────────────────────────
  if (state === 'import') {
    return (
      <div className="model-loader">
        <p className="model-import-hint">
          Select the <code>.bin</code> file you downloaded from Kaggle. It will be
          imported directly onto this device — no data is uploaded anywhere.
        </p>

        <label className="model-import-area" htmlFor="model-file-input" id="model-import-label">
          <span className="model-import-icon">📂</span>
          <span className="model-import-label-text">Tap to select model file</span>
          <input
            id="model-file-input"
            ref={fileRef}
            type="file"
            accept=".bin"
            className="model-import-input"
            onChange={(e) => handleFileSelected(e.target.files[0])}
          />
        </label>

        <div className="model-kaggle-actions">
          <a
            href={KAGGLE_MODEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-full"
          >
            🌐 Back to Kaggle download
          </a>
        </div>

        {onSkip && (
          <button className="btn btn-ghost btn-full" onClick={onSkip}>
            Set up later
          </button>
        )}
      </div>
    );
  }

  // ── Importing: progress bar ────────────────────────────────────────────────
  if (state === 'importing') {
    return (
      <div className="model-loader">
        <p className="model-import-hint">Importing model file…</p>
        <div className="model-progress-wrap">
          <div className="model-progress-bar">
            <div className="model-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="model-progress-text">
            {formatBytes(written)}{total > 0 ? ` / ${formatBytes(total)}` : ''} — {pct}%
          </p>
          <button className="btn btn-ghost" onClick={cancelImport}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="model-loader">
        <div className="model-done">
          <span className="model-done-check">✓</span>
          <p>AI model imported and ready.</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="model-loader">
        <div className="model-error">
          <p className="model-error-msg">{errorMsg}</p>
          <button className="btn btn-primary" onClick={() => setState('import')}>
            Try again
          </button>
          {onSkip && (
            <button className="btn btn-ghost" onClick={onSkip}>
              Set up later
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
