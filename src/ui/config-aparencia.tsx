'use client';
// Configurações > Aparência, Fontes, Tamanhos e Fundo (decisões 11 e 35, protótipo Catalyst). Tudo vale na hora, é guardado só neste navegador
// (lib/aparencia.ts) e nunca toca no banco. Restaurar padrão volta cores, fontes, tamanhos, fundo e movimento; o modo e os dias indisponíveis não mudam.
import { useLayoutEffect, useRef } from 'react';
import { ajustar } from './visoes';
import { useApp } from './contexto';
import { Icone } from './Icone';
import {
  CARD, CONJUNTOS, ePadrao, FONTES_MONO, FONTES_TEXTO, FONTES_TITULO, ICONE, MODOS, PALETAS, ROTULO_MODO, TEXTO, type Fonte, type Modo,
} from '@/lib/aparencia';

// Mesmo texto para comparar as opções do mesmo papel (português com acentos, números e datas)
const AMOSTRA: Record<'titulo' | 'texto' | 'mono', string> = {
  titulo: 'Ofício 311/2026: resposta à Secretaria de Obras',
  texto: 'Encaminhar o processo ao setor responsável e acompanhar o retorno até sexta-feira, 12 de novembro.',
  mono: 'Proc. 4521/2026 · 12/11/2026 · 3/7 · 43%',
};
const DESCRICAO_MODO: Record<Modo, string> = {
  claro: 'Sempre claro.', escuro: 'Sempre escuro.', sistema: 'Segue o modo claro ou escuro do aparelho e muda junto com ele.',
};
const ROTULO_PAPEL = { titulo: 'Principal (títulos)', texto: 'Secundária (subtítulos e textos)', mono: 'Mono (detalhes)' } as const;
const nomeDe = (lista: readonly Fonte[], id: string) => (lista.find((x) => x.id === id) ?? lista[0]).nome;
const cssDe = (lista: readonly Fonte[], id: string) => (lista.find((x) => x.id === id) ?? lista[0]).css;

