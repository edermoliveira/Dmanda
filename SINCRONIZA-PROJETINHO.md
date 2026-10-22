# SINCRONIZA-PROJETINHO

Guia para continuar o Dmanda em outro computador (casa) a partir do ponto em que paramos em 22/10/2026. Contém: resumo do que foi feito, como sincronizar o GitHub, o que reinstalar e o prompt para o Claude Code retomar o trabalho.

## 1. Resumo do que fizemos (22/10/2026)

**Projeto:** painel pessoal do Secretário de Administração da Prefeitura de Taquara/RS (usuário único, o admin). Sete áreas: Início, Entradas, Demandas, Agenda, Documentos, IA e Configurações. Andamento: **18%** (cálculo em `ANDAMENTO.md`).

**Rodada 2 do protótipo (commit `eb1f63e`):** menu recolhido, Perfil em gaveta, aviso de retorno no Início, compromissos por tipo, cards sem barra de rolagem e com a próxima tarefa, cores de prazo por dias, rascunho que nunca se perde, botões estilo Apple.

**Figma conectado:** o MCP do Figma foi adicionado e autenticado. O kit usado é o "iOS and iPadOS 27 (Community)":
https://www.figma.com/design/VOqem67sPifvvgYa0MwyKh/iOS-and-iPadOS-27--Community-
(chave do arquivo: `VOqem67sPifvvgYa0MwyKh`). Lemos Colors, Buttons, Sidebars, Lists, Segmented Controls, Materials, Menus, Sheets, Toolbars, Tab Bars, Toggles e Typography.

**Quarto tema: Catalyst** (commits `23c4f99` e `4066962`). Decisão do usuário: manter o Aurora e apenas acrescentar o Catalyst, no estilo nativo Apple (iOS e iPadOS 27). Fica no protótipo até o usuário aprovar. Arquivos:
- `prototipo/catalyst.css`: Liquid Glass (barras, menus, folhas, botões), cinza de sistema por baixo, cards sólidos, azul de sistema, cápsulas, caixas de marcar redondas, folhas com cantos de 34 px.
- `prototipo/catalyst.js`: movimento com mola. Observa cada redesenho do app e anima entrada e saída de telas, folhas, menus e gaveta, e faz a cápsula de seleção deslizar entre abas (técnica FLIP).
- Registro do tema em `extra.js` (lista TEMAS, padrões, fonte Inter), `app.js` (notas e logo), `index.html` e `verificar-cores.mjs`.
- Correção de base em `v4.css`: a tela "Mais" tinha os itens espremidos em 52 px nas telas estreitas (valia para os quatro temas).

**Testes feitos no Catalyst (Playwright):** clique em todos os botões das 9 telas (Início, Entradas, Demandas, Agenda, Documentos, IA, Configurações, Arquivo, Mais) em claro, escuro e celular; contraste de todos os textos visíveis; estouro de layout; Esc fecha janelas; verso dos cards no celular. Tudo passou depois das correções.

**Limites conhecidos:** o vidro é CSS (sem a refração real do iOS); a fonte é Inter (a SF da Apple não existe no navegador); no escuro o texto dos botões azuis é escuro, para manter o contraste. Sem teste ainda: Grafite, Quadro no celular e Agenda no Grafite; iPad horizontal e janela média só por capturas de poucas telas.

## 2. O que aguarda o usuário (de `PENDENCIAS.md`)

