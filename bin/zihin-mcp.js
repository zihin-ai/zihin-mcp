#!/usr/bin/env node

/**
 * @zihin/mcp-server — CLI Entry Point
 *
 * Proxy stdio ↔ HTTP para o Zihin MCP Server + instalador de skills.
 *
 * Uso:
 *   ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server
 *   ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server install-skills --client claude
 *
 * Variáveis de ambiente:
 *   ZIHIN_API_KEY  (obrigatória) — API Key do tenant
 *   ZIHIN_MCP_URL  (opcional)    — URL do MCP Server (default: https://llm.zihin.ai/mcp)
 */

const [subcommand, ...rest] = process.argv.slice(2);

if (subcommand === 'install-skills') {
  const { installSkills } = await import('../src/install-skills.js');
  installSkills(rest).catch((error) => {
    console.error('[zihin-mcp] Erro fatal:', error.message);
    process.exit(1);
  });
} else {
  const { startProxy } = await import('../src/index.js');
  startProxy().catch((error) => {
    console.error('[zihin-mcp] Erro fatal:', error.message);
    process.exit(1);
  });
}
