/**
 * @zihin/mcp-server — install-skills
 *
 * Instala as skills do MCP Zihin no formato nativo de cada client:
 *
 *   claude   → .claude/skills/<name>/SKILL.md            (Agent Skills)
 *   cursor   → .cursor/rules/<name>.mdc                  (Cursor Rules)
 *   windsurf → .windsurf/rules/<name>.md                 (Windsurf Rules)
 *   codex    → .zihin/skills/<name>.md + bloco gerenciado no AGENTS.md
 *
 * Fonte primária: o PRÓPRIO MCP Server (resources zihin://skills/*) — sempre
 * atual, sem bundle desatualizado. Fallback: cópias empacotadas no npm
 * (plugin/skills/, sincronizadas a cada release) via --bundled ou quando o
 * server ainda não expõe skills.
 *
 * Uso:
 *   ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server install-skills --client claude
 *   npx @zihin/mcp-server install-skills --client all --dir /meu/projeto
 *   npx @zihin/mcp-server install-skills --client claude --global
 *   npx @zihin/mcp-server install-skills --client cursor --bundled
 *
 * @module @zihin/mcp-server/install-skills
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const DEFAULT_MCP_URL = 'https://llm.zihin.ai/mcp';
const BUNDLED_SKILLS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugin', 'skills');
const CLIENTS = ['claude', 'cursor', 'windsurf', 'codex'];
const AGENTS_MD_START = '<!-- zihin-skills:start -->';
const AGENTS_MD_END = '<!-- zihin-skills:end -->';

/**
 * Extrai frontmatter (name/description) e corpo de um SKILL.md.
 *
 * @param {string} raw - Conteúdo completo do SKILL.md
 * @returns {{ name: string, description: string, body: string }}
 */
export function parseSkill(raw) {
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const meta = {};
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = /^([\w-]+):\s*(.*)$/.exec(line);
      if (m) meta[m[1]] = m[2].trim();
    }
  }
  return {
    name: meta.name || 'zihin-skill',
    description: meta.description || '',
    body: (fm ? raw.slice(fm[0].length) : raw).replace(/^\n+/, ''),
  };
}

/**
 * Converte skill → Cursor Rule (.mdc). Agent-requested: o Cursor decide
 * carregar pela description (equivalente ao progressive disclosure).
 */
export function toCursorRule(skill) {
  return `---\ndescription: ${skill.description}\nalwaysApply: false\n---\n\n${skill.body}`;
}

/** Converte skill → Windsurf Rule (markdown com contexto de ativação). */
export function toWindsurfRule(skill) {
  return `# ${skill.name}\n\n> Quando usar: ${skill.description}\n\n${skill.body}`;
}

/**
 * Gera o bloco gerenciado do AGENTS.md (Codex): índice com descriptions +
 * caminho dos arquivos — progressive disclosure manual (AGENTS.md fica
 * sempre no contexto; os corpos só são lidos quando o job pede).
 */
export function toCodexIndexBlock(skills) {
  const lines = [
    AGENTS_MD_START,
    '## Skills do MCP Zihin',
    '',
    'Playbooks especialistas do MCP Zihin (gerados por `npx @zihin/mcp-server install-skills`).',
    'ANTES de um fluxo multi-passo no MCP Zihin, leia o arquivo da skill correspondente:',
    '',
  ];
  for (const s of skills) {
    lines.push(`- \`.zihin/skills/${s.name}.md\` — ${s.description}`);
  }
  lines.push('', AGENTS_MD_END);
  return lines.join('\n');
}

/** Insere/substitui o bloco gerenciado no AGENTS.md (idempotente). */
export function upsertCodexBlock(existingContent, block) {
  const start = existingContent.indexOf(AGENTS_MD_START);
  const end = existingContent.indexOf(AGENTS_MD_END);
  if (start !== -1 && end !== -1) {
    return existingContent.slice(0, start) + block + existingContent.slice(end + AGENTS_MD_END.length);
  }
  const sep = existingContent.trim().length > 0 ? '\n\n' : '';
  return existingContent + sep + block + '\n';
}

// --- Fontes de skills ---

/** Busca as skills do MCP Server vivo (resources zihin://skills/*). */
async function fetchSkillsFromServer(apiKey, mcpUrl) {
  const client = new Client({ name: 'zihin-install-skills', version: '1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { 'X-Api-Key': apiKey } },
  });

  await client.connect(transport);
  try {
    const { resources } = await client.listResources();
    const skillResources = resources.filter(r => r.uri.startsWith('zihin://skills/'));
    const skills = [];
    for (const res of skillResources) {
      const { contents } = await client.readResource({ uri: res.uri });
      if (contents?.[0]?.text) skills.push(parseSkill(contents[0].text));
    }
    return skills;
  } finally {
    await client.close().catch(() => {});
  }
}

/** Carrega as skills empacotadas no npm (plugin/skills/<name>/SKILL.md). */
export function loadBundledSkills(dir = BUNDLED_SKILLS_DIR) {
  if (!existsSync(dir)) return [];
  const skills = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, 'SKILL.md');
    if (existsSync(file)) skills.push(parseSkill(readFileSync(file, 'utf8')));
  }
  return skills;
}

