'use client';
// Avisos do sistema na tela: a barra global, o aviso da tela e o painel do sininho. Todos leem a MESMA lista (avisosSistema, em lib/avisos-sistema.ts): um problema tem um id só,
// aparece nos dois lugares e some dos dois quando a leitura volta. Marcar como lido, no sininho, só tira a contagem: a barra e o painel continuam enquanto a causa existir.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './contexto';
import { Icone } from './Icone';
import type { AvisoSistema } from '@/lib/avisos-sistema';
import type { AvisoEvento } from '@/lib/eventos';

/** O texto de um aviso de evento de hoje (o mesmo no topo da tela e no painel do sininho). */
export const textoAvisoEvento = (a: AvisoEvento) => `${a.tipo === 'no-dia' ? 'é hoje' : a.minutos === 0 ? 'começa agora' : `começa em ${a.minutos} min`}${a.tipo === 'em-breve' ? ` (${a.evento.inicio})` : ''}`;

/** Um problema, no formato de faixa: o que está errado, o que fazer e a ação direta. Enquanto a leitura roda, o botão avisa e não aceita outro clique. */
function FaixaAviso({ a }: { a: AvisoSistema }) {
  const { executarAcaoAviso } = useApp();
  const [lendo, setLendo] = useState(false);
  const executar = async () => { if (lendo) return; setLendo(true); try { await executarAcaoAviso(a.acao); } finally { setLendo(false); } };
  return (
    <div className="erro-carga" role="alert" data-aviso={a.id} data-escopo={a.escopo}>
      <b>{a.titulo}</b><span>{a.orientacao}</span>
      <button type="button" className="btn mini" disabled={lendo} onClick={() => void executar()}>{lendo ? (a.acao.conferir ? 'Conferindo...' : 'Carregando...') : a.acao.rotulo}</button>
    </div>
  );
}

/** Os problemas graves, no topo de todas as telas: afetam várias telas ou operações e se resolvem dentro do Dmanda. */
export function AvisosGlobais() {
  const { avisosSistema } = useApp();
  return <>{avisosSistema.filter((a) => a.escopo === 'global').map((a) => <FaixaAviso key={a.id} a={a} />)}</>;
}

/** Os problemas localizados de uma tela (por exemplo, os eventos na Agenda). */
export function AvisosDaTela({ tela }: { tela: 'agenda' | 'entradas' }) {
  const { avisosSistema } = useApp();
  return <>{avisosSistema.filter((a) => a.escopo === 'tela' && a.tela === tela).map((a) => <FaixaAviso key={a.id} a={a} />)}</>;
}

/**
 * O painel do sininho: os problemas de agora (com a ação direta e "Marcar como lido") e os avisos de hoje da Agenda. Janela sem bloqueio: Esc fecha e devolve o foco ao sininho,
 * clicar fora fecha, e o Tab circula entre os botões do painel.
 */
export function PainelAvisos({ ponto, fechar }: { ponto: { x: number; y: number }; fechar: () => void }) {
  const { avisosSistema, marcarAvisoLido, marcarAvisosLidos, executarAcaoAviso, avisosEventos, abrirJanela, dispensarAviso } = useApp();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const gatilho = useRef<Element | null>(null);

  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    gatilho.current ??= document.activeElement;   // só na primeira vez: em desenvolvimento o React roda o efeito duas vezes, e na segunda o foco já está dentro do painel
    const app = document.querySelector('.app')!.getBoundingClientRect();
    const w = m.offsetWidth;
    m.style.left = `${Math.min(Math.max(8, ponto.x - w), app.width - w - 8)}px`;
    m.style.top = `${ponto.y + 6}px`;
    (m.querySelector<HTMLElement>('button:not(:disabled)') ?? m).focus();
  }, [ponto]);

  useEffect(() => {
    const fora = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.('.avisos-painel') && !t.closest?.('.sino')) fechar(); };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); const g = gatilho.current as HTMLElement | null; fechar(); setTimeout(() => g?.focus?.(), 0); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const alvos = [...ref.current.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      if (!alvos.length) return;
      const primeiro = alvos[0], ultimo = alvos[alvos.length - 1], ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || ativo === ref.current)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('click', fora, true); document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('click', fora, true); document.removeEventListener('keydown', tecla, true); };
  }, [fechar]);

  const naoLidos = avisosSistema.filter((a) => !a.lido).length;
  return (
    <div ref={ref} className="avisos-painel" role="dialog" aria-label="Avisos" tabIndex={-1}>
      <div className="mv-t">Avisos</div>
      {avisosSistema.length ? (
        <section className="avisos-grupo" aria-label="Problemas para resolver">
          {avisosSistema.map((a) => (
            <article key={a.id} className="avisos-item" data-aviso={a.id} data-escopo={a.escopo} data-lido={a.lido ? 'sim' : undefined}>
              <div className="avisos-cab"><Icone nome="alert" /><b>{a.titulo}</b>{a.lido ? null : <span className="chip neutro">Novo</span>}</div>
              <span>{a.orientacao}</span>
              <div className="avisos-acoes">
                <button type="button" className="btn mini" data-acao="recarregar" onClick={() => void executarAcaoAviso(a.acao)}>{a.acao.rotulo}</button>
                {a.lido ? <small className="data">Lido. O problema continua até carregar.</small> : <button type="button" className="btn mini" data-acao="lido" onClick={() => marcarAvisoLido(a.id)}>Marcar como lido</button>}
              </div>
            </article>
          ))}
        </section>
      ) : null}
      {avisosEventos.length ? (
        <section className="avisos-grupo" aria-label="Hoje na Agenda">
          {avisosEventos.map((a) => (
            <article key={a.evento.id} className="avisos-item avisos-evento" data-evento={a.evento.id}>
              <div className="avisos-cab"><Icone nome="bell" /><b>{a.evento.titulo}</b></div>
              <span>{textoAvisoEvento(a)}</span>
              <div className="avisos-acoes">
                <button type="button" className="btn mini" onClick={() => { fechar(); abrirJanela({ t: 'evento', id: a.evento.id }); }}>Abrir</button>
                <button type="button" className="btn mini" onClick={() => dispensarAviso(a.evento)}>Dispensar</button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
      {!avisosSistema.length && !avisosEventos.length ? <p className="data avisos-vazio">Nenhum aviso agora.</p> : null}
      <div className="avisos-acoes avisos-rodape">
        <button type="button" className="btn mini" onClick={() => { fechar(); router.push('/agenda'); }}>Abrir a Agenda</button>
        {naoLidos > 1 ? <button type="button" className="btn mini" onClick={marcarAvisosLidos}>Marcar tudo como lido</button> : null}
      </div>
    </div>
  );
}
