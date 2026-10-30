'use client';
// Consulta da demanda (decisão 27): ao abrir um card, a pessoa vê tudo organizado e com rótulos claros, numa única janela com rolagem vertical.
// Cada seção tem um lápis: ele abre a edição daquela seção no próprio lugar, com Cancelar (descarta) e Salvar. O cadastro guiado serve só para criar.
// Regras herdadas do desenho aprovado: clicar fora não fecha se há texto novo; Esc, X e Fechar guardam o rascunho; só Cancelar descarta; salvar é atômico no banco e
// recusado (nada gravado, edição local mantida) se a demanda mudou em outro aparelho depois que a edição começou.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { Janela } from './janela-base';
import { OrigemEntrada } from './entradas';
import { ChipPrazo, ChipSelo } from './cartoes';
import {
  CAMPOS_DA_SECAO, CamposChegadaPrazo, CamposIdentificacao, chaveTarefa, Descricao, doCampos, EditorTarefas, mudou, paraDadosSecao, paraEnvio, type Campos, type Secao, type TarefaForm,
} from './campos';
import { dataBR, diasAte, diasDesde, diasDesdeInstante, ETAPAS, numeroDe, origemDe, permanencia, plural, TEM_AREA, titulo, type Demanda, type Etapa } from '@/lib/demandas';
import { dataComSemana } from '@/lib/prazos';
import type { TarefaEdicao } from '@/nucleo/operacoes';

const NOME_SECAO: Record<Secao, string> = { identificacao: 'Identificação', descricao: 'Descrição', chegada: 'Chegada e prazo', andamento: 'Andamento', tarefas: 'Tarefas' };

export function JanelaDemanda({ id }: { id: string }) {
  const { demandas, arquivadas, carregando, carregarArquivadas, fecharJanela, avisar } = useApp();
  const d = demandas.find((x) => x.id === id) ?? arquivadas?.find((x) => x.id === id);
  // Sem a demanda a janela ficaria aberta e invisível (e a releitura ao voltar à tela ficaria suspensa): lê as arquivadas se ainda não foram lidas e, não achando, fecha com aviso.
  useEffect(() => {
    if (d) return;
    if (arquivadas === null) { void carregarArquivadas(); return; }
    if (!carregando) { fecharJanela(); avisar('Esta demanda não existe mais.', true); }
  }, [d, arquivadas, carregando, carregarArquivadas, fecharJanela, avisar]);
  if (!d) return null;
  return <Detalhe key={d.id} d={d} />;
}

const Linha = ({ rotulo, valor, longo }: { rotulo: string; valor: string | null | undefined; longo?: boolean }) => (
  <><dt>{rotulo}</dt><dd className={`${valor ? '' : 'vazio'}${longo ? ' longo' : ''}`.trim() || undefined}>{valor || 'Não informado'}</dd></>
);

