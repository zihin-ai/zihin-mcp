/**
 * Testes do verificador do MCP Registry (scripts/registry-verify.mjs).
 * Offline: fetch injetado com fixtures no formato real do registry.
 * Roda com: node --test test/registry-verify.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { classificar, verificar, META_KEY } from '../scripts/registry-verify.mjs';

const NAME = 'ai.zihin/mcp-server';

const entrada = (name, version, isLatest, status = 'active') => JSON.stringify({
  server: { name, version },
  _meta: { [META_KEY]: { status, isLatest } },
});
const ok200 = body => ({ status: 200, body });
const NOT_FOUND = { status: 404, body: '{"title":"Not Found","status":404,"detail":"Server not found"}' };

/** fetch falso: mapa "versao pedida" -> resposta (ou funcao que a devolve). */
function fetchFalso(rotas) {
  const chamadas = [];
  const impl = async url => {
    chamadas.push(url);
    const versao = decodeURIComponent(url.split('/versions/')[1]);
    const r = typeof rotas[versao] === 'function' ? rotas[versao]() : rotas[versao] ?? NOT_FOUND;
    if (r.lancar) throw new Error(r.lancar);
    return { status: r.status, text: async () => r.body };
  };
  impl.chamadas = chamadas;
  return impl;
}

const opcoes = (fetchImpl, extra = {}) => ({
  name: NAME, version: '2.2.2', tentativas: 3, intervaloMs: 1, sleep: async () => {}, fetchImpl, ...extra,
});

test('classificar: versao exata e isLatest=true e ok', () => {
  assert.equal(classificar(ok200(entrada(NAME, '2.2.2', true)), NAME, '2.2.2').estado, 'ok');
});

test('classificar: isLatest fica em _meta, nao dentro de server', () => {
  const body = JSON.stringify({ server: { name: NAME, version: '2.2.2', isLatest: true } });
  assert.equal(classificar(ok200(body), NAME, '2.2.2').estado, 'json_invalido');
});

test('classificar: outro nome ou outra versao no corpo e divergente', () => {
  assert.equal(classificar(ok200(entrada('ai.outro/mcp-server', '2.2.2', true)), NAME, '2.2.2').estado, 'divergente');
  assert.equal(classificar(ok200(entrada(NAME, '2.2.1', true)), NAME, '2.2.2').estado, 'divergente');
});

test('classificar: corpo que nao e JSON, ou sem server, e json_invalido', () => {
  assert.equal(classificar(ok200('<html>gateway</html>'), NAME, '2.2.2').estado, 'json_invalido');
  assert.equal(classificar(ok200('{"servers":[]}'), NAME, '2.2.2').estado, 'json_invalido');
});

test('classificar: versao com status diferente de active nao e ok, mesmo com isLatest=true', () => {
  assert.equal(classificar(ok200(entrada(NAME, '2.2.2', true, 'deprecated')), NAME, '2.2.2').estado, 'inativa');
});

test('classificar: 404, 5xx e erro de rede', () => {
  assert.equal(classificar(NOT_FOUND, NAME, '2.2.2').estado, 'ausente');
  assert.equal(classificar({ status: 503, body: '' }, NAME, '2.2.2').estado, 'http');
  assert.equal(classificar({ status: 429, body: '' }, NAME, '2.2.2').estado, 'http');
  assert.equal(classificar({ status: 403, body: '' }, NAME, '2.2.2').estado, 'http_definitivo');
  assert.equal(classificar({ erro: 'ECONNRESET' }, NAME, '2.2.2').estado, 'rede');
});

test('verificar: sucesso na primeira tentativa consulta nome e versao exatos', async () => {
  const f = fetchFalso({ '2.2.2': ok200(entrada(NAME, '2.2.2', true)) });
  const r = await verificar(opcoes(f));
  assert.equal(r.ok, true);
  assert.equal(f.chamadas.length, 1);
  assert.ok(f.chamadas[0].endsWith('/v0.1/servers/ai.zihin%2Fmcp-server/versions/2.2.2'));
});

test('verificar: so a versao anterior no registry falha (regressao: saia com exit 0)', async () => {
  const f = fetchFalso({ latest: ok200(entrada(NAME, '2.2.1', true)) });
  const r = await verificar(opcoes(f));
  assert.equal(r.ok, false);
  assert.equal(r.estado, 'versao_anterior');
  assert.match(r.mensagem, /2\.2\.1/);
  assert.match(r.mensagem, /apos 3 tentativa/);
  assert.equal(f.chamadas.length, 4, '3 tentativas da versao exata + 1 leitura do latest');
});

test('verificar: servidor ausente (nem versao, nem latest)', async () => {
  const r = await verificar(opcoes(fetchFalso({})));
  assert.equal(r.ok, false);
  assert.equal(r.estado, 'ausente');
  assert.match(r.mensagem, /nem a versao 2\.2\.2, nem um latest/);
  assert.match(r.mensagem, /Server not found/);
});

