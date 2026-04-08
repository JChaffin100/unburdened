import { useState, useCallback } from 'react';
import {
  encryptAndStore,
  fetchSessionsByArea,
  fetchAndDecrypt,
  deleteRecord,
} from '../storage/db.js';

function generateId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useSessions(sessionKey) {
  const [sessions, setSessions] = useState([]);
  const [loadingArea, setLoadingArea] = useState(null);

  const loadSessions = useCallback(async (areaId) => {
    if (!sessionKey) return;
    setLoadingArea(areaId);
    try {
      const records = await fetchSessionsByArea(sessionKey, areaId);
      setSessions(records.map((r) => ({
        id: r.id,
        areaId: r.areaId,
        createdAt: r.createdAt,
        ...r.data,
      })));
    } catch (err) {
      console.error('Failed to load sessions', err);
    } finally {
      setLoadingArea(null);
    }
  }, [sessionKey]);

  const saveSession = useCallback(async (areaId, { messages, takeaway, commitments }) => {
    const id = generateId();
    const now = Date.now();
    const data = { messages, takeaway, commitments };
    await encryptAndStore('sessions', sessionKey, id, data, {
      areaId,
      createdAt: now,
    });
    return id;
  }, [sessionKey]);

  const deleteSession = useCallback(async (sessionId, areaId) => {
    await deleteRecord('sessions', sessionId);
    if (areaId) await loadSessions(areaId);
  }, [loadSessions]);

  const loadSummary = useCallback(async (areaId) => {
    if (!sessionKey) return null;
    try {
      const record = await fetchAndDecrypt('summaries', sessionKey, areaId);
      return record ? record.data : null;
    } catch {
      return null;
    }
  }, [sessionKey]);

  const saveSummary = useCallback(async (areaId, summaryText) => {
    await encryptAndStore('summaries', sessionKey, areaId, summaryText, {
      updatedAt: Date.now(),
    });
  }, [sessionKey]);

  return { sessions, loadingArea, loadSessions, saveSession, deleteSession, loadSummary, saveSummary };
}
