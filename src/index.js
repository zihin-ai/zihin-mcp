import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Server } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { writeSync } from 'node:fs';
import { createRequire } from 'node:module';
const VERSION = createRequire(import.meta.url)('../package.json').version;
const DEFAULT_MCP_URL = 'https://llm.zihin.ai/mcp';
const VALID_KEY_PREFIXES = ['zhn_live_', 'zhn_test_', 'zhn_dev_'];
const KEEPALIVE_INTERVAL_MS = 30000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_CALL_TIMEOUT_MS = 300000;
const MIN_CALL_TIMEOUT_MS = 1000;
const MAX_CALL_TIMEOUT_MS = 1800000;
export async function startProxy() {
    const apiKey = process.env.ZIHIN_API_KEY;
    const mcpUrl = process.env.ZIHIN_MCP_URL || DEFAULT_MCP_URL;
    log('═══════════════════════════════════════════════════════');
    log(`   Zihin MCP Server v${VERSION} (proxy)`);
    log('═══════════════════════════════════════════════════════');
    log('');
    if (!apiKey) {
        log('ERROR: ZIHIN_API_KEY is not set.');
        log('Set ZIHIN_API_KEY to a valid API key.');
        log('');
        log('Example:');
        log('  ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server');
        process.exit(1);
    }
    if (!VALID_KEY_PREFIXES.some(p => apiKey.startsWith(p))) {
        log(`ERROR: ZIHIN_API_KEY must start with ${VALID_KEY_PREFIXES.join(' or ')}`);
        process.exit(1);
    }
    const callTimeoutMs = resolveCallTimeoutMs(process.env.ZIHIN_MCP_CALL_TIMEOUT_MS, log);
    log('API key configured.');
    log(`Server:  ${mcpUrl}`);
    log(`tools/call timeout: ${Math.round(callTimeoutMs / 1000)}s`);
    log('');
    let remoteTools = [];
    let remoteToolsSignature = '[]';
    let remoteResources = [];
    let remotePrompts = [];
    let reconnecting = false;
    let keepaliveTimer = null;
    let inFlightRemoteCalls = 0;
    function setRemoteTools(tools) {
        remoteTools = tools;
        remoteToolsSignature = JSON.stringify(tools);
    }
    const remoteClient = new Client({ name: 'zihin-mcp-proxy', version: VERSION }, {
        versionNegotiation: { mode: 'auto' },
        inputRequired: { autoFulfill: false },
        listChanged: {
            tools: {
                onChanged: (error, tools) => {
                    if (error)
                        return log(`Error refreshing tools: ${error.message}`);
                    setRemoteTools(tools);
                    log(`Tools updated: ${tools.length} tools`);
                },
            },
            resources: {
                onChanged: (error, resources) => {
                    if (error)
                        return log(`Error refreshing resources: ${error.message}`);
                    remoteResources = resources;
                    log(`Resources updated: ${resources.length} resources`);
                },
            },
            prompts: {
                onChanged: (error, prompts) => {
                    if (error)
                        return log(`Error refreshing prompts: ${error.message}`);
                    remotePrompts = prompts;
                    log(`Prompts updated: ${prompts.length} prompts`);
                },
            },
        },
    });
    async function connectAndDiscover() {
        const httpTransport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
            requestInit: {
                headers: { 'X-Api-Key': apiKey },
            },
        });
        httpTransport.onclose = () => {
            log('HTTP connection closed by the server.');
            reconnect();
        };
        httpTransport.onerror = (error) => {
            log(`HTTP transport error: ${error.message}`);
        };
        await remoteClient.connect(httpTransport);
        const [toolsResult, resourcesResult, promptsResult] = await Promise.allSettled([
            remoteClient.listTools(),
            remoteClient.listResources(),
            remoteClient.listPrompts(),
        ]);
        setRemoteTools(toolsResult.status === 'fulfilled' ? toolsResult.value.tools : []);
        remoteResources = resourcesResult.status === 'fulfilled' ? resourcesResult.value.resources : [];
        remotePrompts = promptsResult.status === 'fulfilled' ? promptsResult.value.prompts : [];
        log(`Discovered: ${remoteTools.length} tools, ${remoteResources.length} resources, ${remotePrompts.length} prompts`);
        await identifyTenant();
        startKeepalive();
    }
    async function identifyTenant() {
        try {
            const hasWhoami = remoteTools.some(t => t.name === 'whoami');
            if (!hasWhoami) {
                log('(whoami is unavailable on this server)');
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
                    if (info.plan)
                        log(`  Plan:   ${info.plan}`);
                }
            }
        }
        catch {
        }
    }
    function failIfFatal(error) {
        if (isAuthError(error)) {
            log('');
            log('FATAL: API key is invalid or revoked.');
            log('Update ZIHIN_API_KEY and restart the process.');
            process.exit(1);
        }
        if (isProtocolVersionError(error)) {
            log('');
            log('FATAL: the server no longer accepts the MCP protocol version of this proxy (-32022).');
            log('Update the package: npx @zihin/mcp-server@latest (or npm install -g @zihin/mcp-server@latest).');
            process.exit(1);
        }
    }
    function startKeepalive() {
        stopKeepalive();
        keepaliveTimer = setInterval(async () => {
            if (inFlightRemoteCalls > 0)
                return;
            try {
                const result = await remoteClient.listTools(undefined, { cacheMode: 'bypass' });
                const signature = JSON.stringify(result.tools);
                if (signature !== remoteToolsSignature) {
                    log(`Keepalive: tools updated (${remoteTools.length} → ${result.tools.length})`);
                    setRemoteTools(result.tools);
                    remoteClient.listTools(undefined, { cacheMode: 'refresh' }).catch(() => { });
                }
            }
            catch (error) {
                failIfFatal(error);
                log('Keepalive failed; reconnecting...');
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
    async function reconnect(attempt = 0) {
        if (reconnecting)
            return;
        reconnecting = true;
        stopKeepalive();
        if (attempt >= MAX_RECONNECT_ATTEMPTS) {
            log(`Maximum reconnection attempts reached (${MAX_RECONNECT_ATTEMPTS}). Shutting down.`);
            process.exit(1);
        }
        const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
        log(`Reconnecting in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
        await sleep(delay);
        try {
            await remoteClient.close().catch(() => { });
            await connectAndDiscover();
            log('Reconnected successfully.');
            reconnecting = false;
        }
        catch (error) {
            reconnecting = false;
            failIfFatal(error);
            log(`Reconnection failed: ${error.message}`);
            reconnect(attempt + 1);
        }
    }
    async function withRetry(operation, { reissue = true } = {}) {
        inFlightRemoteCalls++;
        try {
            return await operation();
        }
        catch (error) {
            if (isAuthError(error) || isProtocolVersionError(error))
                throw error;
            if (isTimeoutError(error)) {
                log(`Remote operation timed out (${error.message}). The request was aborted; the connection remains open.`);
                throw error;
            }
            if (isConnectionError(error)) {
                log('Connection error detected. Reconnecting...');
                if (!reissue) {
                    reconnect();
                    throw error;
                }
                await reconnect();
                return await operation();
            }
            throw error;
        }
        finally {
            inFlightRemoteCalls--;
        }
    }
    log('Connecting to the Zihin MCP server...');
    try {
        await connectAndDiscover();
    }
    catch (error) {
        log(`ERROR: Could not connect to the server: ${error.message}`);
        if (isAuthError(error)) {
            log('Check that the API key is valid and active.');
        }
        else if (isProtocolVersionError(error)) {
            log('The server no longer accepts the MCP protocol version of this proxy.');
            log('Update the package: npx @zihin/mcp-server@latest.');
        }
        else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            log('Check your network connection and server URL.');
        }
        process.exit(1);
    }
    log('');
    const capabilities = { tools: {} };
    if (remoteResources.length > 0)
        capabilities.resources = {};
    if (remotePrompts.length > 0)
        capabilities.prompts = {};
    const upstreamInfo = remoteClient.getServerVersion() || {};
    const localServer = new Server({
        name: upstreamInfo.name || 'zihin-mcp-proxy',
        ...(upstreamInfo.title ? { title: upstreamInfo.title } : {}),
        version: VERSION,
    }, { capabilities, instructions: remoteClient.getInstructions() });
    localServer.setRequestHandler('tools/list', async () => ({
        tools: remoteTools,
    }));
    localServer.setRequestHandler('tools/call', async (request) => {
        const { name, arguments: args } = request.params;
        try {
            return await withRetry(() => remoteClient.callTool({ name, arguments: args }, { timeout: callTimeoutMs }), { reissue: false });
        }
        catch (error) {
            const text = isInputRequiredError(error)
                ? `Tool "${name}" requested interactive input (input_required), which this proxy cannot provide. ` +
                    'Retry with all required arguments supplied.'
                : isTimeoutError(error)
                    ? `Tool "${name}" exceeded the proxy timeout of ${Math.round(callTimeoutMs / 1000)}s and was aborted. ` +
                        'The server uses the request abort as its cancellation signal, ' +
                        'so the request is not continued in the background. ' +
                        'For longer operations, increase ZIHIN_MCP_CALL_TIMEOUT_MS and retry.'
                    : `Error calling tool "${name}": ${error.message}`;
            return {
                content: [{ type: 'text', text }],
                isError: true,
            };
        }
    });
    if (remoteResources.length > 0) {
        localServer.setRequestHandler('resources/list', async () => ({
            resources: remoteResources,
        }));
        localServer.setRequestHandler('resources/read', async (request) => {
            const { uri } = request.params;
            try {
                return await withRetry(() => remoteClient.readResource({ uri }));
            }
            catch (error) {
                return {
                    contents: [{ uri, text: `Error reading resource "${uri}": ${error.message}` }],
                };
            }
        });
    }
    if (remotePrompts.length > 0) {
        localServer.setRequestHandler('prompts/list', async () => ({
            prompts: remotePrompts,
        }));
        localServer.setRequestHandler('prompts/get', async (request) => {
            const { name, arguments: args } = request.params;
            try {
                return await withRetry(() => remoteClient.getPrompt({ name, arguments: args }));
            }
            catch (error) {
                return {
                    messages: [{ role: 'user', content: { type: 'text', text: `Error getting prompt "${name}": ${error.message}` } }],
                };
            }
        });
    }
    log('Starting stdio transport...');
    const stdioTransport = new StdioServerTransport();
    await localServer.connect(stdioTransport);
    log('MCP server proxy is ready over stdio.');
    log('Press Ctrl+C to stop.');
    log('═══════════════════════════════════════════════════════');
    const cleanup = async () => {
        log('Shutting down...');
        stopKeepalive();
        try {
            await remoteClient.close();
        }
        catch { }
        try {
            await localServer.close();
        }
        catch { }
        process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}
const UNSUPPORTED_PROTOCOL_VERSION = -32022;
function httpStatus(error) {
    const code = error?.code;
    if (typeof code === 'number' && code >= 100 && code < 600)
        return code;
    const status = error?.data?.status;
    if (typeof status === 'number')
        return status;
    return null;
}
export function isAuthError(error) {
    const status = httpStatus(error);
    if (status === 401 || status === 403)
        return true;
    const msg = (error?.message || '').toLowerCase();
    return msg.includes('unauthorized') || msg.includes('forbidden');
}
export function isProtocolVersionError(error) {
    return error?.code === UNSUPPORTED_PROTOCOL_VERSION;
}
export function isInputRequiredError(error) {
    return error?.code === 'UNSUPPORTED_RESULT_TYPE' && error?.data?.resultType === 'input_required';
}
export function isTimeoutError(error) {
    return error?.code === 'REQUEST_TIMEOUT' || error?.code === -32001;
}
export function resolveCallTimeoutMs(raw, warn = () => { }) {
    if (raw === undefined || raw === null || String(raw).trim() === '')
        return DEFAULT_CALL_TIMEOUT_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        warn(`WARNING: Invalid ZIHIN_MCP_CALL_TIMEOUT_MS ("${raw}"); using the default of ${DEFAULT_CALL_TIMEOUT_MS} ms.`);
        return DEFAULT_CALL_TIMEOUT_MS;
    }
    const clamped = Math.min(Math.max(parsed, MIN_CALL_TIMEOUT_MS), MAX_CALL_TIMEOUT_MS);
    if (clamped !== parsed) {
        warn(`WARNING: ZIHIN_MCP_CALL_TIMEOUT_MS=${parsed} outside the range [${MIN_CALL_TIMEOUT_MS}, ${MAX_CALL_TIMEOUT_MS}] ms; clamped to ${clamped} ms. The unit is MILLISECONDS.`);
    }
    return clamped;
}
export function isConnectionError(error) {
    if (isAuthError(error) || isProtocolVersionError(error))
        return false;
    const status = httpStatus(error);
    if (status === 404 || status === 408 || status === 502 || status === 503 || status === 504)
        return true;
    const code = error?.code ?? error?.cause?.code;
    switch (code) {
        case 'ECONNREFUSED':
        case 'ENOTFOUND':
        case 'ECONNRESET':
        case 'EPIPE':
        case 'ETIMEDOUT':
        case 'UND_ERR_CONNECT_TIMEOUT':
        case 'UND_ERR_HEADERS_TIMEOUT':
        case 'UND_ERR_BODY_TIMEOUT':
        case 'UND_ERR_SOCKET':
        case 'CONNECTION_CLOSED':
        case 'SEND_FAILED':
        case 'REQUEST_TIMEOUT':
        case -32000:
        case -32001:
            return true;
    }
    const msg = (error?.message || '').toLowerCase();
    return (msg.includes('fetch failed') ||
        msg.includes('econnrefused') ||
        msg.includes('enotfound') ||
        msg.includes('econnreset') ||
        msg.includes('socket hang up') ||
        msg.includes('network') ||
        msg.includes('abort'));
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function log(message) {
    try {
        writeSync(2, message + '\n');
    }
    catch {
    }
}
