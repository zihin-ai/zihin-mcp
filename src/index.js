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
  ToolListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  PromptListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';

const VERSION = '1.2.0';
const DEFAULT_MCP_URL = 'https://llm.zihin.ai/mcp';
const VALID_KEY_PREFIXES = ['zhn_live_', 'zhn_test_', 'zhn_dev_'];

const KEEPALIVE_INTERVAL_MS = 30_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

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

  // Estado mutável — atualizado em cada (re)conexão
  let remoteTools = [];
  let remoteResources = [];
  let remotePrompts = [];
  let reconnecting = false;
  let keepaliveTimer = null;

  const remoteClient = new Client(
    { name: 'zihin-mcp-proxy', version: VERSION },
  );

  // --- Conexão e discovery ---

  async function connectAndDiscover() {
    const httpTransport = new StreamableHTTPClientTransport(
      new URL(mcpUrl),
      {
        requestInit: {
          headers: { 'X-Api-Key': apiKey },
        },
        reconnectionOptions: {
          maxReconnectionDelay: RECONNECT_MAX_MS,
          initialReconnectionDelay: RECONNECT_BASE_MS,
          reconnectionDelayGrowFactor: 2,
          maxRetries: 5,
        },
      },
    );

    httpTransport.onclose = () => {
      log('Conexão HTTP fechada pelo server.');
      reconnect();
    };

    httpTransport.onerror = (error) => {
      log(`Erro no transport HTTP: ${error.message}`);
      // onclose será chamado em seguida pelo SDK; reconnect acontece lá
    };

    await remoteClient.connect(httpTransport);

    // Descobrir capabilities
    const [toolsResult, resourcesResult, promptsResult] = await Promise.allSettled([
      remoteClient.listTools(),
      remoteClient.listResources(),
      remoteClient.listPrompts(),
    ]);

    remoteTools = toolsResult.status === 'fulfilled' ? toolsResult.value.tools : [];
    remoteResources = resourcesResult.status === 'fulfilled' ? resourcesResult.value.resources : [];
    remotePrompts = promptsResult.status === 'fulfilled' ? promptsResult.value.prompts : [];

    log(`Descoberto: ${remoteTools.length} tools, ${remoteResources.length} resources, ${remotePrompts.length} prompts`);

    // Notification handlers para discovery dinâmico
    remoteClient.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      log('Notificação: tools atualizadas. Re-descobrindo...');
      try {
        const result = await remoteClient.listTools();
        remoteTools = result.tools;
        log(`Tools atualizadas: ${remoteTools.length} tools`);
      } catch (error) {
        log(`Erro ao re-descobrir tools: ${error.message}`);
      }
    });

    remoteClient.setNotificationHandler(ResourceListChangedNotificationSchema, async () => {
      log('Notificação: resources atualizados. Re-descobrindo...');
      try {
        const result = await remoteClient.listResources();
        remoteResources = result.resources;
        log(`Resources atualizados: ${remoteResources.length} resources`);
      } catch (error) {
        log(`Erro ao re-descobrir resources: ${error.message}`);
      }
    });

    remoteClient.setNotificationHandler(PromptListChangedNotificationSchema, async () => {
      log('Notificação: prompts atualizados. Re-descobrindo...');
      try {
        const result = await remoteClient.listPrompts();
        remotePrompts = result.prompts;
        log(`Prompts atualizados: ${remotePrompts.length} prompts`);
      } catch (error) {
        log(`Erro ao re-descobrir prompts: ${error.message}`);
      }
    });

    // Iniciar keepalive
    startKeepalive();
  }

  // --- Keepalive ---

  function startKeepalive() {
    stopKeepalive();
    keepaliveTimer = setInterval(async () => {
      try {
        await remoteClient.ping();
      } catch {
        log('Keepalive falhou — reconectando...');
        reconnect();
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  function stopKeepalive() {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  }

  // --- Auto-reconnect ---

  async function reconnect(attempt = 0) {
    if (reconnecting) return;
    reconnecting = true;
    stopKeepalive();

    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
    log(`Reconectando em ${delay / 1000}s (tentativa ${attempt + 1})...`);

    await sleep(delay);

    try {
      await remoteClient.close().catch(() => {});
      await connectAndDiscover();
      log('Reconectado com sucesso!');
      reconnecting = false;
    } catch (error) {
      log(`Falha ao reconectar: ${error.message}`);
      reconnecting = false;
      reconnect(attempt + 1);
    }
  }

  // --- Wrapper com retry para operações remotas ---

  async function withRetry(operation) {
    try {
      return await operation();
    } catch (error) {
      if (isConnectionError(error)) {
        log(`Erro de conexão detectado. Reconectando...`);
        await reconnect();
        return await operation();
      }
      throw error;
    }
  }

  // --- Conexão inicial ---

  log('Conectando ao Zihin MCP Server...');

  try {
    await connectAndDiscover();
  } catch (error) {
    log(`ERRO: Falha ao conectar ao server: ${error.message}`);

    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      log('Verifique se a API Key é válida e está ativa.');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      log('Verifique sua conexão com a internet e a URL do server.');
    }

    process.exit(1);
  }

  log('');

  // Criar server local
  const capabilities = { tools: {} };
  if (remoteResources.length > 0) capabilities.resources = {};
  if (remotePrompts.length > 0) capabilities.prompts = {};

  const localServer = new Server(
    { name: 'zihin-mcp-proxy', version: VERSION },
    { capabilities },
  );

  // Handler: listTools
  localServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: remoteTools,
  }));

  // Handler: callTool (com retry)
  localServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await withRetry(() => remoteClient.callTool({ name, arguments: args }));
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Erro ao executar tool "${name}": ${error.message}` }],
        isError: true,
      };
    }
  });

  // Handler: listResources
  if (remoteResources.length > 0) {
    localServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: remoteResources,
    }));

    localServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      try {
        return await withRetry(() => remoteClient.readResource({ uri }));
      } catch (error) {
        return {
          contents: [{ uri, text: `Erro ao ler resource "${uri}": ${error.message}` }],
        };
      }
    });
  }

  // Handler: prompts
  if (remotePrompts.length > 0) {
    localServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: remotePrompts,
    }));

    localServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        return await withRetry(() => remoteClient.getPrompt({ name, arguments: args }));
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
    stopKeepalive();
    try { await remoteClient.close(); } catch { /* ignore */ }
    try { await localServer.close(); } catch { /* ignore */ }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * Verifica se o erro indica problema de conexão/sessão.
 */
function isConnectionError(error) {
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('abort') ||
    msg.includes('session') ||
    msg.includes('404') ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'UND_ERR_CONNECT_TIMEOUT'
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Log para stderr (stdout é reservado para JSON-RPC MCP).
 */
function log(message) {
  console.error(message);
}
