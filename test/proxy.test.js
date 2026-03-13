/**
 * Testes do @zihin/mcp-server
 *
 * Valida o proxy stdio ↔ HTTP contra o server real em produção.
 *
 * Requer: ZIHIN_API_KEY definida com key válida.
 * Uso:    ZIHIN_API_KEY=zhn_live_xxx node --test test/proxy.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(__dirname, '..', 'bin', 'zihin-mcp.js');
const API_KEY = process.env.ZIHIN_API_KEY;

if (!API_KEY) {
  console.error('ZIHIN_API_KEY não definida — pulando testes de integração.');
  process.exit(0);
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Envia uma JSON-RPC request via stdin do processo proxy e aguarda a response.
 */
function sendRequest(proc, method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout aguardando resposta de "${method}"`)), 15000);

    let buffer = '';

    function onData(chunk) {
      buffer += chunk.toString();

      // JSON-RPC responses são delimitadas por newline
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === id) {
            clearTimeout(timeout);
            proc.stdout.removeListener('data', onData);
            resolve(parsed);
            return;
          }
        } catch {
          // Linha incompleta, continua acumulando
        }
      }
      // Manter apenas a última linha (possivelmente incompleta)
      buffer = lines[lines.length - 1];
    }

    proc.stdout.on('data', onData);

    const request = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    proc.stdin.write(request + '\n');
  });
}

/**
 * Aguarda o proxy ficar pronto (banner "Pronto!" no stderr).
 */
function waitForReady(proc) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout aguardando proxy ficar pronto')), 20000);
    let stderrBuf = '';

    function onData(chunk) {
      stderrBuf += chunk.toString();
      if (stderrBuf.includes('Pronto!')) {
        clearTimeout(timeout);
        proc.stderr.removeListener('data', onData);
        resolve(stderrBuf);
      }
    }

    proc.stderr.on('data', onData);
  });
}

/**
 * Spawna o processo proxy.
 */
function spawnProxy(env = {}) {
  return spawn('node', [BIN], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// ─── Testes de validação (sem conexão) ──────────────────────────────

describe('validação de API Key', () => {
  it('deve falhar sem ZIHIN_API_KEY', async () => {
    const proc = spawn('node', [BIN], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_PATH: process.env.NODE_PATH },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const code = await new Promise((resolve) => {
      proc.on('close', resolve);
    });

    assert.equal(code, 1, 'deve sair com código 1');
  });

  it('deve falhar com API Key de prefixo inválido', async () => {
    const proc = spawn('node', [BIN], {
      env: { ...process.env, ZIHIN_API_KEY: 'invalid_key_123' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const code = await new Promise((resolve) => {
      proc.on('close', resolve);
    });

    assert.equal(code, 1);
    assert.ok(stderr.includes('zhn_live_'), 'deve mencionar prefixos válidos');
  });

  it('deve falhar com API Key de prefixo válido mas inválida no server', async () => {
    const proc = spawn('node', [BIN], {
      env: { ...process.env, ZIHIN_API_KEY: 'zhn_live_invalida123' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const code = await new Promise((resolve) => {
      proc.on('close', resolve);
    });

    assert.equal(code, 1);
    assert.ok(stderr.includes('Falha ao conectar') || stderr.includes('ERRO'), 'deve reportar erro de conexão');
  });
});

// ─── Testes de integração (proxy real) ──────────────────────────────

describe('proxy stdio ↔ HTTP', () => {
  let proc;
  let requestId = 0;

  /** Envia request com ID auto-incrementado. */
  function request(method, params = {}) {
    return sendRequest(proc, method, params, ++requestId);
  }

  before(async () => {
    proc = spawnProxy({ ZIHIN_API_KEY: API_KEY });
    await waitForReady(proc);

    // MCP exige initialize handshake antes de qualquer request
    const initResult = await request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test-runner', version: '1.0.0' },
    });

    assert.ok(initResult.result, 'initialize deve retornar result');
    assert.ok(initResult.result.serverInfo, 'deve ter serverInfo');
    assert.equal(initResult.result.serverInfo.name, 'zihin-mcp-proxy');

    // Enviar initialized notification (sem id)
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  });

  after(async () => {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
      await new Promise((resolve) => proc.on('close', resolve));
    }
  });

  // ── Tools ──

  describe('tools', () => {
    it('tools/list deve retornar tools do server', async () => {
      const res = await request('tools/list', {});
      assert.ok(res.result, 'deve ter result');
      assert.ok(Array.isArray(res.result.tools), 'tools deve ser array');
      assert.ok(res.result.tools.length >= 60, `esperado >= 60 tools, recebeu ${res.result.tools.length}`);
    });

    it('cada tool deve ter name, description e inputSchema', async () => {
      const res = await request('tools/list', {});
      for (const tool of res.result.tools) {
        assert.ok(tool.name, `tool sem name: ${JSON.stringify(tool)}`);
        assert.ok(tool.description, `tool "${tool.name}" sem description`);
        assert.ok(tool.inputSchema, `tool "${tool.name}" sem inputSchema`);
        assert.equal(tool.inputSchema.type, 'object', `inputSchema de "${tool.name}" deve ser type: object`);
      }
    });

    it('tools/call list_published_agents deve retornar dados', async () => {
      const res = await request('tools/call', {
        name: 'list_published_agents',
        arguments: {},
      });

      assert.ok(res.result, 'deve ter result');
      assert.ok(Array.isArray(res.result.content), 'content deve ser array');
      assert.equal(res.result.content[0].type, 'text');

      const data = JSON.parse(res.result.content[0].text);
      assert.equal(data.success, true, 'success deve ser true');
      assert.ok(Array.isArray(data.agents), 'agents deve ser array');
    });

    it('tools/call chat_with_agent deve iniciar sessão e receber resposta', async () => {
      // Descobrir um agente publicado para usar no teste
      const agentsRes = await request('tools/call', {
        name: 'list_published_agents',
        arguments: {},
      });
      const agentsData = JSON.parse(agentsRes.result.content[0].text);
      assert.ok(agentsData.agents.length > 0, 'deve ter pelo menos 1 agente publicado');

      const agentId = agentsData.agents[0].id;

      // Mensagem 1 — nova sessão
      const r1 = await request('tools/call', {
        name: 'chat_with_agent',
        arguments: {
          agent_id: agentId,
          message: 'Responda apenas: "ok"',
        },
      });

      assert.ok(r1.result, 'deve ter result');
      assert.ok(!r1.result.isError, 'não deve ter erro');
      const d1 = JSON.parse(r1.result.content[0].text);
      assert.ok(d1.session_id, 'deve retornar session_id');
      assert.ok(d1.response, 'deve retornar response');

      // Mensagem 2 — mesma sessão (continuidade de contexto)
      const r2 = await request('tools/call', {
        name: 'chat_with_agent',
        arguments: {
          agent_id: agentId,
          message: 'Qual foi minha mensagem anterior?',
          session_id: d1.session_id,
        },
      });

      assert.ok(r2.result, 'deve ter result');
      const d2 = JSON.parse(r2.result.content[0].text);
      assert.equal(d2.session_id, d1.session_id, 'session_id deve ser mantido');
      assert.ok(d2.response, 'deve retornar response na segunda mensagem');
    });

    it('tools/call com tool inexistente deve retornar erro', async () => {
      const res = await request('tools/call', {
        name: 'tool_que_nao_existe_xyz',
        arguments: {},
      });

      assert.ok(res.result || res.error, 'deve ter result ou error');

      if (res.result) {
        // Proxy retorna isError: true
        assert.equal(res.result.isError, true);
      }
    });
  });

  // ── Resources ──

  describe('resources', () => {
    it('resources/list deve retornar 3 resources', async () => {
      const res = await request('resources/list', {});
      assert.ok(res.result, 'deve ter result');
      assert.ok(Array.isArray(res.result.resources), 'resources deve ser array');
      assert.equal(res.result.resources.length, 3);
    });

    it('cada resource deve ter name, uri e description', async () => {
      const res = await request('resources/list', {});
      for (const r of res.result.resources) {
        assert.ok(r.name, 'resource sem name');
        assert.ok(r.uri, 'resource sem uri');
        assert.ok(r.uri.startsWith('zihin://'), `uri deve começar com zihin:// — recebeu: ${r.uri}`);
        assert.ok(r.description, `resource "${r.name}" sem description`);
      }
    });

    it('resources/read zihin://models deve retornar catálogo de modelos', async () => {
      const res = await request('resources/read', {
        uri: 'zihin://models',
      });

      assert.ok(res.result, 'deve ter result');
      assert.ok(Array.isArray(res.result.contents), 'contents deve ser array');
      assert.equal(res.result.contents[0].uri, 'zihin://models');

      const data = JSON.parse(res.result.contents[0].text);
      assert.ok(data.count > 0, 'deve ter modelos');
      assert.ok(Array.isArray(data.models), 'models deve ser array');
      assert.ok(data.models[0].model, 'modelo deve ter campo model');
      assert.ok(data.models[0].display_name, 'modelo deve ter display_name');
    });

    it('resources/read zihin://agents deve retornar lista de agentes', async () => {
      const res = await request('resources/read', {
        uri: 'zihin://agents',
      });

      assert.ok(res.result, 'deve ter result');
      const data = JSON.parse(res.result.contents[0].text);
      assert.ok(Array.isArray(data.agents), 'agents deve ser array');
    });

    it('resources/read zihin://schema-templates deve retornar templates', async () => {
      const res = await request('resources/read', {
        uri: 'zihin://schema-templates',
      });

      assert.ok(res.result, 'deve ter result');
      assert.ok(res.result.contents[0].text.length > 100, 'deve ter conteúdo substancial');
    });
  });

  // ── Prompts ──

  describe('prompts', () => {
    it('prompts/list deve retornar 3 prompts', async () => {
      const res = await request('prompts/list', {});
      assert.ok(res.result, 'deve ter result');
      assert.ok(Array.isArray(res.result.prompts), 'prompts deve ser array');
      assert.equal(res.result.prompts.length, 3);
    });

    it('cada prompt deve ter name, description e arguments', async () => {
      const res = await request('prompts/list', {});
      for (const p of res.result.prompts) {
        assert.ok(p.name, 'prompt sem name');
        assert.ok(p.description, `prompt "${p.name}" sem description`);
        assert.ok(Array.isArray(p.arguments), `prompt "${p.name}" sem arguments`);
      }
    });

    it('prompts/get setup-agent deve retornar mensagens com template', async () => {
      const res = await request('prompts/get', {
        name: 'setup-agent',
        arguments: { name: 'test-bot' },
      });

      assert.ok(res.result, 'deve ter result');
      assert.ok(Array.isArray(res.result.messages), 'messages deve ser array');
      assert.ok(res.result.messages.length > 0, 'deve ter pelo menos 1 mensagem');
      assert.equal(res.result.messages[0].role, 'user');
      assert.ok(
        res.result.messages[0].content.text.includes('test-bot'),
        'mensagem deve conter o nome do agente passado como argumento',
      );
    });

    it('prompts/get add-tool deve funcionar', async () => {
      const res = await request('prompts/get', {
        name: 'add-tool',
        arguments: {
          agent_id: '00000000-0000-0000-0000-000000000000',
          tool_type: 'api_config',
        },
      });

      assert.ok(res.result, 'deve ter result');
      assert.ok(res.result.messages.length > 0);
    });
  });

  // ── MCP Protocol ──

  describe('protocolo MCP', () => {
    it('serverInfo deve conter name e version corretos', async () => {
      // Já validado no before(), mas testar novamente com nova request
      const res = await request('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test-protocol', version: '1.0.0' },
      });

      assert.equal(res.result.serverInfo.name, 'zihin-mcp-proxy');
      assert.equal(res.result.serverInfo.version, '1.1.0');
    });

    it('capabilities deve declarar tools, resources e prompts', async () => {
      const res = await request('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test-caps', version: '1.0.0' },
      });

      const caps = res.result.capabilities;
      assert.ok(caps.tools, 'deve declarar tools capability');
      assert.ok(caps.resources, 'deve declarar resources capability');
      assert.ok(caps.prompts, 'deve declarar prompts capability');
    });
  });
});
