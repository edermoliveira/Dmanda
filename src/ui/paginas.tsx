'use client';
// Telas do aplicativo funcional: Início (resumos e Foco do dia), Demandas (quatro visões), Arquivo, Mais e as áreas ainda não construídas.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Capsula } from './Capsula';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icone } from './Icone';
import { useApp, type EstadoRotina } from './contexto';
import { CardDemanda, CardInicio, ChipPrazo, ChipSelo, ChipTipo, LinhaInicio, OrigemP } from './cartoes';
import { Cards, Lista, Quadro, Tabela, useAjustar, Vazio } from './visoes';
import { ListaEntradasArquivadas } from './entradas';
import { RegistroNoInicio } from './perfil';
import { filtrar, FILTRO_VAZIO, grupoFiltro, plural, porGrupo, titulo, type Demanda } from '@/lib/demandas';
import { VAGAS_PARA_HOJE, elegiveisParaHoje, organizarPainel, precisaCompletar, vagasAbertas } from '@/lib/para-hoje';
import { anoDoDocumento, chaveOpcao } from '@/lib/documentos';
import { WidgetClima } from './clima';

function CabecaPagina({ titulo, sub }: { titulo: string; sub: string }) { return <div className="pagehead"><h1>{titulo}</h1><p>{sub}</p></div>; }
function Carregando() { return <div className="vazio-c" role="status">Carregando as demandas...</div>; }

// ---------- Início ----------
const GRUPOS_INICIO = [['atrasadas', 'Atrasadas', 'clock', true], ['hoje', 'Vencem hoje', 'target', false], ['sete', 'Próximos 7 dias', 'calendar', false]] as const;
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
// Os prazos da tela vêm sempre das datas das demandas; esta linha só informa a rotina diária na nuvem.
function textoRotina(r: EstadoRotina | null) {
  if (!r) return '';
  const falhouDepois = r.ultima_falha && (!r.ultima_ok || r.ultima_falha > r.ultima_ok);
  if (falhouDepois) return `A última tentativa da rotina diária não terminou (${quando(r.ultima_falha!)}). Os prazos acima continuam corretos.`;
  return r.ultima_ok ? `Rotina diária na nuvem: última execução em ${quando(r.ultima_ok)}.` : 'A rotina diária na nuvem ainda não rodou. Os prazos acima já são calculados pelas datas das demandas.';
}

/** O Clima só aparece com o ambiente e as preferências do aparelho lidos (assim nenhuma consulta sai antes de saber a cidade escolhida ou se é um teste sem clima) e nunca no servidor. */
function ClimaNoInicio() {
  const { ambiente, prefsProntas } = useApp();
  if (!ambiente || ambiente.semClima || !prefsProntas) return null;
  return <section className="widgets" aria-label="Widgets do Início"><WidgetClima /></section>;
}

export function PaginaInicio() {
  const { demandas, carregando, erroCarga, abrirJanela, hoje, rotina, dias } = useApp();
  const [sel, setSel] = useState<'atrasadas' | 'hoje' | 'sete' | null>(null);
  useAjustar(`${demandas.length}${sel}`);
  return (
    <>
      <CabecaPagina titulo="Início" sub="Seu dia em um só lugar." />
      {demandas.length ? (
        <section className="sec ini-prazos">
            <div className="stats tres ini-contadores" role="group" aria-label="Filtrar demandas por prazo">
              {GRUPOS_INICIO.map(([g, nome, icone, alerta]) => {
                const n = porGrupo(demandas, g, hoje, dias).length;
                return (
                  <button key={g} className={`stat st-${g}${alerta && n ? ' alerta' : ''}`} aria-pressed={sel === g} onClick={() => setSel(sel === g ? null : g)}>
                    <span className="st-ic"><Icone nome={icone} /></span><span className="n">{n}</span><span className="r">{nome}</span>
                  </button>
                );
              })}
            </div>
            {sel ? (() => {
              const l = porGrupo(demandas, sel, hoje, dias), nome = GRUPOS_INICIO.find((g) => g[0] === sel)![1];
              return <><h3 className="sub-f">{nome} <small>{plural(l.length, 'demanda')}</small></h3>{l.length ? <div className="cards">{l.map((d) => <CardDemanda key={d.id} d={d} />)}</div> : <div className="vazio-c">Nenhuma demanda neste filtro.</div>}</>;
            })() : null}
        </section>
      ) : null}
      {/* Para hoje é o trabalho principal (cerca de dois terços); Humor e Clima são o apoio (um terço) e vêm depois dele, então no estreito empilham abaixo */}
      <div className="ini-grade">
        <div className="ini-principal">
          {carregando && !demandas.length ? <Carregando /> : null}
          {!carregando && !erroCarga && !demandas.length ? (
            <div className="vazio"><Icone nome="nav-demandas" extra="grande" /><h3>Nenhuma demanda ainda</h3><p>Cadastre a primeira para ver aqui os prazos e o Para hoje.</p><button className="btn pri" onClick={() => abrirJanela({ t: 'nova' })}>Nova demanda</button></div>
          ) : null}
          {demandas.length ? <ParaHoje /> : null}
        </div>
        <aside className="ini-apoio" aria-label="Apoio do dia: humor e clima">
          <RegistroNoInicio />
          <ClimaNoInicio />
        </aside>
      </div>
      <p className="rotina-estado">{textoRotina(rotina)}</p>
    </>
  );
}

