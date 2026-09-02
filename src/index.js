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

// SDK v2 (pacotes divididos): este pacote é as duas coisas ao mesmo tempo —
// client HTTP contra llm.zihin.ai e server stdio para o host local.
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Server } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { writeSync } from 'node:fs';
import { createRequire } from 'node:module';

// Versao unica: a do package.json. Constante hardcoded driftava a cada release
// (a 2.2.1 saiu com o handshake se apresentando como 2.2.0).
const VERSION = createRequire(import.meta.url)('../package.json').version;
const DEFAULT_MCP_URL = 'https://llm.zihin.ai/mcp';
const VALID_KEY_PREFIXES = ['zhn_live_', 'zhn_test_', 'zhn_dev_'];

const KEEPALIVE_INTERVAL_MS = 30_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Teto de tempo do proxy para um tools/call.
 *
 * O /mcp do server saiu do timeout global de 30s do Express e passou a ter
 * deadline POR CANAL (chat 150s / builder 180s / async 240s). Quem corta
 * primeiro decide a mensagem que o usuario le: com o default do SDK (60s), o
 * proxy cortava ANTES do server em todo turno de agente com 2+ tool_calls e o
 * host recebia um REQUEST_TIMEOUT generico — enquanto o TURN_TIMEOUT do
 * server, o unico erro que carrega execution_id + session_id (por onde a
 * investigacao comeca), nunca chegava. 300s deixa o server ganhar a corrida
 * com folga em todos os canais.
 */
const DEFAULT_CALL_TIMEOUT_MS = 300_000;

