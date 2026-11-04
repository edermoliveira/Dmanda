// Fuso horário do Dmanda (decisão 51): a referência é sempre America/Sao_Paulo, qualquer que seja o fuso do aparelho ou do servidor.
// Roda as regras puras de datas e horas em vários fusos do sistema (variável TZ do Node) e exige o MESMO resultado em todos, igual ao esperado em São Paulo.
// Instantes (timestamptz) viram dia e hora de São Paulo; datas de calendário (AAAA-MM-DD) nunca se deslocam; horários de compromissos são horários de parede de São Paulo.
// Uso: node scripts/testar-fuso.mjs   (sem banco e sem navegador)
import { spawnSync } from 'node:child_process';
import { hojeISO, diasDesdeInstante, diasAte, contagemRetorno } from '../src/lib/demandas.ts';
import { minutosAgora, avisosDeHoje } from '../src/lib/eventos.ts';
import { carimbo } from '../src/lib/entradas.ts';
import { ajustarPrazo, somarDias, diaDaSemana } from '../src/lib/prazos.ts';
import { gradeMes, semanaDe, somarMeses } from '../src/lib/agenda.ts';

const FUSOS = ['UTC', 'America/Sao_Paulo', 'Pacific/Auckland', 'Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Kolkata'];

function resultado() {
  const inst = {
    viradaUTC: '2026-11-03T02:30:00Z',      // 02/11 23h30 em São Paulo
    meiaNoiteSP: '2026-11-03T03:00:00Z',    // 03/11 00h00
    antes: '2026-11-03T02:59:59Z',          // 02/11 23h59
    meioDia: '2026-11-02T15:00:00Z',        // 02/11 12h00
    ano: '2027-01-01T02:00:00Z',            // 31/12/2026 23h00
  };
  const r = {};
  for (const [k, v] of Object.entries(inst)) r[k] = [hojeISO(new Date(v)), minutosAgora(new Date(v)), carimbo(v)];
  r.desdeInstante = [diasDesdeInstante(inst.viradaUTC, '2026-11-03'), diasDesdeInstante(inst.meiaNoiteSP, '2026-11-03'), diasDesdeInstante(inst.antes, '2026-11-02')];
  const base = { etapa: 'Aguardando retorno', encaminhada_em: null, reiterada_em: null, arquivada_em: null };
  r.retorno = [contagemRetorno({ ...base, etapa_desde: inst.viradaUTC }, []).base, contagemRetorno({ ...base, etapa_desde: inst.viradaUTC }, []).data, contagemRetorno({ ...base, etapa_desde: inst.meiaNoiteSP }, []).base];
  // aviso de compromisso: 23h50 de 02/11 com aviso de 15 min, visto às 23h40 de São Paulo
  const ev = { id: 'e', titulo: 'x', data: '2026-11-02', dia_inteiro: false, inicio: '23:50', fim: null, aviso_min: 15 };
  const dez40 = '2026-11-03T02:40:00Z';
  r.aviso = [avisosDeHoje([ev], hojeISO(new Date(dez40)), minutosAgora(new Date(dez40))).map((a) => [a.tipo, a.minutos]), avisosDeHoje([ev], hojeISO(new Date(inst.meiaNoiteSP)), minutosAgora(new Date(inst.meiaNoiteSP))).length];
  // datas de calendário não se deslocam
  r.calendario = [somarDias('2026-10-25', 10), somarDias('2026-03-07', 1), diaDaSemana('2026-11-02'), diasAte('2026-11-02', '2026-10-31'), diasAte('2026-09-28', '2026-09-26'), diasAte('2026-11-15', '2026-11-02'),
    ajustarPrazo('2026-11-14', []).prazo, ajustarPrazo('2026-11-14', [{ id: 'f', data: '2026-11-13', descricao: 'x', categoria: 'Feriado' }]).prazo, somarMeses('2026-01-31', 1)];
  r.grade = [gradeMes(2026, 11)[0].join('|'), semanaDe('2026-11-02').join('|')];
  return r;
}

if (process.argv[2] === 'filho') {
  console.log(JSON.stringify(resultado()));
} else {
  let falhas = 0, total = 0;
  const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
  const saidas = {};
  for (const tz of FUSOS) {
    const p = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', import.meta.filename, 'filho'], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    saidas[tz] = p.status === 0 ? p.stdout.trim() : 'ERRO ' + (p.stderr || '').slice(0, 200);
  }
  const ref = JSON.parse(saidas['America/Sao_Paulo']);
  ok(FUSOS.every((tz) => !saidas[tz].startsWith('ERRO')), 'as regras rodam em todos os fusos do sistema testados (' + FUSOS.join(', ') + ')');
  ok(FUSOS.every((tz) => saidas[tz] === saidas['America/Sao_Paulo']), 'o resultado é idêntico em todos os fusos do sistema: o fuso do aparelho ou do servidor nunca muda dia, hora, contagem nem data de calendário');
  ok(ref.viradaUTC[0] === '2026-11-02' && ref.viradaUTC[1] === 23 * 60 + 30 && ref.viradaUTC[2] === '02/11/2026 às 23:30', '03/11 às 02h30 UTC é 02/11 às 23h30 em São Paulo (dia, minutos e carimbo)');
  ok(ref.meiaNoiteSP[0] === '2026-11-03' && ref.meiaNoiteSP[1] === 0 && ref.meiaNoiteSP[2] === '03/11/2026 às 00:00' && ref.antes[0] === '2026-11-02' && ref.antes[1] === 23 * 60 + 59, 'a virada do dia acontece à meia-noite de São Paulo (03h00 UTC): meia-noite é 0, nunca 24');
  ok(ref.ano[0] === '2026-12-31' && ref.ano[2] === '31/12/2026 às 23:00' && ref.meioDia[1] === 12 * 60, 'virada de ano e meio-dia também seguem São Paulo');
  ok(ref.desdeInstante.join() === '1,0,0', 'dias desde um instante contam pelo dia de São Paulo (instante de 02/11 23h30 já tem 1 dia em 03/11)');
  ok(ref.retorno.join() === '2026-11-02,2026-11-12,2026-11-03', 'o retorno do setor sem encaminhamento conta do dia de São Paulo em que entrou na etapa');
  ok(JSON.stringify(ref.aviso) === JSON.stringify([[['em-breve', 10]], 0]), 'aviso de compromisso 23h50 visto às 23h40 de São Paulo diz 10 min; depois da meia-noite ele deixa de ser aviso de hoje');
  ok(ref.calendario.join() === '2026-11-04,2026-03-08,1,2,2,13,2026-11-13,2026-11-12,2026-02-28', 'datas de calendário (soma de dias, dia da semana, diferenças, antecipação de prazo, soma de meses) não deslocam, nem na mudança de horário de verão de outros fusos');
  console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
  process.exit(falhas ? 1 : 0);
}
