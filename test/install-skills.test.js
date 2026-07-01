/**
 * Testes do install-skills — conversores puros e writers.
 * Roda com: node --test test/install-skills.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  parseSkill,
  toCursorRule,
  toWindsurfRule,
  toCodexIndexBlock,
  upsertCodexBlock,
  loadBundledSkills,
} from '../src/install-skills.js';

const SAMPLE = `---
name: zihin-teste
description: Playbook de teste. Use quando estiver testando o instalador de skills.
---

# Corpo da skill

Conteúdo procedural.
`;

test('parseSkill extrai frontmatter e corpo', () => {
  const s = parseSkill(SAMPLE);
  assert.equal(s.name, 'zihin-teste');
  assert.match(s.description, /Use quando/);
  assert.match(s.body, /^# Corpo da skill/);
  assert.ok(!s.body.includes('---'), 'corpo não contém frontmatter');
});

test('parseSkill tolera arquivo sem frontmatter', () => {
  const s = parseSkill('# Só corpo\n');
  assert.equal(s.name, 'zihin-skill');
  assert.equal(s.description, '');
  assert.match(s.body, /^# Só corpo/);
});

test('toCursorRule gera .mdc com description e alwaysApply false', () => {
  const mdc = toCursorRule(parseSkill(SAMPLE));
  assert.match(mdc, /^---\ndescription: Playbook de teste/);
  assert.match(mdc, /alwaysApply: false/);
  assert.match(mdc, /# Corpo da skill/);
});

test('toWindsurfRule inclui contexto de quando usar', () => {
  const md = toWindsurfRule(parseSkill(SAMPLE));
  assert.match(md, /^# zihin-teste/);
  assert.match(md, /> Quando usar: Playbook de teste/);
});

test('toCodexIndexBlock lista skills com caminho e description', () => {
  const block = toCodexIndexBlock([parseSkill(SAMPLE)]);
  assert.match(block, /<!-- zihin-skills:start -->/);
  assert.match(block, /\.zihin\/skills\/zihin-teste\.md/);
  assert.match(block, /<!-- zihin-skills:end -->/);
});

test('upsertCodexBlock é idempotente (substitui bloco existente)', () => {
  const block1 = toCodexIndexBlock([parseSkill(SAMPLE)]);
  const withBlock = upsertCodexBlock('# Meu AGENTS.md\n\nRegra existente.\n', block1);
  assert.match(withBlock, /Regra existente/);

  const skill2 = parseSkill(SAMPLE.replace('zihin-teste', 'zihin-outra'));
  const block2 = toCodexIndexBlock([skill2]);
  const updated = upsertCodexBlock(withBlock, block2);

  assert.match(updated, /zihin-outra/);
  assert.ok(!updated.includes('zihin-teste'), 'bloco antigo substituído');
  assert.equal(updated.match(/zihin-skills:start/g).length, 1, 'sem blocos duplicados');
  assert.match(updated, /Regra existente/, 'conteúdo fora do bloco preservado');
});

test('loadBundledSkills lê as 6 skills empacotadas', () => {
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
    assert.ok(s.description.length > 80, `${s.name}: description acionável`);
    assert.ok(s.body.length > 500, `${s.name}: corpo substancial`);
  }
});

test('loadBundledSkills fail-soft com diretório inexistente', () => {
  assert.deepEqual(loadBundledSkills('/caminho/que/nao/existe'), []);
});

test('e2e local: instala bundled em todos os clients num diretório temporário', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'zihin-skills-'));
  writeFileSync(path.join(tmp, 'AGENTS.md'), '# Projeto\n\nInstruções existentes.\n');

  try {
    const { installSkills } = await import('../src/install-skills.js');
    await installSkills(['--client', 'all', '--dir', tmp, '--bundled']);

    assert.ok(existsSync(path.join(tmp, '.claude', 'skills', 'zihin-mcp', 'SKILL.md')), 'claude');
    assert.ok(existsSync(path.join(tmp, '.cursor', 'rules', 'zihin-diagnostico.mdc')), 'cursor');
    assert.ok(existsSync(path.join(tmp, '.windsurf', 'rules', 'zihin-criar-agente.md')), 'windsurf');
    assert.ok(existsSync(path.join(tmp, '.zihin', 'skills', 'zihin-tools-de-agente.md')), 'codex skills');

    const agents = readFileSync(path.join(tmp, 'AGENTS.md'), 'utf8');
    assert.match(agents, /Instruções existentes/, 'AGENTS.md preservado');
    assert.match(agents, /zihin-skills:start/, 'bloco gerenciado inserido');
    assert.match(agents, /zihin-governanca-e-operacao/, 'índice completo');

    const claudeSkill = readFileSync(path.join(tmp, '.claude', 'skills', 'zihin-mcp', 'SKILL.md'), 'utf8');
    assert.match(claudeSkill, /^---\nname: zihin-mcp\n/, 'frontmatter canônico preservado');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
