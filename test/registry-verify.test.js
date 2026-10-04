/**
 * Testes do verificador do MCP Registry (scripts/registry-verify.mjs).
 * Offline: fetch injetado com fixtures no formato real do registry.
 * Roda com: node --test test/registry-verify.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificar, verificar, META_KEY } from '../scripts/registry-verify.mjs';

const NAME = 'ai.zihin/mcp-server';

const entrada = (name, version, isLatest) => JSON.stringify({
  server: { name, version },
  _meta: { [META_KEY]: { status: 'active', isLatest } },
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

test('classificar: 404, 5xx e erro de rede', () => {
  assert.equal(classificar(NOT_FOUND, NAME, '2.2.2').estado, 'ausente');
  assert.equal(classificar({ status: 503, body: '' }, NAME, '2.2.2').estado, 'http');
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