/** Faixa aceita para o override da env — ver resolveCallTimeoutMs. */
const MIN_CALL_TIMEOUT_MS = 1_000;
const MAX_CALL_TIMEOUT_MS = 1_800_000;

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

  const callTimeoutMs = resolveCallTimeoutMs(process.env.ZIHIN_MCP_CALL_TIMEOUT_MS, log);

  log(`API Key: ...${apiKey.slice(-6)}`);
  log(`Server:  ${mcpUrl}`);
  log(`Timeout de tools/call: ${Math.round(callTimeoutMs / 1000)}s`);
  log('');

  // Estado mutável — atualizado em cada (re)conexão
  let remoteTools = [];
  let remoteToolsSignature = '[]'; // assinatura por conteúdo — ver keepalive
  let remoteResources = [];
  let remotePrompts = [];
  let reconnecting = false;
  let keepaliveTimer = null;
  let inFlightRemoteCalls = 0; // ver a guarda no keepalive

  /** Atualiza o cache de tools mantendo a assinatura de conteúdo em sincronia. */
  function setRemoteTools(tools) {
    remoteTools = tools;
    remoteToolsSignature = JSON.stringify(tools);
  }

  const remoteClient = new Client(
    { name: 'zihin-mcp-proxy', version: VERSION },
    {
      // Fase 2: dialeto 2026-07-28 ligado. O connect() faz o probe
      // server/discover; evidência moderna definitiva liga a era nova, e
      // QUALQUER outra resposta (server antigo, rollback de deploy) cai no
      // initialize legacy byte-idêntico ao de antes — o flip é seguro nos
      // dois sentidos. Queda de rede continua rejeitando com erro tipado
      // (em HTTP, silêncio é outage, não sinal de era).
      versionNegotiation: { mode: 'auto' },
      // O proxy não tem UI: nenhum handler de elicitation/sampling/roots
      // registrado. Sem isto, um input_required (vocabulário novo da era
      // moderna) entraria no driver de auto-fulfilment do SDK, que despacha
      // para handlers inexistentes. Em modo manual ele vira SdkError
      // UNSUPPORTED_RESULT_TYPE imediato — convertido em mensagem clara ao
      // host no handler de tools/call (ver isInputRequiredError).
      inputRequired: { autoFulfill: false },
      //
      // listChanged substitui os três setNotificationHandler do SDK v1.
      // Funciona nas duas eras: notificação legacy (GET stream) hoje,
      // subscriptions/listen auto-aberto quando o dialeto moderno ligar.
      // O SDK refaz o list e entrega o resultado pronto no callback.
      listChanged: {
        tools: {
          onChanged: (error, tools) => {
            if (error) return log(`Erro ao re-descobrir tools: ${error.message}`);
            setRemoteTools(tools);
            log(`Tools atualizadas: ${tools.length} tools`);
          },
        },
        resources: {
          onChanged: (error, resources) => {
            if (error) return log(`Erro ao re-descobrir resources: ${error.message}`);
            remoteResources = resources;
            log(`Resources atualizados: ${resources.length} resources`);
          },
        },
        prompts: {
          onChanged: (error, prompts) => {
            if (error) return log(`Erro ao re-descobrir prompts: ${error.message}`);
            remotePrompts = prompts;
            log(`Prompts atualizados: ${prompts.length} prompts`);
          },
        },
      },
    },
  );

  // --- Conexão e discovery ---

  async function connectAndDiscover() {
    const httpTransport = new StreamableHTTPClientTransport(
      new URL(mcpUrl),
      {
        // Sem reconnectionOptions: resumability de SSE só existe para o GET
        // stream, e o server stateless (v2.4.0) não o oferece — a reconexão
        // real é a do proxy (reconnect(), backoff próprio).
        requestInit: {
          headers: { 'X-Api-Key': apiKey },
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

    // Discovery dinâmico via list_changed: configurado em ClientOptions
    // (listChanged) — o SDK v2 registra os handlers e refaz o list sozinho.

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
      // Com o teto de 300s, um chat_with_agent pode ficar 4 minutos em voo —
      // dez ticks de keepalive por cima dele. Se UM tick falhar (502 de LB,
      // blip de rede), o reconnect() fecha o client e o close() ABORTA o
      // request em voo: no dialeto moderno esse abort é cancelamento de
      // verdade, então a sonda de saúde mataria o turno do usuário. Um
      // request em voo já é prova de vida melhor do que a sonda, e se a
      // conexão realmente caiu é ele quem falha primeiro — aí o withRetry
      // reconecta. Detecção de mudança de tools só atrasa o que durar a
      // chamada.
      if (inFlightRemoteCalls > 0) return;
      try {
        // Discovery contínuo: detecta mudança nas tools + valida auth.
        // Com o server stateless este é o ÚNICO detector de mudança — não há
        // mais GET stream para entregar list_changed —, então o diff é por
        // CONTEÚDO: comparar length não detecta troca de tool com contagem
        // igual (ex.: deploy que renomeia uma tool).
        //
        // cacheMode 'bypass' por dois motivos (revisão 02/08):
        // 1. Resiliência: 'use' (default) serviria do cache quando o server
        //    passar a emitir ttlMs (SEP-2549) — keepalive cego, sem validar
        //    auth nem detectar queda.
        // 2. Performance: cada write no cache bumpa o stamp e força o 1º
        //    callTool seguinte a re-derivar o índice de output-validators
        //    (recompilação AJV de até ~110ms); bypass não escreve.
        const result = await remoteClient.listTools(undefined, { cacheMode: 'bypass' });
        const signature = JSON.stringify(result.tools);
        if (signature !== remoteToolsSignature) {
          log(`Keepalive: tools atualizadas (${remoteTools.length} → ${result.tools.length})`);
          setRemoteTools(result.tools);
          // Evento raro: sincroniza o cache/índice interno do SDK com a
          // lista nova (validação de outputSchema do callTool lê de lá).
          remoteClient.listTools(undefined, { cacheMode: 'refresh' }).catch(() => {});
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

  async function withRetry(operation, { reissue = true } = {}) {
    inFlightRemoteCalls++;
    try {
      return await operation();
    } catch (error) {
      // Não retry em erro fatal: reemitir com a mesma key/versão falha igual
      if (isAuthError(error) || isProtocolVersionError(error)) throw error;
      // Timeout de REQUEST não é queda de conexão: com o server stateless cada
      // request é um POST próprio, e o SDK já abortou esse POST (no dialeto
      // moderno, o abort É o cancelamento que o server v2.4.0 honra). Passar
      // por reconnect() aqui só somaria dano: o close() do client aborta os
      // requests em voo de OUTRAS chamadas — inclusive um turno de chat longo
      // que ainda ia responder.
      if (isTimeoutError(error)) {
        log(`Timeout na operação remota (${error.message}). Sem reconectar — o request foi abortado, a conexão está de pé.`);
        throw error;
      }
      if (isConnectionError(error)) {
        log('Erro de conexão detectado. Reconectando...');
        if (!reissue) {
          // tools/call NÃO é idempotente (ex.: chat_with_agent): com a conexão
          // caída pós-envio o request pode ter executado no server, e reemitir
          // duplicaria o efeito. Reconecta em background e devolve o erro ao
          // host — quem decide reenviar é o usuário. (Decisão de revisão
          // 02/08; a extensão Tasks da Fase 3 devolve a transparência do jeito
          // certo.) Timeout não chega aqui: sai no ramo acima, sem reconectar.
          reconnect();
          throw error;
        }
        await reconnect();
        return await operation();
      }
      throw error;
    } finally {
      inFlightRemoteCalls--;
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

  // Identidade ESPELHADA do upstream (achado da validação de canary 2.0.0):
  // name/title/instructions vêm do server real — o proxy é transparente, e o
  // instructions é o texto que ensina o modelo a operar as 96 tools (fluxos,
  // RBAC, ponteiro para as skills zihin://skills/*). Sem repassá-lo, quem
  // instala o pacote opera às cegas e "o agente só erra mais", sem erro
  // visível. A version continua a do PROXY: identifica o hop que responde o
  // stdio (essencial em bug report); a do server aparece via whoami/banner.
  const upstreamInfo = remoteClient.getServerVersion() || {};
  const localServer = new Server(
    {
      name: upstreamInfo.name || 'zihin-mcp-proxy',
      ...(upstreamInfo.title ? { title: upstreamInfo.title } : {}),
      version: VERSION,
    },
    { capabilities, instructions: remoteClient.getInstructions() },
  );

  // Handlers registrados pela STRING do método (SDK v2) — o handler continua
  // recebendo o request tipado com a mesma forma (request.params).

  // Handler: listTools
  localServer.setRequestHandler('tools/list', async () => ({
    tools: remoteTools,
  }));

  // Handler: callTool (com retry)
  localServer.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    try {
      // timeout explícito: o default do SDK (60s) corta antes do deadline do
      // server e engole o TURN_TIMEOUT diagnosticável. Ver DEFAULT_CALL_TIMEOUT_MS.
      return await withRetry(
        () => remoteClient.callTool({ name, arguments: args }, { timeout: callTimeoutMs }),
        { reissue: false },
      );
    } catch (error) {
      const text = isInputRequiredError(error)
        ? `A tool "${name}" pediu input interativo (input_required) e o proxy não tem interface para responder. ` +
          'Reenvie a chamada com todos os argumentos necessários preenchidos.'
        : isTimeoutError(error)
        ? `A tool "${name}" passou do teto de ${Math.round(callTimeoutMs / 1000)}s do proxy e foi abortada. ` +
          'No dialeto 2026-07-28 o abort do request é o sinal de cancelamento que o server honra, ' +
          'então o trabalho não segue em background. ' +
          'Se a operação é legitimamente mais longa, suba ZIHIN_MCP_CALL_TIMEOUT_MS e tente de novo.'
        : `Erro ao executar tool "${name}": ${error.message}`;
      return {
        content: [{ type: 'text', text }],
        isError: true,
      };
    }
  });

  // Handler: listResources
  if (remoteResources.length > 0) {
    localServer.setRequestHandler('resources/list', async () => ({
      resources: remoteResources,
    }));

    localServer.setRequestHandler('resources/read', async (request) => {
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
    localServer.setRequestHandler('prompts/list', async () => ({
      prompts: remotePrompts,
    }));

    localServer.setRequestHandler('prompts/get', async (request) => {
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
 * Verifica se o erro é um input_required do dialeto 2026-07-28 em modo manual
 * (inputRequired.autoFulfill: false): o SDK v2 devolve SdkError com code
 * 'UNSUPPORTED_RESULT_TYPE' e data.resultType = 'input_required'. Não é erro
 * de conexão (reconectar não muda nada) nem fatal — o handler de tools/call
 * converte em mensagem clara ao host. Na prática não deve ocorrer: o proxy
 * não declara capabilities de elicitation/sampling/roots, então o server não
 * tem base para pedir input; isto é a rede de segurança.
 */
export function isInputRequiredError(error) {
  return error?.code === 'UNSUPPORTED_RESULT_TYPE' && error?.data?.resultType === 'input_required';
}

/**
 * Verifica se o erro é timeout de request (SDK v2 SdkError REQUEST_TIMEOUT;
 * JSON-RPC -32001 na forma antiga).
 *
 * Continua classificado como erro de conexão (isConnectionError segue
 * retornando true para estes códigos, e o diagnóstico de boot depende disso).
 * Quem separa os dois casos é o withRetry: lá o timeout NÃO dispara
 * reconexão, porque mata um request, não a conexão. O keepalive não passa
 * pelo classificador — qualquer falha da sonda reconecta.
 */
export function isTimeoutError(error) {
  return error?.code === 'REQUEST_TIMEOUT' || error?.code === -32001;
}

/**
 * Resolve o teto de tools/call a partir de ZIHIN_MCP_CALL_TIMEOUT_MS.
 *
 * Valor inválido (não numérico, <= 0) cai no default com aviso em vez de
 * derrubar o boot: o proxy roda dentro do config JSON de um host, onde um typo
 * na env é erro de digitação, não motivo para o usuário ficar sem MCP.
 *
 * Valor válido mas fora de faixa é CLAMPADO, também com aviso:
 *   - piso de 1s: `=300` é quase sempre alguém pensando em SEGUNDOS; sem o
 *     piso, todo tools/call morreria em 300 ms com uma mensagem que culpa o
 *     server pelo timeout do próprio config.
 *   - teto de 30 min: acima de 2^31 ms o setTimeout do SDK estoura e dispara
 *     IMEDIATAMENTE (o "timeout infinito" vira timeout instantâneo), e nenhum
 *     host de MCP espera meia hora por um tools/call.
 */
export function resolveCallTimeoutMs(raw, warn = () => {}) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_CALL_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    warn(`AVISO: ZIHIN_MCP_CALL_TIMEOUT_MS inválido ("${raw}") — usando o default de ${DEFAULT_CALL_TIMEOUT_MS} ms.`);
    return DEFAULT_CALL_TIMEOUT_MS;
  }
  const clamped = Math.min(Math.max(parsed, MIN_CALL_TIMEOUT_MS), MAX_CALL_TIMEOUT_MS);
  if (clamped !== parsed) {
    warn(`AVISO: ZIHIN_MCP_CALL_TIMEOUT_MS=${parsed} fora da faixa [${MIN_CALL_TIMEOUT_MS}, ${MAX_CALL_TIMEOUT_MS}] ms — ajustado para ${clamped} ms. O valor é em MILISSEGUNDOS.`);
  }
  return clamped;
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

  // Status HTTP transitórios de LB/CDN/tunnel/deploy (nginx 502, Cloudflare
  // 503, gateway timeout 504, 404 de janela de deploy) são recuperáveis —
  // substitui de forma principiada o antigo casamento da string '404'.
  const status = httpStatus(error);
  if (status === 404 || status === 408 || status === 502 || status === 503 || status === 504) return true;

  const code = error?.code ?? error?.cause?.code; // undici embrulha rede em 'fetch failed' com cause
  switch (code) {
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ECONNRESET':
    case 'EPIPE':
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
    case 'UND_ERR_HEADERS_TIMEOUT': // teto próprio do fetch do Node (~300s)
    case 'UND_ERR_BODY_TIMEOUT':
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
 *
 * writeSync, não console.error: stderr para pipe é assíncrono em POSIX e
 * process.exit() não drena o buffer — as mensagens de ERRO FATAL sumiriam
 * exatamente quando mais importam (o host veria só "Server disconnected").
 */
function log(message) {
  try {
    writeSync(2, message + '\n');
  } catch {
    // stderr fechado — nada a fazer
  }
}
