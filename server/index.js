import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import {
  ROLES,
  getRecommendedRoleConfig,
  BOT_NAMES,
  assignAlternatingRoleImages,
} from '../src/shared/roles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function getActiveParticipants(room) {
  const gmId = room.gameMasterId;
  return room.players.filter((p) => p.id !== gmId && p.role !== 'GAMEMASTER');
}

function createInitialRoom(hostPlayerId, hostName) {
  const code = generateRoomCode();
  const room = {
    code,
    hostId: hostPlayerId,
    gameMasterId: null, // Active Game Master player ID once selected/started
    phase: 'LOBBY', // LOBBY, ROLE_REVEAL, NIGHT, DAWN, DAY_DISCUSSION, DAY_VOTING, VOTE_RESULTS, GAME_OVER
    round: 0,
    players: [
      {
        id: hostPlayerId,
        name: hostName.trim() || 'Host',
        isBot: false,
        connected: true,
        alive: true,
        role: null,
        ready: false,
        investigations: [],
      },
    ],
    settings: {
      doctorSelfSave: true,
      revealRoleOnDeath: true,
      autoCustomRoles: true,
      gmMode: 'NONE', // 'NONE' (Automated), 'ASSIGNED' (Specific Player), 'RANDOM' (Draw randomly from humans)
      assignedGmPlayerId: hostPlayerId,
      roleCounts: getRecommendedRoleConfig(4),
    },
    nightActions: {
      mafiaVotes: {},
      doctorTarget: null,
      detectiveTarget: null,
      detectiveSubmitted: false,
      doctorSubmitted: false,
    },
    mafiaChat: [],
    dayVotes: {},
    lastDawnReport: null,
    lastVoteReport: null,
    logs: [],
    winner: null,
    winReason: '',
  };
  rooms.set(code, room);
  return room;
}

function getExpectedCitizenCount(room) {
  const hasHumanGm = room.settings.gmMode && room.settings.gmMode !== 'NONE';
  return Math.max(0, room.players.length - (hasHumanGm ? 1 : 0));
}

function syncRoleCountsIfAuto(room) {
  const citizenCount = getExpectedCitizenCount(room);
  if (room.settings.autoCustomRoles) {
    room.settings.roleCounts = getRecommendedRoleConfig(Math.max(4, citizenCount));
  } else {
    const total = Object.values(room.settings.roleCounts).reduce((a, b) => a + b, 0);
    const diff = citizenCount - total;
    if (diff !== 0 && citizenCount >= 4) {
      room.settings.roleCounts.VILLAGER = Math.max(
        0,
        (room.settings.roleCounts.VILLAGER || 0) + diff
      );
    }
  }
}

function checkWinCondition(room) {
  const participants = getActiveParticipants(room);
  const alivePlayers = participants.filter((p) => p.alive);
  const aliveMafia = alivePlayers.filter(
    (p) => p.role === 'MAFIA' || p.role === 'GODFATHER'
  );
  const aliveTown = alivePlayers.filter(
    (p) => p.role !== 'MAFIA' && p.role !== 'GODFATHER'
  );

  if (aliveMafia.length === 0) {
    room.phase = 'GAME_OVER';
    room.winner = 'TOWN';
    room.winReason = 'All members of the Mafia Syndicate have been brought to justice!';
    room.logs.push({
      round: room.round,
      type: 'WIN_TOWN',
      text: room.winReason,
    });
    return true;
  }

  if (aliveMafia.length >= aliveTown.length) {
    room.phase = 'GAME_OVER';
    room.winner = 'MAFIA';
    room.winReason =
      'The Mafia Syndicate now equals or outnumbers the Town and has seized total control of the city!';
    room.logs.push({
      round: room.round,
      type: 'WIN_MAFIA',
      text: room.winReason,
    });
    return true;
  }

  return false;
}

