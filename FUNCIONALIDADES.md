# FUNCIONALIDADES – Mapa do Dmanda

Base: `PRODUTO.md`, `PESQUISA.md` e `REFERENCIAS.md`. Só o mapa, sem código.

**Quem usa:** o **admin**, que é você, o único usuário. Todas as funções abaixo são do admin. Não existe equipe, e por isso não há perfis, convites, atribuição a pessoas nem comentários.

**Onde usa:** todas as telas funcionam no **computador e no celular** (a tela se adapta ao tamanho). O aplicativo para iPhone (iOS) fica para o futuro.

**Regra para todas as telas:** o que você está digitando é **guardado automaticamente**. Se atualizar a página ou fechar sem querer, nada se perde.

---

## 1. Funções por tela

### Tela do dia (primeira tela)
- Ver quantas demandas estão atrasadas, para hoje e nos próximos 7 dias.
- Ver a lista "minhas demandas" separada em atrasadas, hoje e próximos dias.
- Ver as demandas em "Aguardando retorno", com o setor e há quantos dias estão paradas.
- Abrir uma demanda a partir da lista.
- Marcar uma demanda como concluída.
- Cadastrar demanda nova (cadastro rápido).

### Quadro
- Criar quadro.
- Renomear e arquivar quadro.
- Criar, renomear e reordenar colunas. O quadro padrão vem com 5: **Entrada, Triada, Fazendo, Aguardando retorno, Finalizado** (ver seção 3).
- Criar card (cadastro rápido, em qualquer coluna).
- Mover card entre colunas.
- Ver a contagem de cards por coluna.
- Filtrar o quadro (por prazo, por origem, só atrasadas).

### Card aberto
- Editar número, assunto e origem.
- Escolher o **tipo de documento** com um clique (processo, memorando, ofício, reunião ou pedido pessoal). É opcional.
- Criar um tipo novo na hora, sem sair do card, quando surgir um documento que não se encaixa.
- Definir o prazo e dizer se é **legal** ou **próprio**.
- Registrar a data de chegada na Secretaria.
- Ver há quantos dias a demanda está parada.
- Criar, marcar e ordenar tarefas (passos).
- Mover para "Aguardando retorno" e dizer de qual setor (DP, PGM, Gabinete etc.).
- Marcar o retorno do outro setor (a demanda volta para "Fazendo").
- Concluir a demanda (quando sai da Secretaria).
- Reativar uma demanda que voltou à Secretaria.
- Editar **qualquer campo** a qualquer momento (número, assunto, origem, tipo, prazo, tipo de prazo, data de chegada, coluna, tarefas). O sistema ajusta o que depende dele (ver "Edição" abaixo).
- Arquivar a demanda direto, com um botão presente em todos os cards, em qualquer coluna.
- Remover a demanda: o sistema pergunta se quero **arquivar** ou **excluir definitivamente**. A exclusão definitiva pede uma segunda confirmação.

### Lista
- Ver todas as demandas em linhas, **ordenadas por prazo**.
- Agrupar por coluna.
- Marcar como concluída direto na linha.
- Filtrar por prazo legal, prazo próprio ou sem prazo.

### Calendário
- Ver os prazos de todos os quadros no mês.
- Arrastar uma demanda para outro dia (muda o prazo).
- Ver a área "sem prazo".
- Dar prazo a uma demanda sem prazo.
- Distinguir prazo legal, prazo próprio, vencido e concluído.

### Busca
- Buscar por número, assunto ou origem em todos os quadros.

### Edição (vale para todos os campos)
- Qualquer campo pode ser corrigido, e o sistema **entende a mudança e age de acordo**. Exemplos:
  - Troquei o tipo de "processo" para "memorando": o card passa a ser tratado e filtrado como memorando.
  - Mudei o prazo: o card muda de lugar no calendário e de grupo na tela do dia (por exemplo, de "próximos 7 dias" para "atrasadas").
  - Troquei o prazo de próprio para legal (ou o contrário): a marca de prazo muda e o filtro de prazos legais passa a incluí-lo ou deixá-lo de fora.
  - Corrigi o número: a busca e a lista passam a achá-lo pelo número novo.
  - Mudei a data de chegada: os dias parados são recalculados.
  - Mudei a coluna: os dias em "Aguardando retorno" e o grupo na tela do dia se ajustam.
- Editar o prazo de uma demanda sem prazo tira o prazo automático de 30 dias.

### Arquivo
- Botão **"Arquivo"** ao final dos cards (ao final do quadro), que abre um lugar separado.
- Ali ficam as demandas arquivadas, **concluídas ou não**.
- As arquivadas **não aparecem** na tela do dia, no calendário nem na lista, e nunca contam como atrasadas.
- Buscar dentro do Arquivo.
- Abrir uma demanda arquivada para consulta.
- Desarquivar (devolver ao quadro).
- Excluir definitivamente a partir do Arquivo.

### Tipos de documento
- Ver a lista de tipos.
- Adicionar um tipo novo.
- Renomear um tipo.
- Ocultar ou apagar um tipo que não uso mais (as demandas antigas mantêm o tipo que tinham).

