'use client';
// Janelas de cadastro e edição de demandas e de nova tarefa, com o desenho e as regras de rascunho do protótipo aprovado:
// clicar fora não fecha se houver texto novo; Esc e X fecham e guardam o rascunho; Cancelar descarta; Salvar grava de forma atômica no banco.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './Icone';
import { useApp } from './contexto';
import {
  AREAS, areasDoTipo, dataBR, diasAte, diasDesde, ETAPAS, hojeISO, plural, PRAZOS, TEM_AREA, TIPOS, type Area, type DadosDemanda, type Demanda, type Etapa, type PrazoTipo, type Tipo,
} from '@/lib/demandas';
import type { TarefaEdicao } from '@/nucleo/operacoes';

const SUGESTAO_DIAS = 30; // padrão do protótipo (Configurações poderá mudar): só sugere, nunca preenche sozinho
const somarDias = (iso: string, n: number) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };

function Janela({ titulo, larga, extraCab, aoFechar, sujo, rodape, children }: { titulo: string; larga?: boolean; extraCab?: ReactNode; aoFechar: () => void; sujo: boolean; rodape: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  useEffect(() => { fechar.current = aoFechar; });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=date]), textarea')?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.mv-menu')) { e.stopImmediatePropagation(); fechar.current(); } };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, []);
  return (
    <div className="modal-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !sujo) aoFechar(); }}>
      <div ref={ref} className={`modal lg${larga ? ' larga' : ''}`} role="dialog" aria-modal="true" aria-labelledby="m-tit">
        <header className="m-h"><h3 id="m-tit">{titulo}</h3><button className="icbtn-s" aria-label="Fechar" onClick={aoFechar}><Icone nome="x" /></button>{extraCab}</header>
        {children}
        <footer className="m-f">{rodape}</footer>
      </div>
    </div>
  );
}

const Grupo = ({ titulo, dica, children }: { titulo: string; dica?: string; children: ReactNode }) => (
  <section className="m-grp"><h4>{titulo}{dica ? <> <small className="data">{dica}</small></> : null}</h4>{children}</section>
);
function Opcoes<T extends string>({ lista, valor, aoEscolher, rotulo }: { lista: readonly T[]; valor: T; aoEscolher: (v: T) => void; rotulo: string }) {
  return <div className="opcoes" role="group" aria-label={rotulo}>{lista.map((o) => <button key={o} type="button" aria-pressed={valor === o} onClick={() => aoEscolher(o)}>{o}</button>)}</div>;
}

type Campos = { assunto: string; numero: string; origem: string; descricao: string; tipo: Tipo; area: Area; chegou_em: string; prazo: string; prazo_tipo: PrazoTipo; setor: string; acompanhar_em: string };
const doCampos = (d: Demanda): Campos => ({ assunto: d.assunto, numero: d.numero, origem: d.origem, descricao: d.descricao, tipo: d.tipo, area: d.area, chegou_em: d.chegou_em, prazo: d.prazo ?? '', prazo_tipo: d.prazo_tipo, setor: d.setor ?? '', acompanhar_em: d.acompanhar_em ?? '' });
const paraDados = (c: Campos): DadosDemanda => ({ assunto: c.assunto, numero: c.numero, origem: c.origem, descricao: c.descricao, tipo: c.tipo, area: c.area, chegou_em: c.chegou_em, prazo: c.prazo || null, prazo_tipo: c.prazo_tipo, setor: c.setor.trim() || null, acompanhar_em: c.acompanhar_em || null });
type TarefaForm = { chave: string; id?: string; texto: string; concluida: boolean };
const chaveTarefa = () => Math.random().toString(36).slice(2);

