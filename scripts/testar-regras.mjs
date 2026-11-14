// Regras puras de datas e grupos do Início (src/lib/demandas.ts) e de Entradas (src/lib/entradas.ts), sem navegador nem banco. Uso: node scripts/testar-regras.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emailAutorizado, contaAutorizada, situacaoDoErroAuth, ehCookieDeSessao, COOKIE_LEGADO_ULTIMO_USO } from '../src/lib/sessao.ts';
import { ajustarPrazo, prazoPorDias, somarDias, diaDaSemana, nomeDoDia, BOTOES_PRAZO } from '../src/lib/prazos.ts';
import { modoTeste, medicaoLocalPermitida } from '../src/lib/supabase/config.ts';
import { gruposGuardados, ordemGuardada, rascunhosGuardados, textosGuardados, visaoGuardada, eObjeto } from '../src/lib/armazenamento.ts';
import { googleLigado } from '../src/lib/login.ts';
import { aparenciaGuardada, APARENCIA_PADRAO, ePadrao, modoGuardado, temaDoModo, variaveisAparencia, CONJUNTOS, FONTES_TITULO, FONTES_TEXTO, FONTES_MONO, PALETAS, TEXTO, ICONE, CARD } from '../src/lib/aparencia.ts';
import { segredoConfere, executarRotinaDiaria } from '../src/nucleo/rotina.ts';
import { esperaPrefeita, dataFiltro, grupoFiltro, porGrupo, atrasada, diasAte, permanencia, numeroDe, origemDe, titulo, filtrar, FILTRO_VAZIO } from '../src/lib/demandas.ts';
import { validarDados, validarDia, validarEntrada, validarRegistros } from '../src/nucleo/validacao.ts';
import { estadoDe, tagsDe, semTags, resumoDe, temTitulo, contarTags, filtrarEntradas, ordenarEntradas, paraDemanda, diferencas, vazia, camposEmConflito, carimbo, QTD_CORES } from '../src/lib/entradas.ts';
import { buscar, palavrasDa, simplificar as simplificarBusca, LIMITE_RESULTADOS } from '../src/lib/busca.ts';
import { diasPendentes, diaDeTrabalho, emJanelaDeCorrecao, serieDoPeriodo, textoDoDia, fraseDoDia, registrosValidos, substituirRegistros, textoConcluidas, AVISO_PERFIL } from '../src/lib/registros.ts';
import { limitesDaColuna, topoDepoisDeRolar } from '../src/ui/coluna-fixa.ts';
import { estadoInicial, lerEstado, tique, resolver, INTERVALO_S, PASSO_MAX, OCIOSO_MS } from '../src/lib/lembretes.ts';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const hoje = '2026-10-25';
const d = (id, o) => ({ id, etapa: 'Fazendo', etapa_desde: '2026-10-24T15:00:00Z', encaminhada_em: null, reiterada_em: null, arquivada_em: null, prazo: null, acompanhar_em: null, chegou_em: '2026-10-01', tipo: 'Memorando', prazo_tipo: 'Próprio', ...o });
const lista = [
  d('venc', { prazo: '2026-10-20' }), d('hoje', { prazo: hoje }), d('em3', { prazo: '2026-10-28' }), d('em8', { prazo: '2026-11-02' }),
  d('semprazo', {}), d('fin', { prazo: '2026-10-01', etapa: 'Finalizado' }),
  d('ag-longe', { etapa: 'Aguardando retorno', prazo: '2026-10-26', acompanhar_em: '2026-11-10' }),
  d('ag-perto', { etapa: 'Aguardando retorno', acompanhar_em: '2026-10-27' }),
  d('ag-sem', { etapa: 'Aguardando retorno', prazo: '2026-10-26' }),
  d('ag-venc', { etapa: 'Aguardando retorno', acompanhar_em: '2026-10-22' }),
  d('ag-ret10', { etapa: 'Aguardando retorno', etapa_desde: '2026-10-16T15:00:00Z' }),
  d('pref11', { etapa: 'Aguardando Prefeita', etapa_desde: '2026-10-14T15:00:00Z' }),
  d('pref-prazo', { etapa: 'Aguardando Prefeita', etapa_desde: '2026-10-05T15:00:00Z', prazo: '2026-11-20' }),
];
ok(diasAte('2026-10-28', hoje) === 3 && diasAte('2026-10-20', hoje) === -5, 'diasAte conta dias corridos a partir da data de hoje recebida');
ok(atrasada(lista[0], hoje) && !atrasada(lista[1], hoje) && !atrasada(lista[5], hoje) && !atrasada(lista[4], hoje), 'atrasada: só prazo vencido, nunca finalizada nem sem prazo');
ok(dataFiltro(lista[4], hoje) === null && dataFiltro(lista[5], hoje) === null, 'sem prazo e finalizada ficam fora dos filtros (nada é inventado)');
// decisão 50: a data aplicável é a mais próxima entre vencimento, "Acompanhar em" e o retorno do setor (10 dias); os três valores continuam separados
ok(dataFiltro(lista[6], hoje) === '2026-10-26' && dataFiltro(lista[8], hoje) === '2026-10-26', 'aguardando retorno: vale o vencimento quando ele é o mais próximo (acompanhamento e retorno mais longe não o escondem)');
ok(dataFiltro(lista[7], hoje) === '2026-10-27' && dataFiltro(lista[9], hoje) === '2026-10-22', 'aguardando retorno: vale o "Acompanhar em" quando é o mais próximo, vencido ou não, sem corte de 3 dias');
ok(dataFiltro(lista[10], hoje) === '2026-10-26' && grupoFiltro(lista[10], hoje) === 'sete', 'aguardando retorno sem prazo nem acompanhamento: vale o retorno do setor, 10 dias depois de 16/10');
ok(dataFiltro({ ...lista[10], etapa_desde: '2026-10-24T15:00:00Z' }, hoje) === '2026-11-03' && grupoFiltro({ ...lista[10], etapa_desde: '2026-10-24T15:00:00Z' }, hoje) === null, 'retorno ainda longe (9 dias) não entra nos grupos do Início');
ok(dataFiltro({ ...lista[10], encaminhada_em: '2026-10-20' }, hoje) === '2026-10-30' && dataFiltro({ ...lista[10], encaminhada_em: '2026-10-20', reiterada_em: '2026-10-25' }, hoje) === '2026-11-04', 'retorno do setor: conta do encaminhamento e recomeça na reiteração');
ok(lista[6].prazo === '2026-10-26' && lista[6].acompanhar_em === '2026-11-10', 'os valores originais (prazo e Acompanhar em) seguem separados e preservados');
// espera pela Prefeita: alerta de dias, nunca vencimento
ok(dataFiltro(lista[11], hoje) === null && grupoFiltro(lista[11], hoje) === null && !atrasada(lista[11], hoje), 'Aguardando Prefeita há 11 dias, sem prazo: nenhuma data, fora de atrasadas e sem prazo vencido');
ok(esperaPrefeita(lista[11], hoje).dias === 11 && esperaPrefeita(lista[11], hoje).alerta, 'Aguardando Prefeita: no 11º dia o alerta de espera é destacado');
ok(esperaPrefeita({ ...lista[11], etapa_desde: '2026-10-15T15:00:00Z' }, hoje).dias === 10 && !esperaPrefeita({ ...lista[11], etapa_desde: '2026-10-15T15:00:00Z' }, hoje).alerta, 'Aguardando Prefeita: no 10º dia ainda não há destaque');
ok(dataFiltro(lista[12], hoje) === '2026-11-20' && grupoFiltro(lista[12], hoje) === null && esperaPrefeita(lista[12], hoje).alerta, 'Aguardando Prefeita há 20 dias com prazo distante: o prazo da demanda não muda por causa da espera');
ok(filtrar(lista, { ...FILTRO_VAZIO, soAtrasadas: true }, hoje).map((x) => x.id).join() === 'venc,ag-venc', 'Só atrasadas segue a data aplicável (inclui acompanhamento vencido) e nunca a espera pela Prefeita');
ok(filtrar(lista, { ...FILTRO_VAZIO, prazo: 'atrasadas' }, hoje).length === 2 && filtrar(lista, { ...FILTRO_VAZIO, prazo: 'hoje' }, hoje).map((x) => x.id).join() === 'hoje' && filtrar(lista, { ...FILTRO_VAZIO, prazo: 'sete' }, hoje).map((x) => x.id).join() === 'hoje,em3,ag-longe,ag-perto,ag-sem,ag-ret10', 'filtros de prazo usam a mesma data aplicável dos grupos do Início');
ok(porGrupo(lista, 'atrasadas', hoje).map((x) => x.id).join() === 'venc,ag-venc', 'atrasadas, da mais antiga para a mais recente (inclui o acompanhamento vencido)');
ok(porGrupo(lista, 'hoje', hoje).map((x) => x.id).join() === 'hoje', 'hoje: só o que vence hoje');
ok(porGrupo(lista, 'sete', hoje).map((x) => x.id).join() === 'ag-longe,ag-sem,ag-ret10,ag-perto,em3', 'próximos 7 dias: de 1 a 7 dias, na ordem de proximidade (em8 fica de fora, hoje não repete)');
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
  // data que não existe no calendário (30 de fevereiro) é recusada com a mensagem de data inválida, em vez de ir ao banco e voltar como erro genérico
  ok(/Prazo inválida/.test(fe(() => validarDados({ assunto: 'a', prazo_original: '2026-02-30' }, { criando: true }))) && /Data de chegada inválida/.test(fe(() => validarDados({ assunto: 'a', chegou_em: '2026-04-31' }, { criando: true }))) && /Data inválida/.test(fe(() => validarDia({ data: '2027-02-29', descricao: 'x', categoria: 'Feriado' }))) && validarDados({ assunto: 'a', prazo_original: '2028-02-29' }, { criando: true }).prazo_original === '2028-02-29', 'datas: 30 de fevereiro e 29 de fevereiro de ano comum são recusadas; 29 de fevereiro de ano bissexto passa');
  // carimbo da criação (criado_em): America/Sao_Paulo, 24 h, sem segundos, e cinco cores oferecidas (a 5, retirada, ainda é aceita em notas antigas)
  ok(carimbo('2026-10-30T17:48:00Z') === '30/10/2026 às 14:48' && carimbo('2026-10-31T02:30:59.999Z') === '30/10/2026 às 23:30' && carimbo('2026-01-01T03:00:00Z') === '01/01/2026 às 00:00' && !/:\d{2}:\d{2}/.test(carimbo('2026-10-30T17:48:35Z')), 'carimbo: dia/mês/ano às hh:mm no horário de Brasília, 24 h, sem segundos');
  ok(QTD_CORES === 5 && validarEntrada({ texto: 'a', cor: 4 }, { criando: true }).cor === 4 && validarEntrada({ texto: 'a', cor: 5 }, { criando: false }).cor === 5 && /Cor inválida/.test(fe(() => validarEntrada({ texto: 'a', cor: 6 }, { criando: true }))), 'entradas: cinco cores oferecidas; a cor retirada (5) continua aceita em notas antigas; 6 é recusada');
}

