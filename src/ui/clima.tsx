'use client';
// Widget de Clima do Início (Open-Meteo) e a janela para escolher a cidade. As regras (endereços fixos, validação, cache, textos) estão em lib/clima.ts (puras e testadas);
// aqui ficam o ciclo de consulta, o armazenamento no aparelho e a interface.
// - A cidade é a preferência do Perfil (`prefsPerfil.cidade`, Taquara/RS por padrão): uma só fonte, lida e gravada no contexto.
// - A previsão guardada (dmanda:clima) leva a própria cidade junto: o clima de uma cidade nunca aparece sob o nome de outra.
// - Consulta só com a aba visível: ao abrir, ao voltar para a aba quando o dado ficou velho (15 min) ou o dia virou, e quando a conexão volta; nunca por cima de uma consulta em andamento. Sem consulta por desenho da tela e sem repetição em aba escondida.
// - Falha do serviço afeta só este widget. Com dado guardado, ele continua na tela marcado como desatualizado, com a hora da última atualização.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useApp } from './contexto';
import { Icone } from './Icone';
import { Janela } from './janela-base';
import {
  ATRIBUICAO, CIDADE_PADRAO, DEBOUNCE_MS, ESPERA_APOS_FALHA_MS, FalhaClima, TEXTO_FALHA, TTL_FRESCO_MS, cacheGuardado, consultarCidades, consultarPrevisao, criarUltimaConsulta,
  descricaoDoTempo, estadoDoCache, graus, horaDeBrasilia, horaDoMomento, iconeDoTempo, localDaCidade, msAteVirarODia, resumoDoClima, termoDeBusca,
  type Cidade, type EntradaCache, type TipoFalha,
} from '@/lib/clima';

const CHAVE_CACHE = 'dmanda:clima';
const lerCache = (): EntradaCache | null => { try { return cacheGuardado(JSON.parse(localStorage.getItem(CHAVE_CACHE) ?? 'null')); } catch { return null; } };
const gravarCache = (e: EntradaCache) => { try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(e)); } catch { /* sem armazenamento: vale só nesta visita */ } };
type Falha = Exclude<TipoFalha, 'cancelado'>;

function useClima(cidade: Cidade) {
  const [cache, setCache] = useState<EntradaCache | null>(null);
  const [lido, setLido] = useState(false);       // o servidor e o primeiro desenho do cliente são iguais (sem armazenamento): "Consultando"
  const [carregando, setCarregando] = useState(true);
  const [falha, setFalha] = useState<Falha | null>(null);
  const ultima = useRef(criarUltimaConsulta());
  const ultimaFalha = useRef(0);
  const atual = useRef(cidade);
  useEffect(() => { atual.current = cidade; });

  const buscar = useCallback(async () => {
    const c = atual.current;
    const { id, sinal } = ultima.current.iniciar();
    setCarregando(true);
    try {
      const previsao = await consultarPrevisao(c, { sinal });
      if (!ultima.current.vale(id)) return;   // chegou depois de uma consulta mais nova (ou de outra cidade): descarta
      const nova: EntradaCache = { cidade: c, previsao, buscadoEm: Date.now() };
      gravarCache(nova); setCache(nova); setFalha(null);
    } catch (e) {
      if (!ultima.current.vale(id)) return;
      const tipo = e instanceof FalhaClima ? e.tipo : 'invalido';
      if (tipo === 'cancelado') return;
      ultimaFalha.current = Date.now(); setFalha(tipo);
    } finally {
      ultima.current.concluir(id);
      if (ultima.current.vale(id)) setCarregando(false);
    }
  }, []);

  // cidade escolhida (ou primeira abertura): usa o guardado se é desta cidade e está fresco; senão consulta
  useEffect(() => {
    const guardado = lerCache();
    const est = estadoDoCache(guardado, atual.current, Date.now());
    setCache(est === 'fresco' || est === 'velho' ? guardado : null);
    setFalha(null); setLido(true);
    // a consulta sai no turno seguinte: o React em desenvolvimento monta, desmonta e monta de novo, e trocas rápidas de cidade não deixam consultas à toa
    let adiar: ReturnType<typeof setTimeout> | null = null;
    if (est === 'fresco') setCarregando(false);
    else if (document.visibilityState === 'visible') { setCarregando(true); adiar = setTimeout(() => void buscar(), 0); }
    else setCarregando(false);
    const consulta = ultima.current;
    return () => { if (adiar) clearTimeout(adiar); consulta.cancelar(); };
  }, [cidade.id, buscar]);   // pelo identificador: um objeto novo da mesma cidade não refaz a consulta

  // renovação: no fim dos 15 minutos do dado atual, e ao voltar para a aba ou para a rede quando ele ficou velho. Aba escondida não consulta.
  useEffect(() => {
    const precisa = () => estadoDoCache(cache, atual.current, Date.now()) !== 'fresco';
    const tentar = (forcar: boolean) => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || !precisa()) return;
      if (ultima.current.emAndamento()) return;   // voltar para a aba ou para a rede não reinicia uma consulta que já está a caminho
      if (!forcar && Date.now() - ultimaFalha.current < ESPERA_APOS_FALHA_MS) return;
      void buscar();
    };
    // +1 s: no instante exato dos 15 minutos o dado ainda conta como fresco, e a consulta não sairia
    const restante = cache ? Math.max(1000, cache.buscadoEm + TTL_FRESCO_MS - Date.now() + 1000) : null;
    const t = restante !== null && !falha ? setTimeout(() => tentar(false), restante) : null;
    const voltou = () => tentar(false);
    const rede = () => tentar(true);
    document.addEventListener('visibilitychange', voltou);
    addEventListener('online', rede);
    return () => { if (t) clearTimeout(t); document.removeEventListener('visibilitychange', voltou); removeEventListener('online', rede); };
  }, [cache, falha, buscar]);

  // virada do dia em Brasília, com ou sem falha: a "previsão de hoje" guardada é de ontem, então sai da tela e uma consulta nova entra (+1 s: na meia-noite exata o dia ainda é o anterior)
  const [dia, setDia] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setCache((c) => (estadoDoCache(c, atual.current, Date.now()) === 'expirado' ? null : c));
      if (document.visibilityState === 'visible' && navigator.onLine && !ultima.current.emAndamento()) void buscar();
      setDia((d) => d + 1);
    }, msAteVirarODia(Date.now()) + 1000);
    return () => clearTimeout(t);
  }, [dia, buscar]);

  return { dados: cache && cache.cidade.id === cidade.id ? cache : null, lido, carregando, falha, tentarDeNovo: () => void buscar() };
}

