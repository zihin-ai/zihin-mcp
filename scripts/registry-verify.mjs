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
 * Env (opcionais): REGISTRY_URL, REGISTRY_VERIFY_ATTEMPTS (default 6, 1–60),
 * REGISTRY_VERIFY_INTERVAL_MS (default 5000, 1–60000).
 */

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REGISTRY_URL = 'https://registry.modelcontextprotocol.io';
export const META_KEY = 'io.modelcontextprotocol.registry/official';
// "Tentativas limitadas" so limita o tempo se cada request tambem tiver teto:
// sem isto, um registry que aceita a conexao e nao responde segura cada
// tentativa pelo timeout do undici (~300s).
const REQUEST_TIMEOUT_MS = 15_000;

/** Faz o GET de uma versao; nunca lanca — devolve { status, body } ou { erro }. */
async function buscar(fetchImpl, base, name, versao) {
  const url = `${base}/v0.1/servers/${encodeURIComponent(name)}/versions/${encodeURIComponent(versao)}`;
  try {
    const res = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { status: res.status, body: await res.text() };
  } catch (error) {
    return { erro: error.message };
  }
}

/**
 * Classifica a resposta do GET da versao exata. Funcao pura.
 * Estados: ok | ausente | nao_latest | inativa | divergente | json_invalido |
 *          http (5xx/408/429, transitorio) | http_definitivo (demais) | rede
 */
export function classificar(resposta, name, version) {
  if (resposta.erro) return { estado: 'rede', detalhe: resposta.erro };
  if (resposta.status === 404) return { estado: 'ausente', detalhe: detalhe404(resposta.body) };
  if (resposta.status !== 200) {
    const transitorio = resposta.status >= 500 || resposta.status === 408 || resposta.status === 429;
    return { estado: transitorio ? 'http' : 'http_definitivo', detalhe: `HTTP ${resposta.status}` };
  }

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
  const meta = json?._meta?.[META_KEY];
  if (typeof meta?.isLatest !== 'boolean') {
    return { estado: 'json_invalido', detalhe: `resposta sem _meta["${META_KEY}"].isLatest` };
  }
  // Versao deprecated/deleted com isLatest=true nao e publicacao valida.
  if (meta.status !== 'active') {
    return { estado: 'inativa', detalhe: `status "${meta.status}"` };
  }
  return meta.isLatest ? { estado: 'ok' } : { estado: 'nao_latest' };
}

/** O `detail` do 404 separa "Server not found" de rota errada ("Endpoint not found"). */
function detalhe404(body) {
  try {
    const d = JSON.parse(body)?.detail;
    return typeof d === 'string' ? d : undefined;
  } catch {
    return undefined;
  }
}

// Estados que a propagacao eventual do registry pode resolver sozinha.
const TRANSITORIOS = new Set(['ausente', 'nao_latest', 'http', 'rede']);

/**
 * Le a versao que o registry considera latest (so para compor a mensagem de
 * erro). Devolve { versao } | { ausente: true } | { falha } — falhar ao ler o
 * latest nao pode virar "servidor nao existe".
 */
async function versaoLatest(fetchImpl, base, name) {
  const r = await buscar(fetchImpl, base, name, 'latest');
  if (r.erro) return { falha: r.erro };
  if (r.status === 404) return { ausente: true };
  if (r.status !== 200) return { falha: `HTTP ${r.status}` };
  try {
    const s = JSON.parse(r.body)?.server;
    if (s?.name === name && typeof s.version === 'string') return { versao: s.version };
  } catch { /* cai na falha abaixo */ }
  return { falha: 'resposta em formato inesperado' };
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
  tentativas = Math.max(1, tentativas);
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
      const resposta404 = r.detalhe ? ` — registry respondeu "${r.detalhe}"` : '';
      if (latest.versao) {
        r.estado = 'versao_anterior';
        mensagem = `${name}@${version} nao esta no registry${esgotou}; o latest de la ainda e ${latest.versao}`;
      } else if (latest.ausente) {
        mensagem = `${name} nao encontrado no registry${esgotou} (nem a versao ${version}, nem um latest)${resposta404}`;
      } else {
        mensagem = `${name}@${version} nao esta no registry${esgotou}; nao foi possivel ler o latest (${latest.falha})`;
      }
      break;
    }
    case 'nao_latest': {
      const latest = await versaoLatest(fetchImpl, base, name);
      mensagem = `${name}@${version} esta no registry, mas NAO e o latest${esgotou}` +
        (latest.versao ? ` (latest de la: ${latest.versao})` : '');
      break;
    }
    case 'inativa':
      mensagem = `${name}@${version} esta no registry, mas com ${r.detalhe} (esperado "active")`;
      break;
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

/** Le um inteiro de env dentro de [1, max]; valor invalido avisa e cai no default. */
function inteiroDaEnv(nome, padrao, max) {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto === '') return padrao;
  const n = Number(bruto);
  if (Number.isInteger(n) && n >= 1 && n <= max) return n;
  console.error(`Aviso: ${nome}="${bruto}" invalido (inteiro de 1 a ${max}) — usando ${padrao}.`);
  return padrao;
}

// import.meta.url vem com symlinks resolvidos e argv[1] nao: comparar os dois
// crus faz o bloco abaixo nao rodar (exit 0, sem verificar nada) quando o
// checkout e alcancado por um symlink. realpath dos dois lados.
function executadoDireto() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (executadoDireto()) {
  const [name, version] = process.argv.slice(2);
  if (!name || !version) {
    console.error('Uso: node scripts/registry-verify.mjs <nome> <versao>');
    process.exit(2);
  }
  const resultado = await verificar({
    name,
    version,
    base: process.env.REGISTRY_URL || REGISTRY_URL,
    tentativas: inteiroDaEnv('REGISTRY_VERIFY_ATTEMPTS', 6, 60),
    intervaloMs: inteiroDaEnv('REGISTRY_VERIFY_INTERVAL_MS', 5000, 60_000),
    log: msg => console.error(msg),
  });
  if (resultado.ok) {
    console.log(`OK: ${resultado.mensagem}`);
  } else {
    console.error(`ERRO (${resultado.estado}): ${resultado.mensagem}`);
    process.exit(1);
  }
}
