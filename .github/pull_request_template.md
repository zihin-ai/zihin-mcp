## O que muda para quem usa

<!-- Em poucas linhas: o que a pessoa que instala o plugin, o pacote npm ou o servidor remoto passa a ver ou fazer. -->

## Como foi validado

<!-- Ex.: npm test (sem ZIHIN_API_KEY no ambiente), npm run check:publication, claude plugin validate, schema do server.json. -->

## Texto público

Este repositório é público. Corpo de PR, mensagem de commit, notas de release, CHANGELOG, README e `server.json` não citam:

- caminhos, issues ou PRs do repositório privado do backend (issue/PR deste repositório pode);
- nomes de variáveis de ambiente do backend;
- versões ou commits internos do backend;
- nomes de clientes ou empresas, nem ids;
- riscos operacionais ou passos internos de publicação.

Esse detalhe fica no registro interno do backend. O `npm run check:publication` recusa parte desses padrões no conteúdo do pacote, mas não lê o corpo da PR nem os commits.

- [ ] Revisei o corpo desta PR e as mensagens de commit antes de abrir.
- [ ] Vou revisar de novo antes do merge.