export function WidgetClima() {
  const { prefsPerfil } = useApp();
  const cidade = prefsPerfil.cidade;
  const { dados, lido, carregando, falha, tentarDeNovo } = useClima(cidade);
  const [trocando, setTrocando] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const idTitulo = useId();
  const p = dados?.previsao ?? null;
  const velho = !!dados && (falha !== null);

  return (
    <section className="wg wg-m wg-clima" aria-labelledby={idTitulo} data-clima={!lido || (carregando && !p) ? 'carregando' : p ? (velho ? 'desatualizado' : 'ok') : 'sem-dados'} data-cidade-id={cidade.id}>
      <div className="wg-cl-topo">
        <button ref={botao} type="button" className="wg-cid wg-cid-b" id={idTitulo} aria-haspopup="dialog" onClick={() => setTrocando(true)} title="Trocar a cidade do clima">
          <span className="wg-cid-n">{cidade.nome}</span><span className="wg-cid-l">{localDaCidade(cidade)}</span><Icone nome="chevron-down" />
        </button>
        {dados && carregando ? <span className="data wg-atu">Atualizando…</span> : null}
      </div>

      {p ? (
        <>
          <p className="sr-only" data-clima-resumo>{resumoDoClima(dados!.cidade, p)}{velho ? ' Informação desatualizada.' : ''}</p>
          <div className="wg-cl-corpo" aria-hidden="true">
            <div className="wg-cl-agora">
              <span className="wg-cl-rot">Agora</span>
              <b className="wg-temp" data-clima-temp>{graus(p.atual.temperatura)}</b>
              <span className="wg-ceu"><Icone nome={iconeDoTempo(p.atual.codigo, p.atual.diurno)} />{descricaoDoTempo(p.atual.codigo)}</span>
            </div>
            <div className="wg-cl-hoje">
              <span className="wg-cl-rot">Previsão de hoje</span>
              <span className="wg-mm mono" data-clima-mm>máx. {graus(p.hoje.max)} · mín. {graus(p.hoje.min)}</span>
              <span className="wg-cl-cond">{descricaoDoTempo(p.hoje.codigo)}</span>
            </div>
          </div>
          <p className="data wg-cl-hora mono">Observado às {horaDoMomento(p.atual.observadoEm)} · consultado às {horaDeBrasilia(dados!.buscadoEm)} (Brasília)</p>
        </>
      ) : (
        <p className="data wg-cl-vazio" role="status">{!lido || carregando ? 'Consultando o clima…' : 'Clima indisponível por enquanto.'}</p>
      )}

      {falha ? (
        <div className="wg-cl-falha" role="status">
          <span>{velho ? `Desatualizado: última atualização às ${horaDeBrasilia(dados!.buscadoEm)} (Brasília). ` : ''}{TEXTO_FALHA[falha]}</span>
          <button type="button" className="btn mini" onClick={tentarDeNovo} disabled={carregando}>Tentar de novo</button>
        </div>
      ) : null}

      <a className="data wg-cl-cred" href={ATRIBUICAO.url} target="_blank" rel="noopener noreferrer">{ATRIBUICAO.texto}</a>
      {trocando ? <JanelaCidade aoFechar={() => { setTrocando(false); }} /> : null}
    </section>
  );
}

