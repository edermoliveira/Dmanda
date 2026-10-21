# Pendências do Dmanda

Arquivo lido no início de cada sessão. Fica no repositório para valer em qualquer computador.

## Aguardando o usuário

1. **Criar o banco de 500 frases** motivacionais e bem-humoradas para a mensagem do dia (o sistema só fornece o lugar para cadastrar). Não bloqueia nada: pode ser feito a qualquer momento antes do Início ficar pronto.

Os itens [aprovado] de `DECISOES.md` foram revisados em 21/10/2026. **O protótipo está liberado.**

## Próximo passo do Claude

- Fazer o **protótipo de 3 direções de estilo** (Início, card de dois lados, menu lateral, barra inferior, botão "+" e busca, claro e escuro, computador primeiro e depois iPad e celular). Antes: instalar `design-taste-frontend` (taste-skill) depois de ler os scripts, e a base shadcn. Usar `critique` e `delight` como revisão. O usuário escolhe a direção, o par de fontes padrão e o estilo de ícones.
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
