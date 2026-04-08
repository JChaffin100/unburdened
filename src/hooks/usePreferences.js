import { useState, useEffect, useCallback } from 'react';

const PREFS_KEY = 'unburdened_prefs';

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // QuotaExceededError — silently ignore
  }
}

export function usePreferences() {
  const [prefs, setPrefsState] = useState(() => ({
    theme: 'system',
    nudgeThresholdDays: 3,
    modelDownloaded: false,
    ...loadPrefs(),
  }));

  const setPref = useCallback((key, value) => {
    setPrefsState((prev) => {
      const next = { ...prev, [key]: value };
      savePrefs(next);
      return next;
    });
  }, []);

  // Apply theme to <html>
  useEffect(() => {
    const html = document.documentElement;
    if (prefs.theme === 'system') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', prefs.theme);
    }
  }, [prefs.theme]);

  const exportPrefsCSV = useCallback(() => {
    const rows = [
      ['setting', 'value'],
      ['version', '1.0'],
      ['theme', prefs.theme],
      ['autoLockMinutes', localStorage.getItem('unburdened_autolock') || '10'],
      ['nudgeThresholdDays_default', prefs.nudgeThresholdDays],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unburdened-preferences.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [prefs]);

  const importPrefsCSV = useCallback((text) => {
    try {
      const lines = text.trim().split('\n').slice(1); // skip header
      const map = {};
      for (const line of lines) {
        const [key, value] = line.split(',');
        if (key && value) map[key.trim()] = value.trim();
      }
      if (map.theme) setPref('theme', map.theme);
      if (map.nudgeThresholdDays_default) setPref('nudgeThresholdDays', parseInt(map.nudgeThresholdDays_default, 10));
      if (map.autoLockMinutes) localStorage.setItem('unburdened_autolock', map.autoLockMinutes);
      return true;
    } catch {
      return false;
    }
  }, [setPref]);

  return { prefs, setPref, exportPrefsCSV, importPrefsCSV };
}
