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

import { isAuthError, isConnectionError, isInputRequiredError, isProtocolVersionError } from '../src/index.js';

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

  it('sobrevive a erro nulo/vazio/sem message', () => {
    assert.ok(!isAuthError(null));
    assert.ok(!isAuthError(undefined));
    assert.ok(!isAuthError({}));
  });

  it('code string "401" NÃO classifica (decisão: código é numérico; fallback de mensagem cobre)', () => {
    // Documenta a decisão: httpStatus() exige número. Um '401' string só
    // seria auth se a mensagem trouxesse unauthorized/forbidden.
    assert.ok(!isAuthError(err('erro qualquer', { code: '401' })));
    assert.ok(!isAuthError(err('erro qualquer', { data: { status: '401' } })));
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

describe('isInputRequiredError', () => {
  // Forma real do SDK v2 em modo manual (inputRequired.autoFulfill: false):
  // SdkError UNSUPPORTED_RESULT_TYPE com data = { resultType, method }.
  const inputRequired = () =>
    err("Unsupported result type 'input_required' for tools/call", {
      code: 'UNSUPPORTED_RESULT_TYPE',
      data: { resultType: 'input_required', method: 'tools/call' },
    });

  it('detecta o input_required do modo manual (dialeto 2026-07-28)', () => {
    assert.ok(isInputRequiredError(inputRequired()));
  });

  it('outros resultType desconhecidos NÃO classificam (mensagem genérica do SDK basta)', () => {
    assert.ok(!isInputRequiredError(err("Unsupported result type 'algo_novo' for tools/call", {
      code: 'UNSUPPORTED_RESULT_TYPE',
      data: { resultType: 'algo_novo', method: 'tools/call' },
    })));
  });

  it('não confunde com erros de conexão nem com code solto', () => {
    assert.ok(!isInputRequiredError(err('closed', { code: 'CONNECTION_CLOSED' })));
    assert.ok(!isInputRequiredError(err('sem data', { code: 'UNSUPPORTED_RESULT_TYPE' })));
    assert.ok(!isInputRequiredError(null));
  });

  it('input_required NÃO é erro de conexão nem fatal (não reconecta, não derruba)', () => {
    assert.ok(!isConnectionError(inputRequired()));
    assert.ok(!isAuthError(inputRequired()));
    assert.ok(!isProtocolVersionError(inputRequired()));
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

  it('REGRESSÃO: sem heurísticas de STRING da era session-based', () => {
    // O que morreu foi o casamento de substring na mensagem ('session',
    // '404') — induzível por texto arbitrário. Um 404 REAL (código numérico,
    // vindo do transporte) é transitório de LB/deploy e continua recuperável
    // — ver teste de status HTTP abaixo.
    assert.ok(!isConnectionError(err('session terminated by server')));
    assert.ok(!isConnectionError(err('HTTP 404 Not Found'))); // string na msg não basta
  });

  it('fallback por mensagem para rede sem código', () => {
    assert.ok(isConnectionError(err('fetch failed')));
    assert.ok(isConnectionError(err('socket hang up')));
    assert.ok(isConnectionError(err('The operation was aborted')));
  });

  it('status HTTP transitórios de LB/CDN/deploy são recuperáveis', () => {
    // Substitui de forma principiada o antigo casamento da string '404':
    // janela de deploy (404), nginx (502), Cloudflare (503), gateway (504).
    for (const status of [404, 408, 502, 503, 504]) {
      assert.ok(isConnectionError(err('html do LB', { code: status })), `v1 code ${status}`);
      assert.ok(isConnectionError(err('html do LB', { data: { status } })), `v2 data.status ${status}`);
    }
    // 500 do próprio server não é transitório de infra — propaga ao host.
    assert.ok(!isConnectionError(err('Internal Server Error', { code: 500 })));
  });

  it('sobrevive a erro nulo/vazio', () => {
    assert.ok(!isConnectionError(null));
    assert.ok(!isConnectionError({}));
  });
});