function buildStateForPlayer(room, playerId) {
  const me = room.players.find((p) => p.id === playerId);
  const isMafia = me && (me.role === 'MAFIA' || me.role === 'GODFATHER');
  const isGM = me && (me.role === 'GAMEMASTER' || room.gameMasterId === me.id);
  const isGameOver = room.phase === 'GAME_OVER';

  const publicPlayers = room.players.map((p) => {
    let visibleRole = null;
    if (p.role === 'GAMEMASTER') {
      visibleRole = 'GAMEMASTER';
    } else if (isGameOver || isGM) {
      visibleRole = p.role;
    } else if (p.id === playerId) {
      visibleRole = p.role;
    } else if (!p.alive && room.settings.revealRoleOnDeath) {
      visibleRole = p.role;
    } else if (isMafia && (p.role === 'MAFIA' || p.role === 'GODFATHER')) {
      visibleRole = p.role;
    }

    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      connected: p.connected,
      alive: p.alive,
      ready: p.ready,
      role: visibleRole,
      isGameMaster: p.role === 'GAMEMASTER' || room.gameMasterId === p.id,
      hasVotedDay: Boolean(room.dayVotes[p.id]),
      dayVoteTarget:
        room.phase === 'DAY_VOTING' || isGM ? room.dayVotes[p.id] || null : null,
    };
  });

  const participants = getActiveParticipants(room);
  const aliveMafia = participants.filter(
    (p) => p.alive && (p.role === 'MAFIA' || p.role === 'GODFATHER')
  );
  const aliveDoctor = participants.find((p) => p.alive && p.role === 'DOCTOR');
  const aliveDetective = participants.find((p) => p.alive && p.role === 'DETECTIVE');

  const mafiaAllVoted =
    aliveMafia.length > 0 &&
    aliveMafia.every((m) => Boolean(room.nightActions.mafiaVotes[m.id]));
  const doctorDone = !aliveDoctor || room.nightActions.doctorSubmitted;
  const detectiveDone = !aliveDetective || room.nightActions.detectiveSubmitted;

  return {
    code: room.code,
    hostId: room.hostId,
    gameMasterId: room.gameMasterId,
    phase: room.phase,
    round: room.round,
    settings: room.settings,
    players: publicPlayers,
    me: me
      ? {
          id: me.id,
          name: me.name,
          alive: me.alive,
          role: me.role,
          roleImage: me.roleImage || null,
          roleVariantIndex: me.roleVariantIndex ?? null,
          isGameMaster: Boolean(isGM),
          ready: me.ready,
          investigations: me.investigations || [],
          myMafiaVote: isMafia ? room.nightActions.mafiaVotes[me.id] || null : null,
          allMafiaVotes: isMafia || isGM ? room.nightActions.mafiaVotes : null,
          mafiaChat: isMafia || isGM ? room.mafiaChat : [],
          myDoctorTarget:
            me.role === 'DOCTOR' || isGM ? room.nightActions.doctorTarget : null,
          doctorSubmitted:
            me.role === 'DOCTOR' || isGM
              ? room.nightActions.doctorSubmitted
              : false,
          myDetectiveTarget:
            me.role === 'DETECTIVE' || isGM
              ? room.nightActions.detectiveTarget
              : null,
          detectiveSubmitted:
            me.role === 'DETECTIVE' || isGM
              ? room.nightActions.detectiveSubmitted
              : false,
          myDayVote: room.dayVotes[me.id] || null,
        }
      : null,
    nightProgress: {
      mafiaDone: mafiaAllVoted,
      doctorDone,
      detectiveDone,
    },
    lastDawnReport: room.lastDawnReport,
    lastVoteReport: room.lastVoteReport,
    logs: room.logs,
    winner: room.winner,
    winReason: room.winReason,
    serverIp: getLocalIpAddress(),
  };
}

function broadcastRoom(room) {
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) return;
  for (const socketId of sockets) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock && sock.data.playerId) {
      sock.emit('room_state', buildStateForPlayer(room, sock.data.playerId));
    }
  }
}

