# Prévia da Semana da Agenda (protótipo isolado, 12/11/2026)

Protótipo navegável da visão **Semana** (segunda a domingo), com dados fictícios e a identidade Catalyst, feito a partir da referência `ref/referencia.png` (`tela-agenda-semana.png`). **Aguarda a aprovação visual do Éder; não está integrado ao aplicativo** e não toca `src/`, o banco nem o Supabase.

## Abrir

Da raiz do repositório:

```
node prototipo/agenda-semana/testes/servidor.mjs
```

Abrir http://127.0.0.1:7201/index.html (outra porta: `node prototipo/agenda-semana/testes/servidor.mjs 7300`). Alternativa sem Node: `cd prototipo/agenda-semana` e `python -m http.server 7201 --bind 127.0.0.1`.

- Tema escuro: `http://127.0.0.1:7201/index.html#tema=escuro`. Largura total (como nas comparações): `#largo=1`. Outra semana: `#semana=1`.
- Navegação: setas de semana, botão Hoje (ou a tecla T), clique no dia para abrir os itens, setas do teclado para trocar de dia ou de semana.
- As fontes (Inter e IBM Plex Mono) vêm do Google Fonts; sem internet a tela usa as fontes do sistema.

## Conteúdo

- `index.html`: a prévia inteira (HTML, CSS e JS em um arquivo, dados fictícios dentro do script; tokens copiados de `src/estilos/catalyst.css`).
- `ref/`: a referência enviada e as capturas da Semana reprovada (`fd3b101`) usadas na comparação.
- `capturas/`: computador (1335 px), iPad em pé (820 px) e celular (390 px), semana inicial, sexta aberta, semana seguinte e escuro.
- `comparacao.html`, `comparacao-computador.png`, `comparacao-ipad-celular.png`: referência, reprovada e proposta na mesma escala.
- `testes/`: `servidor.mjs`, `capturar.mjs` e `comparar.mjs`.

## Testes

Depois de `npm ci`, da raiz do repositório (usam o Edge instalado e o `playwright-core`; sobem o próprio servidor):

```
node prototipo/agenda-semana/testes/capturar.mjs    (24 verificações, refaz as capturas)
node prototipo/agenda-semana/testes/comparar.mjs    (refaz as duas comparações)
```
