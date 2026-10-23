# PRODUTO: Dmanda

Atualizado em 22/10/2026 com as decisões de `DECISOES.md`.

## O problema
O Secretário de Administração recebe demandas por vários canais e hoje não registra nada fixo. Por isso esquece o que é importante mas não urgente, perde de vista o que mandou para outro setor (PGM, DP, Gabinete) e só vê um prazo quando alguém cobra. Com TDAH, uma lista simples não ajuda: ele escolhe pelo que é interessante, e não pelo que vence primeiro. Ainda sente desgaste pessoal por achar que "nunca dá conta".

## Para quem é
Para **uma pessoa só**: o Secretário, no trabalho e na organização pessoal. Existe um único papel, o **admin** (o próprio Secretário). Não há equipe, convite nem comentário. Há um **Perfil** pessoal e privado.

## O que o sistema tem (sete áreas)
1. **Início:** quantitativos, demandas em atraso, alertas, "foco do dia" (até 3 demandas), mensagem motivacional e bem-humorada (uma por dia), clima da cidade e acesso rápido ao humor.
2. **Entradas:** notas rápidas em post-its pastel (rascunhos, anotações, registros). Uma nota pode virar demanda, abrindo o cadastro já preenchido.
3. **Demandas:** o coração do sistema. Cards de dois lados (frente com o essencial, verso com detalhes), nas visões Cards, Quadro, Tabela e Lista. Cinco etapas: Cadastro, Vistos, Fazendo, Aguardando retorno, Finalizado. Tarefas dentro de cada demanda, com porcentagem pronta.
4. **Agenda:** semana e mês. Demandas aparecem no vencimento (amarelo) e compromissos na grade de horários (azul). Sincroniza do Dmanda para o Google Calendar.
5. **Documentos:** modelos e arquivos ligados ao Google Drive (estrutura pronta na primeira versão).
6. **IA:** "estagiária" que responde em português, resume o dia e executa ações (com desfazer; excluir só com confirmação).
7. **Configurações:** 10 paletas (claro e escuro), 5 fontes, tamanhos em tempo real, conta Google, IA, Perfil e outras.

Mais: **Arquivo** (página à parte), **Perfil** (avatar no topo), **botão "+"** flutuante (nova entrada, demanda, tarefa, evento, documento, chat) e **busca global** (lupa no canto superior direito).

## Regras de negócio que continuam
- Cadastro rápido com **número, prazo, assunto e origem**, e tipo de documento opcional (processo, memorando, ofício, reunião, pedido pessoal; ampliável).
- Prazo **legal** (TCE, Câmara, MP, Judiciário) prevalece sobre o **próprio**. Sem prazo, o sistema põe 30 dias automáticos, editáveis.
- Em **Aguardando retorno** aparecem o setor e os dias parado.
- Todo campo é editável e o sistema se ajusta à mudança.
- Remover uma demanda: **arquivar** (vai para o Arquivo) ou **excluir definitivamente** (segunda confirmação). Arquivar é sempre manual.
- O que está sendo digitado é guardado sozinho.

## Humor, energia e produtividade (Perfil)
Registro leve de humor e energia (balões discretos, cerca de 4 por dia, correção até 5 dias depois) e produtividade calculada pelas demandas finalizadas. Sem metas, sem cobrança, sem classificar dia como bom ou ruim. É uma ferramenta de autoconhecimento, não um tratamento. Dado de humor é privado e nunca vai para a IA sem permissão.

## Onde vai morar
Desenvolvido local e publicado na **Vercel com login Google** assim que existir a versão mínima de Demandas. Instalável no iPhone e iPad como **PWA**. O app nativo da App Store fica para depois.

## Depois (fora das primeiras versões)
- Gerar documentos (memorando, portaria etc.) a partir de modelo .docx com cabeçalho, marca d'água e rodapé.
- Relatórios.
- Integrações com e-mail e WhatsApp, e calendário da Apple.
- App nativo para iPhone e iPad (conta Apple Developer, IA paga, referências de apps).
- Entrada por voz e foto, uso offline completo.

## Cuidados que valem para tudo
- Poucos campos e poucas cores por tela. Cor forte só para o que é atrasado ou crítico. (Exceções combinadas: post-its pastel em Entradas e cores de demanda e evento na Agenda.)
- Cadastro rápido nunca pode virar formulário grande, senão vira outra planilha abandonada.
- Funcionar bem no celular, no iPad e no computador, com computador primeiro.
- Texto sobre vidro precisa ser legível. Cards de demanda mais sólidos. Janelas e caixas de preenchimento quase opacas (claras no modo claro, escuras no escuro).
- Três temas definitivos (Aurora, Papel e Grafite), cada um com claro e escuro e com cores, fontes, ícones e tamanhos ajustáveis.
- Nada de mensagem de cobrança, culpa ou alerta negativo sobre o próprio usuário.