function triggerBotActions(room) {
  const participants = getActiveParticipants(room);
  if (room.phase === 'ROLE_REVEAL') {
    let changed = false;
    room.players.forEach((p) => {
      if (p.isBot && !p.ready) {
        p.ready = true;
        changed = true;
      }
    });
    if (changed) {
      checkRoleRevealComplete(room);
      broadcastRoom(room);
    }
  } else if (room.phase === 'NIGHT') {
    setTimeout(() => {
      if (room.phase !== 'NIGHT') return;
      const alivePlayers = participants.filter((p) => p.alive);

      participants.forEach((bot) => {
        if (!bot.isBot || !bot.alive) return;

        if (bot.role === 'MAFIA' || bot.role === 'GODFATHER') {
          if (!room.nightActions.mafiaVotes[bot.id]) {
            const nonMafia = alivePlayers.filter(
              (p) => p.role !== 'MAFIA' && p.role !== 'GODFATHER'
            );
            const pool = nonMafia.length > 0 ? nonMafia : alivePlayers;
            const target = pool[Math.floor(Math.random() * pool.length)];
            if (target) {
              room.nightActions.mafiaVotes[bot.id] = target.id;
            }
          }
        } else if (bot.role === 'DOCTOR' && !room.nightActions.doctorSubmitted) {
          const target =
            alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
          if (target) {
            room.nightActions.doctorTarget = target.id;
            room.nightActions.doctorSubmitted = true;
          }
        } else if (
          bot.role === 'DETECTIVE' &&
          !room.nightActions.detectiveSubmitted
        ) {
          const candidates = alivePlayers.filter((p) => p.id !== bot.id);
          const target =
            candidates[Math.floor(Math.random() * candidates.length)];
          if (target) {
            performDetectiveInvestigation(room, bot, target);
          }
        }
      });

      checkNightComplete(room);
      broadcastRoom(room);
    }, 1200);
  } else if (room.phase === 'DAY_VOTING') {
    setTimeout(() => {
      if (room.phase !== 'DAY_VOTING') return;
      const alivePlayers = participants.filter((p) => p.alive);

      participants.forEach((bot) => {
        if (!bot.isBot || !bot.alive) return;
        if (room.dayVotes[bot.id]) return;

        if (bot.role === 'MAFIA' || bot.role === 'GODFATHER') {
          const townTargets = alivePlayers.filter(
            (p) => p.role !== 'MAFIA' && p.role !== 'GODFATHER'
          );
          const target =
            townTargets[Math.floor(Math.random() * townTargets.length)];
          room.dayVotes[bot.id] = target ? target.id : 'SKIP';
        } else {
          const knownMafia = (bot.investigations || []).find(
            (inv) =>
              inv.result === 'MAFIA' &&
              alivePlayers.some((ap) => ap.id === inv.targetId)
          );
          if (knownMafia) {
            room.dayVotes[bot.id] = knownMafia.targetId;
          } else {
            const others = alivePlayers.filter((p) => p.id !== bot.id);
            if (Math.random() < 0.25) {
              room.dayVotes[bot.id] = 'SKIP';
            } else {
              const pick = others[Math.floor(Math.random() * others.length)];
              room.dayVotes[bot.id] = pick ? pick.id : 'SKIP';
            }
          }
        }
      });

      checkDayVotingComplete(room);
      broadcastRoom(room);
    }, 1500);
  }
}

function checkRoleRevealComplete(room) {
  if (room.players.every((p) => p.ready)) {
    startNightPhase(room);
  }
}

function startNightPhase(room) {
  room.phase = 'NIGHT';
  room.round += 1;
  room.nightActions = {
    mafiaVotes: {},
    doctorTarget: null,
    detectiveTarget: null,
    detectiveSubmitted: false,
    doctorSubmitted: false,
  };
  room.mafiaChat = [];
  triggerBotActions(room);
}

function performDetectiveInvestigation(room, detectivePlayer, targetPlayer) {
  room.nightActions.detectiveTarget = targetPlayer.id;
  room.nightActions.detectiveSubmitted = true;
  const roleObj = ROLES[targetPlayer.role];
  const result = roleObj ? roleObj.investigativeResult : 'INNOCENT';
  detectivePlayer.investigations.push({
    round: room.round,
    targetId: targetPlayer.id,
    targetName: targetPlayer.name,
    result,
  });
}

