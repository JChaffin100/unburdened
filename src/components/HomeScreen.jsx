import { useEffect, useRef, useState } from 'react';
import Sortable from 'sortablejs';
import { useAuth } from '../hooks/useAuth.jsx';
import { useAreas } from '../hooks/useAreas.jsx';
import { fetchAndDecrypt } from '../storage/db.js';
import AreaCard from './AreaCard.jsx';
import { isModelDownloaded } from '../ai/modelManager.js';

function getGreeting(name) {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return `Good morning, ${name}`;
  if (h >= 12 && h < 17) return `Good afternoon, ${name}`;
  if (h >= 17 && h < 21) return `Good evening, ${name}`;
  return `It's late, ${name}. I'm here.`;
}

export default function HomeScreen({ onOpenArea, onOpenSettings, onNewArea }) {
  const { sessionKey, lock } = useAuth();
  const { areas, loading, loadAreas, reorderAreas } = useAreas(sessionKey);
  const [userName, setUserName] = useState('');
  const [modelReady, setModelReady] = useState(true);
  const [modelBannerDismissed, setModelBannerDismissed] = useState(false);
  const listRef = useRef(null);
  const sortableRef = useRef(null);

  useEffect(() => {
    // Load user name
    fetchAndDecrypt('profile', sessionKey, 'user').then((rec) => {
      if (rec?.data?.name) setUserName(rec.data.name);
    }).catch(() => {});
    // Check model
    isModelDownloaded().then(setModelReady).catch(() => setModelReady(false));
  }, [sessionKey]);

  // Set up SortableJS
  useEffect(() => {
    if (!listRef.current || areas.length === 0) return;
    if (sortableRef.current) sortableRef.current.destroy();
    sortableRef.current = Sortable.create(listRef.current, {
      animation: 150,
      handle: '.area-drag-handle',
      onEnd: async (evt) => {
        const ids = [...listRef.current.querySelectorAll('[data-area-id]')].map((el) => el.dataset.areaId);
        await reorderAreas(ids);
      },
    });
    return () => { if (sortableRef.current) sortableRef.current.destroy(); };
  }, [areas.length]);

  return (
    <div className="home-screen">
      <header className="home-header">
        <div className="home-greeting">
          <h1 className="home-greeting-text">{getGreeting(userName || 'friend')}</h1>
        </div>
        <div className="home-header-actions">
          <button className="icon-btn" onClick={lock} title="Lock app" aria-label="Lock">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
          <button className="icon-btn" onClick={onOpenSettings} title="Settings" aria-label="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {!modelReady && !modelBannerDismissed && (
        <div className="model-missing-banner">
          <p>AI companion not available — <button className="link-btn" onClick={onOpenSettings}>download the model</button> to enable chat.</p>
          <button className="icon-btn sm" onClick={() => setModelBannerDismissed(true)} aria-label="Dismiss">✕</button>
        </div>
      )}

      <div className="home-content">
        {loading && areas.length === 0 ? (
          <div className="home-loading">Loading…</div>
        ) : areas.length === 0 ? (
          <div className="home-empty">
            <p className="home-empty-text">You have no accountability areas yet.</p>
            <p className="home-empty-sub">Add your first area to get started on your journey.</p>
            <button className="btn btn-primary" onClick={onNewArea}>+ Add First Area</button>
          </div>
        ) : (
          <ul className="area-list" ref={listRef}>
            {areas.map((area) => (
              <li key={area.id} data-area-id={area.id} className="area-list-item">
                <AreaCard
                  area={area}
                  onClick={() => onOpenArea(area.id)}
                  dragHandle={null}
                />
              </li>
            ))}
          </ul>
        )}

        {areas.length > 0 && (
          <button className="btn btn-outline btn-full new-area-btn" onClick={onNewArea}>
            + New Area
          </button>
        )}
      </div>
    </div>
  );
}
