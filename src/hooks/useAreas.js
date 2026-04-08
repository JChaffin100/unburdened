import { useState, useCallback } from 'react';
import { encryptAndStore, fetchAllAndDecrypt, deleteRecord, deleteSessionsByArea } from '../storage/db.js';

function generateId() {
  return `area_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useAreas(sessionKey) {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAreas = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    try {
      const records = await fetchAllAndDecrypt('areas', sessionKey);
      const decoded = records.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        lastCheckinAt: r.lastCheckinAt,
        order: r.order ?? 0,
        ...r.data,
      }));
      decoded.sort((a, b) => (a.lastCheckinAt || 0) - (b.lastCheckinAt || 0));
      setAreas(decoded);
    } catch (err) {
      console.error('Failed to load areas', err);
    } finally {
      setLoading(false);
    }
  }, [sessionKey]);

  const createArea = useCallback(async ({ name, description, persona = 'Balanced', nudgeDays }) => {
    const id = generateId();
    const now = Date.now();
    const data = { name, description, persona, commitments: [], nudgeDays: nudgeDays ?? 3 };
    await encryptAndStore('areas', sessionKey, id, data, {
      createdAt: now,
      lastCheckinAt: null,
      order: now,
    });
    await loadAreas();
    return id;
  }, [sessionKey, loadAreas]);

  const updateArea = useCallback(async (id, updates) => {
    const existing = areas.find((a) => a.id === id);
    if (!existing) return;
    const { id: _id, createdAt, lastCheckinAt, order, ...data } = existing;
    const newData = { ...data, ...updates };
    await encryptAndStore('areas', sessionKey, id, newData, {
      createdAt,
      lastCheckinAt,
      order,
    });
    await loadAreas();
  }, [sessionKey, areas, loadAreas]);

  const touchArea = useCallback(async (id) => {
    const existing = areas.find((a) => a.id === id);
    if (!existing) return;
    const { id: _id, createdAt, order, lastCheckinAt: _lc, ...data } = existing;
    await encryptAndStore('areas', sessionKey, id, data, {
      createdAt,
      lastCheckinAt: Date.now(),
      order,
    });
    await loadAreas();
  }, [sessionKey, areas, loadAreas]);

  const deleteArea = useCallback(async (id) => {
    await deleteRecord('areas', id);
    await deleteRecord('summaries', id);
    await deleteSessionsByArea(id);
    await loadAreas();
  }, [loadAreas]);

  const updateCommitments = useCallback(async (areaId, commitments) => {
    await updateArea(areaId, { commitments });
  }, [updateArea]);

  const reorderAreas = useCallback(async (newOrder) => {
    // newOrder: array of ids in new order
    const now = Date.now();
    for (let i = 0; i < newOrder.length; i++) {
      const area = areas.find((a) => a.id === newOrder[i]);
      if (!area) continue;
      const { id, createdAt, lastCheckinAt, order: _o, ...data } = area;
      await encryptAndStore('areas', sessionKey, id, data, {
        createdAt,
        lastCheckinAt,
        order: now - i, // descending order values
      });
    }
    await loadAreas();
  }, [sessionKey, areas, loadAreas]);

  return { areas, loading, loadAreas, createArea, updateArea, touchArea, deleteArea, updateCommitments, reorderAreas };
}