function checkNightComplete(room) {
  if (room.phase !== 'NIGHT') return;

  const participants = getActiveParticipants(room);
  const aliveMafia = participants.filter(
    (p) => p.alive && (p.role === 'MAFIA' || p.role === 'GODFATHER')
  );
  const aliveDoctor = participants.find((p) => p.alive && p.role === 'DOCTOR');
  const aliveDetective = participants.find(
    (p) => p.alive && p.role === 'DETECTIVE'
  );

  const mafiaDone =
    aliveMafia.length === 0 ||
    aliveMafia.every((m) => Boolean(room.nightActions.mafiaVotes[m.id]));
  const doctorDone = !aliveDoctor || room.nightActions.doctorSubmitted;
  const detectiveDone = !aliveDetective || room.nightActions.detectiveSubmitted;

  if (mafiaDone && doctorDone && detectiveDone) {
    resolveNightActions(room);
  }
}

function resolveNightActions(room) {
  const participants = getActiveParticipants(room);
  const voteCounts = {};
  let godfatherPick = null;

  for (const [mafiaId, targetId] of Object.entries(room.nightActions.mafiaVotes)) {
    if (!targetId) continue;
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    const voter = participants.find((p) => p.id === mafiaId);
    if (voter && voter.role === 'GODFATHER') {
      godfatherPick = targetId;
    }
  }

  let chosenMafiaTargetId = null;
  let maxVotes = 0;
  for (const [targetId, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      chosenMafiaTargetId = targetId;
    } else if (count === maxVotes && targetId === godfatherPick) {
      chosenMafiaTargetId = targetId;
    }
  }

  const targetedPlayer = participants.find((p) => p.id === chosenMafiaTargetId);
  const savedByDoctor =
    targetedPlayer &&
    room.nightActions.doctorTarget &&
    room.nightActions.doctorTarget === targetedPlayer.id;

  let victim = null;
  if (targetedPlayer && !savedByDoctor) {
    targetedPlayer.alive = false;
    victim = {
      id: targetedPlayer.id,
      name: targetedPlayer.name,
      role: room.settings.revealRoleOnDeath ? targetedPlayer.role : null,
    };
  }

  const headline = victim
    ? `${victim.name} was eliminated during the night!`
    : savedByDoctor
    ? `Shots echoed in the dark, but the Doctor made a miraculous save! No one died.`
    : `The sun rises over a quiet town. No one was eliminated last night.`;

  room.lastDawnReport = {
    round: room.round,
    victim,
    savedByDoctor: Boolean(savedByDoctor),
    headline,
  };

  room.logs.push({
    round: room.round,
    type: 'DAWN',
    text: `Night ${room.round}: ${headline}`,
  });

  if (!checkWinCondition(room)) {
    room.phase = 'DAWN';
  }
}

function checkDayVotingComplete(room) {
  if (room.phase !== 'DAY_VOTING') return;
  const participants = getActiveParticipants(room);
  const alivePlayers = participants.filter((p) => p.alive);
  const allVoted = alivePlayers.every((p) => Boolean(room.dayVotes[p.id]));
  if (allVoted) {
    resolveDayVoting(room);
  }
}

