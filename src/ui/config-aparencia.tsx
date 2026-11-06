'use client';
// Configurações > Aparência, Fontes, Tamanhos e Fundo (decisões 11 e 35, protótipo Catalyst). Tudo vale na hora, é guardado só neste navegador
// (lib/aparencia.ts) e nunca toca no banco. Restaurar padrão volta cores, fontes, tamanhos, fundo e movimento; o modo e os dias indisponíveis não mudam.
import { useApp } from './contexto';
import { Icone } from './Icone';
import {
  CARD, CONJUNTOS, ePadrao, FONTES_MONO, FONTES_TEXTO, FONTES_TITULO, ICONE, MODOS, PALETAS, ROTULO_MODO, TEXTO, type Fonte, type Modo,
} from '@/lib/aparencia';

const AMOSTRA = 'Resposta ao Ofício 311/2026, ação e atenção';
const DESCRICAO_MODO: Record<Modo, string> = {
  claro: 'Sempre claro.', escuro: 'Sempre escuro.', sistema: 'Segue o modo claro ou escuro do aparelho e muda junto com ele.',
};

function Seletor({ id, rotulo, lista, valor, aoMudar }: { id: string; rotulo: string; lista: readonly Fonte[]; valor: string; aoMudar: (v: string) => void }) {
  const css = (lista.find((x) => x.id === valor) ?? lista[0]).css;
  return (
    <div className="fld">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)}>{lista.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
      <span className="amostra" style={{ fontFamily: css }}>{AMOSTRA}</span>
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
      </section>

      <section className="painel" aria-labelledby="cfg-fontes-t">
        <h3 id="cfg-fontes-t">Fontes</h3>
        <p className="data">Principal nos títulos, secundária nos subtítulos e textos, mono nos detalhes (números de processo, datas, contadores).</p>
        <div className="acoes" role="group" aria-label="Conjuntos de fontes">
          {CONJUNTOS.map((c, i) => <button key={c.nome} type="button" className="btn mini" data-conjunto={i} aria-pressed={a.titulo === c.titulo && a.texto === c.texto && a.mono === c.mono} onClick={() => mudarAparencia({ titulo: c.titulo, texto: c.texto, mono: c.mono })}>{c.nome}</button>)}
        </div>
        <Seletor id="cfg-f-titulo" rotulo="Principal (títulos)" lista={FONTES_TITULO} valor={a.titulo} aoMudar={(v) => mudarAparencia({ titulo: v })} />
        <Seletor id="cfg-f-texto" rotulo="Secundária (subtítulos e textos)" lista={FONTES_TEXTO} valor={a.texto} aoMudar={(v) => mudarAparencia({ texto: v })} />
        <Seletor id="cfg-f-mono" rotulo="Mono (detalhes)" lista={FONTES_MONO} valor={a.mono} aoMudar={(v) => mudarAparencia({ mono: v })} />
      </section>

      <section className="painel" aria-labelledby="cfg-tam-t">
        <h3 id="cfg-tam-t">Tamanhos</h3>
        <Faixa id="cfg-t-texto" rotulo="Texto" unidade="%" valor={a.textoPct} lim={TEXTO} aoMudar={(v) => mudarAparencia({ textoPct: v })} />
        <Faixa id="cfg-t-icone" rotulo="Ícones" unidade=" px" valor={a.icone} lim={ICONE} aoMudar={(v) => mudarAparencia({ icone: v })} />
        <Faixa id="cfg-t-card" rotulo="Altura dos cards" unidade=" px" valor={a.card} lim={CARD} aoMudar={(v) => mudarAparencia({ card: v })} />
        <div className="cfg-previa" aria-label="Prévia dos tamanhos" role="group">
          <b>Prévia</b>
          <p>Ofício 311/2026: resposta à Secretaria de Obras.</p>
          <p className="data"><span className="mono">Prazo 12/11</span> · <Icone nome="calendar" /> Aguardando retorno</p>
          <button type="button" className="btn mini" tabIndex={-1} aria-hidden="true">Botão</button>
        </div>
        <div className="acoes"><button type="button" className="btn mini" disabled={tamanhoPadrao} onClick={() => mudarAparencia({ textoPct: TEXTO.padrao, icone: ICONE.padrao, card: CARD.padrao })}>Restaurar tamanhos</button></div>
        <p className="data">Os limites impedem texto ilegível, ícone minúsculo e card que não cabe. Botões e áreas de toque mantêm 44 px.</p>
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
