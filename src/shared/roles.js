export const ROLES = {
  GAMEMASTER: {
    id: 'GAMEMASTER',
    name: 'Game Master',
    team: 'MODERATOR',
    // Locked default illustration (used on front page & initial Dossier)
    image: '/cards/gamemaster.jpg',
    // Alternating illustrations used in-game (alternating men & women with diverse characters)
    images: [
      '/cards/gamemaster.jpg',
      '/cards/gamemaster_alt1.jpg',
    ],
    color: 'text-amber-300',
    bgColor: 'bg-stone-950/90',
    borderColor: 'border-amber-500/50',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    tagline: 'All-Seeing Narrator & Moderator',
    description:
      'You are the Game Master! You oversee all secret roles, night actions, and Town votes, and narrate the story for the group.',
    nightAction: 'Oversee night actions and guide the story.',
    investigativeResult: 'INNOCENT',
  },
  GODFATHER: {
    id: 'GODFATHER',
    name: 'Godfather',
    team: 'MAFIA',
    // Locked default illustration
    image: '/cards/godfather.jpg?v=3',
    // Alternating illustrations used in-game
    images: [
      '/cards/godfather.jpg?v=3',
      '/cards/godfather_alt1.jpg',
      '/cards/godfather_alt2.jpg',
    ],
    color: 'text-rose-400',
    bgColor: 'bg-rose-950/60',
    borderColor: 'border-rose-500/50',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    tagline: 'Head of the Crime Family',
    description:
      'You lead the Mafia. Vote with your fellow Mafia each night to eliminate a target. If investigated by the Detective, you appear INNOCENT (Town)!',
    nightAction: 'Choose a player to eliminate alongside the Mafia.',
    investigativeResult: 'INNOCENT',
  },
  MAFIA: {
    id: 'MAFIA',
    name: 'Mafia',
    team: 'MAFIA',
    // Locked default illustration
    image: '/cards/mafia.jpg',
    // Alternating illustrations used in-game
    images: [
      '/cards/mafia.jpg',
      '/cards/mafia_alt1.jpg',
      '/cards/mafia_alt2.jpg',
      '/cards/mafia_alt3.jpg',
      '/cards/mafia_alt4.jpg',
    ],
    color: 'text-red-400',
    bgColor: 'bg-red-950/60',
    borderColor: 'border-red-500/50',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
    tagline: 'Syndicate Enforcer',
    description:
      'Eliminate Town members each night and blend in during the day. You know who your fellow Mafia members are. If investigated by the Detective, you appear SUSPICIOUS (Mafia).',
    nightAction: 'Choose a player to eliminate in the shadows.',
    investigativeResult: 'MAFIA',
  },
  DOCTOR: {
    id: 'DOCTOR',
    name: 'Doctor',
    team: 'TOWN',
    // Locked default illustration
    image: '/cards/doctor.jpg',
    // Alternating illustrations used in-game
    images: [
      '/cards/doctor.jpg',
      '/cards/doctor_alt1.jpg',
    ],
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/60',
    borderColor: 'border-emerald-500/50',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    tagline: 'Town Physician',
    description:
      'Each night, choose one player to protect from a Mafia attack. Depending on game rules, you may also save yourself.',
    nightAction: 'Choose one player to protect tonight.',
    investigativeResult: 'INNOCENT',
  },
  DETECTIVE: {
    id: 'DETECTIVE',
    name: 'Detective',
    team: 'TOWN',
    // Locked default illustration
    image: '/cards/detective.jpg?v=2',
    // Alternating illustrations used in-game
    images: [
      '/cards/detective.jpg?v=2',
      '/cards/detective_alt1.jpg',
      '/cards/detective_alt2.jpg',
      '/cards/detective_alt3.jpg',
      '/cards/detective_alt4.jpg',
      '/cards/detective_alt5.jpg',
    ],
    color: 'text-sky-400',
    bgColor: 'bg-sky-950/60',
    borderColor: 'border-sky-500/50',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    tagline: 'Hardboiled Investigator',
    description:
      'Each night, investigate one player to learn if they belong to the Mafia or appear Innocent. Watch out: the Godfather always appears Innocent!',
    nightAction: 'Choose one player to investigate tonight.',
    investigativeResult: 'INNOCENT',
  },
  VILLAGER: {
    id: 'VILLAGER',
    name: 'Villager',
    team: 'TOWN',
    // Locked default illustration
    image: '/cards/villager.jpg',
    // Alternating illustrations used in-game
    images: [
      '/cards/villager.jpg',
      '/cards/villager_alt1.jpg',
      '/cards/villager_alt2.jpg',
      '/cards/villager_alt3.jpg',
      '/cards/villager_alt4.jpg',
      '/cards/villager_alt5.jpg',
    ],
    color: 'text-amber-300',
    bgColor: 'bg-amber-950/40',
    borderColor: 'border-amber-500/40',
    badgeColor: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    tagline: 'Honest Citizen',
    description:
      'You have no special night ability, but your voice and your vote during the Day are the Town’s strongest weapons. Find the liars and exile the Mafia!',
    nightAction: 'Rest peacefully and stay alert for tomorrow.',
    investigativeResult: 'INNOCENT',
  },
};

