import { useState } from 'react';
import { PERSONA_LABELS } from '../ai/systemPrompts.js';

export default function AreaForm({ initial, onSave, onCancel, defaultNudgeDays = 3 }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [persona, setPersona] = useState(initial?.persona || 'Balanced');
  const [nudgeDays, setNudgeDays] = useState(initial?.nudgeDays ?? defaultNudgeDays);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const NUDGE_OPTS = [
    { label: '3 days', value: 3 },
    { label: '5 days', value: 5 },
    { label: '1 week', value: 7 },
    { label: '2 weeks', value: 14 },
    { label: 'Off', value: 0 },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter an area name.'); return; }
    if (!description.trim()) { setError('Please describe this accountability area.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), description: description.trim(), persona, nudgeDays });
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="area-form-wrap">
      <div className="area-form-header">
        <h2 className="area-form-title">{initial ? 'Edit Area' : 'New Accountability Area'}</h2>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancel">✕</button>
      </div>

      <form className="area-form" onSubmit={handleSubmit}>
        <label className="form-label">Area name</label>
        <input
          className="form-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Controlling my temper"
          autoFocus
        />

        <label className="form-label">Description</label>
        <p className="form-hint">Describe this area in your own words. This context is shared with your AI companion in every session.</p>
        <textarea
          className="form-input form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this area about? What do you struggle with? What does growth look like for you here?"
          rows={5}
        />

        <label className="form-label">Default AI persona</label>
        <div className="persona-selector">
          {PERSONA_LABELS.map((p) => (
            <button
              key={p}
              type="button"
              className={`persona-option ${persona === p ? 'active' : ''}`}
              onClick={() => setPersona(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <label className="form-label">Check-in nudge</label>
        <p className="form-hint">Remind me to check in after this many days without a session.</p>
        <div className="segmented-control segmented-control-wrap">
          {NUDGE_OPTS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`segmented-btn ${nudgeDays === o.value ? 'active' : ''}`}
              onClick={() => setNudgeDays(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Area'}
          </button>
          <button className="btn btn-ghost btn-full" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
