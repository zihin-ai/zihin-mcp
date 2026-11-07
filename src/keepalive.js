/**
 * Agendamento do keepalive do proxy — extraído do `startProxy` para ser testável com relógio falso.
 *
 * Regra (SEP-2549): o `ttlMs` que o server anuncia no `tools/list` é quanto a lista fica FRESCA; o proxy não
 * sonda antes disso. O intervalo é max(mínimo, ttlMs), teto de 15 min, com jitter SÓ POSITIVO (0 a +10%) —
 * jitter negativo anteciparia a sonda para antes do TTL. O 1º tick já usa o `ttlMs` do discovery.
 *
 * Invariantes:
 *  - com chamada em voo o tick não sonda (a sonda que falhasse reconectaria e abortaria o turno do usuário) e
 *    rearma com o MESMO intervalo, não com o mínimo;
 *  - `stop()` invalida a geração: um tick em voo que termina depois não rearma;
 *  - falha da sonda entrega ao `onFailure` (reconexão) e não rearma — quem reconecta chama `start()` de novo.
 *
 * @module @zihin/mcp-server/keepalive
 */

export const KEEPALIVE_INTERVAL_MS = 30_000;
export const KEEPALIVE_MAX_MS = 15 * 60_000;

/** Intervalo a partir do `ttlMs` anunciado (0/ausente = mínimo), com jitter positivo de até 10%. */
export function keepaliveDelayMs(ttlMs, random = Math.random) {
  const base = Math.min(KEEPALIVE_MAX_MS, Math.max(KEEPALIVE_INTERVAL_MS, Number.isFinite(ttlMs) ? ttlMs : 0));
  return Math.round(base + base * 0.1 * random());
}

/**
 * @param {object} deps
 * @param {() => Promise<{ ttlMs?: number }>} deps.probe   sonda (tools/list) — devolve o `ttlMs` da resposta
 * @param {() => boolean} deps.isBusy                       há chamada remota em voo?
 * @param {(error: unknown) => void} deps.onFailure         sonda falhou (o chamador reconecta)
 * @param {Function} [deps.setTimer] @param {Function} [deps.clearTimer] @param {() => number} [deps.random]
 */
export function createKeepalive({ probe, isBusy, onFailure, setTimer = setTimeout, clearTimer = clearTimeout, random = Math.random }) {
  let timer = null;
  let generation = 0;
  let ttlMs;

  function arm(gen) {
    timer = setTimer(async () => {
      timer = null;
      if (gen !== generation) return;
      if (isBusy()) { arm(gen); return; }
      try {
        const result = await probe();
        if (Number.isFinite(result?.ttlMs)) ttlMs = result.ttlMs;
      } catch (error) {
        if (gen === generation) onFailure(error);
        return;
      }
      if (gen === generation) arm(gen);
    }, keepaliveDelayMs(ttlMs, random));
  }

  function stop() {
    generation++;
    if (timer) { clearTimer(timer); timer = null; }
  }

  return {
    /** (Re)inicia a partir do `ttlMs` do discovery (ausente = mínimo). */
    start(initialTtlMs) {
      stop();
      ttlMs = Number.isFinite(initialTtlMs) ? initialTtlMs : undefined;
      arm(generation);
    },
    stop,
    /** Para teste/diagnóstico. */
    get armed() { return timer !== null; },
  };
}
