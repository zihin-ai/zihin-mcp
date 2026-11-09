import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'zihin-mcp.js');
const API_KEY = process.env.ZIHIN_API_KEY;
const STDIO_PROTOCOL_VERSION = '2025-03-26';
if (!API_KEY) {
    if (process.env.REQUIRE_INTEGRATION) {
        console.error('ZIHIN_API_KEY is required when REQUIRE_INTEGRATION=1.');
        process.exit(1);
    }
    console.error('ZIHIN_API_KEY is not set; skipping live integration tests.');
    process.exit(0);
}
function sendRequest(proc, method, params = {}, id = 1, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        let buffer = '';
        let settled = false;
        const timeout = setTimeout(() => finish(new Error(`Timed out waiting for a response from "${method}"`)), timeoutMs);
        function finish(error, value) {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            proc.stdout.removeListener('data', onData);
            proc.removeListener('exit', onExit);
            error ? reject(error) : resolve(value);
        }
        function onData(chunk) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            for (const line of lines) {
                if (!line.trim())
                    continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.id === id) {
                        finish(null, parsed);
                        return;
                    }
                }
                catch {
                }
            }
            buffer = lines[lines.length - 1];
        }
        function onExit(code, signal) {
            const message = `Proxy exited during "${method}" (code=${code}, signal=${signal}) — no response received.`;
            console.error(message);
            finish(new Error(message));
        }
        proc.stdout.on('data', onData);
        proc.once('exit', onExit);
        const request = JSON.stringify({ jsonrpc: '2.0', id, method, params });
        proc.stdin.write(request + '\n');
    });
}
function formatStderr(stderrBuf) {
    const trimmed = stderrBuf.trim().replace(/API Key: \.\.\..+/g, 'API Key: [redacted]');
    return trimmed ? `\n--- proxy stderr ---\n${trimmed}\n-----------------------` : '';
}
function spawnProxy(env = {}) {
    const proc = spawn('node', [BIN], {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    return proc;
}
describe('API key validation', () => {
    it('fails without ZIHIN_API_KEY', async () => {
        const proc = spawn('node', [BIN], {
            env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_PATH: process.env.NODE_PATH },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const code = await new Promise((resolve) => {
            proc.on('close', resolve);
        });
        assert.equal(code, 1, 'must exit with code 1');
    });
    it('fails with an invalid API key prefix', async () => {
        const proc = spawnProxy({ ZIHIN_API_KEY: 'invalid_key_123' });
        let stderr = '';
        proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        const code = await new Promise((resolve) => {
            proc.on('close', resolve);
        });
        assert.equal(code, 1);
        assert.ok(stderr.includes('zhn_live_'), 'must mention valid prefixes');
    });
    it('fails with a valid prefix but an invalid server credential', async () => {
        const proc = spawnProxy({ ZIHIN_API_KEY: 'zhn_live_invalid123' });
        let stderr = '';
        proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        const code = await new Promise((resolve) => {
            proc.on('close', resolve);
        });
        assert.equal(code, 1);
        assert.ok(stderr.includes('Check that the API key is valid and active.'), `must classify as an authentication error. stderr:\n${stderr}`);
    });
});
describe('proxy stdio ↔ HTTP', () => {
    let proc;
    let requestId = 0;
    function request(method, params = {}, timeoutMs = 15000) {
        return sendRequest(proc, method, params, ++requestId, timeoutMs);
    }
    let bootStderr = '';
    before(async () => {
        proc = spawnProxy({ ZIHIN_API_KEY: API_KEY });
        proc.stderr.on('data', (chunk) => { bootStderr += chunk.toString(); });
        const initResult = await request('initialize', {
            protocolVersion: STDIO_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'test-runner', version: '1.0.0' },
        }, 30000).catch((error) => {
            throw new Error(`${error.message}${formatStderr(bootStderr)}`, { cause: error });
        });
        assert.ok(initResult.result, 'initialize returns a result');
        assert.ok(initResult.result.serverInfo, 'serverInfo is present');
        assert.equal(initResult.result.serverInfo.name, 'zihin-builder', 'identity mirrors the upstream');
        proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    });
    after(async () => {
        if (proc && !proc.killed) {
            proc.kill('SIGTERM');
            await new Promise((resolve) => proc.on('close', resolve));
        }
    });
    describe('tools', () => {
        it('tools/list returns server tools', async () => {
            const res = await request('tools/list', {});
            assert.ok(res.result, 'result is present');
            assert.ok(Array.isArray(res.result.tools), 'tools is an array');
            assert.ok(res.result.tools.length >= 60, `expected at least 60 tools, received ${res.result.tools.length}`);
        });
        it('each tool includes name, description and inputSchema', async () => {
            const res = await request('tools/list', {});
            for (const tool of res.result.tools) {
                assert.ok(tool.name, `tool without name: ${JSON.stringify(tool)}`);
                assert.ok(tool.description, `tool "${tool.name}" without description`);
                assert.ok(tool.inputSchema, `tool "${tool.name}" without inputSchema`);
                assert.equal(typeof tool.inputSchema, 'object', `inputSchema of "${tool.name}" must be a JSON Schema object`);
            }
        });
        it('tools/call list_published_agents returns data', async () => {
            const res = await request('tools/call', {
                name: 'list_published_agents',
                arguments: {},
            });
            assert.ok(res.result, 'result is present');
            assert.ok(Array.isArray(res.result.content), 'content is an array');
            assert.equal(res.result.content[0].type, 'text');
            const data = JSON.parse(res.result.content[0].text);
            assert.equal(data.success, true, 'success is true');
            assert.ok(Array.isArray(data.agents), 'agents is an array');
        });
        it('tools/call chat_with_agent starts a session and returns a response', async () => {
            const agentsRes = await request('tools/call', {
                name: 'list_published_agents',
                arguments: {},
            });
            const agentsData = JSON.parse(agentsRes.result.content[0].text);
            assert.ok(agentsData.agents.length > 0, 'at least one published agent is required');
            const agentId = agentsData.agents[0].id;
            const r1 = await request('tools/call', {
                name: 'chat_with_agent',
                arguments: {
                    agent_id: agentId,
                    message: 'Respond only: "ok"',
                },
            }, 180000);
            assert.ok(r1.result, 'result is present');
            assert.ok(!r1.result.isError, 'must not contain an error');
            const d1 = JSON.parse(r1.result.content[0].text);
            assert.ok(d1.session_id, 'returns session_id');
            assert.ok(d1.response, 'returns a response');
            assert.ok(d1.execution_id, 'successful execution includes execution_id');
            if ('cancelled' in d1) {
                assert.equal(typeof d1.cancelled, 'boolean', 'cancelled is a boolean');
                assert.equal(d1.cancelled, false, 'completed turns are not cancelled');
            }
            for (const field of ['tools_used', 'tool_calls']) {
                if (field in d1)
                    assert.ok(Array.isArray(d1[field]), `${field} must be an array`);
            }
            const r2 = await request('tools/call', {
                name: 'chat_with_agent',
                arguments: {
                    agent_id: agentId,
                    message: 'What was my previous message?',
                    session_id: d1.session_id,
                },
            }, 180000);
            assert.ok(r2.result, 'result is present');
            const d2 = JSON.parse(r2.result.content[0].text);
            assert.equal(d2.session_id, d1.session_id, 'session_id is retained');
            assert.ok(d2.response, 'returns a response to the second message');
        });
        it('tools/list preserves valid UTF-8', async () => {
            const res = await request('tools/list', {});
            const payload = JSON.stringify(res.result.tools);
            assert.ok(!payload.includes('\uFFFD'), 'payload contains the Unicode replacement character');
        });
        it('chat_with_agent description is not truncated', async () => {
            const res = await request('tools/list', {});
            const chat = res.result.tools.find(t => t.name === 'chat_with_agent');
            assert.ok(chat, 'chat_with_agent is present');
            assert.ok(chat.description.length >= 200, `description is too short (${chat.description.length} chars); possible truncation`);
            assert.ok(!/(\u2026|\.\.\.)$/.test(chat.description.trim()), 'description ends in an ellipsis and may be truncated');
        });
        it('tools/call timeout exceeds server execution deadlines', () => {
            const m = bootStderr.match(/tools\/call timeout: (\d+)s/);
            assert.ok(m, `startup diagnostics must announce the tools/call timeout.${formatStderr(bootStderr)}`);
            assert.ok(Number(m[1]) >= 240, `timeout of ${m[1]}s does not cover the server asynchronous execution deadline`);
        });
        it('calling an unknown tool returns an error', async () => {
            const res = await request('tools/call', {
                name: 'nonexistent_tool_xyz',
                arguments: {},
            });
            assert.ok(res.result || res.error, 'result or error is present');
            if (res.result) {
                assert.equal(res.result.isError, true);
            }
        });
    });
    describe('resources', () => {
        it('resources/list exposes catalogs, schemas and skills', async () => {
            const res = await request('resources/list', {});
            assert.ok(res.result, 'result is present');
            assert.ok(Array.isArray(res.result.resources), 'resources is an array');
            const uris = res.result.resources.map(r => r.uri);
            for (const uri of ['zihin://models', 'zihin://agents', 'zihin://schema-templates']) {
                assert.ok(uris.includes(uri), `must include ${uri}`);
            }
            const schemas = uris.filter(u => u.startsWith('zihin://schemas/'));
            const skills = uris.filter(u => u.startsWith('zihin://skills/'));
            assert.ok(schemas.length >= 10, `expected at least 10 formal schemas, received ${schemas.length}`);
            assert.ok(skills.length >= 6, `expected at least 6 skills, received ${skills.length}`);
            const baseResources = uris.filter(u => !u.startsWith('zihin://schemas/') && !u.startsWith('zihin://skills/'));
            assert.deepEqual(baseResources.sort(), ['zihin://agents', 'zihin://models', 'zihin://schema-templates'], 'unexpected resource category outside schemas/ and skills/');
        });
        it('each resource includes name, uri and description', async () => {
            const res = await request('resources/list', {});
            for (const r of res.result.resources) {
                assert.ok(r.name, 'resource without name');
                assert.ok(r.uri, 'resource without URI');
                assert.ok(r.uri.startsWith('zihin://'), `URI must start with zihin://; received: ${r.uri}`);
                assert.ok(r.description, `resource "${r.name}" without description`);
            }
        });
        it('resources/read zihin://models returns the model catalog', async () => {
            const res = await request('resources/read', {
                uri: 'zihin://models',
            });
            assert.ok(res.result, 'result is present');
            assert.ok(Array.isArray(res.result.contents), 'contents is an array');
            assert.equal(res.result.contents[0].uri, 'zihin://models');
            const data = JSON.parse(res.result.contents[0].text);
            assert.ok(data.count > 0, 'models are present');
            assert.ok(Array.isArray(data.models), 'models is an array');
            assert.ok(data.models[0].model, 'model identifier is present');
            assert.ok(data.models[0].display_name, 'model display_name is present');
        });
        it('resources/read zihin://agents returns the agent list', async () => {
            const res = await request('resources/read', {
                uri: 'zihin://agents',
            });
            assert.ok(res.result, 'result is present');
            const data = JSON.parse(res.result.contents[0].text);
            assert.ok(Array.isArray(data.agents), 'agents is an array');
        });
        it('resources/read zihin://schema-templates returns templates', async () => {
            const res = await request('resources/read', {
                uri: 'zihin://schema-templates',
            });
            assert.ok(res.result, 'result is present');
            assert.ok(res.result.contents[0].text.length > 100, 'content is substantial');
        });
    });
    describe('prompts', () => {
        it('prompts/list exposes known prompts', async () => {
            const res = await request('prompts/list', {});
            assert.ok(res.result, 'result is present');
            assert.ok(Array.isArray(res.result.prompts), 'prompts is an array');
            const names = res.result.prompts.map(p => p.name);
            for (const name of ['setup-agent', 'add-tool', 'configure-webhook']) {
                assert.ok(names.includes(name), `must include prompt "${name}"`);
            }
        });
        it('each prompt includes name, description and arguments', async () => {
            const res = await request('prompts/list', {});
            for (const p of res.result.prompts) {
                assert.ok(p.name, 'prompt without name');
                assert.ok(p.description, `prompt "${p.name}" without description`);
                assert.ok(Array.isArray(p.arguments), `prompt "${p.name}" without arguments`);
            }
        });
        it('prompts/get setup-agent returns templated messages', async () => {
            const res = await request('prompts/get', {
                name: 'setup-agent',
                arguments: { name: 'test-bot' },
            });
            assert.ok(res.result, 'result is present');
            assert.ok(Array.isArray(res.result.messages), 'messages is an array');
            assert.ok(res.result.messages.length > 0, 'at least one message is present');
            assert.equal(res.result.messages[0].role, 'user');
            assert.ok(res.result.messages[0].content.text.includes('test-bot'), 'message includes the supplied agent name');
        });
        it('prompts/get add-tool succeeds', async () => {
            const res = await request('prompts/get', {
                name: 'add-tool',
                arguments: {
                    agent_id: '00000000-0000-0000-0000-000000000000',
                    tool_type: 'api_config',
                },
            });
            assert.ok(res.result, 'result is present');
            assert.ok(res.result.messages.length > 0);
        });
    });
    describe('MCP protocol', () => {
        it('serverInfo mirrors upstream identity and the proxy version', async () => {
            const res = await request('initialize', {
                protocolVersion: STDIO_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: { name: 'test-protocol', version: '1.0.0' },
            });
            const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
            assert.equal(res.result.serverInfo.name, 'zihin-builder', 'name mirrors the server');
            assert.ok(res.result.serverInfo.title, 'title mirrors the server');
            assert.equal(res.result.serverInfo.version, pkg.version, 'version matches the proxy');
        });
        it('server instructions reach the local host', async () => {
            const res = await request('initialize', {
                protocolVersion: STDIO_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: { name: 'test-instructions', version: '1.0.0' },
            });
            const instructions = res.result.instructions;
            assert.equal(typeof instructions, 'string', 'instructions is a string');
            assert.ok(instructions.length > 100, `substantial instructions (received ${instructions?.length ?? 0} chars)`);
        });
        it('capabilities declares tools, resources and prompts', async () => {
            const res = await request('initialize', {
                protocolVersion: STDIO_PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: { name: 'test-caps', version: '1.0.0' },
            });
            const caps = res.result.capabilities;
            assert.ok(caps.tools, 'tools capability is declared');
            assert.ok(caps.resources, 'resources capability is declared');
            assert.ok(caps.prompts, 'prompts capability is declared');
        });
    });
});