// armazenamento do navegador: valor corrompido ou de outra versão nunca trava a abertura e só o que tem a forma esperada é aproveitado
{
  ok(eObjeto({}) && !eObjeto(null) && !eObjeto([]) && !eObjeto('x') && !eObjeto(5), 'armazenamento: só objeto simples conta como objeto (nulo, lista, texto e número não)');
  ok(visaoGuardada('quadro') === 'quadro' && visaoGuardada('zzz') === null && visaoGuardada(7) === null && visaoGuardada(null) === null, 'armazenamento: a visão guardada precisa ser uma das quatro');
  ok(ordemGuardada({ coluna: 'prazo', sentido: -1 })?.coluna === 'prazo' && ordemGuardada({ coluna: 'nada', sentido: 1 }) === null && ordemGuardada({ coluna: 'prazo', sentido: 5 }) === null && ordemGuardada([]) === null && ordemGuardada(null) === null, 'armazenamento: a ordem guardada precisa ter coluna conhecida e sentido 1 ou -1');
  ok(JSON.stringify(gruposGuardados({ a: true, b: 'x', c: false })) === '{"a":true,"c":false}' && JSON.stringify(gruposGuardados([1])) === '{}' && JSON.stringify(gruposGuardados(5)) === '{}', 'armazenamento: grupos fechados só aceitam valores verdadeiro ou falso');
  const rg = rascunhosGuardados({ 'e:nova': { dados: { texto: 'a' } }, 'e:x': null, 'e:y': {}, 'e:z': { dados: null }, 'n:1': 5 });
  ok(Object.keys(rg).join() === 'e:nova' && rg['e:nova'].dados.texto === 'a' && Object.keys(rascunhosGuardados([])).length === 0 && Object.keys(rascunhosGuardados('x')).length === 0, 'armazenamento: rascunhos sem a forma mínima (objeto com "dados") são ignorados e o válido é mantido');
  ok(textosGuardados(['a', 5, 'b', null]).join() === 'a,b' && textosGuardados({}).length === 0 && textosGuardados('x').length === 0 && textosGuardados(Array.from({ length: 300 }, (_, i) => String(i))).length === 200, 'armazenamento: lista de avisos vistos só aceita textos e guarda os 200 últimos');
}

