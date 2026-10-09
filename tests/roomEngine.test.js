import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveNightActions,
  resolveDayVoting,
  performDetectiveInvestigation,
  checkWinCondition,
  buildStateForPlayer,
} from '../src/shared/roomEngine.js';
import { createTestRoom, advanceToNextNight } from './fixtures.js';

describe('Room Engine — Multi-Round Happy Path & Core Mechanics', () => {
  it('should run a 2-round game resulting in Town Victory', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Alice', role: 'GODFATHER' },
        { id: 'p2', name: 'Bob', role: 'MAFIA' },
        { id: 'p3', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p4', name: 'Diana', role: 'DETECTIVE' },
        { id: 'p5', name: 'Ethan', role: 'VILLAGER' },
        { id: 'p6', name: 'Fiona', role: 'VILLAGER' },
      ],
    });

    // --- ROUND 1: NIGHT ---
    // Mafia chooses to kill Ethan (p5)
    room.nightActions.mafiaVotes = { p1: 'p5', p2: 'p5' };
    // Doctor protects Fiona (p6)
    room.nightActions.doctorTarget = 'p6';
    room.nightActions.doctorSubmitted = true;
    // Detective investigates Bob (p2)
    const detective = room.players.find((p) => p.id === 'p4');
    const bob = room.players.find((p) => p.id === 'p2');
    performDetectiveInvestigation(room, detective, bob);

    assert.equal(detective.investigations.length, 1);
    assert.equal(detective.investigations[0].result, 'MAFIA');

    // Resolve Night 1
    resolveNightActions(room);
    assert.equal(room.phase, 'DAWN');
    assert.equal(room.lastDawnReport.victim?.id, 'p5');
    assert.equal(room.players.find((p) => p.id === 'p5').alive, false);

    // --- ROUND 1: DAY ---
    room.phase = 'DAY_VOTING';
    // Detective leads the vote against Bob (p2), and Town exiles him
    room.dayVotes = {
      p1: 'p4',
      p2: 'p4',
      p3: 'p2',
      p4: 'p2',
      p6: 'p2',
    };
    resolveDayVoting(room);

    assert.equal(room.phase, 'VOTE_RESULTS');
    assert.equal(room.lastVoteReport.exiledPlayer?.id, 'p2');
    assert.equal(room.players.find((p) => p.id === 'p2').alive, false);
    assert.equal(checkWinCondition(room), false); // Godfather is still alive!

    // --- ROUND 2: NIGHT ---
    advanceToNextNight(room);
    // Godfather alone votes to kill Charlie (p3 - Doctor)
    room.nightActions.mafiaVotes = { p1: 'p3' };
    // Doctor protects himself!
    room.nightActions.doctorTarget = 'p3';
    room.nightActions.doctorSubmitted = true;
    // Detective investigates Alice (p1 - Godfather)
    const alice = room.players.find((p) => p.id === 'p1');
    performDetectiveInvestigation(room, detective, alice);

    // Godfather deceptively appears INNOCENT to detective
    assert.equal(detective.investigations[1].result, 'INNOCENT');

    resolveNightActions(room);
    assert.equal(room.phase, 'DAWN');
    assert.equal(room.lastDawnReport.savedByDoctor, true);
    assert.equal(room.lastDawnReport.victim, null);
    assert.equal(room.players.find((p) => p.id === 'p3').alive, true);

    // --- ROUND 2: DAY ---
    room.phase = 'DAY_VOTING';
    // Town figures out Alice is the remaining Godfather and exiles her
    room.dayVotes = {
      p1: 'p3',
      p3: 'p1',
      p4: 'p1',
      p6: 'p1',
    };
    resolveDayVoting(room);

    // Game should immediately end with Town Victory
    assert.equal(room.phase, 'GAME_OVER');
    assert.equal(room.winner, 'TOWN');
    assert.match(room.winReason, /Mafia Syndicate/i);
  });

  it('should run a multi-round game resulting in Mafia Victory when parity is reached', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Alice', role: 'GODFATHER' },
        { id: 'p2', name: 'Bob', role: 'MAFIA' },
        { id: 'p3', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p4', name: 'Diana', role: 'VILLAGER' },
      ],
    });

    // Night 1: 2 Mafia vs 2 Town. Mafia eliminates Charlie (Doctor)
    room.nightActions.mafiaVotes = { p1: 'p3', p2: 'p3' };
    room.nightActions.doctorTarget = 'p4';
    resolveNightActions(room);

    // Charlie dies -> 2 Mafia vs 1 Town. Parity reached!
    assert.equal(room.players.find((p) => p.id === 'p3').alive, false);
    assert.equal(room.phase, 'GAME_OVER');
    assert.equal(room.winner, 'MAFIA');
    assert.match(room.winReason, /equals or outnumbers the Town/i);
  });

  it('should correctly execute a Doctor save during the night', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Alice', role: 'MAFIA' },
        { id: 'p2', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p3', name: 'Diana', role: 'VILLAGER' },
        { id: 'p4', name: 'Ethan', role: 'VILLAGER' },
      ],
    });

    // Mafia targets Diana (p3), Doctor protects Diana (p3)
    room.nightActions.mafiaVotes = { p1: 'p3' };
    room.nightActions.doctorTarget = 'p3';
    room.nightActions.doctorSubmitted = true;

    resolveNightActions(room);

    assert.equal(room.phase, 'DAWN');
    assert.equal(room.lastDawnReport.savedByDoctor, true);
    assert.equal(room.lastDawnReport.victim, null);
    assert.equal(room.players.find((p) => p.id === 'p3').alive, true);
    assert.match(room.lastDawnReport.headline, /miraculous save/i);
  });

  it('should evaluate Detective investigation results for Mafia, Town, and Godfather deception', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Alice', role: 'GODFATHER' },
        { id: 'p2', name: 'Bob', role: 'MAFIA' },
        { id: 'p3', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p4', name: 'Diana', role: 'DETECTIVE' },
        { id: 'p5', name: 'Ethan', role: 'VILLAGER' },
      ],
    });

    const detective = room.players.find((p) => p.id === 'p4');
    const mafia = room.players.find((p) => p.id === 'p2');
    const doctor = room.players.find((p) => p.id === 'p3');
    const villager = room.players.find((p) => p.id === 'p5');
    const godfather = room.players.find((p) => p.id === 'p1');

    // Mafia gives SUSPICIOUS/MAFIA
    performDetectiveInvestigation(room, detective, mafia);
    assert.equal(detective.investigations[0].result, 'MAFIA');

    // Doctor gives INNOCENT
    performDetectiveInvestigation(room, detective, doctor);
    assert.equal(detective.investigations[1].result, 'INNOCENT');

    // Villager gives INNOCENT
    performDetectiveInvestigation(room, detective, villager);
    assert.equal(detective.investigations[2].result, 'INNOCENT');

    // Godfather deceives and gives INNOCENT
    performDetectiveInvestigation(room, detective, godfather);
    assert.equal(detective.investigations[3].result, 'INNOCENT');
  });

  it('should require all living mafia to explicitly confirm before marking mafiaDone', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Alice', role: 'GODFATHER' },
        { id: 'p2', name: 'Bob', role: 'MAFIA' },
        { id: 'p3', name: 'Charlie', role: 'DOCTOR' },
        { id: 'p4', name: 'Diana', role: 'DETECTIVE' },
      ],
    });

    // Both mafia vote, but neither confirmed yet
    room.nightActions.mafiaVotes = { p1: 'p3', p2: 'p3' };
    room.nightActions.mafiaConfirmed = {};
    let state = buildStateForPlayer(room, 'p1');
    assert.equal(state.nightProgress.mafiaDone, false);
    assert.equal(state.me.isMafiaConfirmed, false);

    // One mafia confirms
    room.nightActions.mafiaConfirmed['p1'] = true;
    state = buildStateForPlayer(room, 'p1');
    assert.equal(state.nightProgress.mafiaDone, false);
    assert.equal(state.me.isMafiaConfirmed, true);

    // Both mafia confirm
    room.nightActions.mafiaConfirmed['p2'] = true;
    state = buildStateForPlayer(room, 'p1');
    assert.equal(state.nightProgress.mafiaDone, true);
  });

  it('should allow detective to investigate without prematurely submitting when autoSubmit is false', () => {
    const room = createTestRoom({
      roster: [
        { id: 'p1', name: 'Alice', role: 'GODFATHER' },
        { id: 'p2', name: 'Diana', role: 'DETECTIVE' },
      ],
    });

    const detective = room.players.find((p) => p.id === 'p2');
    const godfather = room.players.find((p) => p.id === 'p1');

    performDetectiveInvestigation(room, detective, godfather, false);
    assert.equal(room.nightActions.detectiveSubmitted, false);
    assert.equal(detective.investigations.length, 1);
    assert.equal(detective.investigations[0].result, 'INNOCENT');

    const state = buildStateForPlayer(room, 'p2');
    assert.equal(state.me.detectiveSubmitted, false);
    assert.equal(state.nightProgress.detectiveDone, false);
    assert.equal(state.me.investigations.length, 1);
  });
});
