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
import { flushSync } from 'react-dom';
import { Icone } from './Icone';
import { Janela } from './janela-base';
import { novoUuid } from './campos';
import { srvE } from './fonte';
import { useApp, useOnline } from './contexto';
import {
  aparar, camposEmConflito, carimbo, contarTags, COR_AUTOMATICA, diferencas, estadoDe, filtrarEntradas, LIMITE_TEXTO, LIMITE_TITULO, ordenarEntradas, QTD_CORES, resumoDe, semTags, tagsDe, temTitulo, vazia,
  type CamposEntrada, type Entrada,
} from '@/lib/entradas';
import { plural, titulo as tituloDemanda } from '@/lib/demandas';

const CAMPOS: (keyof CamposEntrada)[] = ['titulo', 'texto', 'cor', 'fixada'];
const camposDe = (e: Entrada): CamposEntrada => ({ titulo: e.titulo, texto: e.texto, cor: e.cor, fixada: e.fixada });
const resumoOuVazio = (e: Entrada) => resumoDe(e) || '(só tags)';

/** Ajuste ao espaço do post-it: nunca há barra de rolagem. O texto ocupa as linhas que couberem; se sobra pouco, as tags saem antes do texto. */
export function ajustarNotas() {
  document.querySelectorAll<HTMLElement>('.app .postit').forEach((p) => {
    const tags = p.querySelector<HTMLElement>('.p-tags'), x = p.querySelector<HTMLElement>('.p-txt.fit, .p-desc.fit');
    tags?.classList.remove('oculto'); x?.classList.remove('oculto'); if (x) x.style.maxHeight = '';
    if (!x) return;
    x.style.webkitLineClamp = 'none';
    const cs = getComputedStyle(x), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    // sem título, o texto é o conteúdo e as tags saem antes dele se faltar espaço; com título, as tags ficam e a descrição é que cede
    if (tags && !x.classList.contains('p-desc') && tags.textContent?.trim() && x.clientHeight < lh * 3.2) { tags.classList.add('oculto'); }
    const linhas = Math.floor((x.clientHeight + 1) / lh);
    if (x.classList.contains('p-desc') && linhas < 1) { x.classList.add('oculto'); return; } // a descrição só aparece se couber ao menos uma linha inteira
    x.style.webkitLineClamp = String(Math.max(1, linhas));
    x.style.maxHeight = `${Math.max(1, linhas) * lh}px`; // a caixa tem exatamente as linhas inteiras que couberam (nunca meia linha)
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
                    {temTitulo(e) ? <p className="p-txt com-titulo tit">{resumoOuVazio(e)}</p> : <p className="p-txt fit">{resumoOuVazio(e)}</p>}
                    {temTitulo(e) && semTags(e.texto) ? <p className="desc p-desc fit">{semTags(e.texto)}</p> : null}
                    <div className="p-tags">{tg.map((t) => <span key={t} className="mono">#{t}</span>)}</div>
                    <p className="p-data mono" data-carimbo title={`Criada em ${carimbo(e.criado_em)}`}>{carimbo(e.criado_em)}</p>
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
  // Uma anotação que já existe abre em leitura (sem campo focado, sem teclado); o lápis leva à edição. Nova anotação abre direto em edição.
  const [modo, setModo] = useState<'ler' | 'editar'>(entrada ? 'ler' : 'editar');
  const [retomado, setRetomado] = useState(false);
  const lapisRef = useRef<HTMLButtonElement>(null);
  const fila = useRef<Promise<boolean>>(Promise.resolve(true));
  const estadoRef = useRef({ salva, local, tocados, baseDe, conflito });
  const emEsperaRef = useRef(false);
  const foraDoBancoRef = useRef(false); // há algo só neste aparelho, com falha ou em conflito (só então vale gravar o rascunho ao sair de cena)
  const executarRef = useRef<() => Promise<boolean>>(async () => true);

  const convertida = !!salva?.demanda_id;
  // o que vale agora: o digitado nos campos mexidos e o que está salvo nos demais (uma nova ainda não tem o que está salvo, então vale tudo o que foi digitado)
  const efetivo: CamposEntrada = salva ? { ...camposDe(salva), ...Object.fromEntries(tocados.map((k) => [k, local[k]])) } : local;
  const patch = salva ? diferencas(efetivo, camposDe(salva)) : null;
  const vaziaExistente = !!salva && !convertida && vazia(efetivo);
  const pendente = !convertida && !vaziaExistente && (salva ? Object.keys(patch ?? {}).length > 0 : !vazia(efetivo));
  // Rascunho de um aparelho que ainda não foi enviado, encontrado ao abrir uma anotação existente: fica em espera até a pessoa tocar em Retomar edição.
  // Em espera nada é enviado nem sobrescrito (nem salvamento automático, nem ao fechar, nem pelas ações da janela); a leitura mostra a versão salva.
  const emEspera = !!entrada && recuperado && !retomado && pendente;
  const estado: Estado = convertida ? 'salvo' : conflito ? 'conflito' : gravando ? 'salvando' : vaziaExistente ? 'vazia-existente' : erro ? 'erro' : pendente ? (online ? 'pendente' : 'offline') : salva ? 'salvo' : 'vazio';
  const chave = salva ? `e:${salva.id}` : 'e:nova';

  useEffect(() => { estadoRef.current = { salva, local, tocados, baseDe, conflito }; foraDoBancoRef.current = pendente || !!erro || !!conflito; emEsperaRef.current = emEspera; });

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
    if (!pendente || conflito || emEspera) return;
    const t = setTimeout(() => void gravar(), 1200);
    return () => clearTimeout(t);
  }, [pendente, conflito, emEspera, efetivo.titulo, efetivo.texto, efetivo.cor, efetivo.fixada, salva?.versao, gravar]);
  useEffect(() => { if (online && (erro || pendente) && !conflito && !gravando && !emEspera) void gravar(); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

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
      rascunhoAgora();
      if (!emEsperaRef.current) void gravar();
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

  // Entra na edição dentro do mesmo toque (o foco só abre o teclado do celular se for dado no gesto da pessoa) e leva o cursor ao fim do texto
  const entrarEdicao = () => {
    flushSync(() => { setRetomado(true); setModo('editar'); });
    const campo = document.getElementById('e-texto') as HTMLTextAreaElement | null;
    campo?.focus(); campo?.setSelectionRange(campo.value.length, campo.value.length);
  };
  const voltarLeitura = () => { flushSync(() => setModo('ler')); lapisRef.current?.focus(); };

  const limparRascunhos = () => { guardarRascunho('e:nova', null); if (salva) guardarRascunho(`e:${salva.id}`, null); };

  const tentarFechar = async () => {
    if (gravando) return;
    if (convertida || emEspera) { fecharJanela(); return; } // em espera o rascunho do aparelho continua guardado e nada é enviado
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
  // Um identificador por conflito e uma gravação por vez: toque duplo, ou repetir depois de uma resposta perdida, devolve a mesma entrada em vez de criar outra
  const novaDoConflito = useRef<{ conflito: unknown; id: string } | null>(null);
  const guardandoNova = useRef(false);
  const guardarComoNova = async () => {
    if (!conflito || guardandoNova.current) return;
    if (novaDoConflito.current?.conflito !== conflito) novaDoConflito.current = { conflito, id: novoUuid() };
    guardandoNova.current = true;
    const ef = efetivo;
    const r = await app.criarEntrada({ id: novaDoConflito.current.id, titulo: ef.titulo, texto: ef.texto, cor: ef.cor === COR_AUTOMATICA || ef.cor >= QTD_CORES ? null : ef.cor, fixada: false });
    guardandoNova.current = false;
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
      <button className="btn" onClick={() => { setFechandoFalhou(false); if (modo === 'ler') entrarEdicao(); }}>Continuar editando</button>
      <button className="btn pri" onClick={fecharMantendo}>Fechar e manter neste aparelho</button>
    </div>
  ) : (
    <>
      <span className="data estado-entrada" role="status" data-estado={estado}>{estado === 'salvo' && salva ? `Criada em ${carimbo(salva.criado_em)}` : <>{estado === 'erro' && erro ? `Não salvo no Dmanda: ${erro} O texto continua neste aparelho.` : TEXTO_ESTADO[estado]}{salva ? ` Criada em ${carimbo(salva.criado_em)}.` : ''}</>}{estado === 'erro' ? <> <button className="btn mini" onClick={() => void gravar()}>Tentar de novo</button></> : null}</span>
      <span className="esp" />
      {!salva && !convertida ? <button className="btn" onClick={cancelarNova}>Cancelar</button> : null}
      {salva && !convertida && modo === 'editar' ? <button className="btn" onClick={voltarLeitura}>Voltar à leitura</button> : null}
      <button className="btn pri" disabled={gravando} onClick={() => void tentarFechar()}>{salva || convertida ? 'Fechar' : 'Guardar'}</button>
    </>
  );

  const lido = emEspera && salva ? camposDe(salva) : efetivo; // em espera, a leitura mostra o que está salvo no Dmanda, nunca o rascunho
  const lapis = salva && !convertida && modo === 'ler'
    ? <button ref={lapisRef} type="button" className="icbtn-s" aria-label="Editar a entrada" title="Editar" onClick={entrarEdicao}><Icone nome="pencil" /></button> : null;
  const editando = modo === 'editar' && !convertida;

  return (
    <Janela titulo={salva ? 'Entrada' : 'Nova entrada'} foco={entrada ? 'janela' : 'campo'} extraCab={lapis} aoFechar={() => void tentarFechar()} sujo={(pendente && !emEspera) || !!erro || !!conflito || gravando} rodape={rodape}>
      {editando && recuperado ? <p className="data rec">{salva ? 'Alterações que estavam só neste aparelho foram recuperadas.' : 'Rascunho recuperado.'}</p> : null}
      {emEspera ? (
        <p className="aviso-passo" role="status"><b>Há alterações só neste aparelho.</b> Elas ainda não foram enviadas ao Dmanda e não aparecem abaixo, que mostra a versão salva. Nada será enviado até você retomar a edição.{' '}
          <button className="btn mini pri" onClick={entrarEdicao}>Retomar edição</button></p>
      ) : null}
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
      {editando ? (
        <>
          <div className="fld"><label htmlFor="e-titulo">Título (opcional)</label>
            <input id="e-titulo" value={efetivo.titulo} maxLength={LIMITE_TITULO} placeholder="Sem título, aparecem as primeiras frases" autoComplete="off" onChange={(e) => editar('titulo', e.target.value)} /></div>
          <div className="fld"><label htmlFor="e-texto">Texto</label>
            <textarea id="e-texto" rows={7} value={efetivo.texto} maxLength={LIMITE_TEXTO} placeholder="Escreva rápido. Use # para tags, em qualquer lugar." onChange={(e) => editar('texto', e.target.value)} />
            {tagsAgora.length ? <span className="data mono tags-detectadas">{tagsAgora.map((t) => `#${t}`).join(' ')}</span> : null}</div>
          <div className="fld"><span id="e-cor-r">Cor</span>
            <div className="cores" role="group" aria-labelledby="e-cor-r">
              <button type="button" className="cor-b auto" aria-pressed={efetivo.cor === COR_AUTOMATICA} aria-label="Cor automática" title="Automática" onClick={() => editar('cor', COR_AUTOMATICA)} disabled={!!salva}><Icone nome="sparkles" /></button>
              {Array.from({ length: QTD_CORES }, (_, c) => <button key={c} type="button" className="cor-b nota-fundo" style={{ '--nota-i': c } as CSSProperties} aria-pressed={efetivo.cor === c} aria-label={`Cor ${c + 1}`} onClick={() => editar('cor', c)} />)}
            </div>
            <span className="data">{salva ? 'Escolha a cor desta entrada.' : 'Sem escolha, uma cor é aplicada sozinha.'}</span></div>
        </>
      ) : (
        <div className={`ler-entrada${lido.cor >= 0 ? ' nota-fundo' : ''}`} style={{ '--nota-i': Math.max(0, lido.cor) } as CSSProperties} data-leitura>
          {lido.titulo.trim() ? <h4 className="ler-titulo">{lido.titulo}</h4> : null}
          {lido.texto.trim() ? <p className="ler-corpo">{lido.texto}</p> : null}
          {tagsDe(lido).length ? <p className="ler-tags mono" aria-label="Tags">{tagsDe(lido).map((t) => <span key={t}>#{t}</span>)}</p> : null}
        </div>
      )}
      {!convertida ? (
        <>
          <div className="fld acoes-entrada">
            <button type="button" className="btn mini" aria-pressed={lido.fixada} disabled={emEspera} onClick={() => editar('fixada', !efetivo.fixada)}><Icone nome="pin" />{lido.fixada ? 'Fixada no topo' : 'Fixar no topo'}</button>
            {salva && !arquivada ? <button type="button" className="btn mini" disabled={gravando || emEspera} onClick={virarDemanda}><Icone nome="arrow-right" />Virar demanda</button> : null}
            {salva && !arquivada ? <button type="button" className="btn mini" disabled={gravando || emEspera} onClick={arquivar}><Icone nome="archive" />Arquivar</button> : null}
            {arquivada ? <button type="button" className="btn mini" disabled={gravando || emEspera} onClick={recuperar}><Icone nome="undo" />Recuperar para Entradas</button> : null}
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
