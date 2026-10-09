import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Users,
  Sparkles,
  BookOpen,
  Play,
  ArrowRight,
  RotateCcw,
  X,
  Tv,
} from 'lucide-react';
import { ROLES } from './shared/roles.js';
import { ArtDecoCardBack, RoleCard } from './components/RoleBadge.jsx';
import SingleDeviceMode from './components/SingleDeviceMode.jsx';
import MultiDeviceMode from './components/MultiDeviceMode.jsx';
import TvTheaterMode from './components/TvTheaterMode.jsx';

const APP_NAV_STORAGE_KEY = 'mafia_app_nav_v1';
const SINGLE_DEVICE_STORAGE_KEY = 'mafia_single_device_state_v1';
const STORAGE_ROOM_KEY = 'mafia_host_room_state_v1';

function getSavedSingleDeviceSummary() {
  try {
    const raw = localStorage.getItem(SINGLE_DEVICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.phase || parsed.phase === 'SETUP') return null;
    return {
      phase: parsed.phase,
      round: parsed.round || 1,
      citizenCount: Array.isArray(parsed.activeCitizens)
        ? parsed.activeCitizens.length
        : 0,
    };
  } catch {
    return null;
  }
}

function getSavedHostRoomSummary() {
  try {
    const raw = sessionStorage.getItem(STORAGE_ROOM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.code || !parsed.hostId) return null;
    const hostPlayer = Array.isArray(parsed.players)
      ? parsed.players.find((p) => p.id === parsed.hostId)
      : null;
    return {
      code: parsed.code,
      phase: parsed.phase || 'LOBBY',
      round: parsed.round || 0,
      hostName: hostPlayer?.name || 'Host',
      playerCount: Array.isArray(parsed.players) ? parsed.players.length : 1,
    };
  } catch {
    return null;
  }
}

function getUrlRoomInviteCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('room') || '').toUpperCase().trim();
    return code.length === 4 ? code : '';
  } catch {
    return '';
  }
}

function getUrlTvCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('tv') || '').toUpperCase().trim();
    return code.length === 4 ? code : '';
  } catch {
    return '';
  }
}

function clearUrlRoomInviteParam() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('room') || url.searchParams.has('tv')) {
      url.searchParams.delete('room');
      url.searchParams.delete('tv');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch {
    // Ignore URL errors
  }
}

function loadSavedNavState() {
  const urlTv = getUrlTvCode();
  if (urlTv) {
    return { mode: 'TV_THEATER', tvCode: urlTv, multiAction: null, urlRoom: '' };
  }

  const urlRoom = getUrlRoomInviteCode();
  if (urlRoom) {
    return { mode: 'HOME', multiAction: null, urlRoom, tvCode: '' };
  }

  // When visiting the root path, ALWAYS land on the Home page.
  // Active games can be cleanly resumed via the quick return banner on the Home page.
  return { mode: 'HOME', multiAction: null, urlRoom: '', tvCode: '' };
}

