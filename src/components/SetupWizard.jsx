import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { encryptAndStore } from '../storage/db.js';
import ModelLoader from './ModelLoader.jsx';

const TOTAL_STEPS = 5;

export default function SetupWizard({ onComplete }) {
  const { setup } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState(null);
  const [modelSkipped, setModelSkipped] = useState(false);

  async function handleStep2() {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setError('');
    setStep(3);
  }

  async function handleStep3() {
    if (!passcode.trim()) { setError('Please create a passcode.'); return; }
    if (passcode.length < 4) { setError('Passcode must be at least 4 characters.'); return; }
    if (passcode !== confirm) { setError('Passcodes do not match.'); return; }
    setError('');
    setLoading(true);
    try {
      const key = await setup(passcode);
      // Store encrypted name
      await encryptAndStore('profile', key, 'user', { name: name.trim() });
      setSessionKey(key);
      setStep(4);
    } catch (err) {
      setError('Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleModelDone() {
    setStep(5);
  }

  function handleSkipModel() {
    setModelSkipped(true);
    setStep(5);
  }

  function handleFinish() {
    onComplete();
  }

  return (
    <div className="setup-wizard">
      <div className="setup-progress">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`setup-dot ${i + 1 <= step ? 'active' : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="setup-step">
          <img src="/unburdened/icons/icon-180.png" alt="Unburdened" className="setup-icon" />
          <h1 className="setup-title">Unburdened</h1>
          <p className="setup-scripture">"Come to me, all who are weary and burdened, and I will give you rest."</p>
          <p className="setup-scripture-ref">— Matthew 11:28</p>
          <p className="setup-desc">A private AI accountability companion. Your conversations never leave this device.</p>
          <button className="btn btn-primary btn-full" onClick={() => setStep(2)}>Get Started</button>
        </div>
      )}

      {step === 2 && (
        <div className="setup-step">
          <h2 className="setup-heading">What should I call you?</h2>
          <input
            className="setup-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="given-name"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleStep2()}
          />
          {error && <p className="setup-error">{error}</p>}
          <button className="btn btn-primary btn-full" onClick={handleStep2}>Continue</button>
        </div>
      )}

      {step === 3 && (
        <div className="setup-step">
          <h2 className="setup-heading">Create your passcode</h2>
          <p className="setup-subtext">This protects all your data. Choose something memorable.</p>

          <div className="setup-warning-block">
            <span className="setup-warning-icon">⚠</span>
            <p>Your passcode <strong>cannot be recovered</strong>. If you forget it, all your data will be permanently unrecoverable. There is no backdoor. Please remember your passcode.</p>
          </div>

          <input
            className="setup-input"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Create passcode"
            autoComplete="new-password"
            autoFocus
          />
          <input
            className="setup-input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm passcode"
            autoComplete="new-password"
            onKeyDown={(e) => e.key === 'Enter' && handleStep3()}
          />
          {error && <p className="setup-error">{error}</p>}
          <button className="btn btn-primary btn-full" onClick={handleStep3} disabled={loading}>
            {loading ? 'Setting up…' : 'Continue'}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="setup-step">
          <h2 className="setup-heading">Set up your AI companion</h2>
          <p className="setup-subtext">
            Unburdened's AI runs entirely on your device — your conversations never leave it.
          </p>
          <p className="setup-subtext">
            The <strong style={{ color: 'rgba(245,240,232,0.85)' }}>Gemma 2B IT GPU INT4</strong> model
            is distributed by Google through Kaggle under a gated license. You'll need to sign in
            and accept the terms before downloading, then return here to import the file.
          </p>
          <ModelLoader onDone={handleModelDone} onSkip={handleSkipModel} />
        </div>
      )}

      {step === 5 && (
        <div className="setup-step">
          <div className="setup-ready-icon">✓</div>
          <h2 className="setup-heading">You're all set{modelSkipped ? ' (almost)' : ''}!</h2>
          {modelSkipped && (
            <p className="setup-subtext">You can import the AI model later from Settings → AI Companion.</p>
          )}
          <p className="setup-subtext">Add your first accountability area to get started.</p>
          <button className="btn btn-primary btn-full" onClick={handleFinish}>Go to Home Screen</button>
        </div>
      )}
    </div>
  );
}
