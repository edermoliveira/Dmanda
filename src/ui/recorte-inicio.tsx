'use client';
// Recorte por prazo no Início (ajuste de 22/11/2026): Atrasadas, Vencem hoje e Próximos 7 dias mostram aqui as demandas do recorte, no lugar do Para hoje e da Urgência, sem sair da página.
// Os recortes são exatamente os grupos dos contadores (porGrupo, a mesma data aplicável de lib/demandas.ts); o estado do filtro mora na página e nunca é gravado. A apresentação é a dos cards
// aprovados: grade de cards no computador e no iPad, baralho de navegação (sem avanço de etapa) no celular.
import { useMemo, useRef } from 'react';
import { useApp } from './contexto';
import { CardDemanda } from './cartoes';
import { BaralhoSimples, useModo } from './baralho';
import { plural, porGrupo, type GrupoInicio } from '@/lib/demandas';

/** Os três recortes do Início: a chave, o nome do botão, o nome do recorte aberto e a frase do estado vazio. */
export const RECORTES_INICIO = {
  atrasadas: { nome: 'Atrasadas', vazio: 'Nenhuma demanda atrasada.' },
  hoje: { nome: 'Vencem hoje', vazio: 'Nenhuma demanda vence hoje.' },
  sete: { nome: 'Próximos 7 dias', vazio: 'Nenhuma demanda nos próximos 7 dias.' },
} as const satisfies Record<GrupoInicio, { nome: string; vazio: string }>;

export function RecorteInicio({ grupo, limpar }: { grupo: GrupoInicio; limpar: () => void }) {
  const { demandas, hoje } = useApp();
  const secao = useRef<HTMLElement>(null);
  const modo = useModo(secao);
  const lista = useMemo(() => porGrupo(demandas, grupo, hoje), [demandas, grupo, hoje]);
  const { nome, vazio } = RECORTES_INICIO[grupo];
  const contagem = plural(lista.length, 'demanda');
  return (
    <section ref={secao} className="sec ph recorte-inicio" data-painel="recorte-inicio" data-recorte={grupo} data-modo={modo} aria-labelledby="ri-t">
      <div className="recorte-cab">
        <h3 id="ri-t"><span>{nome}</span> <small className="data" data-recorte-n={lista.length} role="status">{contagem}</small></h3>
        <button type="button" className="btn mini" data-limpar-recorte onClick={limpar}>Limpar filtro</button>
      </div>
      {!lista.length ? <div className="vazio-c" data-recorte-vazio>{vazio}</div>
        : modo === 'pilha' ? <BaralhoSimples key={grupo} lista={lista} nome={`${nome}, ${contagem}`} />
          : <div className="cards">{lista.map((d) => <div key={d.id} className="vaga"><CardDemanda d={d} mostrarRapida /></div>)}</div>}
    </section>
  );
}