test('verificar: falha ao ler o latest nao vira "servidor nao encontrado"', async () => {
  const f = fetchFalso({ latest: { lancar: 'ETIMEDOUT' } });
  const r = await verificar(opcoes(f));
  assert.equal(r.ok, false);
  assert.equal(r.estado, 'ausente');
  assert.match(r.mensagem, /nao foi possivel ler o latest \(ETIMEDOUT\)/);
  assert.doesNotMatch(r.mensagem, /nao encontrado/);
});

test('verificar: 5xx transitorio e depois ok', async () => {
  let n = 0;
  const f = fetchFalso({ '2.2.2': () => (++n < 2 ? { status: 503, body: '' } : ok200(entrada(NAME, '2.2.2', true))) });
  const r = await verificar(opcoes(f));
  assert.equal(r.ok, true);
  assert.equal(f.chamadas.length, 2);
});

test('verificar: 4xx que nao e 404 falha na hora, sem repetir', async () => {
  const f = fetchFalso({ '2.2.2': { status: 403, body: '' } });
  const r = await verificar(opcoes(f));
  assert.equal(r.ok, false);
  assert.equal(f.chamadas.length, 1);
  assert.match(r.mensagem, /HTTP 403/);
});

test('verificar: tentativas menor que 1 ainda faz uma consulta', async () => {
  const f = fetchFalso({ '2.2.2': ok200(entrada(NAME, '2.2.2', true)) });
  const r = await verificar(opcoes(f, { tentativas: 0 }));
  assert.equal(r.ok, true);
  assert.equal(f.chamadas.length, 1);
});

test('verificar: outro nome de servidor falha sem repetir (regressao: saia com exit 0)', async () => {
  const f = fetchFalso({ '2.2.2': ok200(entrada('ai.outro/mcp-server', '2.2.2', true)) });
  const r = await verificar(opcoes(f));
  assert.equal(r.ok, false);
  assert.equal(r.estado, 'divergente');
  assert.equal(f.chamadas.length, 1);
});

test('verificar: versao esperada publicada mas nao latest', async () => {
  const f = fetchFalso({
    '2.2.2': ok200(entrada(NAME, '2.2.2', false)),
    latest: ok200(entrada(NAME, '2.3.0', true)),
  });
  const r = await verificar(opcoes(f));
  assert.equal(r.ok, false);
  assert.equal(r.estado, 'nao_latest');
  assert.match(r.mensagem, /2\.3\.0/);
});

test('verificar: JSON invalido falha na hora, sem repetir', async () => {
  const f = fetchFalso({ '2.2.2': ok200('nao e json') });
  const r = await verificar(opcoes(f));
  assert.equal(r.ok, false);
  assert.equal(r.estado, 'json_invalido');
  assert.equal(f.chamadas.length, 1);
});

test('verificar: propagacao eventual — 404 e depois ok dentro do limite', async () => {
  let n = 0;
  const f = fetchFalso({ '2.2.2': () => (++n < 3 ? NOT_FOUND : ok200(entrada(NAME, '2.2.2', true))) });
  const esperas = [];
  const r = await verificar(opcoes(f, { sleep: async ms => { esperas.push(ms); } }));
  assert.equal(r.ok, true);
  assert.equal(f.chamadas.length, 3);
  assert.equal(esperas.length, 2);
});

test('verificar: erro de rede persistente esgota as tentativas com mensagem clara', async () => {
  const f = fetchFalso({ '2.2.2': { lancar: 'ECONNREFUSED' } });
  const r = await verificar(opcoes(f));
  assert.equal(r.ok, false);
  assert.equal(r.estado, 'rede');
  assert.match(r.mensagem, /ECONNREFUSED/);
  assert.equal(f.chamadas.length, 3);
});

// --- CLI: codigos de saida. Sem rede externa: REGISTRY_URL aponta para uma
// porta fechada em loopback.
const SCRIPT = fileURLToPath(new URL('../scripts/registry-verify.mjs', import.meta.url));
const ENV_OFFLINE = {
  ...process.env,
  REGISTRY_URL: 'http://127.0.0.1:1',
  REGISTRY_VERIFY_ATTEMPTS: '1',
  REGISTRY_VERIFY_INTERVAL_MS: '1',
};
const cli = (script, args, env = ENV_OFFLINE) =>
  spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8' });

test('CLI: sem argumentos sai com 2 e mostra o uso', () => {
  const r = cli(SCRIPT, []);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Uso:/);
});

test('CLI: falha de verificacao sai com 1', () => {
  const r = cli(SCRIPT, [NAME, '2.2.2']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ERRO \(rede\)/);
});

test('CLI: invocada por caminho com symlink ainda verifica (regressao: saia com 0 sem rodar)', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'registry-verify-'));
  try {
    const link = path.join(tmp, 'scripts-link');
    symlinkSync(path.dirname(SCRIPT), link, 'dir');
    const r = cli(path.join(link, 'registry-verify.mjs'), [NAME, '2.2.2']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /ERRO \(rede\)/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('CLI: env invalida avisa e usa o default', () => {
  const r = cli(SCRIPT, [NAME, '2.2.2'], { ...ENV_OFFLINE, REGISTRY_VERIFY_INTERVAL_MS: 'abc' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /REGISTRY_VERIFY_INTERVAL_MS="abc" invalido/);
});
