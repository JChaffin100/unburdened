import { useState, useRef } from 'react';
import {
  downloadModel,
  isWebGPUSupported,
  formatBytes,
  isModelDownloaded,
} from '../ai/modelManager.js';

export default function ModelLoader({ onDone, onSkip }) {
  const [state, setState] = useState('idle'); // idle | downloading | done | error
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef(null);

  const webGPU = isWebGPUSupported();

  async function startDownload() {
    if (!webGPU) return;
    setState('downloading');
    setErrorMsg('');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await downloadModel(
        (recv, tot) => {
          setReceived(recv);
          setTotal(tot);
        },
        controller.signal
      );
      setState('done');
      if (onDone) onDone();
    } catch (err) {
      if (err.name === 'AbortError') {
        setState('idle');
      } else {
        setState('error');
        setErrorMsg(err.message || 'Download failed. Please check your connection.');
      }
    }
  }

  function cancelDownload() {
    abortRef.current?.abort();
  }

  const pct = total > 0 ? Math.round((received / total) * 100) : 0;

  if (!webGPU) {
    return (
      <div className="model-loader">
        <div className="model-no-webgpu">
          <p>Your browser does not support WebGPU.</p>
          <p>Please use <strong>Chrome on Android</strong> (or a desktop Chromium browser with WebGPU enabled) to use the AI companion.</p>
          <p>You can still use Unburdened to track areas and commitments — the AI chat will be unavailable until you access it from a supported browser.</p>
        </div>
        {onSkip && (
          <button className="btn btn-ghost btn-full" onClick={onSkip}>Skip for now</button>
        )}
      </div>
    );
  }

  return (
    <div className="model-loader">
      {state === 'idle' && (
        <>
          <button className="btn btn-primary btn-full" onClick={startDownload}>
            Download AI Model (~1–2 GB)
          </button>
          {onSkip && (
            <button className="btn btn-ghost btn-full" onClick={onSkip}>Skip for now</button>
          )}
        </>
      )}

      {state === 'downloading' && (
        <div className="model-progress-wrap">
          <div className="model-progress-bar">
            <div className="model-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="model-progress-text">
            {formatBytes(received)}{total > 0 ? ` / ${formatBytes(total)}` : ''} — {pct}%
          </p>
          <button className="btn btn-ghost" onClick={cancelDownload}>Cancel</button>
        </div>
      )}

      {state === 'done' && (
        <div className="model-done">
          <span className="model-done-check">✓</span>
          <p>AI model downloaded and ready.</p>
        </div>
      )}

      {state === 'error' && (
        <div className="model-error">
          <p className="model-error-msg">{errorMsg}</p>
          <button className="btn btn-primary" onClick={startDownload}>Try again</button>
          {onSkip && (
            <button className="btn btn-ghost" onClick={onSkip}>Skip for now</button>
          )}
        </div>
      )}
    </div>
  );
}