function Detalhe({ d }: { d: Demanda }) {
  const { rascunhos, guardarRascunho, fecharJanela, salvar, arquivar, excluir, concluir, reabrir, marcarTarefa, hoje, dias } = useApp();
  const chave = `d:${d.id}`;
  const rasc = rascunhos[chave];
  const [c, setC] = useState<Campos>(() => ({ ...doCampos(d), ...(rasc?.dados as Partial<Campos> | undefined) }));
  const [tarefas, setTarefas] = useState<TarefaForm[]>(() => (rasc?.tarefas ?? d.tarefas.map((t) => ({ id: t.id, texto: t.texto, concluida: t.concluida }))).map((t) => ({ chave: chaveTarefa(), ...t })));
  const [nt, setNt] = useState(rasc?.nt ?? '');
  const [etapa, setEtapa] = useState<Etapa>((rasc?.dados as { etapa?: Etapa } | undefined)?.etapa ?? d.etapa);
  const [abertas, setAbertas] = useState<Secao[]>(() => (rasc?.secoes as Secao[] | undefined) ?? []);
  // Versão em que as edições abertas se baseiam: a da abertura, ou a do rascunho recuperado (que pode ser mais antiga que a demanda atual). Vai junto no salvamento.
  const [versaoBase, setVersaoBase] = useState(() => rasc?.versao ?? d.versao);
  const [conflito, setConflito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [conf, setConf] = useState(false);
  const [menuAcoes, setMenuAcoes] = useState<{ x: number; y: number } | null>(null);
  const [recuperado] = useState(!!rasc && (rasc.secoes?.length ?? 0) > 0);
  const original = useMemo(() => doCampos(d), [d]);
  const fin = d.etapa === 'Finalizado';
  const desatualizada = abertas.length > 0 && (conflito || versaoBase !== d.versao);
  const mudar = (p: Partial<Campos>) => { setC((x) => ({ ...x, ...p })); if (erro) setErro(''); };

  const lista: TarefaEdicao[] = [...paraEnvio(tarefas), ...(nt.trim() ? [{ texto: nt.trim(), concluida: false }] : [])];
  const listaOriginal = d.tarefas.map((t) => ({ id: t.id, texto: t.texto, concluida: t.concluida }));
  const suja = (s: Secao) => !abertas.includes(s) ? false : s === 'tarefas' ? JSON.stringify(lista) !== JSON.stringify(listaOriginal) : s === 'andamento' ? (mudou(c, original, CAMPOS_DA_SECAO.andamento) || etapa !== d.etapa) : mudou(c, original, CAMPOS_DA_SECAO[s]);
  const sujo = abertas.some(suja);

  // rascunho automático, meio segundo depois da última alteração (recarregar, sessão encerrada ou o sistema fechar o aplicativo não perdem o texto)
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(() => guardarRascunho(chave, { dados: { ...c, etapa }, tarefas: abertas.includes('tarefas') ? lista : undefined, nt: '', versao: versaoBase, secoes: abertas }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sujo, c, etapa, tarefas, nt, abertas, versaoBase, chave, guardarRascunho]);

  const fecharGuardando = () => {
    if (sujo) guardarRascunho(chave, { dados: { ...c, etapa }, tarefas: abertas.includes('tarefas') ? lista : undefined, nt: '', versao: versaoBase, secoes: abertas });
    else guardarRascunho(chave, null);
    fecharJanela();
  };

  const abrir = (s: Secao) => {
    if (abertas.length === 0) { setVersaoBase(d.versao); setConflito(false); }
    if (s === 'tarefas') { setTarefas(d.tarefas.map((t) => ({ chave: chaveTarefa(), id: t.id, texto: t.texto, concluida: t.concluida }))); setNt(''); }
    else if (s === 'andamento') { setEtapa(d.etapa); setC((x) => ({ ...x, setor: original.setor, acompanhar_em: original.acompanhar_em })); }
    else setC((x) => ({ ...x, ...Object.fromEntries(CAMPOS_DA_SECAO[s].map((k) => [k, original[k]])) }));
    setErro(''); setAbertas((l) => [...l, s]);
  };
  const cancelarSecao = (s: Secao) => {
    const resto = abertas.filter((x) => x !== s);
    setAbertas(resto); setErro('');
    if (!resto.length) { guardarRascunho(chave, null); setConflito(false); }
  };

  const salvarSecao = async (s: Secao) => {
    if (salvando) return;
    if (s === 'identificacao' && !c.assunto.trim()) { setErro('O assunto não pode ficar vazio.'); document.getElementById('d-assunto')?.focus(); return; }
    setSalvando(true); setErro('');
    const dados = s === 'tarefas' ? {} : { ...paraDadosSecao(s, c, d), ...(s === 'andamento' && etapa !== d.etapa ? { etapa } : {}) };
    const r = await salvar(d.id, dados, s === 'tarefas' ? lista : null, versaoBase, `${NOME_SECAO[s]}: alterações salvas`);
    setSalvando(false);
    if (r.ok) {
      setVersaoBase(r.demanda.versao);
      if (s === 'tarefas') setNt('');
      const resto = abertas.filter((x) => x !== s);
      setAbertas(resto);
      if (!resto.length) guardarRascunho(chave, null);
    } else if (r.conflito) setConflito(true);
  };

  const outraAberta = abertas.length > 0;
  const lapis = (s: Secao) => (
    <button type="button" className="icbtn-s" aria-label={`Editar ${NOME_SECAO[s].toLowerCase()}`} title={outraAberta ? 'Salve ou cancele a edição aberta antes de editar outra seção' : `Editar ${NOME_SECAO[s].toLowerCase()}`} aria-disabled={outraAberta || undefined} data-lapis={s}
      onClick={() => { if (!outraAberta) abrir(s); }}><Icone nome="pencil" /></button>
  );
  const acoesSecao = (s: Secao) => (
    <div className="sec-acoes">
      <button type="button" className="btn mini" disabled={salvando} onClick={() => cancelarSecao(s)}>Cancelar</button>
      <button type="button" className="btn mini pri" disabled={salvando || desatualizada} data-salvar={s} onClick={() => void salvarSecao(s)}>{salvando ? 'Salvando...' : 'Salvar'}</button>
    </div>
  );
  const ctx = { abertas, lapis, acoes: acoesSecao, erro };

  // ---------- leitura ----------
  const perm = permanencia(d, hoje);
  const k = d.prazo ? diasAte(d.prazo, hoje) : null;
  const situacaoPrazo = k === null ? '' : fin ? '' : k < 0 ? ` (vencida há ${plural(-k, 'dia')})` : k === 0 ? ' (vence hoje)' : ` (faltam ${plural(k, 'dia')})`;
  const dias0 = diasDesdeInstante(d.etapa_desde, hoje);

  const rodape = conf ? (
    <>
      <span className="data">Excluir de vez? Não dá para desfazer.</span>
      <button className="btn perigo" onClick={async () => { if (await excluir(d.id)) { guardarRascunho(chave, null); fecharJanela(); } }}><Icone nome="trash" />Confirmar exclusão</button>
      <span className="esp" /><button className="btn" onClick={() => setConf(false)}>Cancelar</button>
    </>
  ) : (
    <>
      <button className="btn mini m-sec" disabled={sujo} onClick={async () => { const r = await arquivar(d.id); if (r) { guardarRascunho(chave, null); fecharJanela(); } }}><Icone nome="archive" />{d.arquivada_em ? 'Arquivada' : 'Arquivar'}</button>
      <button className="btn mini m-sec" onClick={() => setConf(true)}><Icone nome="trash" />Excluir</button>
      <span className="esp" />
      {sujo ? <span className="data">Salve ou cancele a edição aberta para mudar a etapa.</span> : null}
      <button className="btn" onClick={fecharGuardando}>Fechar</button>
      {fin
        ? <button className="btn pri" disabled={sujo} onClick={async () => { const r = await reabrir(d.id); if (r) { guardarRascunho(chave, null); fecharJanela(); } }}>Reabrir (volta para Fazendo)</button>
        : <button className="btn pri" disabled={sujo} onClick={async () => { const r = await concluir(d.id); if (r) { guardarRascunho(chave, null); fecharJanela(); } }}><Icone nome="check" />Concluir demanda</button>}
    </>
  );

  return (
    <Janela titulo={titulo(d)} larga aoFechar={fecharGuardando} sujo={sujo} rodape={rodape}
      extraCab={conf ? null : <button type="button" className="icbtn-s m-mais" aria-haspopup="menu" aria-label="Mais ações da demanda: arquivar ou excluir" title="Mais ações" onClick={(e) => { const a = document.querySelector('.app')!.getBoundingClientRect(), b = e.currentTarget.getBoundingClientRect(); setMenuAcoes((m) => (m ? null : { x: b.right - a.left, y: b.bottom - a.top })); }}><Icone nome="ellipsis" /></button>}>
      {recuperado ? <p className="data rec">Rascunho recuperado nas seções abertas. Cancelar descarta as alterações da seção.</p> : null}
      {desatualizada ? (
        <p className="data rec" role="alert" id="m-conflito">
          Esta demanda foi alterada em outro aparelho ou janela depois que você abriu esta edição{versaoBase !== d.versao ? ` (agora ela está em ${d.etapa}, com ${plural(d.tarefas.length, 'tarefa')})` : ''}.
          Nada foi gravado e o que você digitou continua aqui. Salvar fica bloqueado para não apagar o que foi gravado lá. Copie o que precisar e toque em Cancelar na seção (descarta esta edição) para ver a demanda já na versão atual.
        </p>
      ) : null}
      {d.entrada_id ? <OrigemEntrada id={d.entrada_id} /> : null}
      <div className="resumo-chips"><span className="chip neutro">{fin ? 'Finalizada' : d.etapa}</span><ChipPrazo d={d} /><ChipSelo d={d} />{d.arquivada_em ? <span className="chip neutro">Arquivada</span> : null}</div>

      <Bloco ctx={ctx} s="identificacao" editor={<CamposIdentificacao c={c} mudar={mudar} prefixo="d" />}>
        <dl className="ler">
          <dt>Assunto</dt><dd><b>{d.assunto}</b></dd>
          <Linha rotulo="Tipo" valor={d.tipo} />
          {TEM_AREA.includes(d.tipo) ? <Linha rotulo="Área" valor={d.area} /> : null}
          <Linha rotulo="Número" valor={numeroDe(d)} />
          <Linha rotulo="Origem" valor={origemDe(d)} />
        </dl>
      </Bloco>

      <Bloco ctx={ctx} s="descricao" editor={<Descricao c={c} mudar={mudar} prefixo="d" />}>
        <p className={`ler-texto${d.descricao.trim() ? '' : ' vazio'}`}>{d.descricao.trim() || 'Sem descrição'}</p>
      </Bloco>

      <Bloco ctx={ctx} s="chegada" editor={<CamposChegadaPrazo c={c} mudar={mudar} prefixo="d" hoje={hoje} dias={dias} legado={d.prazo_legado} />}>
        <dl className="ler">
          <Linha rotulo="Chegou em" valor={d.chegou_em ? dataBR(d.chegou_em) : null} />
          {d.chegou_em ? (fin && d.concluida_em ? <><dt>Resolvida em</dt><dd>{plural(Math.max(0, diasDesde(d.chegou_em, d.concluida_em)), 'dia')} (da chegada à conclusão)</dd></> : <><dt>Na Secretaria há</dt><dd>{plural(perm ?? 0, 'dia')} corridos</dd></>) : null}
          <Linha rotulo="Tipo de prazo" valor={d.prazo ? d.prazo_tipo : null} />
          {d.prazo ? (
            <>
              <dt>Vencimento</dt><dd><b>{dataComSemana(d.prazo)}</b>{situacaoPrazo}</dd>
              {d.prazo_original && d.prazo_original !== d.prazo ? <><dt>Prazo original</dt><dd>{dataComSemana(d.prazo_original)}</dd><dt>Ajuste</dt><dd>Antecipado para o dia disponível anterior. Dias pulados: {d.prazo_ajuste}.</dd></> : null}
              {d.prazo_dias && d.prazo_base_em ? <><dt>Contagem</dt><dd>{d.prazo_dias} dias corridos a partir de {dataBR(d.prazo_base_em)}</dd></> : null}
              {d.prazo_legado ? <><dt>Origem do prazo</dt><dd>Já existia antes do cálculo por prazo original e foi mantido como referência.</dd></> : null}
            </>
          ) : <><dt>Vencimento</dt><dd className="vazio">Sem prazo</dd></>}
        </dl>
      </Bloco>

      <Bloco ctx={ctx} s="andamento" editor={
        <>
          <div className="fld"><label htmlFor="d-etapa">Etapa</label><select id="d-etapa" value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)}>{ETAPAS.map((e) => <option key={e}>{e}</option>)}</select></div>
          <div className="dois">
            <div className="fld"><label htmlFor="d-setor">Setor <small className="data">(opcional)</small></label><input id="d-setor" value={c.setor} onChange={(e) => mudar({ setor: e.target.value })} /></div>
            <div className="fld"><label htmlFor="d-ac">Acompanhar em <small className="data">(opcional)</small></label><input id="d-ac" type="date" value={c.acompanhar_em} onChange={(e) => mudar({ acompanhar_em: e.target.value })} /></div>
          </div>
        </>}>
        <dl className="ler">
          <Linha rotulo="Etapa" valor={fin ? 'Finalizada' : d.etapa} />
          <dt>Nesta etapa há</dt><dd>{plural(dias0, 'dia')}</dd>
          {d.setor ? <Linha rotulo="Setor" valor={d.setor} /> : null}
          {d.acompanhar_em ? <Linha rotulo="Acompanhar em" valor={dataBR(d.acompanhar_em)} /> : null}
        </dl>
      </Bloco>

      <Bloco ctx={ctx} s="tarefas" editor={<>{erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{erro}</p> : null}<EditorTarefas tarefas={tarefas} setTarefas={setTarefas} nt={nt} setNt={setNt} /></>}>
        {d.tarefas.length ? (
          <ul className="t-ler">
            {d.tarefas.map((t) => (
              <li key={t.id}>
                <input type="checkbox" checked={t.concluida} disabled={abertas.length > 0} title={abertas.length > 0 ? 'Salve ou cancele a edição aberta antes de marcar tarefas' : undefined} aria-label={`Concluir a tarefa: ${t.texto}`} onChange={(e) => void marcarTarefa(t.id, e.target.checked)} />
                <span className={t.concluida ? 'feita' : undefined}>{t.texto}</span>
              </li>
            ))}
          </ul>
        ) : <div className="proxima vazia"><span>Nenhuma tarefa cadastrada</span></div>}
        <p className="data m-prog">{d.tarefas.length ? `${d.tarefas.filter((t) => t.concluida).length} de ${d.tarefas.length} concluídas. ` : ''}Toque no lápis para adicionar, alterar ou remover tarefas.</p>
      </Bloco>
      {menuAcoes ? <MenuAcoes pos={menuAcoes} fechar={() => setMenuAcoes(null)} aoArquivar={async () => { setMenuAcoes(null); const r = await arquivar(d.id); if (r) { guardarRascunho(chave, null); fecharJanela(); } }} aoExcluir={() => { setMenuAcoes(null); setConf(true); }} /> : null}
    </Janela>
  );
}

