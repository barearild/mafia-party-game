import React, { useState, useEffect, useRef } from 'react';
import {
  Moon,
  Sun,
  Tv,
  Skull,
  Users,
  Clock,
  Sparkles,
  Trophy,
  AlertCircle,
  Vote,
  Shield,
  Search,
  UserCheck,
  Gamepad2,
  X,
  Volume2,
} from 'lucide-react';
import { P2PNetworkManager } from '../network/P2PNetworkManager.js';
import { ROLES } from '../shared/roles.js';

function getOrCreateTvPlayerId() {
  let id =
    sessionStorage.getItem('mafia_player_id') ||
    localStorage.getItem('mafia_player_id');
  if (!id) {
    id = `tv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem('mafia_player_id', id);
    localStorage.setItem('mafia_player_id', id);
  }
  return id;
}

export default function TvTheaterMode({ roomCode, onExit, onSwitchToPlayer }) {
  const [roomState, setRoomState] = useState(null);
  const [statusMsg, setStatusMsg] = useState(`Connecting TV to Room ${roomCode}...`);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState(() => {
    try {
      return localStorage.getItem('mafia_player_name') || '';
    } catch {
      return '';
    }
  });

  const playerIdRef = useRef(getOrCreateTvPlayerId());
  const netRef = useRef(null);

  useEffect(() => {
    const net = new P2PNetworkManager({
      playerId: playerIdRef.current,
      playerName: 'Living Room TV',
      isTvDisplay: true,
      onStateUpdate: (state) => {
        setRoomState(state);
      },
      onError: (err) => {
        setErrorMsg(err);
      },
      onStatusChange: (status) => {
        setStatusMsg(status);
      },
    });

    netRef.current = net;
    net.joinRoom(roomCode);

    return () => {
      net.destroy();
    };
  }, [roomCode]);

  const handleConfirmSwitchToPlayer = () => {
    const chosenName = (playerNameInput.trim() || 'Player');
    try {
      localStorage.setItem('mafia_player_name', chosenName);
    } catch {}

    if (netRef.current) {
      netRef.current.dispatch('exit_tv_to_player', { playerName: chosenName });
    }

    setShowSwitchModal(false);

    if (onSwitchToPlayer) {
      onSwitchToPlayer({ roomCode, playerName: chosenName, playerId: playerIdRef.current });
    } else if (onExit) {
      onExit();
    }
  };

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#070605] text-[#f5efe2] flex items-center justify-center p-6">
        <div className="max-w-md w-full deco-panel p-8 text-center space-y-4 rounded-3xl">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-2xl font-serif-title font-bold uppercase tracking-wider text-[#f5efe2]">
            TV Display Notice
          </h2>
          <p className="text-sm text-stone-300">{errorMsg}</p>
          <button
            onClick={onExit}
            className="w-full py-3 rounded-xl deco-gold-btn font-serif-title font-bold uppercase tracking-widest text-xs transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="min-h-screen bg-[#070605] text-[#f5efe2] flex items-center justify-center p-6 select-none">
        <div className="max-w-md w-full deco-panel p-6 sm:p-8 rounded-3xl text-center space-y-5 border border-[#c6a15b]/40 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          <div className="w-12 h-12 border-4 border-[#c6a15b] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-serif-title uppercase tracking-widest text-stone-200">
              {statusMsg || `Connecting TV to Room ${roomCode}...`}
            </h2>
            <p className="text-xs text-stone-400">
              Looking for active syndicate host...
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="w-full py-2.5 rounded-xl deco-gold-btn font-serif-title font-bold uppercase tracking-widest text-xs transition"
          >
            Return to Front Page
          </button>
        </div>
      </div>
    );
  }

  const {
    code,
    phase,
    round,
    players = [],
    nightProgress,
    lastDawnReport,
    lastVoteReport,
    winner,
    winReason,
  } = roomState;

  const livingCitizens = players.filter((p) => p.alive && !p.isGameMaster && p.role !== 'GAMEMASTER');
  const eliminatedCitizens = players.filter((p) => !p.alive && !p.isGameMaster && p.role !== 'GAMEMASTER');
  const totalCitizens = livingCitizens.length + eliminatedCitizens.length;

  return (
    <div className="min-h-screen bg-[#090807] text-[#f5efe2] flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(198,161,91,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b-2 border-[#c6a15b]/30 pb-4 relative z-10 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c6a15b]/20 border border-[#e5c365]/50 flex items-center justify-center">
            <Tv className="w-5 h-5 text-[#e5c365]" />
          </div>
          <div>
            <div className="text-[10px] sm:text-[11px] font-serif-title uppercase tracking-[0.22em] text-[#e5c365] font-black flex items-center gap-1.5">
              <span>Game Master Display</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xl sm:text-2xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
              MAFIA // SYNDICATE
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="px-4 sm:px-5 py-2 rounded-2xl bg-stone-950 border-2 border-[#c6a15b]/60 flex items-center gap-2 sm:gap-3 shadow-[0_0_20px_rgba(198,161,91,0.2)]">
            <span className="text-[10px] sm:text-xs font-serif-title uppercase tracking-widest text-stone-400">
              PIN
            </span>
            <span className="text-xl sm:text-3xl font-mono font-black tracking-widest text-[#e5c365]">
              {code}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowSwitchModal(true)}
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-[#e5c365] hover:text-white font-serif-title font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition shadow-sm"
            title="Exit TV Mode and join the table as a normal player on this device"
          >
            <UserCheck className="w-4 h-4 text-[#e5c365]" />
            <span className="hidden sm:inline">Join as Player</span>
            <span className="sm:hidden">Play</span>
          </button>

          <button
            onClick={onExit}
            className="text-xs text-stone-500 hover:text-stone-300 transition uppercase tracking-wider px-2 py-1"
          >
            Exit TV
          </button>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="my-auto py-8 relative z-10 flex flex-col items-center justify-center text-center max-w-5xl mx-auto w-full">
        {/* 1. LOBBY PHASE */}
        {phase === 'LOBBY' && (
          <div className="space-y-8 w-full">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#c6a15b]/15 border border-[#e5c365]/40 text-xs font-serif-title uppercase tracking-widest text-[#e5c365] mx-auto">
                <Tv className="w-3.5 h-3.5" />
                <span>Autonomous Game Master Active</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2] drop-shadow-[0_5px_20px_rgba(0,0,0,0.9)]">
                Take Your Seats at the Table
              </h1>
              <p className="text-base sm:text-lg text-stone-300 max-w-2xl mx-auto">
                Open <span className="font-mono text-[#e5c365] bg-stone-950 px-2.5 py-1 rounded border border-[#c6a15b]/40">{window.location.origin}</span> on your phone and enter PIN <strong className="font-mono text-[#e5c365] text-xl">{code}</strong>
              </p>
            </div>

            {/* Players Joined Wall */}
            <div className="p-6 rounded-3xl deco-panel space-y-4 max-w-3xl mx-auto w-full">
              <div className="flex items-center justify-between border-b border-[#c6a15b]/20 pb-2 text-xs font-serif-title font-bold uppercase tracking-[0.2em] text-[#e5c365]">
                <span>Citizens in the Parlor ({livingCitizens.length})</span>
                <span className="text-[11px] text-stone-400 font-normal">Need 4+ to start</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 min-h-[70px]">
                {livingCitizens.length === 0 ? (
                  <p className="text-sm text-stone-400 italic">Waiting for players to join with PIN {code}...</p>
                ) : (
                  livingCitizens.map((p) => (
                    <div
                      key={p.id}
                      className="px-5 py-2.5 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/40 text-[#f5efe2] font-serif-title font-bold text-sm sm:text-base shadow-[0_0_15px_rgba(0,0,0,0.6)] flex items-center gap-2"
                    >
                      <span>{p.name}</span>
                      {p.isBot && <span className="text-[10px] text-stone-400 font-mono">(AI)</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. ROLE REVEAL PHASE */}
        {phase === 'ROLE_REVEAL' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#c6a15b]/15 border-2 border-[#e5c365] flex items-center justify-center mx-auto text-3xl animate-bounce">
              🎴
            </div>
            <h2 className="text-4xl sm:text-5xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
              Secret Roles Are Being Dealt
            </h2>
            <p className="text-base text-stone-300 leading-relaxed">
              Look down at your phone screens! Keep your card hidden from your neighbors. Tap ready once you know your identity.
            </p>
            <div className="text-sm font-serif-title uppercase tracking-widest text-[#e5c365] font-bold">
              {livingCitizens.filter((p) => p.ready).length} of {livingCitizens.length} Players Confirmed
            </div>
          </div>
        )}

        {/* 3. NIGHT PHASE */}
        {phase === 'NIGHT' && (
          <div className="space-y-8 max-w-3xl mx-auto">
            <div className="w-24 h-24 rounded-full bg-stone-950 border-2 border-[#c6a15b]/50 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(198,161,91,0.25)]">
              <Moon className="w-12 h-12 text-[#e5c365] animate-pulse" />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-serif-title font-bold uppercase tracking-[0.25em] text-[#e5c365]">
                Night {round} • Shadows in the Dark
              </span>
              <h2 className="text-4xl sm:text-6xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                The City Has Fallen Asleep...
              </h2>
            </div>
            <p className="text-base sm:text-lg text-stone-300 max-w-xl mx-auto leading-relaxed">
              Silent footsteps echo across the cobblestones. Secret syndicate operatives and protectors are making their moves in private on their phones.
            </p>
          </div>
        )}

        {/* 4. DAWN PHASE */}
        {phase === 'DAWN' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="p-8 sm:p-10 rounded-3xl bg-[#f4ece0] text-[#141210] border-4 border-[#1c1a17] shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-4">
              <div className="text-[11px] font-serif-title font-black uppercase tracking-[0.3em] border-b-2 border-[#1c1a17] pb-1 text-center">
                THE MORNING CHRONICLE • EXTRA EDITION
              </div>
              <h2 className="text-3xl sm:text-5xl font-serif-title font-black uppercase tracking-tight text-center leading-tight">
                {lastDawnReport?.headline || 'The Sun Rises Over a Quiet Town'}
              </h2>
              {lastDawnReport?.victim && (
                <div className="text-center pt-2">
                  <span className="text-sm sm:text-base font-serif-title font-bold uppercase tracking-wider text-rose-800">
                    Casualty: {lastDawnReport.victim.name}
                    {lastDawnReport.victim.role && ` (${ROLES[lastDawnReport.victim.role]?.name})`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. DAY DISCUSSION & VOTING */}
        {(phase === 'DAY_DISCUSSION' || phase === 'DAY_VOTING') && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#c6a15b]/20 border-2 border-[#e5c365] flex items-center justify-center mx-auto">
              <Sun className="w-10 h-10 text-[#e5c365]" />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-serif-title font-bold uppercase tracking-[0.25em] text-[#e5c365]">
                Day {round} • Town Hall Convenes
              </span>
              <h2 className="text-4xl sm:text-5xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
                {phase === 'DAY_DISCUSSION' ? 'Town Deliberation' : 'Vote to Exile a Suspect'}
              </h2>
            </div>
            <p className="text-base text-stone-300 max-w-xl mx-auto">
              {phase === 'DAY_DISCUSSION'
                ? 'Accusations fly across the table! Who is lying about where they were last night?'
                : 'Cast your vote privately on your phone! Look up when finished.'}
            </p>
          </div>
        )}

        {/* 6. VOTE RESULTS */}
        {phase === 'VOTE_RESULTS' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="p-8 sm:p-10 rounded-3xl bg-[#f4ece0] text-[#141210] border-4 border-[#1c1a17] shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-4">
              <div className="text-[11px] font-serif-title font-black uppercase tracking-[0.3em] border-b-2 border-[#1c1a17] pb-1 text-center">
                TOWN COUNCIL VERDICT
              </div>
              <h2 className="text-3xl sm:text-5xl font-serif-title font-black uppercase tracking-tight text-center leading-tight">
                {lastVoteReport?.outcomeText || 'The Town has spoken!'}
              </h2>
            </div>
          </div>
        )}

        {/* 7. GAME OVER */}
        {phase === 'GAME_OVER' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <Trophy className="w-20 h-20 text-[#e5c365] mx-auto animate-bounce" />
            <h2 className="text-5xl sm:text-6xl font-serif-title font-black uppercase tracking-wider text-[#e5c365]">
              {winner === 'TOWN' ? 'The Town Alliance Wins!' : 'The Mafia Syndicate Victorious!'}
            </h2>
            <p className="text-lg text-stone-200 max-w-xl mx-auto">
              {winReason}
            </p>
          </div>
        )}
      </main>

      {/* Bottom Footer: Town Roster */}
      <footer className="border-t-2 border-[#c6a15b]/25 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400 relative z-10">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#c6a15b]" />
          <span>Active Citizens ({livingCitizens.length} Alive)</span>
          {eliminatedCitizens.length > 0 && (
            <span className="text-rose-400">({eliminatedCitizens.length} Deceased)</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-stone-300">
          <span>This TV device serves as Game Master. Players play on their own phones.</span>
        </div>
      </footer>

      {/* Switch to Player Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full deco-panel p-6 sm:p-8 space-y-5 rounded-3xl border border-[#c6a15b]/60 shadow-[0_0_50px_rgba(0,0,0,0.9)] text-left">
            <div className="flex items-center justify-between border-b border-[#c6a15b]/30 pb-3">
              <div className="flex items-center gap-3">
                <UserCheck className="w-6 h-6 text-[#e5c365]" />
                <div>
                  <h3 className="text-lg font-serif-title font-bold uppercase tracking-wider text-[#f5efe2]">
                    Join Table as Citizen
                  </h3>
                  <p className="text-xs text-stone-300">
                    Exit TV Theater and take a normal player seat on this screen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-serif-title uppercase tracking-widest text-[#e5c365]">
                Your Player Name
              </label>
              <input
                type="text"
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full rounded-xl bg-black/80 border border-[#c6a15b]/40 px-3.5 py-2.5 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-[#e5c365]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 text-xs font-serif-title uppercase tracking-wider transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitchToPlayer}
                className="px-5 py-2.5 rounded-xl deco-gold-btn text-black font-serif-title font-black text-xs uppercase tracking-widest transition"
              >
                Confirm & Join Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
