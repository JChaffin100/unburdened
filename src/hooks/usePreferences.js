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
    // Helper to escape CSV values (wrap in quotes if contains comma/quote/newline, escape internal quotes)
    const esc = (val) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [
      ['setting', 'value'],
      ['version', '1.0'],
      ['theme', prefs.theme],
      ['autoLockMinutes', localStorage.getItem('unburdened_autolock') || '10'],
      ['nudgeThresholdDays_default', prefs.nudgeThresholdDays],
    ];

    // Build CSV with escaped values and Windows line endings (\r\n)
    const csvContent = rows.map(row => row.map(esc).join(',')).join('\r\n');

    // Add UTF-8 BOM (\uFEFF) for Excel/Windows compatibility
    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'unburdened-preferences.csv';
    a.style.display = 'none';
    document.body.appendChild(a);

    a.click();

    // Clean up with a 1-second delay to ensure the OS finishes the download handoff
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1000);
  }, [prefs]);

  const importPrefsCSV = useCallback((text) => {
    try {
      if (!text) return false;

      // Strip UTF-8 BOM if present
      const cleanText = text.replace(/^\uFEFF/, '');

      // Split by any newline format (Windows/Mac/Linux)
      const lines = cleanText.split(/\r?\n/);
      
      // Basic RFC 4180 CSV line parser
      const parseLine = (line) => {
        const parts = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++; // skip next quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            parts.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current);
        return parts.map(p => p.trim());
      };

      const rows = lines.filter(l => l.trim()).map(parseLine);
      if (rows.length < 1) return false;

      // Relaxed header check
      const header = rows[0];
      if (header[0]?.toLowerCase() !== 'setting' || header[1]?.toLowerCase() !== 'value') {
        return false;
      }

      const map = {};
      for (let i = 1; i < rows.length; i++) {
        const [key, value] = rows[i];
        if (key) map[key] = value;
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
