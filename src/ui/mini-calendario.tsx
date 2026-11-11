'use client';
// Mini calendário do Início (decisão 64): o mês em português (a semana começa na segunda), setas, seleção inicial em hoje, as seis categorias em cores e a lista do dia logo abaixo.
// Toda a lógica de categorias e de datas fica em src/lib/mini-calendario.ts (testada à parte); aqui só se desenha. Nada de relógio na renderização: "hoje" vem do contexto.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as TeclaReact } from 'react';
import { useRouter } from 'next/navigation';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { anoMes, dataPorExtenso, diasNoMes, indiceSemana, NOMES_MES, primeiroDoMes, SEMANA_ABREVIADAS, SEMANA_NOMES, somarMeses } from '@/lib/agenda';
import { somarDias } from '@/lib/prazos';
import { CATEGORIAS_MINI, categoriasDoDia, descreverDiaMini, faixasDaCelula, itensMini, mapaMini, ROTULO_MINI, type CategoriaMini, type ItemMini } from '@/lib/mini-calendario';

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const corDa = (c: CategoriaMini) => `var(--cal-${c})`;
const dois = (n: number) => String(n).padStart(2, '0');

/** As células do mês em semanas de segunda a domingo, com os dias do mês anterior e do seguinte completando as pontas (esmaecidos). */
function semanasDoMes(primeiro: string): { data: string; doMes: boolean }[][] {
  const { ano, mes } = anoMes(primeiro), total = diasNoMes(ano, mes), inicio = somarDias(primeiro, -indiceSemana(primeiro)), n = Math.ceil((indiceSemana(primeiro) + total) / 7);
  return Array.from({ length: n }, (_, s) => Array.from({ length: 7 }, (_, i) => { const d = somarDias(inicio, s * 7 + i); return { data: d, doMes: d.slice(0, 7) === `${ano}-${dois(mes)}` }; }));
}

function ItemDoDia({ i }: { i: ItemMini }) {
  const { abrirJanela } = useApp();
  const router = useRouter();
  const abrir = () => { if (i.origem.tipo === 'evento') abrirJanela({ t: 'evento', id: i.origem.id }); else if (i.origem.tipo === 'demanda') abrirJanela({ t: 'editar', id: i.origem.id }); else router.push('/config'); };
  const acao = i.origem.tipo === 'evento' ? `Abrir o evento: ${i.titulo}` : i.origem.tipo === 'demanda' ? `Abrir a demanda: ${i.titulo}` : `Abrir Configurações para ${i.titulo}`;
  return (
    <li className="mc-item" data-categoria={i.categoria} data-origem={i.origem.tipo}>
      <button type="button" className="mc-item-b" aria-label={`${ROTULO_MINI[i.categoria]}: ${acao}. ${i.detalhe}`} onClick={abrir}>
        <i className="mc-barra" aria-hidden="true" />
        <span className="mc-item-t"><span className="mc-rot">{ROTULO_MINI[i.categoria]}</span><b>{i.titulo}</b><small>{i.detalhe}</small></span>
      </button>
    </li>
  );
}

