'use client';
// Início no desenho Órbita: painel principal com o anel da carga pendente da semana e o calendário mensal de carga. Os números vêm de src/lib/carga.ts
// (regras aprovadas de semana, atrasos, tarefas e demandas sem data) e não são gravados em lugar nenhum.
import { useMemo, useState } from 'react';
import { Icone } from './Icone';
import { CardDemanda } from './cartoes';
import { cargaPorDia, cargaSemana, dataAplicavel, gradeDoMes } from '@/lib/carga';
import { plural, type Demanda } from '@/lib/demandas';

const R = 115, CIRC = 2 * Math.PI * R; // anel de 248 px com 18 px de espessura: raio do traço = (248 - 18) / 2
const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaMes = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return `${d} de ${NOMES_MES[m - 1]} de ${a}`; };

export function PainelCarga({ demandas, hoje }: { demandas: Demanda[]; hoje: string }) {
  const c = useMemo(() => cargaSemana(demandas, hoje), [demandas, hoje]);
  const arco = c.pct === null ? 0 : (c.pct / 100) * CIRC;
  const [a, b] = [c.inicio, c.fim].map((x) => x.split('-').reverse().slice(0, 2).join('/'));
  return (
    <>
      <section className="o-painel o-hero" aria-labelledby="o-carga-t">
        <h2 id="o-carga-t" className="sr-only">Carga pendente da semana</h2>
        <div className="o-anel" role="img" aria-label={c.pct === null ? 'Nada com data nesta semana' : `${c.pct}% da carga da semana ainda pendente: ${c.pendentes} de ${c.total} itens`}>
          <svg viewBox="0 0 248 248" aria-hidden="true"><circle className="trilha" cx="124" cy="124" r={R} />{arco > 0 ? <circle className="arco" cx="124" cy="124" r={R} strokeDasharray={`${arco} ${CIRC}`} /> : null}</svg>
          <div className="centro" aria-hidden="true">{c.pct === null ? <span className="o-pct">—</span> : <span className="o-pct">{c.pct}<small>%</small></span>}</div>
        </div>
        <p className="o-leg">{c.pct === null ? 'Nada com data nesta semana' : 'da carga da semana pendente'}</p>
      </section>
      <p className="o-meta o-meta-fora">
        Semana de {a} a {b}{c.total ? `: ${c.pendentes} de ${c.total} ${c.total === 1 ? 'item' : 'itens'} pendentes` : ''}
        {c.semData ? ` · ${plural(c.semData, 'demanda')} sem data` : ''}
      </p>
    </>
  );
}

export function CalendarioCarga({ demandas, hoje }: { demandas: Demanda[]; hoje: string }) {
  const [ano0, mes0] = hoje.split('-').map(Number);
  const [ref, setRef] = useState({ ano: ano0, mes: mes0 });
  const [sel, setSel] = useState<string | null>(null);
  const carga = useMemo(() => cargaPorDia(demandas), [demandas]);
  const grade = useMemo(() => gradeDoMes(ref.ano, ref.mes, carga), [ref, carga]);
  const mover = (n: number) => { const t = ref.ano * 12 + (ref.mes - 1) + n; setRef({ ano: Math.floor(t / 12), mes: (t % 12) + 1 }); setSel(null); };
  const doDia = sel ? demandas.filter((d) => !d.arquivada_em && d.etapa !== 'Finalizado' && dataAplicavel(d) === sel) : [];
  return (
    <section className="o-painel" aria-labelledby="o-cal-t">
      <div className="o-cal-topo">
        <h3 id="o-cal-t">{NOMES_MES[ref.mes - 1]} de {ref.ano}</h3>
        <button type="button" className="icbtn-s" aria-label="Mês anterior" onClick={() => mover(-1)}><span className="o-inverte"><Icone nome="chevron-right" /></span></button>
        <button type="button" className="icbtn-s" aria-label="Próximo mês" onClick={() => mover(1)}><Icone nome="chevron-right" /></button>
      </div>
      <div className="o-grade" role="group" aria-label={`Carga pendente por dia, ${NOMES_MES[ref.mes - 1]} de ${ref.ano}`}>
        {SEMANA.map((s, i) => <span key={i} className="o-sem" aria-hidden="true">{s}</span>)}
        {grade.map((cel, i) => cel === null ? <span key={`v${i}`} className="o-cel vazia" aria-hidden="true" /> : (
          <button key={cel.iso} type="button" className="o-cel" data-n={cel.nivel} data-hoje={cel.iso === hoje} aria-pressed={sel === cel.iso}
            aria-label={`${diaMes(cel.iso)}: ${cel.carga ? `${cel.carga} ${cel.carga === 1 ? 'item pendente' : 'itens pendentes'}` : 'nada pendente'}`}
            onClick={() => setSel(sel === cel.iso ? null : cel.iso)}>{cel.dia}</button>
        ))}
      </div>
      <p className="o-leg-cal" aria-hidden="true">Menos<i data-n="0" /><i data-n="1" /><i data-n="2" /><i data-n="3" /><i data-n="4" />Mais carga pendente</p>
      {sel ? (
        <div className="o-dia-lista">
          <h3 className="sub-f">{SEMANA_LONGA[new Date(`${sel}T12:00:00Z`).getUTCDay()]}, {diaMes(sel)} <small>{plural(doDia.length, 'demanda')}</small></h3>
          {doDia.length ? <div className="cards">{doDia.map((d) => <CardDemanda key={d.id} d={d} />)}</div> : <div className="vazio-c">Nenhuma demanda com data neste dia.</div>}
        </div>
      ) : null}
    </section>
  );
}
