// Coerencia dos manifests do plugin Claude Code — sem rede.
// O diretorio da Anthropic bloqueia launcher sem versao exata, entao o pin do
// plugin/.mcp.json e obrigatorio e precisa acompanhar a versao do pacote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const json = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

const pkg = json('package.json');

test('versoes coerentes: package.json, server.json e plugin.json', () => {
  const server = json('server.json');
  assert.equal(server.version, pkg.version);
  assert.equal(server.packages[0].version, pkg.version);
  assert.equal(json('plugin/.claude-plugin/plugin.json').version, pkg.version);
});

test('plugin/.mcp.json fixa o proxy na versao exata do pacote', () => {
  const { args } = json('plugin/.mcp.json').mcpServers.zihin;
  assert.ok(args.includes(`${pkg.name}@${pkg.version}`), `esperado ${pkg.name}@${pkg.version} em ${JSON.stringify(args)}`);
});

test('plugin tem README com pelo menos 40 palavras fora de blocos de codigo', () => {
  const readme = readFileSync(new URL('plugin/README.md', root), 'utf8');
  const prosa = readme.replace(/```[\s\S]*?```/g, '');
  assert.ok(prosa.split(/\s+/).filter(Boolean).length >= 40);
});
