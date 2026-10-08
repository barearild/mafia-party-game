import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Shield,
  Skull,
  Search,
  Vote,
  Trophy,
  RotateCcw,
  Sparkles,
  Play,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Dices,
  UserCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ROLES,
  getRecommendedRoleConfig,
  BOT_NAMES,
  assignAlternatingRoleImages,
  getRoleImage,
} from '../shared/roles.js';
import {
  RoleBadge,
  RoleCard,
  FlippableRoleCard,
  RoleSettingsEditor,
  ArtDecoCardBack,
} from './RoleBadge.jsx';

const SINGLE_DEVICE_STORAGE_KEY = 'mafia_single_device_state_v1';

const DEFAULT_PLAYERS = [
  { id: 'p1', name: 'Alice', alive: true, role: null },
  { id: 'p2', name: 'Bob', alive: true, role: null },
  { id: 'p3', name: 'Charlie', alive: true, role: null },
  { id: 'p4', name: 'Diana', alive: true, role: null },
  { id: 'p5', name: 'Ethan', alive: true, role: null },
  { id: 'p6', name: 'Fiona', alive: true, role: null },
];

const DEFAULT_SETTINGS = {
  doctorSelfSave: false,
  revealRoleOnDeath: true,
  autoCustomRoles: true,
  passAndPlayReveal: true,
  roleCounts: getRecommendedRoleConfig(5),
};

