#!/usr/bin/env node
const [subcommand, ...rest] = process.argv.slice(2);
if (subcommand === 'install-skills') {
    const { installSkills } = await import('../src/install-skills.js');
    installSkills(rest).catch((error) => {
        console.error('[zihin-mcp] Fatal error:', error.message);
        process.exit(1);
    });
}
else {
    const { startProxy } = await import('../src/index.js');
    startProxy().catch((error) => {
        console.error('[zihin-mcp] Fatal error:', error.message);
        process.exit(1);
    });
}
