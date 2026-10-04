#!/usr/bin/env node
/**
 * Confere que o MCP Registry oficial tem EXATAMENTE o nome e a versao
 * esperados, e que essa versao e a `isLatest`.
 *
 * Uso: node scripts/registry-verify.mjs <nome> <versao>
 *      (ex.: node scripts/registry-verify.mjs ai.zihin/mcp-server 2.2.2)
 *
 * So leitura (GET publico, sem credencial). Chamado pelo passo 6 do
 * scripts/registry-publish.sh; roda sozinho para reconferir depois.
 *
 * Contrato conferido contra o registry em 04/10/2026:
 *   GET /v0.1/servers/{nome url-encoded}/versions/{versao|latest}
 *   200 -> { server: { name, version, ... },
 *            _meta: { "io.modelcontextprotocol.registry/official": { isLatest, status, ... } } }
 *   404 -> { title: "Not Found", ... }
 * O `isLatest` fica em `_meta`, IRMAO de `server` — nao dentro dele.
 *
 * Env (opcionais): REGISTRY_URL, REGISTRY_VERIFY_ATTEMPTS (default 6),
 * REGISTRY_VERIFY_INTERVAL_MS (default 5000).
 */

import { fileURLToPath } from 'node:url';

export const REGISTRY_URL = 'https://registry.modelcontextprotocol.io';
export const META_KEY = 'io.modelcontextprotocol.registry/official';

/** Faz o GET de uma versao; nunca lanca — devolve { status, body } ou { erro }. */
async function buscar(fetchImpl, base, name, versao) {
  const url = `${base}/v0.1/servers/${encodeURIComponent(name)}/versions/${encodeURIComponent(versao)}`;
  try {
    const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
    return { status: res.status, body: await res.text() };
  } catch (error) {
    return { erro: error.message };
  }
}

/**
 * Classifica a resposta do GET da versao exata. Funcao pura.
 * Estados: ok | ausente | nao_latest | divergente | json_invalido | http | rede
 */
export function classificar(resposta, name, version) {
  if (resposta.erro) return { estado: 'rede', detalhe: resposta.erro };
  if (resposta.status === 404) return { estado: 'ausente' };
  if (resposta.status !== 200) return { estado: 'http', detalhe: `HTTP ${resposta.status}` };

  let json;
  try {
    json = JSON.parse(resposta.body);
  } catch {
    return { estado: 'json_invalido', detalhe: 'corpo nao e JSON' };
  }
  const server = json?.server;
  if (!server || typeof server !== 'object') {
    return { estado: 'json_invalido', detalhe: 'resposta sem o objeto "server"' };
  }
  if (server.name !== name || server.version !== version) {
    return { estado: 'divergente', detalhe: `registry devolveu ${server.name}@${server.version}` };
  }
  const isLatest = json?._meta?.[META_KEY]?.isLatest;
  if (typeof isLatest !== 'boolean') {
    return { estado: 'json_invalido', detalhe: `resposta sem _meta["${META_KEY}"].isLatest` };
  }
  return isLatest ? { estado: 'ok' } : { estado: 'nao_latest' };
}

// Estados que a propagacao eventual do registry pode resolver sozinha.
const TRANSITORIOS = new Set(['ausente', 'nao_latest', 'http', 'rede']);

/** Le a versao que o registry considera latest (so para compor a mensagem de erro). */
async function versaoLatest(fetchImpl, base, name) {
  const r = await buscar(fetchImpl, base, name, 'latest');
  if (r.erro || r.status !== 200) return null;
  try {
    const s = JSON.parse(r.body)?.server;
    return s?.name === name && typeof s.version === 'string' ? s.version : null;
  } catch {
    return null;
  }
}

/**
 * Verifica com tentativas limitadas. Devolve { ok, estado, mensagem }.
 * `fetchImpl` e `sleep` sao injetaveis para teste offline.
 */
export async function verificar({
  name,
  version,
  base = REGISTRY_URL,
  tentativas = 6,
  intervaloMs = 5000,
  fetchImpl = fetch,
  sleep = ms => new Promise(r => setTimeout(r, ms)),
  log = () => {},
}) {
  let r;
  for (let i = 1; i <= tentativas; i++) {
    r = classificar(await buscar(fetchImpl, base, name, version), name, version);
    if (r.estado === 'ok') {
      return { ok: true, estado: 'ok', mensagem: `${name}@${version} publicado e isLatest=true` };
    }
    if (!TRANSITORIOS.has(r.estado)) break;
    if (i < tentativas) {
      log(`tentativa ${i}/${tentativas}: ${r.estado}${r.detalhe ? ` (${r.detalhe})` : ''} — aguardando ${intervaloMs} ms`);
      await sleep(intervaloMs);
    }
  }

  const esgotou = TRANSITORIOS.has(r.estado) ? ` apos ${tentativas} tentativa(s)` : '';
  let mensagem;
  switch (r.estado) {
    case 'ausente': {
      const latest = await versaoLatest(fetchImpl, base, name);
      if (latest) {
        r.estado = 'versao_anterior';
        mensagem = `${name}@${version} nao esta no registry${esgotou}; o latest de la ainda e ${latest}`;
      } else {
        mensagem = `${name} nao encontrado no registry${esgotou} (nem a versao ${version}, nem um latest)`;
      }
      break;
    }
    case 'nao_latest': {
      const latest = await versaoLatest(fetchImpl, base, name);
      mensagem = `${name}@${version} esta no registry, mas NAO e o latest${esgotou}` +
        (latest ? ` (latest de la: ${latest})` : '');
      break;
    }
    case 'divergente':
      mensagem = `resposta nao corresponde a ${name}@${version}: ${r.detalhe}`;
      break;
    case 'json_invalido':
      mensagem = `resposta do registry em formato inesperado: ${r.detalhe}`;
      break;
    default:
      mensagem = `falha ao consultar o registry${esgotou}: ${r.detalhe}`;
  }
  return { ok: false, estado: r.estado, mensagem };
}

function inteiroPositivo(valor, padrao) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : padrao;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, version] = process.argv.slice(2);
  if (!name || !version) {
    console.error('Uso: node scripts/registry-verify.mjs <nome> <versao>');
    process.exit(2);
  }
  const resultado = await verificar({
    name,
    version,
    base: process.env.REGISTRY_URL || REGISTRY_URL,
    tentativas: inteiroPositivo(process.env.REGISTRY_VERIFY_ATTEMPTS, 6),
    intervaloMs: inteiroPositivo(process.env.REGISTRY_VERIFY_INTERVAL_MS, 5000),
    log: msg => console.error(msg),
  });
  if (resultado.ok) {
    console.log(`OK: ${resultado.mensagem}`);
  } else {
    console.error(`ERRO (${resultado.estado}): ${resultado.mensagem}`);
    process.exit(1);
  }
}
