@AGENTS.md

# Dmanda

Sistema pessoal de demandas em quadros, feito para o Secretário de Administração da Prefeitura de Taquara/RS. O objetivo é não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. Há um único usuário, o admin, que é o próprio Secretário. Não existe equipe, perfil, convite nem comentário.

Primeiro roda no computador, depois na internet. As telas funcionam no computador e no celular.

## Como rodar

```
npm install      (só na primeira vez)
npm run dev
```

Endereço: http://localhost:7100 (a porta 7100 está fixada no package.json).

Variáveis de ambiente: copiar `.env.example` para `.env.local` e preencher. O `.env.local` nunca vai para o Git.

## Documentos do projeto

- PESQUISA.md: as dores do usuário.
- REFERENCIAS.md: prints de referência (todos de uma só ferramenta).
- PRODUTO.md: as 5 funções essenciais e os cuidados gerais.
- FUNCIONALIDADES.md: mapa por tela, jornada de uma demanda, fatias e decisões. Seguir a ordem das fatias.

## Regras

- Todos os textos em português do Brasil: interface, mensagens, commits, documentos e comentários.
- Sem travessão (nem "—" nem "–") em nenhum texto. Usar vírgula, ponto, dois-pontos ou parênteses.
- Fazer um commit a cada avanço, com mensagem em português.
- Nunca colocar senha, chave, token ou dado real em arquivo que vá para o Git. Valores reais ficam só no `.env.local`.
- Cadastro rápido com poucos campos (número, prazo, assunto, origem). Poucas cores por tela, cor forte só para atrasado ou crítico.
- O que o usuário digita é guardado automaticamente.
- Não pagar nada além das assinaturas Claude Pro e ChatGPT Plus. Sem instaladores que peçam administrador (o computador não dá essa permissão).

## Regras aprendidas com as correções

Sempre que o usuário corrigir algo, acrescentar aqui a regra nova, em uma linha, logo após a correção.

- Quando o usuário tiver que fazer algo fora do Claude Code (comando no PowerShell, ação no site do GitHub, outro programa), avisar sempre e destacar em negrito, dizendo onde fazer e o que fazer.