// ---------- Para hoje ----------
// O painel de execução do dia (o antigo Foco do dia): até 4 vagas, guardadas no banco. Ao concluir ou arquivar uma demanda, só a vaga liberada é reposta. Uma urgência que surge depois
// das vagas escolhidas aparece à parte, sem trocar a seleção. Não é o grupo "Vencem hoje" (que lista tudo o que vence hoje, com ou sem ação).
function ParaHoje() {
  const { demandas, hoje, dias, paraHoje, sincronizarParaHoje, carregando } = useApp();
  const elegiveis = useMemo(() => elegiveisParaHoje(demandas, hoje, dias), [demandas, hoje, dias]);
  const abertas = vagasAbertas(paraHoje, demandas);
  const ocupadas = new Set(abertas.map((v) => v.demanda.id));
  const faltaCompletar = precisaCompletar(paraHoje, demandas, elegiveis);
  const candidatas = faltaCompletar ? elegiveis.filter((e) => !ocupadas.has(e.demanda.id)).slice(0, 10).map((e) => e.demanda.id).join(',') : '';
  // preenche (ou repõe) só as vagas livres; a lista só muda quando as candidatas mudam, então uma resposta sem efeito não repete a chamada
  useEffect(() => { if (!carregando && hoje !== '2000-01-01' && candidatas) void sincronizarParaHoje(candidatas.split(',')); }, [candidatas, carregando, hoje, sincronizarParaHoje]);
  // Exibição (decisão 61): os pedidos da Prefeita e do Gabinete vêm antes das demais, mesmo quando ocupam a 2ª ou a 3ª vaga, e os que estão fora das vagas ficam acima das comuns. As vagas
  // guardadas no banco não mudam (o data-vaga continua com a posição gravada) e cada demanda aparece uma só vez.
  const { prioritariasNasVagas, prioritariasFora, comunsNasVagas, urgenciasComuns } = organizarPainel(paraHoje, demandas, elegiveis);
  const vazio = !prioritariasNasVagas.length && !prioritariasFora.length && !comunsNasVagas.length;
  return (
    <section className="sec" data-painel="para-hoje" aria-labelledby="ph-t">
      <h3 id="ph-t">Para hoje <small>até 4 demandas para tocar hoje: pedidos da Prefeita e do Gabinete primeiro, depois atrasadas e as que vencem hoje</small></h3>
      {vazio ? <div className="vazio-c">Nada para tocar hoje por enquanto.</div> : (
        <>
          {/* decisão 63: a prioridade fora das vagas vem em linhas compactas, acima das comuns; as vagas ficam numa grade que se adapta à quantidade (2x2 com quatro) */}
          {prioritariasFora.length ? (
            <div className="ph-fora">{prioritariasFora.map((e) => <div key={e.demanda.id} data-fora-vaga className="vaga fora-vaga"><LinhaInicio d={e.demanda} rotulo={`Fora das ${VAGAS_PARA_HOJE} vagas`} mostrarRapida /></div>)}</div>
          ) : null}
          {prioritariasNasVagas.length + comunsNasVagas.length ? (
            <div className="ph-grade" data-n={prioritariasNasVagas.length + comunsNasVagas.length}>
              {prioritariasNasVagas.map((v) => <div key={v.demanda.id} data-vaga={v.posicao} className="vaga"><CardInicio d={v.demanda} mostrarRapida /></div>)}
              {comunsNasVagas.map((v) => <div key={v.demanda.id} data-vaga={v.posicao} className="vaga"><CardInicio d={v.demanda} mostrarRapida /></div>)}
            </div>
          ) : null}
        </>
      )}
      {urgenciasComuns.length ? (
        <div className="nova-urgencia" role="status" data-nova-urgencia>
          <h4>Nova urgência <small>fora das suas vagas, sem trocar a seleção</small></h4>
          <div className="il-lista">{urgenciasComuns.slice(0, 3).map((e) => <LinhaInicio key={e.demanda.id} d={e.demanda} mostrarRapida />)}</div>
        </div>
      ) : null}
    </section>
  );
}