// banco de teste: recusado em produção; a única exceção é a medição local explícita, que nunca vale na Vercel
{
  const lanca = (env, existe) => { try { modoTeste(env, existe); return false; } catch { return true; } };
  ok(modoTeste({ DMANDA_BANCO: 'teste', NODE_ENV: 'development' }) === true && modoTeste({ NODE_ENV: 'production' }) === false, 'banco de teste: liga só em desenvolvimento com DMANDA_BANCO=teste; sem a variável é sempre o Supabase');
  ok(lanca({ DMANDA_BANCO: 'teste', NODE_ENV: 'production' }) && lanca({ DMANDA_BANCO: 'teste', NODE_ENV: 'production', DMANDA_MEDICAO_LOCAL: 'nao' }), 'banco de teste: recusado em produção, com ou sem a medição desligada');
  const local = () => true, nuvem = () => false;   // "existe(.dados-teste)": só neste computador
  const prod = { DMANDA_BANCO: 'teste', NODE_ENV: 'production', DMANDA_MEDICAO_LOCAL: 'sim' };
  ok(modoTeste(prod, local) === true, 'banco de teste: a medição local explícita vale no computador (variável ligada, sem sinal de nuvem, pasta .dados-teste presente)');
  ok(lanca(prod, nuvem) && !medicaoLocalPermitida({ DMANDA_MEDICAO_LOCAL: 'sim' }, nuvem), 'banco de teste: sem a pasta .dados-teste (que o Git ignora e nenhuma implantação tem) a medição local é recusada');
  // Vercel: produção, Preview e Development, com a variável configurada por engano
  for (const [nome, extra] of [['produção', { VERCEL: '1', VERCEL_ENV: 'production' }], ['Preview', { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_URL: 'dmanda-git-x.vercel.app' }], ['Development', { VERCEL: '1', VERCEL_ENV: 'development' }]]) {
    ok(lanca({ ...prod, ...extra }, local), `banco de teste: na Vercel (${nome}) a medição local é recusada mesmo com DMANDA_MEDICAO_LOCAL=sim e até com a pasta presente`);
  }
  // projeto com "System Environment Variables" desligado: só sobram os sinais da função Lambda
  for (const k of ['AWS_LAMBDA_FUNCTION_NAME', 'AWS_EXECUTION_ENV', 'LAMBDA_TASK_ROOT', 'VERCEL_REGION', 'VERCEL_URL', 'VERCEL_DEPLOYMENT_ID', 'VERCEL_TARGET_ENV']) {
    ok(lanca({ ...prod, [k]: 'x' }, local), `banco de teste: com só ${k} definida a medição local é recusada`);
  }
  ok(!medicaoLocalPermitida({}, local) && !medicaoLocalPermitida({ DMANDA_MEDICAO_LOCAL: 'nao' }, local) && !medicaoLocalPermitida({ DMANDA_MEDICAO_LOCAL: 'SIM' }, local) && !medicaoLocalPermitida({ DMANDA_MEDICAO_LOCAL: 'sim', VERCEL: '' }, nuvem), 'banco de teste: só o valor exato "sim" liga a medição local');
}

// Aparência de Configurações (bloco de 06/11/2026): leitura segura do que está guardado, limites, modo e variáveis
{
  const ap = aparenciaGuardada;
  ok(ePadrao(ap(null)) && ePadrao(ap(undefined)) && ePadrao(ap('lixo')) && ePadrao(ap([1])) && ePadrao(ap(7)) && ePadrao(ap({})), 'aparência: ausente, ilegível ou de forma errada volta ao padrão');
  ok(ePadrao(ap(JSON.parse(JSON.stringify(APARENCIA_PADRAO)))), 'aparência: o padrão gravado e lido continua sendo o padrão');
  const x = ap({ textoPct: 9999, icone: -4, card: 'x', titulo: 'nada', texto: 7, mono: null, paleta: 99, fundo: 'piscante', movimento: 3 });
  ok(x.textoPct === TEXTO.max && x.icone === ICONE.min && x.card === CARD.padrao && x.titulo === 'inter' && x.texto === 'inter' && x.mono === 'plex' && x.paleta === null && x.fundo === 'padrao' && x.movimento === 'sistema', 'aparência: valores absurdos são limitados ou voltam ao padrão, campo a campo');
  ok(ap({ textoPct: 1 }).textoPct === TEXTO.min && ap({ textoPct: 112.4 }).textoPct === 112 && ap({ textoPct: NaN }).textoPct === 100 && ap({ icone: Infinity }).icone === 20, 'aparência: o texto nunca fica abaixo de 100% nem acima de 125% e número inválido volta ao padrão');
  const y = ap({ paleta: 2, textoPct: 120, titulo: 'sora', fundo: 'animado', movimento: 'reduzido', extra: 1 });
  ok(y.paleta === 2 && y.textoPct === 120 && y.titulo === 'sora' && y.texto === 'inter' && y.fundo === 'animado' && y.movimento === 'reduzido' && !('extra' in y), 'aparência: o que é válido é aproveitado e o resto volta ao padrão');
  ok(ap({ paleta: 1.5 }).paleta === null && ap({ paleta: -1 }).paleta === null && ap({ paleta: 9 }).paleta === 9 && PALETAS.length === 10, 'aparência: dez destaques, índice inválido volta ao padrão');
  ok(CONJUNTOS.every((c) => FONTES_TITULO.some((f) => f.id === c.titulo) && FONTES_TEXTO.some((f) => f.id === c.texto) && FONTES_MONO.some((f) => f.id === c.mono)) && CONJUNTOS[0].titulo === APARENCIA_PADRAO.titulo, 'fontes: todo conjunto usa fontes que existem e o primeiro é o padrão');
  ok([FONTES_TITULO, FONTES_TEXTO, FONTES_MONO].every((l) => new Set(l.map((f) => f.id)).size === l.length && l.every((f) => /^var\(--f-[a-z]+\), /.test(f.css))), 'fontes: identificadores únicos e todas vêm das variáveis do layout');
  ok(modoGuardado('claro') === 'claro' && modoGuardado('escuro') === 'escuro' && modoGuardado('sistema') === 'sistema' && modoGuardado('Claro') === null && modoGuardado(null) === null && modoGuardado(1) === null, 'modo: só Claro, Escuro e Sistema são aceitos');
  ok(temaDoModo('claro', true) === 'claro' && temaDoModo('escuro', false) === 'escuro' && temaDoModo('sistema', true) === 'escuro' && temaDoModo('sistema', false) === 'claro', 'modo: Sistema segue o aparelho, os outros ignoram');
  const v = variaveisAparencia(APARENCIA_PADRAO);
  ok(v['--esc'] === '0.85' && v['--icn'] === '20px' && v['--cardh'] === '340px' && !('--acc' in v), 'variáveis: o padrão mantém escala 0,85, ícone 20 px, card 340 px e nenhum destaque forçado');
  ok(variaveisAparencia({ ...APARENCIA_PADRAO, textoPct: 125 })['--esc'] === '1.0625' && variaveisAparencia({ ...APARENCIA_PADRAO, textoPct: 105 })['--esc'] === '0.8925', 'variáveis: a escala é 0,85 vezes a porcentagem escolhida');
  ok(!ePadrao({ ...APARENCIA_PADRAO, fundo: 'animado' }) && !ePadrao({ ...APARENCIA_PADRAO, paleta: 0 }), 'ePadrao: qualquer mudança conta');
}

