import {
  ROLES,
  getRecommendedRoleConfig,
  BOT_NAMES,
  assignAlternatingRoleImages,
} from './roles.js';

export function createInitialRoom(code, hostPlayerId, hostName) {
  return {
    code,
    hostId: hostPlayerId,
    gameMasterId: null,
    phase: 'LOBBY',
    round: 0,
    players: [
      {
        id: hostPlayerId,
        name: (hostName || 'Host').trim(),
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
      gmMode: 'NONE',
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
}

export function getActiveParticipants(room) {
  const gmId = room.gameMasterId;
  return room.players.filter((p) => p.id !== gmId && p.role !== 'GAMEMASTER');
}

export function getExpectedCitizenCount(room) {
  const hasHumanGm = room.settings.gmMode && room.settings.gmMode !== 'NONE';
  return Math.max(0, room.players.length - (hasHumanGm ? 1 : 0));
}

export function syncRoleCountsIfAuto(room) {
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

export function checkWinCondition(room) {
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

export function buildStateForPlayer(room, playerId) {
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
  };
}

export function performDetectiveInvestigation(room, detectivePlayer, targetPlayer) {
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

export function resolveNightActions(room) {
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

export function resolveDayVoting(room) {
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

export function canControlGameFlow(room, playerId) {
  return playerId === room.hostId || playerId === room.gameMasterId;
}
