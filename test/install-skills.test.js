import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseSkill, toCursorRule, toWindsurfRule, toCodexIndexBlock, upsertCodexBlock, loadBundledSkills, } from '../src/install-skills.js';
const SAMPLE = `---
name: zihin-test
description: Test guide. Use when testing the skill installer.
---

# Skill body

Procedural instructions.
`;
test('parseSkill extracts frontmatter and body', () => {
    const s = parseSkill(SAMPLE);
    assert.equal(s.name, 'zihin-test');
    assert.match(s.description, /Use when/);
    assert.match(s.body, /^# Skill body/);
    assert.ok(!s.body.includes('---'), 'body excludes frontmatter');
});
test('parseSkill accepts files without frontmatter', () => {
    const s = parseSkill('# Body only\n');
    assert.equal(s.name, 'zihin-skill');
    assert.equal(s.description, '');
    assert.match(s.body, /^# Body only/);
});
test('parseSkill rejects path traversal in names', () => {
    for (const evil of ['../../../tmp/evil', '..', 'a/b', 'a\\b', '.hidden', 'name with spaces']) {
        const s = parseSkill(`---\nname: ${evil}\ndescription: d\n---\ncorpo`);
        assert.equal(s.name, 'zihin-skill', `unsafe name "${evil}" must use the fallback`);
    }
    assert.equal(parseSkill('---\nname: zihin-criar-agente\n---\nx').name, 'zihin-criar-agente');
    assert.equal(parseSkill('---\nname: skill_v2\n---\nx').name, 'skill_v2');
});
test('toCursorRule includes description and disables alwaysApply', () => {
    const mdc = toCursorRule(parseSkill(SAMPLE));
    assert.match(mdc, /^---\ndescription: Test guide/);
    assert.match(mdc, /alwaysApply: false/);
    assert.match(mdc, /# Skill body/);
});
test('toWindsurfRule includes activation context', () => {
    const md = toWindsurfRule(parseSkill(SAMPLE));
    assert.match(md, /^# zihin-test/);
    assert.match(md, /> When to use: Test guide/);
});
test('toCodexIndexBlock lists skill paths and descriptions', () => {
    const block = toCodexIndexBlock([parseSkill(SAMPLE)]);
    assert.match(block, /<!-- zihin-skills:start -->/);
    assert.match(block, /\.zihin\/skills\/zihin-test\.md/);
    assert.match(block, /<!-- zihin-skills:end -->/);
});
test('upsertCodexBlock replaces existing blocks idempotently', () => {
    const block1 = toCodexIndexBlock([parseSkill(SAMPLE)]);
    const withBlock = upsertCodexBlock('# My AGENTS.md\n\nExisting rule.\n', block1);
    assert.match(withBlock, /Existing rule/);
    const skill2 = parseSkill(SAMPLE.replace('zihin-test', 'zihin-other'));
    const block2 = toCodexIndexBlock([skill2]);
    const updated = upsertCodexBlock(withBlock, block2);
    assert.match(updated, /zihin-other/);
    assert.ok(!updated.includes('zihin-test'), 'old block replaced');
    assert.equal(updated.match(/zihin-skills:start/g).length, 1, 'no duplicate blocks');
    assert.match(updated, /Existing rule/, 'content outside the block is preserved');
});
test('loadBundledSkills reads the six bundled skills', () => {
    const skills = loadBundledSkills();
    assert.equal(skills.length, 6);
    const names = skills.map(s => s.name).sort();
    assert.deepEqual(names, [
        'zihin-criar-agente',
        'zihin-diagnostico',
        'zihin-governanca-e-operacao',
        'zihin-mcp',
        'zihin-tools-de-agente',
        'zihin-triggers-e-canais',
    ]);
    for (const s of skills) {
        assert.ok(s.description.length > 80, `${s.name}: actionable description`);
        assert.ok(s.body.length > 500, `${s.name}: substantial body`);
    }
});
test('loadBundledSkills accepts a missing directory', () => {
    assert.deepEqual(loadBundledSkills('/nonexistent/skills/directory'), []);
});
test('installs bundled skills for all clients in a temporary directory', async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'zihin-skills-'));
    writeFileSync(path.join(tmp, 'AGENTS.md'), '# Project\n\nExisting instructions.\n');
    try {
        const { installSkills } = await import('../src/install-skills.js');
        await installSkills(['--client', 'all', '--dir', tmp, '--bundled']);
        assert.ok(existsSync(path.join(tmp, '.claude', 'skills', 'zihin-mcp', 'SKILL.md')), 'claude');
        assert.ok(existsSync(path.join(tmp, '.cursor', 'rules', 'zihin-diagnostico.mdc')), 'cursor');
        assert.ok(existsSync(path.join(tmp, '.windsurf', 'rules', 'zihin-criar-agente.md')), 'windsurf');
        assert.ok(existsSync(path.join(tmp, '.zihin', 'skills', 'zihin-tools-de-agente.md')), 'codex skills');
        const agents = readFileSync(path.join(tmp, 'AGENTS.md'), 'utf8');
        assert.match(agents, /Existing instructions/, 'AGENTS.md preserved');
        assert.match(agents, /zihin-skills:start/, 'managed block inserted');
        assert.match(agents, /zihin-governanca-e-operacao/, 'complete index');
        const claudeSkill = readFileSync(path.join(tmp, '.claude', 'skills', 'zihin-mcp', 'SKILL.md'), 'utf8');
        assert.match(claudeSkill, /^---\nname: zihin-mcp\n/, 'canonical frontmatter preserved');
    }
    finally {
        rmSync(tmp, { recursive: true, force: true });
    }
});