function CamposPrazo({ c, mudar, prefixo }: { c: Campos; mudar: (p: Partial<Campos>) => void; prefixo: string }) {
  return (
    <>
      <div className="dois">
        <div className="fld"><label htmlFor={`${prefixo}-chegou`}>Chegou em</label><input id={`${prefixo}-chegou`} type="date" value={c.chegou_em} onChange={(e) => mudar({ chegou_em: e.target.value })} /></div>
        <div className="fld"><label>Tipo de prazo</label><Opcoes lista={PRAZOS} valor={c.prazo_tipo} rotulo="Tipo de prazo" aoEscolher={(v) => mudar({ prazo_tipo: v })} /></div>
      </div>
      <div className="fld">
        <label htmlFor={`${prefixo}-prazo`}>Prazo (opcional)</label>
        <div className="add-t">
          <input id={`${prefixo}-prazo`} type="date" value={c.prazo} onChange={(e) => mudar({ prazo: e.target.value })} />
          <button className="btn mini" type="button" onClick={() => mudar({ prazo: somarDias(hojeISO(), SUGESTAO_DIAS) })}>Sugerir {SUGESTAO_DIAS} dias</button>
          {c.prazo ? <button className="btn mini" type="button" onClick={() => mudar({ prazo: '' })}>Sem prazo</button> : null}
        </div>
        {prefixo === 'n' ? <span className="data">{c.prazo ? 'Terá contagem regressiva até a data escolhida.' : 'Sem prazo: nada é inventado. Fica só a contagem do tempo desde a chegada.'}</span> : null}
      </div>
    </>
  );
}

function CamposIdentificacao({ c, mudar, prefixo, nota }: { c: Campos; mudar: (p: Partial<Campos>) => void; prefixo: string; nota?: boolean }) {
  const temArea = TEM_AREA.includes(c.tipo), areas = areasDoTipo(c.tipo);
  return (
    <>
      <div className="fld"><label htmlFor={`${prefixo}-assunto`}>Assunto</label><input id={`${prefixo}-assunto`} value={c.assunto} placeholder="Do que se trata?" maxLength={300} onChange={(e) => mudar({ assunto: e.target.value })} /></div>
      <div className="dois">
        <div className="fld"><label htmlFor={`${prefixo}-num`}>{nota ? 'Número do processo ou memorando' : 'Número'}</label><input id={`${prefixo}-num`} value={c.numero} placeholder={nota ? 'Ex.: 2310/2026' : ''} onChange={(e) => mudar({ numero: e.target.value })} /></div>
        <div className="fld"><label htmlFor={`${prefixo}-origem`}>Origem</label><input id={`${prefixo}-origem`} value={c.origem} placeholder={nota ? 'Quem pediu ou de onde veio' : ''} onChange={(e) => mudar({ origem: e.target.value })} /></div>
      </div>
      <div className="fld"><label>Tipo de documento</label><Opcoes lista={TIPOS} valor={c.tipo} rotulo="Tipo de documento" aoEscolher={(v) => mudar({ tipo: v, area: v === 'Protocolo' && c.area === 'Compras' ? 'Geral' : c.area })} /></div>
      {temArea ? (
        <div className="fld"><label>Área (define a cor do card)</label><Opcoes lista={areas} valor={areas.includes(c.area) ? c.area : 'Geral'} rotulo="Área" aoEscolher={(v) => mudar({ area: v })} />
          {nota ? <span className="data">{c.tipo === 'Protocolo' ? 'Protocolo geral é azul e de pessoal é verde. Amarelo (compras) só em processo aberto pelo setor de compras.' : 'Azul: geral. Verde: pessoal. Amarelo: compras.'}</span> : null}
        </div>
      ) : null}
    </>
  );
}

// ---------- editar ----------
export function JanelaEditar({ id }: { id: string }) {
  const { demandas, arquivadas, rascunhos, guardarRascunho, fecharJanela, salvar, arquivar, excluir, avisar, hoje } = useApp();
  const d = demandas.find((x) => x.id === id) ?? arquivadas?.find((x) => x.id === id);
  if (!d) return null;
  return <EditarInterna key={d.id} d={d} rasc={rascunhos[`d:${d.id}`]} guardarRascunho={guardarRascunho} fechar={fecharJanela} hoje={hoje} salvar={salvar} arquivar={arquivar} excluir={excluir} avisar={avisar} />;
}

