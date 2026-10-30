'use client';
// Entradas (decisões 37 a 39): anotações em post-its. A página (grade, busca, tags, fixar, virar demanda), a janela de uma anotação com salvamento automático
// no Supabase (e rascunho neste aparelho enquanto não chega lá) e a lista do Arquivo. As regras puras estão em src/lib/entradas.ts; as que protegem os dados, na migração 10.
//
// Salvamento da janela: o que se digita vai para o rascunho deste aparelho em meio segundo e para o banco 1,2 segundo depois da última alteração. O estado mostrado é sempre
// verdadeiro: "Salvo no Dmanda" só quando o banco confirmou; do contrário, "Só neste aparelho". Uma falha nunca apaga o texto. A anotação nova nasce com um identificador gerado aqui e
// guardado no rascunho ANTES da primeira gravação, então clique repetido, resposta perdida ou recarga nunca criam duas. A janela só envia os campos que a pessoa mexeu; se outro aparelho
// salvou antes, só pergunta quando os dois mexeram no mesmo campo (src/lib/entradas.ts, camposEmConflito).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Icone } from './Icone';
import { Janela } from './janela-base';
import { novoUuid } from './campos';
import * as srvE from '@/servidor/entradas';
import { useApp, useOnline } from './contexto';
import {
  aparar, camposEmConflito, contarTags, COR_AUTOMATICA, diferencas, estadoDe, filtrarEntradas, LIMITE_TEXTO, LIMITE_TITULO, ordenarEntradas, QTD_CORES, resumoDe, tagsDe, temTitulo, vazia,
  type CamposEntrada, type Entrada,
} from '@/lib/entradas';
import { plural, titulo as tituloDemanda } from '@/lib/demandas';

const CAMPOS: (keyof CamposEntrada)[] = ['titulo', 'texto', 'cor', 'fixada'];
const camposDe = (e: Entrada): CamposEntrada => ({ titulo: e.titulo, texto: e.texto, cor: e.cor, fixada: e.fixada });
const resumoOuVazio = (e: Entrada) => resumoDe(e) || '(só tags)';

/** Ajuste ao espaço do post-it: nunca há barra de rolagem. O texto ocupa as linhas que couberem; se sobra pouco, as tags saem antes do texto. */
export function ajustarNotas() {
  document.querySelectorAll<HTMLElement>('.app .postit').forEach((p) => {
    const tags = p.querySelector<HTMLElement>('.p-tags'), x = p.querySelector<HTMLElement>('.p-txt.fit');
    tags?.classList.remove('oculto');
    if (!x) return;
    x.style.webkitLineClamp = 'none';
    const cs = getComputedStyle(x), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    if (tags && tags.textContent?.trim() && x.clientHeight < lh * 3.2) { tags.classList.add('oculto'); }
    x.style.webkitLineClamp = String(Math.max(1, Math.floor((x.clientHeight + 1) / lh)));
  });
}
function useAjustarNotas(dep: unknown) {
  useLayoutEffect(() => { ajustarNotas(); });
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const f = () => { clearTimeout(t); t = setTimeout(ajustarNotas, 120); };
    window.addEventListener('resize', f);
    const quadro = document.querySelector('.frame');
    const ro = quadro && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(f) : null;
    if (quadro) ro?.observe(quadro);
    void document.fonts?.ready.then(ajustarNotas);
    return () => { window.removeEventListener('resize', f); ro?.disconnect(); clearTimeout(t); };
  }, [dep]);
}

/** Virar demanda a partir da lista ou da janela. Não passa por cima de outro cadastro em andamento nem de alterações que ainda estão só neste aparelho. */
export function useVirarDemanda() {
  const { rascunhos, abrirJanela, avisar } = useApp();
  // jaSalva: quem chama é a própria janela da entrada, que acabou de salvar tudo (o estado de rascunhos deste render ainda é o de antes e não vale para a própria entrada)
  return useCallback((entradaId: string, { jaSalva = false }: { jaSalva?: boolean } = {}) => {
    const r = rascunhos['nova'];
    if (r && r.entradaId !== entradaId) { avisar('Há um cadastro de demanda em andamento. Abra Nova demanda para terminá-lo ou cancelá-lo antes de transformar esta entrada.', true); return; }
    if (!jaSalva && rascunhos[`e:${entradaId}`]) { avisar('Esta entrada tem alterações só neste aparelho. Abra-a para salvá-las antes de virar demanda.', true); return; }
    abrirJanela({ t: 'nova', entradaId });
  }, [rascunhos, abrirJanela, avisar]);
}

