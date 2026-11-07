---
name: zihin-processos
description: Playbook do motor de processos do Zihin — criar, validar, publicar e liberar uma DEFINIÇÃO de processo (incluindo a receita do worker de processamento), acompanhar as INSTÂNCIAS que os agentes abrem e intervir (cancelar, resolver incidente). Use quando o usuário pedir para automatizar um fluxo de várias etapas, processar um cadastro inteiro fora da conversa ou acompanhar/destravar processos.
---

# Processos

Duas entidades:

| | Definição (o modelo) | Instância (a execução) |
|---|---|---|
| Quem cria | um admin/owner, antes (`publish_process_definition`) | o agente, na conversa (`open_process`) |
| Vida | versionada; aposentável | nasce e termina sozinha (concluída, cancelada, falhou, expirou) |

Publicada **não** é liberada: os agentes só abrem processos liberados para a empresa (`enable_process`).

## Ciclo do admin

1. **Contrato**: leia `zihin://schemas/process_definition`.
2. **Monte** a definição (exemplo abaixo). Não envie `version`.
3. **Valide sem gravar**: `validate_process_definition` — estrutura, regras e se agentes, políticas e servidores MCP citados são desta empresa. Leia os `warnings`.
4. **Publique**: `publish_process_definition` (cria a próxima versão; instâncias vivas seguem na versão com que abriram).
5. **Libere**: `enable_process` com a key (ou `*` para todas as publicadas). `get_process_engine_status` mostra de onde vem cada liberação.
6. **Acompanhe**: `list_process_instances`, `get_process_instance`, `get_process_trail`. O editor vê só situação, etapas, agente, nome e datas; variáveis, tarefas, arquivos, resumo do cálculo e trilha são de admin/owner.
7. **Intervenha** (admin/owner): `cancel_process_instance` ou `resolve_process_incident` (`retry`, `abandon`, `substitute_output`). As duas devolvem `command_id` com status `received` = RECEBIDO, não concluído: confirme o desfecho com `get_process_command` (`applied` ou `rejected` + `reason`) em vez de repetir a mutação. Aprovação e pedido de informação NÃO se resolvem por aqui — são de quem a política designa. Antes de resolver, confira em `get_process_instance` o `open_tasks[].allowed_resolutions`: `substitute_output` só existe em etapa de agente, e `retry` com `attempts` = `max_attempts` re-bloqueia na hora. `closing_blocked: true` = processo retido encerrando (efeito incerto ou worker fora): não se resolve por aqui — fale com a Zihin.
8. **Aposente**: `retire_process_definition` (todas as versões da key).

Publicar, liberar e intervir exigem API key criada por um admin/owner **ainda ativo** na empresa. No login de pessoa (OAuth) vale o papel da pessoa, e `publish_process_definition`/`enable_process` não aparecem — publicar e ligar são feitos no console.

## Receita do worker (etapa `compute`)

O worker processa por REFERÊNCIA, fora do modelo: lê a fonte de dados inteira (ex.: o cadastro do ERP) e entrega arquivos e números. A **receita** é o pedido ao worker — fica **na definição**; o agente só escolhe:

- `request` — receita fixa (uma só);
- `requests` + `choose_from` — receitas nomeadas; a variável de abertura (texto com `enum` dos nomes) escolhe qual roda;
- `request_from` — forma antiga (o pedido vem de uma referência).

A fonte (`source`) de uma receita usa um servidor MCP: o processo só consegue lê-la quando aberto pelo **agente dono desse servidor** (o `validate` avisa). Fonte vinda da saída de uma etapa (outro agente) é recusada.

### Exemplo: analisar o cadastro de obras OU de centros de custo

```json
{
  "key": "analisar-cadastro-erp",
  "title": "Análise do cadastro do ERP",
  "description": "Use quando a pessoa pedir para analisar o cadastro COMPLETO de obras ou de centros de custo.",
  "variables_schema": {
    "type": "object", "additionalProperties": false, "required": ["tipo"],
    "properties": { "tipo": { "type": "string", "enum": ["obras", "centros_de_custo"], "description": "Qual cadastro analisar" } }
  },
  "budget_limit_usd": 1, "incident_owner": "owner", "on_reject": "complete_rejected",
  "steps": [
    { "key": "analisar", "kind": "compute", "title": "Análise do cadastro", "max_attempts": 2, "choose_from": "variables.tipo",
      "requests": {
        "obras": { "capability": "dataset.inspect.v1", "parameters": {},
          "source": { "kind": "mcp", "mcp_server_id": "<uuid do servidor do agente>", "tool": "listar-obras", "arguments": {},
                      "columns": ["obra_ref", "nome", "empresa"], "data_source_meta": true, "name": "obras.csv" } },
        "centros_de_custo": { "capability": "dataset.inspect.v1", "parameters": {},
          "source": { "kind": "mcp", "mcp_server_id": "<uuid do servidor do agente>", "tool": "listar-centros-custo", "arguments": {},
                      "columns": ["centro_custo_ref", "nome", "empresa"], "data_source_meta": true, "name": "centros.csv" } }
      } },
    { "key": "avisar", "kind": "notify", "title": "Aviso na conversa", "target": "origin_session",
      "template": "Análise concluída: {{analisar.output.export.rows}} linhas lidas do ERP.", "attach_from": "analisar.output" }
  ]
}
```

O agente abre com `{"definition_key": "analisar-cadastro-erp", "variables": {"tipo": "obras"}}` — a descrição do `open_process` já mostra as opções e um exemplo de chamada.

## O que o agente faz na conversa

- `open_process` — abre (a pessoa não precisa saber o nome do processo).
- `get_process_status` — situação (sem id = o desta conversa); `list_my_processes` — os processos da pessoa.
- `cancel_process` — sempre em dois passos: pede confirmação e só cancela depois que a pessoa responde.
- `list_my_tasks` — as tarefas de processo esperando pela pessoa (aprovação, pedido de informação, incidente); ela decide pelo card.
- `analyze_data` — análise AVULSA, sem definição do admin: o agente escolhe a fonte (uma ferramenta de dados dele), escreve o código (Python/pandas) e o pedido; a plataforma lê a fonte inteira fora da conversa, roda o código no worker e devolve relatório HTML, gráficos e planilha. Se o código errar, o modelo do agente o conserta antes de voltar (até 3 tentativas). Usa a definição de sistema `zihin-analise-de-dados`, publicada pela plataforma; disponível em toda empresa com o motor autorizado.
