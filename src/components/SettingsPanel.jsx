import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { usePreferences } from '../hooks/usePreferences.js';
import { encryptAndStore, fetchAndDecrypt, clearAllData, exportAllRaw, importAllRaw } from '../storage/db.js';
import { encrypt, decrypt, deriveKey, loadSalt, generateAndStoreSalt, storeVerificationBlob } from '../crypto/encryption.js';
import { getAppVersion } from '../crypto/encryption.js';
import { isModelDownloaded, deleteModel, getModelSize, formatBytes, isWebGPUSupported } from '../ai/modelManager.js';
import ModelLoader from './ModelLoader.jsx';

const BACKUP_HEADER = 'UNBURDENED_BACKUP_V1\n';
const AUTO_LOCK_OPTIONS = [
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '30 minutes', value: 30 },
  { label: 'Never', value: 0 },
];
const NUDGE_OPTIONS = [
  { label: '3 days', value: 3 },
  { label: '5 days', value: 5 },
  { label: '1 week', value: 7 },
  { label: '2 weeks', value: 14 },
  { label: 'Off', value: 0 },
];

export default function SettingsPanel({ onClose, onLock }) {
  const { sessionKey, autoLockMinutes, updateAutoLock, lock, changePasscode } = useAuth();
  const { prefs, setPref, exportPrefsCSV, importPrefsCSV } = usePreferences();

  const [appVersion, setAppVersion] = useState('…');
  const [userName, setUserName] = useState('');
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState('');

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const [modelDownloaded, setModelDownloaded] = useState(false);
  const [modelSize, setModelSize] = useState(0);
  const [showModelDownload, setShowModelDownload] = useState(false);

  const [exportStatus, setExportStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  const prefsFileRef = useRef(null);
  const backupFileRef = useRef(null);

  useEffect(() => {
    getAppVersion().then(setAppVersion);
    fetchAndDecrypt('profile', sessionKey, 'user').then((r) => {
      if (r?.data?.name) {
        setUserName(r.data.name);
        setEditName(r.data.name);
      }
    }).catch(() => {});
    isModelDownloaded().then(setModelDownloaded);
    getModelSize().then(setModelSize);
  }, []);

  async function saveName() {
    if (!editName.trim()) return;
    setSavingName(true);
    setNameMsg('');
    try {
      await encryptAndStore('profile', sessionKey, 'user', { name: editName.trim() });
      setUserName(editName.trim());
      setNameMsg('Name saved.');
    } catch {
      setNameMsg('Failed to save name.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePasscode() {
    if (!currentPass || !newPass || newPass !== confirmPass) {
      setPassMsg('Please fill all fields and ensure new passcodes match.');
      return;
    }
    if (newPass.length < 4) { setPassMsg('Passcode must be at least 4 characters.'); return; }
    setChangingPass(true);
    setPassMsg('');
    try {
      const newKey = await changePasscode(currentPass, newPass);
      if (!newKey) {
        setPassMsg('Current passcode is incorrect.');
      } else {
        setPassMsg('Passcode changed successfully.');
        setCurrentPass(''); setNewPass(''); setConfirmPass('');
      }
    } catch {
      setPassMsg('Failed to change passcode.');
    } finally {
      setChangingPass(false);
    }
  }

  async function handleCheckUpdate() {
    if (!navigator.serviceWorker) {
      setUpdateMsg('Service worker not supported.');
      return;
    }

    setCheckingUpdate(true);
    setUpdateMsg('Checking for updates…');

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setUpdateMsg('No service worker registration found.');
        setCheckingUpdate(false);
        return;
      }

      // Helper to trigger the final skip-waiting and hard-reload
      const applyUpdate = (worker) => {
        setUpdateMsg('Update ready — refreshing app…');
        
        // Listen for the new worker taking control
        const onControllerChange = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
          // Hard reload with cache-busting query param
          const url = new URL(window.location.href);
          url.searchParams.set('v', Date.now());
          window.location.replace(url.href);
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

        // Send skip waiting
        worker.postMessage({ type: 'SKIP_WAITING' });

        // Fallback reload if controllerchange takes too long
        setTimeout(() => window.location.reload(), 2000);
      };

      // 1. If there's already a waiting worker, apply it
      if (reg.waiting) {
        applyUpdate(reg.waiting);
        return;
      }

      // 2. If it's currently installing, wait for it
      if (reg.installing) {
        setUpdateMsg('Update is downloading…');
        reg.installing.addEventListener('statechange', (e) => {
          if (e.target.state === 'installed') applyUpdate(e.target);
        });
        return;
      }

      // 3. Otherwise, check for new updates
      const updateFoundPromise = new Promise((resolve) => {
        const onUpdateFound = () => {
          reg.removeEventListener('updatefound', onUpdateFound);
          const newWorker = reg.installing;
          setUpdateMsg('Update found — downloading…');
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              applyUpdate(newWorker);
              resolve(true);
            }
          });
        };
        reg.addEventListener('updatefound', onUpdateFound);
        
        // Timeout the "searching" state if nothing is found
        setTimeout(() => resolve(false), 5000);
      });

      await reg.update();

      const found = await updateFoundPromise;
      if (!found && !reg.waiting && !reg.installing) {
        setUpdateMsg(`You're on the latest version (v${appVersion})`);
        setCheckingUpdate(false);
      }
    } catch (err) {
      console.error('Update failed:', err);
      setUpdateMsg('Update check failed.');
      setCheckingUpdate(false);
    }
  }

  async function handleExportBackup() {
    setExportStatus('Exporting…');
    try {
      const rawData = await exportAllRaw();
      const json = JSON.stringify(rawData);
      // Encrypt the full backup with current session key
      const enc = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sessionKey, enc.encode(json));
      // Serialize: header + base64(iv) + '.' + base64(ciphertext)
      const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
      const payload = BACKUP_HEADER + toB64(iv.buffer) + '.' + toB64(ciphertext);
      const blob = new Blob([payload], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `unburdened-backup-${date}.ubk`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus('Backup exported successfully.');
    } catch (err) {
      setExportStatus('Export failed: ' + err.message);
    }
  }

  async function handleImportBackup(file) {
    setImportStatus('Reading backup…');
    try {
      const text = await file.text();
      if (!text.startsWith('UNBURDENED_BACKUP_V1')) {
        setImportStatus('Invalid backup file format.');
        return;
      }
      const body = text.slice(BACKUP_HEADER.length);
      const [ivB64, ciphB64] = body.split('.');
      const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

      const backupPasscode = window.prompt('Enter the passcode used when this backup was created:');
      if (!backupPasscode) { setImportStatus('Import cancelled.'); return; }

      const salt = loadSalt();
      const backupKey = await deriveKey(backupPasscode, salt);

      setImportStatus('Decrypting…');
      let json;
      try {
        const dec = new TextDecoder();
        const plainbuf = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: fromB64(ivB64) },
          backupKey,
          fromB64(ciphB64)
        );
        json = dec.decode(plainbuf);
      } catch {
        setImportStatus('Incorrect passcode for this backup.');
        return;
      }

      const rawData = JSON.parse(json);
      await importAllRaw(rawData);
      setImportStatus('Backup restored successfully.');
    } catch (err) {
      setImportStatus('Import failed: ' + err.message);
    }
    backupFileRef.current.value = '';
  }

  async function handleReset() {
    if (resetConfirm !== 'DELETE') return;
    setResetting(true);
    await clearAllData();
    localStorage.clear();
    window.location.reload();
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2 className="settings-title">Settings</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close settings">✕</button>
      </div>

      <div className="settings-content">

        {/* Profile */}
        <section className="settings-section">
          <h3 className="settings-section-title">Profile</h3>
          <label className="settings-label">Your name</label>
          <div className="settings-row">
            <input
              className="settings-input"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
            />
            <button className="btn btn-outline btn-sm" onClick={saveName} disabled={savingName}>
              {savingName ? 'Saving…' : 'Save'}
            </button>
          </div>
          {nameMsg && <p className="settings-msg">{nameMsg}</p>}

          <label className="settings-label" style={{ marginTop: '1rem' }}>Change passcode</label>
          <input className="settings-input" type="password" placeholder="Current passcode" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} autoComplete="current-password" />
          <input className="settings-input" type="password" placeholder="New passcode" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" />
          <input className="settings-input" type="password" placeholder="Confirm new passcode" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} autoComplete="new-password" />
          <button className="btn btn-outline btn-sm" onClick={handleChangePasscode} disabled={changingPass}>
            {changingPass ? 'Changing…' : 'Change Passcode'}
          </button>
          {passMsg && <p className="settings-msg">{passMsg}</p>}
        </section>

        {/* Appearance */}
        <section className="settings-section">
          <h3 className="settings-section-title">Appearance</h3>
          <label className="settings-label">Theme</label>
          <div className="segmented-control">
            {['system', 'light', 'dark'].map((t) => (
              <button
                key={t}
                className={`segmented-btn ${prefs.theme === t ? 'active' : ''}`}
                onClick={() => setPref('theme', t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {/* Privacy & Security */}
        <section className="settings-section">
          <h3 className="settings-section-title">Privacy & Security</h3>
          <label className="settings-label">Auto-lock after</label>
          <div className="segmented-control segmented-control-wrap">
            {AUTO_LOCK_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`segmented-btn ${autoLockMinutes === o.value ? 'active' : ''}`}
                onClick={() => updateAutoLock(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: '0.75rem' }} onClick={lock}>
            Lock now
          </button>
        </section>

        {/* Accountability */}
        <section className="settings-section">
          <h3 className="settings-section-title">Accountability</h3>
          <label className="settings-label">Default nudge threshold for new areas</label>
          <div className="segmented-control segmented-control-wrap">
            {NUDGE_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`segmented-btn ${prefs.nudgeThresholdDays === o.value ? 'active' : ''}`}
                onClick={() => setPref('nudgeThresholdDays', o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {/* AI Companion */}
        <section className="settings-section">
          <h3 className="settings-section-title">AI Companion</h3>
          <p className="settings-hint">
            {modelDownloaded
              ? `Model installed (${formatBytes(modelSize)})`
              : 'No model installed — import required for AI features.'}
          </p>
          {!showModelDownload ? (
            <button className="btn btn-outline btn-sm" onClick={() => setShowModelDownload(true)}>
              {modelDownloaded ? 'Replace model file' : 'Import model file'}
            </button>
          ) : (
            <ModelLoader
              alreadyInstalled={modelDownloaded}
              onDone={() => { setModelDownloaded(true); setShowModelDownload(false); isModelDownloaded().then(() => getModelSize().then(setModelSize)); }}
              onSkip={() => setShowModelDownload(false)}
            />
          )}
          {!isWebGPUSupported() && (
            <p className="settings-hint settings-hint-warn">WebGPU not supported in this browser. AI features require Chrome on Android or a WebGPU-enabled browser.</p>
          )}
        </section>

        {/* Data */}
        <section className="settings-section">
          <h3 className="settings-section-title">Data</h3>

          <div className="settings-data-row">
            <button className="btn btn-outline btn-sm" onClick={handleExportBackup}>Export encrypted backup</button>
          </div>
          <div className="settings-data-row">
            <label className="btn btn-outline btn-sm" htmlFor="import-backup-input" style={{ cursor: 'pointer' }}>
              Import encrypted backup
            </label>
            <input
              id="import-backup-input"
              ref={backupFileRef}
              type="file"
              accept=".ubk,application/octet-stream,application/x-binary,application/x-ubk"
              style={{ position: 'fixed', top: '-100em', opacity: 0 }}
              onChange={(e) => e.target.files[0] && handleImportBackup(e.target.files[0])}
            />
          </div>
          {(exportStatus || importStatus) && (
            <p className="settings-msg">{exportStatus || importStatus}</p>
          )}

          <div className="settings-data-row" style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline btn-sm" onClick={exportPrefsCSV}>Export preferences CSV</button>
          </div>
          <div className="settings-data-row">
            <label className="btn btn-outline btn-sm" htmlFor="import-prefs-input-ub" style={{ cursor: 'pointer' }}>
              Import preferences CSV
            </label>
            <input
              id="import-prefs-input-ub"
              ref={prefsFileRef}
              type="file"
              accept=".csv,text/csv,text/plain,application/octet-stream,text/comma-separated-values,application/csv"
              style={{ position: 'fixed', top: '-100em', opacity: 0 }}
              onChange={(e) => {
                const f = e.target.files[0];
                if (!f) return;
                f.text().then((t) => {
                  const ok = importPrefsCSV(t);
                  setImportStatus(ok ? 'Preferences imported successfully.' : 'Invalid preferences file.');
                  prefsFileRef.current.value = '';
                });
              }}
            />
          </div>
        </section>

        {/* About */}
        <section className="settings-section">
          <h3 className="settings-section-title">About</h3>
          <p className="settings-about-line"><span>App</span><span>Unburdened</span></p>
          <p className="settings-about-line"><span>Version</span><span>v{appVersion}</span></p>
          <button className="btn btn-outline btn-sm" onClick={handleCheckUpdate} disabled={checkingUpdate}>
            {checkingUpdate ? 'Checking…' : 'Check for Updates'}
          </button>
          {updateMsg && <p className="settings-msg">{updateMsg}</p>}
        </section>

        {/* Danger Zone */}
        <section className="settings-section settings-danger-zone">
          <h3 className="settings-section-title danger-title">Danger Zone</h3>
          <p className="settings-hint">This will permanently erase all your data and cannot be undone.</p>
          <p className="settings-label">Type <strong>DELETE</strong> to confirm:</p>
          <input
            className="settings-input"
            type="text"
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
          <button
            className="btn btn-danger btn-sm"
            onClick={handleReset}
            disabled={resetConfirm !== 'DELETE' || resetting}
          >
            {resetting ? 'Resetting…' : 'Reset app — erase all data'}
          </button>
        </section>

      </div>
    </div>
  );
}
