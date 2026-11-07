/**
 * Keepalive do proxy (src/keepalive.js) com relógio falso — revisão do Astra (07/11): o 1º tick ignorava o
 * `ttlMs` do discovery e o jitter negativo antecipava a sonda para antes do TTL.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createKeepalive, keepaliveDelayMs, KEEPALIVE_INTERVAL_MS, KEEPALIVE_MAX_MS } from '../src/keepalive.js';

function fakeClock() {
  const timers = [];
  return {
    timers,
    setTimer: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; },
    clearTimer: (t) => { t.cleared = true; },
    /** Dispara o último timer armado e espera o tick terminar. */
    async fire() { const t = timers.filter((x) => !x.cleared).at(-1); t.cleared = true; await t.fn(); },
    pending() { return timers.filter((x) => !x.cleared); },
  };
}
const flush = () => new Promise((r) => setImmediate(r));

describe('keepaliveDelayMs', () => {
  it('nunca antes do TTL: jitter só positivo, até +10%', () => {
    assert.equal(keepaliveDelayMs(300_000, () => 0), 300_000);
    assert.equal(keepaliveDelayMs(300_000, () => 0.999999), 330_000);
    assert.equal(keepaliveDelayMs(undefined, () => 0), KEEPALIVE_INTERVAL_MS);
    assert.equal(keepaliveDelayMs(1_000, () => 0), KEEPALIVE_INTERVAL_MS);
    assert.equal(keepaliveDelayMs(10 * 3_600_000, () => 0), KEEPALIVE_MAX_MS);
  });
});

describe('createKeepalive', () => {
  it('1º tick já usa o ttlMs do discovery; os seguintes, o ttlMs da última sonda', async () => {
    const c = fakeClock();
    const probes = [];
    const k = createKeepalive({ ...c, random: () => 0, isBusy: () => false, onFailure: () => assert.fail('não falha'), probe: async () => { probes.push(1); return { ttlMs: 120_000 }; } });
    k.start(300_000);
    assert.equal(c.pending()[0].ms, 300_000);
    await c.fire();
    assert.equal(probes.length, 1);
    assert.equal(c.pending()[0].ms, 120_000);
  });

  it('sem ttlMs no discovery → mínimo de 30 s', () => {
    const c = fakeClock();
    createKeepalive({ ...c, random: () => 0, isBusy: () => false, onFailure() {}, probe: async () => ({}) }).start(undefined);
    assert.equal(c.pending()[0].ms, KEEPALIVE_INTERVAL_MS);
  });

  it('chamada em voo: não sonda e rearma com o MESMO intervalo (não cai para 30 s)', async () => {
    const c = fakeClock();
    let busy = true; let probes = 0;
    const k = createKeepalive({ ...c, random: () => 0, isBusy: () => busy, onFailure() {}, probe: async () => { probes++; return { ttlMs: 300_000 }; } });
    k.start(300_000);
    await c.fire();
    assert.equal(probes, 0);
    assert.equal(c.pending()[0].ms, 300_000);
    busy = false;
    await c.fire();
    assert.equal(probes, 1);
  });

  it('stop() com sonda em voo: o tick que termina depois não rearma', async () => {
    const c = fakeClock();
    let release;
    const k = createKeepalive({ ...c, random: () => 0, isBusy: () => false, onFailure() {}, probe: () => new Promise((r) => { release = r; }) });
    k.start(60_000);
    const p = c.fire();
    await flush();
    k.stop();
    release({ ttlMs: 60_000 });
    await p;
    assert.equal(c.pending().length, 0);
  });

  it('falha da sonda → onFailure uma vez e não rearma; start() na reconexão rearma com o TTL novo', async () => {
    const c = fakeClock();
    const failures = [];
    const k = createKeepalive({ ...c, random: () => 0, isBusy: () => false, onFailure: (e) => failures.push(e.message), probe: async () => { throw new Error('502'); } });
    k.start(300_000);
    await c.fire();
    assert.deepEqual(failures, ['502']);
    assert.equal(c.pending().length, 0);
    k.start(600_000); // reconexão: discovery novo
    assert.equal(c.pending().length, 1);
    assert.equal(c.pending()[0].ms, 600_000);
  });

  it('start() duas vezes não deixa dois timers', () => {
    const c = fakeClock();
    const k = createKeepalive({ ...c, random: () => 0, isBusy: () => false, onFailure() {}, probe: async () => ({}) });
    k.start(300_000); k.start(300_000);
    assert.equal(c.pending().length, 1);
  });
});
