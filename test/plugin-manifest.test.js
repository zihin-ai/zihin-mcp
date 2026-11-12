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
        assert.deepEqual(server.headers, { 'X-Api-Key': '${ZIHIN_API_KEY}' });
        for (const field of ['command', 'args', 'env', 'headersHelper']) {
            assert.equal(Object.hasOwn(server, field), false, `Unexpected local process setting: ${field}`);
        }
    }
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