1. Avaliar o Catalyst (http://127.0.0.1:7200, botão "D Catalyst") e dizer o que ainda destoa do iOS 27.
2. Avaliar a rodada 2 dos outros temas e escolher os padrões de cada tema (par de fontes, ícones, paleta).
3. Criar o banco de 500 frases da mensagem do dia.
4. Opcional: enviar `energia-1.png` a `energia-5.png` (quadrados, fundo transparente, 128 a 512 px) em `prototipo/emojis/`. Enquanto faltam, o protótipo mostra 5 erros 404 no console, e isso é esperado.

## 3. Sincronizar o GitHub com o computador de casa

Repositório: https://github.com/edermoliveira/Dmanda.git

**Fazer no PowerShell do computador de casa (fora do Claude Code):**

Primeira vez (a pasta ainda não existe):
```
cd $HOME\Desktop
git clone https://github.com/edermoliveira/Dmanda.git
cd Dmanda
npm install
```

Se a pasta já existe (só atualizar):
```
cd $HOME\Desktop\Dmanda
git pull
npm install
```

Conferir que veio tudo:
```
git log --oneline -5
```
O commit mais recente deve ser o do SINCRONIZA-PROJETINHO (logo acima de `4066962`).

Ver o protótipo (dentro da pasta do projeto):
```
cd prototipo
python -m http.server 7200
```
Abrir http://127.0.0.1:7200 e clicar em "D Catalyst". Se algo parecer antigo, Ctrl+F5.

Ver o sistema em desenvolvimento (opcional, ainda é o design antigo): `npm run dev` e abrir http://localhost:7100.

## 4. O que NÃO vem pelo Git e precisa ser refeito em casa

- **Memória do Claude:** é local de cada computador. O Claude recria a partir de `CLAUDE.md`, `DECISOES.md` e `PENDENCIAS.md`.
- **MCP do Figma** (só se for mexer no Figma). **No PowerShell, dentro da pasta do projeto:**
  ```
  claude mcp add --transport http figma https://mcp.figma.com/mcp
  ```
  Depois reiniciar o Claude Code e autenticar digitando `/mcp` e escolhendo figma.
- **Plugins e skills** (instalar só se precisar): `taste-skill` (marketplace `Leonxlnx/taste-skill`), `ui-ux-pro-max` (marketplace `nextlevelbuilder/ui-ux-pro-max-skill`), plugin `context7` e o Playwright. As três skills do Superpowers já vêm no Git, em `.claude/skills/`.
- **`.env.local`:** nunca vai para o Git. Hoje o sistema ainda não precisa dele.
- **Sem instaladores que peçam administrador** (regra da máquina do trabalho; em casa vale a regra de custos: nada além de Claude Pro e ChatGPT Plus).

## 5. Prompt para colar no Claude Code, em casa

Abrir o Claude Code dentro da pasta do Dmanda e colar:

```
Estou continuando o projeto Dmanda em outro computador. Antes de qualquer coisa:
1. Rode git pull e confirme que o último commit inclui o SINCRONIZA-PROJETINHO.md.
2. Leia CLAUDE.md, DECISOES.md, PENDENCIAS.md, ANDAMENTO.md e SINCRONIZA-PROJETINHO.md.
3. Recrie a memória local (usuário único admin, regras de custo e máquina, nunca fazer push sem minha autorização, terminar toda resposta com "Andamento do projeto: X%").
4. Suba o protótipo (python -m http.server 7200 dentro de prototipo) e me avise.

Onde paramos: o tema Catalyst (quarto tema, estilo nativo iOS 27 com Liquid Glass) está pronto no protótipo, testado em todas as telas, e aguarda minha avaliação. Vou dizer o que ainda destoa. Depois disso, o próximo passo do Claude é a página de peças com os cinco estados (normal, foco, desativado, carregando, erro) para os temas e a conferência de contraste, e então começar a construção real (base técnica, login Google, Vercel, versão mínima de Demandas e Início), na ordem de DECISOES.md.

Regras: tudo em português do Brasil, sem travessão, commits em português a cada avanço, testar no navegador de verdade (Playwright) antes de dizer que está pronto, e avisar em negrito quando eu tiver que fazer algo fora do Claude Code.
```

## 6. Ordem sugerida para a próxima sessão

1. Sincronizar (seção 3) e rodar o protótipo.
2. Avaliar o Catalyst e listar os ajustes.
3. Claude aplica os ajustes e repete os testes de clique, contraste e layout (script de teste foi descartado, mas o método está descrito acima: clicar em cada controle a partir de um estado limpo e comparar o efeito).
4. Testar o que ficou pendente (Grafite, Quadro no celular, Agenda no Grafite, iPad horizontal).
5. Escolher os padrões de cada tema e seguir para a página de peças.