// --- Writers por client ---

function writeClaude(skills, root, { global: isGlobal }) {
  const base = isGlobal
    ? path.join(os.homedir(), '.claude', 'skills')
    : path.join(root, '.claude', 'skills');
  for (const s of skills) {
    const dir = path.join(base, s.name);
    mkdirSync(dir, { recursive: true });
    // Verbatim: SKILL.md já é o formato nativo do Claude Code
    writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${s.name}\ndescription: ${s.description}\n---\n${s.body}`);
  }
  return base;
}

function writeCursor(skills, root) {
  const base = path.join(root, '.cursor', 'rules');
  mkdirSync(base, { recursive: true });
  for (const s of skills) {
    writeFileSync(path.join(base, `${s.name}.mdc`), toCursorRule(s));
  }
  return base;
}

function writeWindsurf(skills, root) {
  const base = path.join(root, '.windsurf', 'rules');
  mkdirSync(base, { recursive: true });
  for (const s of skills) {
    writeFileSync(path.join(base, `${s.name}.md`), toWindsurfRule(s));
  }
  return base;
}

function writeCodex(skills, root) {
  const skillsDir = path.join(root, '.zihin', 'skills');
  mkdirSync(skillsDir, { recursive: true });
  for (const s of skills) {
    writeFileSync(path.join(skillsDir, `${s.name}.md`), `# ${s.name}\n\n> Quando usar: ${s.description}\n\n${s.body}`);
  }
  const agentsPath = path.join(root, 'AGENTS.md');
  const existing = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : '';
  writeFileSync(agentsPath, upsertCodexBlock(existing, toCodexIndexBlock(skills)));
  return skillsDir;
}

const WRITERS = { claude: writeClaude, cursor: writeCursor, windsurf: writeWindsurf, codex: writeCodex };

// --- CLI ---

function parseArgs(argv) {
  const opts = { client: 'claude', dir: process.cwd(), global: false, bundled: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--client') opts.client = argv[++i];
    else if (argv[i] === '--dir') opts.dir = path.resolve(argv[++i]);
    else if (argv[i] === '--global') opts.global = true;
    else if (argv[i] === '--bundled') opts.bundled = true;
    else if (argv[i] === '--help' || argv[i] === '-h') opts.help = true;
  }
  return opts;
}

function printHelp() {
  console.error(`
Uso: npx @zihin/mcp-server install-skills [opções]

Instala as skills do MCP Zihin no formato do seu client:

  --client <c>   claude | cursor | windsurf | codex | all   (default: claude)
  --dir <path>   raiz do projeto onde instalar               (default: cwd)
  --global       (só claude) instala em ~/.claude/skills
  --bundled      usa as skills empacotadas no npm em vez de buscar do server

Fonte primária: o MCP Server vivo (ZIHIN_API_KEY obrigatória; ZIHIN_MCP_URL
opcional). Com --bundled não precisa de API Key.
`);
}

/**
 * Entry point do subcomando install-skills.
 *
 * @param {string[]} argv - Argumentos após "install-skills"
 */
export async function installSkills(argv = []) {
  const opts = parseArgs(argv);

  if (opts.help) {
    printHelp();
    return;
  }

  const targets = opts.client === 'all' ? CLIENTS : [opts.client];
  const invalid = targets.filter(c => !CLIENTS.includes(c));
  if (invalid.length > 0) {
    console.error(`ERRO: client inválido: ${invalid.join(', ')}. Válidos: ${CLIENTS.join(', ')}, all`);
    process.exit(1);
  }

  // Obter skills — server vivo (primário) ou bundle (fallback/offline)
  let skills = [];
  let source = 'bundled';

  if (!opts.bundled) {
    const apiKey = process.env.ZIHIN_API_KEY;
    if (!apiKey) {
      console.error('ERRO: ZIHIN_API_KEY não definida (necessária para buscar as skills do server).');
      console.error('Alternativa offline: --bundled (usa as skills empacotadas no npm).');
      process.exit(1);
    }
    const mcpUrl = process.env.ZIHIN_MCP_URL || DEFAULT_MCP_URL;
    console.error(`Buscando skills de ${mcpUrl}...`);
    try {
      skills = await fetchSkillsFromServer(apiKey, mcpUrl);
      source = 'server';
    } catch (error) {
      console.error(`Aviso: falha ao buscar do server (${error.message}) — usando bundle local.`);
    }
  }

  if (skills.length === 0) {
    skills = loadBundledSkills();
    source = 'bundled';
  }

  if (skills.length === 0) {
    console.error('ERRO: nenhuma skill encontrada (server sem skills e bundle vazio).');
    console.error('O server precisa estar em v2.5.0+ (resources zihin://skills/*).');
    process.exit(1);
  }

  console.error(`${skills.length} skills obtidas (fonte: ${source}):`);
  for (const s of skills) console.error(`  - ${s.name}`);
  console.error('');

  for (const client of targets) {
    const dest = WRITERS[client](skills, opts.dir, opts);
    console.error(`✓ ${client}: ${skills.length} skills instaladas em ${dest}`);
  }

  console.error('');
  console.error('Pronto! Reinicie o client para carregar as skills.');
}
