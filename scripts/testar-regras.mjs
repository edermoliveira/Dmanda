// Regras puras de datas e grupos do Início (src/lib/demandas.ts), sem navegador nem banco. Uso: node scripts/testar-regras.mjs
import { sessaoExpirou, emailAutorizado, LIMITE_SEM_USO_MS } from '../src/lib/sessao.ts';
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
ok(!sessaoExpirou(undefined, agora) && !sessaoExpirou('lixo', agora), 'sessão: sem marca de último uso (primeiro acesso) não expira');
ok(emailAutorizado('Secretario@Exemplo.com', 'secretario@exemplo.com') && !emailAutorizado('outro@exemplo.com', 'secretario@exemplo.com') && !emailAutorizado('a@b.c', undefined) && !emailAutorizado(null, 'a@b.c'), 'e-mail autorizado: confere sem diferenciar maiúsculas; sem configuração ninguém entra');
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
