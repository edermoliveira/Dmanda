# Pendências do Dmanda

Arquivo lido no início de cada sessão. Fica no repositório para valer em qualquer computador.

## Aguardando o usuário

1. **Conferir os padrões adotados** em `DECISOES.md` (itens marcados [padrão]). Valem as recomendações do questionário até ele pedir mudança. Vale uma leitura rápida.
2. **Aprovar a revisão dos documentos** feita em 21/10/2026 (`PRODUTO.md`, `FUNCIONALIDADES.md`, `CLAUDE.md`, `README.md`, `ANALISE-FERRAMENTAS.md`) antes de começar o protótipo.

## Próximo passo do Claude (depois da aprovação acima)

- Fazer o **protótipo de 3 direções de estilo** (Início, card de dois lados, menu lateral, barra inferior, botão "+" e busca, claro e escuro, celular e computador). Antes: instalar `design-taste-frontend` (taste-skill) depois de ler os scripts, e a base shadcn. Usar `critique` e `delight` como revisão. O usuário escolhe a direção, o par de fontes padrão e o estilo de ícones.
- Peças e marca atuais (de 20/10/2026) ficam **substituídas** pela refação. Os prints em `imagens/aprovacao` não precisam mais de aprovação.

## Pontos em aberto técnicos (não dependem do usuário)

- Confirmar os limites atuais do plano gratuito do Postgres (Neon ou Supabase) e escolher um.
- Confirmar os limites da IA gratuita (Gemini ou Groq) na hora da etapa de IA.
- Rodar `trail init --dry-run` e instalar o Trail-code depois da versão mínima de Demandas.
- Quando o design system estiver pronto, remover o plugin `ui-ux-pro-max`.

## Como continuar em outro computador

1. Baixar o projeto: `git clone https://github.com/edermoliveira/Dmanda.git` (ou `git pull`, se já existir).
2. Na pasta do projeto: `npm install` (só na primeira vez).
3. Ligar: `npm run dev` e abrir http://localhost:7100
4. O `.env.local` não vai para o GitHub. Hoje o sistema ainda não precisa dele. Quando precisar, copiar o `.env.example` e preencher.