function resolveDayVoting(room) {
  const counts = {};
  const participants = getActiveParticipants(room);
  const alivePlayers = participants.filter((p) => p.alive);

  for (const p of alivePlayers) {
    const choice = room.dayVotes[p.id] || 'SKIP';
    counts[choice] = (counts[choice] || 0) + 1;
  }

  let topChoice = 'SKIP';
  let topCount = 0;
  let isTie = false;

  for (const [choice, count] of Object.entries(counts)) {
    if (count > topCount) {
      topCount = count;
      topChoice = choice;
      isTie = false;
    } else if (count === topCount) {
      isTie = true;
    }
  }

  let exiledPlayer = null;
  let outcomeText = '';

  if (isTie || topChoice === 'SKIP') {
    outcomeText = isTie
      ? 'The Town vote ended in a deadlock! Nobody was exiled today.'
      : 'The Town voted to skip exile today. Nobody was eliminated.';
  } else {
    const target = participants.find((p) => p.id === topChoice);
    if (target) {
      target.alive = false;
      exiledPlayer = {
        id: target.id,
        name: target.name,
        role: room.settings.revealRoleOnDeath ? target.role : null,
      };
      outcomeText = `${target.name} was exiled by the Town with ${topCount} vote${
        topCount > 1 ? 's' : ''
      }!`;
    }
  }

  room.lastVoteReport = {
    round: room.round,
    exiledPlayer,
    outcomeText,
    counts,
  };

  room.logs.push({
    round: room.round,
    type: 'EXILE',
    text: `Day ${room.round}: ${outcomeText}`,
  });

  if (!checkWinCondition(room)) {
    room.phase = 'VOTE_RESULTS';
  }
}

