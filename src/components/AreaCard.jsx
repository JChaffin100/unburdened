import { useMemo } from 'react';

function relativeDays(timestamp) {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function AreaCard({ area, onClick, dragHandle }) {
  const isOverdue = useMemo(() => {
    if (!area.lastCheckinAt) return area.nudgeDays > 0;
    const days = Math.floor((Date.now() - area.lastCheckinAt) / (1000 * 60 * 60 * 24));
    return area.nudgeDays > 0 && days >= area.nudgeDays;
  }, [area]);

  const summaryPreview = useMemo(() => {
    if (!area.rollingsummary) return null;
    const first = area.rollingsummary.split('.')[0];
    return first.length > 80 ? first.slice(0, 80) + '…' : first + '.';
  }, [area.rollingsum]);

  return (
    <div className={`area-card ${isOverdue ? 'area-card-overdue' : ''}`} onClick={onClick}>
      <div className="area-card-header">
        <div className="area-card-left">
          {dragHandle && <span className="area-drag-handle" {...dragHandle}>⠿</span>}
          <div>
            <h3 className="area-card-name">{area.name}</h3>
            <span className="area-persona-badge">{area.persona}</span>
          </div>
        </div>
        <div className="area-card-right">
          {isOverdue && <span className="area-nudge-dot" title="Check-in due" />}
          <span className="area-checkin-date">{relativeDays(area.lastCheckinAt)}</span>
        </div>
      </div>
      {summaryPreview && (
        <p className="area-summary-preview">{summaryPreview}</p>
      )}
      <div className="area-card-footer">
        <span className="area-commitments-count">
          {(area.commitments || []).filter((c) => c.status === 'active').length} active commitment{
            (area.commitments || []).filter((c) => c.status === 'active').length !== 1 ? 's' : ''
          }
        </span>
      </div>
    </div>
  );
}
