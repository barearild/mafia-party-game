import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveParticipants,
  getExpectedCitizenCount,
  syncRoleCountsIfAuto,
  canControlGameFlow,
} from '../src/shared/roomEngine.js';
import {
  ROLES,
  getRoleImage,
  assignAlternatingRoleImages,
  getRecommendedRoleConfig,
} from '../src/shared/roles.js';
import { createTestRoom } from './fixtures.js';

describe('GM Modes & Role Assignment Architecture', () => {
  it('should correctly distinguish active participants when a dedicated GM is present', () => {
    const room = createTestRoom({
      roster: [
        { id: 'gm_user', name: 'DedicatedGM', role: 'GAMEMASTER' },
        { id: 'p1', name: 'Alice', role: 'GODFATHER' },
        { id: 'p2', name: 'Bob', role: 'MAFIA' },
        { id: 'p3', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p4', name: 'Diana', role: 'DETECTIVE' },
        { id: 'p5', name: 'Ethan', role: 'VILLAGER' },
      ],
      gameMasterId: 'gm_user',
      settings: { gmMode: 'ASSIGNED' },
    });

    const participants = getActiveParticipants(room);
    assert.equal(participants.length, 5);
    assert.equal(participants.some((p) => p.id === 'gm_user'), false);

    const citizenCount = getExpectedCitizenCount(room);
    assert.equal(citizenCount, 5);
  });

  it('should count all players as active participants in AI GM mode (NONE)', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Alice', role: 'GODFATHER' },
        { id: 'p2', name: 'Bob', role: 'MAFIA' },
        { id: 'p3', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p4', name: 'Diana', role: 'DETECTIVE' },
      ],
      gameMasterId: null,
      settings: { gmMode: 'NONE' },
    });

    const participants = getActiveParticipants(room);
    assert.equal(participants.length, 4);

    const citizenCount = getExpectedCitizenCount(room);
    assert.equal(citizenCount, 4);
  });

  it('should restrict game flow controls exclusively to Host or Game Master', () => {
    const room = createTestRoom({
      hostId: 'host_player',
      gameMasterId: 'gm_player',
      roster: [
        { id: 'host_player', name: 'Host', role: 'VILLAGER' },
        { id: 'gm_player', name: 'Narrator', role: 'GAMEMASTER' },
        { id: 'regular_player', name: 'Citizen', role: 'VILLAGER' },
      ],
    });

    assert.equal(canControlGameFlow(room, 'host_player'), true);
    assert.equal(canControlGameFlow(room, 'gm_player'), true);
    assert.equal(canControlGameFlow(room, 'regular_player'), false);
    assert.equal(canControlGameFlow(room, 'stranger_id'), false);

    // Also allows assigned GM in settings during lobby
    room.gameMasterId = null;
    room.settings.assignedGmPlayerId = 'assigned_gm';
    assert.equal(canControlGameFlow(room, 'assigned_gm'), true);
  });

  it('should dynamically balance recommended roles according to player counts', () => {
    // 4 players (minimal)
    const deck4 = getRecommendedRoleConfig(4);
    assert.equal(deck4.MAFIA, 1);
    assert.equal(deck4.VILLAGER, 1);

    // 7 players
    const deck7 = getRecommendedRoleConfig(7);
    assert.equal(deck7.GODFATHER, 1);
    assert.equal(deck7.MAFIA, 1);
    assert.equal(deck7.DOCTOR, 1);
    assert.equal(deck7.DETECTIVE, 1);
    assert.equal(deck7.VILLAGER, 3);

    // 10 players
    const deck10 = getRecommendedRoleConfig(10);
    assert.equal(deck10.GODFATHER, 1);
    assert.equal(deck10.MAFIA, 2);
    assert.equal(deck10.VILLAGER, 5);
  });

  it('should cycle through alternative role illustrations without out-of-bounds indexing', () => {
    const players = [
      { id: 'v1', role: 'VILLAGER' },
      { id: 'v2', role: 'VILLAGER' },
      { id: 'v3', role: 'VILLAGER' },
      { id: 'v4', role: 'VILLAGER' },
      { id: 'v5', role: 'VILLAGER' },
      { id: 'v6', role: 'VILLAGER' },
    ];

    // Game 1
    const game1Assignment = assignAlternatingRoleImages(players, 0);
    const villagerPool = ROLES.VILLAGER.images;

    // All players must have a valid roleImage from the pool
    for (const p of game1Assignment) {
      assert.ok(p.roleImage);
      assert.ok(villagerPool.includes(p.roleImage));
      assert.ok(typeof p.roleVariantIndex === 'number');
    }

    // Two consecutive villagers must receive different variant illustrations
    assert.notEqual(game1Assignment[0].roleImage, game1Assignment[1].roleImage);
    assert.notEqual(game1Assignment[1].roleImage, game1Assignment[2].roleImage);

    // Game 2 with offset
    const game2Assignment = assignAlternatingRoleImages(players, 1);
    assert.notEqual(game1Assignment[0].roleImage, game2Assignment[0].roleImage);
  });

  it('should fall back to locked default image for invalid or null variant index', () => {
    const defaultDetective = ROLES.DETECTIVE.image;
    assert.equal(getRoleImage('DETECTIVE', null), defaultDetective);
    assert.equal(getRoleImage('DETECTIVE', undefined), defaultDetective);
    assert.equal(getRoleImage('NONEXISTENT_ROLE', 0), '');
  });
});
