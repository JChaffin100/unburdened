import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth.jsx';
import { useAreas } from './hooks/useAreas.jsx';
import { usePreferences } from './hooks/usePreferences.js';
import { fetchAndDecrypt } from './storage/db.js';

import LockScreen from './components/LockScreen.jsx';
import SetupWizard from './components/SetupWizard.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import AreaDetail from './components/AreaDetail.jsx';
import AreaForm from './components/AreaForm.jsx';
import ChatSession from './components/ChatSession.jsx';
import SessionEnd from './components/SessionEnd.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import InstallBanner from './components/InstallBanner.jsx';

// Screen states
const SCREEN = {
  LOCK: 'lock',
  SETUP: 'setup',
  HOME: 'home',
  AREA_DETAIL: 'area_detail',
  AREA_FORM: 'area_form',
  CHAT: 'chat',
  SESSION_END: 'session_end',
  SETTINGS: 'settings',
};

export default function App() {
  const { sessionKey, isSetup, isLocked, lock } = useAuth();
  const { prefs } = usePreferences();
  const { areas, loadAreas, createArea, updateArea } = useAreas(sessionKey);

  const [screen, setScreen] = useState(SCREEN.LOCK);
  const [activeAreaId, setActiveAreaId] = useState(null);
  const [editingAreaId, setEditingAreaId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatArea, setChatArea] = useState(null);

  // Auth state machine: only show app content after successful unlock
  useEffect(() => {
    if (isLocked || !sessionKey) {
      setScreen(isSetup ? SCREEN.LOCK : SCREEN.LOCK);
      return;
    }
    // Authenticated
    if (!isSetup) {
      setScreen(SCREEN.SETUP);
    } else if (screen === SCREEN.LOCK || screen === SCREEN.SETUP) {
      setScreen(SCREEN.HOME);
    }
  }, [isLocked, sessionKey, isSetup]);

  // On setup complete, go home
  function handleSetupComplete() {
    setScreen(SCREEN.HOME);
  }

  // Navigation helpers
  function goHome() { setScreen(SCREEN.HOME); setActiveAreaId(null); }

  function openArea(areaId) {
    setActiveAreaId(areaId);
    setScreen(SCREEN.AREA_DETAIL);
  }

  function openNewArea() {
    setEditingAreaId(null);
    setScreen(SCREEN.AREA_FORM);
  }

  function openEditArea(areaId) {
    setEditingAreaId(areaId);
    setScreen(SCREEN.AREA_FORM);
  }

  async function handleSaveArea(data) {
    if (editingAreaId) {
      await updateArea(editingAreaId, data);
      setScreen(SCREEN.AREA_DETAIL);
    } else {
      const newId = await createArea({ ...data, nudgeDays: data.nudgeDays ?? prefs.nudgeThresholdDays });
      setActiveAreaId(newId);
      setScreen(SCREEN.AREA_DETAIL);
    }
  }

  function startSession(areaId) {
    const area = areas.find((a) => a.id === areaId);
    if (!area) return;
    setChatArea(area);
    setChatMessages([]);
    setScreen(SCREEN.CHAT);
  }

  function endSession(messages, persona) {
    // Attach persona to area for display
    setChatMessages(messages);
    setScreen(SCREEN.SESSION_END);
  }

  function handleSessionDone() {
    loadAreas();
    setScreen(SCREEN.AREA_DETAIL);
  }

  // Lock screen and setup wizard are rendered before any app content
  if (!sessionKey || isLocked) {
    if (!isSetup) {
      // First launch: show lock screen until setup is triggered
      // Actually for first launch we show the setup wizard directly
      return <SetupWizard onComplete={handleSetupComplete} />;
    }
    return <LockScreen />;
  }

  const editingArea = editingAreaId ? areas.find((a) => a.id === editingAreaId) : null;

  return (
    <div className="app">
      {screen === SCREEN.HOME && (
        <>
          <HomeScreen
            onOpenArea={openArea}
            onOpenSettings={() => setScreen(SCREEN.SETTINGS)}
            onNewArea={openNewArea}
          />
        </>
      )}

      {screen === SCREEN.AREA_DETAIL && activeAreaId && (
        <AreaDetail
          areaId={activeAreaId}
          onBack={goHome}
          onStartSession={startSession}
          onEditArea={openEditArea}
        />
      )}

      {screen === SCREEN.AREA_FORM && (
        <AreaForm
          initial={editingArea}
          defaultNudgeDays={prefs.nudgeThresholdDays}
          onSave={handleSaveArea}
          onCancel={() => setScreen(editingAreaId ? SCREEN.AREA_DETAIL : SCREEN.HOME)}
        />
      )}

      {screen === SCREEN.CHAT && chatArea && (
        <ChatSession
          area={chatArea}
          onEndSession={endSession}
          onBack={() => setScreen(SCREEN.AREA_DETAIL)}
        />
      )}

      {screen === SCREEN.SESSION_END && chatArea && (
        <SessionEnd
          area={chatArea}
          messages={chatMessages}
          onDone={handleSessionDone}
          onCancel={() => setScreen(SCREEN.CHAT)}
        />
      )}

      {screen === SCREEN.SETTINGS && (
        <SettingsPanel
          onClose={goHome}
          onLock={() => { lock(); }}
        />
      )}
      <InstallBanner />
    </div>
  );
}