// ---------- escolher a cidade ----------
type Busca = { situacao: 'ocioso' | 'buscando' | 'ok' | 'vazio' | 'erro'; lista: Cidade[]; falha: Falha | null };
export function JanelaCidade({ aoFechar }: { aoFechar: () => void }) {
  const { prefsPerfil, mudarPrefsPerfil, avisar } = useApp();
  const atual = prefsPerfil.cidade;
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState<Busca>({ situacao: 'ocioso', lista: [], falha: null });
  const ultima = useRef(criarUltimaConsulta());
  const lista = useRef<HTMLUListElement>(null);

  // pesquisa com espera (debounce): cada letra nova cancela a consulta anterior e só a resposta da mais recente entra
  useEffect(() => {
    const consulta = ultima.current;
    consulta.cancelar();
    const t = termoDeBusca(termo);
    /* eslint-disable react-hooks/set-state-in-effect -- reinicia o estado da pesquisa quando o texto muda */
    if (t === null) { setBusca({ situacao: 'ocioso', lista: [], falha: null }); return; }
    setBusca((b) => ({ ...b, situacao: 'buscando', falha: null }));
    /* eslint-enable react-hooks/set-state-in-effect */
    const espera = setTimeout(async () => {
      const { id, sinal } = consulta.iniciar();
      try {
        const achadas = await consultarCidades(t, { sinal });
        if (!consulta.vale(id)) return;
        setBusca({ situacao: achadas.length ? 'ok' : 'vazio', lista: achadas, falha: null });
      } catch (e) {
        if (!consulta.vale(id)) return;
        const tipo = e instanceof FalhaClima ? e.tipo : 'invalido';
        if (tipo !== 'cancelado') setBusca({ situacao: 'erro', lista: [], falha: tipo });
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(espera); consulta.cancelar(); };
  }, [termo]);

  const escolher = (c: Cidade) => { mudarPrefsPerfil({ cidade: c }); avisar(`Clima de ${c.nome} (${localDaCidade(c)})`); aoFechar(); };
  const mover = (e: React.KeyboardEvent, de: number) => {
    const itens = Array.from(lista.current?.querySelectorAll<HTMLElement>('button.cid-op') ?? []);
    if (e.key === 'ArrowDown') { e.preventDefault(); itens[Math.min(itens.length - 1, de + 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (de <= 0) (document.getElementById('cid-busca') as HTMLElement | null)?.focus(); else itens[de - 1]?.focus(); }
  };
  const padrao = atual.id === CIDADE_PADRAO.id;

  return (
    <Janela titulo="Cidade do clima" aoFechar={aoFechar} sujo={false}
      rodape={<><button type="button" className="btn" disabled={padrao} onClick={() => escolher(CIDADE_PADRAO)}>Voltar para {CIDADE_PADRAO.nome}</button><span className="esp" /><button type="button" className="btn pri" onClick={aoFechar}>Fechar</button></>}>
      <p className="data">Cidade atual: <b>{atual.nome}</b>, {localDaCidade(atual)}. Digite o nome para trocar; o estado e o país ajudam a distinguir cidades de mesmo nome.</p>
      <div className="fld">
        <label htmlFor="cid-busca">Buscar cidade</label>
        <input id="cid-busca" type="search" value={termo} maxLength={80} autoComplete="off" placeholder="Ex.: Porto Alegre" onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); lista.current?.querySelector<HTMLElement>('button.cid-op')?.focus(); } }} aria-describedby="cid-estado" />
      </div>
      <p id="cid-estado" className="data" role="status" data-busca={busca.situacao}>
        {busca.situacao === 'buscando' ? 'Buscando…' : busca.situacao === 'vazio' ? 'Nenhuma cidade encontrada com esse nome.' : busca.situacao === 'erro' && busca.falha ? `${TEXTO_FALHA[busca.falha]} Tente de novo em instantes.` : busca.situacao === 'ok' ? `${busca.lista.length} ${busca.lista.length === 1 ? 'cidade encontrada' : 'cidades encontradas'}.` : termo.trim().length > 0 && termoDeBusca(termo) === null ? 'Use ao menos 2 letras.' : ''}
      </p>
      {busca.lista.length ? (
        <ul ref={lista} className="cid-lista" aria-label="Cidades encontradas">
          {busca.lista.map((c, i) => (
            <li key={c.id}><button type="button" className="cid-op" data-cidade-id={c.id} aria-current={c.id === atual.id ? 'true' : undefined} onClick={() => escolher(c)} onKeyDown={(e) => mover(e, i)}>
              <b>{c.nome}</b><span>{localDaCidade(c) || 'Local sem região informada'}</span>
            </button></li>
          ))}
        </ul>
      ) : null}
      <p className="data">As buscas e o clima usam o serviço <a href={ATRIBUICAO.url} target="_blank" rel="noopener noreferrer">{ATRIBUICAO.texto}</a>. Só o nome digitado e as coordenadas da cidade são enviados.</p>
    </Janela>
  );
}
