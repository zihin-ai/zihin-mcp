#!/usr/bin/env node

/**
 * @zihin/mcp-server — CLI Entry Point
 *
 * Proxy stdio ↔ HTTP para o Zihin MCP Server.
 * Roda como processo stdio para Claude Desktop, Cursor, Claude Code, Codex, etc.
 *
 * Uso:
 *   ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server
 *
 * Variáveis de ambiente:
 *   ZIHIN_API_KEY  (obrigatória) — API Key do tenant
 *   ZIHIN_MCP_URL  (opcional)    — URL do MCP Server (default: https://llm.zihin.ai/mcp)
 */

import { startProxy } from '../src/index.js';

startProxy().catch((error) => {
  console.error('[zihin-mcp] Erro fatal:', error.message);
  process.exit(1);
});