// ---------- a página ----------
export function PaginaEntradas() {
  const { entradas, carregandoEntradas, erroEntradas, recarregarEntradas, abrirJanela, fixarEntrada, rascunhos, setAbaArquivo } = useApp();
  const router = useRouter();
  const virar = useVirarDemanda();
  const [texto, setTexto] = useState('');
  const [tag, setTag] = useState('');
  const tags = useMemo(() => contarTags(entradas), [entradas]);
  const tagAtiva = tags.some(([t]) => t === tag) ? tag : ''; // a tag some da lista quando a última entrada com ela sai (arquivada ou convertida): volta para "Todas"
  const lista = useMemo(() => ordenarEntradas(filtrarEntradas(entradas, { texto, tag: tagAtiva })), [entradas, texto, tagAtiva]);
  useAjustarNotas(`${lista.map((e) => e.id + e.versao).join()}`);
  const semAlteracaoSalva = rascunhos['e:nova'];

  return (
    <>
      <div className="pagehead"><h1>Entradas</h1><p>{plural(entradas.length, 'entrada')}. Anotações rápidas que podem virar demandas.</p></div>
      <div className="toolbar">
        <label className="filtro"><Icone nome="busca" /><input id="eq" placeholder="Buscar nas entradas" value={texto} aria-label="Buscar nas entradas" autoComplete="off" onChange={(e) => setTexto(e.target.value)} /></label>
        <button className="btn gl" aria-label="Ver entradas arquivadas" onClick={() => { setAbaArquivo('entradas'); router.push('/arquivo'); }}><Icone nome="archive" /><span className="tx">Arquivadas</span></button>
        <button className="btn escuro" aria-label="Nova entrada" onClick={() => abrirJanela({ t: 'entrada' })}><Icone nome="plus" /><span className="tx">Nova entrada</span></button>
      </div>
      {erroEntradas ? <div className="erro-carga" role="alert"><b>Não foi possível carregar as entradas.</b><span>{erroEntradas}</span><button className="btn mini" onClick={() => void recarregarEntradas()}>Tentar de novo</button></div> : null}
      {semAlteracaoSalva ? <p className="aviso-rascunho" role="status">Há uma entrada nova que ainda não foi salva no Dmanda e está só neste aparelho. <button className="btn mini" onClick={() => abrirJanela({ t: 'entrada' })}>Continuar</button></p> : null}
      {tags.length ? (
        <div className="tagbar" role="group" aria-label="Filtrar por tag">
          <button className="chip neutro" aria-pressed={!tagAtiva} onClick={() => setTag('')}>Todas {entradas.length}</button>
          {tags.map(([t, n]) => <button key={t} className="chip neutro mono" aria-pressed={tagAtiva === t} onClick={() => setTag(t)}>#{t} {n}</button>)}
        </div>
      ) : null}
      {carregandoEntradas && !entradas.length ? <div className="vazio-c" role="status">Carregando as entradas...</div>
        : !entradas.length ? (
          <div className="vazio"><Icone nome="nav-entradas" extra="grande" /><h3>Nenhuma entrada ainda</h3><p>Anote rápido o que não pode esquecer. Use # para criar tags e transforme a anotação em demanda quando for a hora.</p><button className="btn pri" onClick={() => abrirJanela({ t: 'entrada' })}>Nova entrada</button></div>
        ) : !lista.length ? (
          <div className="vazio"><Icone nome="busca" extra="grande" /><h3>Nenhuma entrada encontrada</h3><p>Ajuste a busca ou a tag para ver mais.</p><button className="btn mini" onClick={() => { setTexto(''); setTag(''); }}>Limpar busca</button></div>
        ) : (
          <div className="postits">
            {lista.map((e, k) => {
              const local = !!rascunhos[`e:${e.id}`], tg = tagsDe(e);
              return (
                <div key={e.id} className="pw" style={{ '--rot': `${k % 3 === 0 ? -0.6 : k % 3 === 1 ? 0.5 : -0.2}deg` } as CSSProperties}>
                  <article className={`postit nota-fundo${e.fixada ? ' fixado' : ''}`} style={{ '--nota-i': e.cor } as CSSProperties} data-id={e.id}>
                    <button className="p-abrir" aria-label={`Abrir a entrada: ${resumoOuVazio(e)}`} onClick={() => abrirJanela({ t: 'entrada', id: e.id })} />
                    <div className="p-top">
                      {local ? <span className="p-local" title="Há alterações só neste aparelho">Só neste aparelho</span> : null}
                      <button className="pin-b" aria-pressed={e.fixada} aria-label={e.fixada ? 'Desafixar a entrada' : 'Fixar a entrada'} title={e.fixada ? 'Desafixar' : 'Fixar'} onClick={() => void fixarEntrada(e.id, !e.fixada)}><Icone nome="pin" /></button>
                      <button className="pin-b virar" aria-label="Virar demanda" title="Virar demanda" onClick={() => virar(e.id)}><Icone nome="arrow-right" /></button>
                    </div>
                    <p className={`p-txt fit${temTitulo(e) ? ' com-titulo' : ''}`}>{resumoOuVazio(e)}</p>
                    <div className="p-tags">{tg.map((t) => <span key={t} className="mono">#{t}</span>)}</div>
                  </article>
                </div>
              );
            })}
          </div>
        )}
    </>
  );
}

// ---------- a janela de uma anotação ----------
type Estado = 'vazio' | 'salvo' | 'pendente' | 'salvando' | 'offline' | 'erro' | 'conflito' | 'vazia-existente';
const TEXTO_ESTADO: Record<Estado, string> = {
  vazio: 'Escreva um título ou o texto. Nada é salvo enquanto estiver vazio.',
  salvo: 'Salvo no Dmanda',
  pendente: 'Só neste aparelho, ainda não salvo no Dmanda',
  salvando: 'Salvando no Dmanda...',
  offline: 'Sem conexão. O texto está guardado só neste aparelho e será salvo quando a conexão voltar.',
  erro: 'Não salvo no Dmanda. O texto continua neste aparelho.',
  conflito: 'Outro aparelho alterou esta entrada. Escolha como seguir.',
  'vazia-existente': 'Uma entrada não pode ficar vazia. A última versão salva continua no Dmanda.',
};

/** Abre a janela de uma anotação já existente; se ela não está nas listas carregadas (Arquivo ainda não aberto), busca no banco. */
export function JanelaEntradaRoteada({ id }: { id?: string }) {
  const { entradas, entradasArquivadas, buscarEntrada, fecharJanela, avisar } = useApp();
  const achada = id ? entradas.find((x) => x.id === id) ?? entradasArquivadas?.find((x) => x.id === id) ?? null : null;
  const [buscada, setBuscada] = useState<Entrada | null>(null);
  useEffect(() => {
    if (!id || achada) return;
    let vivo = true;
    void buscarEntrada(id).then((e) => { if (!vivo) return; if (e) setBuscada(e); else { avisar('Não foi possível abrir esta entrada.', true); fecharJanela(); } });
    return () => { vivo = false; };
  }, [id, achada, buscarEntrada, avisar, fecharJanela]);
  const entrada = achada ?? buscada;
  if (id && !entrada) return null;
  return <JanelaEntrada entrada={entrada} />;
}

function JanelaEntrada({ entrada }: { entrada: Entrada | null }) {
  const app = useApp();
  const { rascunhos, guardarRascunho, fecharJanela, abrirJanela, avisar, demandas } = app;
  const online = useOnline();
  const virar = useVirarDemanda();
  const rasc = rascunhos[entrada ? `e:${entrada.id}` : 'e:nova'];
  const [salva, setSalva] = useState<Entrada | null>(entrada);
  const [idNovo] = useState(() => rasc?.idNovo ?? novoUuid());
  // `local` guarda o que foi digitado; `tocados`, quais campos foram mexidos (os outros acompanham o que está salvo); `baseDe`, o valor de cada campo mexido no banco quando começou a ser mexido
  const [local, setLocal] = useState<CamposEntrada>(() => {
    const base: CamposEntrada = entrada ? camposDe(entrada) : { titulo: '', texto: '', cor: COR_AUTOMATICA, fixada: false };
    const d = (rasc?.dados ?? {}) as Partial<CamposEntrada>;
    for (const k of (rasc?.tocados ?? (entrada ? [] : CAMPOS)) as (keyof CamposEntrada)[]) if (k in d) (base as Record<string, unknown>)[k] = d[k];
    return base;
  });
  const [tocados, setTocados] = useState<(keyof CamposEntrada)[]>(() => (rasc?.tocados as (keyof CamposEntrada)[] | undefined) ?? (entrada ? [] : ['titulo', 'texto', 'fixada']));
  const [baseDe, setBaseDe] = useState<Partial<CamposEntrada>>(() => (rasc?.base ?? {}) as Partial<CamposEntrada>);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<{ atual: Entrada; campos: (keyof CamposEntrada)[] } | null>(null);
  const [fechandoFalhou, setFechandoFalhou] = useState(false);
  const [recuperado] = useState(!!rasc);
  const fila = useRef<Promise<boolean>>(Promise.resolve(true));
  const estadoRef = useRef({ salva, local, tocados, baseDe, conflito });
  const foraDoBancoRef = useRef(false); // há algo só neste aparelho, com falha ou em conflito (só então vale gravar o rascunho ao sair de cena)
  const executarRef = useRef<() => Promise<boolean>>(async () => true);

  const convertida = !!salva?.demanda_id;
  // o que vale agora: o digitado nos campos mexidos e o que está salvo nos demais (uma nova ainda não tem o que está salvo, então vale tudo o que foi digitado)
  const efetivo: CamposEntrada = salva ? { ...camposDe(salva), ...Object.fromEntries(tocados.map((k) => [k, local[k]])) } : local;
  const patch = salva ? diferencas(efetivo, camposDe(salva)) : null;
  const vaziaExistente = !!salva && !convertida && vazia(efetivo);
  const pendente = !convertida && !vaziaExistente && (salva ? Object.keys(patch ?? {}).length > 0 : !vazia(efetivo));
  const estado: Estado = convertida ? 'salvo' : conflito ? 'conflito' : gravando ? 'salvando' : vaziaExistente ? 'vazia-existente' : erro ? 'erro' : pendente ? (online ? 'pendente' : 'offline') : salva ? 'salvo' : 'vazio';
  const chave = salva ? `e:${salva.id}` : 'e:nova';

  useEffect(() => { estadoRef.current = { salva, local, tocados, baseDe, conflito }; foraDoBancoRef.current = pendente || !!erro || !!conflito; });

  const rascunhoAgora = useCallback(() => {
    const e = estadoRef.current;
    const ef: CamposEntrada = e.salva ? { ...camposDe(e.salva), ...Object.fromEntries(e.tocados.map((k) => [k, e.local[k]])) } : e.local;
    guardarRascunho(e.salva ? `e:${e.salva.id}` : 'e:nova', { dados: ef, tocados: e.tocados, base: e.baseDe, ...(e.salva ? {} : { idNovo }) });
  }, [guardarRascunho, idNovo]);

  // depois de gravar: a anotação do banco passa a valer; os campos que a pessoa não digitou de novo desde o envio voltam a acompanhar o que está salvo
  const adotar = (nova: Entrada, enviado: Partial<CamposEntrada>) => {
    const dig = estadoRef.current.local;
    const iguais = (Object.keys(enviado) as (keyof CamposEntrada)[]).filter((k) => aparar({ ...dig })[k] === aparar(camposDe(nova))[k]);
    setSalva(nova);
    setTocados((t) => t.filter((k) => !iguais.includes(k)));
    setBaseDe((b) => { const n = { ...b }; for (const k of iguais) delete n[k]; return n; });
    setErro(null);
  };

  const executar = async (): Promise<boolean> => {
    const e = estadoRef.current;
    if (e.conflito) return false;
    if (e.salva?.demanda_id) return true;
    const ef: CamposEntrada = e.salva ? { ...camposDe(e.salva), ...Object.fromEntries(e.tocados.map((k) => [k, e.local[k]])) } : e.local;
    if (vazia(ef)) return true;
    if (!e.salva) {
      rascunhoAgora(); // o identificador vai para o rascunho antes da chamada: se a resposta se perder, a nova tentativa usa o mesmo e não duplica
      setGravando(true); setErro(null);
      const r = await app.criarEntrada({ id: idNovo, titulo: ef.titulo, texto: ef.texto, cor: ef.cor === COR_AUTOMATICA ? null : ef.cor, fixada: ef.fixada });
      setGravando(false);
      if (!r.ok) { setErro(r.erro); return false; }
      guardarRascunho('e:nova', null);
      adotar(r.entrada, ef);
      return true;
    }
    const p = diferencas(ef, camposDe(e.salva));
    if (!Object.keys(p).length) return true;
    setGravando(true); setErro(null);
    let r = await app.salvarEntrada(e.salva.id, p, e.salva.versao);
    if (!r.ok && r.conflito) {
      const atual = await app.buscarEntrada(e.salva.id);
      if (!atual) { setGravando(false); setErro('Não foi possível conferir a versão salva. O texto continua neste aparelho.'); return false; }
      const campos = camposEmConflito(e.baseDe, camposDe(atual), p);
      if (campos.length) { setGravando(false); setSalva(atual); setConflito({ atual, campos }); return false; }
      r = await app.salvarEntrada(atual.id, p, atual.versao); // os dois cabem juntos: refaz sobre a versão nova
    }
    setGravando(false);
    if (!r.ok) { setErro(r.conflito ? 'Outra alteração chegou ao mesmo tempo. Tente de novo.' : r.erro); return false; }
    adotar(r.entrada, p);
    return true;
  };
  useEffect(() => { executarRef.current = executar; });
  const gravar = useCallback(() => { fila.current = fila.current.then(() => executarRef.current(), () => executarRef.current()); return fila.current; }, []);

  // salvamento automático 1,2 s depois da última alteração; falha não repete sozinha (só com nova alteração, com a conexão de volta ou no botão)
  useEffect(() => {
    if (!pendente || conflito) return;
    const t = setTimeout(() => void gravar(), 1200);
    return () => clearTimeout(t);
  }, [pendente, conflito, efetivo.titulo, efetivo.texto, efetivo.cor, efetivo.fixada, salva?.versao, gravar]);
  useEffect(() => { if (online && (erro || pendente) && !conflito && !gravando) void gravar(); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  // rascunho deste aparelho: guardado em meio segundo enquanto houver algo fora do banco; some quando o banco tem tudo
  useEffect(() => {
    if (convertida) return;
    if (pendente || erro || conflito) { const t = setTimeout(rascunhoAgora, 400); return () => clearTimeout(t); }
    if (!vaziaExistente) guardarRascunho(chave, null);
  }, [pendente, erro, conflito, convertida, vaziaExistente, chave, efetivo.titulo, efetivo.texto, efetivo.cor, efetivo.fixada, rascunhoAgora, guardarRascunho]);
  // a PWA pode ser encerrada logo depois de uma digitação: ao sair de cena, grava o rascunho na hora e tenta o banco
  useEffect(() => {
    const sair = (ev: Event) => {
      if (ev.type !== 'pagehide' && document.visibilityState !== 'hidden') return;
      // sem alteração fora do banco não há rascunho a guardar (senão a grade mostraria "Só neste aparelho" sem motivo)
      if (!foraDoBancoRef.current || estadoRef.current.salva?.demanda_id) return;
      rascunhoAgora(); void gravar();
    };
    document.addEventListener('visibilitychange', sair); addEventListener('pagehide', sair);
    return () => { document.removeEventListener('visibilitychange', sair); removeEventListener('pagehide', sair); };
  }, [rascunhoAgora, gravar]);

  const editar = (k: keyof CamposEntrada, v: string | number | boolean) => {
    setLocal((l) => ({ ...l, [k]: v }));
    setTocados((t) => (t.includes(k) ? t : [...t, k]));
    if (salva) setBaseDe((b) => (k in b ? b : { ...b, [k]: aparar(camposDe(salva))[k] }));
    setErro(null); setFechandoFalhou(false);
  };

  const limparRascunhos = () => { guardarRascunho('e:nova', null); if (salva) guardarRascunho(`e:${salva.id}`, null); };

  const tentarFechar = async () => {
    if (gravando) return;
    if (convertida) { fecharJanela(); return; }
    if (vaziaExistente) { limparRascunhos(); fecharJanela(); avisar('A entrada continua como estava salva: ela não pode ficar vazia.'); return; }
    if (conflito) { rascunhoAgora(); fecharJanela(); avisar('Sua alteração não foi salva porque outro aparelho mudou a entrada. Ela ficou guardada neste aparelho.', true); return; }
    if (!pendente && !erro) { limparRascunhos(); fecharJanela(); return; }
    const ok = await gravar();
    if (ok) { limparRascunhos(); fecharJanela(); return; }
    if (estadoRef.current.conflito) return; // a janela mostra o aviso de conflito
    rascunhoAgora(); setFechandoFalhou(true);
  };
  const fecharMantendo = () => { rascunhoAgora(); fecharJanela(); avisar('A entrada não chegou ao Dmanda. O texto ficou guardado neste aparelho; abra a entrada de novo para salvar.', true); };
  const cancelarNova = () => { limparRascunhos(); fecharJanela(); };

  // resolução do conflito
  const manterMinha = () => { if (!conflito) return; setBaseDe((b) => { const n = { ...b }; for (const k of conflito.campos) n[k] = camposDe(conflito.atual)[k] as never; return n; }); setConflito(null); void gravar(); };
  const usarDoOutro = () => { if (!conflito) return; setTocados((t) => t.filter((k) => !conflito.campos.includes(k))); setBaseDe((b) => { const n = { ...b }; for (const k of conflito.campos) delete n[k]; return n; }); setSalva(conflito.atual); setConflito(null); };
  const guardarComoNova = async () => {
    if (!conflito) return;
    const ef = efetivo;
    const r = await app.criarEntrada({ id: novoUuid(), titulo: ef.titulo, texto: ef.texto, cor: ef.cor === COR_AUTOMATICA ? null : ef.cor, fixada: false });
    if (!r.ok) { setErro(r.erro); return; }
    avisar('Sua versão foi guardada como uma entrada nova.');
    usarDoOutro();
  };

  // ações da própria entrada (primeiro garantem que o que está na tela já foi salvo)
  const comSalvamento = async (acao: (id: string) => Promise<unknown>) => {
    if (pendente || erro) { const ok = await gravar(); if (!ok) { setFechandoFalhou(true); rascunhoAgora(); return; } }
    const id = estadoRef.current.salva?.id;
    if (id) await acao(id);
  };
  const arquivar = () => void comSalvamento(async (id) => { const r = await app.arquivarEntrada(id); if (r) { limparRascunhos(); fecharJanela(); } });
  const recuperar = () => void comSalvamento(async (id) => { const r = await app.desarquivarEntrada(id); if (r) setSalva(r); });
  const virarDemanda = () => void comSalvamento(async (id) => { limparRascunhos(); virar(id, { jaSalva: true }); });

  const demandaLigada = salva?.demanda_id ? demandas.find((d) => d.id === salva.demanda_id) : null;
  const tagsAgora = tagsDe(efetivo);
  const arquivada = !!salva?.arquivada_em && !convertida;
  const rodape = fechandoFalhou ? (
    <div className="confirma-fechar" role="alertdialog" aria-label="A entrada não foi salva">
      <span className="data">{erro ?? 'A entrada não foi salva no Dmanda.'} O texto está guardado neste aparelho.</span><span className="esp" />
      <button className="btn" onClick={() => { setFechandoFalhou(false); void gravar(); }}>Tentar de novo</button>
      <button className="btn" onClick={() => setFechandoFalhou(false)}>Continuar editando</button>
      <button className="btn pri" onClick={fecharMantendo}>Fechar e manter neste aparelho</button>
    </div>
  ) : (
    <>
      <span className="data estado-entrada" role="status" data-estado={estado}>{estado === 'erro' && erro ? `Não salvo no Dmanda: ${erro} O texto continua neste aparelho.` : TEXTO_ESTADO[estado]}{estado === 'erro' ? <> <button className="btn mini" onClick={() => void gravar()}>Tentar de novo</button></> : null}</span>
      <span className="esp" />
      {!salva && !convertida ? <button className="btn" onClick={cancelarNova}>Cancelar</button> : null}
      <button className="btn pri" disabled={gravando} onClick={() => void tentarFechar()}>{salva || convertida ? 'Fechar' : 'Guardar'}</button>
    </>
  );

  return (
    <Janela titulo={salva ? 'Entrada' : 'Nova entrada'} aoFechar={() => void tentarFechar()} sujo={pendente || !!erro || !!conflito || gravando} rodape={rodape}>
      {recuperado && !convertida ? <p className="data rec">{salva ? 'Alterações que estavam só neste aparelho foram recuperadas.' : 'Rascunho recuperado.'}</p> : null}
      {convertida ? (
        <p className="aviso-passo" role="note">Esta entrada <b>virou a demanda{demandaLigada ? ` ${tituloDemanda(demandaLigada)}: ${demandaLigada.assunto}` : ''}</b>. Ela fica preservada como estava, só para consulta.{' '}
          {salva?.demanda_id ? <button className="btn mini" onClick={() => abrirJanela({ t: 'editar', id: salva.demanda_id! })}>Abrir a demanda</button> : null}</p>
      ) : null}
      {conflito ? (
        <div className="aviso-conflito" role="alert">
          <p><b>Outro aparelho alterou esta entrada</b> ({conflito.campos.map((c) => ({ titulo: 'o título', texto: 'o texto', cor: 'a cor', fixada: 'a fixação' })[c]).join(', ')}) enquanto você escrevia. Nada foi gravado e o que você digitou continua aqui.</p>
          <div className="acoes">
            <button className="btn mini pri" onClick={manterMinha}>Manter a minha versão</button>
            <button className="btn mini" onClick={usarDoOutro}>Usar a do outro aparelho</button>
            <button className="btn mini" onClick={() => void guardarComoNova()}>Guardar a minha como nova entrada</button>
          </div>
        </div>
      ) : null}
      <div className="fld"><label htmlFor="e-titulo">Título (opcional)</label>
        <input id="e-titulo" value={efetivo.titulo} maxLength={LIMITE_TITULO} readOnly={convertida} placeholder="Sem título, aparecem as primeiras frases" autoComplete="off" onChange={(e) => editar('titulo', e.target.value)} /></div>
      <div className="fld"><label htmlFor="e-texto">Texto</label>
        <textarea id="e-texto" rows={7} value={efetivo.texto} maxLength={LIMITE_TEXTO} readOnly={convertida} placeholder="Escreva rápido. Use # para tags, em qualquer lugar." onChange={(e) => editar('texto', e.target.value)} />
        {tagsAgora.length ? <span className="data mono tags-detectadas">{tagsAgora.map((t) => `#${t}`).join(' ')}</span> : null}</div>
      {!convertida ? (
        <>
          <div className="fld"><span id="e-cor-r">Cor</span>
            <div className="cores" role="group" aria-labelledby="e-cor-r">
              <button type="button" className="cor-b auto" aria-pressed={efetivo.cor === COR_AUTOMATICA} aria-label="Cor automática" title="Automática" onClick={() => editar('cor', COR_AUTOMATICA)} disabled={!!salva}><Icone nome="sparkles" /></button>
              {Array.from({ length: QTD_CORES }, (_, c) => <button key={c} type="button" className="cor-b nota-fundo" style={{ '--nota-i': c } as CSSProperties} aria-pressed={efetivo.cor === c} aria-label={`Cor ${c + 1}`} onClick={() => editar('cor', c)} />)}
            </div>
            <span className="data">{salva ? 'Escolha a cor desta entrada.' : 'Sem escolha, uma cor é aplicada sozinha.'}</span></div>
          <div className="fld acoes-entrada">
            <button type="button" className="btn mini" aria-pressed={efetivo.fixada} onClick={() => editar('fixada', !efetivo.fixada)}><Icone nome="pin" />{efetivo.fixada ? 'Fixada no topo' : 'Fixar no topo'}</button>
            {salva && !arquivada ? <button type="button" className="btn mini" disabled={gravando} onClick={virarDemanda}><Icone nome="arrow-right" />Virar demanda</button> : null}
            {salva && !arquivada ? <button type="button" className="btn mini" disabled={gravando} onClick={arquivar}><Icone nome="archive" />Arquivar</button> : null}
            {arquivada ? <button type="button" className="btn mini" disabled={gravando} onClick={recuperar}><Icone nome="undo" />Recuperar para Entradas</button> : null}
          </div>
          {arquivada ? <p className="data">Esta entrada está arquivada. Recupere para ela voltar a Entradas.</p> : null}
        </>
      ) : null}
    </Janela>
  );
}

// ---------- na consulta da demanda: a anotação de onde ela nasceu (somente leitura) ----------
export function OrigemEntrada({ id }: { id: string }) {
  const [e, setE] = useState<Entrada | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    srvE.buscarEntrada(id).then((r) => { if (vivo) setE(r.ok ? r.dados : null); }).catch(() => { if (vivo) setE(null); });
    return () => { vivo = false; };
  }, [id]);
  return (
    <section className="origem-entrada" aria-label="Entrada de origem">
      <h4>Entrada de origem</h4>
      {e ? <p className="ler-texto">{e.titulo ? <b>{e.titulo}{e.texto ? '\n' : ''}</b> : null}{e.texto}</p>
        : e === null ? <p className="data">A anotação original não pôde ser lida agora.</p> : <p className="data">Carregando a anotação original...</p>}
    </section>
  );
}

// ---------- Arquivo: entradas arquivadas e as que já viraram demanda ----------
export function ListaEntradasArquivadas() {
  const { entradasArquivadas, carregarEntradasArquivadas, desarquivarEntrada, excluirEntrada, abrirJanela, demandas } = useApp();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  useEffect(() => { void carregarEntradasArquivadas(); }, [carregarEntradasArquivadas]);
  if (entradasArquivadas === null) return <div className="vazio-c" role="status">Carregando as entradas arquivadas...</div>;
  if (!entradasArquivadas.length) return <div className="vazio"><Icone nome="archive" extra="grande" /><h3>Nenhuma entrada arquivada</h3><p>As entradas que você arquivar, ou que já viraram demanda, ficam aqui. Arquivar é sempre manual.</p></div>;
  return (
    <div className="lista" aria-label="Entradas arquivadas">
      {ordenarEntradas(entradasArquivadas).map((e) => {
        const conv = estadoDe(e) === 'convertida', dem = e.demanda_id ? demandas.find((d) => d.id === e.demanda_id) : null;
        return (
          <div key={e.id} className="linha" data-entrada={e.id}><div className="linha-c">
            <i className="nota-fundo bolinha-nota" style={{ '--nota-i': e.cor } as CSSProperties} aria-hidden="true" />
            <span className="ass">{resumoOuVazio(e)}</span>
            {tagsDe(e).map((t) => <span key={t} className="chip neutro mono">#{t}</span>)}
            <span className="chip neutro">{conv ? 'Virou demanda' : 'Arquivada'}</span>
            <button className="btn mini" onClick={() => abrirJanela({ t: 'entrada', id: e.id })}>Abrir</button>
            {conv && e.demanda_id ? <button className="btn mini" onClick={() => abrirJanela({ t: 'editar', id: e.demanda_id! })}>{dem ? 'Abrir a demanda' : 'Ver a demanda'}</button>
              : <button className="btn mini" onClick={() => void desarquivarEntrada(e.id)}>Recuperar</button>}
            {!conv ? (confirmando === e.id
              ? <><span className="data">Excluir de vez? Não dá para desfazer.</span><button className="btn mini perigo" onClick={async () => { if (await excluirEntrada(e.id)) setConfirmando(null); }}><Icone nome="trash" />Confirmar exclusão</button><button className="btn mini" onClick={() => setConfirmando(null)}>Cancelar</button></>
              : <button className="btn mini" onClick={() => setConfirmando(e.id)}><Icone nome="trash" />Excluir</button>) : null}
          </div></div>
        );
      })}
    </div>
  );
}