function EditarInterna({ d, hoje, rasc, guardarRascunho, fechar, salvar, arquivar, excluir, avisar }: { d: Demanda; hoje: string; rasc?: ReturnType<typeof useApp>['rascunhos'][string]; guardarRascunho: ReturnType<typeof useApp>['guardarRascunho']; fechar: () => void; salvar: ReturnType<typeof useApp>['salvar']; arquivar: ReturnType<typeof useApp>['arquivar']; excluir: ReturnType<typeof useApp>['excluir']; avisar: ReturnType<typeof useApp>['avisar'] }) {
  const base = useMemo(() => ({ c: doCampos(d), t: d.tarefas.map((t) => ({ id: t.id, texto: t.texto, concluida: t.concluida })), etapa: d.etapa }), [d]);
  const [c, setC] = useState<Campos>(() => ({ ...base.c, ...(rasc?.dados as Partial<Campos> | undefined) } as Campos));
  const [tarefas, setTarefas] = useState<TarefaForm[]>(() => (rasc?.tarefas ?? base.t).map((t) => ({ chave: chaveTarefa(), ...t })));
  const [etapa, setEtapa] = useState<Etapa>(d.etapa);
  const [nt, setNt] = useState(rasc?.nt ?? '');
  const [conf, setConf] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Versão da demanda em que esta edição se baseia: a da abertura da janela, ou a do rascunho recuperado (que pode ser mais antiga que a demanda atual).
  // Vai junto no salvamento: se a demanda mudou desde então (outro aparelho ou janela), o banco recusa tudo e esta edição continua aqui, intacta.
  const [versaoBase] = useState(() => rasc?.versao ?? d.versao);
  const [conflito, setConflito] = useState(false);
  const desatualizada = conflito || versaoBase !== d.versao;
  const [menuAcoes, setMenuAcoes] = useState<{ x: number; y: number } | null>(null);
  const mudar = (p: Partial<Campos>) => setC((x) => ({ ...x, ...p }));
  const fin = d.etapa === 'Finalizado';

  const listaEnvio: TarefaEdicao[] = tarefas.filter((t) => t.texto.trim()).map((t) => ({ ...(t.id ? { id: t.id } : {}), texto: t.texto.trim(), concluida: t.concluida }));
  const sujo = JSON.stringify(c) !== JSON.stringify(base.c) || etapa !== base.etapa || nt.trim() !== '' || JSON.stringify(listaEnvio) !== JSON.stringify(base.t.map((t) => ({ id: t.id, texto: t.texto, concluida: t.concluida })));
  const chave = `d:${d.id}`;
  const [recuperado] = useState(!!rasc);
  // Rascunho automático: meio segundo depois da última alteração, e não só ao fechar a janela (recarregar, sessão encerrada ou o sistema fechar o aplicativo não perdem o texto)
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(() => guardarRascunho(chave, { dados: c, tarefas: tarefas.map((x) => ({ id: x.id, texto: x.texto, concluida: x.concluida })), nt, versao: versaoBase }), 500);
    return () => clearTimeout(t);
  }, [sujo, c, tarefas, nt, chave, guardarRascunho, versaoBase]);
  const fecharGuardando = () => { if (sujo) guardarRascunho(chave, { dados: c, tarefas: tarefas.map((t) => ({ id: t.id, texto: t.texto, concluida: t.concluida })), nt, versao: versaoBase }); else guardarRascunho(chave, null); fechar(); };
  const cancelar = () => { guardarRascunho(chave, null); fechar(); };

  const gravar = async (etapaFinal: Etapa | null, msg: string) => {
    if (!c.assunto.trim()) { avisar('O assunto não pode ficar vazio.', true); return; }
    setSalvando(true);
    const pendente = nt.trim() ? [...listaEnvio, { texto: nt.trim(), concluida: false }] : listaEnvio;
    const dados: DadosDemanda = { ...paraDados(c), ...(etapaFinal ? { etapa: etapaFinal } : {}) };
    const r = await salvar(d.id, dados, pendente, versaoBase, msg);
    setSalvando(false);
    if (r.ok) { guardarRascunho(chave, null); fechar(); } else if (r.conflito) setConflito(true);
  };

  const adicionarNt = () => { const v = nt.trim(); if (!v) return; setTarefas((l) => [...l, { chave: chaveTarefa(), texto: v, concluida: false }]); setNt(''); };
  const n = d.prazo ? diasAte(c.prazo || d.prazo, hoje) : null;
  const prazoAtual = c.prazo || null;
  const cont = !prazoAtual ? 'Sem prazo cadastrado' : (() => { const k = diasAte(prazoAtual, hoje); return k < 0 ? `Atrasada há ${plural(-k, 'dia')}` : k === 0 ? 'Vence hoje' : `Faltam ${plural(k, 'dia')}`; })();
  void n;
  const desde = diasDesde(c.chegou_em || d.chegou_em, hoje);
  const feitas = tarefas.filter((t) => t.concluida).length;

  const rodape = conf ? (
    <>
      <span className="data">Excluir de vez? Não dá para desfazer.</span>
      <button className="btn perigo" onClick={async () => { if (await excluir(d.id)) { guardarRascunho(chave, null); fechar(); } }}><Icone nome="trash" />Confirmar exclusão</button>
      <span className="esp" /><button className="btn" onClick={cancelar}>Cancelar</button>
      {fin ? <button className="btn" disabled={salvando || desatualizada} onClick={() => void gravar('Fazendo', 'Reaberta em Fazendo. O histórico foi mantido.')}>Reabrir (volta para Fazendo)</button> : <button className="btn" disabled={salvando || desatualizada} onClick={() => void gravar('Finalizado', 'Demanda finalizada. As tarefas foram marcadas como concluídas.')}><Icone nome="check" />Concluir demanda</button>}
      <button className="btn pri" disabled={salvando || desatualizada} aria-label="Salvar alterações" onClick={() => void gravar(etapa !== base.etapa ? etapa : null, 'Alterações salvas')}>Salvar<span className="rot-ext"> alterações</span></button>
    </>
  ) : (
    <>
      <button className="btn mini m-sec" onClick={async () => { const r = await arquivar(d.id); if (r) { guardarRascunho(chave, null); fechar(); } }}><Icone nome="archive" />{d.arquivada_em ? 'Arquivada' : 'Arquivar'}</button>
      <button className="btn mini m-sec" onClick={() => setConf(true)}><Icone nome="trash" />Excluir</button>
      <span className="esp" /><button className="btn" onClick={cancelar}>Cancelar</button>
      {fin ? <button className="btn" disabled={salvando || desatualizada} onClick={() => void gravar('Fazendo', 'Reaberta em Fazendo. O histórico foi mantido.')}>Reabrir (volta para Fazendo)</button> : <button className="btn" disabled={salvando || desatualizada} onClick={() => void gravar('Finalizado', 'Demanda finalizada. As tarefas foram marcadas como concluídas.')}><Icone nome="check" />Concluir demanda</button>}
      <button className="btn pri" disabled={salvando || desatualizada} aria-label="Salvar alterações" onClick={() => void gravar(etapa !== base.etapa ? etapa : null, 'Alterações salvas')}>Salvar<span className="rot-ext"> alterações</span></button>
    </>
  );

  return (
    <Janela titulo={`${d.tipo} ${d.numero}`} larga aoFechar={fecharGuardando} sujo={sujo} rodape={rodape}
      extraCab={conf ? null : <button type="button" className="icbtn-s m-mais" aria-haspopup="menu" aria-label="Mais ações da demanda: arquivar ou excluir" title="Mais ações" onClick={(e) => { const a = document.querySelector('.app')!.getBoundingClientRect(), b = e.currentTarget.getBoundingClientRect(); setMenuAcoes((m) => (m ? null : { x: b.right - a.left, y: b.bottom - a.top })); }}><Icone nome="ellipsis" /></button>}>
      {recuperado ? <p className="data rec">Rascunho recuperado. Cancelar descarta as alterações.</p> : null}
      {desatualizada ? (
        <p className="data rec" role="alert" id="m-conflito">
          Esta demanda foi alterada em outro aparelho ou janela depois que você abriu esta edição{versaoBase !== d.versao ? ` (agora ela está em ${d.etapa}, com ${plural(d.tarefas.length, 'tarefa')})` : ''}.
          Nada foi gravado e o que você digitou continua aqui. Salvar fica bloqueado para não apagar o que foi gravado lá. Copie o que precisar e toque em Cancelar (descarta esta edição) para abrir a demanda de novo, já na versão atual.
        </p>
      ) : null}
      <div className="m-cols">
        <div>
          <Grupo titulo="Identificação"><CamposIdentificacao c={c} mudar={mudar} prefixo="d" /></Grupo>
          <Grupo titulo="Descrição" dica="opcional"><div className="fld"><label className="sr" htmlFor="d-descricao">Descrição (opcional)</label><textarea id="d-descricao" rows={5} value={c.descricao} placeholder="Explique do que se trata, sem sobrecarregar o assunto" onChange={(e) => mudar({ descricao: e.target.value })} /></div></Grupo>
          <Grupo titulo="Andamento">
            <div className="fld"><label htmlFor="d-etapa">Etapa</label><select id="d-etapa" value={etapa} onChange={(e) => setEtapa(e.target.value as Etapa)}>{ETAPAS.map((e) => <option key={e}>{e}</option>)}</select></div>
            {etapa === 'Aguardando retorno' || c.setor || c.acompanhar_em ? (
              <div className="dois">
                <div className="fld"><label htmlFor="d-setor">Setor</label><input id="d-setor" value={c.setor} onChange={(e) => mudar({ setor: e.target.value })} /></div>
                <div className="fld"><label htmlFor="d-ac">Acompanhar em</label><input id="d-ac" type="date" value={c.acompanhar_em} onChange={(e) => mudar({ acompanhar_em: e.target.value })} /></div>
              </div>
            ) : null}
          </Grupo>
        </div>
        <div>
          <Grupo titulo="Datas e prazo">
            <CamposPrazo c={c} mudar={mudar} prefixo="d" />
            <div className="meta calc" role="group" aria-label="Calculado automaticamente">
              <div>Prazo<b>{cont}</b></div>
              <div>{fin && d.concluida_em ? 'Resolvida em' : 'Desde a chegada'}<b>{fin && d.concluida_em ? Math.max(0, desde - diasDesde(d.concluida_em, hoje)) : desde} d</b></div>
            </div>
          </Grupo>
          <Grupo titulo="Tarefas" dica="toque no texto para alterar">
            {tarefas.length ? (
              <ul className="tarefas ed">
                {tarefas.map((t, i) => (
                  <li key={t.chave} className="t-item">
                    <input type="checkbox" checked={t.concluida} aria-label={`Concluir a tarefa ${i + 1}`} onChange={(e) => setTarefas((l) => l.map((x) => (x.chave === t.chave ? { ...x, concluida: e.target.checked } : x)))} />
                    <input className={`t-campo${t.concluida ? ' feita' : ''}`} value={t.texto} aria-label={`Texto da tarefa ${i + 1}`} autoComplete="off" onChange={(e) => setTarefas((l) => l.map((x) => (x.chave === t.chave ? { ...x, texto: e.target.value } : x)))} />
                    <button className="t-lapis" aria-label={`Remover a tarefa ${i + 1}`} title="Remover" onClick={() => setTarefas((l) => l.filter((x) => x.chave !== t.chave))}><Icone nome="trash" /></button>
                  </li>
                ))}
              </ul>
            ) : <div className="proxima vazia"><span>Nenhuma tarefa cadastrada</span></div>}
            <div className="add-t">
              <input id="m-nt" value={nt} placeholder="Nova tarefa" aria-label="Nova tarefa" onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarNt(); } }} />
              <button className="btn mini" type="button" onClick={adicionarNt}><Icone nome="plus" />Adicionar</button>
            </div>
            <p className="data m-prog">{tarefas.length ? `${feitas} de ${tarefas.length} concluídas (${Math.round((100 * feitas) / tarefas.length)}%). ` : 'Nenhuma tarefa ainda. '}O percentual mede só as tarefas. Concluir todas não muda a etapa sozinho.</p>
          </Grupo>
        </div>
      </div>
      {menuAcoes ? <MenuAcoes pos={menuAcoes} fechar={() => setMenuAcoes(null)} aoArquivar={async () => { setMenuAcoes(null); const r = await arquivar(d.id); if (r) { guardarRascunho(chave, null); fechar(); } }} aoExcluir={() => { setMenuAcoes(null); setConf(true); }} /> : null}
    </Janela>
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

