import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth.jsx';
import { encryptAndStore, fetchAllAndDecrypt, deleteRecord, deleteSessionsByArea } from '../storage/db.js';

const AreasContext = createContext(null);

function generateId() {
  return `area_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AreasProvider({ children }) {
  const { sessionKey } = useAuth();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAreas = useCallback(async () => {
    if (!sessionKey) {
      setAreas([]);
      return;
    }
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
      // Sort: most recently checked in at the bottom (or custom order)
      decoded.sort((a, b) => b.order - a.order);
      setAreas(decoded);
    } catch (err) {
      console.error('Failed to load areas', err);
    } finally {
      setLoading(false);
    }
  }, [sessionKey]);

  // Automatically load areas when session is unlocked
  useEffect(() => {
    if (sessionKey) {
      loadAreas();
    } else {
      setAreas([]);
    }
  }, [sessionKey, loadAreas]);

  const createArea = useCallback(async ({ name, description, persona = 'Balanced', nudgeDays }) => {
    if (!sessionKey) return;
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
    if (!sessionKey) return;
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
    if (!sessionKey) return;
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
    if (!sessionKey) return;
    // newOrder: array of ids in new order
    const now = Date.now();
    for (let i = 0; i < newOrder.length; i++) {
      const area = areas.find((a) => a.id === newOrder[i]);
      if (!area) continue;
      const { id, createdAt, lastCheckinAt, order: _o, ...data } = area;
      await encryptAndStore('areas', sessionKey, id, data, {
        createdAt,
        lastCheckinAt,
        order: now - i,
      });
    }
    await loadAreas();
  }, [sessionKey, areas, loadAreas]);

  return (
    <AreasContext.Provider
      value={{
        areas,
        loading,
        loadAreas,
        createArea,
        updateArea,
        touchArea,
        deleteArea,
        updateCommitments,
        reorderAreas,
      }}
    >
      {children}
    </AreasContext.Provider>
  );
}

export function useAreas() {
  const context = useContext(AreasContext);
  if (!context) {
    throw new Error('useAreas must be used within an AreasProvider');
  }
  return context;
}