// ---------- busca global (src/lib/busca.ts) ----------
{
  const dm = (id, o = {}) => ({ id, tipo: 'Processo', area: 'Geral', numero: '', assunto: id, descricao: '', origem: '', etapa: 'Fazendo', setor: null, arquivada_em: null, tarefas: [], ...o });
  const en = (id, o = {}) => ({ id, titulo: '', texto: '', cor: 0, fixada: false, arquivada_em: null, demanda_id: null, ...o });
  const evt = (id, o = {}) => ({ id, titulo: id, tipo: 'Reunião', data: '2026-11-10', dia_inteiro: false, inicio: '09:00', fim: null, descricao: '', ...o });
  const F = {
    demandas: [dm('d1', { numero: '1842/2026', assunto: 'Revisão do contrato', descricao: 'Fiscalização', tarefas: [{ id: 't1', texto: 'Conferir certidão', concluida: true, posicao: 0 }] }), dm('d2', { etapa: 'Finalizado', assunto: 'Concluída' })],
    arquivadas: [dm('d3', { assunto: 'Antiga licitação', arquivada_em: 'x', tarefas: [{ id: 't3', texto: 'Anexar planilha', concluida: false, posicao: 0 }] })],
    entradas: [en('e1', { titulo: 'Ligar ao Jurídico', texto: 'reunião às 14h #tce' }), en('e0', { texto: 'sem título, só texto' })],
    entradasArquivadas: [en('e2', { titulo: 'Compras', arquivada_em: 'x' }), en('e3', { titulo: 'Ideia', demanda_id: 'd9' })],
    eventos: [evt('v1', { titulo: 'Reunião de secretariado' }), evt('v2', { titulo: 'Audiência', data: '2027-03-15', dia_inteiro: true, inicio: null, descricao: 'pública' })],
  };
  const q = (t, f = F) => buscar(t, f).resultados;
  ok(simplificarBusca('Reunião ÇÃO') === 'reuniao cao' && palavrasDa('  a   B ').join('|') === 'a|b' && palavrasDa('   ').length === 0, 'busca: simplifica acentos e maiúsculas e separa as palavras');
  ok(q('').length === 0 && q('   ').length === 0 && buscar('', F).total === 0, 'busca: consulta vazia não devolve nada');
  ok(q('1842').length === 1 && q('1842')[0].tipo === 'demanda' && q('1842/2026').length === 1 && q('842/20').length === 1, 'busca: por número, inteiro e por trecho');
  ok(q('fiscaliz')[0]?.chave === 'd:d1' && q('contrato revisao')[0]?.chave === 'd:d1', 'busca: por trecho da descrição e com palavras em qualquer ordem');
  const t = q('certidao');
  ok(t.length === 1 && t[0].tipo === 'tarefa' && t[0].destino.t === 'editar' && t[0].destino.id === 'd1' && /Da demanda Processo 1842\/2026 · Revisão do contrato · concluída/.test(t[0].detalhe), 'busca: tarefa traz a demanda de origem e abre essa demanda');
  ok(q('planilha')[0].estado === 'Arquivada' && q('licitacao')[0].estado === 'Arquivada', 'busca: demanda e tarefa arquivadas trazem o estado');
  ok(q('concluida')[0].estado === 'Finalizada' && q('revisao')[0].estado === null, 'busca: finalizada tem estado; ativa não');
  ok(q('compras')[0].estado === 'Arquivada' && q('ideia')[0].estado === 'Convertida em demanda' && q('ideia')[0].destino.t === 'entrada', 'busca: entrada arquivada e convertida trazem o estado e abrem como entrada');
  ok(q('#tce').length === 1 && q('tce')[0].tipo === 'entrada' && q('so texto')[0]?.titulo === 'sem título, só texto', 'busca: tag, e entrada sem título usa a primeira linha do texto');
  const ev = q('audiencia 15/03/2027');
  ok(ev.length === 1 && ev[0].tipo === 'evento' && ev[0].destino.t === 'evento' && /15\/03\/2027 · dia inteiro/.test(ev[0].detalhe) && q('2027-03-15').length === 1 && q('publica')[0].tipo === 'evento', 'busca: evento por título, data (br e ISO) e descrição');
  const r = q('reuniao');
  ok(r.length === 2 && r.some((x) => x.tipo === 'entrada') && r.some((x) => x.tipo === 'evento'), 'busca: acha em tipos diferentes e identifica o tipo');
  ok(q('xyz').length === 0 && buscar('xyz', F).total === 0, 'busca: sem correspondência devolve lista vazia');
  ok(Object.keys(q('antiga')[0]).sort().join() === 'chave,destino,detalhe,estado,tipo,titulo', 'busca: o resultado não expõe campos internos');
  const grande = { ...F, demandas: Array.from({ length: 100 }, (_, i) => dm(`g${i}`, { assunto: `Pauta ${i}` })), arquivadas: [], entradas: [], entradasArquivadas: [], eventos: [] };
  const gr = buscar('pauta', grande);
  ok(gr.resultados.length === LIMITE_RESULTADOS && gr.total === 100, 'busca: limita a lista mostrada e informa o total');
  const dup = buscar('compras', { ...F, entradas: [en('e2', { titulo: 'Compras' })], entradasArquivadas: F.entradasArquivadas });
  ok(dup.resultados.length === 1 && dup.resultados[0].estado === null, 'busca: o mesmo registro nas duas listas aparece uma vez');
  const ord = buscar('contrato', { ...F, demandas: [dm('a', { assunto: 'Outra', descricao: 'contrato aqui' }), dm('b', { assunto: 'Contrato novo' })], arquivadas: [dm('c', { assunto: 'Contrato velho', arquivada_em: 'x' })] }).resultados.map((x) => x.chave).join();
  ok(ord === 'd:b,d:a,d:c', 'busca: título casando vem antes do corpo, e arquivados por último');
}