// ---------- nova demanda ----------
export function JanelaNova({ etapa }: { etapa?: Etapa }) {
  const { rascunhos, guardarRascunho, fecharJanela, criar } = useApp();
  const rasc = rascunhos['nova'];
  const vazio: Campos = { assunto: '', numero: '', origem: '', descricao: '', tipo: 'Processo', area: 'Geral', chegou_em: hojeISO(), prazo: '', prazo_tipo: 'Próprio', setor: '', acompanhar_em: '' };
  const [c, setC] = useState<Campos>(() => ({ ...vazio, ...(rasc?.dados as Partial<Campos> | undefined) }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [recuperado] = useState(!!rasc);
  const mudar = (p: Partial<Campos>) => setC((x) => ({ ...x, ...p }));
  const sujo = !!(c.assunto || c.numero || c.origem || c.descricao || c.prazo);
  // rascunho automático (ver a janela de edição)
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(() => guardarRascunho('nova', { dados: c }), 500);
    return () => clearTimeout(t);
  }, [sujo, c, guardarRascunho]);
  const fecharGuardando = () => { guardarRascunho('nova', sujo ? { dados: c } : null); fecharJanela(); };
  const cancelar = () => { guardarRascunho('nova', null); fecharJanela(); };
  const cadastrar = async () => {
    if (!c.assunto.trim()) { setErro('Informe o assunto da demanda.'); document.getElementById('n-assunto')?.focus(); return; }
    setErro(''); setSalvando(true);
    const r = await criar({ ...paraDados(c), ...(etapa ? { etapa } : {}) });
    setSalvando(false);
    if (r) { guardarRascunho('nova', null); fecharJanela(); }
  };
  return (
    <Janela titulo={etapa && etapa !== 'Cadastro' ? `Nova demanda em ${etapa}` : 'Nova demanda'} aoFechar={fecharGuardando} sujo={sujo}
      rodape={<><span className="data">Rascunho guardado automaticamente</span><span className="esp" /><button className="btn" onClick={cancelar}>Cancelar</button><button className="btn pri" disabled={salvando} onClick={() => void cadastrar()}>Cadastrar</button></>}>
      {recuperado ? <p className="data rec">Rascunho recuperado. Cancelar descarta o texto.</p> : null}
      <p className="data">Cadastro rápido. Só o assunto é obrigatório.</p>
      {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{erro}</p> : null}
      <Grupo titulo="Identificação"><CamposIdentificacao c={c} mudar={mudar} prefixo="n" nota /></Grupo>
      <Grupo titulo="Descrição" dica="opcional"><div className="fld"><label className="sr" htmlFor="n-descricao">Descrição (opcional)</label><textarea id="n-descricao" rows={4} value={c.descricao} placeholder="Explique do que se trata, sem sobrecarregar o assunto" onChange={(e) => mudar({ descricao: e.target.value })} /></div></Grupo>
      <Grupo titulo="Datas e prazo"><CamposPrazo c={c} mudar={mudar} prefixo="n" /></Grupo>
    </Janela>
  );
}

