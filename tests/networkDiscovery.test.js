import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashNetworkSignature,
  getNetworkSignature,
} from '../src/network/networkDiscovery.js';

test('Network Discovery — hashNetworkSignature', async (t) => {
  await t.test('should deterministically hash IP addresses', () => {
    const hash1 = hashNetworkSignature('192.168.1.100');
    const hash2 = hashNetworkSignature('192.168.1.100');
    assert.equal(hash1, hash2);
    assert.ok(hash1.length > 0);
  });

  await t.test('should generate distinct hashes for different IPs', () => {
    const hashA = hashNetworkSignature('84.212.10.5');
    const hashB = hashNetworkSignature('92.160.40.12');
    assert.notEqual(hashA, hashB);
  });

  await t.test('should handle null, empty, or non-string gracefully', () => {
    assert.equal(hashNetworkSignature(null), 'local');
    assert.equal(hashNetworkSignature(''), 'local');
    assert.equal(hashNetworkSignature(undefined), 'local');
  });

  await t.test('should return fallback signature in node environment', async () => {
    const sig = await getNetworkSignature();
    assert.ok(typeof sig === 'string');
    assert.ok(sig.length > 0);
  });
});
