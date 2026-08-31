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

  rmSync(DEST, { recursive: true, force: true });
  for (const res of skillResources) {
    const { contents } = await client.readResource({ uri: res.uri });
    const raw = contents?.[0]?.text || '';
    const name = /^name:\s*(.+)$/m.exec(raw)?.[1]?.trim() || res.uri.split('/').pop();
    const dir = path.join(DEST, name);
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
