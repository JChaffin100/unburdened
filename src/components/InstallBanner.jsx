import { useState, useEffect } from 'react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') || '';

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOSSafari() {
  return isIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios|opios/i.test(navigator.userAgent);
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(window.deferredInstallPrompt);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (isInStandalone()) return;
    if (sessionStorage.getItem('install_dismissed')) return;

    // Check if we already have a prompt captured
    if (window.deferredInstallPrompt) {
      setDeferredPrompt(window.deferredInstallPrompt);
      setShowAndroid(true);
      return;
    }

    if (isIOSSafari()) {
      setShowIOS(true);
      return;
    }

    // Listen for the prompt if it hasn't fired yet
    const handlePrompt = () => {
      setDeferredPrompt(window.deferredInstallPrompt);
      setShowAndroid(true);
    };

    window.addEventListener('pwa-prompt-available', handlePrompt);
    // Legacy support for direct event if standard listener is still needed
    const directHandler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroid(true);
    };
    window.addEventListener('beforeinstallprompt', directHandler);

    return () => {
      window.removeEventListener('pwa-prompt-available', handlePrompt);
      window.removeEventListener('beforeinstallprompt', directHandler);
    };
  }, []);

  function dismiss() {
    sessionStorage.setItem('install_dismissed', '1');
    setShowAndroid(false);
    setShowIOS(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      window.deferredInstallPrompt = null;
      setDeferredPrompt(null);
    }
    dismiss();
  }

  if (showAndroid) {
    return (
      <div className="install-banner" role="banner">
        <div className="install-banner-content">
          <img src={`${BASE}/icons/icon-72.png`} alt="" className="install-banner-icon" />
          <p className="install-banner-text">Install Unburdened for the best experience</p>
        </div>
        <div className="install-banner-actions">
          <button className="btn btn-gold btn-sm" onClick={handleInstall}>Install</button>
          <button className="btn btn-ghost btn-sm" onClick={dismiss}>Not now</button>
        </div>
      </div>
    );
  }

  if (showIOS) {
    return (
      <div className="install-banner install-banner-ios" role="banner">
        <div className="install-banner-content">
          <p className="install-banner-text">
            Tap <strong>Share ↑</strong> then <strong>"Add to Home Screen"</strong> to install Unburdened
          </p>
        </div>
        <button className="install-banner-close" onClick={dismiss} aria-label="Dismiss">✕</button>
      </div>
    );
  }

  return null;
}

