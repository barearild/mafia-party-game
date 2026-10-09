import { createInitialRoom } from '../src/shared/roomEngine.js';
import { ROLES, assignAlternatingRoleImages } from '../src/shared/roles.js';

/**
 * Creates a fully initialized game room with specific player roles and settings for testing.
 *
 * @param {Object} options
 * @param {Array<{ id: string, name: string, role: string }>} options.roster
 * @param {string} [options.hostId]
 * @param {string|null} [options.gameMasterId]
 * @param {Object} [options.settings]
 * @param {string} [options.phase]
 * @returns {Object} A configured room object
 */
export function createTestRoom({
  roster = [
    { id: 'p1', name: 'Alice', role: 'GODFATHER' },
    { id: 'p2', name: 'Bob', role: 'MAFIA' },
    { id: 'p3', name: 'Charlie', role: 'DOCTOR' },
    { id: 'p4', name: 'Diana', role: 'DETECTIVE' },
    { id: 'p5', name: 'Ethan', role: 'VILLAGER' },
    { id: 'p6', name: 'Fiona', role: 'VILLAGER' },
  ],
  hostId = 'p1',
  gameMasterId = null,
  settings = {},
  phase = 'NIGHT',
} = {}) {
  const room = createInitialRoom('TEST', hostId, 'Host');
  room.gameMasterId = gameMasterId;
  room.phase = phase;
  room.round = 1;

  room.settings = {
    ...room.settings,
    doctorSelfSave: true,
    revealRoleOnDeath: true,
    ...settings,
  };

  room.players = roster.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: false,
    connected: true,
    alive: p.alive ?? true,
    role: p.role,
    ready: true,
    investigations: [],
  }));

  // Apply role image assignment
  room.players = assignAlternatingRoleImages(room.players);

  return room;
}

/**
 * Prepares the room for the next night phase by resetting action state and bumping round.
 */
export function advanceToNextNight(room) {
  room.round += 1;
  room.phase = 'NIGHT';
  room.nightActions = {
    mafiaVotes: {},
    mafiaConfirmed: {},
    doctorTarget: null,
    detectiveTarget: null,
    detectiveSubmitted: false,
    doctorSubmitted: false,
  };
  room.dayVotes = {};
}
