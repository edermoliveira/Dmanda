# Pendências do Dmanda

Arquivo lido no início de cada sessão. Fica no repositório para valer em qualquer computador.

## Aguardando o usuário

1. **Criar o banco de 500 frases** motivacionais e bem-humoradas para a mensagem do dia (o sistema só fornece o lugar para cadastrar). Não bloqueia nada: pode ser feito a qualquer momento antes do Início ficar pronto.

Os itens [aprovado] de `DECISOES.md` foram revisados em 21/10/2026. **O protótipo está liberado.**

## Aguardando avaliação do usuário

- **Protótipo de 3 direções de estilo** pronto em `prototipo/` (A Aurora, B Papel, C Grafite). Abrir `prototipo/index.html` no navegador (precisa de internet para as fontes do Google). Os três temas (Aurora, Papel, Grafite) são definitivos e o logo da Aurora vale para todos. Falta escolher, em Configurações do protótipo: par de fontes padrão, estilo de ícones e paleta padrão. Depois disso, as peças e o design system são refeitos sobre a base shadcn.
- Peças e marca atuais (de 20/10/2026) ficam **substituídas** pela refação. Os prints em `imagens/aprovacao` não precisam mais de aprovação.

## Pontos em aberto técnicos (não dependem do usuário)

- Confirmar os limites atuais do plano gratuito do Postgres (Neon ou Supabase) e escolher um.
- Confirmar os limites da IA gratuita (Gemini ou Groq) na hora da etapa de IA.
- Rodar `trail init --dry-run` e instalar o Trail-code depois da versão mínima de Demandas.
- Quando o design system estiver pronto, avaliar a remoção do plugin `ui-ux-pro-max` (agora instalado no ambiente do usuário, a pedido).

## Como continuar em outro computador

1. Baixar o projeto: `git clone https://github.com/edermoliveira/Dmanda.git` (ou `git pull`, se já existir).
2. Na pasta do projeto: `npm install` (só na primeira vez).
3. Ligar: `npm run dev` e abrir http://localhost:7100
4. O `.env.local` não vai para o GitHub. Hoje o sistema ainda não precisa dele. Quando precisar, copiar o `.env.example` e preencher.
