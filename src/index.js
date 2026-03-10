/**
 * @zihin/mcp-server — Proxy stdio ↔ HTTP
 *
 * Thin client que conecta ao Zihin MCP Server via Streamable HTTP
 * e expõe as tools/resources/prompts localmente via stdio transport.
 *
 * Arquitetura:
 *   Claude Desktop ←stdio→ [Server local] → [Client → StreamableHTTPClientTransport] → https://llm.zihin.ai/mcp
 *
 * @module @zihin/mcp-server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const VERSION = '1.0.0';
const DEFAULT_MCP_URL = 'https://llm.zihin.ai/mcp';
const VALID_KEY_PREFIXES = ['zhn_live_', 'zhn_test_', 'zhn_dev_'];

/**
 * Inicia o proxy stdio ↔ HTTP.
 */
export async function startProxy() {
  const apiKey = process.env.ZIHIN_API_KEY;
  const mcpUrl = process.env.ZIHIN_MCP_URL || DEFAULT_MCP_URL;

  // Banner (stderr — stdout é reservado para JSON-RPC)
  log('═══════════════════════════════════════════════════════');
  log(`   Zihin MCP Server v${VERSION} (proxy)`);
  log('═══════════════════════════════════════════════════════');
  log('');

  // Validar API Key
  if (!apiKey) {
    log('ERRO: ZIHIN_API_KEY não definida.');
    log('Defina a variável de ambiente ZIHIN_API_KEY com uma API Key válida.');
    log('');
    log('Exemplo:');
    log('  ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server');
    process.exit(1);
  }

  if (!VALID_KEY_PREFIXES.some(p => apiKey.startsWith(p))) {
    log(`ERRO: ZIHIN_API_KEY deve começar com ${VALID_KEY_PREFIXES.join(' ou ')}`);
    process.exit(1);
  }

  log(`API Key: ...${apiKey.slice(-6)}`);
  log(`Server:  ${mcpUrl}`);
  log('');

  // Conectar ao server remoto via HTTP
  log('Conectando ao Zihin MCP Server...');

  const remoteClient = new Client(
    { name: 'zihin-mcp-proxy', version: VERSION },
  );

  const httpTransport = new StreamableHTTPClientTransport(
    new URL(mcpUrl),
    {
      requestInit: {
        headers: {
          'X-Api-Key': apiKey,
        },
      },
    },
  );

  try {
    await remoteClient.connect(httpTransport);
  } catch (error) {
    log(`ERRO: Falha ao conectar ao server: ${error.message}`);

    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      log('Verifique se a API Key é válida e está ativa.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      log('Verifique sua conexão com a internet e a URL do server.');
    }

    process.exit(1);
  }

  log('Conectado! Descobrindo capabilities...');

  // Descobrir tools, resources e prompts do server remoto
  const [toolsResult, resourcesResult, promptsResult] = await Promise.allSettled([
    remoteClient.listTools(),
    remoteClient.listResources(),
    remoteClient.listPrompts(),
  ]);

  const remoteTools = toolsResult.status === 'fulfilled' ? toolsResult.value.tools : [];
  const remoteResources = resourcesResult.status === 'fulfilled' ? resourcesResult.value.resources : [];
  const remotePrompts = promptsResult.status === 'fulfilled' ? promptsResult.value.prompts : [];

  log(`Descoberto: ${remoteTools.length} tools, ${remoteResources.length} resources, ${remotePrompts.length} prompts`);
  log('');

  // Criar server local usando a API de baixo nível (Server, não McpServer)
  // para poder registrar handlers com JSON Schema direto do server remoto
  const capabilities = { tools: {} };
  if (remoteResources.length > 0) capabilities.resources = {};
  if (remotePrompts.length > 0) capabilities.prompts = {};

  const localServer = new Server(
    { name: 'zihin-mcp-proxy', version: VERSION },
    { capabilities },
  );

  // Registrar handler de listTools — retorna a lista do server remoto
  localServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: remoteTools,
  }));

  // Registrar handler de callTool — proxy para o server remoto
  localServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await remoteClient.callTool({ name, arguments: args });
      return result;
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Erro ao executar tool "${name}": ${error.message}` }],
        isError: true,
      };
    }
  });

  // Registrar handlers de resources (se disponíveis)
  if (remoteResources.length > 0) {
    localServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: remoteResources,
    }));

    localServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      try {
        const result = await remoteClient.readResource({ uri });
        return result;
      } catch (error) {
        return {
          contents: [{ uri, text: `Erro ao ler resource "${uri}": ${error.message}` }],
        };
      }
    });
  }

  // Registrar handlers de prompts (se disponíveis)
  if (remotePrompts.length > 0) {
    localServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: remotePrompts,
    }));

    localServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const result = await remoteClient.getPrompt({ name, arguments: args });
        return result;
      } catch (error) {
        return {
          messages: [{ role: 'user', content: { type: 'text', text: `Erro ao obter prompt "${name}": ${error.message}` } }],
        };
      }
    });
  }

  // Iniciar stdio transport
  log('Iniciando stdio transport...');
  const stdioTransport = new StdioServerTransport();
  await localServer.connect(stdioTransport);

  log('Pronto! MCP Server proxy ativo via stdio.');
  log('Use Ctrl+C para encerrar.');
  log('═══════════════════════════════════════════════════════');

  // Cleanup ao encerrar
  const cleanup = async () => {
    log('Encerrando...');
    try { await remoteClient.close(); } catch { /* ignore */ }
    try { await localServer.close(); } catch { /* ignore */ }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * Log para stderr (stdout é reservado para JSON-RPC MCP).
 */
function log(message) {
  console.error(message);
}