// ---------- Perfil: registros, produtividade e lembretes (src/lib/registros.ts e src/lib/lembretes.ts) ----------
{
  const H = '2026-11-06'; // sexta-feira
  const reg = (dia, h = 3) => ({ dia, humor: h });
  const feriado = (data) => ({ id: 'f' + data, data, descricao: 'Feriado', categoria: 'Feriado' });
  const externo = (data) => ({ id: 'x' + data, data, descricao: 'Congresso', categoria: 'Evento externo' });
  ok(diaDaSemana(H) === 5 && emJanelaDeCorrecao('2026-11-06', H) && emJanelaDeCorrecao('2026-11-01', H) && !emJanelaDeCorrecao('2026-10-31', H) && !emJanelaDeCorrecao('2026-11-07', H), 'perfil: a janela de correção é hoje e os 5 dias anteriores (sexto dia e dia futuro ficam de fora)');
  ok(diasPendentes(H, [], []).join() === '2026-11-02,2026-11-03,2026-11-04,2026-11-05', 'perfil: o convite pede os dias de trabalho dos 5 anteriores sem registro (sem hoje; domingo 01/11 fora), do mais antigo ao mais recente');
  ok(diasPendentes(H, [reg('2026-11-03'), reg('2026-11-05')], []).join() === '2026-11-02,2026-11-04', 'perfil: o convite pede só o que falta (dias já registrados saem)');
  ok(diasPendentes(H, [], [feriado('2026-11-02')]).join() === '2026-11-03,2026-11-04,2026-11-05' && !diaDeTrabalho('2026-11-02', [feriado('2026-11-02')]), 'perfil: feriado cadastrado sai do convite');
  ok(diasPendentes(H, [], [externo('2026-11-03')]).includes('2026-11-03'), 'perfil: evento externo de dia inteiro não tira o dia do convite (só feriado)');
  ok(diasPendentes('2026-11-09', [], []).join() === '2026-11-04,2026-11-05,2026-11-06', 'perfil: na segunda-feira, sábado e domingo ficam de fora e o convite pede quarta, quinta e sexta');
  ok(diasPendentes(H, [reg('2026-11-02'), reg('2026-11-03'), reg('2026-11-04'), reg('2026-11-05')], []).length === 0, 'perfil: sem dia pendente, o convite não existe');
  ok(diasPendentes(H, [reg('2026-10-20')], []).length === 4 && diasPendentes('2026-11-02', [], []).join() === '2026-10-28,2026-10-29,2026-10-30', 'perfil: um registro antigo não altera os pendentes e a janela cruza o fim do mês');

  // produtividade: demandas finalizadas no dia, independentemente do prazo; zero é valor
  const dem = (id, o) => ({ id, etapa: 'Fazendo', concluida_em: null, arquivada_em: null, tipo: 'Processo', numero: '', assunto: id, tarefas: [], ...o });
  const fin = (id, dia, o = {}) => dem(id, { etapa: 'Finalizado', concluida_em: dia, prazo: '2026-12-31', ...o });
  const serie = serieDoPeriodo([fin('a', H), fin('b', H, { prazo: '2020-01-01' }), fin('c', '2026-11-05'), dem('d', { etapa: 'Fazendo' }), fin('e', '2026-10-01', {})], [reg(H, 4, 2)], H, 7);
  ok(serie.length === 7 && serie[6].dia === H && serie[0].dia === '2026-10-31' && serie[6].concluidas === 2 && serie[5].concluidas === 1 && serie[4].concluidas === 0, 'perfil: produtividade conta as finalizadas por data de conclusão (prazo vencido ou não é indiferente), em 7 dias que terminam em hoje');
  ok(serie[6].registro?.humor === 4 && serie[5].registro === null && serie[4].concluidas === 0, 'perfil: zero é um valor (0 finalizadas) e a falta de registro é diferente (registro nulo)');
  ok(serieDoPeriodo([fin('a', H), fin('a', H)], [], H, 1)[0].concluidas === 1, 'perfil: a mesma demanda nas duas listas (ativas e arquivadas durante uma atualização) conta uma vez');
  ok(serieDoPeriodo([fin('a', H, { arquivada_em: '2026-11-06T10:00:00Z' })], [], H, 1)[0].concluidas === 1, 'perfil: demanda finalizada e arquivada ainda conta no dia da conclusão');
  ok(serieDoPeriodo([dem('a', { concluida_em: H })], [], H, 1)[0].concluidas === 0 && serieDoPeriodo([fin('a', '2027-01-01')], [], H, 30).every((p) => p.concluidas === 0), 'perfil: só etapa Finalizado conta, e data de conclusão fora do período não entra');
  ok(serieDoPeriodo([], [], '2026-03-01', 30)[0].dia === '2026-01-31' && serieDoPeriodo([], [], '2028-03-01', 3).map((p) => p.dia).join() === '2028-02-28,2028-02-29,2028-03-01', 'perfil: o período atravessa meses e ano bissexto sem pular dia');

  // textos neutros
  const t0 = textoDoDia({ dia: H, concluidas: 0, registro: null }, H), t1 = textoDoDia({ dia: '2026-11-05', concluidas: 1, registro: reg('2026-11-05', 5) }, H);
  ok(/Hoje, sexta-feira, 06\/11: nenhuma demanda finalizada, sem registro de humor\./.test(t0) && /Quinta-feira, 05\/11: 1 demanda finalizada, humor muito bem\./.test(t1), 'perfil: o resumo do dia diz zero como zero, "sem registro" como falta, e usa os nomes dos níveis');
  const frases = [0, 1, 2, 9].map(fraseDoDia).join(' ');
  ok(!/meta|parab|bom trabalho|ruim|péssim|abaixo|acima|sequência|compar/i.test(frases + AVISO_PERFIL) && /zero também acontece/.test(fraseDoDia(0)) && textoConcluidas(2) === '2 demandas finalizadas', 'perfil: frases neutras, sem meta, nota, sequência nem comparação');
  ok(/privado/.test(AVISO_PERFIL) && /não substitui acompanhamento profissional/.test(AVISO_PERFIL), 'perfil: o aviso previsto (privado e não substitui acompanhamento profissional) está preservado');

  // leitura do banco e mescla
  ok(registrosValidos([reg('2026-11-06', 5), { dia: '2026-11-05', humor: 6 }, { dia: 'x', humor: 1 }, null, { dia: '2026-11-04', humor: '3' }]).length === 1 && registrosValidos({}).length === 0 && registrosValidos(undefined).length === 0, 'perfil: resposta fora do formato vira lista vazia ou descarta só o item ruim');
  const mesc = substituirRegistros([reg('2026-11-04', 1, 1), reg('2026-11-06', 2, 2)], [reg('2026-11-06', 5, 5), reg('2026-11-05', 3, 3)]);
  ok(mesc.map((r) => r.dia + ':' + r.humor).join() === '2026-11-04:1,2026-11-05:3,2026-11-06:5', 'perfil: gravar substitui o mesmo dia (sem duplicar) e mantém a ordem');
  ok(JSON.stringify(validarRegistros([{ dia: H, humor: 3, energia: 2 }])[0]) === JSON.stringify({ dia: H, humor: 3 }), 'perfil: a validação aceita um dia só com o humor e descarta qualquer outro campo (a energia não é guardada)');
  const recusas = [[], null, 'x', [{ dia: H, humor: 0 }], [{ dia: H, humor: 6 }], [{ dia: H, humor: '3' }], [{ dia: H }], [{ dia: '2026-02-30', humor: 3 }], [{ dia: 'ontem', humor: 3 }], [{ dia: H, humor: 3 }, { dia: H, humor: 4 }], Array.from({ length: 7 }, (_, i) => ({ dia: somarDias(H, -i), humor: 3 }))];
  let recusadas = 0, vazou = false;
  for (const r of recusas) { try { validarRegistros(r); } catch (e) { recusadas++; if (/[0-9]/.test(String(e.message).replace(/1 a 5|1 a 6/g, ''))) vazou = true; } }
  ok(recusadas === recusas.length && !vazou, 'perfil: a validação recusa lista vazia, dia inexistente, nível fora de 1 a 5, nível ausente e dia repetido, sem repetir os valores na mensagem');

  // relógio dos lembretes
  const T0 = Date.UTC(2026, 10, 6, 11, 0, 0), ent = (o) => ({ agora: T0, dia: H, visivel: true, ativo: true, carregado: true, registradoHoje: false, temPendencias: false, ...o });
  const r0 = tique(estadoInicial(H, T0), ent({}));
  ok(r0.estado.pendente === 'entrada' && r0.estado.entrada && r0.estado.trabalhado === 0 && !r0.convidar, 'lembretes: a primeira vez do dia visível e em uso gera o lembrete de entrada');
  ok(tique(estadoInicial(H, T0), ent({ registradoHoje: true })).estado.pendente === null && tique(estadoInicial(H, T0), ent({ registradoHoje: true })).estado.entrada, 'lembretes: com o dia já registrado (em outro aparelho), a entrada não pede de novo');
  ok(tique(estadoInicial(H, T0), ent({ carregado: false })).estado.entrada === false && tique(estadoInicial(H, T0), ent({ visivel: false })).estado.entrada === false && tique(estadoInicial(H, T0), ent({ ativo: false })).estado.entrada === false, 'lembretes: sem registros lidos, com a aba escondida ou com o aparelho parado, nada é decidido nem contado');
  ok(tique(estadoInicial(H, T0), ent({ temPendencias: true })).convidar === true && tique(r0.estado, ent({ agora: T0 + 30000, temPendencias: true })).convidar === false, 'lembretes: o convite para completar os dias vem uma vez por dia, só se houver pendência');
  // 3 horas de trabalho em tiques de 30 s
  let e = r0.estado, agora = T0, geradas = 0; const marcos = [];
  for (let i = 0; i < 2 * 3 * 3600 / 30 + 10; i++) {
    agora += 30000; const antes = e.lembretes;
    e = tique(e, ent({ agora })).estado;
    if (e.lembretes > antes) { geradas++; marcos.push(Math.round((agora - T0) / 3600000 * 100) / 100); e = resolver(e); }
  }
  ok(geradas === 2 && marcos.join() === '3,6' && e.pendente === null, 'lembretes: um lembrete a cada 3 horas de trabalho (3 h e 6 h) e, respondido, o balão some até o próximo marco');
  // lembrete ignorado não repete nem se perde
  let ig = tique(estadoInicial(H, T0), ent({ registradoHoje: true })).estado;
  for (let i = 0; i < 3 * 3600 / 30 + 2; i++) ig = tique(ig, ent({ agora: T0 + (i + 1) * 30000, registradoHoje: true })).estado;
  const n1 = ig.lembretes; ig = tique(ig, ent({ agora: T0 + 3 * 3600 * 1000 + 120000, registradoHoje: true })).estado;
  ok(ig.pendente === 'horas' && n1 === 1 && ig.lembretes === 1, 'lembretes: o lembrete das 3 horas fica pendente sem ser respondido e não gera outro enquanto o marco é o mesmo');
  // pausa longa e aba escondida não contam
  let pz = tique(estadoInicial(H, T0), ent({})).estado;
  pz = tique(pz, ent({ agora: T0 + 5 * 3600 * 1000 })).estado;
  ok(pz.trabalhado <= PASSO_MAX && pz.lembretes === 0, 'lembretes: voltar depois de horas parado conta no máximo um tique (a pausa não paga o intervalo)');
  let es = tique(estadoInicial(H, T0), ent({})).estado;
  for (let i = 1; i <= 40; i++) es = tique(es, ent({ agora: T0 + i * 30000, visivel: false })).estado;
  ok(es.trabalhado === 0, 'lembretes: aba escondida não conta tempo');
  // duas abas do mesmo aparelho (o último tique é compartilhado): o tempo não passa a valer o dobro
  let dupla = tique(estadoInicial(H, T0), ent({})).estado;
  for (let i = 1; i <= 120; i++) { dupla = tique(dupla, ent({ agora: T0 + i * 30000 })).estado; dupla = tique(dupla, ent({ agora: T0 + i * 30000 + 5000 })).estado; }
  ok(Math.abs(dupla.trabalhado - 120 * 30 - 5) <= 5, 'lembretes: duas abas visíveis contam o tempo uma só vez (cerca de 3600 s em 1 hora, não 7200 s)');
  // virada do dia
  let noite = tique(estadoInicial(H, T0), ent({ registradoHoje: true })).estado;
  noite = { ...noite, trabalhado: 3 * 3600 - 20, lembretes: 0, pendente: 'horas', convite: true };
  const amanha = tique(noite, ent({ agora: T0 + 24 * 3600000, dia: '2026-11-07', temPendencias: true }));
  ok(amanha.estado.dia === '2026-11-07' && amanha.estado.trabalhado === 0 && amanha.estado.lembretes === 0 && amanha.estado.pendente === 'entrada' && amanha.convidar === true, 'lembretes: no dia seguinte o contador recomeça, a entrada e o convite voltam e o pendente de ontem não é carregado');
  ok(tique(noite, ent({ agora: T0 + 24 * 3600000, dia: '2026-11-07', ativo: false })).estado.entrada === false, 'lembretes: virar o dia com o aparelho parado não gera lembrete: ele espera o primeiro uso');
  ok(lerEstado({ dia: '2026-11-05', trabalhado: 100, entrada: true }, H, T0).trabalhado === 0 && lerEstado('lixo', H, T0).dia === H && lerEstado({ dia: H, trabalhado: -5, ultimo: 'x', pendente: 'outro', lembretes: 2.7 }, H, T0).pendente === null && lerEstado({ dia: H, trabalhado: -5, lembretes: 2.7 }, H, T0).lembretes === 2, 'lembretes: estado guardado de outro dia, ilegível ou fora do formato volta ao começo, sem quebrar');
  ok(INTERVALO_S === 10800 && OCIOSO_MS === 900000, 'lembretes: o intervalo é de 3 horas e o aparelho conta como parado depois de 15 minutos sem uso');
  ok(!/humor/i.test(JSON.stringify(r0.estado)), 'lembretes: o estado guardado no aparelho não tem o humor');
}


