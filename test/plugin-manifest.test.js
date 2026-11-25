import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const pkg = json('package.json');
test('registry server versions match the npm package', () => {
    const server = json('server.json');
    assert.equal(server.version, pkg.version);
    assert.equal(server.packages[0].version, pkg.version);
});
test('plugin connects remotely without a local process or embedded credential', () => {
    const servers = Object.values(json('plugin/.mcp.json').mcpServers);
    assert.ok(servers.length > 0);
    for (const server of servers) {
        assert.equal(server.type, 'http');
        assert.equal(server.url, 'https://llm.zihin.ai/mcp');
        assert.deepEqual(server.headers, { 'X-Api-Key': '${user_config.api_key}' });
        for (const field of ['command', 'args', 'env', 'headersHelper']) {
            assert.equal(Object.hasOwn(server, field), false, `Unexpected local process setting: ${field}`);
        }
    }
});
test('plugin API key is optional and sensitive, so sign-in is the default', () => {
    const option = json('plugin/.claude-plugin/plugin.json').userConfig.api_key;
    assert.equal(option.type, 'string');
    assert.equal(option.required, false);
    assert.equal(option.sensitive, true);
    assert.ok(option.title && option.description);
    // An empty header makes the server answer with its sign-in challenge; a bundled key would not.
    // Cowork ignores a server whose referenced option has no default.
    assert.equal(option.default, '');
});
test('plugin server has no Authorization header, so the client can sign in', () => {
    for (const server of Object.values(json('plugin/.mcp.json').mcpServers)) {
        const names = Object.keys(server.headers || {}).map(h => h.toLowerCase());
        assert.equal(names.includes('authorization'), false);
        assert.equal(Object.hasOwn(server, 'oauth'), false, 'no fixed client: each assistant registers its own');
    }
});
test('plugin and package versions match', () => {
    assert.equal(json('plugin/.claude-plugin/plugin.json').version, pkg.version);
});
test('registry remote accepts sign-in and an optional API key', () => {
    const [remote] = json('server.json').remotes;
    assert.equal(remote.url, 'https://llm.zihin.ai/mcp');
    assert.ok(json('server.json').description.length <= 100, 'registry description limit');
    for (const header of remote.headers || []) assert.equal(header.isRequired, false, header.name);
});
test('plugin icon satisfies directory PNG dimensions and size limits', () => {
    const plugin = json('plugin/.claude-plugin/plugin.json');
    const icon = readFileSync(new URL(`plugin/${plugin.icon}`, root));
    assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(icon.subarray(12, 16).toString(), 'IHDR');
    const width = icon.readUInt32BE(16);
    assert.equal(width, icon.readUInt32BE(20));
    assert.ok(width >= 512 && width <= 2048);
    assert.ok(icon.length < 2 * 1024 * 1024);
});
test('plugin README includes at least 40 words outside code blocks', () => {
    const readme = readFileSync(new URL('plugin/README.md', root), 'utf8');
    const prose = readme.replace(/```[\s\S]*?```/g, '');
    assert.ok(prose.split(/\s+/).filter(Boolean).length >= 40);
});