### Rascunhos (guardar o que está sendo digitado)
- Guardar automaticamente um cadastro ou uma edição que ainda não foi salva.
- Ao reabrir o sistema, voltar ao ponto em que parei e mostrar o que ficou pendente.
- Descartar um rascunho que não quero mais.

---

## 2. A jornada de uma demanda

1. **Chega.** Um processo, memorando, ofício ou pedido chega por papel, e-mail, WhatsApp ou reunião.
2. **Cadastro rápido (Entrada).** Você registra só número, prazo, assunto e origem, de manhã ou na hora, e pode marcar o tipo de documento. Se não há prazo, o sistema põe **30 dias automáticos** a partir da chegada, e você pode mudar.
3. **Prazo.** Marca-se se é prazo legal (TCE, Câmara, MP, Judiciário) ou próprio. O prazo legal prevalece.
4. **Triada.** Você dá uma olhada mais detalhada, classifica e define as tarefas (por exemplo: pedir informações ao DP, analisar, enviar ao Gabinete). Ainda não começou a trabalhar nela.
5. **Fazendo.** Quando você começa a trabalhar nela, vai para "Fazendo". Na tela do dia ela aparece em atrasadas, hoje ou próximos 7 dias.
6. **Aguardando retorno.** Se ela fica com você esperando informação externa, vai para "Aguardando retorno", com o nome do setor, e começa a contar os dias parada.
7. **Retorno.** Quando a resposta volta, você marca o retorno e a demanda volta para "Fazendo".
8. **Análise e decisão.** Você analisa e elabora o documento (fora do sistema, na primeira versão).
9. **Finalizado.** A análise está concluída: arquivamento, encaminhamento a outro setor ou outro andamento. A demanda **sai da Secretaria** e vai para "Finalizado".
10. **Reativação.** Se o processo voltar, a demanda antiga é reaberta, com o histórico e as tarefas anteriores.

---

## 3. Fatias, da mais importante para a menos importante

**Fatia 1 – Registrar e ver o dia (dores 1 e 3)**
- Cadastro rápido (4 campos) e tipo de documento opcional.
- Prazo com tipo (legal / próprio) e 30 dias automáticos, editáveis.
- Tela de cadastro que limpa os campos a cada demanda, para a carga inicial em sequência.
- Guardar automaticamente o que está sendo digitado (rascunhos).
- Funcionar no computador e no celular.
- Editar qualquer campo de uma demanda, com o sistema ajustando o que depende dele.
- Tela do dia: atrasadas, hoje, próximos 7 dias.
- Concluir demanda.
- Carga inicial de tudo o que você tem hoje, cadastrando em sequência.

**Fatia 2 – Etapas e espera (dor 2)**
- Quadro com as 5 colunas e mover card.
- "Aguardando retorno", com nome do setor e dias parados.
- Marcar retorno.

**Fatia 3 – Passos dentro da demanda**
- Tarefas com progresso dentro do card.
- Reativar demanda que voltou.
- Registrar a data de chegada na Secretaria.
- Adicionar, renomear e ocultar tipos de documento.
- Remover demanda: perguntar "arquivar ou excluir definitivamente".
- Arquivo (botão ao final dos cards), com busca, desarquivar e exclusão definitiva.

**Fatia 4 – Outras formas de ver**
- Lista ordenada por prazo.
- Calendário com todos os prazos e área "sem prazo".
- Arrastar para mudar o prazo.

**Fatia 5 – Achar rápido**
- Busca por número, assunto e origem.
- Filtros (atrasadas, legais, por origem).

**Depois (conforme `PRODUTO.md`)**
- Rascunho de reunião.
- Gerar documento a partir de modelo .docx.
- Relatórios.
- Integrações (e-mail, WhatsApp).
- Aplicativo para iPhone (iOS).

---

## 4. Decisões já tomadas

**Colunas do quadro padrão**
1. **Entrada:** recém-cadastrada.
2. **Triada:** olhada com mais detalhe e classificada, ainda sem trabalho feito.
3. **Fazendo:** em trabalho agora.
4. **Aguardando retorno:** fica com você, esperando informação externa. Mostra o setor e os dias parados.
5. **Finalizado:** análise concluída (arquivamento, encaminhamento ou outro andamento).

**Outras decisões**
- Aguardando outro setor é uma **coluna**, e não uma marca no card.
- Sem prazo, entram **30 dias automáticos**, editáveis.
- Carga inicial: digitar um por um, rápido, numa tela que se limpa a cada demanda.
- Categoria = **tipo de documento** (processo, memorando, ofício, reunião ou pedido pessoal), de um clique e opcional. "O que precisa ser feito" fica nas tarefas e no assunto, e não é categoria.

- Remover uma demanda: o sistema pergunta se quer **arquivar** ou **excluir definitivamente**. Só a segunda opção apaga de verdade, como se nunca tivesse dado entrada. Arquivar manda para o **Arquivo**.

- Arquivar é **sempre manual**: nada vai para o Arquivo sozinho, nem as demandas em "Finalizado".
- **Todo card** tem um botão "Arquivar", em qualquer coluna, finalizado ou não.
- A exclusão definitiva pede uma **segunda confirmação**, por não ter volta.

## 5. Pontos ainda em aberto
- Detalhes de aparência e de nomes de botões ficam para a etapa das telas.
