// Regras puras de datas e grupos do Início (src/lib/demandas.ts), sem navegador nem banco. Uso: node scripts/testar-regras.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emailAutorizado, contaAutorizada, situacaoDoErroAuth, ehCookieDeSessao, COOKIE_LEGADO_ULTIMO_USO } from '../src/lib/sessao.ts';
import { ajustarPrazo, prazoPorDias, somarDias, diaDaSemana, nomeDoDia, BOTOES_PRAZO } from '../src/lib/prazos.ts';
import { googleLigado } from '../src/lib/login.ts';
import { segredoConfere, executarRotinaDiaria } from '../src/nucleo/rotina.ts';
import { dataFiltro, grupoFiltro, porGrupo, focoDoDia, atrasada, diasAte, permanencia, numeroDe, origemDe, titulo, filtrar, FILTRO_VAZIO } from '../src/lib/demandas.ts';
import { validarDados, validarDia } from '../src/nucleo/validacao.ts';
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

console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
