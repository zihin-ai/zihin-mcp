# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.2.x   | Yes |
| < 2.2   | No — please upgrade (`npx -y @zihin/mcp-server@latest`) |

## Reporting a Vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Report them to **contact@zihin.ai** with enough context to reproduce (affected version, steps, impact). Do not include API keys or customer data in the report.

- Acknowledgement within 2 business days.
- Triage and an initial assessment within 5 business days.
- Fix or mitigation plan communicated as soon as the assessment is done; releases are published to npm and the MCP registries listed in `docs/distribuicao.md`.

## Scope

This repository contains the stdio-to-HTTP proxy `@zihin/mcp-server`. Vulnerabilities in the hosted platform (`llm.zihin.ai`, `console.zihin.ai`) follow the same contact and are handled under the Zihin.ai privacy and security terms published at https://www.zihin.ai/seguranca.
