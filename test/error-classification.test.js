import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAuthError, isConnectionError, isInputRequiredError, isProtocolVersionError, isTimeoutError, resolveCallTimeoutMs, } from '../src/index.js';
function err(message, props = {}) {
    return Object.assign(new Error(message), props);
}
describe('isAuthError', () => {
    it('detects 401/403 numeric codes', () => {
        assert.ok(isAuthError(err('Error POSTing to endpoint: {"error":"unauthorized"}', { code: 401 })));
        assert.ok(isAuthError(err('Forbidden', { code: 403 })));
    });
    it('detects 401/403 in data.status', () => {
        assert.ok(isAuthError(err('HTTP error', { data: { status: 401 } })));
        assert.ok(isAuthError(err('HTTP error', { data: { status: 403 } })));
    });
    it('does not classify other HTTP statuses as authentication errors', () => {
        assert.ok(!isAuthError(err('Not found', { code: 404 })));
        assert.ok(!isAuthError(err('Server error', { code: 500 })));
        assert.ok(!isAuthError(err('HTTP error', { data: { status: 429 } })));
    });
    it('recognizes unauthorized and forbidden messages without a code', () => {
        assert.ok(isAuthError(err('Request failed: Unauthorized')));
        assert.ok(isAuthError(err('403 Forbidden at gateway')));
    });
    it('a remote tool mentioning API Key is not a fatal authentication error', () => {
        assert.ok(!isAuthError(err('Tool failed: configure the tenant API Key in the console')));
        assert.ok(!isAuthError(err('invalid api key format in tool arguments')));
    });
    it('handles null, empty and message-free errors', () => {
        assert.ok(!isAuthError(null));
        assert.ok(!isAuthError(undefined));
        assert.ok(!isAuthError({}));
    });
    it('ignores string status codes without a matching authentication message', () => {
        assert.ok(!isAuthError(err('arbitrary error', { code: '401' })));
        assert.ok(!isAuthError(err('arbitrary error', { data: { status: '401' } })));
    });
});
describe('isProtocolVersionError', () => {
    it('detects UnsupportedProtocolVersion (-32022)', () => {
        assert.ok(isProtocolVersionError(err('protocol version not supported', { code: -32022 })));
    });
    it('does not confuse other JSON-RPC codes', () => {
        assert.ok(!isProtocolVersionError(err('closed', { code: -32000 })));
        assert.ok(!isProtocolVersionError(err('invalid params', { code: -32602 })));
        assert.ok(!isProtocolVersionError(err('without code')));
    });
});
describe('isInputRequiredError', () => {
    const inputRequired = () => err("Unsupported result type 'input_required' for tools/call", {
        code: 'UNSUPPORTED_RESULT_TYPE',
        data: { resultType: 'input_required', method: 'tools/call' },
    });
    it('detects input_required in manual mode', () => {
        assert.ok(isInputRequiredError(inputRequired()));
    });
    it('does not classify other unsupported result types', () => {
        assert.ok(!isInputRequiredError(err("Unsupported result type 'new_result' for tools/call", {
            code: 'UNSUPPORTED_RESULT_TYPE',
            data: { resultType: 'new_result', method: 'tools/call' },
        })));
    });
    it('requires the matching code and result type', () => {
        assert.ok(!isInputRequiredError(err('closed', { code: 'CONNECTION_CLOSED' })));
        assert.ok(!isInputRequiredError(err('without data', { code: 'UNSUPPORTED_RESULT_TYPE' })));
        assert.ok(!isInputRequiredError(null));
    });
    it('input_required is neither a connection error nor a fatal error', () => {
        assert.ok(!isConnectionError(inputRequired()));
        assert.ok(!isAuthError(inputRequired()));
        assert.ok(!isProtocolVersionError(inputRequired()));
    });
});
describe('isConnectionError', () => {
    it('detects network error codes', () => {
        for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT']) {
            assert.ok(isConnectionError(err('net fail', { code })), `code ${code}`);
        }
    });
    it('detects a code nested in the cause', () => {
        assert.ok(isConnectionError(err('fetch failed', { cause: err('connect', { code: 'ECONNREFUSED' }) })));
    });
    it('detects SDK string codes and JSON-RPC numeric codes', () => {
        for (const code of ['CONNECTION_CLOSED', 'SEND_FAILED', 'REQUEST_TIMEOUT', -32000, -32001]) {
            assert.ok(isConnectionError(err('conn fail', { code })), `code ${code}`);
        }
    });
    it('does not reconnect on authentication or protocol-version errors', () => {
        assert.ok(!isConnectionError(err('unauthorized', { code: 401 })));
        assert.ok(!isConnectionError(err('forbidden', { data: { status: 403 } })));
        assert.ok(!isConnectionError(err('unsupported', { code: -32022 })));
    });
    it('does not infer connection loss from unrelated session messages', () => {
        assert.ok(!isConnectionError(err('session terminated by server')));
        assert.ok(!isConnectionError(err('HTTP 404 Not Found')));
    });
    it('recognizes network messages without a code', () => {
        assert.ok(isConnectionError(err('fetch failed')));
        assert.ok(isConnectionError(err('socket hang up')));
        assert.ok(isConnectionError(err('The operation was aborted')));
    });
    it('recognizes transient gateway HTTP statuses', () => {
        for (const status of [404, 408, 502, 503, 504]) {
            assert.ok(isConnectionError(err('gateway HTML', { code: status })), `v1 code ${status}`);
            assert.ok(isConnectionError(err('gateway HTML', { data: { status } })), `v2 data.status ${status}`);
        }
        assert.ok(!isConnectionError(err('Internal Server Error', { code: 500 })));
    });
    it('handles null and empty errors', () => {
        assert.ok(!isConnectionError(null));
        assert.ok(!isConnectionError({}));
    });
});
describe('isTimeoutError', () => {
    it('detects REQUEST_TIMEOUT and -32001', () => {
        assert.ok(isTimeoutError(err('Request timed out', { code: 'REQUEST_TIMEOUT', data: { timeout: 300000 } })));
        assert.ok(isTimeoutError(err('Request timed out', { code: -32001 })));
    });
    it('distinguishes timeouts from connection and fatal errors', () => {
        assert.ok(!isTimeoutError(err('closed', { code: 'CONNECTION_CLOSED' })));
        assert.ok(!isTimeoutError(err('unauthorized', { code: 401 })));
        assert.ok(!isTimeoutError(err('gateway timeout', { code: 504 })));
        assert.ok(!isTimeoutError(null));
    });
    it('classifies timeouts as connection errors for keepalive probes', () => {
        assert.ok(isConnectionError(err('Request timed out', { code: 'REQUEST_TIMEOUT' })));
    });
});
describe('resolveCallTimeoutMs', () => {
    const DEFAULT = 300000;
    it('uses a 300s default above the server deadline', () => {
        assert.equal(resolveCallTimeoutMs(undefined), DEFAULT);
        assert.equal(resolveCallTimeoutMs(''), DEFAULT);
        assert.equal(resolveCallTimeoutMs(null), DEFAULT);
        assert.ok(DEFAULT > 240000, 'the server must be able to return TURN_TIMEOUT first');
    });
    it('accepts valid numeric overrides', () => {
        assert.equal(resolveCallTimeoutMs('600000'), 600000);
        assert.equal(resolveCallTimeoutMs(90000), 90000);
    });
    it('clamps values below one second and warns about units', () => {
        const warnings = [];
        const warn = (m) => warnings.push(m);
        assert.equal(resolveCallTimeoutMs('300', warn), 1000);
        assert.ok(warnings[0].includes('MILLISECONDS'), 'the warning must state the unit');
    });
    it('clamps the maximum to avoid timer overflow', () => {
        const warnings = [];
        const warn = (m) => warnings.push(m);
        assert.equal(resolveCallTimeoutMs('999999999999', warn), 1800000);
        assert.equal(resolveCallTimeoutMs(String(2 ** 31), warn), 1800000);
        assert.equal(warnings.length, 2);
    });
    it('uses the default and warns for invalid values', () => {
        const warnings = [];
        const warn = (m) => warnings.push(m);
        for (const raw of ['abc', '0', '-1', 'NaN']) {
            assert.equal(resolveCallTimeoutMs(raw, warn), DEFAULT, `raw ${raw}`);
        }
        assert.equal(warnings.length, 4, 'every invalid value must produce a warning');
        assert.ok(warnings[0].includes('ZIHIN_MCP_CALL_TIMEOUT_MS'));
    });
});
