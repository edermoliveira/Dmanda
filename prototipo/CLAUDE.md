# Protótipo

Carregado só quando se trabalha dentro de `prototipo/`. Fica isolado do `src/`.

Testes (rodar dentro de `prototipo`, usam o Edge instalado, sem servidor à parte; servir por http, o Playwright bloqueia `file://`):

```
node testes/fluxos.mjs                          (fluxos principais, cerca de 1 minuto)
node testes/clicar-tudo.mjs d claro desktop     (cliques, contraste e layout de um tema, cerca de 5 minutos)
node testes/clicar-tudo.mjs                     (Catalyst, claro e escuro, computador e celular)
node testes/menu.mjs                            (Mostrar menu: mostrar, navegar, voltar, recolher, recarregar)
node testes/consolidacao.mjs                    (Catalyst único, endereços antigos, sete ícones de navegação, erros de recursos)
node testes/ipad-botoes.mjs                     (botões só com ícone de Demandas no iPad vertical e nos limites 520/521 e 899/900 px)
node testes/energia.mjs                         (os cinco SVGs de energia: carregamento, nível certo, claro e escuro)
node testes/perfil-pomodoro.mjs                 (avatar do Perfil e Pomodoro em cinco larguras)
node testes/ipad-cards.mjs                      (duas colunas de cards de 640 a 899 px, uma coluna no celular)
node testes/agenda-demandas.mjs                 (itens de demanda da Agenda: sigla, cor, abrir pelo identificador)
node testes/quadro.mjs                          (Quadro: colunas, filtros, mover por menu, mouse e toque)
node testes/fundo.mjs                           (fundo: cor, imagem, desfoque, persistência, falhas)
node testes/checkbox.mjs                        (caixas de marcar das tarefas)
node testes/card-faixa.mjs                      (cards atrasados sem faixa lateral, com contorno e progresso)
node testes/config-layout.mjs                   (Configurações: painéis em colunas, opções que aplicam)
node testes/perfil-historico.mjs                (histórico do Perfil: colunas por dia, Humor e Energia)
node testes/icones-busca-filtros.mjs            (ícones Ionicons de busca, filtros, ordenação e expansão)
node testes/icones-visualizacoes.mjs             (ícones Ionicons das visualizações de Demandas)
node testes/selo-legal.mjs                     (contraste do selo Legal nas dez paletas)
node testes/form-demanda.mjs                    (cadastro e edição de demandas: grupos, rodapé, salvar, cancelar, rascunho)
node testes/preservar-catalyst.mjs comparar testes/referencias/catalyst-cd7b03f.json.gz  (78 telas contra a referência aprovada; `gravar` cria outra)
node verificar-cores.mjs                        (nenhum branco ou preto absoluto)

Verificação proporcional: ao mudar o protótipo, rodar o teste do componente afetado (por exemplo `form-demanda.mjs` para o formulário, `quadro.mjs` para o Quadro). `clicar-tudo.mjs` e `preservar-catalyst.mjs` só quando a mudança for ampla ou houver dúvida de regressão visual. Não regravar a referência visual para eliminar diferenças.
