# Pendências do Dmanda

Arquivo lido no início de cada sessão. Fica no repositório para valer em qualquer computador.

## Aguardando o usuário

1. **Criar o banco de 500 frases** motivacionais e bem-humoradas para a mensagem do dia (o sistema só fornece o lugar para cadastrar). Não bloqueia nada: pode ser feito a qualquer momento antes do Início ficar pronto.
2. **Emojis de energia (opcional):** enviar `energia-1.png` a `energia-5.png` na pasta `prototipo/emojis/` (hoje a energia usa ícones de bateria). Os cinco de humor já estão lá.
3. **Aprovar a nova versão do protótipo** (`prototipo/`, rodada de 22/10/2026 com os 11 itens da avaliação aplicados, exceto Agenda). Falta dizer o que ainda destoa. Rodar `node verificar-cores.mjs` dentro de `prototipo` confere que não há branco nem preto absolutos.
4. **Escolher os padrões de cada tema:** par de fontes, estilo de ícones e paleta padrão de Aurora, Papel e Grafite (hoje há padrões provisórios).

## Próximo passo do Claude

- Página de **peças com os cinco estados** (normal, foco, desativado, carregando, erro) para os três temas, e conferência de contraste (`inspect.mjs` da taste-skill e verificação por código).
- Depois, começar a **construção real** (ordem em `DECISOES.md`, seção 1): base técnica (banco, login Google, publicação na Vercel) e versão mínima de Demandas e Início, sobre os três temas.
- O código de `src/` ainda é o design antigo e será substituído (ver `CLAUDE.md`).

## Pontos em aberto técnicos (não dependem do usuário)

- Confirmar os limites atuais do plano gratuito do Postgres (Neon ou Supabase) e escolher um.
- Confirmar os limites da IA gratuita (Gemini ou Groq) na hora da etapa de IA.
- Rodar `trail init --dry-run` e instalar o Trail-code depois da versão mínima de Demandas.
- Quando o design system real estiver pronto, avaliar a remoção do plugin `ui-ux-pro-max` (instalado no ambiente do usuário a pedido).
- Acrescentar ao `.env.example` as variáveis do Google (login, Calendar e Drive) e da IA quando essas etapas começarem.
- `npm audit` mostrou avisos de dependências em 21/10/2026; reavaliar sem usar `--force` (o serviço de auditoria estava fora do ar em 22/10/2026).
- Opcional: apagar `imagens/aprovacao` (prints do design antigo, 2 MB, sem uso) e trocar a descrição do repositório no GitHub ("Sistema pessoal de demandas em quadros") por algo atual.

## Como continuar em outro computador

1. Baixar o projeto: `git clone https://github.com/edermoliveira/Dmanda.git` (ou `git pull`, se já existir).
2. Na pasta do projeto: `npm install` (só na primeira vez).
3. Ligar: `npm run dev` e abrir http://localhost:7100. Para o protótipo: `python -m http.server 7200` dentro de `prototipo`.
4. O `.env.local` não vai para o GitHub. Hoje o sistema ainda não precisa dele. Quando precisar, copiar o `.env.example` e preencher.
5. Plugins, skills e MCPs **não** vêm pelo Git (exceto as três skills do Superpowers em `.claude/skills/`). Instalar de novo no outro computador, se quiser: `taste-skill` (marketplace `Leonxlnx/taste-skill`), `ui-ux-pro-max` (marketplace `nextlevelbuilder/ui-ux-pro-max-skill`) e o plugin `context7`. O `.claude/settings.json` do projeto já marca o `ui-ux-pro-max` como ativo, mas ele só funciona depois de instalado.
6. A memória do Claude é local de cada computador: ela foi recriada aqui a partir destes documentos.
