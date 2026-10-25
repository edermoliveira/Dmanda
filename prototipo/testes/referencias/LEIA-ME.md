# Referência visual do Catalyst

**Arquivo:** `catalyst-cd7b03f.json.gz` (compactado; SHA-256 começa com `beb1a8d424bfec04`).
**Commit de origem:** `cd7b03f`, o estado que o usuário aprovou visualmente em 24/10/2026 (cards sem faixa lateral, Configurações, histórico do Perfil, formulário de demandas, selo Legal e rodapé do celular). Gerada com a árvore limpa nesse commit.

**Cenários cobertos (78):** modos claro e escuro × três aparelhos (Computador de 1360 px, iPad vertical de 820 px e Celular de 390 px) × 13 telas: Início, Entradas, Demandas (cards, quadro, tabela e lista), Agenda (semana e mês), Documentos, IA, Configurações, Arquivo e Mais. Cada cenário recarrega a página e confirma tela, visualização, aparelho, modo e largura antes de medir (o script aborta se medir outra coisa).
**Não cobertos:** iPad horizontal e Janela média, janelas e menus abertos (formulários, Perfil, menu "Mover para"), estados com imagem de fundo ou cor de fundo, e outras paletas além da padrão.

**Como usar** (dentro de `prototipo`): `node testes/preservar-catalyst.mjs comparar testes/referencias/catalyst-cd7b03f.json.gz`. Para gravar outra: `... gravar testes/referencias/<nome>.json.gz`.
**Conferência de geração (24/10/2026):** comparar contra o próprio estado de `cd7b03f` deu 78 telas sem diferenças, saída 0.

**Valor:** esta referência passa a orientar as comparações futuras. Mudança visual intencional deve ser classificada e só então se grava outra referência, nunca para eliminar diferenças. A comparação antiga (contra `dd3bf3c`, das 6.682 diferenças) **não** foi aprovada retroativamente e segue com as limitações registradas em `PENDENCIAS.md`.
