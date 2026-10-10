import peerPkg from 'peerjs';
const Peer = peerPkg?.Peer || peerPkg;

const DISCOVERY_PEER_PREFIX = 'mafia-lan-v1-';
const BROADCAST_CHANNEL_NAME = 'mafia_lan_discovery_v1';

let cachedNetworkSignature = null;
let networkSignaturePromise = null;

/**
 * Computes a fast alphanumeric hash of a network IP / signature string.
 */
export function hashNetworkSignature(raw) {
  if (!raw || typeof raw !== 'string') return 'local';
  let hash = 5381;
  const clean = raw.trim();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) + hash + clean.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 10);
}

/**
 * Discovers the device's public IP using WebRTC STUN candidate reflection,
 * with fallback to a lightweight public IP endpoint.
 */
export async function getNetworkSignature() {
  if (cachedNetworkSignature) return cachedNetworkSignature;
  if (networkSignaturePromise) return networkSignaturePromise;

  networkSignaturePromise = (async () => {
    // 1. Try WebRTC STUN Server-Reflexive candidate (instant, zero external HTTP call)
    if (typeof RTCPeerConnection !== 'undefined') {
      try {
        const stunIp = await new Promise((resolve) => {
          let done = false;
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          });
          pc.createDataChannel('');
          pc.onicecandidate = (event) => {
            if (done) return;
            if (event?.candidate?.candidate) {
              const str = event.candidate.candidate;
              const parts = str.split(' ');
              const typIdx = parts.indexOf('typ');
              if (typIdx !== -1 && parts[typIdx + 1] === 'srflx') {
                const candidateIp = parts[4];
                if (candidateIp && candidateIp.includes('.') && !candidateIp.endsWith('.local')) {
                  done = true;
                  try { pc.close(); } catch {}
                  resolve(candidateIp);
                }
              }
            }
          };
          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .catch(() => {});
          setTimeout(() => {
            if (!done) {
              try { pc.close(); } catch {}
              resolve(null);
            }
          }, 1800);
        });

        if (stunIp) {
          cachedNetworkSignature = hashNetworkSignature(stunIp);
          return cachedNetworkSignature;
        }
      } catch (err) {
        // Fall through to HTTP fallback
      }
    }

    // 2. Fallback to lightweight public IP lookup
    if (typeof fetch !== 'undefined') {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('https://api.ipify.org?format=json', {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          if (data?.ip) {
            cachedNetworkSignature = hashNetworkSignature(data.ip);
            return cachedNetworkSignature;
          }
        }
      } catch (err) {
        // Fall through to local fallback
      }
    }

    // Default fallback if offline or blocked
    cachedNetworkSignature = 'lan_default';
    return cachedNetworkSignature;
  })();

  return networkSignaturePromise;
}

/**
 * Starts a LAN Host Beacon that advertises the active room to nearby devices
 * sharing the same network signature (or same browser).
 */
