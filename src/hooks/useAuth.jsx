import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  loadSalt,
  generateAndStoreSalt,
  deriveKey,
  storeVerificationBlob,
  verifyKey,
} from '../crypto/encryption.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessionKey, setSessionKey] = useState(null);
  const [isSetup, setIsSetup] = useState(false); // salt exists = setup done
  const [isLocked, setIsLocked] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState(10);
  const lockTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const salt = loadSalt();
    setIsSetup(!!salt);
    const stored = localStorage.getItem('unburdened_autolock');
    if (stored) setAutoLockMinutes(parseInt(stored, 10) || 10);
  }, []);

  const resetLockTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (autoLockMinutes === 0) return; // "Never"
    lockTimerRef.current = setTimeout(() => {
      lock();
    }, autoLockMinutes * 60 * 1000);
  }, [autoLockMinutes]);

  // Reset timer on user activity
  useEffect(() => {
    if (!sessionKey) return;
    const events = ['click', 'keydown', 'touchstart', 'mousemove'];
    const handler = () => resetLockTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetLockTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, [sessionKey, resetLockTimer]);

  // Lock on visibility change / page hide
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && sessionKey) {
        const elapsed = Date.now() - lastActivityRef.current;
        if (autoLockMinutes > 0 && elapsed > autoLockMinutes * 60 * 1000) {
          lock();
        }
      }
    };
    const handlePageHide = () => {
      if (sessionKey && autoLockMinutes > 0) lock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [sessionKey, autoLockMinutes]);

  /** Attempt to unlock with passcode. Returns true on success. */
  const unlock = useCallback(async (passcode) => {
    const salt = loadSalt();
    if (!salt) return false;
    try {
      const key = await deriveKey(passcode, salt);
      const valid = await verifyKey(key);
      if (!valid) return false;
      setSessionKey(key);
      setIsLocked(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  /** First-time setup: generate salt, derive key, store verification blob. */
  const setup = useCallback(async (passcode) => {
    const salt = generateAndStoreSalt();
    const key = await deriveKey(passcode, salt);
    await storeVerificationBlob(key);
    setSessionKey(key);
    setIsSetup(true);
    setIsLocked(false);
    return key;
  }, []);

  /** Change passcode: requires current passcode verification, then re-derives. */
  const changePasscode = useCallback(async (currentPasscode, newPasscode) => {
    const valid = await unlock(currentPasscode);
    if (!valid) return false;
    const salt = loadSalt();
    const newKey = await deriveKey(newPasscode, salt);
    await storeVerificationBlob(newKey);
    setSessionKey(newKey);
    return newKey;
  }, [unlock]);

  const lock = useCallback(() => {
    setSessionKey(null);
    setIsLocked(true);
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
  }, []);

  const updateAutoLock = useCallback((minutes) => {
    setAutoLockMinutes(minutes);
    localStorage.setItem('unburdened_autolock', String(minutes));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        sessionKey,
        isSetup,
        isLocked,
        autoLockMinutes,
        unlock,
        setup,
        changePasscode,
        lock,
        updateAutoLock,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