/** Lista de opções (uma família por linha, com o nome e a amostra na própria fonte). Teclado: setas movem a escolha, como num grupo de opções. */
function ListaFontes({ id, papel, lista, valor, aoMudar }: { id: string; papel: 'titulo' | 'texto' | 'mono'; lista: readonly Fonte[]; valor: string; aoMudar: (v: string) => void }) {
  const raiz = useRef<HTMLDivElement>(null);
  const mover = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = lista[(i + d + lista.length) % lista.length];
    aoMudar(n.id);
    raiz.current?.querySelector<HTMLElement>(`[data-fonte="${n.id}"]`)?.focus();
  };
  return (
    <div className="fonte-grupo">
      <h4 className="cfg-sub" id={`${id}-t`}>{ROTULO_PAPEL[papel]}</h4>
      <div ref={raiz} id={id} role="radiogroup" aria-labelledby={`${id}-t`} className="fonte-lista">
        {lista.map((f, i) => (
          <button key={f.id} type="button" role="radio" aria-checked={f.id === valor} tabIndex={f.id === valor ? 0 : -1} data-fonte={f.id} className="fonte-op" onClick={() => aoMudar(f.id)} onKeyDown={(e) => mover(e, i)}>
            <span className="fonte-nome" style={{ fontFamily: f.css }}>{f.nome}</span>
            <span className={`fonte-amostra ${papel}`} style={{ fontFamily: f.css }}>{AMOSTRA[papel]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Prévia do conjunto escolhido: título, texto e detalhes, cada um na sua fonte e com o nome do papel e da família. */
function PreviaFontes({ titulo, texto, mono }: { titulo: string; texto: string; mono: string }) {
  return (
    <div className="fonte-previa" role="group" aria-label="Prévia do conjunto de fontes escolhido">
      <div><small>Título · {nomeDe(FONTES_TITULO, titulo)}</small><p className="p-titulo" style={{ fontFamily: cssDe(FONTES_TITULO, titulo) }}>{AMOSTRA.titulo}</p></div>
      <div><small>Texto · {nomeDe(FONTES_TEXTO, texto)}</small><p className="p-texto" style={{ fontFamily: cssDe(FONTES_TEXTO, texto) }}>{AMOSTRA.texto}</p></div>
      <div><small>Detalhes · {nomeDe(FONTES_MONO, mono)}</small><p className="p-mono" style={{ fontFamily: cssDe(FONTES_MONO, mono) }}>{AMOSTRA.mono}</p></div>
    </div>
  );
}

/** Um card fictício, com as classes e os tokens reais do card de demanda. Só mostra: nada nele é clicável nem grava (inert e sem dados reais). */
function PreviaCard({ dep }: { dep: unknown }) {
  // mesma regra de ajuste dos cards de Demandas (título primeiro, a descrição cede linhas e depois some): refaz a cada mudança de aparência e quando uma fonte termina de carregar
  useLayoutEffect(() => { ajustar(true); }, [dep]);
  useLayoutEffect(() => {
    const f = () => ajustar(true);
    document.fonts?.addEventListener('loadingdone', f);
    return () => document.fonts?.removeEventListener('loadingdone', f);
  }, []);
  return (
    <div className="previa-aparencia" role="img" aria-label="Prévia: um card de demanda fictício com a aparência escolhida">
      <div className="previa-fundo" inert>
        <article className="dcard" data-fix="frente">
          <div className="faces">
            <div className="face front">
              <div className="cab"><span className="origem-p"><i className="pt" style={{ '--h': 212 } as React.CSSProperties} />Secretaria de Obras</span><span className="girar" aria-hidden="true"><Icone nome="rotate-cw" /></span></div>
              <div className="tags"><span className="tag" style={{ '--h': 28 } as React.CSSProperties}>Ofício</span><span className="num mono">311/2026</span><span className="chip neutro">Fazendo</span></div>
              <div className="assunto fit">Resposta sobre a reforma do prédio</div>
              <div className="desc">Reunir os documentos e confirmar o valor com a Contabilidade.</div>
              <div className="chips"><span className="pz n-amar"><Icone nome="calendar" />12/11 · faltam 5 d</span><span className="tempo mono"><Icone nome="clock" />Chegou há 4 d</span></div>
              <div className="prox-t"><input type="checkbox" tabIndex={-1} readOnly checked={false} aria-hidden="true" /><span className="prox-c"><small>Próxima tarefa</small><span className="t-txt">Pedir o parecer jurídico</span></span></div>
              <div className="prog"><div className="barra"><i style={{ width: '43%' }} /></div><b className="mono">3/7 · 43%</b></div>
            </div>
          </div>
        </article>
        <div className="previa-icones"><Icone nome="nav-inicio" /><Icone nome="nav-entradas" /><Icone nome="nav-demandas" /><Icone nome="nav-agenda" /></div>
      </div>
      <p className="data">Card fictício: reflete modo, destaque, fontes, tamanhos e fundo.</p>
    </div>
  );
}

function Faixa({ id, rotulo, unidade, valor, lim, aoMudar }: { id: string; rotulo: string; unidade: string; valor: number; lim: { min: number; max: number; passo: number }; aoMudar: (v: number) => void }) {
  return (
    <label className="rng" htmlFor={id}>{rotulo} <b className="mono" id={`${id}-v`}>{valor}{unidade}</b>
      <input id={id} type="range" min={lim.min} max={lim.max} step={lim.passo} value={valor} aria-valuetext={`${valor}${unidade}`} onChange={(e) => aoMudar(Number(e.target.value))} />
    </label>
  );
}

export function SecoesAparencia() {
  const { tema, modo, setModo, aparencia: a, mudarAparencia, restaurarAparencia, surpreenda, avisar } = useApp();
  const padrao = ePadrao(a);
  const restaurar = () => { restaurarAparencia(); avisar('Cores, fontes, tamanhos e fundo voltaram ao padrão.'); };
  const tamanhoPadrao = a.textoPct === TEXTO.padrao && a.icone === ICONE.padrao && a.card === CARD.padrao;
  return (
    <>
      <section className="painel cfg-topo" aria-labelledby="cfg-apar-t">
        <div className="cfg-cab">
          <h3 id="cfg-apar-t">Aparência</h3>
          <div className="acoes">
            <button type="button" className="btn mini" onClick={surpreenda}><Icone nome="sparkles" />Surpreenda-me</button>
            <button type="button" className="btn mini" disabled={padrao} onClick={restaurar}>Restaurar padrão</button>
          </div>
        </div>
        <div className="apar-grade">
        <PreviaCard dep={a} />
        <div className="apar-controles">
        <h4 className="cfg-sub" id="cfg-modo-t">Modo</h4>
        <div className="seg-p" role="group" aria-labelledby="cfg-modo-t">
          {MODOS.map((m) => <button key={m} type="button" data-modo={m} aria-pressed={modo === m} onClick={() => setModo(m)}>{ROTULO_MODO[m]}</button>)}
        </div>
        <p className="data" id="cfg-modo-d">{DESCRICAO_MODO[modo]}{modo === 'sistema' ? ` Agora: ${tema}.` : ''}</p>
        <h4 className="cfg-sub" id="cfg-dest-t">Cor de destaque</h4>
        <div className="pal" role="group" aria-labelledby="cfg-dest-t">
          <button type="button" className="sw padrao" data-paleta="padrao" aria-pressed={a.paleta === null} onClick={() => mudarAparencia({ paleta: null })}><i /><span>Padrão do Catalyst</span></button>
          {PALETAS.map((p, i) => {
            return (
              <button key={p.nome} type="button" className="sw" data-paleta={i} aria-pressed={a.paleta === i} aria-label={`Destaque ${p.nome}`} onClick={() => mudarAparencia({ paleta: i })}><i /><span>{p.nome}</span></button>
            );
          })}
        </div>
              </div>
        </div>
      </section>

      <section className="painel" aria-labelledby="cfg-fontes-t">
        <h3 id="cfg-fontes-t">Fontes</h3>
        <p className="data">Principal nos títulos, secundária nos subtítulos e textos, mono nos detalhes (números de processo, datas, contadores).</p>
        <div className="acoes" role="group" aria-label="Conjuntos de fontes">
          {CONJUNTOS.map((c, i) => <button key={c.nome} type="button" className="btn mini" data-conjunto={i} aria-pressed={a.titulo === c.titulo && a.texto === c.texto && a.mono === c.mono} onClick={() => mudarAparencia({ titulo: c.titulo, texto: c.texto, mono: c.mono })}>{c.nome}</button>)}
        </div>
        <PreviaFontes titulo={a.titulo} texto={a.texto} mono={a.mono} />
        <ListaFontes id="cfg-f-titulo" papel="titulo" lista={FONTES_TITULO} valor={a.titulo} aoMudar={(v) => mudarAparencia({ titulo: v })} />
        <ListaFontes id="cfg-f-texto" papel="texto" lista={FONTES_TEXTO} valor={a.texto} aoMudar={(v) => mudarAparencia({ texto: v })} />
        <ListaFontes id="cfg-f-mono" papel="mono" lista={FONTES_MONO} valor={a.mono} aoMudar={(v) => mudarAparencia({ mono: v })} />
      </section>

      <section className="painel" aria-labelledby="cfg-tam-t">
        <h3 id="cfg-tam-t">Tamanhos</h3>
        <Faixa id="cfg-t-texto" rotulo="Texto" unidade="%" valor={a.textoPct} lim={TEXTO} aoMudar={(v) => mudarAparencia({ textoPct: v })} />
        <Faixa id="cfg-t-icone" rotulo="Ícones" unidade=" px" valor={a.icone} lim={ICONE} aoMudar={(v) => mudarAparencia({ icone: v })} />
        <Faixa id="cfg-t-card" rotulo="Altura dos cards" unidade=" px" valor={a.card} lim={CARD} aoMudar={(v) => mudarAparencia({ card: v })} />
        <div className="acoes"><button type="button" className="btn mini" disabled={tamanhoPadrao} onClick={() => mudarAparencia({ textoPct: TEXTO.padrao, icone: ICONE.padrao, card: CARD.padrao })}>Restaurar tamanhos</button></div>
        <p className="data">O card de prévia, em Aparência, mostra o resultado. Os limites impedem texto ilegível, ícone minúsculo e card que não cabe. Botões e áreas de toque mantêm 44 px.</p>
      </section>

      <section className="painel" aria-labelledby="cfg-fundo-t">
        <h3 id="cfg-fundo-t">Fundo e movimento</h3>
        <div className="seg-p" role="group" aria-label="Tipo de fundo">
          <button type="button" data-fundo="padrao" aria-pressed={a.fundo === 'padrao'} onClick={() => mudarAparencia({ fundo: 'padrao' })}>Padrão do Catalyst</button>
          <button type="button" data-fundo="animado" aria-pressed={a.fundo === 'animado'} onClick={() => mudarAparencia({ fundo: 'animado' })}>Gradiente animado</button>
        </div>
        <p className="data">O gradiente usa a cor de destaque e se move devagar. Fica parado quando o aparelho pede para reduzir movimento ou quando você liga a opção abaixo. Só o fundo muda: cards, janelas e textos continuam como estão.</p>
        <div className="acoes"><button type="button" className="btn mini" data-movimento aria-pressed={a.movimento === 'reduzido'} onClick={() => mudarAparencia({ movimento: a.movimento === 'reduzido' ? 'sistema' : 'reduzido' })}>Reduzir movimento: {a.movimento === 'reduzido' ? 'ligado' : 'segue o aparelho'}</button></div>
      </section>
      <p className="data cfg-nota">Aparência, fontes, tamanhos e fundo ficam guardados só neste navegador e valem em todas as telas. Em outro aparelho, escolha de novo.</p>
    </>
  );
}
