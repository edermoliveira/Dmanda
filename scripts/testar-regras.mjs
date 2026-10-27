// Regras puras de datas e grupos do Início (src/lib/demandas.ts), sem navegador nem banco. Uso: node scripts/testar-regras.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessaoExpirou, emailAutorizado, contaAutorizada, opcoesCookieUltimoUso, LIMITE_SEM_USO_MS } from '../src/lib/sessao.ts';
import { googleLigado } from '../src/lib/login.ts';
import { segredoConfere, executarRotinaDiaria } from '../src/nucleo/rotina.ts';
import { dataFiltro, grupoFiltro, porGrupo, focoDoDia, atrasada, diasAte } from '../src/lib/demandas.ts';
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
const agora = 1_000_000_000_000;
ok(!sessaoExpirou(String(agora - LIMITE_SEM_USO_MS + 1000), agora) && sessaoExpirou(String(agora - LIMITE_SEM_USO_MS - 1000), agora), 'sessão: expira só depois de 6 horas sem uso');
ok(sessaoExpirou(undefined, agora) && sessaoExpirou('', agora) && sessaoExpirou('lixo', agora) && sessaoExpirou('Infinity', agora), 'sessão: sem marca de último uso, ilegível ou inválida conta como expirada (apagar o cookie não prolonga a sessão)');
ok(sessaoExpirou(String(agora + 24 * 60 * 60 * 1000), agora) && !sessaoExpirou(String(agora + 30_000), agora), 'sessão: marca no futuro (cookie adulterado) expira; só uma diferença pequena de relógio é tolerada');
ok(emailAutorizado('Secretario@Exemplo.com', 'secretario@exemplo.com') && !emailAutorizado('outro@exemplo.com', 'secretario@exemplo.com') && !emailAutorizado('a@b.c', undefined) && !emailAutorizado(null, 'a@b.c'), 'e-mail autorizado: confere sem diferenciar maiúsculas; sem configuração ninguém entra');
ok(grupoFiltro(lista[0], hoje) === 'atrasadas' && grupoFiltro(lista[1], hoje) === 'hoje' && grupoFiltro(lista[2], hoje) === 'sete' && grupoFiltro(lista[3], hoje) === null && grupoFiltro(lista[4], hoje) === null, 'grupoFiltro: atrasadas, hoje, próximos 7 dias; depois disso e sem prazo ficam fora');
ok(contaAutorizada({ email: 'Eu@Exemplo.com', app_metadata: { provider: 'google' } }, 'eu@exemplo.com'), 'conta autorizada: e-mail certo entrando pelo Google');
ok(contaAutorizada({ email: 'Eu@Exemplo.com', app_metadata: { provider: 'email' } }, 'eu@exemplo.com'), 'conta autorizada: e-mail certo entrando por e-mail e senha');
ok(!contaAutorizada({ email: 'eu@exemplo.com', app_metadata: { provider: 'github' } }, 'eu@exemplo.com') && !contaAutorizada({ email: 'eu@exemplo.com', app_metadata: { provider: 'anonymous' } }, 'eu@exemplo.com') && !contaAutorizada({ email: 'eu@exemplo.com' }, 'eu@exemplo.com') && !contaAutorizada({ email: 'outro@exemplo.com', app_metadata: { provider: 'google' } }, 'eu@exemplo.com') && !contaAutorizada(null, 'eu@exemplo.com') && !contaAutorizada({ email: 'eu@exemplo.com', app_metadata: { provider: 'google' } }, undefined), 'conta autorizada: provedor fora de Google e e-mail e senha, sem provedor, outro e-mail, sem usuário ou sem configuração são recusados');
ok(googleLigado('sim') && googleLigado(' SIM ') && !googleLigado(undefined) && !googleLigado('') && !googleLigado('nao') && !googleLigado('true') && !googleLigado('1'), 'botão do Google: oculto por padrão (variável ausente, vazia, "nao" ou outro valor) e visível só com "sim"');

ok(opcoesCookieUltimoUso(true).secure === true && opcoesCookieUltimoUso(false).secure === false && opcoesCookieUltimoUso(true).httpOnly === true && opcoesCookieUltimoUso(true).sameSite === 'lax', 'cookie de último uso: sempre só do servidor (httpOnly) e "secure" apenas sobre HTTPS (em http local o navegador o descartaria)');
// Regra de sessão que depende do código: o proxy não distingue pré-carregamento (o Next esconde os cabeçalhos), então nada no aplicativo em uso pode pré-carregar
// sozinho, senão uma aba esquecida renovaria o último uso. As páginas do design antigo (src/app/(antigo)) e src/components ficam fora (só referência, atrás do login).
{
  const achados = [];
  const ler = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const c = join(dir, e.name); if (e.isDirectory()) { if (!/antigo|components/.test(e.name)) ler(c); } else if (e.name !== 'proxy.ts' && /\.(tsx?|mjs)$/.test(e.name) && /next\/link|router\.prefetch|prefetch\s*[=:(]/.test(readFileSync(c, 'utf8'))) achados.push(c); } };
  ler('src');
  ok(achados.length === 0, 'sessão: nenhum <Link> nem router.prefetch no aplicativo em uso (pré-carregar renovaria o último uso sem ninguém usar)' + (achados.length ? ': ' + achados.join(', ') : ''));
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
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