function canControlGameFlow(room, playerId) {
  return playerId === room.hostId || playerId === room.gameMasterId;
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ playerId, playerName }, callback) => {
    const room = createInitialRoom(playerId, playerName || 'Host');
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = playerId;
    broadcastRoom(room);
    if (callback) callback({ ok: true, code: room.code });
  });

  socket.on('join_room', ({ code, playerId, playerName }, callback) => {
    const cleanCode = (code || '').toUpperCase().trim();
    const room = rooms.get(cleanCode);
    if (!room) {
      if (callback)
        callback({ ok: false, error: 'Room not found. Check your 4-letter code!' });
      return;
    }

    let existing = room.players.find((p) => p.id === playerId);
    if (!existing && room.phase === 'LOBBY') {
      existing = room.players.find(
        (p) =>
          !p.isBot &&
          p.name.toLowerCase() === (playerName || '').trim().toLowerCase()
      );
      if (existing) {
        existing.id = playerId;
      }
    }

    if (existing) {
      existing.connected = true;
      if (playerName && room.phase === 'LOBBY') {
        existing.name = playerName.trim();
      }
    } else {
      if (room.phase !== 'LOBBY') {
        if (callback)
          callback({
            ok: false,
            error: 'Game is already in progress in this room!',
          });
        return;
      }
      room.players.push({
        id: playerId,
        name: (playerName || `Player ${room.players.length + 1}`).trim(),
        isBot: false,
        connected: true,
        alive: true,
        role: null,
        ready: false,
        investigations: [],
      });
      syncRoleCountsIfAuto(room);
    }

    socket.join(cleanCode);
    socket.data.roomCode = cleanCode;
    socket.data.playerId = playerId;
    broadcastRoom(room);
    if (callback) callback({ ok: true, code: cleanCode });
  });

  socket.on('add_bot', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'LOBBY') return;
    const usedNames = new Set(
      room.players.map((p) => p.name.replace(/\s*\(AI\)$/i, '').trim().toLowerCase())
    );
    const availableName =
      BOT_NAMES.find((n) => !usedNames.has(n.toLowerCase())) ||
      `Agent ${room.players.length + 1}`;
    room.players.push({
      id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${availableName} (AI)`,
      isBot: true,
      connected: true,
      alive: true,
      role: null,
      ready: true,
      investigations: [],
    });
    syncRoleCountsIfAuto(room);
    broadcastRoom(room);
  });

  socket.on('remove_player', ({ targetPlayerId }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'LOBBY') return;
    if (socket.data.playerId !== room.hostId) return;
    if (targetPlayerId === room.hostId) return;

    room.players = room.players.filter((p) => p.id !== targetPlayerId);
    if (room.settings.assignedGmPlayerId === targetPlayerId) {
      room.settings.assignedGmPlayerId = room.hostId;
    }
    syncRoleCountsIfAuto(room);
    broadcastRoom(room);
  });

  socket.on('update_settings', ({ settings }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'LOBBY') return;
    if (socket.data.playerId !== room.hostId) return;

    room.settings = {
      ...room.settings,
      ...settings,
    };
    syncRoleCountsIfAuto(room);
    broadcastRoom(room);
  });

  socket.on('draw_random_gm', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'LOBBY') return;
    if (socket.data.playerId !== room.hostId) return;

    const humans = room.players.filter((p) => !p.isBot);
    const pool = humans.length > 0 ? humans : room.players;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (chosen) {
      room.settings.gmMode = 'ASSIGNED';
      room.settings.assignedGmPlayerId = chosen.id;
      syncRoleCountsIfAuto(room);
      broadcastRoom(room);
    }
  });

  socket.on('start_game', (_, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'LOBBY') return;
    if (socket.data.playerId !== room.hostId) return;

    const hasHumanGm = room.settings.gmMode && room.settings.gmMode !== 'NONE';
    const minRequired = hasHumanGm ? 5 : 4;

    if (room.players.length < minRequired) {
      if (callback)
        callback({
          ok: false,
          error: hasHumanGm
            ? `With a dedicated Game Master enabled, you need at least 5 total players (1 Game Master + 4 Citizens). Add more players or AI Bots!`
            : `At least 4 players are required to start (you can add AI Bots to test or fill seats!).`,
        });
      return;
    }

    // Determine Game Master if enabled
    room.gameMasterId = null;
    if (room.settings.gmMode === 'ASSIGNED') {
      const targetGm =
        room.players.find((p) => p.id === room.settings.assignedGmPlayerId) ||
        room.players.find((p) => !p.isBot) ||
        room.players[0];
      room.gameMasterId = targetGm ? targetGm.id : null;
    } else if (room.settings.gmMode === 'RANDOM') {
      const humans = room.players.filter((p) => !p.isBot);
      const pool = humans.length > 0 ? humans : room.players;
      const drawn = pool[Math.floor(Math.random() * pool.length)];
      room.gameMasterId = drawn ? drawn.id : null;
    }

    syncRoleCountsIfAuto(room);
    const citizenPlayers = room.players.filter((p) => p.id !== room.gameMasterId);

    const counts = room.settings.roleCounts;
    const rolePool = [];
    Object.entries(counts).forEach(([roleKey, count]) => {
      for (let i = 0; i < count; i++) {
        rolePool.push(roleKey);
      }
    });

    while (rolePool.length < citizenPlayers.length) {
      rolePool.push('VILLAGER');
    }
    rolePool.length = citizenPlayers.length;

    // Fisher-Yates shuffle
    for (let i = rolePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
    }

    let roleIdx = 0;
    room.players.forEach((p) => {
      if (p.id === room.gameMasterId) {
        p.role = 'GAMEMASTER';
        p.alive = true;
        p.ready = p.isBot;
        p.investigations = [];
      } else {
        p.role = rolePool[roleIdx++];
        p.alive = true;
        p.ready = p.isBot;
        p.investigations = [];
      }
    });

    const gameOffset = room.gamesStartedCount || 0;
    room.gamesStartedCount = gameOffset + 1;
    room.players = assignAlternatingRoleImages(room.players, gameOffset);

    const gmPlayer = room.players.find((p) => p.id === room.gameMasterId);
    room.round = 0;
    room.logs = [
      {
        round: 0,
        type: 'START',
        text: gmPlayer
          ? `Game started with ${citizenPlayers.length} citizens. ${gmPlayer.name} is the Game Master!`
          : `A new game of Mafia has begun with ${citizenPlayers.length} citizens.`,
      },
    ];
    room.winner = null;
    room.winReason = '';
    room.phase = 'ROLE_REVEAL';

    triggerBotActions(room);
    broadcastRoom(room);
    if (callback) callback({ ok: true });
  });

  socket.on('player_ready_role', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'ROLE_REVEAL') return;
    const player = room.players.find((p) => p.id === socket.data.playerId);
    if (player) {
      player.ready = true;
      checkRoleRevealComplete(room);
      broadcastRoom(room);
    }
  });

  socket.on('host_force_advance', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !canControlGameFlow(room, socket.data.playerId)) return;

    if (room.phase === 'ROLE_REVEAL') {
      startNightPhase(room);
    } else if (room.phase === 'NIGHT') {
      resolveNightActions(room);
    } else if (room.phase === 'DAWN') {
      room.phase = 'DAY_DISCUSSION';
    } else if (room.phase === 'DAY_DISCUSSION') {
      room.dayVotes = {};
      room.phase = 'DAY_VOTING';
      triggerBotActions(room);
    } else if (room.phase === 'DAY_VOTING') {
      resolveDayVoting(room);
    } else if (room.phase === 'VOTE_RESULTS') {
      startNightPhase(room);
    }
    broadcastRoom(room);
  });

  socket.on('night_action', ({ targetId }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'NIGHT') return;
    const participants = getActiveParticipants(room);
    const player = participants.find((p) => p.id === socket.data.playerId);
    if (!player || !player.alive) return;

    const target = participants.find((p) => p.id === targetId && p.alive);
    if (!target) return;

    if (player.role === 'MAFIA' || player.role === 'GODFATHER') {
      if (target.role === 'MAFIA' || target.role === 'GODFATHER') return;
      room.nightActions.mafiaVotes[player.id] = target.id;
    } else if (player.role === 'DOCTOR') {
      if (!room.settings.doctorSelfSave && target.id === player.id) return;
      room.nightActions.doctorTarget = target.id;
      room.nightActions.doctorSubmitted = true;
    } else if (player.role === 'DETECTIVE') {
      if (!room.nightActions.detectiveSubmitted && target.id !== player.id) {
        performDetectiveInvestigation(room, player, target);
      }
    }

    checkNightComplete(room);
    broadcastRoom(room);
  });

  socket.on('gm_skip_night_role', ({ roleId }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'NIGHT') return;
    if (!canControlGameFlow(room, socket.data.playerId)) return;

    if (roleId === 'DOCTOR') {
      room.nightActions.doctorTarget = null;
      room.nightActions.doctorSubmitted = true;
    } else if (roleId === 'DETECTIVE') {
      room.nightActions.detectiveTarget = null;
      room.nightActions.detectiveSubmitted = true;
    }

    checkNightComplete(room);
    broadcastRoom(room);
  });

  socket.on('mafia_chat', ({ text }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'NIGHT') return;
    const player = room.players.find((p) => p.id === socket.data.playerId);
    if (
      !player ||
      !player.alive ||
      (player.role !== 'MAFIA' && player.role !== 'GODFATHER')
    )
      return;

    const clean = (text || '').trim().slice(0, 200);
    if (!clean) return;
    room.mafiaChat.push({
      senderName: player.name,
      text: clean,
      timestamp: Date.now(),
    });
    broadcastRoom(room);
  });

  socket.on('day_vote', ({ targetId }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'DAY_VOTING') return;
    const participants = getActiveParticipants(room);
    const player = participants.find((p) => p.id === socket.data.playerId);
    if (!player || !player.alive) return;

    if (targetId !== 'SKIP') {
      const target = participants.find((p) => p.id === targetId && p.alive);
      if (!target) return;
    }

    room.dayVotes[player.id] = targetId;
    checkDayVotingComplete(room);
    broadcastRoom(room);
  });

  socket.on('play_again', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !canControlGameFlow(room, socket.data.playerId)) return;
    room.phase = 'LOBBY';
    room.round = 0;
    room.gameMasterId = null;
    room.winner = null;
    room.winReason = '';
    room.lastDawnReport = null;
    room.lastVoteReport = null;
    room.players.forEach((p) => {
      p.alive = true;
      p.role = null;
      p.ready = p.isBot;
      p.investigations = [];
    });
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.connected = false;
      broadcastRoom(room);
    }
  });
});

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', localIp: getLocalIpAddress() });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mafia Real-Time Server running on http://0.0.0.0:${PORT}`);
});