export function MiniCalendario() {
  const { hoje, eventos, dias, pagamentos, demandas, abrirJanela } = useApp();
  const [sel, setSel] = useState<string | null>(null);   // nulo = hoje (acompanha a virada do dia)
  const [vista, setVista] = useState<string | null>(null); // primeiro dia do mês mostrado; nulo = mês da seleção
  const dia = sel ?? hoje;
  const primeiro = vista ?? primeiroDoMes(dia);
  const { ano, mes } = anoMes(primeiro);
  const semanas = useMemo(() => semanasDoMes(primeiro), [primeiro]);
  const fontes = useMemo(() => ({ eventos, dias, pagamentos, demandas, hoje }), [eventos, dias, pagamentos, demandas, hoje]);
  const mapa = useMemo(() => mapaMini(semanas[0][0].data, semanas[semanas.length - 1][6].data, fontes), [semanas, fontes]);
  const itensDia = useMemo(() => itensMini(dia, fontes), [dia, fontes]);
  const gridRef = useRef<HTMLDivElement>(null);
  const focar = useRef(false);
  useEffect(() => { if (focar.current) { focar.current = false; gridRef.current?.querySelector<HTMLElement>(`[data-data="${dia}"]`)?.focus(); } }, [dia, primeiro]);

  const escolher = (d: string) => { setSel(d); setVista(primeiroDoMes(d)); };
  const mudarMes = (n: 1 | -1) => setVista(primeiroDoMes(somarMeses(primeiro, n)));
  const tecla = (e: TeclaReact<HTMLDivElement>) => {
    const passo: Record<string, string> = { ArrowLeft: somarDias(dia, -1), ArrowRight: somarDias(dia, 1), ArrowUp: somarDias(dia, -7), ArrowDown: somarDias(dia, 7), Home: somarDias(dia, -indiceSemana(dia)), End: somarDias(dia, 6 - indiceSemana(dia)), PageUp: somarMeses(dia, -1), PageDown: somarMeses(dia, 1) };
    const alvo = passo[e.key];
    if (!alvo || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); focar.current = true; escolher(alvo);
  };
  const diaTabulavel = semanas.flat().some((c) => c.data === dia) ? dia : semanas.flat().find((c) => c.doMes)!.data;

  return (
    <section className="mini-cal" aria-label="Calendário do mês" data-mini-calendario>
      <header className="mc-cab">
        <button type="button" className="icbtn-s mc-seta" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><Icone nome="chevron-right" /></button>
        <h3 className="mc-mes" aria-live="polite">{maiuscula(NOMES_MES[mes - 1])} de {ano}</h3>
        <button type="button" className="icbtn-s mc-seta" aria-label="Próximo mês" onClick={() => mudarMes(1)}><Icone nome="chevron-right" /></button>
      </header>
      <div className="mc-grade" role="grid" aria-label={`Dias de ${NOMES_MES[mes - 1]} de ${ano}`} ref={gridRef} onKeyDown={tecla}>
        <div className="mc-linha" role="row">{SEMANA_ABREVIADAS.map((l, i) => <div key={l} className="mc-cabsem" role="columnheader"><abbr title={SEMANA_NOMES[i]}>{maiuscula(l)}</abbr></div>)}</div>
        {semanas.map((sem, i) => (
          <div key={i} className="mc-linha" role="row">
            {sem.map(({ data, doMes }) => {
              const itens = mapa.get(data) ?? [], cats = categoriasDoDia(itens), selecionado = data === dia;
              const estilo = { backgroundImage: faixasDaCelula(cats, corDa) } as CSSProperties;
              return (
                <div key={data} role="gridcell" aria-selected={selecionado}>
                  <button type="button" className="mc-dia" data-data={data} data-hoje={data === hoje || undefined} data-sel={selecionado || undefined} data-fora={!doMes || undefined} data-cats={cats.join(' ') || undefined} data-n={cats.length || undefined} style={estilo}
                    tabIndex={data === diaTabulavel ? 0 : -1} aria-current={data === hoje ? 'date' : undefined} aria-label={descreverDiaMini(data, itens, { hoje, selecionado })} onClick={() => escolher(data)}>
                    <span className="mc-num">{Number(data.slice(8, 10))}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="mc-leg" aria-label="Categorias do calendário">
        {CATEGORIAS_MINI.map((c) => <li key={c} data-categoria={c}><i className="mc-amostra" aria-hidden="true" />{ROTULO_MINI[c]}</li>)}
      </ul>
      <div className="mc-dia-lista" data-data={dia}>
        <header className="mc-dl-cab">
          <h4 id="mc-dl-t">{maiuscula(dataPorExtenso(dia))}</h4>
          <button type="button" className="icbtn-s mc-mais" aria-label={`Novo evento em ${dataPorExtenso(dia)}`} title="Novo evento neste dia" onClick={() => abrirJanela({ t: 'evento', data: dia })}><Icone nome="plus" /></button>
        </header>
        {itensDia.length ? <ul className="mc-itens" aria-labelledby="mc-dl-t">{itensDia.map((i) => <ItemDoDia key={i.chave} i={i} />)}</ul> : <p className="mc-vazio">Nada neste dia.</p>}
      </div>
    </section>
  );
}