export function startLanHostBeacon({ roomCode, getRoomInfo }) {
  let isStopped = false;
  let broadcastChannel = null;
  let beaconPeer = null;

  const currentInfo = () => {
    const raw = typeof getRoomInfo === 'function' ? getRoomInfo() : {};
    return {
      code: roomCode,
      hostName: raw.hostName || 'Host',
      playerCount: raw.playerCount || 1,
      phase: raw.phase || 'LOBBY',
      isTv: Boolean(raw.isTv),
      timestamp: Date.now(),
    };
  };

  // 1. Setup local BroadcastChannel for same-device / multi-tab discovery
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      broadcastChannel.onmessage = (evt) => {
        if (isStopped) return;
        if (evt?.data?.type === 'scan_query') {
          broadcastChannel.postMessage({
            type: 'beacon_announcement',
            room: currentInfo(),
          });
        }
      };
      // Send initial announcement
      broadcastChannel.postMessage({
        type: 'beacon_announcement',
        room: currentInfo(),
      });
    } catch {}
  }

  // 2. Setup PeerJS beacon for cross-device LAN discovery via network signature
  getNetworkSignature().then((signature) => {
    if (isStopped) return;
    const beaconPeerId = `${DISCOVERY_PEER_PREFIX}${signature}`;

    try {
      beaconPeer = new Peer(beaconPeerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      beaconPeer.on('connection', (conn) => {
        if (isStopped) return;
        conn.on('open', () => {
          conn.send({
            type: 'beacon_announcement',
            room: currentInfo(),
          });
          // Close after sending announcement to keep channel clean
          setTimeout(() => {
            try { conn.close(); } catch {}
          }, 1500);
        });
      });

      beaconPeer.on('error', (err) => {
        // If ID is in use (e.g., multiple hosts or quick restart), don't crash
        if (err?.type === 'unavailable-id') {
          // Primary beacon slot occupied
        }
      });
    } catch (e) {
      // Non-fatal
    }
  });

  return {
    update() {
      if (isStopped) return;
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({
            type: 'beacon_announcement',
            room: currentInfo(),
          });
        } catch {}
      }
    },
    stop() {
      isStopped = true;
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({
            type: 'beacon_closed',
            code: roomCode,
          });
          broadcastChannel.close();
        } catch {}
        broadcastChannel = null;
      }
      if (beaconPeer && !beaconPeer.destroyed) {
        try {
          beaconPeer.destroy();
        } catch {}
        beaconPeer = null;
      }
    },
  };
}

/**
 * Scans for active game rooms on the same network or local machine.
 * Calls onFound(roomInfo) when an active game is discovered.
 */
export function scanForLocalRooms({ onFound, onStatus, timeoutMs = 5000 }) {
  let isStopped = false;
  let broadcastChannel = null;
  let scanPeer = null;
  let timeoutTimer = null;
  const discoveredCodes = new Set();

  const handleRoomDiscovered = (room, source = 'network') => {
    if (isStopped || !room?.code) return;
    if (discoveredCodes.has(room.code)) return;
    discoveredCodes.add(room.code);
    if (typeof onFound === 'function') {
      onFound({ ...room, source });
    }
  };

  if (typeof onStatus === 'function') {
    onStatus('Scanning local network for games...');
  }

  // 1. Check local BroadcastChannel first (fastest)
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      broadcastChannel.onmessage = (evt) => {
        if (isStopped) return;
        if (evt?.data?.type === 'beacon_announcement' && evt.data.room) {
          handleRoomDiscovered(evt.data.room, 'local');
        }
      };
      // Send query
      broadcastChannel.postMessage({ type: 'scan_query' });
    } catch {}
  }

  // 2. Check PeerJS cross-device beacon using network signature
  getNetworkSignature().then((signature) => {
    if (isStopped) return;
    const targetBeaconId = `${DISCOVERY_PEER_PREFIX}${signature}`;
    const scanPeerId = `mafia-scan-${Math.random().toString(36).slice(2, 9)}`;

    try {
      scanPeer = new Peer(scanPeerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      scanPeer.on('open', () => {
        if (isStopped) return;
        const conn = scanPeer.connect(targetBeaconId, { reliable: true });

        conn.on('data', (data) => {
          if (isStopped) return;
          if (data?.type === 'beacon_announcement' && data.room) {
            handleRoomDiscovered(data.room, 'wifi');
          }
        });

        conn.on('error', () => {
          // No host online on this network slot
        });
      });

      scanPeer.on('error', () => {
        // Ignore scan peer errors
      });
    } catch {}
  });

  timeoutTimer = setTimeout(() => {
    if (isStopped) return;
    if (typeof onStatus === 'function') {
      onStatus(discoveredCodes.size > 0 ? 'Scan complete' : 'No nearby games detected');
    }
  }, timeoutMs);

  return {
    stop() {
      isStopped = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (broadcastChannel) {
        try { broadcastChannel.close(); } catch {}
        broadcastChannel = null;
      }
      if (scanPeer && !scanPeer.destroyed) {
        try { scanPeer.destroy(); } catch {}
        scanPeer = null;
      }
    },
  };
}
