import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGameUrl, formatGamePath } from '../src/shared/urlUtils.js';

test('URL Routing — Front page without PIN always routes to HOME', () => {
  const root = parseGameUrl({ pathname: '/', search: '', hash: '' });
  assert.equal(root.mode, 'HOME');
  assert.equal(root.roomCode, null);
  assert.equal(root.isTv, false);

  const empty = parseGameUrl({ pathname: '', search: '', hash: '' });
  assert.equal(empty.mode, 'HOME');
  assert.equal(empty.roomCode, null);

  const subpath = parseGameUrl({ pathname: '/cards/mafia.jpg', search: '', hash: '' });
  assert.equal(subpath.mode, 'HOME');
  assert.equal(subpath.roomCode, null);
});

test('URL Routing — Path with 4-character alphanumeric PIN routes to room', () => {
  const room = parseGameUrl({ pathname: '/ABCD', search: '', hash: '' });
  assert.equal(room.mode, 'MULTI_DEVICE');
  assert.equal(room.roomCode, 'ABCD');
  assert.equal(room.isTv, false);

  const roomLower = parseGameUrl({ pathname: '/wxyz', search: '', hash: '' });
  assert.equal(roomLower.mode, 'MULTI_DEVICE');
  assert.equal(roomLower.roomCode, 'WXYZ');
  assert.equal(roomLower.isTv, false);

  // Alphanumeric with numbers (e.g. K9X2, 7B4Q)
  const roomNum = parseGameUrl({ pathname: '/K9X2', search: '', hash: '' });
  assert.equal(roomNum.mode, 'MULTI_DEVICE');
  assert.equal(roomNum.roomCode, 'K9X2');
  assert.equal(roomNum.isTv, false);

  const roomNumTv = parseGameUrl({ pathname: '/7B4Q/tv', search: '', hash: '' });
  assert.equal(roomNumTv.mode, 'MULTI_DEVICE');
  assert.equal(roomNumTv.roomCode, '7B4Q');
  assert.equal(roomNumTv.isTv, true);
});

test('URL Routing — Path with PIN and /tv routes to TV mode', () => {
  const tvPath = parseGameUrl({ pathname: '/ABCD/tv', search: '', hash: '' });
  assert.equal(tvPath.mode, 'MULTI_DEVICE');
  assert.equal(tvPath.roomCode, 'ABCD');
  assert.equal(tvPath.isTv, true);

  const tvPrefix = parseGameUrl({ pathname: '/tv/ABCD', search: '', hash: '' });
  assert.equal(tvPrefix.mode, 'MULTI_DEVICE');
  assert.equal(tvPrefix.roomCode, 'ABCD');
  assert.equal(tvPrefix.isTv, true);
});

test('URL Routing — Query parameters backwards compatibility', () => {
  const queryPin = parseGameUrl({ pathname: '/', search: '?pin=KLMN', hash: '' });
  assert.equal(queryPin.mode, 'MULTI_DEVICE');
  assert.equal(queryPin.roomCode, 'KLMN');
  assert.equal(queryPin.isTv, false);

  const queryRoom = parseGameUrl({ pathname: '/', search: '?room=PQRS', hash: '' });
  assert.equal(queryRoom.mode, 'MULTI_DEVICE');
  assert.equal(queryRoom.roomCode, 'PQRS');
  assert.equal(queryRoom.isTv, false);

  const queryTv = parseGameUrl({ pathname: '/', search: '?tv=ABCD', hash: '' });
  assert.equal(queryTv.mode, 'MULTI_DEVICE');
  assert.equal(queryTv.roomCode, 'ABCD');
  assert.equal(queryTv.isTv, true);

  const queryPinTv = parseGameUrl({ pathname: '/', search: '?pin=ABCD&tv=true', hash: '' });
  assert.equal(queryPinTv.mode, 'MULTI_DEVICE');
  assert.equal(queryPinTv.roomCode, 'ABCD');
  assert.equal(queryPinTv.isTv, true);
});

test('URL Routing — Formatting game paths', () => {
  assert.equal(formatGamePath({ mode: 'HOME' }), '/');
  assert.equal(formatGamePath({ roomCode: 'ABCD', isTv: false }), '/ABCD');
  assert.equal(formatGamePath({ roomCode: 'ABCD', isTv: true }), '/ABCD/tv');
  assert.equal(formatGamePath({ mode: 'PASS_AND_PLAY' }), '/pass-and-play');
});
