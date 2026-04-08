import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { clearAllData } from '../storage/db.js';

export default function LockScreen() {
  const { unlock } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [confirmReset, setConfirmReset] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleUnlock(e) {
    e.preventDefault();
    if (!passcode.trim() || loading) return;
    setLoading(true);
    setError('');
    const ok = await unlock(passcode);
    setLoading(false);
    if (!ok) {
      setError('Incorrect passcode. Please try again.');
      setPasscode('');
      inputRef.current?.focus();
    }
  }

  async function handleReset() {
    if (confirmReset !== 'DELETE') return;
    await clearAllData();
    localStorage.clear();
    setResetDone(true);
    setTimeout(() => window.location.reload(), 1500);
  }

  if (resetDone) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <p className="lock-reset-done">All data erased. Reloading…</p>
        </div>
      </div>
    );
  }

  if (showForgot) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <h2 className="lock-title">Forgot Passcode</h2>
          <div className="lock-warning-box">
            <p>Your passcode cannot be recovered. There is no backdoor.</p>
            <p>If you continue, <strong>all your data will be permanently erased</strong> and the app will reset to a blank state.</p>
          </div>
          <p className="lock-reset-label">Type <strong>DELETE</strong> to confirm:</p>
          <input
            className="lock-input"
            type="text"
            value={confirmReset}
            onChange={(e) => setConfirmReset(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
          <button
            className="lock-btn lock-btn-danger"
            onClick={handleReset}
            disabled={confirmReset !== 'DELETE'}
          >
            Erase everything and reset
          </button>
          <button className="lock-link" onClick={() => setShowForgot(false)}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <img src="/unburdened/icons/icon-180.png" alt="Unburdened" className="lock-icon" />
        <h1 className="lock-app-name">Unburdened</h1>
        <p className="lock-scripture">"Come to me, all who are weary and burdened, and I will give you rest."</p>
        <p className="lock-scripture-ref">— Matthew 11:28</p>

        <form onSubmit={handleUnlock} className="lock-form">
          <input
            ref={inputRef}
            className="lock-input"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter passcode"
            autoComplete="current-password"
            disabled={loading}
            aria-label="Passcode"
          />
          {error && <p className="lock-error" role="alert">{error}</p>}
          <button className="lock-btn lock-btn-primary" type="submit" disabled={loading || !passcode.trim()}>
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>

        <button className="lock-link" onClick={() => setShowForgot(true)}>
          Forgot passcode?
        </button>
      </div>
    </div>
  );
}
