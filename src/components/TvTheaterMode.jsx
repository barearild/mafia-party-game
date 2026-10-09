import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { P2PNetworkManager } from '../network/P2PNetworkManager.js';
import { ROLES } from '../shared/roles.js';

export default function TvTheaterMode({ roomCode, onExit }) {
  const [roomState, setRoomState] = useState(null);
  const [statusMsg, setStatusMsg] = useState(`Connecting TV to Room ${roomCode}...`);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const spectatorId = `tv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const net = new P2PNetworkManager({
      playerId: spectatorId,
      playerName: 'Living Room TV',
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

    net.joinRoom(roomCode);

    return () => {
      net.destroy();
    };
  }, [roomCode]);

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
      <div className="min-h-screen bg-[#070605] text-[#f5efe2] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-[#c6a15b] border-t-transparent rounded-full animate-spin" />
        <p className="text-base font-serif-title uppercase tracking-widest text-stone-300">
          {statusMsg}
        </p>
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

  const livingPlayers = players.filter((p) => p.alive && !p.isGameMaster);
  const eliminatedPlayers = players.filter((p) => !p.alive && !p.isGameMaster);

  return (
    <div className="min-h-screen bg-[#090807] text-[#f5efe2] flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(198,161,91,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b-2 border-[#c6a15b]/30 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c6a15b]/20 border border-[#e5c365]/50 flex items-center justify-center">
            <Tv className="w-5 h-5 text-[#e5c365]" />
          </div>
          <div>
            <div className="text-[11px] font-serif-title uppercase tracking-[0.25em] text-[#e5c365] font-black">
              Syndicate Living Room Theater
            </div>
            <div className="text-xl sm:text-2xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2]">
              MAFIA // SYNDICATE
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-5 py-2 rounded-2xl bg-stone-950 border-2 border-[#c6a15b]/60 flex items-center gap-3 shadow-[0_0_20px_rgba(198,161,91,0.2)]">
            <span className="text-xs font-serif-title uppercase tracking-widest text-stone-400">
              Room PIN
            </span>
            <span className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-[#e5c365]">
              {code}
            </span>
          </div>
          <button
            onClick={onExit}
            className="text-xs text-stone-500 hover:text-stone-300 transition uppercase tracking-wider"
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
              <span className="text-sm font-serif-title font-bold uppercase tracking-[0.3em] text-[#e5c365]">
                Connecting Citizens • Living Room Lobby
              </span>
              <h1 className="text-4xl sm:text-6xl font-serif-title font-black uppercase tracking-wider text-[#f5efe2] drop-shadow-[0_5px_20px_rgba(0,0,0,0.9)]">
                Take Your Seats at the Table
              </h1>
              <p className="text-base sm:text-lg text-stone-300 max-w-2xl mx-auto">
                Open <span className="font-mono text-[#e5c365] bg-stone-950 px-2.5 py-1 rounded border border-[#c6a15b]/40">{window.location.origin}</span> on your phone and enter PIN <strong className="font-mono text-[#e5c365] text-xl">{code}</strong>
              </p>
            </div>

            {/* Players Joined Wall */}
            <div className="p-6 rounded-3xl deco-panel space-y-4 max-w-3xl mx-auto w-full">
              <div className="text-xs font-serif-title font-bold uppercase tracking-[0.2em] text-[#e5c365]">
                Citizens Present in the Parlor ({players.length})
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="px-5 py-2.5 rounded-2xl bg-stone-950/90 border border-[#c6a15b]/40 text-[#f5efe2] font-serif-title font-bold text-sm sm:text-base shadow-[0_0_15px_rgba(0,0,0,0.6)] flex items-center gap-2"
                  >
                    <span>{p.name}</span>
                    {p.isBot && <span className="text-[10px] text-stone-400 font-mono">(AI)</span>}
                  </div>
                ))}
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
              {players.filter((p) => p.ready).length} of {players.length} Players Confirmed
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
              Silent footsteps echo across the cobblestones. Secret syndicate operatives and protectors are making their moves in private.
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
          <span>Active Citizens ({livingPlayers.length} Alive)</span>
          {eliminatedPlayers.length > 0 && (
            <span className="text-rose-400">({eliminatedPlayers.length} Deceased)</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-stone-300">
          <span>Control match progression from the Host&apos;s phone</span>
        </div>
      </footer>
    </div>
  );
}