// ---------- nova tarefa (menu "+") ----------
export function JanelaTarefa() {
  const { demandas, rascunhos, guardarRascunho, fecharJanela, adicionarTarefa } = useApp();
  const rasc = rascunhos['tarefa'];
  const abertas = demandas.filter((d) => d.etapa !== 'Finalizado');
  const [dem, setDem] = useState<string>(((rasc?.dados as { dem?: string } | undefined)?.dem) ?? abertas[0]?.id ?? '');
  const [texto, setTexto] = useState(rasc?.nt ?? '');
  const [salvando, setSalvando] = useState(false);
  const sujo = !!texto.trim();
  // rascunho automático (ver a janela de edição)
  useEffect(() => {
    if (!sujo) return;
    const t = setTimeout(() => guardarRascunho('tarefa', { dados: { assunto: '' }, nt: texto }), 500);
    return () => clearTimeout(t);
  }, [sujo, texto, guardarRascunho]);
  const fecharGuardando = () => { guardarRascunho('tarefa', sujo ? { dados: { assunto: '' }, nt: texto } : null); fecharJanela(); };
  const cancelar = () => { guardarRascunho('tarefa', null); fecharJanela(); };
  const adicionar = async () => { if (!dem || !texto.trim()) return; setSalvando(true); const r = await adicionarTarefa(dem, texto.trim()); setSalvando(false); if (r) { guardarRascunho('tarefa', null); fecharJanela(); } };
  return (
    <Janela titulo="Nova tarefa" aoFechar={fecharGuardando} sujo={sujo}
      rodape={<><span className="esp" /><button className="btn" onClick={cancelar}>Cancelar</button><button className="btn pri" disabled={salvando || !dem || !texto.trim()} onClick={() => void adicionar()}>Adicionar</button></>}>
      {abertas.length ? (
        <>
          <div className="fld"><label htmlFor="t-dem">Em qual demanda?</label><select id="t-dem" value={dem} onChange={(e) => setDem(e.target.value)}>{abertas.map((d) => <option key={d.id} value={d.id}>{`${d.numero} · ${d.assunto}`}</option>)}</select></div>
          <div className="fld"><label htmlFor="t-texto">Tarefa</label><input id="t-texto" value={texto} placeholder="O que precisa ser feito?" onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar(); } }} /></div>
        </>
      ) : <p className="data">Não há demanda em aberto. Cadastre uma demanda antes de adicionar tarefas.</p>}
    </Janela>
  );
}

export function Janelas() {
  const { janela } = useApp();
  if (!janela) return null;
  if (janela.t === 'editar') return <JanelaEditar id={janela.id} />;
  if (janela.t === 'nova') return <JanelaNova etapa={janela.etapa} />;
  return <JanelaTarefa />;
}
export { AREAS, dataBR };
