import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useSessions } from '../hooks/useSessions.js';
import { useAreas } from '../hooks/useAreas.js';
import { buildSummaryPrompt } from '../ai/systemPrompts.js';
import { generateText, isLLMReady } from '../ai/inferenceEngine.js';

function generateCommitmentId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function SessionEnd({ area, messages, onDone, onCancel }) {
  const { sessionKey } = useAuth();
  const { saveSession, loadSummary, saveSummary } = useSessions(sessionKey);
  const { updateArea, touchArea, loadAreas } = useAreas(sessionKey);

  const [takeaway, setTakeaway] = useState('');
  const [commitments, setCommitments] = useState(
    (area.commitments || []).map((c) => ({ ...c }))
  );
  const [newCommitmentText, setNewCommitmentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState(''); // '' | 'generating' | 'done' | 'error'

  function toggleCommitment(id) {
    setCommitments((prev) =>
      prev.map((c) => c.id === id ? { ...c, status: c.status === 'active' ? 'resolved' : 'active' } : c)
    );
  }

  function addCommitment() {
    const text = newCommitmentText.trim();
    if (!text) return;
    setCommitments((prev) => [...prev, { id: generateCommitmentId(), text, status: 'active' }]);
    setNewCommitmentText('');
  }

  function removeCommitment(id) {
    setCommitments((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Save session transcript
      await saveSession(area.id, {
        messages,
        takeaway: takeaway.trim(),
        commitments,
      });

      // Update area commitments
      await updateArea(area.id, { commitments });
      await touchArea(area.id);

      // Generate rolling summary if LLM is available
      if (isLLMReady() && messages.length > 0) {
        setSummaryStatus('generating');
        try {
          const previousSummary = await loadSummary(area.id);
          const prompt = buildSummaryPrompt({
            previousSummary,
            transcript: messages,
            commitments,
          });
          const newSummary = await generateText(prompt);
          await saveSummary(area.id, newSummary.trim());
          // Also persist on area for card preview
          await updateArea(area.id, { commitments, rollingsummary: newSummary.trim() });
          setSummaryStatus('done');
        } catch {
          setSummaryStatus('error');
        }
      }

      await loadAreas();
      onDone();
    } catch (err) {
      console.error('Failed to save session', err);
      setSaving(false);
    }
  }

  return (
    <div className="session-end">
      <div className="session-end-header">
        <h2 className="session-end-title">Session Complete</h2>
        <p className="session-end-subtitle">{area.name}</p>
      </div>

      {/* Takeaway */}
      <section className="session-end-section">
        <h3 className="session-end-section-title">Takeaway (optional)</h3>
        <p className="session-end-section-hint">What's one thing you want to remember from this conversation?</p>
        <textarea
          className="session-end-textarea"
          value={takeaway}
          onChange={(e) => setTakeaway(e.target.value)}
          placeholder="Write a personal note…"
          rows={4}
        />
      </section>

      {/* Commitments */}
      <section className="session-end-section">
        <h3 className="session-end-section-title">Commitments</h3>
        <p className="session-end-section-hint">Check off resolved commitments and add new ones.</p>

        <ul className="session-commit-list">
          {commitments.map((c) => (
            <li key={c.id} className={`session-commit-item ${c.status === 'resolved' ? 'resolved' : ''}`}>
              <label className="session-commit-label">
                <input
                  type="checkbox"
                  checked={c.status === 'resolved'}
                  onChange={() => toggleCommitment(c.id)}
                  className="session-commit-check"
                />
                <span className="session-commit-text">{c.text}</span>
              </label>
              <button
                className="icon-btn danger-btn sm"
                onClick={() => removeCommitment(c.id)}
                aria-label="Remove commitment"
              >✕</button>
            </li>
          ))}
        </ul>

        <div className="session-commit-add">
          <input
            className="session-commit-input"
            type="text"
            value={newCommitmentText}
            onChange={(e) => setNewCommitmentText(e.target.value)}
            placeholder="Add a new commitment…"
            onKeyDown={(e) => e.key === 'Enter' && addCommitment()}
          />
          <button className="btn btn-outline btn-sm" onClick={addCommitment}>Add</button>
        </div>
      </section>

      {summaryStatus === 'generating' && (
        <p className="session-summary-status">Generating summary…</p>
      )}
      {summaryStatus === 'error' && (
        <p className="session-summary-status error">Summary generation failed — session saved without updated summary.</p>
      )}

      <div className="session-end-actions">
        <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save and Close'}
        </button>
        <button className="btn btn-ghost btn-full" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