export default function App() {
  const [savedNav] = useState(() => loadSavedNavState());
  const [mode, setMode] = useState(savedNav.mode);
  const [multiAction, setMultiAction] = useState(savedNav.multiAction);
  const [invitedRoomCode, setInvitedRoomCode] = useState(savedNav.urlRoom || '');

  const [hostName, setHostName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState(savedNav.urlRoom || savedNav.tvCode || '');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [dossierModalTab, setDossierModalTab] = useState('ROLES'); // 'ROLES' | 'RULES'
  const [selectedDossierRole, setSelectedDossierRole] = useState('MAFIA');
  const swipeStartRef = useRef({ x: null, y: null });

  useEffect(() => {
    try {
      if (mode === 'HOME') {
        sessionStorage.removeItem(APP_NAV_STORAGE_KEY);
        localStorage.removeItem(APP_NAV_STORAGE_KEY);
      } else {
        const payload = JSON.stringify({
          mode,
          multiAction,
          tvCode: mode === 'TV_THEATER' ? (savedNav.tvCode || joinCode) : '',
        });
        sessionStorage.setItem(APP_NAV_STORAGE_KEY, payload);
      }
    } catch {
      // Ignore storage errors
    }
  }, [mode, multiAction, savedNav.tvCode, joinCode]);

  // Initialize & listen to browser history so Back button returns to Front Page
  useEffect(() => {
    const initialMode = savedNav.mode || 'HOME';
    if (initialMode !== 'HOME') {
      if (window.history.state?.mode !== initialMode) {
        window.history.replaceState({ mode: 'HOME', showRulesModal: false }, '');
        window.history.pushState({ mode: initialMode, showRulesModal: false }, '');
      }
    } else if (!window.history.state || !window.history.state.mode) {
      window.history.replaceState({ mode: 'HOME', showRulesModal: false }, '');
    }

    const handlePopState = (e) => {
      const st = e.state;
      if (!st) {
        setShowRulesModal(false);
        setMode('HOME');
        return;
      }
      setShowRulesModal(Boolean(st.showRulesModal));
      setMode(st.mode || 'HOME');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [savedNav.mode]);

  const openDossierModal = (roleKey = null, tab = 'ROLES') => {
    if (roleKey) setSelectedDossierRole(roleKey);
    setDossierModalTab(tab);
    if (!showRulesModal) {
      window.history.pushState({ mode: 'HOME', showRulesModal: true }, '');
      setShowRulesModal(true);
    }
  };

  const closeDossierModal = () => {
    setShowRulesModal(false);
    if (window.history.state?.showRulesModal) {
      window.history.back();
    }
  };

  const enterSingleDevice = () => {
    clearUrlRoomInviteParam();
    setInvitedRoomCode('');
    setShowRulesModal(false);
    setMode('SINGLE_DEVICE');
    window.history.pushState({ mode: 'SINGLE_DEVICE', showRulesModal: false }, '');
  };

  const resetAndEnterSingleDevice = () => {
    try {
      const raw = localStorage.getItem(SINGLE_DEVICE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Keep their custom player roster and settings, but reset phase to SETUP
        const resetState = {
          players: parsed.players,
          gmMode: parsed.gmMode,
          assignedGmId: parsed.assignedGmId,
          settings: parsed.settings,
          gamesDealtCount: parsed.gamesDealtCount || 0,
          phase: 'SETUP',
        };
        localStorage.setItem(SINGLE_DEVICE_STORAGE_KEY, JSON.stringify(resetState));
      }
    } catch {
      localStorage.removeItem(SINGLE_DEVICE_STORAGE_KEY);
    }
    enterSingleDevice();
  };

  const enterMultiDevice = (action) => {
    clearUrlRoomInviteParam();
    setInvitedRoomCode('');
    setShowRulesModal(false);
    setMultiAction(action);
    setMode('MULTI_DEVICE');
    window.history.pushState({ mode: 'MULTI_DEVICE', showRulesModal: false }, '');
  };

  const navigateBackHome = () => {
    clearUrlRoomInviteParam();
    setInvitedRoomCode('');
    setShowRulesModal(false);
    setMode('HOME');
    setMultiAction(null);
    try {
      sessionStorage.removeItem(APP_NAV_STORAGE_KEY);
      localStorage.removeItem(APP_NAV_STORAGE_KEY);
    } catch {}
    if (window.history.state?.mode && window.history.state.mode !== 'HOME') {
      window.history.back();
    }
  };

  const dossierRoleOrder = [
    'MAFIA',
    'GODFATHER',
    'DETECTIVE',
    'DOCTOR',
    'VILLAGER',
    'GAMEMASTER',
  ];

  const stepDossierRole = (delta) => {
    setSelectedDossierRole((prev) => {
      const idx = dossierRoleOrder.indexOf(prev);
      const nextIdx =
        (idx + delta + dossierRoleOrder.length) % dossierRoleOrder.length;
      return dossierRoleOrder[nextIdx];
    });
  };

  useEffect(() => {
    if (!showRulesModal) return;
    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight' && dossierModalTab === 'ROLES') {
        stepDossierRole(1);
      } else if (e.key === 'ArrowLeft' && dossierModalTab === 'ROLES') {
        stepDossierRole(-1);
      } else if (e.key === 'Escape') {
        closeDossierModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showRulesModal, dossierModalTab]);

  if (mode === 'TV_THEATER') {
    return (
      <TvTheaterMode
        roomCode={savedNav.tvCode || joinCode}
        onExit={navigateBackHome}
        onSwitchToPlayer={({ roomCode: code, playerName }) => {
          enterMultiDevice({
            type: 'join',
            code,
            name: playerName,
          });
        }}
      />
    );
  }

  if (mode === 'SINGLE_DEVICE') {
    return <SingleDeviceMode onBackHome={navigateBackHome} />;
  }

  if (mode === 'MULTI_DEVICE' && multiAction) {
    return (
      <MultiDeviceMode
        initialAction={multiAction}
        onUpdateAction={setMultiAction}
        onBackHome={navigateBackHome}
      />
    );
  }

  const handleCreateRoom = (e) => {
    e.preventDefault();
    enterMultiDevice({
      type: 'create',
      name: hostName.trim() || 'Host',
    });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    enterMultiDevice({
      type: 'join',
      name: joinName.trim() || 'Player',
      code: joinCode.trim().toUpperCase(),
    });
  };

  const handleLaunchTvRoom = (e) => {
    if (e) e.preventDefault();
    if (!joinCode || joinCode.trim().length < 4) return;
    const code = joinCode.trim().toUpperCase();
    clearUrlRoomInviteParam();
    setInvitedRoomCode('');
    setShowRulesModal(false);
    setMode('TV_THEATER');
    setJoinCode(code);
    window.history.pushState({ mode: 'TV_THEATER', tvCode: code, showRulesModal: false }, '');
  };

  return (
    <div className="min-h-screen bg-noir-gradient text-[#f5efe2] flex flex-col justify-between">
      {/* Hero Header */}
      <header className="max-w-6xl mx-auto w-full px-4 pt-8 pb-4 text-center space-y-4">
        <h1 className="text-4xl sm:text-6xl font-serif-title font-black tracking-[0.14em] uppercase text-[#f5efe2] drop-shadow-[0_6px_25px_rgba(0,0,0,0.9)]">
          MAFIA <span className="text-[#c6a15b]">//</span> SYNDICATE
        </h1>

        <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto">
          Rain-slicked cobblestones, secret syndicates, and deadly alibis. Choose how your
          table wants to convene tonight:
        </p>

        {/* Direct Room Invite Banner when opened via ?room=ABCD */}
        {invitedRoomCode && (
          <div className="max-w-xl mx-auto mt-4 rounded-2xl deco-panel p-5 sm:p-6 border-2 border-[#e5c365] shadow-[0_0_35px_rgba(198,161,91,0.25)] text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-serif-title font-bold uppercase tracking-[0.18em] text-[#e5c365] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#c6a15b]" />
                Direct Table Invitation • Room {invitedRoomCode}
              </span>
              <button
                type="button"
                onClick={() => {
                  clearUrlRoomInviteParam();
                  setInvitedRoomCode('');
                }}
                className="text-stone-400 hover:text-white p-1"
                title="Dismiss invitation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-stone-200">
              You&apos;ve been invited to join Room <strong className="font-mono text-[#e5c365]">{invitedRoomCode}</strong>. Enter your name below to take your seat:
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enterMultiDevice({
                  type: 'join',
                  name: joinName.trim() || 'Player',
                  code: invitedRoomCode,
                });
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <input
                type="text"
                autoFocus
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Enter your name..."
                className="flex-1 rounded-xl bg-stone-950 border border-[#c6a15b]/45 px-3.5 py-2.5 text-sm text-[#f5efe2] placeholder:text-stone-500 focus:outline-none focus:border-[#e5c365]"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl deco-gold-btn font-serif-title font-black text-xs sm:text-sm uppercase tracking-widest inline-flex items-center justify-center gap-2 shrink-0"
              >
                Join Room {invitedRoomCode}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Horizontal Role Cards Preview (Includes all 6 roles including Game Master) */}
        <div className="pt-2 pb-1 overflow-x-auto">
          <div className="inline-flex items-center justify-center gap-3 px-4 py-2 min-w-max mx-auto">
            {dossierRoleOrder.map((roleKey) => {
              const r = ROLES[roleKey];
              return (
                <div
                  key={roleKey}
                  onClick={() => openDossierModal(roleKey, 'ROLES')}
                  className="cursor-pointer group w-28 sm:w-32 rounded-[14px] bg-[#f4ece0] p-1.5 border border-[#d6c7ad] shadow-2xl hover:-translate-y-1.5 transition-all text-[#181615]"
                >
                  <div className="rounded-[9px] border-2 border-[#1c1a17] p-1 bg-[#f4ece0]">
                    <div className="text-[9px] font-serif-title font-black uppercase tracking-widest text-center border-b border-[#1c1a17] pb-0.5 truncate">
                      {r.name}
                    </div>
                    <div className="my-1 aspect-[3/4] rounded border border-[#1c1a17] overflow-hidden bg-black">
                      <img
                        src={r.image}
                        alt={r.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="text-[8px] font-serif-title font-black uppercase tracking-widest text-center border-t border-[#1c1a17] pt-0.5 truncate">
                      {r.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => openDossierModal(null, 'RULES')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-[#c6a15b]/40 text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365] transition"
          >
            <BookOpen className="w-4 h-4" />
            Inspect Full Role Dossiers & Rules
          </button>
        </div>
      </header>

      {/* Mode Selection Cards */}
      <main className="max-w-5xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* MODE 1: MULTI-DEVICE ROOM CODE */}
        <div className="rounded-3xl deco-panel p-6 sm:p-8 flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-serif-title font-bold uppercase tracking-[0.18em] px-3 py-1 rounded bg-[#c6a15b]/15 text-[#e5c365] border border-[#c6a15b]/40">
                Mode I • Multi-Device Phones
              </span>
              <Smartphone className="w-6 h-6 text-[#c6a15b]" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif-title font-bold text-[#f5efe2]">
              Multi-Device Room Code
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              Every player joins on their own phone with a 4-letter Room Code. Features
              secret role cards, private night actions, encrypted Syndicate chat, Game
              Master draw, and optional AI Bots.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {/* Quick Resume Active Hosted Room if available */}
            {(() => {
              const activeHostRoom = getSavedHostRoomSummary();
              if (!activeHostRoom) return null;
              return (
                <div className="p-4 rounded-2xl bg-[#c6a15b]/15 border-2 border-[#e5c365] space-y-2.5 shadow-[0_0_25px_rgba(198,161,91,0.2)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-serif-title font-bold uppercase tracking-[0.16em] text-[#e5c365] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#c6a15b]" />
                      Active Game in Progress
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-stone-950 text-[#e5c365] border border-[#c6a15b]/40">
                      ROOM {activeHostRoom.code}
                    </span>
                  </div>
                  <p className="text-xs text-stone-200">
                    You have an open game room with <strong className="text-white">{activeHostRoom.playerCount} player{activeHostRoom.playerCount === 1 ? '' : 's'}</strong> ({activeHostRoom.phase === 'LOBBY' ? 'Lobby' : `Round ${activeHostRoom.round}`}).
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        enterMultiDevice({
                          type: 'resume_host',
                          name: activeHostRoom.hostName,
                          code: activeHostRoom.code,
                        });
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl deco-gold-btn font-serif-title font-black text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2 transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Return to Room {activeHostRoom.code}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          sessionStorage.removeItem(STORAGE_ROOM_KEY);
                        } catch {}
                        setMode('HOME');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-serif-title uppercase tracking-wider border border-white/10 transition"
                      title="Discard this hosted room"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Host New Room Form */}
            <form
              onSubmit={handleCreateRoom}
              className="p-4 rounded-2xl bg-stone-950/80 border border-[#c6a15b]/30 space-y-3"
            >
              <div className="text-xs font-serif-title font-bold uppercase tracking-widest text-[#e5c365]">
                Host a New Syndicate Table
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Your Name (e.g., Alex)"
                  className="flex-1 rounded-xl bg-black/70 border border-[#c6a15b]/30 px-3.5 py-2.5 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-[#e5c365]"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl deco-gold-btn font-serif-title font-black text-xs uppercase tracking-widest inline-flex items-center justify-center gap-1.5 transition shrink-0"
                >
                  Create Room
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Join Existing Room Form */}
            <form
              onSubmit={handleJoinRoom}
              className="p-4 rounded-2xl bg-stone-950/60 border border-white/10 space-y-3"
            >
              <div className="text-xs font-serif-title font-bold uppercase tracking-widest text-stone-300">
                Join with 4-Letter Room Code
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="Your Name"
                  className="sm:col-span-5 rounded-xl bg-black/70 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-[#e5c365]"
                />
                <input
                  type="text"
                  maxLength={4}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className="sm:col-span-3 rounded-xl bg-black/70 border border-white/15 px-3 py-2.5 text-sm font-mono font-bold uppercase tracking-widest text-center text-[#e5c365] placeholder:text-stone-600 focus:outline-none focus:border-[#e5c365]"
                />
                <button
                  type="submit"
                  disabled={joinCode.trim().length < 4}
                  className="sm:col-span-2 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-[#c6a15b]/40 disabled:opacity-40 text-[#e5c365] font-serif-title font-bold text-xs uppercase tracking-wider transition"
                >
                  Join
                </button>
                <button
                  type="button"
                  onClick={handleLaunchTvRoom}
                  disabled={joinCode.trim().length < 4}
                  className="sm:col-span-2 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 disabled:opacity-40 text-[#e5c365] font-serif-title font-bold text-xs uppercase tracking-wider transition inline-flex items-center justify-center gap-1"
                  title="Launch this device as the big-screen TV Display & Game Master"
                >
                  <Tv className="w-3.5 h-3.5" />
                  TV (GM)
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* MODE 2: SINGLE-DEVICE / NARRATOR & PASS-AND-PLAY */}
        <div className="rounded-3xl deco-panel p-6 sm:p-8 flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-serif-title font-bold uppercase tracking-[0.18em] px-3 py-1 rounded bg-[#c6a15b]/15 text-[#e5c365] border border-[#c6a15b]/40">
                Mode II • Single-Device Table
              </span>
              <Users className="w-6 h-6 text-[#c6a15b]" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif-title font-bold text-[#f5efe2]">
              Pass-and-Play & Game Master
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              Playing in person with a single phone or tablet? Assign or randomly draw a
              Game Master, pass the device around to flip open each citizen’s secret role
              card, then follow the guided Night script!
            </p>

            <ul className="space-y-2 pt-2 text-xs sm:text-sm text-stone-300">
              <li className="flex items-center gap-2.5">
                <span className="w-2 h-2 rotate-45 bg-[#c6a15b]" />
                Assign a specific Game Master or draw randomly between players
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-2 h-2 rotate-45 bg-[#c6a15b]" />
                Secret Pass-and-Play role deal with anti-peek handoff shield
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-2 h-2 rotate-45 bg-[#c6a15b]" />
                Guided Night Script (Mafia → Doctor → Detective) with toggleable skip
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-2 h-2 rotate-45 bg-[#c6a15b]" />
                Town Hall deliberation timer & full Chronicle log
              </li>
            </ul>
          </div>

          <div className="pt-4 space-y-2.5">
            {(() => {
              const savedSD = getSavedSingleDeviceSummary();
              if (savedSD) {
                return (
                  <>
                    <button
                      type="button"
                      onClick={enterSingleDevice}
                      className="w-full py-4 rounded-2xl deco-gold-btn font-serif-title font-black text-sm uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Continue Game (Round {savedSD.round})
                    </button>
                    <button
                      type="button"
                      onClick={resetAndEnterSingleDevice}
                      className="w-full py-2.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-[#c6a15b]/35 text-stone-300 hover:text-[#e5c365] font-serif-title font-bold text-xs uppercase tracking-[0.16em] flex items-center justify-center gap-2 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#c6a15b]" />
                      Start New Game (Reset)
                    </button>
                  </>
                );
              }
              return (
                <button
                  type="button"
                  onClick={enterSingleDevice}
                  className="w-full py-4 rounded-2xl deco-gold-btn font-serif-title font-black text-sm uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Enter Single-Device Table
                </button>
              );
            })()}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full px-4 py-6 text-center text-xs font-serif-title tracking-widest uppercase text-stone-500">
        MAFIA // SYNDICATE
      </footer>

      {/* ROLES & RULES MODAL */}
      {showRulesModal && (
        <div
          onClick={closeDossierModal}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              if (dossierModalTab !== 'ROLES') return;
              const t = e.touches[0];
              if (t) swipeStartRef.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={(e) => {
              if (dossierModalTab !== 'ROLES') return;
              const t = e.changedTouches[0];
              if (!t || swipeStartRef.current.x === null) return;
              const dx = t.clientX - swipeStartRef.current.x;
              const dy = t.clientY - swipeStartRef.current.y;
              swipeStartRef.current = { x: null, y: null };
              if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                stepDossierRole(dx < 0 ? 1 : -1);
              }
            }}
            onPointerDown={(e) => {
              if (dossierModalTab !== 'ROLES' || e.pointerType === 'touch') return;
              swipeStartRef.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {
              if (
                dossierModalTab !== 'ROLES' ||
                e.pointerType === 'touch' ||
                swipeStartRef.current.x === null
              )
                return;
              const dx = e.clientX - swipeStartRef.current.x;
              const dy = e.clientY - swipeStartRef.current.y;
              swipeStartRef.current = { x: null, y: null };
              if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                stepDossierRole(dx < 0 ? 1 : -1);
              }
            }}
            className="max-w-xl w-full max-h-[92vh] overflow-y-auto rounded-3xl deco-panel p-5 sm:p-7 space-y-5 touch-pan-y select-none"
          >
            <div className="flex items-center justify-between border-b border-[#c6a15b]/30 pb-3.5">
              <div>
                <h2 className="text-lg sm:text-xl font-serif-title font-bold uppercase tracking-wider text-[#f5efe2]">
                  The Syndicate Dossier — Roles & Rules
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDossierModal}
                className="p-2 rounded-xl bg-stone-900 border border-[#c6a15b]/30 text-stone-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Primary Modal View Switcher: Role Dossiers vs Game Rules */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-stone-950 border border-[#c6a15b]/30">
              <button
                type="button"
                onClick={() => setDossierModalTab('ROLES')}
                className={`py-2.5 px-3 rounded-xl text-xs font-serif-title font-bold uppercase tracking-wider transition ${
                  dossierModalTab === 'ROLES'
                    ? 'deco-gold-btn'
                    : 'text-stone-300 hover:text-[#f5efe2]'
                }`}
              >
                Official Role Dossiers (6)
              </button>
              <button
                type="button"
                onClick={() => setDossierModalTab('RULES')}
                className={`py-2.5 px-3 rounded-xl text-xs font-serif-title font-bold uppercase tracking-wider transition ${
                  dossierModalTab === 'RULES'
                    ? 'deco-gold-btn'
                    : 'text-stone-300 hover:text-[#f5efe2]'
                }`}
              >
                Game Rules & Mechanics
              </button>
            </div>

            {dossierModalTab === 'ROLES' ? (
              <>
                {/* Role Selector Tabs */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {dossierRoleOrder.map((roleKey) => {
                    const r = ROLES[roleKey];
                    const isSelected = selectedDossierRole === roleKey;
                    return (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => setSelectedDossierRole(roleKey)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-serif-title font-bold uppercase tracking-wider border transition ${
                          isSelected
                            ? 'deco-gold-btn'
                            : 'bg-stone-900/90 text-stone-300 border-[#c6a15b]/25 hover:border-[#c6a15b]/60 hover:text-[#f5efe2]'
                        }`}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>

                {/* Active Selected Role Card & Dossier */}
                <div className="pt-1">
                  <RoleCard roleId={selectedDossierRole} />
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#c6a15b]/20">
                  <button
                    type="button"
                    onClick={() => stepDossierRole(-1)}
                    className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/35 text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365] transition"
                  >
                    ← Prev Role
                  </button>

                  <button
                    type="button"
                    onClick={closeDossierModal}
                    className="px-5 py-2 rounded-xl deco-gold-btn font-serif-title font-bold text-xs uppercase tracking-widest"
                  >
                    Close Dossier
                  </button>

                  <button
                    type="button"
                    onClick={() => stepDossierRole(1)}
                    className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/35 text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365] transition"
                  >
                    Next Role →
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4 text-left">
                {/* 1. Overview & Factions */}
                <div className="p-4 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/30 space-y-2.5">
                  <h3 className="text-xs font-serif-title font-bold uppercase tracking-[0.18em] text-[#e5c365]">
                    1. Two Secret Factions & The Game Master
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                    Mafia is a social deduction party game pitting an informed minority (
                    <strong className="text-rose-300">The Syndicate</strong>) against an
                    uninformed majority (
                    <strong className="text-emerald-300">The Town Alliance</strong>),
                    moderated by a{' '}
                    <strong className="text-[#e5c365]">Game Master</strong>.
                  </p>
                  <ul className="space-y-1.5 text-xs text-stone-300 pt-1">
                    <li>
                      • <strong className="text-emerald-300">Town Alliance (Villager, Doctor, Detective):</strong>{' '}
                      Do not know who anyone else is. Must deduce who the Mafia members are
                      and vote to exile them during the Day.
                    </li>
                    <li>
                      • <strong className="text-rose-300">The Syndicate (Mafia & Godfather):</strong>{' '}
                      Know each other&apos;s identities. Strike in secret each Night and
                      blend in as innocent citizens during the Day.
                    </li>
                    <li>
                      • <strong className="text-[#e5c365]">Game Master (Narrator):</strong>{' '}
                      Does not play on either team. Guides the Night script while everyone&apos;s
                      eyes are closed and announces what happened at Dawn.
                    </li>
                  </ul>
                </div>

                {/* 2. Night Phase Order */}
                <div className="p-4 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/30 space-y-2.5">
                  <h3 className="text-xs font-serif-title font-bold uppercase tracking-[0.18em] text-[#e5c365]">
                    2. The Night Phase (Eyes Closed)
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                    Everyone closes their eyes. The Game Master calls each active role one
                    by one:
                  </p>
                  <ol className="space-y-2 text-xs text-stone-300 pt-1">
                    <li>
                      <strong className="text-[#f5efe2]">Step 1 — Mafia & Godfather Wake:</strong>{' '}
                      Open their eyes, recognize their partners, and silently point to one
                      Town citizen to eliminate. (Mafia cannot target fellow Mafia or the
                      Godfather.)
                    </li>
                    <li>
                      <strong className="text-[#f5efe2]">Step 2 — Doctor Wakes:</strong>{' '}
                      Opens their eyes and points to one living player to protect. If the
                      Doctor chooses the same person the Mafia attacked, that player survives!
                    </li>
                    <li>
                      <strong className="text-[#f5efe2]">Step 3 — Detective Wakes:</strong>{' '}
                      Opens their eyes and points to one suspect to investigate. The Game
                      Master silently nods (<span className="text-rose-300">Mafia</span>) or
                      shakes their head (<span className="text-emerald-300">Innocent</span>).
                      Note: The <strong>Godfather</strong> always appears{' '}
                      <span className="text-emerald-300">Innocent</span> to the Detective!
                    </li>
                  </ol>
                </div>

                {/* 3. Dawn & Day Phase */}
                <div className="p-4 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/30 space-y-2">
                  <h3 className="text-xs font-serif-title font-bold uppercase tracking-[0.18em] text-[#e5c365]">
                    3. Dawn Report & Day Town Hall Vote
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                    At Dawn, everyone opens their eyes and the Game Master announces whether
                    anyone was eliminated overnight. Surviving citizens then debate alibis,
                    share clues, and hold a majority vote to{' '}
                    <strong className="text-[#f5efe2]">Exile one suspect</strong> (or skip
                    the vote if the Town cannot agree). Eliminated players may no longer
                    speak or vote.
                  </p>
                </div>

                {/* 4. Winning the Game */}
                <div className="p-4 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/30 space-y-2">
                  <h3 className="text-xs font-serif-title font-bold uppercase tracking-[0.18em] text-[#e5c365]">
                    4. How to Win
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-stone-200">
                      <div className="font-serif-title font-bold uppercase tracking-wider text-emerald-300 mb-1">
                        Town Victory
                      </div>
                      The Town wins as soon as every Mafia member and the Godfather have
                      been exiled.
                    </div>
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-stone-200">
                      <div className="font-serif-title font-bold uppercase tracking-wider text-rose-300 mb-1">
                        Syndicate Victory
                      </div>
                      The Mafia wins as soon as living Syndicate members equal or outnumber
                      living Town citizens.
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#c6a15b]/20">
                  <button
                    type="button"
                    onClick={() => setDossierModalTab('ROLES')}
                    className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/35 text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365] transition"
                  >
                    ← View Role Cards
                  </button>
                  <button
                    type="button"
                    onClick={closeDossierModal}
                    className="px-5 py-2 rounded-xl deco-gold-btn font-serif-title font-bold text-xs uppercase tracking-widest"
                  >
                    Close Dossier
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
