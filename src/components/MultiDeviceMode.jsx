import React, { useState, useEffect, useRef } from 'react';
import { P2PNetworkManager } from '../network/P2PNetworkManager.js';
import {
  ArrowLeft,
  Users,
  Copy,
  Check,
  Bot,
  Trash2,
  Play,
  Moon,
  Sun,
  Shield,
  Skull,
  Search,
  Vote,
  Trophy,
  RotateCcw,
  Send,
  Eye,
  EyeOff,
  Crown,
  FastForward,
  Wifi,
  AlertCircle,
  Wand2,
  Dices,
  UserCheck,
  Cpu,
  Link2,
  Share2,
  Tv,
  Sparkles,
  Edit2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ROLES } from '../shared/roles.js';
import {
  RoleBadge,
  RoleCard,
  RoleSettingsEditor,
  ArtDecoCardBack,
} from './RoleBadge.jsx';
import TvTheaterMode from './TvTheaterMode.jsx';
import { setGameUrl } from '../shared/urlUtils.js';

function getOrCreatePlayerId() {
  let id =
    sessionStorage.getItem('mafia_player_id') ||
    localStorage.getItem('mafia_player_id');
  if (!id) {
    id = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  sessionStorage.setItem('mafia_player_id', id);
  localStorage.setItem('mafia_player_id', id);
  return id;
}

export default function MultiDeviceMode({
  initialAction,
  initialTvMode = false,
  onUpdateAction,
  onBackHome,
}) {
  const [isTvMode, setIsTvMode] = useState(initialTvMode);
  const [roomState, setRoomState] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('Connecting to Room...');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [hideMyRole, setHideMyRole] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isEditingMyName, setIsEditingMyName] = useState(false);
  const [editingNameInput, setEditingNameInput] = useState('');
  const playerIdRef = useRef(getOrCreatePlayerId());
  const networkRef = useRef(null);

  useEffect(() => {
    if (!roomState?.phaseExpiresAt) {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.ceil((roomState.phaseExpiresAt - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const iv = setInterval(update, 500);
    return () => clearInterval(iv);
  }, [roomState?.phaseExpiresAt]);

  // socket-compatible wrapper so all existing socket.emit calls remain 100% compatible
  const socket = {
    emit: (event, payload = {}, callback) => {
      if (networkRef.current) {
        networkRef.current.dispatch(event, payload);
        if (typeof callback === 'function') {
          callback({ ok: true });
        }
      }
    },
  };

  useEffect(() => {
    const action = initialAction;
    let fallbackName = 'Player';
    try {
      const stored = localStorage.getItem('mafia_player_name');
      if (stored && stored.trim() && stored.trim().toLowerCase() !== 'player') {
        fallbackName = stored.trim();
      }
    } catch {}
    const resolvedName =
      action?.name && action.name.trim().toLowerCase() !== 'player'
        ? action.name.trim()
        : initialTvMode
        ? 'Living Room TV'
        : fallbackName;

    const net = new P2PNetworkManager({
      playerId: playerIdRef.current,
      playerName: resolvedName,
      isTvDisplay: initialTvMode,
      onStateUpdate: (state) => {
        if (state?.me?.name && !state.me.isTvDisplay && state.me.name.trim().toLowerCase() !== 'player') {
          try {
            localStorage.setItem('mafia_player_name', state.me.name.trim());
          } catch {}
        }
        setRoomState((prev) => {
          if (prev?.phase !== 'GAME_OVER' && state?.phase === 'GAME_OVER') {
            confetti({ particleCount: 100, spread: 75, origin: { y: 0.6 } });
          }
          if (prev?.phase === 'LOBBY' && state?.phase === 'ROLE_REVEAL') {
            setHideMyRole(true);
          }
          return state;
        });
      },
      onError: (err) => {
        setErrorMsg(err);
      },
      onStatusChange: (status) => {
        setStatusMsg(status);
      },
    });
    networkRef.current = net;

    if (action?.type === 'resume_host') {
      net.resumeHost(action.code);
      setGameUrl({ roomCode: action.code, isTv: initialTvMode, mode: 'MULTI_DEVICE' });
    } else if (action?.type === 'create') {
      const roomCode = net.createRoom();
      setGameUrl({ roomCode, isTv: initialTvMode, mode: 'MULTI_DEVICE' });
      if (onUpdateAction) {
        onUpdateAction({
          type: 'resume_host',
          code: roomCode,
          name: action.name || (initialTvMode ? 'Living Room TV' : 'Host'),
        });
      }
    } else if (action?.type === 'join') {
      net.joinRoom(action.code);
      setGameUrl({ roomCode: action.code, isTv: initialTvMode, mode: 'MULTI_DEVICE' });
      if (onUpdateAction) {
        onUpdateAction({
          type: 'join',
          code: action.code,
          name: resolvedName,
        });
      }
    }

    return () => {
      net.destroy();
    };
  }, []);

  // Register TV GM whenever TV mode is active
  useEffect(() => {
    if (isTvMode && networkRef.current) {
      networkRef.current.dispatch('register_tv_gm');
    }
  }, [isTvMode]);

  // Continuously ensure the URL reflects the active game PIN and TV status
  useEffect(() => {
    if (roomState?.code) {
      setGameUrl({ roomCode: roomState.code, isTv: isTvMode, mode: 'MULTI_DEVICE' });
    }
  }, [roomState?.code, isTvMode]);

  const copyTextToClipboard = async (text) => {
    if (!text) return false;
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, text.length);
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copied = true;
      } catch {
        copied = false;
      }
    }
    return copied;
  };

  const getDirectRoomUrl = () => {
    if (!roomState?.code) return window.location.origin;
    return `${window.location.origin}/${roomState.code}`;
  };

  const copyRoomCode = async () => {
    const codeToCopy = roomState?.code;
    if (!codeToCopy) return;
    await copyTextToClipboard(codeToCopy);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyDirectRoomLink = async () => {
    const url = getDirectRoomUrl();
    await copyTextToClipboard(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareDirectRoomLink = async () => {
    const url = getDirectRoomUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join Mafia Room ${roomState?.code}`,
          text: `Join our Mafia table (Room ${roomState?.code})!`,
          url,
        });
        return;
      } catch {
        // User cancelled or share failed; fall back to copying link
      }
    }
    await copyDirectRoomLink();
  };

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-noir-gradient flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl deco-panel p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-serif-title font-bold uppercase tracking-wider text-[#f5efe2]">
            Connection Notice
          </h2>
          <p className="text-sm text-stone-300">{errorMsg}</p>
          <button
            onClick={onBackHome}
            className="w-full py-3 rounded-xl deco-gold-btn font-serif-title font-bold uppercase tracking-widest text-xs sm:text-sm transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!roomState || !roomState.me) {
    return (
      <div className="min-h-screen bg-noir-gradient flex items-center justify-center p-4 select-none">
        <div className="max-w-md w-full deco-panel p-6 sm:p-8 rounded-3xl text-center space-y-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-[#c6a15b]/40">
          <div className="w-12 h-12 border-4 border-[#c6a15b] border-t-transparent rounded-full animate-spin mx-auto" />

          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-serif-title font-bold uppercase tracking-wider text-[#f5efe2]">
              {statusMsg || 'Connecting to Room...'}
            </h2>
            <p className="text-xs text-stone-400">
              Establishing real-time peer connection with the syndicate table.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.removeItem(APP_NAV_STORAGE_KEY);
                  localStorage.removeItem(APP_NAV_STORAGE_KEY);
                } catch {}
                if (networkRef.current) {
                  networkRef.current.destroy();
                }
                onBackHome();
              }}
              className="w-full py-2.5 px-4 rounded-xl deco-gold-btn font-serif-title font-bold text-xs uppercase tracking-widest transition"
            >
              Return to Front Page
            </button>

            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.removeItem(APP_NAV_STORAGE_KEY);
                  localStorage.removeItem(APP_NAV_STORAGE_KEY);
                  sessionStorage.removeItem(STORAGE_ROOM_KEY);
                  localStorage.removeItem(STORAGE_ROOM_KEY);
                } catch {}
                if (networkRef.current) {
                  networkRef.current.destroy();
                }
                onBackHome();
              }}
              className="w-full py-1.5 text-stone-500 hover:text-stone-300 text-[11px] font-serif-title uppercase tracking-wider transition"
            >
              Cancel & Clear Saved Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isTvMode && roomState) {
    return (
      <TvTheaterMode
        roomState={roomState}
        dispatch={(type, payload) => networkRef.current?.dispatch(type, payload)}
        onExit={() => {
          setIsTvMode(false);
          networkRef.current?.dispatch('exit_tv_to_player');
          setGameUrl({ roomCode: roomState.code, isTv: false, mode: 'MULTI_DEVICE' });
        }}
      />
    );
  }

  const {
    code,
    hostId,
    gameMasterId,
    phase,
    round,
    phaseExpiresAt,
    settings,
    players,
    me,
    nightProgress,
    lastDawnReport,
    lastVoteReport,
    logs,
    winner,
    winReason,
    serverIp,
  } = roomState;

  const isHost = me.id === hostId;
  const isGM = Boolean(me.isGameMaster || me.role === 'GAMEMASTER');
  const canControlFlow = isHost || isGM;
  const isMafia = me.role === 'MAFIA' || me.role === 'GODFATHER';

  const activeGmPlayer = players.find(
    (p) => p.isGameMaster || p.id === gameMasterId
  );
  const citizenPlayers = players.filter(
    (p) => !p.isGameMaster && p.id !== gameMasterId && p.role !== 'GAMEMASTER'
  );
  const fellowMafia = citizenPlayers.filter(
    (p) => p.role === 'MAFIA' || p.role === 'GODFATHER'
  );
  const alivePlayers = citizenPlayers.filter((p) => p.alive);
  const livingMafia = citizenPlayers.filter(
    (p) => p.alive && (p.role === 'MAFIA' || p.role === 'GODFATHER')
  );

  const hasHumanGmSetting = settings.gmMode && settings.gmMode !== 'NONE';
  const expectedCitizensInLobby = Math.max(
    0,
    players.length - (hasHumanGmSetting ? 1 : 0)
  );
  const minPlayersRequired = hasHumanGmSetting ? 5 : 4;

  const sendMafiaChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('mafia_chat', { text: chatInput });
    setChatInput('');
  };

  const updateGmSettings = (partial) => {
    if (!canControlFlow) return;
    socket.emit('update_settings', {
      settings: {
        ...settings,
        ...partial,
      },
    });
  };

  return (
    <div
      className={`min-h-screen pb-16 transition-colors duration-700 ${
        phase === 'NIGHT'
          ? 'bg-night-gradient'
          : phase === 'DAWN' || phase === 'DAY_DISCUSSION' || phase === 'DAY_VOTING'
          ? 'bg-day-gradient'
          : 'bg-noir-gradient'
      }`}
    >
      {/* Top Bar */}
      <header className="border-b border-[#c6a15b]/25 bg-[#0a0908]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              if (networkRef.current) {
                networkRef.current.clearHostStorage();
              }
              onBackHome();
            }}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-stone-300 hover:text-[#e5c365] font-serif-title uppercase tracking-wider transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[#c6a15b]" />
            <span className="sm:hidden">Exit</span>
            <span className="hidden sm:inline">Leave Room</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {activeGmPlayer && phase !== 'LOBBY' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#c6a15b]/15 border border-[#c6a15b]/40 text-xs font-serif-title uppercase tracking-wider font-bold text-[#e5c365] max-w-[130px] sm:max-w-none truncate">
                <Wand2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">GM: {activeGmPlayer.name}</span>
              </span>
            )}

            <button
              type="button"
              onClick={copyRoomCode}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900 border border-[#c6a15b]/35 text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365] hover:border-[#e5c365] transition shrink-0"
              title="Tap to Copy Room Code"
            >
              <span>ROOM: {code}</span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-stone-400" />
              )}
            </button>

            <button
              type="button"
              onClick={shareDirectRoomLink}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900 border border-[#c6a15b]/35 text-xs font-serif-title font-bold uppercase tracking-wider text-stone-300 hover:text-[#e5c365] hover:border-[#e5c365] transition shrink-0"
              title="Share or Copy Direct Room Link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline text-emerald-300">Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#c6a15b]" />
                  <span className="hidden sm:inline">Invite Link</span>
                </>
              )}
            </button>

            {phase !== 'LOBBY' && me.role && (
              <button
                type="button"
                onClick={() => setHideMyRole((h) => !h)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 border border-[#c6a15b]/40 text-xs font-serif-title uppercase tracking-wider text-[#f5efe2] hover:border-[#e5c365] transition shrink-0"
                title={hideMyRole ? 'Reveal Secret Role' : 'Hide Secret Role'}
              >
                {hideMyRole ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-[#e5c365]" />
                    <span>Reveal Role</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>Hide Role</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* LOBBY PHASE */}
        {phase === 'LOBBY' && (
          <div className="space-y-6">
            {/* Room Code Banner */}
            <div className="rounded-2xl deco-panel p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3 text-center md:text-left">
                <div className="inline-flex items-center gap-2 text-xs font-serif-title uppercase tracking-[0.18em] text-[#e5c365] font-bold">
                  <Wifi className="w-4 h-4 text-[#c6a15b]" />
                  Mode I • Multi-Device Party Lobby
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                  Invite Players to Join on Their Phones
                </h1>
                <p className="text-xs sm:text-sm text-stone-300 max-w-xl leading-relaxed">
                  Have players open{' '}
                  <span className="font-mono text-[#e5c365] bg-stone-950 px-2 py-0.5 rounded border border-[#c6a15b]/30">
                    {window.location.origin}
                  </span>{' '}
                  and enter the 4-letter Room Code below, or tap Share Link:
                </p>
              </div>

              {/* PIN Card + Share Action */}
              <div className="flex flex-col items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <div
                  onClick={copyRoomCode}
                  className="cursor-pointer group px-8 py-5 rounded-2xl bg-stone-950/90 border-2 border-[#c6a15b]/60 hover:border-[#e5c365] text-center transition shadow-[0_0_25px_rgba(198,161,91,0.15)] w-full sm:w-auto"
                >
                  <div className="text-[11px] font-serif-title uppercase tracking-[0.2em] text-stone-400">
                    Room Code
                  </div>
                  <div className="text-4xl sm:text-5xl font-serif-title font-black tracking-[0.22em] text-[#e5c365] mt-1">
                    {code}
                  </div>
                  <div className="text-[11px] font-serif-title uppercase tracking-wider text-[#c6a15b] mt-1.5 flex items-center justify-center gap-1">
                    {copiedCode ? 'Copied!' : 'Tap to copy code'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={shareDirectRoomLink}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/40 text-[#e5c365] font-serif-title font-bold text-xs uppercase tracking-widest transition shadow-sm"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-[#c6a15b]" />
                      Share Room Link
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsTvMode(true);
                    networkRef.current?.dispatch('register_tv_gm');
                    setGameUrl({ roomCode: code, isTv: true, mode: 'MULTI_DEVICE' });
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-[#e5c365] font-serif-title font-bold text-xs uppercase tracking-wider transition shadow-sm"
                  title="Switch this device into the TV Theater & Game Master display"
                >
                  <Tv className="w-4 h-4 text-[#e5c365]" />
                  Switch this Screen to TV (GM)
                </button>
              </div>
            </div>

            {/* Game Master Selection Card */}
            {isHost ? (
              <div className="rounded-2xl deco-panel p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c6a15b]/20 pb-3.5">
                  <div>
                    <h2 className="text-sm sm:text-base font-serif-title font-bold uppercase tracking-[0.16em] text-[#e5c365] flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-[#c6a15b]" />
                      Game Master (Narrator) Mode
                    </h2>
                    <p className="text-xs text-stone-300 mt-1">
                      Choose whether the app runs everything automatically so everyone plays, or
                      assign / randomly draw a player to be the all-seeing Game Master.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => socket.emit('draw_random_gm')}
                    className="inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/40 text-[#e5c365] font-serif-title font-bold uppercase tracking-wider transition"
                  >
                    <Dices className="w-4 h-4 text-[#c6a15b]" />
                    Draw Random GM Now
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => updateGmSettings({ gmMode: 'NONE' })}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      (!settings.gmMode || settings.gmMode === 'NONE')
                        ? 'bg-[#c6a15b]/20 border-[#e5c365] text-[#f5efe2] shadow-[0_0_20px_rgba(198,161,91,0.18)]'
                        : 'bg-stone-900/80 border-[#c6a15b]/20 text-stone-300 hover:border-[#c6a15b]/50'
                    }`}
                  >
                    <div className="font-serif-title font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#e5c365]">
                      <Cpu className="w-4 h-4" />
                      Automated App GM
                    </div>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Everyone in the lobby plays as a citizen! The app moderates automatically.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateGmSettings({
                        gmMode: 'ASSIGNED',
                        assignedGmPlayerId: settings.assignedGmPlayerId || hostId,
                      })
                    }
                    className={`p-3.5 rounded-xl border text-left transition ${
                      settings.gmMode === 'ASSIGNED'
                        ? 'bg-[#c6a15b]/20 border-[#e5c365] text-[#f5efe2] shadow-[0_0_20px_rgba(198,161,91,0.18)]'
                        : 'bg-stone-900/80 border-[#c6a15b]/20 text-stone-300 hover:border-[#c6a15b]/50'
                    }`}
                  >
                    <div className="font-serif-title font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#e5c365]">
                      <UserCheck className="w-4 h-4" />
                      Assign Specific Person
                    </div>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Pick a specific player in the lobby to receive the all-seeing Game Master
                      screen.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateGmSettings({ gmMode: 'RANDOM' })}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      settings.gmMode === 'RANDOM'
                        ? 'bg-[#c6a15b]/20 border-[#e5c365] text-[#f5efe2] shadow-[0_0_20px_rgba(198,161,91,0.18)]'
                        : 'bg-stone-900/80 border-[#c6a15b]/20 text-stone-300 hover:border-[#c6a15b]/50'
                    }`}
                  >
                    <div className="font-serif-title font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#e5c365]">
                      <Dices className="w-4 h-4" />
                      Draw Between Players
                    </div>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Randomly draws one human player to be the Game Master when the game starts.
                    </p>
                  </button>
                </div>

                {settings.gmMode === 'ASSIGNED' && (
                  <div className="pt-3 border-t border-[#c6a15b]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-serif-title uppercase tracking-wider text-[#e5c365] font-bold">
                      Selected Game Master:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {players.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            updateGmSettings({
                              gmMode: 'ASSIGNED',
                              assignedGmPlayerId: p.id,
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            settings.assignedGmPlayerId === p.id
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

                {hasHumanGmSetting && (
                  <div className="pt-3 border-t border-[#c6a15b]/20 space-y-2">
                    <div className="text-xs font-serif-title uppercase tracking-wider text-[#e5c365] font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#c6a15b]" />
                      Night Narration Style:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateGmSettings({ verbalNight: false })}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          !settings.verbalNight
                            ? 'bg-[#c6a15b]/20 border-[#e5c365] text-[#f5efe2]'
                            : 'bg-stone-900/80 border-[#c6a15b]/20 text-stone-300 hover:border-[#c6a15b]/40'
                        }`}
                      >
                        <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365]">
                          📱 Digital Night (Default)
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          Citizens submit secret night actions on their own phones.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateGmSettings({ verbalNight: true })}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          settings.verbalNight
                            ? 'bg-[#c6a15b]/20 border-[#e5c365] text-[#f5efe2]'
                            : 'bg-stone-900/80 border-[#c6a15b]/20 text-stone-300 hover:border-[#c6a15b]/40'
                        }`}
                      >
                        <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365]">
                          🗣️ Verbal Role-Drop (Tabletop)
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          Players inspect role once & pocket phone. GM narrates out loud.
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Non-Host View: Clean Game Master Status Banner */
              <div className="rounded-2xl deco-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#c6a15b]/15 border border-[#c6a15b]/40 flex items-center justify-center shrink-0">
                    <Wand2 className="w-4 h-4 text-[#e5c365]" />
                  </div>
                  <div>
                    <div className="text-xs font-serif-title uppercase tracking-wider text-[#e5c365] font-bold">
                      Game Master (Narrator) Setup
                    </div>
                    <div className="text-xs text-stone-300">
                      {(!settings.gmMode || settings.gmMode === 'NONE') &&
                        'Automated App GM • Everyone plays as a citizen'}
                      {settings.gmMode === 'ASSIGNED' && (
                        <>
                          Dedicated Game Master:{' '}
                          <span className="font-bold text-[#f5efe2]">
                            {players.find((p) => p.id === settings.assignedGmPlayerId)?.name ||
                              'Host'}
                          </span>
                          {settings.verbalNight && (
                            <span className="text-[#e5c365] ml-1.5 font-semibold">
                              (🗣️ Verbal Night: Pocket phone after checking role)
                            </span>
                          )}
                        </>
                      )}
                      {settings.gmMode === 'RANDOM' && (
                        <>
                          Random Draw • A Game Master will be chosen at game start
                          {settings.verbalNight && (
                            <span className="text-[#e5c365] ml-1.5 font-semibold">
                              (🗣️ Verbal Night)
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-serif-title uppercase tracking-wider text-stone-400 self-start sm:self-auto px-2.5 py-1 rounded-full bg-stone-900 border border-stone-800">
                  Host Controls
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Connected Players */}
              <div className="lg:col-span-7 rounded-2xl deco-panel p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c6a15b]/20 pb-3">
                  <div>
                    <h2 className="text-base font-serif-title font-bold uppercase tracking-wider text-[#f5efe2] flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#c6a15b]" />
                      Players in Lobby ({players.length})
                    </h2>
                    <p className="text-xs text-stone-400">
                      {hasHumanGmSetting
                        ? `1 Game Master + ${expectedCitizensInLobby} Citizens`
                        : `${players.length} Citizens (Automated GM)`}
                    </p>
                  </div>

                  {isHost && (
                    <button
                      type="button"
                      onClick={() => socket.emit('add_bot')}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-[#e5c365] border border-[#c6a15b]/40 font-serif-title font-bold uppercase tracking-wider transition"
                    >
                      <Bot className="w-4 h-4 text-[#c6a15b]" />
                      + Add AI Bot
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {players.map((p) => {
                    const isDesignatedGm =
                      settings.gmMode === 'ASSIGNED' &&
                      settings.assignedGmPlayerId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          isDesignatedGm
                            ? 'bg-[#c6a15b]/15 border-[#e5c365]/60'
                            : p.id === me.id
                            ? 'bg-stone-900/95 border-[#c6a15b]/50'
                            : 'bg-stone-950/85 border-[#c6a15b]/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              p.connected ? 'bg-emerald-400' : 'bg-stone-600'
                            }`}
                          />
                          {p.id === me.id && isEditingMyName ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const clean = editingNameInput.trim();
                                if (clean) {
                                  socket.emit('update_player_name', { name: clean });
                                  try {
                                    localStorage.setItem('mafia_player_name', clean);
                                  } catch {}
                                }
                                setIsEditingMyName(false);
                              }}
                              className="flex items-center gap-1.5"
                            >
                              <input
                                type="text"
                                autoFocus
                                value={editingNameInput}
                                onChange={(e) => setEditingNameInput(e.target.value)}
                                className="px-2 py-0.5 rounded bg-black border border-[#e5c365] text-xs text-white max-w-[110px]"
                              />
                              <button
                                type="submit"
                                className="text-[10px] px-2 py-0.5 rounded deco-gold-btn font-serif-title font-bold uppercase tracking-wider"
                              >
                                Save
                              </button>
                            </form>
                          ) : (
                            <span className="font-semibold text-sm text-[#f5efe2] truncate flex items-center gap-1.5">
                              {p.name}
                              {p.id === me.id && !p.isTvDisplay && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNameInput(p.name);
                                    setIsEditingMyName(true);
                                  }}
                                  className="text-stone-400 hover:text-[#e5c365] transition p-0.5"
                                  title="Edit your name"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          )}
                          {isDesignatedGm && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#c6a15b]/25 text-[#e5c365] border border-[#c6a15b]/50 font-serif-title font-bold uppercase tracking-wider">
                              GM
                            </span>
                          )}
                          {p.isTvDisplay && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-[#e5c365] border border-amber-400/40 font-serif-title font-bold uppercase tracking-wider flex items-center gap-1">
                              <Tv className="w-3 h-3" />
                              TV
                            </span>
                          )}
                          {p.id === hostId && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-[#e5c365] border border-[#c6a15b]/35 font-serif-title font-bold uppercase tracking-wider">
                              HOST
                            </span>
                          )}
                          {p.id === me.id && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-serif-title font-bold uppercase tracking-wider">
                              YOU
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {isHost && !p.isBot && !isDesignatedGm && (
                            <button
                              type="button"
                              onClick={() =>
                                updateGmSettings({
                                  gmMode: 'ASSIGNED',
                                  assignedGmPlayerId: p.id,
                                })
                              }
                              className="text-[10px] px-2 py-1 rounded bg-stone-900 hover:bg-[#c6a15b]/25 text-stone-300 hover:text-[#e5c365] border border-[#c6a15b]/25 font-serif-title uppercase tracking-wider transition"
                              title="Assign as Game Master"
                            >
                              Make GM
                            </button>
                          )}
                          {isHost && p.id !== hostId && (
                            <button
                              type="button"
                              onClick={() =>
                                socket.emit('remove_player', { targetPlayerId: p.id })
                              }
                              className="text-stone-400 hover:text-rose-400 p-1 transition"
                              title="Remove Player"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-3.5 rounded-xl bg-stone-950/90 border border-[#c6a15b]/20 text-xs text-stone-300">
                  💡 <strong className="text-[#e5c365]">Tip:</strong> Want to test the game solo or fill missing seats?
                  Click <strong className="text-[#f5efe2]">+ Add AI Bot</strong> above to add smart AI citizens
                  who vote and perform night actions automatically!
                </div>
              </div>

              {/* Role Settings & Start Button */}
              <div className="lg:col-span-5 space-y-4">
                <RoleSettingsEditor
                  playerCount={expectedCitizensInLobby}
                  settings={settings}
                  onUpdateSettings={(nextSettings) =>
                    socket.emit('update_settings', { settings: nextSettings })
                  }
                  isEditable={canControlFlow}
                />

                {canControlFlow ? (
                  <button
                    type="button"
                    disabled={players.length < minPlayersRequired}
                    onClick={() =>
                      socket.emit('start_game', {}, (res) => {
                        if (res && !res.ok) alert(res.error);
                      })
                    }
                    className="w-full py-4 rounded-2xl deco-gold-btn disabled:opacity-40 font-serif-title font-black uppercase tracking-widest text-sm sm:text-base flex items-center justify-center gap-2 transition"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {players.length < minPlayersRequired
                      ? `Need ${minPlayersRequired - players.length} More Player(s) or Bots`
                      : settings.gmMode === 'RANDOM'
                      ? 'Draw Game Master & Deal Roles'
                      : 'Deal Secret Roles & Start Game'}
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl deco-panel text-center text-xs sm:text-sm font-serif-title uppercase tracking-wider text-stone-300">
                    Waiting for the Host to start the game...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE GAME AREA */}
        {phase !== 'LOBBY' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left / Main Action Area */}
            <div className="lg:col-span-8 space-y-6">
              {/* ROLE REVEAL PHASE */}
              {phase === 'ROLE_REVEAL' && (
                <div className="rounded-2xl deco-panel p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-[#c6a15b]/20 pb-3">
                    <span className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                      Confidential • Secret Assignment
                    </span>
                    <span className="text-xs font-serif-title uppercase tracking-wider text-stone-400">
                      {players.filter((p) => p.ready).length} / {players.length} Ready
                    </span>
                  </div>

                  {activeGmPlayer && (
                    <div className="p-3.5 rounded-xl bg-stone-950/90 border border-[#c6a15b]/35 flex items-center justify-between text-xs text-[#e5c365]">
                      <span className="flex items-center gap-2 font-serif-title uppercase tracking-wider font-bold">
                        <Wand2 className="w-4 h-4 text-[#c6a15b]" />
                        Game Master for this match: <strong className="text-[#f5efe2]">{activeGmPlayer.name}</strong>
                      </span>
                    </div>
                  )}

                  {hideMyRole ? (
                    <ArtDecoCardBack
                      playerName={me.name}
                      subtitle="Secret Role Hidden for Privacy — Click Below to Inspect"
                      buttonLabel="Reveal Role"
                      onClick={() => setHideMyRole(false)}
                    />
                  ) : (
                    <div>
                      <RoleCard
                        roleId={me.role}
                        imageUrl={me.roleImage}
                        variantIndex={me.roleVariantIndex}
                        fellowMafia={isMafia ? fellowMafia : []}
                        actionLabel="Hide Role"
                        onAction={() => setHideMyRole(true)}
                        onClick={() => setHideMyRole(true)}
                      />
                    </div>
                  )}

                  {isGM && (
                    <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/35 space-y-2.5">
                      <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365]">
                        All-Seeing Game Master Overview
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {citizenPlayers.map((cp) => (
                          <div
                            key={cp.id}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-stone-900/90 border border-[#c6a15b]/20 text-xs"
                          >
                            <span className="font-semibold text-[#f5efe2]">{cp.name}</span>
                            <RoleBadge roleId={cp.role} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!me.ready ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHideMyRole(true);
                        socket.emit('player_ready_role');
                      }}
                      className="w-full py-4 rounded-2xl deco-gold-btn font-serif-title font-black uppercase tracking-widest text-sm sm:text-base transition"
                    >
                      I Understand My Role — Ready for Night 1
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/35 text-center text-sm font-serif-title uppercase tracking-wider text-emerald-300">
                      {secondsLeft > 0
                        ? `All players ready! Night 1 begins in ${secondsLeft}s...`
                        : '✓ You are ready! Waiting for remaining players...'}
                    </div>
                  )}
                </div>
              )}

              {/* NIGHT PHASE */}
              {phase === 'NIGHT' && (
                <div className="rounded-2xl deco-panel p-6 sm:p-8 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c6a15b]/20 pb-4">
                    <div className="flex items-center gap-2.5">
                      <Moon className="w-6 h-6 text-[#e5c365]" />
                      <h2 className="text-xl sm:text-2xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                        Night {round} — Shadows Over the City
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-serif-title uppercase tracking-wider">
                      <span
                        className={`px-2.5 py-1 rounded-full border ${
                          nightProgress.mafiaDone
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                            : 'bg-stone-900 text-stone-400 border-[#c6a15b]/25'
                        }`}
                      >
                        Mafia {nightProgress.mafiaDone ? '✓' : '•••'}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full border ${
                          nightProgress.doctorDone
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                            : 'bg-stone-900 text-stone-400 border-[#c6a15b]/25'
                        }`}
                      >
                        Doctor {nightProgress.doctorDone ? '✓' : '•••'}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full border ${
                          nightProgress.detectiveDone
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                            : 'bg-stone-900 text-stone-400 border-[#c6a15b]/25'
                        }`}
                      >
                        Detective {nightProgress.detectiveDone ? '✓' : '•••'}
                      </span>
                    </div>
                  </div>

                  {secondsLeft > 0 && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-center text-xs font-serif-title uppercase tracking-widest text-emerald-300 flex items-center justify-center gap-2 animate-pulse">
                      <Moon className="w-4 h-4" />
                      <span>All night actions confirmed. Dawn breaks in {secondsLeft}s...</span>
                    </div>
                  )}

                  {/* GAME MASTER LIVE NIGHT MONITOR */}
                  {isGM ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/35 text-sm text-stone-200">
                        <strong className="text-[#e5c365]">Game Master Night Monitor:</strong> Watch live as players
                        submit their night actions on their phones, or narrate the night
                        aloud!
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-xl bg-stone-950/90 border border-rose-500/35 space-y-1">
                          <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-rose-400">
                            Mafia Target Votes
                          </div>
                          {Object.keys(me.allMafiaVotes || {}).length === 0 ? (
                            <p className="text-xs text-stone-400">Choosing target...</p>
                          ) : (
                            Object.entries(me.allMafiaVotes || {}).map(
                              ([voterId, targetId]) => {
                                const voter = players.find((p) => p.id === voterId);
                                const target = players.find((p) => p.id === targetId);
                                return (
                                  <div key={voterId} className="text-xs text-stone-200">
                                    {voter?.name} → <strong className="text-[#f5efe2]">{target?.name}</strong>
                                  </div>
                                );
                              }
                            )
                          )}
                        </div>

                        <div className="p-4 rounded-xl bg-stone-950/90 border border-emerald-500/35 space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-emerald-400">
                              Doctor Protection
                            </div>
                            <div className="text-xs text-stone-200 mt-1">
                              {me.myDoctorTarget
                                ? `Protecting: ${
                                    players.find((p) => p.id === me.myDoctorTarget)?.name
                                  }`
                                : nightProgress.doctorDone
                                ? 'Skipped / Done'
                                : 'Choosing target...'}
                            </div>
                          </div>
                          {!nightProgress.doctorDone && (
                            <button
                              type="button"
                              onClick={() =>
                                socket.emit('gm_skip_night_role', { roleId: 'DOCTOR' })
                              }
                              className="w-full py-1.5 px-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/35 text-[11px] font-serif-title uppercase tracking-wider font-bold text-[#e5c365] transition"
                            >
                              Skip Doctor&apos;s Turn
                            </button>
                          )}
                        </div>

                        <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/35 space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365]">
                              Detective Check
                            </div>
                            <div className="text-xs text-stone-200 mt-1">
                              {me.myDetectiveTarget
                                ? `Inspected: ${
                                    players.find((p) => p.id === me.myDetectiveTarget)?.name
                                  }`
                                : nightProgress.detectiveDone
                                ? 'Skipped / Done'
                                : 'Choosing target...'}
                            </div>
                          </div>
                          {!nightProgress.detectiveDone && (
                            <button
                              type="button"
                              onClick={() =>
                                socket.emit('gm_skip_night_role', {
                                  roleId: 'DETECTIVE',
                                })
                              }
                              className="w-full py-1.5 px-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/35 text-[11px] font-serif-title uppercase tracking-wider font-bold text-[#e5c365] transition"
                            >
                              Skip Detective&apos;s Turn
                            </button>
                          )}
                        </div>
                      </div>
                      {/* If Verbal Mode is active, GM can directly tap targets on the tablet/phone while narrating aloud */}
                      {settings.verbalNight && (
                        <div className="p-4 rounded-xl bg-[#c6a15b]/15 border-2 border-[#e5c365] space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-serif-title uppercase tracking-wider text-[#e5c365] font-bold flex items-center gap-1.5">
                              🗣️ Verbal Script Controls (Narrate Aloud & Tap)
                            </span>
                            <span className="text-[11px] text-stone-300">
                              Citizens are in face-down pocket mode
                            </span>
                          </div>

                          {/* 1. Mafia Call */}
                          <div className="p-3 rounded-lg bg-stone-900 border border-rose-500/30 space-y-2">
                            <div className="text-xs font-bold text-rose-300 flex items-center justify-between">
                              <span>1. &quot;Mafia, open your eyes and point to your victim...&quot;</span>
                              {nightProgress.mafiaDone && <span className="text-emerald-400">✓ Target Selected</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {citizenPlayers.map((p) => {
                                const isMafiaAlly = p.role === 'MAFIA' || p.role === 'GODFATHER';
                                if (!p.alive || isMafiaAlly) return null;
                                const isTarget = Object.values(me.allMafiaVotes || {}).includes(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() =>
                                      socket.emit('gm_record_night_action', {
                                        roleId: 'MAFIA',
                                        targetId: p.id,
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded text-xs border transition ${
                                      isTarget
                                        ? 'bg-rose-900/90 border-rose-400 text-white font-bold'
                                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-rose-400'
                                    }`}
                                  >
                                    {p.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 2. Doctor Call */}
                          <div className="p-3 rounded-lg bg-stone-900 border border-emerald-500/30 space-y-2">
                            <div className="text-xs font-bold text-emerald-300 flex items-center justify-between">
                              <span>2. &quot;Doctor, wake up and point to who you wish to save...&quot;</span>
                              {nightProgress.doctorDone && <span className="text-emerald-400">✓ Protected</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {citizenPlayers.map((p) => {
                                if (!p.alive) return null;
                                const isTarget = me.myDoctorTarget === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() =>
                                      socket.emit('gm_record_night_action', {
                                        roleId: 'DOCTOR',
                                        targetId: p.id,
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded text-xs border transition ${
                                      isTarget
                                        ? 'bg-emerald-900/90 border-emerald-400 text-white font-bold'
                                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-emerald-400'
                                    }`}
                                  >
                                    {p.name}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() =>
                                  socket.emit('gm_skip_night_role', { roleId: 'DOCTOR' })
                                }
                                className="px-2.5 py-1 rounded text-xs bg-stone-800 text-stone-400 hover:text-white border border-stone-700"
                              >
                                Skip Doctor
                              </button>
                            </div>
                          </div>

                          {/* 3. Detective Call */}
                          <div className="p-3 rounded-lg bg-stone-900 border border-blue-500/30 space-y-2">
                            <div className="text-xs font-bold text-blue-300 flex items-center justify-between">
                              <span>3. &quot;Detective, wake up and point to a suspect...&quot;</span>
                              {nightProgress.detectiveDone && <span className="text-emerald-400">✓ Inspected</span>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {citizenPlayers.map((p) => {
                                if (!p.alive) return null;
                                const isTarget = me.myDetectiveTarget === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() =>
                                      socket.emit('gm_record_night_action', {
                                        roleId: 'DETECTIVE',
                                        targetId: p.id,
                                      })
                                    }
                                    className={`px-2.5 py-1 rounded text-xs border transition ${
                                      isTarget
                                        ? 'bg-blue-900/90 border-blue-400 text-white font-bold'
                                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-blue-400'
                                    }`}
                                  >
                                    {p.name} ({ROLES[p.role]?.investigativeResult || 'INNOCENT'})
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() =>
                                  socket.emit('gm_skip_night_role', { roleId: 'DETECTIVE' })
                                }
                                className="px-2.5 py-1 rounded text-xs bg-stone-800 text-stone-400 hover:text-white border border-stone-700"
                              >
                                Skip Detective
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : !me.alive ? (
                    <div className="p-6 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/25 text-center space-y-2">
                      <Skull className="w-8 h-8 text-stone-500 mx-auto" />
                      <h3 className="text-lg font-serif-title font-bold uppercase tracking-wider text-[#f5efe2]">
                        You Have Been Eliminated
                      </h3>
                      <p className="text-xs text-stone-400">
                        Watch silently from the afterlife as the living perform their night
                        actions.
                      </p>
                    </div>
                  ) : settings.verbalNight ? (
                    /* VERBAL TABLETOP NIGHT — POCKET PHONE MODE */
                    <div className="p-8 sm:p-10 rounded-2xl bg-[#090807] border-2 border-[#c6a15b]/35 text-center space-y-4 shadow-[inset_0_0_50px_rgba(0,0,0,0.85)]">
                      <div className="w-16 h-16 rounded-full bg-[#c6a15b]/10 border border-[#c6a15b]/40 flex items-center justify-center mx-auto text-2xl">
                        🤫
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-xl sm:text-2xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                          Town, Close Your Eyes
                        </h3>
                        <p className="text-xs sm:text-sm text-[#e5c365] font-serif-title uppercase tracking-widest font-bold">
                          Verbal Tabletop Mode • Put your phone face-down
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-stone-400 max-w-md mx-auto leading-relaxed">
                        The Game Master (<strong className="text-[#f5efe2]">{activeGmPlayer?.name || 'Narrator'}</strong>) is conducting the night aloud. Listen carefully and wake up only when your secret role is summoned!
                      </p>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setHideMyRole((h) => !h)}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-900 border border-[#c6a15b]/35 hover:border-[#c6a15b] text-xs text-stone-300 transition"
                          title="Click to toggle role visibility"
                        >
                          <span className="font-serif-title uppercase tracking-wider text-xs">Your Secret Role:</span>
                          {hideMyRole ? (
                            <span className="text-stone-400 font-mono tracking-widest flex items-center gap-1.5">
                              •••••• <Eye className="w-3.5 h-3.5 text-[#e5c365]" />
                            </span>
                          ) : (
                            <strong className="text-[#e5c365] flex items-center gap-1.5">
                              {ROLES[me.role]?.name || me.role} <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                            </strong>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : isMafia ? (
                    /* MAFIA & GODFATHER NIGHT UI */
                    <div className="space-y-5">
                      <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/35 text-sm text-rose-200">
                        <strong className="text-rose-300 font-serif-title uppercase tracking-wider">Syndicate Strike:</strong> Choose a target to eliminate
                        tonight. All living Mafia must lock in and confirm to sleep.
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {citizenPlayers.map((p) => {
                          const isMafiaAlly =
                            p.role === 'MAFIA' || p.role === 'GODFATHER';
                          const isDisabled = !p.alive || isMafiaAlly || me.isMafiaConfirmed;
                          const selected = me.myMafiaVote === p.id;
                          const votesForThisPlayer = Object.entries(
                            me.allMafiaVotes || {}
                          )
                            .filter(([, targetId]) => targetId === p.id)
                            .map(([voterId]) => {
                              const v = players.find((pl) => pl.id === voterId);
                              return v ? v.name : 'Mafia';
                            });

                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() =>
                                socket.emit('night_action', { targetId: p.id })
                              }
                              className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed ${
                                selected
                                  ? 'bg-rose-600/25 border-rose-500 text-[#f5efe2] shadow-[0_0_20px_rgba(225,29,72,0.2)]'
                                  : 'bg-stone-950/85 border-[#c6a15b]/25 text-stone-200 hover:border-[#c6a15b]/60'
                              }`}
                            >
                              <div>
                                <div className="font-semibold text-sm flex items-center gap-2">
                                  <span className={!p.alive ? 'line-through text-stone-500' : 'text-[#f5efe2]'}>
                                    {p.name}
                                  </span>
                                  {!p.alive && <span>💀</span>}
                                  {p.alive && isMafiaAlly && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-serif-title uppercase tracking-wider">
                                      Awake • Ally
                                    </span>
                                  )}
                                </div>
                                {votesForThisPlayer.length > 0 && (
                                  <div className="text-[11px] text-rose-300 mt-0.5">
                                    Targeted by: {votesForThisPlayer.join(', ')}
                                  </div>
                                )}
                              </div>
                              <Skull
                                className={`w-4 h-4 ${
                                  selected ? 'text-rose-400' : 'text-stone-600'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      {/* Mafia Confirmation Action Bar */}
                      <div className="p-4 rounded-xl bg-stone-950/90 border border-rose-500/35 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-rose-400">
                              Syndicate Readiness
                            </div>
                            <div className="text-xs text-stone-300 mt-0.5">
                              {livingMafia.filter((m) => me.allMafiaConfirmed?.[m.id]).length} of {livingMafia.length} Mafia confirmed & sleeping
                            </div>
                          </div>

                          {me.isMafiaConfirmed ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-serif-title uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Target Locked
                              </span>
                              <button
                                type="button"
                                onClick={() => socket.emit('unconfirm_night_action')}
                                className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-rose-500/40 text-rose-300 text-xs font-serif-title uppercase tracking-wider font-bold transition"
                              >
                                Change Target
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!me.myMafiaVote}
                              onClick={() => socket.emit('confirm_night_action')}
                              className="px-5 py-2.5 rounded-xl deco-gold-btn disabled:opacity-40 font-serif-title font-black uppercase tracking-wider text-xs transition flex items-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                            >
                              <Moon className="w-4 h-4" />
                              <span>Confirm Target & Sleep</span>
                            </button>
                          )}
                        </div>

                        {!me.myMafiaVote && !me.isMafiaConfirmed && (
                          <p className="text-[11px] text-stone-400 italic">
                            Select a citizen target above, then click &quot;Confirm Target &amp; Sleep&quot;.
                          </p>
                        )}
                      </div>

                      {/* Secret Mafia Night Chat */}
                      <div className="rounded-xl bg-stone-950/90 border border-[#c6a15b]/30 p-4 space-y-3">
                        <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-rose-400">
                          Encrypted Syndicate Chat
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1.5 text-xs">
                          {(me.mafiaChat || []).length === 0 ? (
                            <p className="text-stone-500 italic">
                              Whisper to your fellow Mafia members here...
                            </p>
                          ) : (
                            me.mafiaChat.map((m, i) => (
                              <div key={i} className="text-stone-200">
                                <span className="font-bold text-rose-400">
                                  {m.senderName}:{' '}
                                </span>
                                <span>{m.text}</span>
                              </div>
                            ))
                          )}
                        </div>
                        <form onSubmit={sendMafiaChat} className="flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Message fellow Mafia..."
                            className="flex-1 rounded-lg bg-stone-900 border border-[#c6a15b]/30 px-3 py-2 text-xs text-[#f5efe2] placeholder:text-stone-500 focus:outline-none focus:border-[#e5c365]"
                          />
                          <button
                            type="submit"
                            className="px-3.5 py-2 rounded-lg deco-gold-btn font-serif-title font-bold uppercase tracking-wider text-xs inline-flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Send
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : me.role === 'DOCTOR' ? (
                    /* DOCTOR NIGHT UI */
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/35 text-sm text-emerald-200">
                        <strong className="text-emerald-300 font-serif-title uppercase tracking-wider">Medical Protection:</strong> Choose one citizen to protect
                        from a Mafia attack tonight. Confirm when ready to sleep.
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {citizenPlayers.map((p) => {
                          const disabledSelf =
                            !settings.doctorSelfSave && p.id === me.id;
                          const isDisabled = !p.alive || disabledSelf || me.doctorSubmitted;
                          const selected = me.myDoctorTarget === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() =>
                                socket.emit('night_action', { targetId: p.id })
                              }
                              className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed ${
                                selected
                                  ? 'bg-emerald-600/25 border-emerald-400 text-[#f5efe2] shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                  : 'bg-stone-950/85 border-[#c6a15b]/25 text-stone-200 hover:border-[#c6a15b]/60'
                              }`}
                            >
                              <span className="font-semibold text-sm flex items-center gap-1.5">
                                <span className={!p.alive ? 'line-through text-stone-500' : 'text-[#f5efe2]'}>
                                  {p.name}
                                </span>
                                {p.id === me.id && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-serif-title uppercase tracking-wider">
                                    Doctor (Awake)
                                  </span>
                                )}
                                {!p.alive && <span>💀</span>}
                              </span>
                              <Shield
                                className={`w-4 h-4 ${
                                  selected ? 'text-emerald-400' : 'text-stone-600'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      {/* Doctor Confirmation Bar */}
                      <div className="p-4 rounded-xl bg-stone-950/90 border border-emerald-500/35 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-emerald-400">
                              Medical Order
                            </div>
                            <div className="text-xs text-stone-300 mt-0.5">
                              {me.myDoctorTarget
                                ? `Protecting: ${players.find((p) => p.id === me.myDoctorTarget)?.name}`
                                : 'No citizen selected yet'}
                            </div>
                          </div>

                          {me.doctorSubmitted ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-serif-title uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Protection Confirmed
                              </span>
                              <button
                                type="button"
                                onClick={() => socket.emit('unconfirm_night_action')}
                                className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-emerald-500/40 text-emerald-300 text-xs font-serif-title uppercase tracking-wider font-bold transition"
                              >
                                Change Target
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!me.myDoctorTarget}
                              onClick={() => socket.emit('confirm_night_action')}
                              className="px-5 py-2.5 rounded-xl deco-gold-btn disabled:opacity-40 font-serif-title font-black uppercase tracking-wider text-xs transition flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            >
                              <Shield className="w-4 h-4" />
                              <span>Confirm Protection & Sleep</span>
                            </button>
                          )}
                        </div>

                        {!me.myDoctorTarget && !me.doctorSubmitted && (
                          <p className="text-[11px] text-stone-400 italic">
                            Select a citizen to protect above, then click &quot;Confirm Protection &amp; Sleep&quot;.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : me.role === 'DETECTIVE' ? (
                    /* DETECTIVE NIGHT UI */
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/35 text-sm text-stone-200">
                        <strong className="text-[#e5c365] font-serif-title uppercase tracking-wider">Background Investigation:</strong> Inspect one player tonight
                        to learn if they belong to the Mafia. (Note: The Godfather appears
                        Innocent!)
                      </div>

                      {/* 1. Choose Suspect (if not chosen yet) */}
                      {(() => {
                        const currentRoundInv = (me.investigations || []).find((inv) => inv.round === round);
                        return !currentRoundInv ? (
                          <div className="space-y-2">
                            <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365]">
                              Choose Suspect to Inspect:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {citizenPlayers.map((p) => {
                                const isSelf = p.id === me.id;
                                const isDisabled = !p.alive || isSelf;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() =>
                                      socket.emit('night_action', { targetId: p.id })
                                    }
                                    className="p-3.5 rounded-xl border bg-stone-950/85 border-[#c6a15b]/25 text-stone-200 hover:border-[#e5c365] disabled:opacity-35 disabled:cursor-not-allowed text-left transition flex items-center justify-between"
                                  >
                                    <span className="font-semibold text-sm flex items-center gap-1.5">
                                      <span className={!p.alive ? 'line-through text-stone-500' : 'text-[#f5efe2]'}>
                                        {p.name}
                                      </span>
                                      {isSelf && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c6a15b]/20 text-[#e5c365] border border-[#c6a15b]/35 font-serif-title uppercase tracking-wider">
                                          Detective (Awake)
                                        </span>
                                      )}
                                      {!p.alive && <span>💀</span>}
                                    </span>
                                    <Search className="w-4 h-4 text-[#e5c365]" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          /* 2. Suspect Finding Card & Done Button */
                          <div className="space-y-4">
                            <div className="p-6 rounded-2xl bg-stone-950/95 border-2 border-[#c6a15b]/60 text-center space-y-3 shadow-[0_0_30px_rgba(198,161,91,0.2)]">
                              <div className="text-xs font-serif-title uppercase tracking-widest text-[#e5c365] font-black">
                                Detective Case Finding • Night {round}
                              </div>
                              <div className="text-xl sm:text-2xl font-serif-title font-bold text-[#f5efe2]">
                                {currentRoundInv.targetName} appears:
                              </div>
                              <div className="inline-block px-6 py-2.5 rounded-xl text-lg sm:text-xl font-serif-title font-black uppercase tracking-widest border border-[#c6a15b]/40 bg-stone-900 shadow-lg">
                                <span className={currentRoundInv.result === 'MAFIA' ? 'text-rose-400' : 'text-emerald-400'}>
                                  {currentRoundInv.result}
                                </span>
                              </div>
                              <p className="text-xs text-stone-300 max-w-md mx-auto leading-relaxed">
                                {currentRoundInv.result === 'MAFIA'
                                  ? 'Confirmed operative of the Mafia Syndicate!'
                                  : 'Does not appear to belong to the Mafia. (Note: The Godfather appears Innocent!)'}
                              </p>
                            </div>

                            {!me.detectiveSubmitted ? (
                              <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/40 space-y-2 text-center">
                                <p className="text-xs text-stone-300">
                                  Take your time to memorize this outcome. When you have committed it to memory, click below to sleep:
                                </p>
                                <button
                                  type="button"
                                  onClick={() => socket.emit('confirm_night_action')}
                                  className="w-full py-4 px-6 rounded-xl deco-gold-btn font-serif-title font-black uppercase tracking-wider text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(198,161,91,0.3)]"
                                >
                                  <Moon className="w-4 h-4" />
                                  <span>I Have Memorized This Result — Done / Sleep</span>
                                </button>
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-center space-y-1">
                                <div className="text-xs font-serif-title uppercase tracking-wider text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                                  <Check className="w-4 h-4" /> Finding Memorized — You are Sleeping
                                </div>
                                <p className="text-xs text-stone-300">
                                  Rest peacefully until Dawn breaks over the city.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {me.investigations.length > 0 && (
                        <div className="pt-2">
                          <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365] mb-2">
                            Your Complete Case File
                          </div>
                          <div className="space-y-1.5">
                            {me.investigations.map((inv, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-950/90 border border-[#c6a15b]/25 text-xs text-stone-200"
                              >
                                <span>
                                  Night {inv.round}: <strong className="text-[#f5efe2]">{inv.targetName}</strong>
                                </span>
                                <span
                                  className={`font-serif-title font-bold uppercase tracking-wider ${
                                    inv.result === 'MAFIA'
                                      ? 'text-rose-400'
                                      : 'text-emerald-400'
                                  }`}
                                >
                                  {inv.result}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* VILLAGER NIGHT UI */
                    <div className="p-6 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/30 text-center space-y-3">
                      <Moon className="w-10 h-10 text-[#e5c365]/80 mx-auto animate-pulse" />
                      <h3 className="text-lg font-serif-title font-bold uppercase tracking-wider text-[#f5efe2]">
                        The Town Sleeps Uneasily...
                      </h3>
                      <p className="text-xs sm:text-sm text-stone-300 max-w-md mx-auto leading-relaxed">
                        Keep a poker face so nobody knows you are a Villager! Dawn will break
                        as soon as the Mafia, Doctor, and Detective finish their secret
                        actions.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* DAWN REPORT */}
              {phase === 'DAWN' && lastDawnReport && (
                <div className="rounded-2xl deco-panel p-8 text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-[#c6a15b]/20 border border-[#c6a15b]/45 flex items-center justify-center mx-auto">
                    <Sun className="w-9 h-9 text-[#e5c365]" />
                  </div>
                  <div className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                    Dawn of Day {round}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-serif-title font-bold text-[#f5efe2]">
                    {lastDawnReport.headline}
                  </h2>

                  {lastDawnReport.victim && lastDawnReport.victim.role && (
                    <div className="p-4 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/30 inline-block">
                      <div className="text-xs text-stone-400 mb-1.5">
                        {lastDawnReport.victim.name}&apos;s role was:
                      </div>
                      <RoleBadge roleId={lastDawnReport.victim.role} size="lg" />
                    </div>
                  )}

                  {secondsLeft > 0 && (
                    <div>
                      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c6a15b]/15 border border-[#e5c365]/40 text-xs font-serif-title uppercase tracking-widest text-[#e5c365]">
                        Town Deliberation starts automatically in {secondsLeft}s
                      </span>
                    </div>
                  )}

                  {canControlFlow ? (
                    <button
                      type="button"
                      onClick={() => socket.emit('host_force_advance')}
                      className="w-full py-4 rounded-2xl deco-gold-btn font-serif-title font-black uppercase tracking-widest text-sm sm:text-base transition"
                    >
                      Open Town Hall Discussion →
                    </button>
                  ) : (
                    <p className="text-xs font-serif-title uppercase tracking-wider text-stone-400">
                      Waiting for the Game Master / Host to open Town Hall discussion...
                    </p>
                  )}
                </div>
              )}

              {/* DAY DISCUSSION */}
              {phase === 'DAY_DISCUSSION' && (
                <div className="rounded-2xl deco-panel p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-[#c6a15b]/20 pb-4">
                    <div>
                      <span className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                        Day {round} • Deliberation
                      </span>
                      <h2 className="text-2xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2] mt-1">
                        Town Hall Discussion
                      </h2>
                    </div>
                    <Sun className="w-8 h-8 text-[#e5c365]" />
                  </div>

                  <p className="text-sm text-stone-200 leading-relaxed">
                    Talk with the group! Share alibis, question suspicious behavior, or
                    reveal investigative leads. When the group is ready to put suspects on
                    trial, the Game Master / Host can open the official ballot.
                  </p>

                  {lastDawnReport && (
                    <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/30 text-xs text-stone-300">
                      <strong className="text-[#e5c365] font-serif-title uppercase tracking-wider">Morning Recap:</strong> {lastDawnReport.headline}
                    </div>
                  )}

                  {canControlFlow ? (
                    <button
                      type="button"
                      onClick={() => socket.emit('host_force_advance')}
                      className="w-full py-4 rounded-2xl deco-gold-btn font-serif-title font-black uppercase tracking-widest text-sm sm:text-base transition flex items-center justify-center gap-2"
                    >
                      <Vote className="w-5 h-5" />
                      Start Official Exile Voting
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/25 text-center text-xs font-serif-title uppercase tracking-wider text-stone-400">
                      Discuss with other players! Voting will open when ready.
                    </div>
                  )}
                </div>
              )}

              {/* DAY VOTING */}
              {phase === 'DAY_VOTING' && (
                <div className="rounded-2xl deco-panel p-6 sm:p-8 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c6a15b]/20 pb-4">
                    <div>
                      <span className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                        Day {round} • Official Ballot
                      </span>
                      <h2 className="text-2xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2] mt-0.5">
                        Vote to Exile a Suspect
                      </h2>
                    </div>
                    <span className="text-xs font-serif-title uppercase tracking-wider px-3 py-1 rounded-full bg-stone-900 border border-[#c6a15b]/35 text-[#e5c365] font-bold">
                      {alivePlayers.filter((p) => p.hasVotedDay).length} /{' '}
                      {alivePlayers.length} Voted
                    </span>
                  </div>

                  {isGM ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-stone-950/90 border border-[#c6a15b]/35 text-xs text-stone-200">
                        <strong className="text-[#e5c365] font-serif-title uppercase tracking-wider">Game Master Ballot View:</strong> As Game Master, you oversee
                        the Town vote without casting a citizen ballot.
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {alivePlayers.map((p) => {
                          const votersForP = alivePlayers.filter(
                            (voter) => voter.dayVoteTarget === p.id
                          );
                          return (
                            <div
                              key={p.id}
                              className="p-3.5 rounded-xl bg-stone-950/85 border border-[#c6a15b]/25 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-bold text-sm text-[#f5efe2]">
                                  {p.name}
                                </div>
                                <div className="text-[11px] text-[#e5c365]">
                                  {votersForP.length > 0
                                    ? `Voted by: ${votersForP.map((v) => v.name).join(', ')}`
                                    : '0 votes'}
                                </div>
                              </div>
                              <RoleBadge roleId={p.role} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : !me.alive ? (
                    <div className="p-5 rounded-xl bg-stone-950/90 border border-[#c6a15b]/25 text-center text-sm text-stone-400">
                      Eliminated citizens cannot cast a ballot. Watch the live vote tally
                      below!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => socket.emit('day_vote', { targetId: 'SKIP' })}
                        className={`p-4 rounded-xl border text-left transition flex items-center justify-between ${
                          me.myDayVote === 'SKIP'
                            ? 'bg-[#c6a15b]/20 border-[#e5c365] text-[#f5efe2] shadow-[0_0_20px_rgba(198,161,91,0.18)]'
                            : 'bg-stone-950/85 border-[#c6a15b]/25 text-stone-300 hover:border-[#c6a15b]/60'
                        }`}
                      >
                        <div>
                          <div className="font-serif-title font-bold uppercase tracking-wider text-sm text-[#f5efe2]">
                            Skip Vote
                          </div>
                          <div className="text-xs text-stone-400">
                            Vote not to exile anyone today
                          </div>
                        </div>
                        <Vote className="w-5 h-5 text-[#e5c365]" />
                      </button>

                      {alivePlayers.map((p) => {
                        const selected = me.myDayVote === p.id;
                        const votersForP = alivePlayers.filter(
                          (voter) => voter.dayVoteTarget === p.id
                        );
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => socket.emit('day_vote', { targetId: p.id })}
                            className={`p-4 rounded-xl border text-left transition flex items-center justify-between ${
                              selected
                                ? 'bg-rose-600/25 border-rose-500 text-[#f5efe2] shadow-[0_0_20px_rgba(225,29,72,0.2)]'
                                : 'bg-stone-950/85 border-[#c6a15b]/25 text-stone-200 hover:border-[#c6a15b]/60'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-sm text-[#f5efe2]">
                                {p.name} {p.id === me.id && '(You)'}
                              </div>
                              {votersForP.length > 0 && (
                                <div className="text-[11px] text-rose-300 mt-0.5">
                                  Votes ({votersForP.length}):{' '}
                                  {votersForP.map((v) => v.name).join(', ')}
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
                  )}
                </div>
              )}

              {/* VOTE RESULTS */}
              {phase === 'VOTE_RESULTS' && lastVoteReport && (
                <div className="rounded-2xl deco-panel p-8 text-center space-y-6">
                  <div className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                    Day {round} Verdict
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-serif-title font-bold text-[#f5efe2]">
                    {lastVoteReport.outcomeText}
                  </h2>

                  {lastVoteReport.exiledPlayer && lastVoteReport.exiledPlayer.role && (
                    <div className="p-4 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/30 inline-block">
                      <div className="text-xs text-stone-400 mb-1.5">
                        {lastVoteReport.exiledPlayer.name}&apos;s true identity was:
                      </div>
                      <RoleBadge roleId={lastVoteReport.exiledPlayer.role} size="lg" />
                    </div>
                  )}

                  {secondsLeft > 0 && (
                    <div>
                      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c6a15b]/15 border border-[#e5c365]/40 text-xs font-serif-title uppercase tracking-widest text-[#e5c365]">
                        Night falls automatically in {secondsLeft}s
                      </span>
                    </div>
                  )}

                  {canControlFlow ? (
                    <button
                      type="button"
                      onClick={() => socket.emit('host_force_advance')}
                      className="w-full py-4 rounded-2xl deco-gold-btn font-serif-title font-black uppercase tracking-widest text-sm sm:text-base transition"
                    >
                      Begin Night {round + 1} 🌙
                    </button>
                  ) : (
                    <p className="text-xs font-serif-title uppercase tracking-wider text-stone-400">
                      Waiting for Game Master / Host to advance to Night {round + 1}...
                    </p>
                  )}
                </div>
              )}

              {/* GAME OVER */}
              {phase === 'GAME_OVER' && (
                <div className="rounded-2xl deco-panel p-8 text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-[#c6a15b]/20 border border-[#c6a15b]/45 flex items-center justify-center mx-auto">
                    <Trophy className="w-10 h-10 text-[#e5c365]" />
                  </div>
                  <div>
                    <span className="text-xs font-serif-title uppercase tracking-[0.2em] text-[#e5c365] font-bold">
                      Final Verdict
                    </span>
                    <h2
                      className={`text-3xl sm:text-4xl font-serif-title font-black uppercase tracking-wider mt-1 ${
                        winner === 'TOWN' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {winner === 'TOWN' ? 'TOWN VICTORY!' : 'THE MAFIA WINS!'}
                    </h2>
                    <p className="text-sm text-stone-300 mt-2">{winReason}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          p.alive
                            ? 'bg-stone-950/85 border-[#c6a15b]/30'
                            : 'bg-stone-950/40 border-white/5 opacity-60'
                        }`}
                      >
                        <div className="font-semibold text-sm text-[#f5efe2] truncate">
                          {p.name} {!p.alive && '💀'}
                        </div>
                        <RoleBadge roleId={p.role} />
                      </div>
                    ))}
                  </div>

                  {canControlFlow && (
                    <button
                      type="button"
                      onClick={() => socket.emit('play_again')}
                      className="w-full py-4 rounded-2xl deco-gold-btn font-serif-title font-black uppercase tracking-widest text-sm sm:text-base inline-flex items-center justify-center gap-2 transition"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Return Room to Lobby for Next Game
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right Sidebar: My Secret Identity, Roster & Host/GM Controls */}
            <div className="lg:col-span-4 space-y-6">
              {me.role && phase !== 'ROLE_REVEAL' && (
                <div>
                  {hideMyRole ? (
                    <ArtDecoCardBack
                      playerName={me.name}
                      subtitle="Role Hidden for Privacy — Click to Reveal"
                      buttonLabel="Reveal Role"
                      compact={true}
                      onClick={() => setHideMyRole(false)}
                    />
                  ) : (
                    <div className="space-y-2">
                      <RoleCard
                        roleId={me.role}
                        imageUrl={me.roleImage}
                        variantIndex={me.roleVariantIndex}
                        fellowMafia={isMafia ? fellowMafia : []}
                        compact={true}
                        onClick={() => setHideMyRole(true)}
                      />
                      <button
                        type="button"
                        onClick={() => setHideMyRole(true)}
                        className="w-full py-2.5 px-3 rounded-xl bg-stone-900 border border-[#c6a15b]/40 hover:border-[#c6a15b] text-xs text-stone-200 hover:text-white font-serif-title uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                        Hide Role
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Citizen Roster */}
              <div className="rounded-2xl deco-panel p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#c6a15b]/20 pb-2.5">
                  <h3 className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365]">
                    Citizens ({alivePlayers.length}/{citizenPlayers.length} Alive)
                  </h3>
                </div>
                <div className="space-y-2">
                  {activeGmPlayer && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl border bg-[#c6a15b]/15 border-[#c6a15b]/40 text-[#f5efe2]">
                      <span className="text-xs font-semibold truncate">
                        {activeGmPlayer.name}{' '}
                        {activeGmPlayer.id === me.id && '(You)'}
                      </span>
                      <RoleBadge roleId="GAMEMASTER" />
                    </div>
                  )}
                  {citizenPlayers.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                        p.alive
                          ? 'bg-stone-950/85 border-[#c6a15b]/25 text-[#f5efe2]'
                          : 'bg-stone-950/40 border-white/5 text-stone-500 line-through'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            p.connected ? 'bg-emerald-400' : 'bg-stone-600'
                          }`}
                        />
                        <span className="text-xs font-medium truncate">
                          {p.name} {p.id === me.id && '(You)'} {!p.alive && '💀'}
                        </span>
                      </div>
                      {p.role && !hideMyRole && <RoleBadge roleId={p.role} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Host / Game Master Override Control */}
              {canControlFlow && phase !== 'GAME_OVER' && (
                <div className="rounded-2xl deco-panel p-5 space-y-3">
                  <div className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365] flex items-center gap-1.5 border-b border-[#c6a15b]/20 pb-2.5">
                    <Crown className="w-3.5 h-3.5 text-[#c6a15b]" />
                    {isGM ? 'Game Master Controls' : 'Host Controls'}
                  </div>
                  <p className="text-xs text-stone-400">
                    Skip non-Mafia night roles or advance the current phase at any time.
                  </p>
                  {phase === 'NIGHT' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={nightProgress.doctorDone}
                        onClick={() =>
                          socket.emit('gm_skip_night_role', { roleId: 'DOCTOR' })
                        }
                        className="py-2 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 border border-[#c6a15b]/35 text-[11px] font-serif-title uppercase tracking-wider font-bold text-[#e5c365] transition"
                      >
                        {nightProgress.doctorDone ? 'Doctor Done ✓' : 'Skip Doctor'}
                      </button>
                      <button
                        type="button"
                        disabled={nightProgress.detectiveDone}
                        onClick={() =>
                          socket.emit('gm_skip_night_role', { roleId: 'DETECTIVE' })
                        }
                        className="py-2 px-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-40 border border-[#c6a15b]/35 text-[11px] font-serif-title uppercase tracking-wider font-bold text-[#e5c365] transition"
                      >
                        {nightProgress.detectiveDone
                          ? 'Detective Done ✓'
                          : 'Skip Detective'}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => socket.emit('host_force_advance')}
                    className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-[#c6a15b]/40 text-xs font-serif-title uppercase tracking-wider font-bold text-[#e5c365] inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <FastForward className="w-3.5 h-3.5 text-[#c6a15b]" />
                    Advance to Next Phase
                  </button>
                </div>
              )}

              {/* Public Game Chronicle */}
              {logs.length > 0 && (
                <div className="rounded-2xl deco-panel p-5 space-y-2.5">
                  <h3 className="text-xs font-serif-title font-bold uppercase tracking-wider text-[#e5c365] border-b border-[#c6a15b]/20 pb-2.5">
                    Chronicle Log
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto text-xs text-stone-300">
                    {logs.map((entry, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-stone-950/80 border border-[#c6a15b]/20"
                      >
                        {entry.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