// ---------- Para hoje, ano do documento e filtros (decisão 60) ----------
{
  const { anoReconhecido, anoDoDocumento, chaveOpcao } = await import('../src/lib/documentos.ts');
  const { elegiveisParaHoje, vagasAbertas, precisaCompletar, novasUrgencias, ehUrgente } = await import('../src/lib/para-hoje.ts');
  ok(anoReconhecido('32/2026') === 2026 && anoReconhecido('2024/1250') === 2024 && anoReconhecido(' 1842 / 2026 ') === 2026 && anoReconhecido('45/2026') === 2026, 'ano do documento: reconhece formatos inequívocos ("32/2026", "2024/1250", com espaços)');
  ok(anoReconhecido('2024/2025') === null && anoReconhecido('') === null && anoReconhecido('s/n') === null && anoReconhecido('12/34') === null && anoReconhecido('Proc. 12/2026') === null && anoReconhecido('1/2/2026') === null && anoReconhecido('1250/1990') === 1990 && anoReconhecido('12/1800') === null, 'ano do documento: ausente, ambíguo ("2024/2025"), fora de formato ou fora de 1990 a 2100 fica sem ano');
  ok(anoDoDocumento({ numero: '32/2026', documento_ano: 2025 }) === 2025 && anoDoDocumento({ numero: '32/2026', documento_ano: null }) === 2026 && anoDoDocumento({ numero: '', documento_ano: 2023 }) === 2023, 'ano do documento: o ano confirmado à mão vale mais que o reconhecido');
  ok(chaveOpcao('  Secretaria   de OBRAS ') === 'secretaria de obras' && chaveOpcao(null) === '', 'opções: a chave de comparação ignora maiúsculas e espaços repetidos');
  const base = { tipo: null, area: 'Geral', numero: '', assunto: 'x', descricao: '', origem: '', etapa: 'Fazendo', etapa_desde: '2026-11-01T12:00:00Z', chegou_em: null, prazo: null, prazo_original: null, prazo_dias: null, prazo_base_em: null, prazo_ajuste: null, prazo_legado: false, prazo_tipo: 'Próprio', rapida: false, documento_ano: null, setor: null, acompanhar_em: null, encaminhada_em: null, reiterada_em: null, concluida_em: null, arquivada_em: null, criado_em: '2026-11-01T12:00:00Z', atualizado_em: '2026-11-01T12:00:00Z', entrada_id: null, versao: 1, tarefas: [] };
  const D = (id, o = {}) => ({ ...base, id, criado_em: `2026-11-01T12:00:${String(id.length).padStart(2, '0')}Z`, ...o });
  const H = '2026-11-10';
  const lista2 = [
    D('lenta', { prazo: '2026-11-05' }), D('rapida', { prazo: '2026-11-08', rapida: true }), D('hoje', { prazo: H }), D('hojeR', { prazo: H, rapida: true }), D('prox', { prazo: '2026-11-13' }), D('longe', { prazo: '2026-12-30' }),
    D('semR', { rapida: true, criado_em: '2026-11-02T00:00:00Z' }), D('sem', { criado_em: '2026-11-01T00:00:00Z' }),
    D('fin', { etapa: 'Finalizado', concluida_em: '2026-11-09', prazo: '2026-11-01' }), D('arq', { arquivada_em: '2026-11-09T00:00:00Z', prazo: '2026-11-01' }),
    D('espera', { etapa: 'Aguardando retorno', etapa_desde: '2026-11-09T12:00:00Z' }), D('esperaVenc', { etapa: 'Aguardando retorno', etapa_desde: '2026-10-01T12:00:00Z' }),
    D('cobr', { etapa: 'Aguardando retorno', etapa_desde: '2026-11-09T12:00:00Z', acompanhar_em: '2026-11-09' }),
    D('pref', { etapa: 'Aguardando Prefeita', etapa_desde: '2026-11-09T12:00:00Z' }), D('prefLonga', { etapa: 'Aguardando Prefeita', etapa_desde: '2026-10-20T12:00:00Z' }),
  ];
  const e = elegiveisParaHoje(lista2, H, []);
  const ids = e.map((x) => x.demanda.id);
  ok(ids.join() === 'rapida,esperaVenc,lenta,cobr,hojeR,hoje,prefLonga,prox,semR,sem', 'Para hoje: ordem completa (atrasadas com a Rápida à frente, depois as que vencem hoje, até 7 dias e sem prazo)');
  const classe = (id) => e.find((x) => x.demanda.id === id)?.classe;
  ok(classe('lenta') === 'atrasada' && classe('hoje') === 'hoje' && classe('prox') === 'proxima' && classe('sem') === 'sem-prazo', 'Para hoje: classes atrasada, hoje, até 7 dias e sem prazo');
  ok(!ids.includes('longe') && !ids.includes('fin') && !ids.includes('arq') && !ids.includes('espera') && !ids.includes('pref'), 'Para hoje: não entram prazo distante, finalizada, arquivada, nem quem aguarda terceiros sem cobrança devida');
  ok(ids.includes('cobr') && ids.includes('esperaVenc') && ids.includes('prefLonga') && e.find((x) => x.demanda.id === 'cobr').cobranca && ehUrgente(classe('cobr')), 'Para hoje: cobranças devidas a terceiros (acompanhar vencido, retorno de 10 dias vencido, espera da Prefeita acima do limite) contam como urgência');
  const ordem = (a, b) => ids.indexOf(a) < ids.indexOf(b);
  ok(ordem('rapida', 'lenta') && ordem('hojeR', 'hoje') && ordem('lenta', 'hojeR') && ordem('semR', 'sem') && ordem('prox', 'semR'), 'Para hoje: a marca Rápida desempata dentro do mesmo grupo (atrasadas antes de hoje, hoje antes de 7 dias, e sem prazo por último)');
  const comPrazoUsuario = elegiveisParaHoje([D('a', { prazo: '2026-11-09' })], H, []);
  ok(comPrazoUsuario.length === 1 && comPrazoUsuario[0].cobranca === false, 'Para hoje: demanda dependente do usuário não é marcada como cobrança');
  // vagas
  const vg = [{ posicao: 1, demanda_id: 'rapida' }, { posicao: 2, demanda_id: 'fin' }, { posicao: 3, demanda_id: 'sumiu' }];
  ok(vagasAbertas(vg, lista2).map((v) => `${v.posicao}:${v.demanda.id}`).join() === '1:rapida', 'vagas: as de demanda finalizada, arquivada ou inexistente ficam livres e as outras continuam nas suas posições');
  ok(precisaCompletar(vg, lista2, e) === true && precisaCompletar([1, 2, 3].map((p, i) => ({ posicao: p, demanda_id: ['rapida', 'lenta', 'hojeR'][i] })), lista2, e) === false && precisaCompletar(vg, lista2, []) === false, 'vagas: só chama o banco quando há vaga livre e candidata');
  const nu = novasUrgencias([{ posicao: 1, demanda_id: 'rapida' }, { posicao: 2, demanda_id: 'lenta' }, { posicao: 3, demanda_id: 'hojeR' }], lista2, e).map((x) => x.demanda.id);
  ok(nu.includes('hoje') && nu.includes('cobr') && !nu.includes('rapida') && !nu.includes('prox') && !nu.includes('sem'), 'nova urgência: só atrasadas e as que vencem hoje fora das vagas aparecem à parte');
  // filtros
  const fl = [D('a', { tipo: 'Ofício', numero: '32/2026', origem: 'Prefeita' }), D('b', { tipo: 'Memorando', numero: '2024/1250', origem: ' prefeita ' }), D('c', { tipo: null, numero: '2024/2025', origem: 'Reunião' }), D('d', { tipo: 'ofício', numero: 'sem', documento_ano: 2023 }), D('e2')];
  const f = (o) => filtrar(fl, { ...FILTRO_VAZIO, ...o }, H, []).map((x) => x.id).join();
  ok(f({}) === 'a,b,c,d,e2' && f({ origem: 'Prefeita' }) === 'a,b' && f({ tipo: 'Ofício' }) === 'a,d' && f({ ano: '2024' }) === 'b' && f({ ano: '2026' }) === 'a' && f({ ano: '2023' }) === 'd', 'filtros: origem, tipo e ano (reconhecido ou confirmado), ignorando maiúsculas e espaços; ambíguos e vazios só em Todos');
  ok(f({ origem: 'Prefeita', tipo: 'Memorando', ano: '2024' }) === 'b' && f({ origem: 'Prefeita', ano: '2023' }) === '' && f({ origem: 'Reunião', tipo: 'Ofício' }) === '', 'filtros: combinam origem, tipo e ano (E lógico)');
  ok(titulo({ tipo: null, numero: '' }) === 'Sem documento' && titulo({ tipo: null, numero: '45/2026' }) === '45/2026' && titulo({ tipo: 'Ofício', numero: '' }) === 'Ofício', 'título: sem tipo mostra só o número e, sem nada, "Sem documento" (nunca um título vazio)');
}
// coluna lateral que acompanha a página (Agenda, decisão 73): limites do `top` e deslocamento contínuo, sem salto na troca de direção
{
  const lim = limitesDaColuna(500, 800, 84); // cabe: fica sempre logo abaixo do cabeçalho
  ok(lim.max === 84 && lim.min === 84 && topoDepoisDeRolar(84, 300, lim) === 84 && topoDepoisDeRolar(84, -300, lim) === 84, 'coluna lateral que cabe na área visível fica fixa logo abaixo do cabeçalho, ao descer e ao subir');
  const alta = limitesDaColuna(1200, 800, 84); // mais alta que a área visível: acompanha a página até a borda de baixo aparecer
  ok(alta.max === 84 && alta.min === 800 - 1200 - 16 && alta.min < alta.max, 'coluna mais alta que a área visível tem como limite mínimo a borda de baixo (com 16 px de folga)');
  let t = alta.max; t = topoDepoisDeRolar(t, 100, alta); const descendo = t; t = topoDepoisDeRolar(t, 5000, alta);
  ok(descendo === -16 && t === alta.min, 'ao descer, a coluna sobe com a página (mesmo deslocamento) e para quando a borda de baixo aparece');
  ok(topoDepoisDeRolar(alta.min, -50, alta) === alta.min + 50 && topoDepoisDeRolar(alta.min + 50, -5000, alta) === alta.max, 'ao subir, a coluna acompanha a página a partir de onde parou (sem salto) até a borda de cima chegar ao cabeçalho');
}
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
