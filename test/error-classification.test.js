/**
 * Testes da classificação de erros do proxy (Fase 0 da issue #6).
 *
 * Sem rede: valida a semântica dos classificadores contra as formas de erro
 * reais dos dois SDKs — v1 (atual) e v2 (Fase 1) — para que a migração de
 * SDK não exija reescrever esta lógica.
 *
 * Formas cobertas:
 *   - SDK v1 StreamableHTTPError: error.code = status HTTP numérico
 *   - SDK v2 SdkHttpError:        error.data.status = status HTTP;
 *                                 error.code = string ('CONNECTION_CLOSED', ...)
 *   - McpError / ProtocolError:   error.code = JSON-RPC numérico (-32xxx)
 *   - Rede (undici):              error.code ou error.cause.code
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isAuthError, isConnectionError, isProtocolVersionError } from '../src/index.js';

/** Erro sintético com propriedades arbitrárias. */
function err(message, props = {}) {
  return Object.assign(new Error(message), props);
}

describe('isAuthError', () => {
  it('detecta 401/403 pelo code numérico (SDK v1 StreamableHTTPError)', () => {
    assert.ok(isAuthError(err('Error POSTing to endpoint: {"error":"unauthorized"}', { code: 401 })));
    assert.ok(isAuthError(err('Forbidden', { code: 403 })));
  });

  it('detecta 401/403 por data.status (SDK v2 SdkHttpError)', () => {
    assert.ok(isAuthError(err('HTTP error', { data: { status: 401 } })));
    assert.ok(isAuthError(err('HTTP error', { data: { status: 403 } })));
  });

  it('não classifica outros status HTTP como auth', () => {
    assert.ok(!isAuthError(err('Not found', { code: 404 })));
    assert.ok(!isAuthError(err('Server error', { code: 500 })));
    assert.ok(!isAuthError(err('HTTP error', { data: { status: 429 } })));
  });

  it('fallback por mensagem só para unauthorized/forbidden sem código', () => {
    assert.ok(isAuthError(err('Request failed: Unauthorized')));
    assert.ok(isAuthError(err('403 Forbidden at gateway')));
  });

  it('REGRESSÃO: erro de tool remota mencionando API Key NÃO é auth fatal', () => {
    // O classificador antigo casava 'api key' na mensagem: um erro de tool
    // de tenant como este derrubava o proxy inteiro com exit(1).
    assert.ok(!isAuthError(err('Tool failed: configure a API Key do tenant no painel')));
    assert.ok(!isAuthError(err('invalid api key format in tool arguments')));
  });
});

describe('isProtocolVersionError', () => {
  it('detecta -32022 (UnsupportedProtocolVersion, spec 2026-07-28)', () => {
    assert.ok(isProtocolVersionError(err('protocol version not supported', { code: -32022 })));
  });

  it('não confunde com outros códigos JSON-RPC', () => {
    assert.ok(!isProtocolVersionError(err('closed', { code: -32000 })));
    assert.ok(!isProtocolVersionError(err('invalid params', { code: -32602 })));
    assert.ok(!isProtocolVersionError(err('sem código')));
  });
});

describe('isConnectionError', () => {
  it('detecta erros de rede por code', () => {
    for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT']) {
      assert.ok(isConnectionError(err('net fail', { code })), `code ${code}`);
    }
  });

  it('detecta code embrulhado em cause (undici fetch failed)', () => {
    assert.ok(isConnectionError(err('fetch failed', { cause: err('connect', { code: 'ECONNREFUSED' }) })));
  });

  it('detecta códigos do SDK v2 (strings) e JSON-RPC (números)', () => {
    for (const code of ['CONNECTION_CLOSED', 'SEND_FAILED', 'REQUEST_TIMEOUT', -32000, -32001]) {
      assert.ok(isConnectionError(err('conn fail', { code })), `code ${code}`);
    }
  });

  it('auth e versão de protocolo NUNCA são erros de conexão (não reconectar)', () => {
    assert.ok(!isConnectionError(err('unauthorized', { code: 401 })));
    assert.ok(!isConnectionError(err('forbidden', { data: { status: 403 } })));
    assert.ok(!isConnectionError(err('unsupported', { code: -32022 })));
  });

  it('REGRESSÃO: sem heurísticas da era session-based', () => {
    // Com o server stateless não existe mais sessão para expirar, e um 404
    // real é endpoint errado — reconectar não conserta nenhum dos dois.
    assert.ok(!isConnectionError(err('session terminated by server')));
    assert.ok(!isConnectionError(err('HTTP 404 Not Found')));
    assert.ok(!isConnectionError(err('Not found', { code: 404 })));
  });

  it('fallback por mensagem para rede sem código', () => {
    assert.ok(isConnectionError(err('fetch failed')));
    assert.ok(isConnectionError(err('socket hang up')));
    assert.ok(isConnectionError(err('The operation was aborted')));
  });
});
