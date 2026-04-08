import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useAreas } from '../hooks/useAreas.js';
import { useSessions } from '../hooks/useSessions.js';
import { fetchAllAndDecrypt } from '../storage/db.js';

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AreaDetail({ areaId, onBack, onStartSession, onEditArea }) {
  const { sessionKey } = useAuth();
  const { areas, loadAreas, deleteArea } = useAreas(sessionKey);
  const { sessions, loadSessions, deleteSession } = useSessions(sessionKey);
  const [area, setArea] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [commitExpanded, setCommitExpanded] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const [confirmDeleteArea, setConfirmDeleteArea] = useState(false);
  const [deletingSession, setDeletingSession] = useState(null);

  useEffect(() => {
    loadAreas();
    loadSessions(areaId);
  }, [areaId]);

  useEffect(() => {
    const found = areas.find((a) => a.id === areaId);
    setArea(found || null);
  }, [areas, areaId]);

  async function handleDeleteArea() {
    await deleteArea(areaId);
    onBack();
  }

  async function handleDeleteSession(sessionId) {
    await deleteSession(sessionId, areaId);
    setDeletingSession(null);
  }

  if (!area) {
    return (
      <div className="area-detail">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="loading-text">Loading…</div>
      </div>
    );
  }

  const activeCommitments = (area.commitments || []).filter((c) => c.status === 'active');

  return (
    <div className="area-detail">
      <div className="area-detail-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="area-detail-title-row">
          <h2 className="area-detail-name">{area.name}</h2>
          <button className="icon-btn" onClick={() => onEditArea(areaId)} aria-label="Edit area">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <span className="area-persona-badge">{area.persona}</span>
      </div>

      {/* Description */}
      <section className="area-section">
        <button className="area-section-toggle" onClick={() => setDescExpanded(!descExpanded)}>
          <span>About this area</span>
          <span>{descExpanded ? '▲' : '▼'}</span>
        </button>
        {descExpanded && (
          <p className="area-description">{area.description || 'No description.'}</p>
        )}
      </section>

      {/* Commitments */}
      <section className="area-section">
        <button className="area-section-toggle" onClick={() => setCommitExpanded(!commitExpanded)}>
          <span>Active commitments ({activeCommitments.length})</span>
          <span>{commitExpanded ? '▲' : '▼'}</span>
        </button>
        {commitExpanded && (
          <ul className="commitment-list">
            {activeCommitments.length === 0 && (
              <li className="commitment-empty">No active commitments yet.</li>
            )}
            {activeCommitments.map((c) => (
              <li key={c.id} className="commitment-item">
                <span className="commitment-dot" />
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Begin Session */}
      <button className="btn btn-primary btn-full begin-session-btn" onClick={() => onStartSession(areaId)}>
        Begin New Session
      </button>

      {/* Past Sessions */}
      <section className="area-section sessions-section">
        <h3 className="sessions-heading">Past Sessions ({sessions.length})</h3>
        {sessions.length === 0 && (
          <p className="sessions-empty">No sessions yet. Begin your first conversation above.</p>
        )}
        <ul className="session-list">
          {sessions.map((s) => {
            const preview = s.messages?.[0]?.content?.slice(0, 80) || 'Session';
            const isExpanded = expandedSession === s.id;
            return (
              <li key={s.id} className="session-item">
                <div className="session-item-header" onClick={() => setExpandedSession(isExpanded ? null : s.id)}>
                  <div>
                    <span className="session-date">{formatDate(s.createdAt)}</span>
                    {!isExpanded && <p className="session-preview">{preview}…</p>}
                  </div>
                  <div className="session-item-actions">
                    <span className="session-expand-icon">{isExpanded ? '▲' : '▼'}</span>
                    <button
                      className="icon-btn danger-btn sm"
                      onClick={(e) => { e.stopPropagation(); setDeletingSession(s.id); }}
                      aria-label="Delete session"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="session-transcript">
                    {(s.messages || []).map((msg, i) => (
                      <div key={i} className={`transcript-msg transcript-msg-${msg.role}`}>
                        <span className="transcript-sender">{msg.role === 'user' ? 'You' : 'Your companion'}</span>
                        <p className="transcript-text">{msg.content}</p>
                      </div>
                    ))}
                    {s.takeaway && (
                      <div className="session-takeaway">
                        <span className="takeaway-label">Takeaway</span>
                        <p>{s.takeaway}</p>
                      </div>
                    )}
                  </div>
                )}
                {deletingSession === s.id && (
                  <div className="delete-confirm">
                    <p>Delete this session?</p>
                    <div className="delete-confirm-actions">
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSession(s.id)}>Delete</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDeletingSession(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Danger zone */}
      <section className="area-danger-zone">
        {!confirmDeleteArea ? (
          <button className="btn btn-danger-outline btn-sm" onClick={() => setConfirmDeleteArea(true)}>
            Delete this area
          </button>
        ) : (
          <div className="delete-confirm">
            <p>Delete "<strong>{area.name}</strong>" and all its data?</p>
            <div className="delete-confirm-actions">
              <button className="btn btn-danger btn-sm" onClick={handleDeleteArea}>Delete permanently</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteArea(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
