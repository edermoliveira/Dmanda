---
name: dmanda-design-por-referencias
description: Use em todo pedido de redesenho de tela do Dmanda que traga referências (prints, imagens, descrição). As referências orientam a estrutura e a apresentação da tela, dentro da identidade Catalyst. Exige um desenho renderizado e aprovado antes da implementação completa. Não use para polimento pontual.
---

# Design do Dmanda por referências

Única skill de design ativa no Dmanda. Sem pacote externo, sem scripts, sem permissões adicionais. Texto em português do Brasil, sem travessão.

## Quando usar

- **Redesenho** de tela ou fluxo em que o Éder envia referências. Siga o fluxo abaixo.
- **Polimento pontual expresso** (ajustar espaçamento, cor, texto, um controle): siga o fluxo habitual do projeto, sem protótipo prévio.

## O que as referências mandam

As referências definem a **estrutura e a apresentação** da tela. Não são inspiração de "clima". A tela atual é ponto de partida para os dados e as regras, não para a composição.

1. **Abra todas as referências** (Read, uma por imagem, pelo nome real do arquivo). Diga quais abriu e quais faltam.
2. Para cada referência, escreva em poucas linhas o que ela muda em:
   - **composição** (onde ficam as áreas e qual é a área principal);
   - **hierarquia** (o que lidera, o que apoia);
   - **densidade** (quanto cabe por tela, como se agrupa);
   - **navegação** (como se troca de visão, data ou nível);
   - **apresentação dos itens** (forma da linha, do cartão, da pílula, do rótulo).
3. A estrutura da tela pode ser **redesenhada por inteiro** dentro do escopo pedido. Não reaproveite o leiaute atual por comodidade.

## O que o Catalyst fixa (não muda)

Tokens e cores semânticas (acento, `--perigo` só para atrasado ou crítico, azul de evento, amarelo de demanda), as três famílias tipográficas e a escala `calc(Npx * var(--esc))`, vidro e cantos do Catalyst, claro e escuro, alvos de toque de 44 px, os cinco estados por peça (normal, foco, desativado, carregando, erro) e as regras do `CLAUDE.md`. Não copie cor, fonte nem marca das referências: copie a **estrutura**.

## Antes de implementar: o desenho renderizado

Entregue **um recorte renderizado ou um protótipo navegável com dados fictícios**, nunca só uma descrição:

1. Monte a proposta com os tokens do Catalyst (HTML solto em `.dados-teste/` ou prévia fictícia), sem tocar no código da aplicação.
2. Mostre **lado a lado**: referência, tela atual e proposta, em uma única imagem (ou página), na mesma escala, nas larguras que importam (computador e celular, no mínimo).
3. Acrescente **poucos apontamentos** (no máximo cinco) sobre o que mudou na estrutura, cada um dizendo antes e depois.
4. **Teste de semelhança:** se a proposta ainda reproduz predominantemente a composição antiga (mesmas áreas, mesma ordem, mesma forma dos itens), **refaça antes de apresentar**. Não peça aprovação de um desenho que você mesmo reconhece como o antigo com retoques.
5. Pare e **aguarde a aprovação do Éder** do desenho renderizado.

## Depois da aprovação

1. Implemente a tela completa a partir do desenho aprovado.
2. Registre **separadamente** em `DECISOES.md`: (a) a aprovação da **direção visual** (data, o que foi aprovado) e (b) os **testes funcionais** (suítes, medições, o que depende de aparelho real). Passar nos testes nunca vale como aprovação visual.
3. Capturas minhas não substituem a avaliação do Éder.
4. Desenho reprovado fica fora de qualquer entrega aprovada e não vira base do próximo.

## Limites

- Esta skill não escolhe nova identidade nem paleta: o Catalyst é único.
- Não instale pacotes, plugins nem MCPs de design por conta própria.
- Não faça push, PR, deploy nem toque no Supabase real por causa de um redesenho.
