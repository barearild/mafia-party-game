/**
 * URL management and game routing helpers.
 *
 * Rules:
 * - URL without PIN (e.g. '/') always routes to Front Page (HOME).
 * - URL with PIN (e.g. '/ABCD' or '/ABCD/tv') routes directly to that game room.
 * - Supports backwards compatibility with query params (?room=ABCD, ?pin=ABCD, ?tv=ABCD).
 */

const ROOM_CODE_REGEX = /^[A-Z0-9]{4}$/;
const RESERVED_WORDS = new Set(['TRUE', 'FALSE', 'NULL', 'NONE']);

function isValidRoomCode(code) {
  if (!code) return false;
  const upper = code.toUpperCase().trim();
  return ROOM_CODE_REGEX.test(upper) && !RESERVED_WORDS.has(upper);
}

export function parseGameUrl(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) {
    return { roomCode: null, isTv: false, mode: 'HOME' };
  }

  try {
    const pathname = (loc.pathname || '/').trim();
    const searchParams = new URLSearchParams(loc.search || '');
    const hash = (loc.hash || '').replace(/^#\/?/, '').trim();

    // 1. Check Pass & Play mode
    if (pathname.toLowerCase() === '/pass-and-play' || searchParams.get('mode') === 'pass-and-play') {
      return { roomCode: null, isTv: false, mode: 'PASS_AND_PLAY' };
    }

    // 2. Check path segments (e.g. /ABCD, /K9X2, /ABCD/tv, /tv/ABCD)
    const segments = pathname
      .split('/')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    let roomCode = null;
    let isTv = false;

    if (segments.length >= 1) {
      if (segments[0] === 'TV' && segments[1] && isValidRoomCode(segments[1])) {
        roomCode = segments[1];
        isTv = true;
      } else if (isValidRoomCode(segments[0])) {
        roomCode = segments[0];
        if (segments[1] === 'TV') {
          isTv = true;
        }
      }
    }

    // 3. Fallback to query params (?pin=ABCD, ?room=ABCD, ?code=ABCD, ?tv=ABCD)
    if (!roomCode) {
      const qTv = (searchParams.get('tv') || '').toUpperCase().trim();
      if (isValidRoomCode(qTv)) {
        roomCode = qTv;
        isTv = true;
      } else {
        const qPin = (
          searchParams.get('pin') ||
          searchParams.get('room') ||
          searchParams.get('code') ||
          ''
        )
          .toUpperCase()
          .trim();
        if (isValidRoomCode(qPin)) {
          roomCode = qPin;
          if (searchParams.has('tv') && searchParams.get('tv') !== 'false') {
            isTv = true;
          }
        }
      }
    }

    // 4. Fallback to hash (e.g. #ABCD or #ABCD/tv)
    if (!roomCode && hash) {
      const hashSegments = hash
        .split('/')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (hashSegments[0] === 'TV' && hashSegments[1] && isValidRoomCode(hashSegments[1])) {
        roomCode = hashSegments[1];
        isTv = true;
      } else if (isValidRoomCode(hashSegments[0])) {
        roomCode = hashSegments[0];
        if (hashSegments[1] === 'TV') isTv = true;
      }
    }

    if (roomCode) {
      return { roomCode, isTv, mode: 'MULTI_DEVICE' };
    }

    return { roomCode: null, isTv: false, mode: 'HOME' };
  } catch {
    return { roomCode: null, isTv: false, mode: 'HOME' };
  }
}

export function formatGamePath({ roomCode = null, isTv = false, mode = 'HOME' } = {}) {
  if (mode === 'PASS_AND_PLAY') {
    return '/pass-and-play';
  }
  const cleanCode = (roomCode || '').toUpperCase().trim();
  if (isValidRoomCode(cleanCode)) {
    return isTv ? `/${cleanCode}/tv` : `/${cleanCode}`;
  }
  return '/';
}

export function setGameUrl({ roomCode = null, isTv = false, mode = 'HOME', replace = false } = {}) {
  if (typeof window === 'undefined' || !window.history) return;

  try {
    const targetPath = formatGamePath({ roomCode, isTv, mode });
    const currentPath = window.location.pathname + window.location.search;

    if (currentPath !== targetPath) {
      const stateObj = { roomCode, isTv, mode };
      if (replace) {
        window.history.replaceState(stateObj, '', targetPath);
      } else {
        window.history.pushState(stateObj, '', targetPath);
      }
    }
  } catch (err) {
    console.warn('Failed to update game URL:', err);
  }
}

export function getRoomJoinUrl(roomCode) {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://mafia-syndicate-game.netlify.app';
  const path = formatGamePath({ roomCode });
  return `${origin}${path}`;
}
