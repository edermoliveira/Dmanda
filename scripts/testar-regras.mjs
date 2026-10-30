// Regras puras de datas e grupos do Início (src/lib/demandas.ts) e de Entradas (src/lib/entradas.ts), sem navegador nem banco. Uso: node scripts/testar-regras.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emailAutorizado, contaAutorizada, situacaoDoErroAuth, ehCookieDeSessao, COOKIE_LEGADO_ULTIMO_USO } from '../src/lib/sessao.ts';
import { ajustarPrazo, prazoPorDias, somarDias, diaDaSemana, nomeDoDia, BOTOES_PRAZO } from '../src/lib/prazos.ts';
import { googleLigado } from '../src/lib/login.ts';
import { segredoConfere, executarRotinaDiaria } from '../src/nucleo/rotina.ts';
import { dataFiltro, grupoFiltro, porGrupo, focoDoDia, atrasada, diasAte, permanencia, numeroDe, origemDe, titulo, filtrar, FILTRO_VAZIO } from '../src/lib/demandas.ts';
import { validarDados, validarDia, validarEntrada } from '../src/nucleo/validacao.ts';
import { estadoDe, tagsDe, semTags, resumoDe, temTitulo, contarTags, filtrarEntradas, ordenarEntradas, paraDemanda, diferencas, vazia, camposEmConflito, carimbo, QTD_CORES } from '../src/lib/entradas.ts';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const hoje = '2026-10-25';
const d = (id, o) => ({ id, etapa: 'Fazendo', prazo: null, acompanhar_em: null, chegou_em: '2026-10-01', tipo: 'Memorando', prazo_tipo: 'Próprio', ...o });
const lista = [
  d('venc', { prazo: '2026-10-20' }), d('hoje', { prazo: hoje }), d('em3', { prazo: '2026-10-28' }), d('em8', { prazo: '2026-11-02' }),
  d('semprazo', {}), d('fin', { prazo: '2026-10-01', etapa: 'Finalizado' }),
  d('ag-longe', { etapa: 'Aguardando retorno', prazo: '2026-10-26', acompanhar_em: '2026-11-10' }),
  d('ag-perto', { etapa: 'Aguardando retorno', acompanhar_em: '2026-10-27' }),
  d('ag-sem', { etapa: 'Aguardando retorno', prazo: '2026-10-26' }),
  d('ag-venc', { etapa: 'Aguardando retorno', acompanhar_em: '2026-10-22' }),
];
ok(diasAte('2026-10-28', hoje) === 3 && diasAte('2026-10-20', hoje) === -5, 'diasAte conta dias corridos a partir da data de hoje recebida');
ok(atrasada(lista[0], hoje) && !atrasada(lista[1], hoje) && !atrasada(lista[5], hoje) && !atrasada(lista[4], hoje), 'atrasada: só prazo vencido, nunca finalizada nem sem prazo');
ok(dataFiltro(lista[4], hoje) === null && dataFiltro(lista[5], hoje) === null, 'sem prazo e finalizada ficam fora dos filtros (nada é inventado)');
ok(dataFiltro(lista[6], hoje) === null && dataFiltro(lista[8], hoje) === null, 'aguardando retorno longe do acompanhamento ou sem acompanhamento não volta aos filtros');
ok(dataFiltro(lista[7], hoje) === '2026-10-27', 'aguardando retorno volta quando faltam 3 dias ou menos para o acompanhamento');
ok(porGrupo(lista, 'atrasadas', hoje).map((x) => x.id).join() === 'venc,ag-venc'.split(',').sort((a, b) => diasAte(dataFiltro(lista.find((l) => l.id === a), hoje), hoje) - diasAte(dataFiltro(lista.find((l) => l.id === b), hoje), hoje)).join(), 'atrasadas, da mais antiga para a mais recente (inclui o acompanhamento vencido)');
ok(porGrupo(lista, 'hoje', hoje).map((x) => x.id).join() === 'hoje', 'hoje: só o que vence hoje');
ok(porGrupo(lista, 'sete', hoje).map((x) => x.id).join() === 'ag-perto,em3', 'próximos 7 dias: de 1 a 7 dias, na ordem de proximidade (em8 fica de fora, hoje não repete)');
ok(focoDoDia(lista, hoje).map((x) => x.id).join() === 'venc,ag-venc,hoje', 'Foco do dia: no máximo 3, atrasadas antes de hoje');
// sessão (decisão 27): a sessão persiste; nada de encerramento por inatividade. A regra só classifica o resultado da conferência no Auth.
ok(situacaoDoErroAuth(null) === 'ok' && situacaoDoErroAuth(undefined) === 'ok', 'sessão: sem erro, a conferência está ok');
ok(situacaoDoErroAuth({ name: 'AuthSessionMissingError' }) === 'sem-sessao', 'sessão: a falta de sessão é reconhecida (primeira visita ou sessão removida)');
ok(situacaoDoErroAuth({ name: 'AuthRetryableFetchError', status: 0 }) === 'transitoria' && situacaoDoErroAuth({ status: 500 }) === 'transitoria' && situacaoDoErroAuth({ status: 503 }) === 'transitoria' && situacaoDoErroAuth({ status: 429, code: 'over_request_rate_limit' }) === 'transitoria' && situacaoDoErroAuth({ status: 0 }) === 'transitoria', 'sessão: falha de rede, erro 5xx e limite de requisições são transitórios (nunca apagam nem liberam a sessão)');
ok(situacaoDoErroAuth({ name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' }) === 'invalida' && situacaoDoErroAuth({ name: 'AuthApiError', status: 400, code: 'refresh_token_already_used' }) === 'invalida' && situacaoDoErroAuth({ name: 'AuthApiError', status: 403, code: 'session_not_found' }) === 'invalida' && situacaoDoErroAuth({ status: 401, code: 'bad_jwt' }) === 'invalida', 'sessão: token de renovação inexistente ou já usado, sessão revogada e token inválido são sessão inválida (pede novo login)');
ok(ehCookieDeSessao('sb-gmxoosvgfcydccyeudej-auth-token') && ehCookieDeSessao('sb-abc-auth-token.0') && ehCookieDeSessao('sb-abc-auth-token.12') && !ehCookieDeSessao('sb-abc-auth-token-code-verifier') && !ehCookieDeSessao(COOKIE_LEGADO_ULTIMO_USO) && !ehCookieDeSessao('outro'), 'sessão: reconhece os cookies de sessão do Supabase (inteiro e em pedaços) e não confunde com o carimbo antigo');
ok(emailAutorizado('Secretario@Exemplo.com', 'secretario@exemplo.com') && !emailAutorizado('outro@exemplo.com', 'secretario@exemplo.com') && !emailAutorizado('a@b.c', undefined) && !emailAutorizado(null, 'a@b.c'), 'e-mail autorizado: confere sem diferenciar maiúsculas; sem configuração ninguém entra');
ok(grupoFiltro(lista[0], hoje) === 'atrasadas' && grupoFiltro(lista[1], hoje) === 'hoje' && grupoFiltro(lista[2], hoje) === 'sete' && grupoFiltro(lista[3], hoje) === null && grupoFiltro(lista[4], hoje) === null, 'grupoFiltro: atrasadas, hoje, próximos 7 dias; depois disso e sem prazo ficam fora');
ok(contaAutorizada({ email: 'Eu@Exemplo.com', app_metadata: { provider: 'google' } }, 'eu@exemplo.com'), 'conta autorizada: e-mail certo entrando pelo Google');
ok(contaAutorizada({ email: 'Eu@Exemplo.com', app_metadata: { provider: 'email' } }, 'eu@exemplo.com'), 'conta autorizada: e-mail certo entrando por e-mail e senha');
ok(!contaAutorizada({ email: 'eu@exemplo.com', app_metadata: { provider: 'github' } }, 'eu@exemplo.com') && !contaAutorizada({ email: 'eu@exemplo.com', app_metadata: { provider: 'anonymous' } }, 'eu@exemplo.com') && !contaAutorizada({ email: 'eu@exemplo.com' }, 'eu@exemplo.com') && !contaAutorizada({ email: 'outro@exemplo.com', app_metadata: { provider: 'google' } }, 'eu@exemplo.com') && !contaAutorizada(null, 'eu@exemplo.com') && !contaAutorizada({ email: 'eu@exemplo.com', app_metadata: { provider: 'google' } }, undefined), 'conta autorizada: provedor fora de Google e e-mail e senha, sem provedor, outro e-mail, sem usuário ou sem configuração são recusados');
ok(googleLigado('sim') && googleLigado(' SIM ') && !googleLigado(undefined) && !googleLigado('') && !googleLigado('nao') && !googleLigado('true') && !googleLigado('1'), 'botão do Google: oculto por padrão (variável ausente, vazia, "nao" ou outro valor) e visível só com "sim"');

// Pré-carregar páginas com <Link> ou router.prefetch faria o servidor conferir e renovar a sessão sem ninguém estar usando o painel.
// O aplicativo em uso não faz isso: o teste garante que continue assim. As páginas do design antigo (src/app/(antigo)) e src/components ficam fora (só referência, atrás do login).
{
  const achados = [];
  const ler = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const c = join(dir, e.name); if (e.isDirectory()) { if (!/antigo|components/.test(e.name)) ler(c); } else if (e.name !== 'proxy.ts' && /\.(tsx?|mjs)$/.test(e.name) && /next\/link|router\.prefetch|prefetch\s*[=:(]/.test(readFileSync(c, 'utf8'))) achados.push(c); } };
  ler('src');
  ok(achados.length === 0, 'sessão: nenhum <Link> nem router.prefetch no aplicativo em uso (pré-carregar faria o servidor mexer na sessão sem ninguém usar)' + (achados.length ? ': ' + achados.join(', ') : ''));
}
// rotina diária: segredo e tratamento de falha
const seg = 'segredo-de-teste-com-mais-de-16';
ok(segredoConfere('Bearer ' + seg, seg), 'rotina: o segredo correto confere');
ok(!segredoConfere('Bearer outro-segredo-qualquer-xx', seg) && !segredoConfere(seg, seg) && !segredoConfere(null, seg) && !segredoConfere('', seg), 'rotina: segredo errado, sem "Bearer" ou ausente não confere');
ok(!segredoConfere('Bearer ', '') && !segredoConfere('Bearer ', undefined) && !segredoConfere('Bearer curto', 'curto'), 'rotina: sem segredo configurado, ou com segredo curto demais, nada confere');
{
  const chamadas = [];
  const bom = async (f, a) => { chamadas.push([f, a]); return { data_ref: '2026-10-25', usuarios: 1 }; };
  const r1 = await executarRotinaDiaria(bom);
  ok(r1.usuarios === 1 && chamadas.length === 1 && chamadas[0][0] === 'rotina_diaria', 'rotina: sucesso chama só a função da rotina, sem registrar falha');
  const log = [];
  const ruim = async (f, a) => { log.push([f, a]); if (f === 'rotina_diaria') throw Object.assign(new Error('boom: dado pessoal Fulano 123'), { code: 'XX000' }); return null; };
  let erro = null; try { await executarRotinaDiaria(ruim); } catch (e) { erro = e; }
  ok(erro && log.length === 2 && log[1][0] === 'registrar_falha_rotina' && /XX000/.test(log[1][1].p_erro) && !/Fulano|boom/.test(log[1][1].p_erro), 'rotina: a falha é registrada com mensagem curta, sem o texto do erro, e o erro sobe ao agendador');
  const fora = async () => { throw new Error('banco fora do ar'); };
  let erro2 = null; try { await executarRotinaDiaria(fora); } catch (e) { erro2 = e; }
  ok(erro2 && /banco fora do ar/.test(erro2.message), 'rotina: se nem o registro da falha for possível, o erro original sobe');
}

// ---------- prazos (decisão 27): regras puras, sem relógio ----------
const nenhum = [];
const dia = (data, descricao, categoria = 'Feriado', id = descricao) => ({ id, data, descricao, categoria, criado_em: '2027-01-01T00:00:00Z' });
ok(somarDias('2027-03-04', 5) === '2027-03-09' && somarDias('2027-02-26', 3) === '2027-03-01' && somarDias('2028-02-28', 2) === '2028-03-01' && somarDias('2027-12-30', 3) === '2028-01-02' && somarDias('2027-03-04', -4) === '2027-02-28', 'prazos: somar dias corridos atravessa mês, ano bissexto e virada de ano sem deslocar o dia');
ok(diaDaSemana('2027-03-06') === 6 && diaDaSemana('2027-03-07') === 0 && diaDaSemana('2027-03-08') === 1 && nomeDoDia('2027-03-06') === 'sábado', 'prazos: dia da semana por data pura (sem fuso)');
ok(BOTOES_PRAZO.join() === '5,10,20,30', 'prazos: os botões são de 5, 10, 20 e 30 dias');
ok(prazoPorDias(5, '2027-03-04') === '2027-03-09' && prazoPorDias(30, '2027-03-04') === '2027-04-03', 'prazos: os botões somam 5, 10, 20 ou 30 dias corridos a partir de hoje (exclui o dia inicial, inclui o último), nunca a partir da chegada');
ok(prazoPorDias(5, '2027-03-01') === '2027-03-06' && ajustarPrazo('2027-03-06', nenhum).prazo === '2027-03-05' && ajustarPrazo('2027-03-06', nenhum).ajuste === '06/03 sábado', 'prazos: cadastro na segunda + 5 dias cai no sábado e o vencimento ajustado é a sexta');
ok(ajustarPrazo('2027-03-07', nenhum).prazo === '2027-03-05' && ajustarPrazo('2027-03-07', nenhum).ajuste === '07/03 domingo; 06/03 sábado' && ajustarPrazo('2027-03-08', nenhum).ajuste === null && ajustarPrazo('2027-03-08', nenhum).prazo === '2027-03-08', 'prazos: domingo volta até a sexta; segunda e dias úteis não mudam e não têm explicação');
{
  const cal = [dia('2027-03-05', 'Feriado A'), dia('2027-03-04', 'Congresso', 'Evento externo'), dia('2027-03-03', 'Feriado B')];
  const r1 = ajustarPrazo('2027-03-06', cal);
  ok(r1.prazo === '2027-03-02' && r1.ajuste === '06/03 sábado; 05/03 feriado: Feriado A; 04/03 evento externo: Congresso; 03/03 feriado: Feriado B', 'prazos: antecipação sucessiva por fim de semana, feriado, evento externo e feriado, com a explicação de cada dia');
  ok(ajustarPrazo('2027-03-04', cal).prazo === '2027-03-02' && ajustarPrazo('2027-03-02', cal).ajuste === null, 'prazos: data manual na quinta também é antecipada; terça disponível não muda');
  ok(ajustarPrazo('2027-03-05', [dia('2027-03-05', 'X'), dia('2027-03-05', 'Y', 'Evento externo')]).ajuste === '05/03 feriado: X, evento externo: Y', 'prazos: feriado e evento no mesmo dia aparecem juntos na explicação');
  ok(ajustarPrazo('2027-03-04', cal.slice(0, 1)).prazo === '2027-03-04', 'prazos: removida a restrição, o vencimento volta à data original');
  let estourou = false;
  try { ajustarPrazo('2027-03-08', Array.from({ length: 420 }, (_, i) => dia(somarDias('2027-03-08', -419 + i), 'x' + i))); } catch { estourou = true; }
  ok(estourou, 'prazos: se não houver nenhum dia disponível em 400 dias, recusa em vez de entrar em laço infinito');
}
ok(permanencia({ chegou_em: '2027-03-01' }, '2027-03-04') === 3 && permanencia({ chegou_em: '2027-03-04' }, '2027-03-04') === 0 && permanencia({ chegou_em: null }, '2027-03-04') === null, 'permanência: dias corridos desde a chegada; sem chegada não há contagem inventada');
ok(numeroDe({ numero: '' }) === '' && numeroDe({ numero: 's/n' }) === '' && numeroDe({ numero: '12/2026' }) === '12/2026' && origemDe({ origem: 'Não informada' }) === '' && origemDe({ origem: '' }) === '' && origemDe({ origem: 'TCE' }) === 'TCE', 'campos opcionais: vazio e os marcadores antigos ("s/n", "Não informada") significam "não informado"');
ok(titulo({ tipo: 'Processo', numero: '' }) === 'Processo' && titulo({ tipo: 'Memorando', numero: '5/2026' }) === 'Memorando 5/2026', 'título: sem número mostra só o tipo');
{
  const base = { tipo: 'Memorando', numero: '', assunto: 'Sem número', origem: '', descricao: '', etapa: 'Cadastro', prazo: null, arquivada_em: null };
  ok(filtrar([base], { ...FILTRO_VAZIO, texto: 'sem número' }, '2027-03-04').length === 1, 'filtro por texto funciona com número e origem vazios');
}
{
  const falha = (f) => { try { f(); return null; } catch (e) { return e.message; } };
  ok(/Informe o assunto/.test(falha(() => validarDados({ assunto: '   ' }, { criando: true }))) && /Informe o assunto/.test(falha(() => validarDados({}, { criando: true }))), 'validação: assunto vazio ou ausente é recusado na criação');
  ok(JSON.stringify(validarDados({ assunto: 'Só o assunto' }, { criando: true })) === '{"assunto":"Só o assunto"}', 'validação: só o assunto basta (número, origem, descrição, chegada e prazo são opcionais e não são inventados)');
  const todos = validarDados({ assunto: 'a', numero: '', origem: '', descricao: '', chegou_em: '', prazo_original: '', prazo_dias: null }, { criando: true });
  ok(todos.numero === '' && todos.origem === '' && todos.chegou_em === null && todos.prazo_original === null && !('prazo_dias' in todos), 'validação: campos opcionais vazios são aceitos (chegada e prazo vazios viram nulo)');
  ok(validarDados({ assunto: 'a', prazo_dias: 10 }, { criando: true }).prazo_dias === 10 && /dias do prazo inválida/.test(falha(() => validarDados({ assunto: 'a', prazo_dias: 7 }, { criando: true }))) && /dias do prazo inválida/.test(falha(() => validarDados({ assunto: 'a', prazo_dias: '10' }, { criando: true }))), 'validação: o prazo por dias aceita só 5, 10, 20 e 30');
  ok(/Prazo inválida/.test(falha(() => validarDados({ assunto: 'a', prazo_original: '31/12/2027' }, { criando: true }))) && validarDados({ assunto: 'a', prazo_original: '2027-03-06' }, { criando: true }).prazo_original === '2027-03-06', 'validação: o prazo original exige data AAAA-MM-DD');
  ok(!('prazo' in validarDados({ assunto: 'a', prazo: '2027-03-06' }, { criando: true })), 'validação: o vencimento nunca vem da tela (o banco calcula o ajustado)');
  ok(/Identificador inválido/.test(falha(() => validarDados({ assunto: 'a', id: 'x' }, { criando: true }))) && validarDados({ assunto: 'a', id: '8e3a7c52-3a4c-4f83-9c8e-5c8e6f4a1b2c' }, { criando: true }).id === '8e3a7c52-3a4c-4f83-9c8e-5c8e6f4a1b2c', 'validação: o identificador da demanda nova (para não duplicar) precisa ser um UUID');
  ok(validarDados({ chegou_em: null }, { criando: false }).chegou_em === null && !('chegou_em' in validarDados({ assunto: 'x' }, { criando: false })), 'validação: na edição, a chegada pode ser limpa e, se não vier, não é tocada');
  ok(validarDia({ data: '2027-03-05', descricao: ' Natal ', categoria: 'Feriado' }).descricao === 'Natal' && /Informe a data/.test(falha(() => validarDia({ descricao: 'x', categoria: 'Feriado' }))) && /Descreva o dia/.test(falha(() => validarDia({ data: '2027-03-05', descricao: ' ', categoria: 'Feriado' }))) && /Categoria inválido/.test(falha(() => validarDia({ data: '2027-03-05', descricao: 'x', categoria: 'Outra' }))), 'validação do calendário: data, descrição e categoria (Feriado ou Evento externo)');
}

// ---------- Entradas (src/lib/entradas.ts e validarEntrada) ----------
{
  const e = (id, o) => ({ id, titulo: '', texto: '', cor: 0, fixada: false, arquivada_em: null, demanda_id: null, versao: 1, criado_em: '2026-10-30T10:00:00Z', atualizado_em: '2026-10-30T10:00:00Z', ...o });
  ok(estadoDe(e('a', {})) === 'ativa' && estadoDe(e('a', { arquivada_em: 'x' })) === 'arquivada' && estadoDe(e('a', { demanda_id: 'd' })) === 'convertida' && estadoDe(e('a', { arquivada_em: 'x', demanda_id: 'd' })) === 'convertida', 'entradas: estados ativa, arquivada e convertida (a convertida vale mais que a arquivada)');
  ok(tagsDe({ titulo: 'Reunião #RH', texto: 'ligar #rh e #Ação_2 e #2026 #' }).join() === 'rh,ação_2,2026', 'entradas: tags em qualquer lugar, minúsculas, com acento, número e sublinhado, sem repetir');
  ok(tagsDe({ titulo: '', texto: 'sem tag, só # solto e a#b' }).join() === 'b', 'entradas: "#" solto não é tag e a tag vale mesmo colada em palavra');
  ok(semTags('Ligar #rh para   o RH #x') === 'Ligar para o RH' && resumoDe({ titulo: '#so', texto: 'Texto útil #t' }) === 'Texto útil' && resumoDe({ titulo: 'Título', texto: 'Texto' }) === 'Título' && resumoDe({ titulo: '', texto: '#a #b' }) === '', 'entradas: o resumo do post-it é o título, ou as primeiras frases do texto, sem tags');
  ok(temTitulo({ titulo: 'x' }) && !temTitulo({ titulo: '  ' }) && !temTitulo({ titulo: '#so' }), 'entradas: título só de tags não conta como título');
  const base = [e('1', { texto: 'Reunião da Câmara #rh' }), e('2', { titulo: 'Diárias', texto: 'saldo #tce #rh' }), e('3', { texto: 'Painel' })];
  ok(JSON.stringify(contarTags(base)) === JSON.stringify([['rh', 2], ['tce', 1]]), 'entradas: contagem de tags em ordem alfabética');
  ok(filtrarEntradas(base, { texto: 'reuniao da camara', tag: '' }).map((x) => x.id).join() === '1' && filtrarEntradas(base, { texto: '', tag: 'rh' }).map((x) => x.id).join() === '1,2' && filtrarEntradas(base, { texto: 'SALDO', tag: 'rh' }).map((x) => x.id).join() === '2' && filtrarEntradas(base, { texto: '  ', tag: '' }).length === 3 && filtrarEntradas(base, { texto: 'nada', tag: '' }).length === 0, 'entradas: busca sem acento e sem diferença de maiúscula, filtro por tag e os dois juntos');
  const ord = ordenarEntradas([e('a', { criado_em: '2026-10-01T00:00:00Z' }), e('b', { criado_em: '2026-10-03T00:00:00Z' }), e('c', { criado_em: '2026-10-02T00:00:00Z', fixada: true }), e('d', { criado_em: '2026-09-01T00:00:00Z', fixada: true })]);
  ok(ord.map((x) => x.id).join() === 'c,d,b,a', 'entradas: fixadas no topo e, em cada grupo, a mais recente primeiro');
  // virar demanda
  ok(JSON.stringify(paraDemanda({ titulo: ' Portaria 12 ', texto: 'Texto completo\ncom #tag' })) === JSON.stringify({ assunto: 'Portaria 12', descricao: 'Texto completo\ncom #tag' }), 'virar demanda: com título explícito, ele é o assunto e o texto inteiro vai para a descrição');
  ok(JSON.stringify(paraDemanda({ titulo: '', texto: 'Primeira linha útil\nSegunda #t\n\nTerceira' })) === JSON.stringify({ assunto: 'Primeira linha útil', descricao: 'Segunda #t\n\nTerceira' }), 'virar demanda: sem título, a primeira linha útil é o assunto e o resto vai para a descrição');
  ok(JSON.stringify(paraDemanda({ titulo: '', texto: 'Uma linha só #rh' })) === JSON.stringify({ assunto: 'Uma linha só #rh', descricao: '' }), 'virar demanda: nota de uma linha: assunto com a própria linha (a tag não se perde) e descrição vazia');
  ok(JSON.stringify(paraDemanda({ titulo: '', texto: '\n\n#a #b\nLinha com conteúdo\nfim' })) === JSON.stringify({ assunto: 'Linha com conteúdo', descricao: '#a #b\nfim' }), 'virar demanda: linhas vazias e linha só de tags antes não viram assunto, e a linha de tags fica na descrição');
  ok(JSON.stringify(paraDemanda({ titulo: '', texto: '#a #b' })) === JSON.stringify({ assunto: '#a #b', descricao: '' }), 'virar demanda: nota só de tags: o assunto são as tags (nada é descartado)');
  const longa = 'palavra '.repeat(60).trim(), pl = paraDemanda({ titulo: '', texto: `${longa}\nresto` });
  ok(pl.assunto.length <= 300 && pl.assunto.endsWith('…') && !pl.assunto.slice(0, -1).endsWith(' ') && pl.descricao === `${longa}\nresto`, 'virar demanda: primeira linha acima de 300 caracteres: assunto cortado em palavra inteira e o texto completo na descrição');
  ok(paraDemanda({ titulo: '', texto: 'x'.repeat(400) }).assunto.length === 300, 'virar demanda: linha sem espaço é cortada no limite do assunto');
  ok(JSON.stringify(paraDemanda({ titulo: '', texto: 'Linha\r\nSegunda\r\nTerceira' })) === JSON.stringify({ assunto: 'Linha', descricao: 'Segunda\nTerceira' }), 'virar demanda: quebras de linha do Windows são tratadas');
  // edição: o que mudou e o que conflita
  const cs = { titulo: 'T', texto: 'X', cor: 2, fixada: false };
  ok(JSON.stringify(diferencas({ ...cs, texto: ' Y ' }, cs)) === JSON.stringify({ texto: 'Y' }) && Object.keys(diferencas({ ...cs, titulo: ' T ', texto: 'X ' }, cs)).length === 0 && JSON.stringify(diferencas({ ...cs, fixada: true, cor: 4 }, cs)) === JSON.stringify({ cor: 4, fixada: true }), 'entradas: só os campos mexidos seguem no salvamento (espaços nas pontas não contam)');
  ok(vazia({ titulo: ' ', texto: '\n' }) && !vazia({ titulo: '', texto: 'a' }), 'entradas: vazia é título e texto em branco');
  ok(camposEmConflito({ texto: 'X' }, { ...cs, texto: 'X', fixada: true }, { texto: 'Y' }).length === 0, 'conflito: o outro aparelho só fixou e eu só escrevi: não é conflito, os dois cabem juntos');
  ok(camposEmConflito({ texto: 'X' }, { ...cs, texto: 'Z' }, { texto: 'Y' }).join() === 'texto', 'conflito: os dois mudaram o texto para valores diferentes: é conflito');
  ok(camposEmConflito({ texto: 'X' }, { ...cs, texto: 'Y' }, { texto: 'Y' }).length === 0, 'conflito: os dois chegaram ao mesmo texto: não há o que perguntar');
  ok(camposEmConflito({ texto: 'X', cor: 2 }, { ...cs, texto: 'X', cor: 5 }, { texto: 'Y' }).length === 0 && camposEmConflito({ texto: 'X', cor: 2 }, { ...cs, texto: 'Z', cor: 5 }, { texto: 'Y', cor: 3 }).join() === 'texto,cor', 'conflito: só conta o campo que eu mexi E o outro também mexeu');
  // validação
  const fe = (f) => { try { f(); return ''; } catch (x) { return x.message; } };
  ok(/Escreva um título ou o texto/.test(fe(() => validarEntrada({ titulo: ' ', texto: '\n' }, { criando: true }))) && /Escreva um título ou o texto/.test(fe(() => validarEntrada({}, { criando: true }))), 'validação de entrada: criar vazia é recusado');
  const v1 = validarEntrada({ id: '8e3a7c52-3a4c-4f83-9c8e-5c8e6f4a1b2c', titulo: '  T ', texto: ' x\n', cor: 3, fixada: true, user_id: 'x', extra: 1 }, { criando: true });
  ok(v1.titulo === 'T' && v1.texto === 'x' && v1.cor === 3 && v1.fixada === true && !('user_id' in v1) && !('extra' in v1), 'validação de entrada: apara as pontas e deixa só os campos conhecidos');
  ok(!('cor' in validarEntrada({ texto: 'a', cor: null }, { criando: true })) && /Cor inválida/.test(fe(() => validarEntrada({ texto: 'a', cor: 6 }, { criando: true }))) && /Cor inválida/.test(fe(() => validarEntrada({ texto: 'a', cor: 1.5 }, { criando: false }))) && /Cor inválida/.test(fe(() => validarEntrada({ texto: 'a', cor: '2' }, { criando: true }))), 'validação de entrada: cor ausente ou nula é automática; fora de 0 a 5 ou não inteira é recusada');
  ok(/passa de 200/.test(fe(() => validarEntrada({ titulo: 'x'.repeat(201) }, { criando: true }))) && /passa de 20000/.test(fe(() => validarEntrada({ texto: 'x'.repeat(20001) }, { criando: true }))) && validarEntrada({ texto: 'x'.repeat(20000), titulo: 'y'.repeat(200) }, { criando: true }).texto.length === 20000, 'validação de entrada: limites de 200 e 20000 caracteres');
  ok(/Identificador inválido/.test(fe(() => validarEntrada({ id: 'x', texto: 'a' }, { criando: true }))) && /Fixação inválida/.test(fe(() => validarEntrada({ texto: 'a', fixada: 'sim' }, { criando: true }))) && /inválidos/.test(fe(() => validarEntrada(null, { criando: true }))), 'validação de entrada: identificador, fixação e formato inválidos são recusados');
  ok(Object.keys(validarEntrada({ fixada: true }, { criando: false })).join() === 'fixada' && /não pode ficar vazia/.test(fe(() => validarEntrada({ titulo: '', texto: '  ' }, { criando: false }))) && validarEntrada({ titulo: '' }, { criando: false }).titulo === '', 'validação de entrada: na edição só vai o que mudou; esvaziar título e texto juntos é recusado, esvaziar só o título não');
  // carimbo da criação (criado_em): America/Sao_Paulo, 24 h, sem segundos, e cinco cores oferecidas (a 5, retirada, ainda é aceita em notas antigas)
  ok(carimbo('2026-10-30T17:48:00Z') === '30/10/2026 às 14:48' && carimbo('2026-10-31T02:30:59.999Z') === '30/10/2026 às 23:30' && carimbo('2026-01-01T03:00:00Z') === '01/01/2026 às 00:00' && !/:\d{2}:\d{2}/.test(carimbo('2026-10-30T17:48:35Z')), 'carimbo: dia/mês/ano às hh:mm no horário de Brasília, 24 h, sem segundos');
  ok(QTD_CORES === 5 && validarEntrada({ texto: 'a', cor: 4 }, { criando: true }).cor === 4 && validarEntrada({ texto: 'a', cor: 5 }, { criando: false }).cor === 5 && /Cor inválida/.test(fe(() => validarEntrada({ texto: 'a', cor: 6 }, { criando: true }))), 'entradas: cinco cores oferecidas; a cor retirada (5) continua aceita em notas antigas; 6 é recusada');
}

console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
