# Pendências do Dmanda

Arquivo lido no início de cada sessão. Fica no repositório para valer em qualquer computador.

## Aguardando aprovação do usuário

**Peças base e marca** (criadas em 20/10/2026, ainda não aprovadas)

- Prints para aprovar, na pasta `imagens/aprovacao/`:
  - `pecas-claro.png`, `pecas-escuro.png`, `pecas-celular.png` (página /pecas)
  - `marca-claro.png`, `marca-escuro.png`, `marca-celular.png` (página /marca)
- O que olhar: o logo (D com três colunas), cada peça (botão, campo, janela, menu, avatar, etiqueta) nos cinco estados, e se as páginas /pecas e /marca explicam bem.
- Se o usuário pedir ajustes, fazer, tirar os prints de novo (`npm run capturar`) e anotar a regra nova no `CLAUDE.md`.
- Depois da aprovação, apagar esta pendência e seguir para as telas da Fatia 1 (cadastro rápido e tela do dia), conforme `FUNCIONALIDADES.md`.

**Mudanças grandes de design** (anunciadas pelo usuário em 21/10/2026, ainda não detalhadas)

- O usuário vai trazer alterações consideráveis no design, em um segundo momento. Não começar as telas da Fatia 1 antes de ouvir essas mudanças.

## Como continuar em outro computador

1. Baixar o projeto: `git clone https://github.com/edermoliveira/Dmanda.git` (ou `git pull`, se já existir).
2. Na pasta do projeto: `npm install` (só na primeira vez).
3. Ligar: `npm run dev` e abrir http://localhost:7100
4. Páginas do design system: /tokens, /pecas e /marca.
5. O `.env.local` não vai para o GitHub. Hoje o sistema ainda não precisa dele. Quando precisar, copiar o `.env.example` e preencher.