// ---------- Demandas ----------
const VISOES = [['cards', 'Cards', 'vis-cards'], ['quadro', 'Quadro', 'columns'], ['tabela', 'Tabela', 'vis-tabela'], ['lista', 'Lista', 'vis-lista']] as const;
const PRAZOS_FILTRO = [['', 'Todos'], ['sem', 'Sem prazo'], ['atrasadas', 'Atrasadas'], ['hoje', 'Vencem hoje'], ['sete', 'Próximos 7 dias']] as const;

function PainelFiltros({ pos, fechar }: { pos: { x: number; y: number }; fechar: () => void }) {
  const { filtro, setFiltro, opcoes, demandas } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  // as opções do cadastro mais o que já existe nas demandas (e o filtro ativo), sem repetir; os anos são os que aparecem nas demandas (confirmados ou reconhecidos pelo número)
  const juntar = (lista: string[], extra: (string | null)[]) => { const vistos = new Set<string>(), saida: string[] = []; for (const n of [...lista, ...extra]) { const k = chaveOpcao(n); if (n && k && !vistos.has(k)) { vistos.add(k); saida.push(n); } } return saida; };
  const nomes = { origem: juntar(opcoes.origem.map((o) => o.nome), [filtro.origem]), tipo: juntar(opcoes.tipo.map((o) => o.nome), [filtro.tipo]) };
  const anos = [...new Set([...demandas.map((d) => anoDoDocumento(d)), filtro.ano ? Number(filtro.ano) : null].filter((a): a is number => !!a))].sort((a, b) => b - a);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const app = document.querySelector('.app')!.getBoundingClientRect(), w = m.offsetWidth;
    m.style.left = `${Math.min(Math.max(8, pos.x - w), app.width - w - 8)}px`; m.style.top = `${pos.y + 6}px`;
    m.querySelector<HTMLElement>('select')?.focus();
    const fora = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.('.mv-menu') && !t.closest?.('[data-filtros]')) fechar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); fechar(); (document.querySelector('[data-filtros]') as HTMLElement | null)?.focus(); } };
    document.addEventListener('click', fora, true); document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('click', fora, true); document.removeEventListener('keydown', tecla, true); };
  }, [pos, fechar]);
  const alvo = document.querySelector('.app');
  if (!alvo) return null;
  return createPortal(
    <div ref={ref} className="mv-menu painel-filtros" role="dialog" aria-label="Filtros de demandas" style={{ padding: 14, minWidth: 260 }}>
      <div className="fld"><label htmlFor="f-origem">Origem</label><select id="f-origem" value={filtro.origem} onChange={(e) => setFiltro({ origem: e.target.value })}><option value="">Todas</option>{nomes.origem.map((t) => <option key={t}>{t}</option>)}</select></div>
      <div className="fld"><label htmlFor="f-tipo">Tipo de documento</label><select id="f-tipo" value={filtro.tipo} onChange={(e) => setFiltro({ tipo: e.target.value })}><option value="">Todos</option>{nomes.tipo.map((t) => <option key={t}>{t}</option>)}</select></div>
      <div className="fld"><label htmlFor="f-ano">Ano do documento</label><select id="f-ano" value={filtro.ano} onChange={(e) => setFiltro({ ano: e.target.value })}><option value="">Todos</option>{anos.map((a) => <option key={a}>{a}</option>)}</select></div>
      <div className="fld"><label htmlFor="f-prazo">Prazo</label><select id="f-prazo" value={filtro.prazo} onChange={(e) => setFiltro({ prazo: e.target.value as typeof filtro.prazo })}>{PRAZOS_FILTRO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div>
      <div className="acoes"><button className="btn mini" onClick={() => setFiltro({ tipo: '', origem: '', ano: '', prazo: '' })}>Limpar filtros</button><button className="btn mini pri" onClick={fechar}>Fechar</button></div>
    </div>, alvo);
}

