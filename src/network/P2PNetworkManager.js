import { Peer } from 'peerjs';
import {
  createInitialRoom,
  getActiveParticipants,
  syncRoleCountsIfAuto,
  checkWinCondition,
  buildStateForPlayer,
  performDetectiveInvestigation,
  resolveNightActions,
  resolveDayVoting,
  canControlGameFlow,
} from '../shared/roomEngine.js';
import {
  BOT_NAMES,
  assignAlternatingRoleImages,
} from '../shared/roles.js';

const ROOM_PEER_PREFIX = 'mafia-room-v1-';

export class P2PNetworkManager {
  constructor({ playerId, playerName, onStateUpdate, onError, onStatusChange }) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.onStateUpdate = onStateUpdate;
    this.onError = onError;
    this.onStatusChange = onStatusChange || (() => {});

    this.isHost = false;
    this.roomCode = null;
    this.peer = null;
    this.room = null; // Only populated on the host
    this.hostConnection = null; // Only on clients
    this.clientConnections = new Map(); // Only on host: Map<playerId, DataConnection>
    this.destroyed = false;
  }

  // --- HOST SETUP ---
  createRoom(customCode = null) {
    this.isHost = true;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = customCode;
    if (!code) {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    this.roomCode = code.toUpperCase().trim();
    this.room = createInitialRoom(this.roomCode, this.playerId, this.playerName);

    const peerId = `${ROOM_PEER_PREFIX}${this.roomCode}`;
    this.onStatusChange(`Initializing host network (Room ${this.roomCode})...`);

    this.peer = new Peer(peerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });

    this.peer.on('open', () => {
      this.onStatusChange(`Host ready`);
      this._broadcastRoom();
    });

    this.peer.on('connection', (conn) => {
      this._handleIncomingClient(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('P2P Host error:', err);
      if (err.type === 'unavailable-id') {
        // Room code collided with another active room on PeerJS cloud, retry with new code
        this.destroy();
        this.createRoom();
      } else {
        this.onError(`Network error: ${err.message || err.type}`);
      }
    });

    return this.roomCode;
  }

  // --- CLIENT SETUP ---
  joinRoom(code) {
    this.isHost = false;
    this.roomCode = (code || '').toUpperCase().trim();
    const hostPeerId = `${ROOM_PEER_PREFIX}${this.roomCode}`;
    const myClientPeerId = `mafia-client-${this.playerId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Math.random().toString(36).slice(2, 6)}`;

    this.onStatusChange(`Connecting to Room ${this.roomCode}...`);

    this.peer = new Peer(myClientPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });

    let connectTimeout = null;

    this.peer.on('open', () => {
      this.onStatusChange(`Connecting to host...`);
      const conn = this.peer.connect(hostPeerId, { reliable: true });
      this.hostConnection = conn;

      connectTimeout = setTimeout(() => {
        if (!conn.open) {
          this.onError(`Could not connect to Room ${this.roomCode}. Please ensure the host is online and check the PIN!`);
        }
      }, 10000);

      conn.on('open', () => {
        clearTimeout(connectTimeout);
        this.onStatusChange(`Connected!`);
        // Send join request
        conn.send({
          type: 'join_request',
          playerId: this.playerId,
          playerName: this.playerName,
        });
      });

      conn.on('data', (data) => {
        if (data?.type === 'room_state') {
          this.onStateUpdate(data.state);
        } else if (data?.type === 'error') {
          this.onError(data.message || 'Error from host');
        }
      });

      conn.on('close', () => {
        this.onError(`Disconnected from host. The host may have left or refreshed.`);
      });

      conn.on('error', (err) => {
        clearTimeout(connectTimeout);
        this.onError(`Connection failed: ${err.message || 'Unknown error'}`);
      });
    });

    this.peer.on('error', (err) => {
      if (connectTimeout) clearTimeout(connectTimeout);
      console.warn('P2P Client error:', err);
      if (err.type === 'peer-unavailable') {
        this.onError(`Room ${this.roomCode} was not found. Please verify the 4-letter code!`);
      } else {
        this.onError(`Network error: ${err.message || err.type}`);
      }
    });
  }

  // --- HOST INCOMING CLIENT CONNECTION HANDLER ---
  _handleIncomingClient(conn) {
    let clientPlayerId = null;

    conn.on('data', (data) => {
      if (!this.room) return;
      const { type } = data || {};

      if (type === 'join_request') {
        clientPlayerId = data.playerId;
        this.clientConnections.set(clientPlayerId, conn);

        let existing = this.room.players.find((p) => p.id === clientPlayerId);
        if (!existing && this.room.phase === 'LOBBY') {
          existing = this.room.players.find(
            (p) =>
              !p.isBot &&
              p.name.toLowerCase() === (data.playerName || '').trim().toLowerCase()
          );
          if (existing) {
            existing.id = clientPlayerId;
          }
        }

        if (existing) {
          existing.connected = true;
          if (data.playerName && this.room.phase === 'LOBBY') {
            existing.name = data.playerName.trim();
          }
        } else {
          if (this.room.phase !== 'LOBBY') {
            conn.send({
              type: 'error',
              message: 'Game is already in progress in this room!',
            });
            conn.close();
            return;
          }
          this.room.players.push({
            id: clientPlayerId,
            name: (data.playerName || `Player ${this.room.players.length + 1}`).trim(),
            isBot: false,
            connected: true,
            alive: true,
            role: null,
            ready: false,
            investigations: [],
          });
          syncRoleCountsIfAuto(this.room);
        }

        this._broadcastRoom();
        return;
      }

      // Route all client actions into host game logic
      this._handleAction(clientPlayerId, type, data);
    });

    conn.on('close', () => {
      if (clientPlayerId && this.room) {
        this.clientConnections.delete(clientPlayerId);
        const player = this.room.players.find((p) => p.id === clientPlayerId);
        if (player) {
          player.connected = false;
          this._broadcastRoom();
        }
      }
    });

    conn.on('error', (err) => {
      console.warn('Host client connection error:', err);
    });
  }

  // --- DISPATCH ACTIONS (Called by UI on host or received from client) ---
  dispatch(type, payload = {}) {
    if (this.isHost) {
      this._handleAction(this.playerId, type, payload);
    } else {
      if (this.hostConnection?.open) {
        this.hostConnection.send({ type, ...payload });
      }
    }
  }

  _handleAction(senderPlayerId, type, payload) {
    if (!this.room) return;
    const room = this.room;

    switch (type) {
      case 'add_bot': {
        if (room.phase !== 'LOBBY' || senderPlayerId !== room.hostId) return;
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
        this._broadcastRoom();
        break;
      }

      case 'remove_player': {
        if (room.phase !== 'LOBBY' || senderPlayerId !== room.hostId) return;
        const targetId = payload.targetPlayerId;
        if (targetId === room.hostId) return;
        room.players = room.players.filter((p) => p.id !== targetId);
        if (room.settings.assignedGmPlayerId === targetId) {
          room.settings.assignedGmPlayerId = room.hostId;
        }
        syncRoleCountsIfAuto(room);
        this._broadcastRoom();
        break;
      }

      case 'update_settings': {
        if (room.phase !== 'LOBBY' || senderPlayerId !== room.hostId) return;
        room.settings = { ...room.settings, ...payload.settings };
        syncRoleCountsIfAuto(room);
        this._broadcastRoom();
        break;
      }

      case 'draw_random_gm': {
        if (room.phase !== 'LOBBY' || senderPlayerId !== room.hostId) return;
        const humans = room.players.filter((p) => !p.isBot);
        const pool = humans.length > 0 ? humans : room.players;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        if (chosen) {
          room.settings.gmMode = 'ASSIGNED';
          room.settings.assignedGmPlayerId = chosen.id;
          syncRoleCountsIfAuto(room);
          this._broadcastRoom();
        }
        break;
      }

      case 'start_game': {
        if (room.phase !== 'LOBBY' || senderPlayerId !== room.hostId) return;
        const hasHumanGm = room.settings.gmMode && room.settings.gmMode !== 'NONE';
        const minRequired = hasHumanGm ? 5 : 4;

        if (room.players.length < minRequired) {
          const errText = hasHumanGm
            ? `With a dedicated Game Master enabled, you need at least 5 total players (1 Game Master + 4 Citizens). Add more players or AI Bots!`
            : `At least 4 players are required to start (you can add AI Bots to test or fill seats!).`;
          this.onError(errText);
          return;
        }

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

        this._triggerBotActions();
        this._broadcastRoom();
        break;
      }

      case 'player_ready_role': {
        if (room.phase !== 'ROLE_REVEAL') return;
        const player = room.players.find((p) => p.id === senderPlayerId);
        if (player) {
          player.ready = true;
          this._checkRoleRevealComplete();
          this._broadcastRoom();
        }
        break;
      }

      case 'host_force_advance': {
        if (!canControlGameFlow(room, senderPlayerId)) return;
        if (room.phase === 'ROLE_REVEAL') {
          this._startNightPhase();
        } else if (room.phase === 'NIGHT') {
          resolveNightActions(room);
        } else if (room.phase === 'DAWN') {
          room.phase = 'DAY_DISCUSSION';
        } else if (room.phase === 'DAY_DISCUSSION') {
          room.dayVotes = {};
          room.phase = 'DAY_VOTING';
          this._triggerBotActions();
        } else if (room.phase === 'DAY_VOTING') {
          resolveDayVoting(room);
        } else if (room.phase === 'VOTE_RESULTS') {
          this._startNightPhase();
        }
        this._broadcastRoom();
        break;
      }

      case 'night_action': {
        if (room.phase !== 'NIGHT') return;
        const participants = getActiveParticipants(room);
        const player = participants.find((p) => p.id === senderPlayerId);
        if (!player || !player.alive) return;

        const target = participants.find((p) => p.id === payload.targetId && p.alive);
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

        this._checkNightComplete();
        this._broadcastRoom();
        break;
      }

      case 'gm_skip_night_role': {
        if (room.phase !== 'NIGHT') return;
        if (!canControlGameFlow(room, senderPlayerId)) return;
        if (payload.roleId === 'DOCTOR') {
          room.nightActions.doctorTarget = null;
          room.nightActions.doctorSubmitted = true;
        } else if (payload.roleId === 'DETECTIVE') {
          room.nightActions.detectiveTarget = null;
          room.nightActions.detectiveSubmitted = true;
        }
        this._checkNightComplete();
        this._broadcastRoom();
        break;
      }

      case 'mafia_chat': {
        if (room.phase !== 'NIGHT') return;
        const player = room.players.find((p) => p.id === senderPlayerId);
        if (
          !player ||
          !player.alive ||
          (player.role !== 'MAFIA' && player.role !== 'GODFATHER')
        )
          return;
        const clean = (payload.text || '').trim().slice(0, 200);
        if (!clean) return;
        room.mafiaChat.push({
          senderName: player.name,
          text: clean,
          timestamp: Date.now(),
        });
        this._broadcastRoom();
        break;
      }

      case 'day_vote': {
        if (room.phase !== 'DAY_VOTING') return;
        const participants = getActiveParticipants(room);
        const player = participants.find((p) => p.id === senderPlayerId);
        if (!player || !player.alive) return;

        if (payload.targetId !== 'SKIP') {
          const target = participants.find((p) => p.id === payload.targetId && p.alive);
          if (!target) return;
        }

        room.dayVotes[player.id] = payload.targetId;
        this._checkDayVotingComplete();
        this._broadcastRoom();
        break;
      }

      case 'play_again': {
        if (!canControlGameFlow(room, senderPlayerId)) return;
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
        this._broadcastRoom();
        break;
      }

      default:
        break;
    }
  }

  // --- INTERNAL HOST HELPERS ---
  _startNightPhase() {
    const room = this.room;
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
    this._triggerBotActions();
  }

  _checkRoleRevealComplete() {
    if (this.room.players.every((p) => p.ready)) {
      this._startNightPhase();
    }
  }

  _checkNightComplete() {
    const room = this.room;
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

  _checkDayVotingComplete() {
    const room = this.room;
    if (room.phase !== 'DAY_VOTING') return;
    const participants = getActiveParticipants(room);
    const alivePlayers = participants.filter((p) => p.alive);
    const allVoted = alivePlayers.every((p) => Boolean(room.dayVotes[p.id]));
    if (allVoted) {
      resolveDayVoting(room);
    }
  }

  _triggerBotActions() {
    const room = this.room;
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
        this._checkRoleRevealComplete();
        this._broadcastRoom();
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

        this._checkNightComplete();
        this._broadcastRoom();
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

        this._checkDayVotingComplete();
        this._broadcastRoom();
      }, 1500);
    }
  }

  _broadcastRoom() {
    if (!this.room) return;

    // 1. Update host player directly
    const hostState = buildStateForPlayer(this.room, this.playerId);
    this.onStateUpdate(hostState);

    // 2. Broadcast filtered state to all connected peers
    this.clientConnections.forEach((conn, peerPlayerId) => {
      if (conn.open) {
        const playerState = buildStateForPlayer(this.room, peerPlayerId);
        conn.send({
          type: 'room_state',
          state: playerState,
        });
      }
    });
  }

  destroy() {
    this.destroyed = true;
    if (this.hostConnection) {
      try {
        this.hostConnection.close();
      } catch {}
    }
    this.clientConnections.forEach((conn) => {
      try {
        conn.close();
      } catch {}
    });
    this.clientConnections.clear();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
    }
  }
}
