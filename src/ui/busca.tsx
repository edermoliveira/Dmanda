'use client';
// Busca global (lupa do topo e Ctrl+K ou Cmd+K): procura em demandas, tarefas, entradas e eventos que o aplicativo já tem na memória, mais as demandas e entradas arquivadas
// (lidas do banco ao abrir a busca, uma vez por abertura). Nada é indexado nem guardado: a consulta vale só enquanto a busca está aberta.
// Ao escolher um resultado, abre o registro pela janela que já existe (consulta da demanda, leitura da entrada, evento), de qualquer tela e de qualquer período da Agenda.
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApp } from './contexto';
import { Icone } from './Icone';
import { buscar, LIMITE_RESULTADOS, palavrasDa, ROTULO_TIPO, type ResultadoBusca } from '@/lib/busca';

type Arquivo = 'lendo' | 'ok' | 'falhou';

export function Busca({ aoFechar }: { aoFechar: () => void }) {
  const { demandas, arquivadas, entradas, entradasArquivadas, eventos, carregando, carregandoEntradas, carregandoEventos, erroCarga, erroEntradas, erroEventos, carregarArquivadas, carregarEntradasArquivadas, abrirJanela } = useApp();
  const [consulta, setConsulta] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [arquivo, setArquivo] = useState<Arquivo>('lendo');
  const ref = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const fechar = useRef(aoFechar);
  useEffect(() => { fechar.current = aoFechar; });
  const id = useId();

  // Lê os arquivados ao abrir (podem ter mudado em outro aparelho). Os resultados normais já aparecem enquanto isso.
  useEffect(() => {
    let vivo = true;
    void Promise.all([carregarArquivadas(), carregarEntradasArquivadas()]).then(([a, e]) => { if (vivo) setArquivo(a && e ? 'ok' : 'falhou'); });
    return () => { vivo = false; };
  }, [carregarArquivadas, carregarEntradasArquivadas]);

  // Esc fecha, o Tab não sai da busca e, ao fechar, o foco volta a quem abriu (a lupa ou o ponto onde a pessoa estava).
  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null;
    campo.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); fechar.current(); return; }
      if (e.key === 'Tab' && ref.current) {
        const itens = Array.from(ref.current.querySelectorAll<HTMLElement>('input, button:not([disabled]):not([tabindex="-1"])')).filter((x) => x.getClientRects().length);
        if (!itens.length) return;
        const atual = itens.indexOf(document.activeElement as HTMLElement);
        const alvo = e.shiftKey ? (atual <= 0 ? itens[itens.length - 1] : null) : (atual === -1 || atual === itens.length - 1 ? itens[0] : null);
        if (alvo) { e.preventDefault(); alvo.focus(); }
      }
    };
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('keydown', tecla, true); origem?.focus?.(); };
  }, []);

  // a digitação não espera a busca: o resultado acompanha a consulta um instante depois (conta quando há muitas anotações)
  const adiada = useDeferredValue(consulta);
  const { resultados, total } = useMemo(() => buscar(adiada, { demandas, arquivadas: arquivadas ?? [], entradas, entradasArquivadas: entradasArquivadas ?? [], eventos }), [adiada, demandas, arquivadas, entradas, entradasArquivadas, eventos]);
  const buscando = palavrasDa(adiada).length > 0;
  const posicao = Math.min(ativo, Math.max(0, resultados.length - 1));
  useEffect(() => { document.getElementById(`${id}-r${posicao}`)?.scrollIntoView({ block: 'nearest' }); }, [id, posicao]);

  // o que não pôde ser lido: a busca diz isso em vez de parecer que não há resultado
  const falhas: string[] = [];
  if (erroCarga) falhas.push('as demandas');
  if (erroEntradas) falhas.push('as entradas');
  if (erroEventos) falhas.push('os eventos');
  if (arquivo === 'falhou') falhas.push('os arquivados');
  const lendo = carregando || carregandoEntradas || carregandoEventos;

  const escolher = (r: ResultadoBusca) => { aoFechar(); abrirJanela(r.destino); };
  const teclado = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (resultados.length) setAtivo((posicao + 1) % resultados.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (resultados.length) setAtivo((posicao - 1 + resultados.length) % resultados.length); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = resultados[posicao]; if (r) escolher(r); }
  };

  return (
    <div className="busca-ov aberto" onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div ref={ref} className="busca-box glass" role="dialog" aria-modal="true" aria-label="Busca">
        <div className="busca-campo">
          <input ref={campo} id={`${id}-q`} type="search" role="combobox" aria-expanded={resultados.length > 0} aria-controls={`${id}-lista`} aria-activedescendant={resultados.length ? `${id}-r${posicao}` : undefined} aria-autocomplete="list" aria-label="Buscar em demandas, tarefas, entradas e eventos"
            placeholder="Buscar demanda, tarefa, entrada ou evento" autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" value={consulta} onChange={(e) => { setConsulta(e.target.value); setAtivo(0); }} onKeyDown={teclado} />
          <button type="button" className="icbtn-s" aria-label="Fechar a busca" onClick={aoFechar}><Icone nome="x" /></button>
        </div>
        {falhas.length ? <p className="busca-aviso erro" role="alert">Não foi possível ler {falhas.join(', ')}. O resultado abaixo pode estar incompleto. Feche a busca e tente de novo quando a conexão voltar.</p> : null}
        {!buscando ? (
          <p className="busca-aviso" role="status">Digite para buscar por assunto, número, texto, tarefa, tag ou data. Arquivadas e entradas convertidas também aparecem, com o estado ao lado.</p>
        ) : (
          <>
            <div id={`${id}-lista`} role="listbox" aria-label="Resultados">
              {resultados.map((r, i) => (
                <button key={r.chave} id={`${id}-r${i}`} type="button" role="option" tabIndex={-1} aria-selected={i === posicao} className="res" data-chave={r.chave} data-tipo={r.tipo} data-ativo={i === posicao ? 'sim' : undefined}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(r)}>
                  <span className="res-tipo">{ROTULO_TIPO[r.tipo]}</span>
                  <span className="res-corpo"><span className="res-t">{r.titulo}</span>{r.detalhe ? <span className="res-d">{r.detalhe}</span> : null}</span>
                  {r.estado ? <span className="res-estado">{r.estado}</span> : null}
                </button>
              ))}
            </div>
            {resultados.length ? (
              <p className="busca-aviso" role="status">{total > LIMITE_RESULTADOS ? `Mostrando ${LIMITE_RESULTADOS} de ${total} resultados. Digite mais para refinar.` : `${total} ${total === 1 ? 'resultado' : 'resultados'}.`}{arquivo === 'lendo' ? ' Procurando também nos arquivados...' : ''}</p>
            ) : lendo || arquivo === 'lendo' ? (
              <p className="busca-aviso" role="status">Procurando...</p>
            ) : falhas.length ? (
              <p className="busca-aviso" role="status">Nada encontrado no que foi possível ler.</p>
            ) : (
              <p className="busca-aviso" role="status">Nenhum resultado para “{adiada.trim()}”. Tente outro trecho, o número ou parte do assunto.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
