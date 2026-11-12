'use client';
// Consulta da demanda (decisões 27 e 68): ao abrir um card, a pessoa vê tudo organizado e com rótulos claros. A janela tem três regiões (barra de controles, corpo que rola e rodapé): o corpo começa
// pelo assunto, o documento e o resumo (vencimento efetivo e etapa); depois Tarefas e Descrição na coluna principal e Chegada e prazo, Andamento e Identificação na coluna de consulta (uma coluna só
// quando a janela é estreita, na mesma ordem). É uma única estrutura: nenhum campo, id ou controle é repetido entre as larguras.
// Cada seção tem um lápis: ele abre a edição daquela seção no próprio lugar, com Cancelar (descarta) e Salvar. O cadastro guiado serve só para criar.
// Regras herdadas do desenho aprovado: clicar fora não fecha se há texto novo; Esc, X e Fechar guardam o rascunho; só Cancelar descarta; salvar é atômico no banco e
// recusado (nada gravado, edição local mantida) se a demanda mudou em outro aparelho depois que a edição começou.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { Janela } from './janela-base';
import { OrigemEntrada } from './entradas';
import { ChipEspera, SeloPrioridade } from './cartoes';
import {
  CAMPOS_DA_SECAO, comAtalhoCoerente, CamposChegadaPrazo, CamposIdentificacao, chaveTarefa, Descricao, doCampos, EditorTarefas, mudou, paraDadosSecao, paraEnvio, type Campos, type Secao, type TarefaForm,
} from './campos';
import { atrasada, dataBR, dataCurta, diasAte, diasDesde, diasDesdeInstante, ETAPAS, numeroDe, origemDe, permanencia, plural, temArea, titulo, type DadosDemanda, type Demanda, type Etapa } from '@/lib/demandas';
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
  const [c, setC] = useState<Campos>(() => comAtalhoCoerente({ ...doCampos(d), ...(rasc?.dados as Partial<Campos> | undefined) }, hoje));
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
  // "Adicionar descrição" e "Adicionar tarefa": o mesmo editor do lápis da seção (e a mesma trava: uma seção em edição por vez). O botão some ao abrir, então o foco vai ao primeiro campo da seção.
  const adicionar = (s: Secao, rotulo: string) => (
    <button type="button" className="btn mini" data-adicionar={s} aria-disabled={abertas.length > 0 || undefined} title={abertas.length > 0 ? 'Salve ou cancele a edição aberta antes de editar outra seção' : undefined}
      onClick={() => { if (abertas.length > 0) return; abrir(s); requestAnimationFrame(() => document.querySelector<HTMLElement>(`.modal [data-secao="${s}"] :is(textarea, input:not([type=checkbox]))`)?.focus()); }}><Icone nome="plus" />{rotulo}</button>
  );
  const cancelarSecao = (s: Secao) => {
    const resto = abertas.filter((x) => x !== s);
    setAbertas(resto); setErro('');
    if (!resto.length) { guardarRascunho(chave, null); setConflito(false); }
  };

  const salvarSecao = async (s: Secao) => {
    if (salvando) return;
    if (s === 'identificacao' && !c.assunto.trim()) { setErro('O assunto não pode ficar vazio.'); document.getElementById('d-assunto')?.focus(); return; }
    setSalvando(true); setErro('');
    const dados: DadosDemanda = s === 'tarefas' ? {} : { ...paraDadosSecao(s, c, d), ...(s === 'andamento' && etapa !== d.etapa ? { etapa } : {}) };
    // trocar de etapa começa um novo período de espera: o banco zera o encaminhamento e a reiteração, então eles não vão junto
    if (s === 'andamento' && (etapa !== d.etapa || d.etapa !== 'Aguardando retorno')) { delete dados.encaminhada_em; delete dados.reiterada_em; }
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
  // Vencimento efetivo no resumo: a situação aparece uma vez só, aqui (a linha Vencimento, mais abaixo, fica com a data completa). Vermelho só para demanda aberta e vencida.
  const resumoPrazo = !d.prazo || k === null ? '' : fin ? `Prazo em ${dataCurta(d.prazo)}` : k < 0 ? `Venceu em ${dataCurta(d.prazo)} · há ${plural(-k, 'dia')}` : k === 0 ? `Vence hoje · ${dataCurta(d.prazo)}` : `Vence em ${dataCurta(d.prazo)} · faltam ${plural(k, 'dia')}`;
  const feitas = d.tarefas.filter((t) => t.concluida).length;
  const dias0 = diasDesdeInstante(d.etapa_desde, hoje);
  const documento = d.tipo || numeroDe(d) ? titulo(d) : '';
  const proximaId = d.tarefas.find((t) => !t.concluida)?.id;

  const rodape = conf ? (
    <>
      <span className="data">Excluir de vez? Não dá para desfazer.</span>
      <button className="btn perigo" onClick={async () => { if (await excluir(d.id)) { guardarRascunho(chave, null); fecharJanela(); } }}><Icone nome="trash" />Confirmar exclusão</button>
      <span className="esp" />{/* a chave faz o React montar um botão novo (o rodapé normal tem um botão na mesma posição), para o foco ir de fato à ação menos destrutiva */}<button key="cancelar-exclusao" className="btn" autoFocus onClick={() => { setConf(false); requestAnimationFrame(() => document.querySelector<HTMLElement>('.modal .m-mais')?.focus()); }}>Cancelar</button>
    </>
  ) : (
    <>
      <span className="esp" />
      {sujo ? <span className="data">Salve ou cancele a edição aberta para mudar a etapa.</span> : null}
      <button className="btn" onClick={fecharGuardando}>Fechar</button>
      {fin
        ? <button className="btn pri" disabled={sujo} onClick={async () => { const r = await reabrir(d.id); if (r) { guardarRascunho(chave, null); fecharJanela(); } }}>Reabrir (volta para Fazendo)</button>
        : <button className="btn pri" disabled={sujo} onClick={async () => { const r = await concluir(d.id); if (r) { guardarRascunho(chave, null); fecharJanela(); } }}><Icone nome="check" />Concluir demanda</button>}
    </>
  );

  return (
    <Janela titulo={d.assunto} larga editorial foco={abertas.length ? 'campo' : 'janela'} aoFechar={fecharGuardando} sujo={sujo} rodape={rodape}
      extraCab={conf ? null : <button type="button" className="icbtn-s m-mais" aria-haspopup="menu" aria-expanded={!!menuAcoes} aria-label="Mais ações da demanda: arquivar ou excluir" title="Mais ações" onClick={(e) => { const a = document.querySelector('.app')!.getBoundingClientRect(), b = e.currentTarget.getBoundingClientRect(); setMenuAcoes((m) => (m ? null : { x: b.right - a.left, y: b.bottom - a.top })); }}><Icone nome="ellipsis" /></button>}>
      {recuperado ? <p className="data rec">Rascunho recuperado nas seções abertas. Cancelar descarta as alterações da seção.</p> : null}
      {desatualizada ? (
        <p className="data rec" role="alert" id="m-conflito">
          Esta demanda foi alterada em outro aparelho ou janela depois que você abriu esta edição{versaoBase !== d.versao ? ` (agora ela está em ${d.etapa}, com ${plural(d.tarefas.length, 'tarefa')})` : ''}.
          Nada foi gravado e o que você digitou continua aqui. Salvar fica bloqueado para não apagar o que foi gravado lá. Copie o que precisar e toque em Cancelar na seção (descarta esta edição) para ver a demanda já na versão atual.
        </p>
      ) : null}
      {d.entrada_id ? <OrigemEntrada id={d.entrada_id} /> : null}
      <div className="cons-cab">
        {documento ? <p className="cons-doc" data-documento>{documento}</p> : null}
        <div className="resumo-chips">
          {resumoPrazo ? <span className={`pz cons-venc${atrasada(d, hoje) ? ' venc' : ''}`} data-resumo-prazo><Icone nome="calendar" />{resumoPrazo}</span> : null}
          <span className="chip neutro" data-resumo-etapa>{fin ? 'Finalizada' : d.etapa}</span><ChipEspera d={d} /><SeloPrioridade d={d} />{d.arquivada_em ? <span className="chip neutro">Arquivada</span> : null}
        </div>
      </div>

      <div className="cons-grade">
      <div className="cons-principal">
      <Bloco ctx={ctx} s="tarefas" extra={d.tarefas.length ? <small className="data sec-cont" data-contagem>{feitas} de {d.tarefas.length} concluídas</small> : null} editor={<>{erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{erro}</p> : null}<EditorTarefas tarefas={tarefas} setTarefas={setTarefas} nt={nt} setNt={setNt} /></>}>
        {d.tarefas.length ? (
          <ul className="t-ler">
            {d.tarefas.map((t) => (
              <li key={t.id} data-proxima={t.id === proximaId ? '' : undefined}>
                <input type="checkbox" checked={t.concluida} disabled={abertas.length > 0} title={abertas.length > 0 ? 'Salve ou cancele a edição aberta antes de marcar tarefas' : undefined} aria-label={`Concluir a tarefa: ${t.texto}`} onChange={(e) => void marcarTarefa(t.id, e.target.checked)} />
                <span className={t.concluida ? 'feita' : undefined}>{t.texto}</span>{t.id === proximaId ? <small className="prox-rot">Próxima</small> : null}
              </li>
            ))}
          </ul>
        ) : <div className="cons-add"><span className="data">Nenhuma tarefa cadastrada</span>{adicionar('tarefas', 'Adicionar tarefa')}</div>}
      </Bloco>
      <Bloco ctx={ctx} s="descricao" editor={<Descricao c={c} mudar={mudar} prefixo="d" />}>
        {d.descricao.trim() ? <p className="ler-texto">{d.descricao.trim()}</p> : <div className="cons-add">{adicionar('descricao', 'Adicionar descrição')}</div>}
      </Bloco>
      </div>

      <aside className="cons-consulta" aria-label="Dados da demanda">
      <Bloco ctx={ctx} s="chegada" editor={<CamposChegadaPrazo c={c} mudar={mudar} prefixo="d" hoje={hoje} dias={dias} legado={d.prazo_legado} />}>
        <dl className="ler">
          <Linha rotulo="Chegou em" valor={d.chegou_em ? dataBR(d.chegou_em) : null} />
          {d.chegou_em ? (fin && d.concluida_em ? <><dt>Resolvida em</dt><dd>{plural(Math.max(0, diasDesde(d.chegou_em, d.concluida_em)), 'dia')} (da chegada à conclusão)</dd></> : <><dt>Na Secretaria há</dt><dd>{plural(perm ?? 0, 'dia')} corridos</dd></>) : null}
          <Linha rotulo="Tipo de prazo" valor={d.prazo ? d.prazo_tipo : null} />
          {d.prazo ? (
            <>
              <dt>Vencimento</dt><dd><b>{dataComSemana(d.prazo)}</b></dd>
              {d.prazo_original && d.prazo_original !== d.prazo ? <><dt>Prazo original</dt><dd className="sec">{dataComSemana(d.prazo_original)}</dd><dt>Ajuste</dt><dd className="sec">Antecipado para o dia disponível anterior. Dias pulados: {d.prazo_ajuste}.</dd></> : null}
              {d.prazo_dias && d.prazo_base_em ? <><dt>Contagem</dt><dd className="sec">{d.prazo_dias} dias corridos a partir de {dataBR(d.prazo_base_em)}</dd></> : null}
              {d.prazo_legado ? <><dt>Origem do prazo</dt><dd className="sec">Já existia antes do cálculo por prazo original e foi mantido como referência.</dd></> : null}
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
          {d.etapa === 'Aguardando retorno' && etapa === d.etapa ? (
            <>
              <div className="dois">
                <div className="fld"><label htmlFor="d-enc">Encaminhada em <small className="data">(opcional)</small></label><input id="d-enc" type="date" value={c.encaminhada_em} onChange={(e) => mudar({ encaminhada_em: e.target.value })} /></div>
                <div className="fld"><label htmlFor="d-reit">Retorno reiterado em <small className="data">(opcional)</small></label>
                  <div className="add-t"><input id="d-reit" type="date" value={c.reiterada_em} onChange={(e) => mudar({ reiterada_em: e.target.value })} /><button type="button" className="btn mini" onClick={() => mudar({ reiterada_em: hoje })}>Reiterei hoje</button></div></div>
              </div>
              <span className="data">A Agenda marca o retorno do setor 10 dias corridos depois do encaminhamento (sem a data, depois do dia em que entrou nesta etapa). Só uma reiteração registrada inicia nova contagem. Isso não muda o vencimento nem o campo Acompanhar em.</span>
            </>
          ) : null}
        </>}>
        <dl className="ler">
          <Linha rotulo="Etapa" valor={fin ? 'Finalizada' : d.etapa} />
          <dt>Nesta etapa há</dt><dd>{plural(dias0, 'dia')}</dd>
          {d.setor ? <Linha rotulo="Setor" valor={d.setor} /> : null}
          {d.acompanhar_em ? <Linha rotulo="Acompanhar em" valor={dataBR(d.acompanhar_em)} /> : null}
          {d.etapa === 'Aguardando retorno' && d.encaminhada_em ? <Linha rotulo="Encaminhada em" valor={dataBR(d.encaminhada_em)} /> : null}
          {d.etapa === 'Aguardando retorno' && d.reiterada_em ? <Linha rotulo="Retorno reiterado em" valor={dataBR(d.reiterada_em)} /> : null}
        </dl>
      </Bloco>

      <Bloco ctx={ctx} s="identificacao" editor={<CamposIdentificacao c={c} mudar={mudar} prefixo="d" />}>
        <dl className="ler">
          <Linha rotulo="Origem da solicitação" valor={origemDe(d)} />
          {temArea(d.tipo) ? <Linha rotulo="Área" valor={d.area} /> : null}
          {d.rapida ? <Linha rotulo="Marca" valor="Rápida" /> : null}
        </dl>
      </Bloco>
      </aside>
      </div>

      {menuAcoes ? <MenuAcoes pos={menuAcoes} fechar={() => setMenuAcoes(null)} rotuloArquivar={d.arquivada_em ? 'Arquivada' : 'Arquivar'} bloqueado={sujo} aoArquivar={async () => { setMenuAcoes(null); const r = await arquivar(d.id); if (r) { guardarRascunho(chave, null); fecharJanela(); } }} aoExcluir={() => { setMenuAcoes(null); setConf(true); }} /> : null}
    </Janela>
  );
}

type CtxBloco = { abertas: Secao[]; lapis: (s: Secao) => ReactNode; acoes: (s: Secao) => ReactNode; erro: string };
/** Uma seção da consulta: leitura com o lápis no cabeçalho ou, em edição, o editor com Cancelar e Salvar. Fica fora do componente principal para os campos não perderem o foco a cada tecla. */
function Bloco({ ctx, s, editor, extra, children }: { ctx: CtxBloco; s: Secao; editor: ReactNode; extra?: ReactNode; children: ReactNode }) {
  const editando = ctx.abertas.includes(s);
  return (
    <section className="sec" aria-label={NOME_SECAO[s]} data-secao={s}>
      <div className="sec-h"><h4>{NOME_SECAO[s]}</h4>{editando ? null : extra}{editando ? null : ctx.lapis(s)}</div>
      {editando ? <>{ctx.erro && s !== 'tarefas' ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{ctx.erro}</p> : null}{editor}{ctx.acoes(s)}</> : children}
    </section>
  );
}

/** Menu "⋯" da barra: as ações secundárias da janela. Arquivar segue a regra que o botão do rodapé tinha: bloqueado enquanto há edição não salva (continua focável, para a explicação ser lida). */
function MenuAcoes({ pos, fechar, rotuloArquivar, bloqueado, aoArquivar, aoExcluir }: { pos: { x: number; y: number }; fechar: () => void; rotuloArquivar: string; bloqueado: boolean; aoArquivar: () => void; aoExcluir: () => void }) {
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
      <button type="button" role="menuitem" aria-disabled={bloqueado || undefined} title={bloqueado ? 'Salve ou cancele a edição aberta antes de arquivar' : undefined} onClick={() => { if (!bloqueado) aoArquivar(); }}><Icone nome="archive" />{rotuloArquivar}</button>
      <button type="button" role="menuitem" className="perigo" onClick={aoExcluir}><Icone nome="trash" />Excluir</button>
    </div>, alvo);
}
