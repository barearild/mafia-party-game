import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveNightActions,
  resolveDayVoting,
  performDetectiveInvestigation,
  buildStateForPlayer,
} from '../src/shared/roomEngine.js';
import { createTestRoom } from './fixtures.js';

describe('Room Engine — Corner Cases & Edge Cases', () => {
  it('should break a split Mafia vote using the Godfather choice', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Vito', role: 'GODFATHER' },
        { id: 'p2', name: 'Sonny', role: 'MAFIA' },
        { id: 'p3', name: 'TargetA', role: 'VILLAGER' },
        { id: 'p4', name: 'TargetB', role: 'VILLAGER' },
        { id: 'p5', name: 'Charlie', role: 'DOCTOR' },
      ],
    });

    // Godfather votes for TargetA (p3); Sonny votes for TargetB (p4)
    room.nightActions.mafiaVotes = {
      p1: 'p3',
      p2: 'p4',
    };

    resolveNightActions(room);

    // Vito (Godfather) voted p3, so p3 should be chosen as the victim
    assert.equal(room.lastDawnReport.victim?.id, 'p3');
    assert.equal(room.players.find((p) => p.id === 'p3').alive, false);
    assert.equal(room.players.find((p) => p.id === 'p4').alive, true);
  });

  it('should handle a Day voting tie as a deadlock without exiling anyone', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Alice', role: 'VILLAGER' },
        { id: 'p2', name: 'Bob', role: 'VILLAGER' },
        { id: 'p3', name: 'Charlie', role: 'MAFIA' },
        { id: 'p4', name: 'Diana', role: 'DOCTOR' },
      ],
      phase: 'DAY_VOTING',
    });

    // 2 votes for p1, 2 votes for p3
    room.dayVotes = {
      p1: 'p3',
      p2: 'p3',
      p3: 'p1',
      p4: 'p1',
    };

    resolveDayVoting(room);

    assert.equal(room.phase, 'VOTE_RESULTS');
    assert.equal(room.lastVoteReport.exiledPlayer, null);
    assert.match(room.lastVoteReport.outcomeText, /deadlock/i);
    // Ensure all players remain alive
    assert.equal(room.players.every((p) => p.alive), true);
  });

  it('should allow the Town to explicitly vote SKIP to avoid exiling anyone', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Alice', role: 'VILLAGER' },
        { id: 'p2', name: 'Bob', role: 'VILLAGER' },
        { id: 'p3', name: 'Charlie', role: 'MAFIA' },
      ],
      phase: 'DAY_VOTING',
    });

    // Majority votes SKIP
    room.dayVotes = {
      p1: 'SKIP',
      p2: 'SKIP',
      p3: 'p1',
    };

    resolveDayVoting(room);

    assert.equal(room.lastVoteReport.exiledPlayer, null);
    assert.match(room.lastVoteReport.outcomeText, /skip exile/i);
    assert.equal(room.players.every((p) => p.alive), true);
  });

  it('should preserve Detective investigation history even if Detective dies the same night', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Vito', role: 'MAFIA' },
        { id: 'p2', name: 'Sherlock', role: 'DETECTIVE' },
        { id: 'p3', name: 'Watson', role: 'VILLAGER' },
        { id: 'p4', name: 'Lestrade', role: 'VILLAGER' },
      ],
    });

    const detective = room.players.find((p) => p.id === 'p2');
    const mafia = room.players.find((p) => p.id === 'p1');

    // Detective investigates Mafia
    performDetectiveInvestigation(room, detective, mafia);
    assert.equal(detective.investigations.length, 1);
    assert.equal(detective.investigations[0].result, 'MAFIA');

    // But Mafia kills the Detective that same night
    room.nightActions.mafiaVotes = { p1: 'p2' };
    resolveNightActions(room);

    assert.equal(detective.alive, false);
    assert.equal(room.lastDawnReport.victim?.id, 'p2');
    // Detective investigation log still exists on player object
    assert.equal(detective.investigations.length, 1);
  });

  it('should respect revealRoleOnDeath setting when exiling or killing', () => {
    // 1. With revealRoleOnDeath = true
    const roomWithReveal = createTestRoom({
      roster: [
        { id: 'p1', name: 'Vito', role: 'MAFIA' },
        { id: 'p2', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p3', name: 'Diana', role: 'VILLAGER' },
      ],
      settings: { revealRoleOnDeath: true },
    });
    roomWithReveal.nightActions.mafiaVotes = { p1: 'p2' };
    resolveNightActions(roomWithReveal);
    assert.equal(roomWithReveal.lastDawnReport.victim?.role, 'DOCTOR');

    // 2. With revealRoleOnDeath = false
    const roomWithoutReveal = createTestRoom({
      roster: [
        { id: 'p1', name: 'Vito', role: 'MAFIA' },
        { id: 'p2', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p3', name: 'Diana', role: 'VILLAGER' },
      ],
      settings: { revealRoleOnDeath: false },
    });
    roomWithoutReveal.nightActions.mafiaVotes = { p1: 'p2' };
    resolveNightActions(roomWithoutReveal);
    assert.equal(roomWithoutReveal.lastDawnReport.victim?.role, null);
  });

  it('should enforce strict fog-of-war in buildStateForPlayer without information leaks', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Vito', role: 'GODFATHER' },
        { id: 'p2', name: 'Sonny', role: 'MAFIA' },
        { id: 'p3', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p4', name: 'Sherlock', role: 'DETECTIVE' },
        { id: 'p5', name: 'Emma', role: 'VILLAGER' },
        { id: 'gm', name: 'Narrator', role: 'GAMEMASTER' },
      ],
      gameMasterId: 'gm',
    });

    room.nightActions.mafiaVotes = { p1: 'p5', p2: 'p5' };
    room.mafiaChat = [{ senderId: 'p1', senderName: 'Vito', text: 'Target Emma' }];
    room.nightActions.doctorTarget = 'p5';
    room.nightActions.doctorSubmitted = true;
    room.nightActions.detectiveTarget = 'p2';
    room.nightActions.detectiveSubmitted = true;

    // --- Case 1: Villager (Emma - p5) ---
    const villagerView = buildStateForPlayer(room, 'p5');
    // Villager cannot see anyone else's role!
    for (const player of villagerView.players) {
      if (player.id === 'p5') {
        assert.equal(player.role, 'VILLAGER');
      } else if (player.id === 'gm') {
        assert.equal(player.role, 'GAMEMASTER');
      } else {
        assert.equal(player.role, null, `Villager must not see role of ${player.name}`);
      }
    }
    // Villager cannot see Mafia votes or Mafia chat
    assert.equal(villagerView.me.allMafiaVotes, null);
    assert.deepEqual(villagerView.me.mafiaChat, []);
    assert.equal(villagerView.me.myDoctorTarget, null);
    assert.equal(villagerView.me.doctorSubmitted, false);

    // --- Case 2: Mafia (Sonny - p2) ---
    const mafiaView = buildStateForPlayer(room, 'p2');
    const vitoInMafiaView = mafiaView.players.find((p) => p.id === 'p1');
    const doctorInMafiaView = mafiaView.players.find((p) => p.id === 'p3');
    assert.equal(vitoInMafiaView.role, 'GODFATHER'); // Can see fellow Mafia!
    assert.equal(doctorInMafiaView.role, null); // Cannot see Doctor's identity!
    assert.equal(mafiaView.me.mafiaChat.length, 1);
    assert.equal(mafiaView.me.allMafiaVotes.p1, 'p5');

    // --- Case 3: Game Master (gm) ---
    const gmView = buildStateForPlayer(room, 'gm');
    // Game Master has God Mode: sees all secret roles and targets
    assert.equal(gmView.players.find((p) => p.id === 'p1').role, 'GODFATHER');
    assert.equal(gmView.players.find((p) => p.id === 'p3').role, 'DOCTOR');
    assert.equal(gmView.players.find((p) => p.id === 'p4').role, 'DETECTIVE');
    assert.equal(gmView.me.myDoctorTarget, 'p5');
    assert.equal(gmView.me.myDetectiveTarget, 'p2');
  });
});