function loadSavedSingleDeviceState() {
  try {
    const raw = localStorage.getItem(SINGLE_DEVICE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function SingleDeviceMode({ onBackHome }) {
  const [saved] = useState(() => loadSavedSingleDeviceState());

  const [phase, setPhase] = useState(saved?.phase || 'SETUP');
  // Phases: SETUP, GM_ANNOUNCEMENT, PASS_REVEAL, PASS_TO_GM, NIGHT_WIZARD, DAWN_REPORT, DAY_PHASE, GAME_OVER
  const [players, setPlayers] = useState(saved?.players || DEFAULT_PLAYERS);
  const [newName, setNewName] = useState('');

  // Game Master Selection State
  // gmMode: 'ASSIGNED' (Pick a player from roster) | 'RANDOM' (Draw randomly from roster)
  const [gmMode, setGmMode] = useState(saved?.gmMode || 'RANDOM');
  const [assignedGmId, setAssignedGmId] = useState(saved?.assignedGmId || 'p1');
  const [activeGameMaster, setActiveGameMaster] = useState(
    saved?.activeGameMaster || null
  );
  const [activeCitizens, setActiveCitizens] = useState(
    saved?.activeCitizens || []
  );

  const [settings, setSettings] = useState(
    saved?.settings
      ? { ...DEFAULT_SETTINGS, ...saved.settings }
      : DEFAULT_SETTINGS
  );

  // Pass-and-Play Role Reveal state
  const [revealIndex, setRevealIndex] = useState(saved?.revealIndex ?? 0);
  const [isCardFlipped, setIsCardFlipped] = useState(
    saved?.isCardFlipped ?? false
  );
  const [isConcealingCard, setIsConcealingCard] = useState(false);
  const [gamesDealtCount, setGamesDealtCount] = useState(
    saved?.gamesDealtCount ?? 0
  );

  // Game progress state
  const [round, setRound] = useState(saved?.round ?? 0);
  const [showGodModeRoles, setShowGodModeRoles] = useState(
    saved?.showGodModeRoles ?? false
  );
  const [nightStep, setNightStep] = useState(saved?.nightStep ?? 0); // 0: Mafia, 1: Doctor, 2: Detective
  const [nightSelections, setNightSelections] = useState(
    saved?.nightSelections || {
      mafiaTargetId: null,
      doctorTargetId: null,
      detectiveTargetId: null,
      detectiveResult: null,
    }
  );
  const [dawnReport, setDawnReport] = useState(saved?.dawnReport || null);
  const [dayExileTargetId, setDayExileTargetId] = useState(
    saved?.dayExileTargetId || 'SKIP'
  );
  const [winner, setWinner] = useState(saved?.winner || null);
  const [winReason, setWinReason] = useState(saved?.winReason || '');
  const [logs, setLogs] = useState(saved?.logs || []);
  const [timerSeconds, setTimerSeconds] = useState(saved?.timerSeconds ?? 180);
  const [timerRunning, setTimerRunning] = useState(
    saved?.timerRunning ?? false
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const resetGameKeepRoster = () => {
    setPhase('SETUP');
    setActiveGameMaster(null);
    setActiveCitizens([]);
    setRevealIndex(0);
    setIsCardFlipped(false);
    setIsConcealingCard(false);
    setRound(0);
    setShowGodModeRoles(false);
    setNightStep(0);
    setNightSelections({
      mafiaTargetId: null,
      doctorTargetId: null,
      detectiveTargetId: null,
      detectiveResult: null,
    });
    setDawnReport(null);
    setDayExileTargetId('SKIP');
    setWinner(null);
    setWinReason('');
    setLogs([]);
    setTimerSeconds(180);
    setTimerRunning(false);
    setShowResetConfirm(false);
  };

  const resetEverythingFromScratch = () => {
    try {
      localStorage.removeItem(SINGLE_DEVICE_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setPhase('SETUP');
    setPlayers(DEFAULT_PLAYERS);
    setNewName('');
    setGmMode('RANDOM');
    setAssignedGmId('p1');
    setActiveGameMaster(null);
    setActiveCitizens([]);
    setSettings(DEFAULT_SETTINGS);
    setRevealIndex(0);
    setIsCardFlipped(false);
    setIsConcealingCard(false);
    setGamesDealtCount(0);
    setRound(0);
    setShowGodModeRoles(false);
    setNightStep(0);
    setNightSelections({
      mafiaTargetId: null,
      doctorTargetId: null,
      detectiveTargetId: null,
      detectiveResult: null,
    });
    setDawnReport(null);
    setDayExileTargetId('SKIP');
    setWinner(null);
    setWinReason('');
    setLogs([]);
    setTimerSeconds(180);
    setTimerRunning(false);
    setShowResetConfirm(false);
  };

  const citizenCountInSetup = Math.max(0, players.length - 1);
  const minPlayersNeeded = 5;

  useEffect(() => {
    try {
      const snapshot = {
        phase,
        players,
        gmMode,
        assignedGmId,
        activeGameMaster,
        activeCitizens,
        settings,
        revealIndex,
        isCardFlipped,
        gamesDealtCount,
        round,
        showGodModeRoles,
        nightStep,
        nightSelections,
        dawnReport,
        dayExileTargetId,
        winner,
        winReason,
        logs,
        timerSeconds,
        timerRunning,
      };
      localStorage.setItem(SINGLE_DEVICE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    phase,
    players,
    gmMode,
    assignedGmId,
    activeGameMaster,
    activeCitizens,
    settings,
    revealIndex,
    isCardFlipped,
    gamesDealtCount,
    round,
    showGodModeRoles,
    nightStep,
    nightSelections,
    dawnReport,
    dayExileTargetId,
    winner,
    winReason,
    logs,
    timerSeconds,
    timerRunning,
  ]);

  useEffect(() => {
    if (players.length > 0 && !players.some((p) => p.id === assignedGmId)) {
      setAssignedGmId(players[0].id);
    }
  }, [players, assignedGmId]);

  useEffect(() => {
    if (settings.autoCustomRoles) {
      setSettings((prev) => ({
        ...prev,
        roleCounts: getRecommendedRoleConfig(Math.max(4, citizenCountInSetup)),
      }));
    }
  }, [citizenCountInSetup, settings.autoCustomRoles]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimerSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const addPlayer = (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setPlayers((prev) => [
      ...prev,
      {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: trimmed,
        alive: true,
        role: null,
      },
    ]);
    setNewName('');
  };

  const addSamplePlayer = () => {
    const existing = new Set(players.map((p) => p.name));
    const pick =
      BOT_NAMES.find((n) => !existing.has(n)) || `Player ${players.length + 1}`;
    setPlayers((prev) => [
      ...prev,
      {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: pick,
        alive: true,
        role: null,
      },
    ]);
  };

  const removePlayer = (id) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const startGame = () => {
    if (players.length < minPlayersNeeded) return;

    let chosenGm = null;
    if (gmMode === 'ASSIGNED') {
      chosenGm = players.find((p) => p.id === assignedGmId) || players[0];
    } else if (gmMode === 'RANDOM') {
      chosenGm = players[Math.floor(Math.random() * players.length)];
    }

    const citizensList = chosenGm
      ? players.filter((p) => p.id !== chosenGm.id)
      : [...players];

    const counts = settings.autoCustomRoles
      ? getRecommendedRoleConfig(citizensList.length)
      : settings.roleCounts;

    const pool = [];
    Object.entries(counts).forEach(([roleKey, count]) => {
      for (let i = 0; i < count; i++) pool.push(roleKey);
    });
    while (pool.length < citizensList.length) pool.push('VILLAGER');
    pool.length = citizensList.length;

    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const nextDealOffset = gamesDealtCount;
    setGamesDealtCount((c) => c + 1);

    const rawAssignedCitizens = citizensList.map((p, idx) => ({
      ...p,
      alive: true,
      role: pool[idx],
    }));

    const assignedCitizens = assignAlternatingRoleImages(
      rawAssignedCitizens,
      nextDealOffset
    );

    const assignedGm = chosenGm
      ? {
          ...chosenGm,
          role: 'GAMEMASTER',
          roleVariantIndex: nextDealOffset,
          roleImage: getRoleImage('GAMEMASTER', nextDealOffset),
        }
      : null;

    setActiveGameMaster(assignedGm);
    setActiveCitizens(assignedCitizens);
    setRound(1);
    setLogs([
      {
        round: 1,
        text: chosenGm
          ? `Game started with ${assignedCitizens.length} citizens. ${chosenGm.name} is the Game Master!`
          : `Game started with ${assignedCitizens.length} citizens.`,
      },
    ]);
    setWinner(null);
    setWinReason('');

    if (chosenGm) {
      setPhase('GM_ANNOUNCEMENT');
    } else if (settings.passAndPlayReveal) {
      setRevealIndex(0);
      setIsCardFlipped(false);
      setPhase('PASS_REVEAL');
    } else {
      startNightWizard();
    }
  };

  const startNightWizard = () => {
    setNightStep(0);
    setNightSelections({
      mafiaTargetId: null,
      doctorTargetId: null,
      detectiveTargetId: null,
      detectiveResult: null,
    });
    setPhase('NIGHT_WIZARD');
  };

  const evaluateWinCondition = (updatedCitizens) => {
    const alive = updatedCitizens.filter((p) => p.alive);
    const mafia = alive.filter(
      (p) => p.role === 'MAFIA' || p.role === 'GODFATHER'
    );
    const town = alive.filter(
      (p) => p.role !== 'MAFIA' && p.role !== 'GODFATHER'
    );

    if (mafia.length === 0) {
      setWinner('TOWN');
      setWinReason('All Mafia members have been eliminated! The Town is safe.');
      setPhase('GAME_OVER');
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      return true;
    }

    if (mafia.length >= town.length) {
      setWinner('MAFIA');
      setWinReason(
        'The Mafia now equals or outnumbers the Town and takes control of the city!'
      );
      setPhase('GAME_OVER');
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      return true;
    }

    return false;
  };

  const finishNightWizard = (overrideSelections = null) => {
    const activeSelections = overrideSelections || nightSelections;
    const { mafiaTargetId, doctorTargetId } = activeSelections;
    const saved = mafiaTargetId && mafiaTargetId === doctorTargetId;
    let victim = null;

    const updatedCitizens = activeCitizens.map((p) => {
      if (p.id === mafiaTargetId && !saved) {
        victim = p;
        return { ...p, alive: false };
      }
      return p;
    });

    setActiveCitizens(updatedCitizens);

    const headline = victim
      ? `${victim.name} was eliminated in the night!`
      : saved
      ? `The Mafia attacked, but the Doctor made a life-saving intervention! No one died.`
      : `A quiet night passes. Everyone wakes up alive.`;

    setDawnReport({
      victim,
      saved,
      headline,
    });

    setLogs((prev) => [
      ...prev,
      { round, text: `Night ${round}: ${headline}` },
    ]);

    if (!evaluateWinCondition(updatedCitizens)) {
      setPhase('DAWN_REPORT');
    }
  };

  const confirmDayExile = () => {
    if (dayExileTargetId === 'SKIP') {
      setLogs((prev) => [
        ...prev,
        { round, text: `Day ${round}: The Town skipped voting. No one was exiled.` },
      ]);
      const nextRound = round + 1;
      setRound(nextRound);
      startNightWizard();
      return;
    }

    let exiled = null;
    const updatedCitizens = activeCitizens.map((p) => {
      if (p.id === dayExileTargetId) {
        exiled = p;
        return { ...p, alive: false };
      }
      return p;
    });

    setActiveCitizens(updatedCitizens);
    if (exiled) {
      setLogs((prev) => [
        ...prev,
        {
          round,
          text: `Day ${round}: ${exiled.name} (${ROLES[exiled.role]?.name}) was exiled by Town vote.`,
        },
      ]);
    }

    if (!evaluateWinCondition(updatedCitizens)) {
      const nextRound = round + 1;
      setRound(nextRound);
      startNightWizard();
    }
  };

  const alivePlayers = activeCitizens.filter((p) => p.alive);
  const mafiaMembers = activeCitizens.filter(
    (p) => p.role === 'MAFIA' || p.role === 'GODFATHER'
  );
  const aliveDoctor = activeCitizens.find((p) => p.alive && p.role === 'DOCTOR');
  const aliveDetective = activeCitizens.find(
    (p) => p.alive && p.role === 'DETECTIVE'
  );

  return (
    <div className="min-h-screen bg-noir-gradient pb-16">
      {/* Top Bar */}
      <header className="border-b border-[#c6a15b]/25 bg-[#0a0908]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-stone-300 hover:text-[#e5c365] font-serif-title uppercase tracking-wider transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[#c6a15b]" />
            <span className="sm:hidden">Exit</span>
            <span className="hidden sm:inline">Exit to Main Menu</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {activeGameMaster && phase !== 'SETUP' && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#c6a15b]/15 text-[#e5c365] border border-[#c6a15b]/40 font-serif-title uppercase tracking-wider font-bold max-w-[140px] sm:max-w-none truncate">
                <Wand2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">GM: {activeGameMaster.name}</span>
              </span>
            )}
            <span className="hidden md:inline-block text-[11px] font-serif-title uppercase tracking-[0.18em] px-2.5 py-1 rounded-full bg-stone-900 text-[#e5c365] border border-[#c6a15b]/35 font-bold shrink-0">
              Mode 2 • Single-Device
            </span>
            {phase !== 'SETUP' &&
              phase !== 'GM_ANNOUNCEMENT' &&
              phase !== 'PASS_REVEAL' &&
              phase !== 'PASS_TO_GM' && (
                <button
                  type="button"
                  onClick={() => setShowGodModeRoles((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-stone-900 border border-[#c6a15b]/30 text-[#f5efe2] hover:border-[#c6a15b]/60 transition shrink-0"
                >
                  {showGodModeRoles ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                      Hide Roles
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-[#e5c365]" />
                      GM Peek
                    </>
                  )}
                </button>
              )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6">
        {/* SETUP PHASE */}
        {phase === 'SETUP' && (
          <div className="space-y-6">
            <div className="rounded-2xl deco-panel p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#c6a15b]/20 pb-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                    Single-Device & Game Master Setup
                  </h1>
                  <p className="text-sm text-stone-300 mt-1">
                    Enter everyone in your group below, then choose whether to{' '}
                    <strong className="text-[#e5c365]">assign a specific person</strong> as
                    Game Master or{' '}
                    <strong className="text-[#e5c365]">randomly draw a Game Master</strong>{' '}
                    from the players.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetEverythingFromScratch}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/35 text-xs font-serif-title font-bold uppercase tracking-wider text-stone-300 hover:text-[#e5c365] shrink-0 self-start transition"
                  title="Reset roster and settings to defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#c6a15b]" />
                  Reset Defaults
                </button>
              </div>

              {/* Game Master Selection Panel */}
              <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/35 space-y-4">
                <div className="text-xs font-serif-title font-bold uppercase tracking-[0.16em] text-[#e5c365] flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-[#c6a15b]" />
                  Who is the Game Master (Narrator)?
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGmMode('RANDOM')}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      gmMode === 'RANDOM'
                        ? 'bg-[#c6a15b]/20 border-[#e5c365] text-[#f5efe2] shadow-[0_0_20px_rgba(198,161,91,0.18)]'
                        : 'bg-stone-900/80 border-[#c6a15b]/20 text-stone-300 hover:border-[#c6a15b]/50'
                    }`}
                  >
                    <div className="font-serif-title font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#e5c365]">
                      <Dices className="w-4 h-4" />
                      Draw Between Players
                    </div>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Randomly picks 1 person from the list to be Game Master when the game
                      starts.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGmMode('ASSIGNED')}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      gmMode === 'ASSIGNED'
                        ? 'bg-[#c6a15b]/20 border-[#e5c365] text-[#f5efe2] shadow-[0_0_20px_rgba(198,161,91,0.18)]'
                        : 'bg-stone-900/80 border-[#c6a15b]/20 text-stone-300 hover:border-[#c6a15b]/50'
                    }`}
                  >
                    <div className="font-serif-title font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#e5c365]">
                      <UserCheck className="w-4 h-4" />
                      Assign Specific Person
                    </div>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Choose a specific player from the roster below to be the Game Master.
                    </p>
                  </button>
                </div>

                {gmMode === 'ASSIGNED' && players.length > 0 && (
                  <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[#c6a15b]/20">
                    <span className="text-xs font-serif-title uppercase tracking-wider text-[#e5c365] font-bold">
                      Assigned Game Master:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {players.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAssignedGmId(p.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            assignedGmId === p.id
                              ? 'deco-gold-btn font-serif-title uppercase tracking-wider'
                              : 'bg-stone-900 text-stone-300 border-[#c6a15b]/25 hover:border-[#c6a15b]/60'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pass & Play Toggle */}
              <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/35 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-serif-title font-bold uppercase tracking-[0.16em] text-[#e5c365] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#c6a15b]" />
                      How Do Citizens Learn Their Secret Roles?
                    </div>
                    <p className="text-xs text-stone-300 mt-1.5 leading-relaxed">
                      {settings.passAndPlayReveal ? (
                        <>
                          <strong className="text-[#f5efe2]">
                            Pass-and-Play Screen Deal (ON):
                          </strong>{' '}
                          Pass this device around the circle before Night 1 so each citizen can
                          privately tap and view their secret role card on screen.
                        </>
                      ) : (
                        <>
                          <strong className="text-[#e5c365]">
                            GM Shoulder-Tap (OFF):
                          </strong>{' '}
                          Do not pass the phone around. Instead, the Game Master sees all assigned
                          roles on their dashboard and silently taps the Mafia, Doctor, and
                          Detective on the shoulder while everyone&apos;s eyes are closed.
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        passAndPlayReveal: !s.passAndPlayReveal,
                      }))
                    }
                    className={`px-4 py-2.5 rounded-xl text-xs font-serif-title font-bold uppercase tracking-wider shrink-0 transition ${
                      settings.passAndPlayReveal
                        ? 'deco-gold-btn'
                        : 'bg-stone-900 text-stone-300 border border-[#c6a15b]/40 hover:border-[#c6a15b]'
                    }`}
                  >
                    {settings.passAndPlayReveal
                      ? 'Pass-and-Play Deal: ON'
                      : 'Pass-and-Play Deal: OFF'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Player Roster */}
              <div className="lg:col-span-7 rounded-2xl deco-panel p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#c6a15b]/20 pb-3">
                  <div>
                    <h2 className="text-base font-serif-title font-bold uppercase tracking-wider text-[#f5efe2]">
                      Group Roster ({players.length} Total)
                    </h2>
                    <p className="text-xs text-stone-400">
                      1 Game Master + {citizenCountInSetup} Citizens
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addSamplePlayer}
                    className="text-xs px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-[#e5c365] border border-[#c6a15b]/40 font-serif-title font-bold uppercase tracking-wider transition"
                  >
                    + Quick Add Name
                  </button>
                </div>

                <form onSubmit={addPlayer} className="flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter player name..."
                    className="flex-1 rounded-xl bg-stone-950 border border-[#c6a15b]/30 px-3.5 py-2.5 text-sm text-[#f5efe2] placeholder:text-stone-500 focus:outline-none focus:border-[#e5c365]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl deco-gold-btn font-serif-title font-bold uppercase tracking-wider text-xs inline-flex items-center gap-1.5 transition"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {players.map((p, idx) => {
                    const isDesignatedGm =
                      gmMode === 'ASSIGNED' && assignedGmId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${
                          isDesignatedGm
                            ? 'bg-[#c6a15b]/15 border-[#e5c365]/60'
                            : 'bg-stone-950/85 border-[#c6a15b]/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-stone-900 border border-[#c6a15b]/40 text-xs font-serif-title font-bold flex items-center justify-center text-[#e5c365] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-[#f5efe2] truncate">
                            {p.name}
                          </span>
                          {isDesignatedGm && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#c6a15b]/25 text-[#e5c365] border border-[#c6a15b]/50 font-serif-title font-bold uppercase tracking-wider shrink-0">
                              GM
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removePlayer(p.id)}
                          className="text-stone-400 hover:text-rose-400 p-1 transition"
                          title="Remove player"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {players.length < minPlayersNeeded && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Add at least 5 people (1 Game Master + 4 Citizens) to start.
                  </p>
                )}
              </div>

              {/* Role Deck Config */}
              <div className="lg:col-span-5 space-y-4">
                <RoleSettingsEditor
                  playerCount={citizenCountInSetup}
                  settings={settings}
                  onUpdateSettings={setSettings}
                  isEditable={true}
                />

                <button
                  type="button"
                  disabled={players.length < minPlayersNeeded}
                  onClick={startGame}
                  className="w-full py-4 rounded-2xl deco-gold-btn disabled:opacity-40 font-serif-title font-black uppercase tracking-widest text-sm sm:text-base flex items-center justify-center gap-2 transition"
                >
                  <Play className="w-5 h-5 fill-current" />
                  {gmMode === 'RANDOM'
                    ? 'Draw Game Master & Start Game'
                    : 'Deal Roles & Start Game'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME MASTER ANNOUNCEMENT MODAL / SCREEN */}
        {phase === 'GM_ANNOUNCEMENT' && activeGameMaster && (
          <div className="max-w-lg mx-auto my-8">
            <div className="rounded-3xl deco-panel p-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-[#c6a15b]/15 border-2 border-[#c6a15b] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(198,161,91,0.2)]">
                <Wand2 className="w-10 h-10 text-[#e5c365]" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                  {gmMode === 'RANDOM'
                    ? 'Random Draw Complete'
                    : 'Assigned Game Master'}
                </span>
                <h2 className="text-3xl sm:text-4xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                  {activeGameMaster.name}
                </h2>
                <p className="text-sm text-[#e5c365] font-serif-title uppercase tracking-widest">
                  is the Game Master for this round
                </p>
              </div>

              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                {settings.passAndPlayReveal
                  ? `First, pass the device around to the ${activeCitizens.length} citizens so they can secretly view their role cards, then hand the device to ${activeGameMaster.name} to run Night 1.`
                  : `Hand the device directly to ${activeGameMaster.name}. Everyone else should close their eyes while ${activeGameMaster.name} checks the assigned roles and taps the Mafia, Doctor, and Detective on the shoulder!`}
              </p>

              <button
                type="button"
                onClick={() => {
                  if (settings.passAndPlayReveal) {
                    setRevealIndex(0);
                    setIsCardFlipped(false);
                    setPhase('PASS_REVEAL');
                  } else {
                    setShowGodModeRoles(true);
                    startNightWizard();
                  }
                }}
                className="w-full py-4 rounded-2xl deco-gold-btn font-serif-title font-black uppercase tracking-widest text-xs sm:text-sm transition"
              >
                {settings.passAndPlayReveal
                  ? `Begin Citizen Role Deal (Start with ${activeCitizens[0]?.name})`
                  : `I am ${activeGameMaster.name} — Reveal Roles & Start Night 1`}
              </button>
            </div>
          </div>
        )}

        {/* PASS-AND-PLAY SECRET ROLE REVEAL */}
        {phase === 'PASS_REVEAL' && activeCitizens[revealIndex] && (
          <div className="max-w-lg mx-auto my-4">
            <div className="rounded-3xl deco-panel p-5 sm:p-6 text-center space-y-4">
              <div className="space-y-1">
                <div className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                  Citizen {revealIndex + 1} of {activeCitizens.length} • Secret Role Deal
                </div>
                <p className="text-xs text-stone-300">
                  {!isCardFlipped ? (
                    <>
                      Pass the device to{' '}
                      <strong className="text-[#f5efe2]">
                        {activeCitizens[revealIndex].name}
                      </strong>
                      . Ensure nobody else can see the screen:
                    </>
                  ) : (
                    <>
                      Confidential assignment for{' '}
                      <strong className="text-[#f5efe2]">
                        {activeCitizens[revealIndex].name}
                      </strong>
                      :
                    </>
                  )}
                </p>
              </div>

              <FlippableRoleCard
                isFlipped={isCardFlipped}
                isTransitioning={isConcealingCard}
                playerName={activeCitizens[revealIndex].name}
                subtitle="Tap Card to Flip & Inspect Your Secret Identity"
                roleId={activeCitizens[revealIndex].role}
                imageUrl={activeCitizens[revealIndex].roleImage}
                variantIndex={activeCitizens[revealIndex].roleVariantIndex}
                fellowMafia={
                  activeCitizens[revealIndex].role === 'MAFIA' ||
                  activeCitizens[revealIndex].role === 'GODFATHER'
                    ? mafiaMembers
                    : []
                }
                flipButtonLabel={`I am ${activeCitizens[revealIndex].name} — Flip Card`}
                nextButtonLabel={
                  revealIndex + 1 < activeCitizens.length
                    ? `Conceal Card & Pass to ${activeCitizens[revealIndex + 1].name}`
                    : activeGameMaster
                    ? `Conceal Card & Pass to Game Master (${activeGameMaster.name})`
                    : 'Conceal Card & Pass to Game Master'
                }
                onFlip={() => setIsCardFlipped(true)}
                onNext={() => {
                  setIsConcealingCard(true);
                  setIsCardFlipped(false);
                  setTimeout(() => {
                    setIsConcealingCard(false);
                    if (revealIndex + 1 < activeCitizens.length) {
                      setRevealIndex((i) => i + 1);
                    } else {
                      setShowGodModeRoles(false);
                      setPhase('PASS_TO_GM');
                    }
                  }, 480);
                }}
              />
            </div>
          </div>
        )}

        {/* SAFE HANDOFF SCREEN BEFORE GAME MASTER NIGHT DASHBOARD */}
        {phase === 'PASS_TO_GM' && (
          <div className="max-w-lg mx-auto my-6">
            <div className="rounded-3xl deco-panel p-6 sm:p-8 text-center space-y-5">
              <div className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                All Citizen Roles Dealt • Anti-Peek Shield
              </div>
              <ArtDecoCardBack
                playerName={activeGameMaster ? activeGameMaster.name : 'Game Master'}
                subtitle="All citizen dossiers are sealed. Hand the device to the Game Master to unlock Night 1."
                buttonLabel={`I am ${
                  activeGameMaster ? activeGameMaster.name : 'the Game Master'
                } — Unlock Night 1`}
                onClick={() => {
                  setShowGodModeRoles(true);
                  startNightWizard();
                }}
              />
            </div>
          </div>
        )}

        {/* NARRATOR NIGHT WIZARD */}
        {phase === 'NIGHT_WIZARD' && (
          <div className="space-y-6">
            <div className="rounded-2xl deco-panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-[#c6a15b]/20 pb-4">
                <div className="flex items-center gap-2.5">
                  <Moon className="w-6 h-6 text-[#e5c365]" />
                  <h2 className="text-2xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                    Night {round} —{' '}
                    {activeGameMaster
                      ? `${activeGameMaster.name}'s GM Script`
                      : 'Game Master Script'}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {['1. Mafia', '2. Doctor', '3. Detective'].map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      disabled={idx > 0 && !nightSelections.mafiaTargetId}
                      onClick={() => setNightStep(idx)}
                      className={`px-3 py-1 rounded-full font-serif-title font-bold uppercase tracking-wider transition disabled:opacity-40 ${
                        nightStep === idx
                          ? 'deco-gold-btn'
                          : nightStep > idx
                          ? 'bg-[#c6a15b]/20 text-[#e5c365] border border-[#c6a15b]/50'
                          : 'bg-stone-900 text-stone-400 border border-[#c6a15b]/20 hover:text-[#f5efe2]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 0: MAFIA */}
              {nightStep === 0 && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-rose-500/35 space-y-2">
                    <div className="text-xs font-serif-title uppercase tracking-wider text-rose-400 font-bold flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" />
                      Read Aloud to Group:
                    </div>
                    <p className="text-base sm:text-lg text-[#f5efe2] font-medium italic">
                      “Night falls over the town. Everyone close your eyes. Mafia and
                      Godfather, open your eyes, recognize your partners, and silently point
                      to who you want to eliminate tonight.”
                    </p>
                    {showGodModeRoles && (
                      <div className="pt-2 text-xs text-rose-300">
                        Active Mafia:{' '}
                        {mafiaMembers
                          .filter((m) => m.alive)
                          .map((m) => `${m.name} (${ROLES[m.role]?.name})`)
                          .join(', ')}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-serif-title uppercase tracking-wider font-bold text-[#e5c365] mb-2.5">
                      Select the Mafia’s Target:
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {activeCitizens.map((p) => {
                        const isMafiaMember =
                          p.role === 'MAFIA' || p.role === 'GODFATHER';
                        const isDisabled = !p.alive || isMafiaMember;
                        const isSelected = nightSelections.mafiaTargetId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() =>
                              setNightSelections((prev) => ({
                                ...prev,
                                mafiaTargetId: p.id,
                              }))
                            }
                            className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between disabled:opacity-35 disabled:cursor-not-allowed ${
                              isSelected
                                ? 'bg-rose-950/80 border-rose-500 text-[#f5efe2] shadow-lg'
                                : 'bg-stone-950/80 border-[#c6a15b]/25 text-stone-200 hover:border-[#c6a15b]/60'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-sm flex items-center gap-1.5 truncate">
                                <span className={!p.alive ? 'line-through text-stone-400' : ''}>
                                  {p.name}
                                </span>
                                {!p.alive && <span title="Eliminated">💀</span>}
                              </div>
                              <div className="text-[11px] text-stone-400 truncate">
                                {!p.alive
                                  ? 'Eliminated'
                                  : isMafiaMember
                                  ? `${ROLES[p.role]?.name} (Awake)`
                                  : showGodModeRoles
                                  ? ROLES[p.role]?.name
                                  : ''}
                              </div>
                            </div>
                            <Skull
                              className={`w-4 h-4 shrink-0 ${
                                isSelected ? 'text-rose-400' : 'text-stone-600'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      disabled={!nightSelections.mafiaTargetId}
                      onClick={() => {
                        const next = {
                          ...nightSelections,
                          doctorTargetId: null,
                          detectiveTargetId: null,
                          detectiveResult: null,
                        };
                        setNightSelections(next);
                        finishNightWizard(next);
                      }}
                      className="px-4 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/35 disabled:opacity-40 text-[#e5c365] font-serif-title uppercase tracking-wider font-bold text-xs transition"
                    >
                      Skip Doctor & Detective → Wake Up Town ☀️
                    </button>
                    <button
                      type="button"
                      disabled={!nightSelections.mafiaTargetId}
                      onClick={() => setNightStep(1)}
                      className="px-6 py-3 rounded-xl deco-gold-btn disabled:opacity-40 font-serif-title uppercase tracking-wider font-black text-xs sm:text-sm transition"
                    >
                      Mafia Sleep → Next: Doctor
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 1: DOCTOR */}
              {nightStep === 1 && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-emerald-500/35 space-y-2">
                    <div className="text-xs font-serif-title uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" />
                      Read Aloud to Group:
                    </div>
                    <p className="text-base sm:text-lg text-[#f5efe2] font-medium italic">
                      “Mafia, close your eyes. Doctor, open your eyes and point to one
                      person you wish to protect tonight.”
                    </p>
                    {showGodModeRoles && (
                      <div className="pt-2 text-xs text-emerald-300">
                        {aliveDoctor
                          ? `Active Doctor: ${aliveDoctor.name}`
                          : 'The Doctor has been eliminated! Still read the prompt aloud and pause for 5 seconds so the room doesn’t know no one is waking up.'}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-serif-title uppercase tracking-wider font-bold text-[#e5c365] mb-2.5">
                      {aliveDoctor
                        ? 'Select the Doctor’s Protected Player (tap again to unselect & skip):'
                        : 'No living Doctor — read the prompt aloud, pause briefly, then continue:'}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {activeCitizens.map((p) => {
                        const isDoctorPlayer = p.role === 'DOCTOR';
                        const disabledSelf =
                          !settings.doctorSelfSave && isDoctorPlayer;
                        const isDisabled = !p.alive || !aliveDoctor || disabledSelf;
                        const isSelected = nightSelections.doctorTargetId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() =>
                              setNightSelections((prev) => ({
                                ...prev,
                                doctorTargetId:
                                  prev.doctorTargetId === p.id ? null : p.id,
                              }))
                            }
                            className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between disabled:opacity-35 disabled:cursor-not-allowed ${
                              isSelected
                                ? 'bg-emerald-950/80 border-emerald-400 text-[#f5efe2] shadow-lg'
                                : 'bg-stone-950/80 border-[#c6a15b]/25 text-stone-200 hover:border-[#c6a15b]/60'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-sm flex items-center gap-1.5 truncate">
                                <span className={!p.alive ? 'line-through text-stone-400' : ''}>
                                  {p.name}
                                </span>
                                {!p.alive && <span title="Eliminated">💀</span>}
                              </div>
                              <div className="text-[11px] text-stone-400 truncate">
                                {!p.alive
                                  ? 'Eliminated'
                                  : isDoctorPlayer
                                  ? 'Doctor (Awake)'
                                  : showGodModeRoles
                                  ? ROLES[p.role]?.name
                                  : ''}
                              </div>
                            </div>
                            <Shield
                              className={`w-4 h-4 shrink-0 ${
                                isSelected ? 'text-emerald-400' : 'text-stone-600'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setNightStep(0)}
                      className="px-4 py-2.5 rounded-xl bg-stone-900 border border-[#c6a15b]/30 text-stone-300 text-xs font-serif-title uppercase tracking-wider font-bold"
                    >
                      ← Back
                    </button>

                    <button
                      type="button"
                      onClick={() => setNightStep(2)}
                      className={`px-6 py-3 rounded-xl font-serif-title uppercase tracking-wider font-black text-xs sm:text-sm transition ${
                        !aliveDoctor || nightSelections.doctorTargetId
                          ? 'deco-gold-btn'
                          : 'bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/40 text-[#e5c365]'
                      }`}
                    >
                      {!aliveDoctor || nightSelections.doctorTargetId
                        ? 'Doctor Sleep → Next: Detective'
                        : 'Skip Doctor → Next: Detective'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DETECTIVE */}
              {nightStep === 2 && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/40 space-y-2">
                    <div className="text-xs font-serif-title uppercase tracking-wider text-[#e5c365] font-bold flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" />
                      Read Aloud to Group:
                    </div>
                    <p className="text-base sm:text-lg text-[#f5efe2] font-medium italic">
                      “Doctor, close your eyes. Detective, open your eyes and point to one
                      player you want to investigate.”
                    </p>
                    {showGodModeRoles && (
                      <div className="pt-2 text-xs text-[#e5c365] space-y-1">
                        <div>
                          {aliveDetective
                            ? `Active Detective: ${aliveDetective.name} (Remember: Godfather appears INNOCENT!)`
                            : 'The Detective has been eliminated! Still read the prompt aloud and pause for a few seconds—no role will be revealed.'}
                        </div>
                        {aliveDetective &&
                          nightSelections.mafiaTargetId === aliveDetective.id && (
                            <div className="text-rose-300 font-medium">
                              {nightSelections.doctorTargetId === aliveDetective.id
                                ? `Note: The Mafia targeted ${aliveDetective.name} tonight, but the Doctor protected them! They survive and can share this clue tomorrow.`
                                : `Note: The Mafia targeted ${aliveDetective.name} tonight without Doctor protection! Still call on them now, but since they die at Dawn, they cannot reveal what they learn when Day starts.`}
                            </div>
                          )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-serif-title uppercase tracking-wider font-bold text-[#e5c365]">
                      {aliveDetective
                        ? 'Tap who the Detective points at (tap again to unselect & skip):'
                        : 'No living Detective — read the prompt aloud, pause briefly, then tap Wake Up Town:'}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {activeCitizens.map((p) => {
                        const isDetectivePlayer = p.role === 'DETECTIVE';
                        const isDisabled =
                          !p.alive || !aliveDetective || isDetectivePlayer;
                        const isSelected = nightSelections.detectiveTargetId === p.id;
                        const result = ROLES[p.role]?.investigativeResult || 'INNOCENT';
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() =>
                              setNightSelections((prev) => {
                                const togglingOff = prev.detectiveTargetId === p.id;
                                return {
                                  ...prev,
                                  detectiveTargetId: togglingOff ? null : p.id,
                                  detectiveResult: togglingOff ? null : result,
                                };
                              })
                            }
                            className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between disabled:opacity-35 disabled:cursor-not-allowed ${
                              isSelected
                                ? 'bg-[#c6a15b]/25 border-[#e5c365] text-[#f5efe2] shadow-lg'
                                : 'bg-stone-950/80 border-[#c6a15b]/25 text-stone-200 hover:border-[#c6a15b]/60'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-sm flex items-center gap-1.5 truncate">
                                <span className={!p.alive ? 'line-through text-stone-400' : ''}>
                                  {p.name}
                                </span>
                                {!p.alive && <span title="Eliminated">💀</span>}
                              </div>
                              <div className="text-[11px] text-stone-400 truncate">
                                {!p.alive
                                  ? 'Eliminated'
                                  : isDetectivePlayer
                                  ? 'Detective (Awake)'
                                  : showGodModeRoles
                                  ? ROLES[p.role]?.name
                                  : ''}
                              </div>
                            </div>
                            <Search
                              className={`w-4 h-4 shrink-0 ${
                                isSelected ? 'text-[#e5c365]' : 'text-stone-600'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {nightSelections.detectiveTargetId && (
                      <div
                        className={`p-4 rounded-xl border text-center ${
                          nightSelections.detectiveResult === 'MAFIA'
                            ? 'bg-rose-950/80 border-rose-500 text-rose-200'
                            : 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                        }`}
                      >
                        <div className="text-xs font-serif-title uppercase font-bold tracking-wider">
                          Silent Signal to Give Detective:
                        </div>
                        <div className="text-xl font-bold mt-1">
                          {nightSelections.detectiveResult === 'MAFIA'
                            ? '👍 THUMBS UP / NOD — SUSPICIOUS (MAFIA!)'
                            : '👎 THUMBS DOWN / SHAKE HEAD — APPEARS INNOCENT'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setNightStep(1)}
                      className="px-4 py-2.5 rounded-xl bg-stone-900 border border-[#c6a15b]/30 text-stone-300 text-xs font-serif-title uppercase tracking-wider font-bold"
                    >
                      ← Back
                    </button>

                    <button
                      type="button"
                      onClick={() => finishNightWizard()}
                      className={`px-6 py-3 rounded-xl font-serif-title uppercase tracking-wider font-black text-xs sm:text-sm transition ${
                        !aliveDetective || nightSelections.detectiveTargetId
                          ? 'deco-gold-btn'
                          : 'bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/40 text-[#e5c365]'
                      }`}
                    >
                      {!aliveDetective || nightSelections.detectiveTargetId
                        ? 'Resolve Night & Wake Up Town ☀️'
                        : 'Skip Detective & Wake Up Town ☀️'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DAWN REPORT */}
        {phase === 'DAWN_REPORT' && dawnReport && (
          <div className="max-w-xl mx-auto my-6">
            <div className="rounded-3xl deco-panel p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-[#c6a15b]/15 border-2 border-[#c6a15b] flex items-center justify-center mx-auto">
                <Sun className="w-9 h-9 text-[#e5c365]" />
              </div>
              <div className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                Dawn of Day {round} • Read Aloud
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                {dawnReport.headline}
              </h2>

              {dawnReport.victim && settings.revealRoleOnDeath && (
                <div className="p-4 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/30 inline-block">
                  <div className="text-xs text-stone-400 mb-1.5">
                    {dawnReport.victim.name}&apos;s identity was:
                  </div>
                  <RoleBadge roleId={dawnReport.victim.role} size="lg" />
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setDayExileTargetId('SKIP');
                  setTimerSeconds(180);
                  setTimerRunning(true);
                  setPhase('DAY_PHASE');
                }}
                className="w-full py-4 rounded-2xl deco-gold-btn font-serif-title font-black uppercase tracking-widest text-xs sm:text-sm transition"
              >
                Begin Town Discussion & Voting
              </button>
            </div>
          </div>
        )}

        {/* DAY DISCUSSION & EXILE VOTE */}
        {phase === 'DAY_PHASE' && (
          <div className="space-y-6">
            <div className="rounded-2xl deco-panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#c6a15b]/20 pb-4">
                <div>
                  <span className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                    Day {round} • Town Hall
                  </span>
                  <h2 className="text-2xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2] mt-0.5">
                    Discussion & Town Exile Vote
                  </h2>
                </div>

                {/* Discussion Timer */}
                <div className="flex items-center gap-2 bg-stone-950 border border-[#c6a15b]/35 px-4 py-2 rounded-xl">
                  <span className="font-mono text-xl font-bold text-[#e5c365]">
                    {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
                    {String(timerSeconds % 60).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTimerRunning((r) => !r)}
                    className="text-xs px-2.5 py-1 rounded bg-stone-900 border border-[#c6a15b]/30 text-[#f5efe2] hover:border-[#c6a15b]"
                  >
                    {timerRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimerSeconds(180)}
                    className="text-xs px-2 py-1 rounded bg-stone-900 text-stone-400 hover:text-[#f5efe2]"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <p className="text-sm text-stone-300 mt-4">
                Let the surviving citizens debate! When the Town reaches a majority vote (or
                chooses to skip), select the exiled player below:
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDayExileTargetId('SKIP')}
                  className={`p-4 rounded-xl border text-left transition flex items-center justify-between ${
                    dayExileTargetId === 'SKIP'
                      ? 'bg-[#c6a15b]/20 border-[#e5c365] text-[#f5efe2]'
                      : 'bg-stone-950/80 border-[#c6a15b]/20 text-stone-300'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">Skip Vote / Tie</div>
                    <div className="text-xs text-stone-400">No one exiled today</div>
                  </div>
                  <CheckCircle2
                    className={`w-5 h-5 ${
                      dayExileTargetId === 'SKIP' ? 'text-[#e5c365]' : 'text-stone-600'
                    }`}
                  />
                </button>

                {alivePlayers.map((p) => {
                  const selected = dayExileTargetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDayExileTargetId(p.id)}
                      className={`p-4 rounded-xl border text-left transition flex items-center justify-between ${
                        selected
                          ? 'bg-rose-950/80 border-rose-500 text-[#f5efe2]'
                          : 'bg-stone-950/80 border-[#c6a15b]/20 text-stone-200 hover:border-[#c6a15b]/50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm">{p.name}</div>
                        {showGodModeRoles && (
                          <div className="text-xs text-[#e5c365]">
                            {ROLES[p.role]?.name}
                          </div>
                        )}
                      </div>
                      <Vote
                        className={`w-5 h-5 ${
                          selected ? 'text-rose-400' : 'text-stone-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    confirmDayExile();
                  }}
                  className="px-6 py-3.5 rounded-xl deco-gold-btn font-serif-title font-black uppercase tracking-wider text-xs sm:text-sm transition"
                >
                  {dayExileTargetId === 'SKIP'
                    ? 'Confirm Skip → Proceed to Night'
                    : `Exile ${
                        activeCitizens.find((p) => p.id === dayExileTargetId)?.name
                      } → Proceed`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER */}
        {phase === 'GAME_OVER' && (
          <div className="max-w-2xl mx-auto my-6">
            <div className="rounded-3xl deco-panel p-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-[#c6a15b]/15 border-2 border-[#c6a15b] flex items-center justify-center mx-auto">
                <Trophy className="w-10 h-10 text-[#e5c365]" />
              </div>
              <div>
                <span className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                  Game Over
                </span>
                <h2
                  className={`text-4xl font-serif-title font-black uppercase tracking-wider mt-1 ${
                    winner === 'TOWN' ? 'text-emerald-400' : 'text-rose-500'
                  }`}
                >
                  {winner === 'TOWN' ? 'TOWN VICTORY!' : 'THE MAFIA WINS!'}
                </h2>
                <p className="text-sm text-stone-300 mt-2">{winReason}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {activeGameMaster && (
                  <div className="p-3 rounded-xl border bg-[#c6a15b]/15 border-[#c6a15b]/50 flex items-center justify-between sm:col-span-2">
                    <div className="font-semibold text-sm text-[#f5efe2]">
                      {activeGameMaster.name}
                    </div>
                    <RoleBadge roleId="GAMEMASTER" />
                  </div>
                )}
                {activeCitizens.map((p) => (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      p.alive
                        ? 'bg-stone-950/85 border-[#c6a15b]/30'
                        : 'bg-stone-950/40 border-white/5 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm text-[#f5efe2]">
                        {p.name} {!p.alive && '💀'}
                      </div>
                    </div>
                    <RoleBadge roleId={p.role} />
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetGameKeepRoster}
                  className="flex-1 py-3.5 rounded-xl deco-gold-btn font-serif-title font-black uppercase tracking-widest text-xs sm:text-sm inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again (Keep Roster)
                </button>
                <button
                  type="button"
                  onClick={resetEverythingFromScratch}
                  className="py-3.5 px-5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/35 text-stone-300 hover:text-[#e5c365] font-serif-title font-bold uppercase tracking-widest text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition"
                >
                  Start Fresh (Reset All)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NARRATOR ROSTER & LOG DRAWER (Visible during active game) */}
        {phase !== 'SETUP' &&
          phase !== 'GM_ANNOUNCEMENT' &&
          phase !== 'PASS_REVEAL' &&
          phase !== 'PASS_TO_GM' && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl deco-panel p-5">
                <div className="flex items-center justify-between mb-3 border-b border-[#c6a15b]/20 pb-2.5">
                  <h3 className="text-xs font-serif-title font-bold text-[#e5c365] uppercase tracking-wider">
                    Citizen Status ({alivePlayers.length} Alive)
                  </h3>
                  <span className="text-xs text-stone-400">
                    {showGodModeRoles ? 'Roles Visible' : 'Roles Hidden (Tap GM Peek)'}
                  </span>
                </div>
                <div className="space-y-2">
                  {activeGameMaster && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl border bg-[#c6a15b]/15 border-[#c6a15b]/40 text-[#f5efe2]">
                      <span className="text-sm font-semibold">
                        {activeGameMaster.name}
                      </span>
                      <RoleBadge roleId="GAMEMASTER" />
                    </div>
                  )}
                  {activeCitizens.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                        p.alive
                          ? 'bg-stone-950/85 border-[#c6a15b]/25 text-[#f5efe2]'
                          : 'bg-stone-950/40 border-white/5 text-stone-500 line-through'
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {p.name} {!p.alive && '💀'}
                      </span>
                      {(showGodModeRoles ||
                        (!p.alive && settings.revealRoleOnDeath)) && (
                        <RoleBadge roleId={p.role} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl deco-panel p-5">
                <h3 className="text-xs font-serif-title font-bold text-[#e5c365] uppercase tracking-wider mb-3 border-b border-[#c6a15b]/20 pb-2.5">
                  Chronicle Log
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto text-xs text-stone-300">
                  {logs.map((item, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-stone-950/80 border border-[#c6a15b]/20"
                    >
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        {phase !== 'SETUP' && phase !== 'GAME_OVER' && (
          <div className="mt-8 pt-4 border-t border-[#c6a15b]/15 text-center">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-rose-300 font-serif-title uppercase tracking-wider transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              End or Reset Current Game
            </button>
          </div>
        )}
      </main>

      {/* RESET GAME CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div
          onClick={() => setShowResetConfirm(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-2xl deco-panel p-6 space-y-5 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6 text-rose-300" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                Reset Single-Device Game?
              </h3>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                You can return to Setup while keeping your current player roster and settings, or wipe everything to start completely from scratch.
              </p>
            </div>
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={resetGameKeepRoster}
                className="w-full py-3 rounded-xl deco-gold-btn font-serif-title font-black uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                New Game (Keep Player Roster)
              </button>
              <button
                type="button"
                onClick={resetEverythingFromScratch}
                className="w-full py-3 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/50 text-rose-200 font-serif-title font-bold uppercase tracking-widest text-xs sm:text-sm transition"
              >
                Reset Everything From Scratch
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/25 text-stone-300 font-serif-title font-bold uppercase tracking-widest text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
