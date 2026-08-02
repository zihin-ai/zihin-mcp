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

const VERSION = '1.4.0';
const DEFAULT_MCP_URL = 'https://llm.zihin.ai/mcp';
const VALID_KEY_PREFIXES = ['zhn_live_', 'zhn_test_', 'zhn_dev_'];

const KEEPALIVE_INTERVAL_MS = 30_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

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
  let remoteToolsSignature = '[]'; // assinatura por conteúdo — ver keepalive
  let remoteResources = [];
  let remotePrompts = [];
  let reconnecting = false;
  let keepaliveTimer = null;

  /** Atualiza o cache de tools mantendo a assinatura de conteúdo em sincronia. */
  function setRemoteTools(tools) {
    remoteTools = tools;
    remoteToolsSignature = JSON.stringify(tools);
  }

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

    setRemoteTools(toolsResult.status === 'fulfilled' ? toolsResult.value.tools : []);
    remoteResources = resourcesResult.status === 'fulfilled' ? resourcesResult.value.resources : [];
    remotePrompts = promptsResult.status === 'fulfilled' ? promptsResult.value.prompts : [];

    log(`Descoberto: ${remoteTools.length} tools, ${remoteResources.length} resources, ${remotePrompts.length} prompts`);

    // Identificar tenant via whoami (best-effort)
    await identifyTenant();

    // Notification handlers para discovery dinâmico
    remoteClient.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      log('Notificação: tools atualizadas. Re-descobrindo...');
      try {
        const result = await remoteClient.listTools();
        setRemoteTools(result.tools);
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

  // --- Identificação de tenant (Fix 2) ---

  async function identifyTenant() {
    try {
      const hasWhoami = remoteTools.some(t => t.name === 'whoami');
      if (!hasWhoami) {
        log('(whoami não disponível — server anterior a v2.3.0)');
        return;
      }

      const result = await remoteClient.callTool({ name: 'whoami', arguments: {} });
      const text = result?.content?.[0]?.text;
      if (text) {
        const info = JSON.parse(text);
        if (info.success) {
          log('');
          log(`✓ Tenant:  ${info.tenant_name || info.tenant_id}`);
          log(`  Role:    ${info.role}`);
          if (info.plan) log(`  Plano:   ${info.plan}`);
        }
      }
    } catch {
      // best-effort — não bloqueia o boot
    }
  }

  // --- Erros fatais (auth / versão de protocolo) ---

  function failIfFatal(error) {
    if (isAuthError(error)) {
      log('');
      log('ERRO FATAL: API Key inválida ou revogada.');
      log('Atualize ZIHIN_API_KEY e reinicie o processo.');
      process.exit(1);
    }
    if (isProtocolVersionError(error)) {
      log('');
      log('ERRO FATAL: o server não aceita mais a versão de protocolo MCP deste proxy (-32022).');
      log('Atualize o pacote: npx @zihin/mcp-server@latest (ou npm install -g @zihin/mcp-server@latest).');
      process.exit(1);
    }
  }

  // --- Smart keepalive (Fix 4) ---

  function startKeepalive() {
    stopKeepalive();
    keepaliveTimer = setInterval(async () => {
      try {
        // Discovery contínuo: detecta mudança nas tools + valida auth.
        // Com o server stateless este é o ÚNICO detector de mudança — não há
        // mais GET stream para entregar list_changed —, então o diff é por
        // CONTEÚDO: comparar length não detecta troca de tool com contagem
        // igual (ex.: deploy que renomeia uma tool).
        const result = await remoteClient.listTools();
        const signature = JSON.stringify(result.tools);
        if (signature !== remoteToolsSignature) {
          log(`Keepalive: tools atualizadas (${remoteTools.length} → ${result.tools.length})`);
          setRemoteTools(result.tools);
        }
      } catch (error) {
        failIfFatal(error);
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

    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      log(`Máximo de tentativas de reconexão atingido (${MAX_RECONNECT_ATTEMPTS}). Encerrando.`);
      process.exit(1);
    }

    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
    log(`Reconectando em ${delay / 1000}s (tentativa ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})...`);

    await sleep(delay);

    try {
      await remoteClient.close().catch(() => {});
      await connectAndDiscover();
      log('Reconectado com sucesso!');
      reconnecting = false;
    } catch (error) {
      reconnecting = false;

      // Fix 3: auth/versão de protocolo = fatal, não reconectar
      failIfFatal(error);

      log(`Falha ao reconectar: ${error.message}`);
      reconnect(attempt + 1);
    }
  }

  // --- Wrapper com retry para operações remotas ---

  async function withRetry(operation) {
    try {
      return await operation();
    } catch (error) {
      // Não retry em erro fatal: reemitir com a mesma key/versão falha igual
      if (isAuthError(error) || isProtocolVersionError(error)) throw error;
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

    if (isAuthError(error)) {
      log('Verifique se a API Key é válida e está ativa.');
    } else if (isProtocolVersionError(error)) {
      log('O server não aceita mais a versão de protocolo MCP deste proxy.');
      log('Atualize o pacote: npx @zihin/mcp-server@latest.');
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

// ─── Classificação de erros ─────────────────────────────────────────
//
// Por CÓDIGO primeiro, mensagem só como fallback (espelha o
// _classifyProbeError do zihin-agent-builder). O código chega em formas
// diferentes conforme a origem — e a forma MUDA entre SDK v1 e v2, então o
// classificador já lê as duas para sobreviver à migração da Fase 1:
//   - SDK v1 StreamableHTTPError: error.code = status HTTP (401, 403, ...)
//   - SDK v2 SdkHttpError:        error.data.status = status HTTP;
//                                 error.code = string ('CONNECTION_CLOSED', ...)
//   - McpError / ProtocolError:   error.code = JSON-RPC numérico (-32xxx)
//   - Rede (undici):              error.code ou error.cause.code = 'ECONNRESET', ...

/** Código JSON-RPC da spec 2026-07-28 para versão de protocolo não suportada. */
const UNSUPPORTED_PROTOCOL_VERSION = -32022;

/** Extrai o status HTTP do erro, nas formas do SDK v1 e v2. */
function httpStatus(error) {
  const code = error?.code;
  if (typeof code === 'number' && code >= 100 && code < 600) return code; // v1: StreamableHTTPError
  const status = error?.data?.status;
  if (typeof status === 'number') return status; // v2: SdkHttpError
  return null;
}

/**
 * Verifica se o erro indica autenticação inválida (401/403).
 * Esses erros são fatais — não faz sentido reconectar com a mesma key.
 *
 * Sem casar 'api key' na mensagem: o texto de erro de uma TOOL remota que
 * mencione API Key (ex.: config de um tenant) não pode derrubar o processo.
 */
export function isAuthError(error) {
  const status = httpStatus(error);
  if (status === 401 || status === 403) return true;
  // Fallback para erros que não carregam código (corpo texto de fetch intermediário)
  const msg = (error?.message || '').toLowerCase();
  return msg.includes('unauthorized') || msg.includes('forbidden');
}

/**
 * Verifica se o server rejeitou a versão do protocolo (-32022, spec
 * 2026-07-28). Fatal: nenhuma reconexão resolve — só upgrade do pacote.
 * Forward-looking: o SDK v1 nunca produz esse código; passa a importar
 * quando o server Zihin desligar o modo legacy.
 */
export function isProtocolVersionError(error) {
  return error?.code === UNSUPPORTED_PROTOCOL_VERSION;
}

/**
 * Verifica se o erro indica problema de conexão (recuperável via reconnect).
 *
 * Sem as heurísticas 'session'/'404' da era session-based: o server de
 * produção é stateless (não há mais Mcp-Session-Id para expirar), e um 404
 * real é endpoint errado — reconectar não conserta.
 */
export function isConnectionError(error) {
  if (isAuthError(error) || isProtocolVersionError(error)) return false;

  const code = error?.code ?? error?.cause?.code; // undici embrulha rede em 'fetch failed' com cause
  switch (code) {
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ECONNRESET':
    case 'EPIPE':
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'UND_ERR_SOCKET':
    case 'CONNECTION_CLOSED': // SDK v2 SdkError
    case 'SEND_FAILED':       // SDK v2 SdkError
    case 'REQUEST_TIMEOUT':   // SDK v2 SdkError
    case -32000:              // JSON-RPC ConnectionClosed
    case -32001:              // JSON-RPC RequestTimeout
      return true;
  }

  // Fallback por mensagem para erros de rede sem código
  const msg = (error?.message || '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('abort')
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
