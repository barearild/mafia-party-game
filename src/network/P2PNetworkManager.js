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
const STORAGE_ROOM_KEY = 'mafia_host_room_state_v1';

export class P2PNetworkManager {
  constructor({ playerId, playerName, isTvDisplay, onStateUpdate, onError, onStatusChange }) {
    this.playerId = playerId;
    let resolvedName = (playerName || '').trim();
    if ((!resolvedName || resolvedName.toLowerCase() === 'player') && typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('mafia_player_name');
        if (stored && stored.trim() && stored.trim().toLowerCase() !== 'player') {
          resolvedName = stored.trim();
        }
      } catch {}
    }
    this.playerName = resolvedName || (isTvDisplay ? 'Living Room TV' : 'Player');
    this.isTvDisplay = Boolean(isTvDisplay);
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
    this.reconnectTimer = null;
    this.phaseAutoTimer = null;
    this.hasConnectedOnce = false;
    this.wakeLock = null;

    this._setupVisibilityHandler();
    this._requestWakeLock();
  }

  // --- WAKE LOCK (Keeps screen awake on mobile) ---
  async _requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      } catch (e) {
        // WakeLock request can fail if low battery or permission denied
      }
    }
  }

  // --- VISIBILITY CHANGE / RESUME HANDLING ---
  _setupVisibilityHandler() {
    if (typeof document === 'undefined') return;

    this._visHandler = async () => {
      if (document.visibilityState === 'visible') {
        // Re-request wake lock
        this._requestWakeLock();

        if (this.destroyed) return;

        // If Host: check if Peer is disconnected from signaling server or destroyed
        if (this.isHost) {
          if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
            try {
              this.peer.reconnect();
            } catch (e) {
              console.warn('Host reconnect error:', e);
            }
          } else if (!this.peer || this.peer.destroyed) {
            // Peer completely closed by OS: re-init host peer with preserved state
            this._initHostPeer();
          }
        } else {
          // If Client: check if host connection is alive
          if (!this.hostConnection || !this.hostConnection.open) {
            this._reconnectToHost();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', this._visHandler);
  }

  // --- PERSISTENCE HELPERS (Host Room State) ---
  _saveHostRoomToStorage() {
    if (!this.room || !this.roomCode) return;
    try {
      const payload = JSON.stringify(this.room);
      sessionStorage.setItem(STORAGE_ROOM_KEY, payload);
      localStorage.setItem(STORAGE_ROOM_KEY, payload);
    } catch {}
  }

  _loadHostRoomFromStorage(expectedCode) {
    try {
      const raw =
        sessionStorage.getItem(STORAGE_ROOM_KEY) ||
        localStorage.getItem(STORAGE_ROOM_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.code === expectedCode) {
        if (parsed.hostId && parsed.hostId !== this.playerId) {
          this.playerId = parsed.hostId;
        }
        return parsed;
      }
    } catch {}
    return null;
  }

  clearHostStorage() {
    try {
      sessionStorage.removeItem(STORAGE_ROOM_KEY);
      localStorage.removeItem(STORAGE_ROOM_KEY);
    } catch {}
  }

  // --- HOST SETUP ---
  createRoom(customCode = null) {
    this.isHost = true;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = customCode;

    if (!code) {
      // Check if we already have an active room stored for this session
      try {
        const saved =
          sessionStorage.getItem(STORAGE_ROOM_KEY) ||
          localStorage.getItem(STORAGE_ROOM_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.code && (parsed?.hostId === this.playerId || !parsed?.hostId)) {
            code = parsed.code;
            this.room = parsed;
          }
        }
      } catch {}

      if (!code) {
        code = '';
        for (let i = 0; i < 4; i++) {
          code += chars[Math.floor(Math.random() * chars.length)];
        }
      }
    }

    this.roomCode = code.toUpperCase().trim();
    if (!this.room) {
      this.room = createInitialRoom(this.roomCode, this.playerId, this.playerName, this.isTvDisplay);
      this._saveHostRoomToStorage();
    } else if (this.isTvDisplay) {
      const hostPlayer = this.room.players.find((p) => p.id === this.playerId);
      if (hostPlayer) {
        hostPlayer.name = this.playerName || 'Living Room TV';
        hostPlayer.isTvDisplay = true;
        hostPlayer.isGameMaster = true;
        hostPlayer.role = 'GAMEMASTER';
        hostPlayer.ready = true;
      }
      this.room.gameMasterId = this.playerId;
      this.room.settings.gmMode = 'ASSIGNED';
      this.room.settings.assignedGmPlayerId = this.playerId;
      syncRoleCountsIfAuto(this.room);
      this._saveHostRoomToStorage();
    }

    // Immediately emit local state for zero latency UI rendering
    this._broadcastRoom();

    this._initHostPeer();
    return this.roomCode;
  }

  _initHostPeer() {
    const peerId = `${ROOM_PEER_PREFIX}${this.roomCode}`;
    this.onStatusChange(`Initializing room host (Room ${this.roomCode})...`);

    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy();
      } catch {}
    }

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

    this.peer.on('disconnected', () => {
      // Signaling disconnected (e.g. mobile sleep) - attempt reconnect to broker
      if (!this.destroyed && this.peer && !this.peer.destroyed) {
        try {
          this.peer.reconnect();
        } catch {}
      }
    });

    this.peer.on('error', (err) => {
      console.warn('P2P Host error:', err);
      if (err.type === 'unavailable-id') {
        // If room ID is taken, retry with a fresh code
        this.clearHostStorage();
        this.destroy();
        this.createRoom();
      } else {
        // Non-fatal warning or network fluctuation
        console.warn('Network issue:', err.message || err.type);
      }
    });
  }

  resumeHost(code) {
    this.isHost = true;
    const cleanCode = (code || '').toUpperCase().trim();
    const saved = this._loadHostRoomFromStorage(cleanCode);
    if (saved) {
      this.roomCode = cleanCode;
      this.room = saved;
      if (this.isTvDisplay) {
        const hostPlayer = this.room.players.find((p) => p.id === this.playerId);
        if (hostPlayer) {
          hostPlayer.name = this.playerName || 'Living Room TV';
          hostPlayer.isTvDisplay = true;
          hostPlayer.isGameMaster = true;
          hostPlayer.role = 'GAMEMASTER';
          hostPlayer.ready = true;
        }
        this.room.gameMasterId = this.playerId;
        this.room.settings.gmMode = 'ASSIGNED';
        this.room.settings.assignedGmPlayerId = this.playerId;
        syncRoleCountsIfAuto(this.room);
        this._saveHostRoomToStorage();
      }
      this._broadcastRoom();
    } else {
      return this.createRoom(cleanCode);
    }
    this._initHostPeer();
    return this.roomCode;
  }

  // --- CLIENT SETUP ---
  joinRoom(code) {
    const cleanCode = (code || '').toUpperCase().trim();

    // Check if WE are actually the host of this room in storage
    const saved = this._loadHostRoomFromStorage(cleanCode);
    if (saved && saved.hostId === this.playerId) {
      return this.resumeHost(cleanCode);
    }

    this.isHost = false;
    this.roomCode = cleanCode;
    this._connectAsClient();
  }

  _connectAsClient() {
    const hostPeerId = `${ROOM_PEER_PREFIX}${this.roomCode}`;
    const myClientPeerId = `mafia-client-${this.playerId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Math.random().toString(36).slice(2, 6)}`;

    this.onStatusChange(`Connecting to Room ${this.roomCode}...`);

    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.destroy();
      } catch {}
    }

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
      }, 8000);

      conn.on('open', () => {
        clearTimeout(connectTimeout);
        this.hasConnectedOnce = true;
        this.onStatusChange(`Connected!`);
        conn.send({
          type: 'join_request',
          playerId: this.playerId,
          playerName: this.playerName,
          isTvDisplay: this.isTvDisplay,
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
        if (this.hasConnectedOnce) {
          this._scheduleClientReconnect();
        } else {
          this.onError(`Could not connect to Room ${this.roomCode}. The host may be offline.`);
        }
      });

      conn.on('error', (err) => {
        clearTimeout(connectTimeout);
        if (this.hasConnectedOnce) {
          this._scheduleClientReconnect();
        } else {
          this.onError(`Could not connect to Room ${this.roomCode}. The host may be offline.`);
        }
      });
    });

    this.peer.on('error', (err) => {
      if (connectTimeout) clearTimeout(connectTimeout);
      console.warn('P2P Client error:', err);
      if (err.type === 'peer-unavailable') {
        if (this.hasConnectedOnce) {
          this._scheduleClientReconnect();
        } else {
          this.onError(`Room ${this.roomCode} was not found. Please ensure the host is online and check the PIN!`);
        }
      } else {
        this.onError(`Network error: ${err.message || err.type}`);
      }
    });
  }

  _scheduleClientReconnect() {
    if (this.destroyed) return;
    this.onStatusChange(`Host screen paused. Waiting for host to reconnect...`);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    let retryCount = 0;
    const maxRetries = 5;

    const tryRetry = () => {
      if (this.destroyed) return;
      retryCount++;
      if (retryCount <= maxRetries) {
        this.onStatusChange(`Reconnecting to host (attempt ${retryCount}/${maxRetries})...`);
        const hostPeerId = `${ROOM_PEER_PREFIX}${this.roomCode}`;
        if (this.peer && !this.peer.destroyed) {
          const conn = this.peer.connect(hostPeerId, { reliable: true });
          this.hostConnection = conn;
          conn.on('open', () => {
            this.onStatusChange(`Reconnected!`);
            conn.send({
              type: 'join_request',
              playerId: this.playerId,
              playerName: this.playerName,
            });
          });
          conn.on('data', (data) => {
            if (data?.type === 'room_state') {
              this.onStateUpdate(data.state);
            }
          });
        }
        this.reconnectTimer = setTimeout(tryRetry, 3000);
      } else {
        this.onError(`Disconnected from host. The host may have closed their game.`);
      }
    };

    this.reconnectTimer = setTimeout(tryRetry, 2500);
  }

  _reconnectToHost() {
    if (this.destroyed || this.isHost) return;
    this._scheduleClientReconnect();
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

        const isTv = Boolean(data.isTvDisplay);
        if (existing) {
          existing.connected = true;
          const incomingName = (data.playerName || '').trim();
          if (incomingName && this.room.phase === 'LOBBY') {
            if (incomingName.toLowerCase() !== 'player' || existing.name === 'Player') {
              existing.name = incomingName;
            }
          }
          if (isTv) {
            existing.isGameMaster = true;
            existing.isTvDisplay = true;
            existing.role = 'GAMEMASTER';
            existing.ready = true;
            this.room.gameMasterId = existing.id;
            this.room.settings.gmMode = 'ASSIGNED';
            this.room.settings.assignedGmPlayerId = existing.id;
            syncRoleCountsIfAuto(this.room);
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
            name: (data.playerName || (isTv ? 'Living Room TV' : `Player ${this.room.players.length + 1}`)).trim(),
            isBot: false,
            connected: true,
            alive: true,
            role: isTv ? 'GAMEMASTER' : null,
            isGameMaster: isTv,
            isTvDisplay: isTv,
            ready: isTv ? true : false,
            investigations: [],
          });
          if (isTv) {
            this.room.gameMasterId = clientPlayerId;
            this.room.settings.gmMode = 'ASSIGNED';
            this.room.settings.assignedGmPlayerId = clientPlayerId;
          }
          syncRoleCountsIfAuto(this.room);
        }

        this._saveHostRoomToStorage();
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
          this._saveHostRoomToStorage();
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
        if (room.phase !== 'LOBBY' || !canControlGameFlow(room, senderPlayerId)) return;
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
        this._saveHostRoomToStorage();
        this._broadcastRoom();
        break;
      }

      case 'remove_player': {
        if (room.phase !== 'LOBBY' || !canControlGameFlow(room, senderPlayerId)) return;
        const targetId = payload.targetPlayerId;
        if (targetId === room.hostId) return;
        room.players = room.players.filter((p) => p.id !== targetId);
        if (room.settings.assignedGmPlayerId === targetId) {
          room.settings.assignedGmPlayerId = room.hostId;
        }
        syncRoleCountsIfAuto(room);
        this._saveHostRoomToStorage();
        this._broadcastRoom();
        break;
      }

      case 'update_settings': {
        if (room.phase !== 'LOBBY' || !canControlGameFlow(room, senderPlayerId)) return;
        room.settings = { ...room.settings, ...payload.settings };
        syncRoleCountsIfAuto(room);
        this._saveHostRoomToStorage();
        this._broadcastRoom();
        break;
      }

      case 'update_player_name': {
        if (room.phase !== 'LOBBY') return;
        const newName = (payload?.name || '').trim().slice(0, 30);
        if (!newName) return;
        const player = room.players.find((p) => p.id === senderPlayerId);
        if (player) {
          player.name = newName;
          this._saveHostRoomToStorage();
          this._broadcastRoom();
        }
        break;
      }

      case 'register_tv_gm': {
        const player = room.players.find((p) => p.id === senderPlayerId);
        if (player) {
          player.isGameMaster = true;
          player.isTvDisplay = true;
          player.role = 'GAMEMASTER';
          player.ready = true;
          room.gameMasterId = player.id;
          room.settings.gmMode = 'ASSIGNED';
          room.settings.assignedGmPlayerId = player.id;
          syncRoleCountsIfAuto(room);
          this._saveHostRoomToStorage();
          this._broadcastRoom();
        }
        break;
      }

      case 'exit_tv_to_player': {
        const player = room.players.find((p) => p.id === senderPlayerId);
        if (player) {
          player.isGameMaster = false;
          player.isTvDisplay = false;
          if (payload?.playerName) {
            player.name = payload.playerName.trim();
          } else if (player.name === 'Living Room TV') {
            player.name = 'Player';
          }
          if (room.phase === 'LOBBY') {
            player.role = null;
            player.ready = false;
          }
          if (room.gameMasterId === player.id) {
            room.gameMasterId = null;
          }
          if (room.settings.assignedGmPlayerId === player.id) {
            room.settings.gmMode = 'NONE';
            room.settings.assignedGmPlayerId = null;
          }
          syncRoleCountsIfAuto(room);
          this._saveHostRoomToStorage();
          this._broadcastRoom();
        }
        break;
      }

      case 'draw_random_gm': {
        if (room.phase !== 'LOBBY' || !canControlGameFlow(room, senderPlayerId)) return;
        const humans = room.players.filter((p) => !p.isBot && !p.isTvDisplay);
        const pool = humans.length > 0 ? humans : room.players.filter((p) => !p.isTvDisplay);
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        if (chosen) {
          room.settings.gmMode = 'ASSIGNED';
          room.settings.assignedGmPlayerId = chosen.id;
          syncRoleCountsIfAuto(room);
          this._saveHostRoomToStorage();
          this._broadcastRoom();
        }
        break;
      }

      case 'start_game': {
        if (room.phase !== 'LOBBY' || !canControlGameFlow(room, senderPlayerId)) return;
        const hasTvDisplay = room.players.some((p) => p.isTvDisplay);
        const hasHumanGm = hasTvDisplay || (room.settings.gmMode && room.settings.gmMode !== 'NONE');
        const minRequired = hasHumanGm ? 5 : 4;

        if (room.players.length < minRequired) {
          const errText = hasHumanGm
            ? `With a dedicated Game Master enabled, you need at least 5 total players (1 Game Master + 4 Citizens). Add more players or AI Bots!`
            : `At least 4 players are required to start (you can add AI Bots to test or fill seats!).`;
          this.onError(errText);
          return;
        }

        // If a TV display exists in the room, it MUST be the Game Master
        const tvPlayer = room.players.find((p) => p.isTvDisplay);
        if (tvPlayer) {
          room.gameMasterId = tvPlayer.id;
          tvPlayer.isGameMaster = true;
          tvPlayer.role = 'GAMEMASTER';
          tvPlayer.ready = true;
          room.settings.gmMode = 'ASSIGNED';
          room.settings.assignedGmPlayerId = tvPlayer.id;
        } else if (room.settings.gmMode === 'ASSIGNED') {
          const targetGm =
            room.players.find((p) => p.id === room.settings.assignedGmPlayerId) ||
            room.players.find((p) => !p.isBot) ||
            room.players[0];
          room.gameMasterId = targetGm ? targetGm.id : null;
        } else if (room.settings.gmMode === 'RANDOM') {
          const humans = room.players.filter((p) => !p.isBot && !p.isTvDisplay);
          const pool = humans.length > 0 ? humans : room.players;
          const drawn = pool[Math.floor(Math.random() * pool.length)];
          room.gameMasterId = drawn ? drawn.id : null;
        } else {
          room.gameMasterId = null;
        }

        syncRoleCountsIfAuto(room);
        const citizenPlayers = room.players.filter(
          (p) => p.id !== room.gameMasterId && !p.isGameMaster && p.role !== 'GAMEMASTER' && !p.isTvDisplay
        );

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
          if (p.id === room.gameMasterId || p.isGameMaster || p.role === 'GAMEMASTER' || p.isTvDisplay) {
            p.role = 'GAMEMASTER';
            p.isGameMaster = true;
            p.alive = true;
            p.ready = true;
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
        this._handlePhaseChange();
        this._saveHostRoomToStorage();
        this._broadcastRoom();
        break;
      }

      case 'player_ready_role': {
        if (room.phase !== 'ROLE_REVEAL') return;
        const player = room.players.find((p) => p.id === senderPlayerId);
        if (player) {
          player.ready = true;
          this._checkRoleRevealComplete();
          this._saveHostRoomToStorage();
          this._broadcastRoom();
        }
        break;
      }

      case 'host_force_advance': {
        if (!canControlGameFlow(room, senderPlayerId)) return;
        this._clearPhaseTimers();
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
        this._handlePhaseChange();
        this._saveHostRoomToStorage();
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
          if (room.nightActions.mafiaConfirmed) {
            delete room.nightActions.mafiaConfirmed[player.id];
          }
        } else if (player.role === 'DOCTOR') {
          if (!room.settings.doctorSelfSave && target.id === player.id) return;
          room.nightActions.doctorTarget = target.id;
          room.nightActions.doctorSubmitted = false;
        } else if (player.role === 'DETECTIVE') {
          if (target.id !== player.id) {
            const alreadyInspected = (player.investigations || []).some(
              (inv) => inv.round === room.round
            );
            if (!alreadyInspected) {
              performDetectiveInvestigation(room, player, target, false);
            }
          }
        }

        this._checkNightComplete();
        this._saveHostRoomToStorage();
        this._broadcastRoom();
        break;
      }

      case 'confirm_night_action': {
        if (room.phase !== 'NIGHT') return;
        const participants = getActiveParticipants(room);
        const player = participants.find((p) => p.id === senderPlayerId);
        if (!player || !player.alive) return;

        if (player.role === 'MAFIA' || player.role === 'GODFATHER') {
          if (room.nightActions.mafiaVotes[player.id]) {
            if (!room.nightActions.mafiaConfirmed) room.nightActions.mafiaConfirmed = {};
            room.nightActions.mafiaConfirmed[player.id] = true;
          }
        } else if (player.role === 'DOCTOR') {
          if (room.nightActions.doctorTarget) {
            room.nightActions.doctorSubmitted = true;
          }
        } else if (player.role === 'DETECTIVE') {
          if (room.nightActions.detectiveTarget) {
            room.nightActions.detectiveSubmitted = true;
          }
        }

        this._checkNightComplete();
        this._saveHostRoomToStorage();
        this._broadcastRoom();
        break;
      }

      case 'unconfirm_night_action': {
        if (room.phase !== 'NIGHT') return;
        const player = room.players.find((p) => p.id === senderPlayerId);
        if (!player || !player.alive) return;

        if (player.role === 'MAFIA' || player.role === 'GODFATHER') {
          if (room.nightActions.mafiaConfirmed) {
            delete room.nightActions.mafiaConfirmed[player.id];
          }
        } else if (player.role === 'DOCTOR') {
          room.nightActions.doctorSubmitted = false;
        } else if (player.role === 'DETECTIVE') {
          room.nightActions.detectiveSubmitted = false;
        }

        if (this.nightResolveTimer) {
          clearTimeout(this.nightResolveTimer);
          this.nightResolveTimer = null;
          room.phaseExpiresAt = null;
        }

        this._saveHostRoomToStorage();
        this._broadcastRoom();
        break;
      }

      case 'gm_record_night_action': {
        if (room.phase !== 'NIGHT') return;
        if (!canControlGameFlow(room, senderPlayerId)) return;
        const participants = getActiveParticipants(room);
        const targetId = payload.targetId;
        const target = targetId ? participants.find((p) => p.id === targetId && p.alive) : null;

        if (payload.roleId === 'MAFIA') {
          if (target) {
            if (!room.nightActions.mafiaConfirmed) room.nightActions.mafiaConfirmed = {};
            participants.forEach((m) => {
              if (m.alive && (m.role === 'MAFIA' || m.role === 'GODFATHER')) {
                room.nightActions.mafiaVotes[m.id] = target.id;
                room.nightActions.mafiaConfirmed[m.id] = true;
              }
            });
          }
        } else if (payload.roleId === 'DOCTOR') {
          room.nightActions.doctorTarget = target ? target.id : null;
          room.nightActions.doctorSubmitted = true;
        } else if (payload.roleId === 'DETECTIVE') {
          if (target) {
            const detectivePlayer = participants.find((p) => p.alive && p.role === 'DETECTIVE');
            if (detectivePlayer) {
              performDetectiveInvestigation(room, detectivePlayer, target, true);
            }
          } else {
            room.nightActions.detectiveTarget = null;
            room.nightActions.detectiveSubmitted = true;
          }
        }

        this._checkNightComplete();
        this._saveHostRoomToStorage();
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
        this._saveHostRoomToStorage();
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
        this._saveHostRoomToStorage();
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
        this._saveHostRoomToStorage();
        this._broadcastRoom();
        break;
      }

      case 'play_again': {
        if (!canControlGameFlow(room, senderPlayerId)) return;
        this._clearPhaseTimers();
        room.phase = 'LOBBY';
        room.round = 0;
        room.winner = null;
        room.winReason = '';
        room.lastDawnReport = null;
        room.lastVoteReport = null;
        room.phaseExpiresAt = null;
        const tvPlayer = room.players.find((p) => p.isTvDisplay);
        room.gameMasterId = tvPlayer ? tvPlayer.id : null;
        room.players.forEach((p) => {
          p.alive = true;
          p.investigations = [];
          if (p.isTvDisplay) {
            p.role = 'GAMEMASTER';
            p.isGameMaster = true;
            p.ready = true;
          } else {
            p.role = null;
            p.isGameMaster = false;
            p.ready = p.isBot;
          }
        });
        this._saveHostRoomToStorage();
        this._broadcastRoom();
        break;
      }

      default:
        break;
    }
  }

  // --- INTERNAL HOST HELPERS ---
  _clearPhaseTimers() {
    if (this.phaseAutoTimer) {
      clearTimeout(this.phaseAutoTimer);
      this.phaseAutoTimer = null;
    }
    if (this.nightResolveTimer) {
      clearTimeout(this.nightResolveTimer);
      this.nightResolveTimer = null;
    }
    if (this.roleRevealAdvanceTimer) {
      clearTimeout(this.roleRevealAdvanceTimer);
      this.roleRevealAdvanceTimer = null;
    }
  }

  _handlePhaseChange() {
    if (!this.isHost || !this.room) return;
    this._clearPhaseTimers();
    const room = this.room;

    const hasTvOrAuto =
      room.players.some((p) => p.isTvDisplay) ||
      room.settings.gmMode === 'NONE' ||
      Boolean(room.settings.autoProgress);

    if (room.phase === 'DAWN') {
      if (hasTvOrAuto) {
        room.phaseExpiresAt = Date.now() + 12000;
        this.phaseAutoTimer = setTimeout(() => {
          if (this.room && this.room.phase === 'DAWN') {
            this.room.phase = 'DAY_DISCUSSION';
            this._handlePhaseChange();
            this._saveHostRoomToStorage();
            this._broadcastRoom();
          }
        }, 12000);
      } else {
        room.phaseExpiresAt = null;
      }
    } else if (room.phase === 'DAY_DISCUSSION') {
      if (hasTvOrAuto) {
        const durationMs = 60000;
        room.phaseExpiresAt = Date.now() + durationMs;
        this.phaseAutoTimer = setTimeout(() => {
          if (this.room && this.room.phase === 'DAY_DISCUSSION') {
            this.room.dayVotes = {};
            this.room.phase = 'DAY_VOTING';
            this.room.phaseExpiresAt = null;
            this._triggerBotActions();
            this._handlePhaseChange();
            this._saveHostRoomToStorage();
            this._broadcastRoom();
          }
        }, durationMs);
      } else {
        room.phaseExpiresAt = null;
      }
    } else if (room.phase === 'DAY_VOTING') {
      room.phaseExpiresAt = null;
      this._checkDayVotingComplete();
    } else if (room.phase === 'VOTE_RESULTS') {
      if (hasTvOrAuto) {
        room.phaseExpiresAt = Date.now() + 12000;
        this.phaseAutoTimer = setTimeout(() => {
          if (this.room && this.room.phase === 'VOTE_RESULTS') {
            this._startNightPhase();
            this._saveHostRoomToStorage();
            this._broadcastRoom();
          }
        }, 12000);
      } else {
        room.phaseExpiresAt = null;
      }
    } else if (room.phase === 'ROLE_REVEAL') {
      room.phaseExpiresAt = null;
      this._checkRoleRevealComplete();
    } else if (room.phase === 'NIGHT') {
      room.phaseExpiresAt = null;
      this._checkNightComplete();
    } else {
      room.phaseExpiresAt = null;
    }
  }

  _startNightPhase() {
    this._clearPhaseTimers();
    const room = this.room;
    room.phase = 'NIGHT';
    room.round += 1;
    room.phaseExpiresAt = null;
    room.nightActions = {
      mafiaVotes: {},
      mafiaConfirmed: {},
      doctorTarget: null,
      detectiveTarget: null,
      detectiveSubmitted: false,
      doctorSubmitted: false,
    };
    room.mafiaChat = [];
    this._triggerBotActions();
    this._handlePhaseChange();
  }

  _checkRoleRevealComplete() {
    if (this.room.players.every((p) => p.ready)) {
      if (!this.roleRevealAdvanceTimer) {
        this.room.phaseExpiresAt = Date.now() + 2500;
        this._saveHostRoomToStorage();
        this._broadcastRoom();

        this.roleRevealAdvanceTimer = setTimeout(() => {
          this.roleRevealAdvanceTimer = null;
          if (this.room && this.room.phase === 'ROLE_REVEAL') {
            this._startNightPhase();
            this._saveHostRoomToStorage();
            this._broadcastRoom();
          }
        }, 2500);
      }
    } else {
      if (this.roleRevealAdvanceTimer) {
        clearTimeout(this.roleRevealAdvanceTimer);
        this.roleRevealAdvanceTimer = null;
        this.room.phaseExpiresAt = null;
      }
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
      aliveMafia.every(
        (m) =>
          Boolean(room.nightActions.mafiaVotes[m.id]) &&
          Boolean(room.nightActions.mafiaConfirmed?.[m.id])
      );
    const doctorDone = !aliveDoctor || Boolean(room.nightActions.doctorSubmitted);
    const detectiveDone = !aliveDetective || Boolean(room.nightActions.detectiveSubmitted);

    if (mafiaDone && doctorDone && detectiveDone) {
      if (!this.nightResolveTimer) {
        room.phaseExpiresAt = Date.now() + 3000;
        this._saveHostRoomToStorage();
        this._broadcastRoom();

        this.nightResolveTimer = setTimeout(() => {
          this.nightResolveTimer = null;
          if (this.room && this.room.phase === 'NIGHT') {
            resolveNightActions(this.room);
            this._handlePhaseChange();
            this._saveHostRoomToStorage();
            this._broadcastRoom();
          }
        }, 3000);
      }
    } else {
      if (this.nightResolveTimer) {
        clearTimeout(this.nightResolveTimer);
        this.nightResolveTimer = null;
        room.phaseExpiresAt = null;
      }
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
      this._handlePhaseChange();
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
        this._saveHostRoomToStorage();
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
                if (!room.nightActions.mafiaConfirmed) {
                  room.nightActions.mafiaConfirmed = {};
                }
                room.nightActions.mafiaConfirmed[bot.id] = true;
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
              performDetectiveInvestigation(room, bot, target, true);
            }
          }
        });

        this._checkNightComplete();
        this._saveHostRoomToStorage();
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
        this._saveHostRoomToStorage();
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
    this._clearPhaseTimers();
    if (this._visHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visHandler);
    }
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
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