type CtxBloco = { abertas: Secao[]; lapis: (s: Secao) => ReactNode; acoes: (s: Secao) => ReactNode; erro: string };
/** Uma seção da consulta: leitura com o lápis no cabeçalho ou, em edição, o editor com Cancelar e Salvar. Fica fora do componente principal para os campos não perderem o foco a cada tecla. */
function Bloco({ ctx, s, editor, children }: { ctx: CtxBloco; s: Secao; editor: ReactNode; children: ReactNode }) {
  const editando = ctx.abertas.includes(s);
  return (
    <section className="sec" aria-label={NOME_SECAO[s]} data-secao={s}>
      <div className="sec-h"><h4>{NOME_SECAO[s]}</h4>{editando ? null : ctx.lapis(s)}</div>
      {editando ? <>{ctx.erro && s !== 'tarefas' ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{ctx.erro}</p> : null}{editor}{ctx.acoes(s)}</> : children}
    </section>
  );
}

function MenuAcoes({ pos, fechar, aoArquivar, aoExcluir }: { pos: { x: number; y: number }; fechar: () => void; aoArquivar: () => void; aoExcluir: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const app = document.querySelector('.app')!.getBoundingClientRect(), w = m.offsetWidth;
    m.style.left = `${Math.min(Math.max(8, pos.x - w), app.width - w - 8)}px`; m.style.top = `${pos.y + 6}px`;
    m.querySelector<HTMLElement>('button')?.focus();
    const fora = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.('.mv-menu') && !t.closest?.('.m-mais')) fechar(); };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); fechar(); (document.querySelector('.m-mais') as HTMLElement | null)?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const b = Array.from(m.querySelectorAll<HTMLElement>('button')), i = b.indexOf(document.activeElement as HTMLElement); b[(i + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length]?.focus(); }
    };
    document.addEventListener('click', fora, true); document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('click', fora, true); document.removeEventListener('keydown', tecla, true); };
  }, [pos, fechar]);
  const alvo = document.querySelector('.app');
  if (!alvo) return null;
  return createPortal(
    <div ref={ref} className="mv-menu" role="menu" aria-label="Ações da demanda">
      <button type="button" role="menuitem" onClick={aoArquivar}><Icone nome="archive" />Arquivar</button>
      <button type="button" role="menuitem" className="perigo" onClick={aoExcluir}><Icone nome="trash" />Excluir</button>
    </div>, alvo);
}