export function PaginaDemandas() {
  const { demandas, carregando, erroCarga, visao, setVisao, filtro, setFiltro, abrirJanela, hoje, setAbaArquivo, dias } = useApp();
  const router = useRouter();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const lista = filtrar(demandas, filtro, hoje, dias);
  const nAt = demandas.filter((d) => grupoFiltro(d, hoje, dias) === 'atrasadas').length;
  const nFiltros = (filtro.tipo ? 1 : 0) + (filtro.origem ? 1 : 0) + (filtro.ano ? 1 : 0) + (filtro.prazo ? 1 : 0);
  const [toque, setToque] = useState(false);
  useEffect(() => { const m = matchMedia('(max-width: 899px)'); const f = () => setToque(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  useAjustar(`${demandas.length}${visao}${lista.length}`);
  // atalho "/" do protótipo aprovado: foca o filtro (não vale digitando em um campo, com janela ou menu aberto)
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-ov, .mv-menu')) return;
      e.preventDefault(); document.getElementById('fq')?.focus();
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
  return (
    <>
      <CabecaPagina titulo="Demandas" sub={`${plural(demandas.length, 'demanda')}, ${plural(nAt, 'atrasada')}. Do cadastro à conclusão.`} />
      <div className="toolbar t4">
        <div className="tabs" role="group" aria-label="Visão">
          <Capsula sel='button[aria-pressed="true"]' chave={visao} />
          {VISOES.map(([v, nome, icone]) => <button key={v} data-v={v} aria-pressed={visao === v} aria-label={nome} onClick={() => setVisao(v)}><Icone nome={icone} /><span className="tx">{nome}</span></button>)}
        </div>
        <label className="filtro"><Icone nome="busca" /><input id="fq" placeholder={toque ? 'Filtrar demandas' : 'Filtrar demandas ( / )'} value={filtro.texto} aria-label="Filtrar demandas" autoComplete="off" onChange={(e) => setFiltro({ texto: e.target.value })} /></label>
        <button className="btn gl" aria-pressed={filtro.soAtrasadas} aria-label="Só atrasadas" onClick={() => setFiltro({ soAtrasadas: !filtro.soAtrasadas })}><Icone nome="clock" /><span className="tx">Só atrasadas{nAt ? ` ${nAt}` : ''}</span></button>
        <button className="btn gl" data-filtros aria-haspopup="dialog" aria-expanded={!!pos} aria-label={nFiltros ? `Filtros, ${nFiltros} ativos` : 'Filtros'} onClick={(e) => { const a = document.querySelector('.app')!.getBoundingClientRect(), b = e.currentTarget.getBoundingClientRect(); setPos(pos ? null : { x: b.right - a.left, y: b.bottom - a.top }); }}><Icone nome="filtro" /><span className="tx">Filtros{nFiltros ? ` ${nFiltros}` : ''}</span></button>
        <button className="btn gl" aria-label="Ver demandas arquivadas" onClick={() => { setAbaArquivo('demandas'); router.push('/arquivo'); }}><Icone nome="archive" /><span className="tx">Arquivadas</span></button>
        <button className="btn escuro" aria-label="Nova demanda" onClick={() => abrirJanela({ t: 'nova' })}><Icone nome="plus" /><span className="tx">Nova demanda</span></button>
      </div>
      {pos ? <PainelFiltros pos={pos} fechar={() => setPos(null)} /> : null}
      <div id="vista">
        {carregando && !demandas.length ? <Carregando />
          : !demandas.length && erroCarga ? null // a leitura falhou: o erro e o botão de tentar de novo já estão no topo; não se diz que não há demandas
          : !demandas.length ? <div className="vazio"><Icone nome="nav-demandas" extra="grande" /><h3>Nenhuma demanda cadastrada</h3><p>Cadastre a primeira com o botão Nova demanda.</p><button className="btn pri" onClick={() => abrirJanela({ t: 'nova' })}>Nova demanda</button></div>
          : !lista.length ? <div className="vazio"><Icone nome="busca" extra="grande" /><h3>Nenhuma demanda encontrada</h3><p>Ajuste o filtro para ver mais.</p><button className="btn mini" onClick={() => setFiltro({ ...FILTRO_VAZIO })}>Limpar filtros</button></div>
          : visao === 'cards' ? <Cards lista={lista} /> : visao === 'quadro' ? <Quadro lista={lista} /> : visao === 'tabela' ? <Tabela lista={lista} /> : <Lista lista={lista} />}
      </div>
    </>
  );
}

// ---------- Arquivo ----------
export function PaginaArquivo() {
  const { arquivadas, carregarArquivadas, desarquivar, excluir, abrirJanela, abaArquivo, setAbaArquivo } = useApp();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  useEffect(() => { void carregarArquivadas(); }, [carregarArquivadas]);
  return (
    <>
      <CabecaPagina titulo="Arquivo" sub={abaArquivo === 'entradas' ? 'Entradas arquivadas e as que já viraram demanda.' : 'Demandas arquivadas.'} />
      <div className="toolbar">
        <div className="tabs so-texto" role="group" aria-label="O que mostrar">
          <Capsula sel='button[aria-pressed="true"]' chave={abaArquivo} />
          <button data-aba="demandas" aria-pressed={abaArquivo === 'demandas'} onClick={() => setAbaArquivo('demandas')}><span className="tx">Demandas</span></button>
          <button data-aba="entradas" aria-pressed={abaArquivo === 'entradas'} onClick={() => setAbaArquivo('entradas')}><span className="tx">Entradas</span></button>
        </div>
      </div>
      {abaArquivo === 'entradas' ? <ListaEntradasArquivadas />
        : arquivadas === null ? <Carregando /> : !arquivadas.length ? <Vazio icone="archive" titulo="Nada arquivado" texto="As demandas que você arquivar aparecem aqui. Arquivar é sempre manual." /> : (
        <div className="lista">
          {arquivadas.map((d: Demanda) => (
            <div key={d.id} className="linha"><div className="linha-c">
              <span className="mono num">{titulo(d)}</span><span className="ass">{d.assunto}</span><OrigemP d={d} /><ChipTipo d={d} /><span className="chip neutro">{d.etapa === 'Finalizado' ? 'Finalizada' : d.etapa}</span><ChipPrazo d={d} /><ChipSelo d={d} />
              <button className="btn mini" onClick={() => abrirJanela({ t: 'editar', id: d.id })}>Abrir</button>
              <button className="btn mini" onClick={() => void desarquivar(d.id)}>Desarquivar</button>
              {confirmando === d.id
                ? <><span className="data">Excluir de vez? Não dá para desfazer.</span><button className="btn mini perigo" onClick={async () => { if (await excluir(d.id)) setConfirmando(null); }}><Icone nome="trash" />Confirmar exclusão</button><button className="btn mini" onClick={() => setConfirmando(null)}>Cancelar</button></>
                : <button className="btn mini" onClick={() => setConfirmando(d.id)}><Icone nome="trash" />Excluir</button>}
            </div></div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- Mais (celular e iPad vertical) ----------
export function PaginaMais() {
  const router = useRouter();
  const itens: [string, string, string][] = [['/entradas', 'Entradas', 'nav-entradas'], ['/documentos', 'Documentos', 'nav-documentos'], ['/ia', 'IA', 'nav-ia'], ['/config', 'Configurações', 'nav-config'], ['/arquivo', 'Arquivo', 'archive']];
  return (
    <>
      <CabecaPagina titulo="Mais" sub="Outras áreas do Dmanda." />
      <div className="lista">{itens.map(([rota, nome, icone]) => <button key={rota} className="navi grande" onClick={() => router.push(rota)}><span className="ico"><Icone nome={icone} extra="duo" /></span><span>{nome}</span></button>)}</div>
    </>
  );
}

// ---------- áreas ainda não construídas (sem dados de exemplo: só dizem o que falta) ----------
export function EmConstrucao({ titulo, sub, icone, texto }: { titulo: string; sub: string; icone: string; texto: string }) {
  return (
    <>
      <CabecaPagina titulo={titulo} sub={sub} />
      <div className="vazio"><Icone nome={icone} extra="grande" /><h3>Em construção</h3><p>{texto}</p></div>
    </>
  );
}
