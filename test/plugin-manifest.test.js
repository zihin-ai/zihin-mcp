import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const pkg = json('package.json');
test('package, server and plugin versions match', () => {
    const server = json('server.json');
    assert.equal(server.version, pkg.version);
    assert.equal(server.packages[0].version, pkg.version);
    assert.equal(json('plugin/.claude-plugin/plugin.json').version, pkg.version);
});
test('plugin pins the exact package version', () => {
    const { args } = json('plugin/.mcp.json').mcpServers.zihin;
    assert.ok(args.includes(`${pkg.name}@${pkg.version}`), `esperado ${pkg.name}@${pkg.version} em ${JSON.stringify(args)}`);
});
test('plugin README includes at least 40 words outside code blocks', () => {
    const readme = readFileSync(new URL('plugin/README.md', root), 'utf8');
    const prosa = readme.replace(/```[\s\S]*?```/g, '');
    assert.ok(prosa.split(/\s+/).filter(Boolean).length >= 40);
});