/**
 * Returns a specific variant illustration for a role, falling back to the locked default.
 */
export function getRoleImage(roleId, variantIndex = null) {
  const role = ROLES[roleId];
  if (!role) return '';
  if (variantIndex === null || variantIndex === undefined) {
    return role.image;
  }
  const pool = Array.isArray(role.images) && role.images.length > 0 ? role.images : [role.image];
  return pool[Math.abs(variantIndex) % pool.length] || role.image;
}

/**
 * Assigns alternating illustrations to a list of players in a game session so that
 * players with the same role (and across consecutive games via gameCountOffset)
 * alternate through the role's illustration variants.
 */
export function assignAlternatingRoleImages(players, gameCountOffset = 0) {
  const roleCounters = {};
  return players.map((p) => {
    const role = ROLES[p.role];
    if (!role) return p;
    const pool = Array.isArray(role.images) && role.images.length > 0 ? role.images : [role.image];
    const currentCount = roleCounters[p.role] ?? 0;
    roleCounters[p.role] = currentCount + 1;
    const variantIndex = (gameCountOffset + currentCount) % pool.length;
    return {
      ...p,
      roleVariantIndex: variantIndex,
      roleImage: pool[variantIndex] || role.image,
    };
  });
}

export function getRecommendedRoleConfig(playerCount) {
  const count = Math.max(4, playerCount);
  if (count === 4) {
    return { GODFATHER: 0, MAFIA: 1, DOCTOR: 1, DETECTIVE: 1, VILLAGER: 1 };
  }
  if (count === 5) {
    return { GODFATHER: 1, MAFIA: 0, DOCTOR: 1, DETECTIVE: 1, VILLAGER: 2 };
  }
  if (count === 6) {
    return { GODFATHER: 1, MAFIA: 1, DOCTOR: 1, DETECTIVE: 1, VILLAGER: 2 };
  }
  if (count === 7) {
    return { GODFATHER: 1, MAFIA: 1, DOCTOR: 1, DETECTIVE: 1, VILLAGER: 3 };
  }
  if (count === 8) {
    return { GODFATHER: 1, MAFIA: 1, DOCTOR: 1, DETECTIVE: 1, VILLAGER: 4 };
  }
  if (count <= 11) {
    const mafiaCount = 2;
    const villagers = count - (1 + mafiaCount + 1 + 1);
    return {
      GODFATHER: 1,
      MAFIA: mafiaCount,
      DOCTOR: 1,
      DETECTIVE: 1,
      VILLAGER: Math.max(1, villagers),
    };
  }
  const totalMafia = Math.floor(count / 3);
  const regularMafia = Math.max(1, totalMafia - 1);
  const villagers = count - (1 + regularMafia + 1 + 1);
  return {
    GODFATHER: 1,
    MAFIA: regularMafia,
    DOCTOR: 1,
    DETECTIVE: 1,
    VILLAGER: Math.max(1, villagers),
  };
}

export const BOT_NAMES = [
  'Don Vito',
  'Scarlett',
  'Inspector Vance',
  'Dr. Blackwood',
  'Frankie Two-Times',
  'Lady Evelyn',
  'Lucky Luciano',
  'Mayor Cross',
  'Sister Clara',
  'Vincent Vega',
];
