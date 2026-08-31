#!/usr/bin/env node
/**
 * Sincroniza as skills empacotadas (plugin/skills/) com a fonte única.
 *
 * Fontes (em ordem de preferência):
 *   --from-server  busca do MCP Server vivo (requer ZIHIN_API_KEY) — usa em release
 *   --from-dir <p> copia de um checkout local do zihin-agent-builder
 *                  (default: ../zihin-agent-builder/server-llm/mcp-server/skills)
 *
 * Rodar antes de publicar no npm: npm run sync-skills
 */

import { cpSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mesmo choke point do install-skills: o name vira componente de caminho aqui
// (path.join(DEST, name)), e o corpo vem inteiro do server. Sem ele, um server
// comprometido publicando `name: ../../..` grava arquivo de conteudo
// controlado em diretorio arbitrario da maquina de quem roda o release.
import { parseSkill } from '../src/install-skills.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'plugin', 'skills');
const DEFAULT_SRC = path.join(ROOT, '..', 'zihin-agent-builder', 'server-llm', 'mcp-server', 'skills');

const args = process.argv.slice(2);
const fromServer = args.includes('--from-server');
const dirIdx = args.indexOf('--from-dir');
const srcDir = dirIdx !== -1 ? path.resolve(args[dirIdx + 1]) : DEFAULT_SRC;

if (fromServer) {
  // SDK v2 (pacote dividido) — o monolitico @modelcontextprotocol/sdk saiu das
  // dependencias na v2.0.0 e este import quebrava com MODULE_NOT_FOUND.
  const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client');

  const apiKey = process.env.ZIHIN_API_KEY;
  if (!apiKey) {
    console.error('ERRO: ZIHIN_API_KEY necessária para --from-server');
    process.exit(1);
  }
  const mcpUrl = process.env.ZIHIN_MCP_URL || 'https://llm.zihin.ai/mcp';

  const client = new Client({ name: 'zihin-sync-skills', version: '1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { 'X-Api-Key': apiKey } },
  }));

  const { resources } = await client.listResources();
  const skillResources = resources.filter(r => r.uri.startsWith('zihin://skills/'));
  if (skillResources.length === 0) {
    console.error('ERRO: server não expõe skills (precisa de v2.5.0+).');
    process.exit(1);
  }

  // Lê tudo ANTES de apagar o destino: skill recusada na validação nao pode
  // deixar plugin/skills/ pela metade num passo de release.
  const baixadas = [];
  const vistos = new Set();
  for (const res of skillResources) {
    const { contents } = await client.readResource({ uri: res.uri });
    const raw = contents?.[0]?.text || '';
    // parseSkill ancora o parse no bloco de frontmatter (um `name:` solto no
    // corpo nao vence) e so deixa passar /^[\w-]+$/ — fora disso devolve o
    // default 'zihin-skill'. Aqui isso e erro, nao default: colisao de nome
    // sobrescreveria uma skill com outra, e '../' e sinal de server
    // comprometido, nao de skill mal formatada.
    const { name } = parseSkill(raw);
    const dir = path.join(DEST, name);
    if (dir !== DEST && !dir.startsWith(DEST + path.sep)) {
      console.error(`ERRO: skill ${res.uri} escaparia de ${DEST} (name: "${name}") — abortado.`);
      process.exit(1);
    }
    if (vistos.has(name)) {
      console.error(`ERRO: duas skills reivindicam o name "${name}" (ultima: ${res.uri}) — abortado.`);
      process.exit(1);
    }
    vistos.add(name);
    baixadas.push({ dir, raw, name });
  }

  rmSync(DEST, { recursive: true, force: true });
  for (const { dir, raw, name } of baixadas) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'SKILL.md'), raw);
    console.log(`✓ ${name}`);
  }
  await client.close().catch(() => {});
  console.log(`\n${skillResources.length} skills sincronizadas de ${mcpUrl}`);
} else {
  if (!existsSync(srcDir)) {
    console.error(`ERRO: diretório fonte não existe: ${srcDir}`);
    console.error('Use --from-dir <path> ou --from-server.');
    process.exit(1);
  }
  rmSync(DEST, { recursive: true, force: true });
  cpSync(srcDir, DEST, { recursive: true });
  console.log(`Skills sincronizadas de ${srcDir} → plugin/skills/`);
}
