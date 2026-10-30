'use client';
// Peças das demandas (cards, chips, tarefas) com o mesmo desenho e as mesmas classes do protótipo aprovado.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { useTentativa } from './campos';
import {
  atrasada, corCard, dataCurta, diasAte, diasDesde, diasDesdeInstante, feitas, numeroDe, origemDe, percentual, proximaTarefa, TIPO_COR, titulo, type Demanda, type Tarefa,
} from '@/lib/demandas';

const curto = (n: number) => `${n} d`;
const matiz = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
const AREA_NOME = { Geral: 'geral', Pessoal: 'de pessoal', Compras: 'de compras' } as const;

// origem é opcional: sem origem não aparece nada (nem "Não informada")
export const OrigemP = ({ d }: { d: Demanda }) => (origemDe(d) ? <span className="origem-p"><i className="pt" style={{ '--h': matiz(origemDe(d)) } as React.CSSProperties} />{origemDe(d)}</span> : <span className="origem-p" />);
const Numero = ({ d }: { d: Demanda }) => (numeroDe(d) ? <span className="num mono">{numeroDe(d)}</span> : null);
export const ChipTipo = ({ d }: { d: Demanda }) => (
  <span className="tag" title={d.tipo === 'Processo' || d.tipo === 'Protocolo' ? `${d.tipo} ${AREA_NOME[d.area]}` : undefined} style={{ '--h': TIPO_COR[d.tipo] ?? 212 } as React.CSSProperties}>{d.tipo}</span>
);
const nivelPrazo = (n: number) => (n <= 1 ? ' n-verm' : n <= 3 ? ' n-lar' : n <= 5 ? ' n-amar' : '');
// contagem regressiva: neutra até 6 dias; amarela com 5 e 4; laranja com 3 e 2; vermelha com 1 e no dia; vencido em vermelho vivo. Sem prazo não aparece nada.
export function ChipPrazo({ d }: { d: Demanda }) {
  const { hoje } = useApp();
  if (!d.prazo) return null;
  if (d.etapa === 'Finalizado') return <span className="pz"><Icone nome="calendar" />{dataCurta(d.prazo)}</span>;
  const n = diasAte(d.prazo, hoje);
  if (n < 0) return <span className="pz venc"><Icone nome="calendar" />Prazo vencido</span>;
  return <span className={`pz${nivelPrazo(n)}`}><Icone nome="calendar" />{dataCurta(d.prazo)} · {n === 0 ? 'vence hoje' : `faltam ${curto(n)}`}</span>;
}
export const ChipSelo = ({ d }: { d: Demanda }) => (d.prazo ? <span className={`selo${d.prazo_tipo === 'Legal' ? ' legal' : ''}`}><Icone nome="flag" />{d.prazo_tipo}</span> : null);
function ChipTempo({ d }: { d: Demanda }) {
  const { hoje } = useApp();
  if (!d.prazo || !d.chegou_em) return null; // sem prazo, ou sem a data de chegada, nada é mostrado nem inventado
  if (d.etapa === 'Finalizado' && d.concluida_em) return <span className="tempo mono" title="Da chegada à conclusão"><Icone nome="clock" />Resolvida em {curto(Math.max(0, diasDesde(d.chegou_em, hoje) - diasDesde(d.concluida_em, hoje)))}</span>;
  const n = diasDesde(d.chegou_em, hoje);
  return <span className="tempo mono" title="Desde que chegou"><Icone nome="clock" />{n === 0 ? 'Chegou hoje' : `Chegou há ${curto(n)}`}</span>;
}
// O selo Legal/Próprio saiu do resumo dos cards (poluía); o tipo do prazo continua nos dados, no cadastro, na consulta, nos filtros e na Tabela.
export const ChipsRow = ({ d }: { d: Demanda }) => (d.prazo ? <div className="chips"><ChipPrazo d={d} /><ChipTempo d={d} /></div> : null);

export function BarraProg({ d }: { d: Demanda }) {
  const p = percentual(d);
  return (
    <div className="prog">
      <div className="barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p ?? 0} aria-label="Progresso das tarefas"><i style={{ width: `${p ?? 0}%` }} /></div>
      <b className="mono">{p === null ? '—' : `${feitas(d)}/${d.tarefas.length} · ${p}%`}</b>
    </div>
  );
}

/** Texto de uma tarefa: clicar edita no lugar. Enter ou clicar fora guarda, Esc desiste. Só grava no banco quando mudou. */
export function TextoTarefa({ t }: { t: Tarefa }) {
  const { editarTarefa } = useApp();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(t.texto);
  const ref = useRef<HTMLInputElement>(null);
  const salvando = useRef(false);
  useEffect(() => { if (editando) { ref.current?.focus(); ref.current?.select(); } }, [editando]);
  const guardar = async () => {
    if (salvando.current) return;
    const v = valor.trim();
    if (!v || v === t.texto) { setValor(t.texto); setEditando(false); return; }
    salvando.current = true;
    const r = await editarTarefa(t.id, v);
    salvando.current = false;
    if (r) setEditando(false); else ref.current?.focus(); // se falhou, o aviso já explicou e o texto digitado continua à mão
  };
  if (editando) {
    return (
      <input ref={ref} className="t-ed" value={valor} aria-label="Editar a tarefa" autoComplete="off" onChange={(e) => setValor(e.target.value)} onBlur={() => void guardar()}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardar(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setValor(t.texto); setEditando(false); } }} />
    );
  }
  const abrir = () => { setValor(t.texto); setEditando(true); };
  return <span className={`t-txt${t.concluida ? ' feita' : ''}`} role="button" tabIndex={0} title="Clique para editar" onClick={abrir} onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } }}>{t.texto}</span>;
}

export function ItemTarefa({ t }: { t: Tarefa }) {
  const { marcarTarefa } = useApp();
  return (
    <li className="t-item">
      <input type="checkbox" data-act="tarefa" checked={t.concluida} aria-label={`Concluir a tarefa: ${t.texto}`} onChange={(e) => void marcarTarefa(t.id, e.target.checked)} />
      <TextoTarefa t={t} />
      <button className="t-lapis" aria-label="Editar a tarefa" title="Editar" onClick={(e) => (e.currentTarget.parentElement?.querySelector('.t-txt') as HTMLElement | null)?.click()}><Icone nome="pencil" /></button>
    </li>
  );
}

/** Campo para uma tarefa nova no próprio lugar (verso do card e visão Lista). */
export function NovaTarefaInline({ demandaId, rotulo = '+ Adicionar tarefa' }: { demandaId: string; rotulo?: string }) {
  const { adicionarTarefa } = useApp();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const salvando = useRef(false);
  const tentativa = useTentativa();
  useEffect(() => { if (aberto) ref.current?.focus(); }, [aberto]);
  const guardar = async () => {
    if (salvando.current) return;
    const v = valor.trim();
    if (!v) { setAberto(false); return; }
    salvando.current = true;
    const r = await adicionarTarefa(demandaId, v, tentativa.id(v));
    salvando.current = false;
    if (r) { tentativa.limpar(); setValor(''); setAberto(false); } else ref.current?.focus();
  };
  if (!aberto) return <button onClick={() => setAberto(true)}>{rotulo}</button>;
  return (
    <input ref={ref} className="t-ed" value={valor} placeholder="Nova tarefa" aria-label="Nova tarefa" autoComplete="off" onChange={(e) => setValor(e.target.value)} onBlur={() => void guardar()}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardar(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setValor(''); setAberto(false); } }} />
  );
}

/** O card nunca tem caixa de marcar a demanda: mostra a próxima tarefa (com caixa) ou, sem tarefas pendentes, o botão de concluir em largura total. */
export function AcaoCard({ d }: { d: Demanda }) {
  const { reabrir, concluir, marcarTarefa } = useApp();
  if (d.etapa === 'Finalizado') return <button className="btn fino bloco" onClick={() => void reabrir(d.id)}>Reabrir demanda</button>;
  const t = proximaTarefa(d);
  if (t) {
    return (
      <div className="prox-t">
        <input type="checkbox" data-act="tarefa" checked={t.concluida} aria-label={`Concluir a tarefa: ${t.texto}`} onChange={(e) => void marcarTarefa(t.id, e.target.checked)} />
        <span className="prox-c"><small>Próxima tarefa</small><TextoTarefa t={t} /></span>
      </div>
    );
  }
  return <button className="btn fino pri bloco" onClick={() => void concluir(d.id)}><Icone nome="check" />Concluir demanda</button>;
}

const Desc = ({ d }: { d: Demanda }) => (d.descricao.trim() ? <div className="desc">{d.descricao.trim()}</div> : null);

export function CardDemanda({ d }: { d: Demanda }) {
  const { abrirJanela, arquivar, mover, abrirMenuMover, hoje } = useApp();
  const [fixo, setFixo] = useState<'frente' | 'verso' | undefined>();
  const fin = d.etapa === 'Finalizado';
  const at = atrasada(d, hoje);
  const abrirEd = () => abrirJanela({ t: 'editar', id: d.id });
  const teclaAbrir = (e: KeyboardEvent) => { if (e.key === 'Enter') abrirEd(); };
  const girar = (para: 'frente' | 'verso') => (
    <button className="girar" aria-label={para === 'verso' ? 'Fixar o verso do card' : 'Fixar a frente do card'} title={para === 'verso' ? 'Ver tarefas' : 'Ver a frente'} onClick={() => setFixo(para)}><Icone nome="rotate-cw" /></button>
  );
  const dias = diasDesdeInstante(d.etapa_desde, hoje);
  return (
    <article className={`dcard${at ? ' atrasada' : ''}`} data-fix={fixo} data-id={d.id}>
      <div className="faces">
        <div className={`face front${corCard(d)}`}>
          <div className="cab"><OrigemP d={d} />{girar('verso')}</div>
          <div className="tags">
            <ChipTipo d={d} /><Numero d={d} />
            {fin ? <span className="chip">Finalizada</span> : <span className="chip neutro">{d.etapa}{d.etapa === 'Aguardando retorno' && d.setor ? ` · ${d.setor} ${curto(dias)}` : ''}</span>}
          </div>
          <div className="assunto fit" role="link" tabIndex={0} title={d.assunto} onClick={abrirEd} onKeyDown={teclaAbrir}>{d.assunto}</div>
          <Desc d={d} />
          <ChipsRow d={d} />
          <AcaoCard d={d} />
          <BarraProg d={d} />
        </div>
        <div className="face back">
          <div className="cab"><span className="num mono">{titulo(d)}</span>{girar('frente')}</div>
          {d.tarefas.length ? <ul className="tarefas">{d.tarefas.map((t) => <ItemTarefa key={t.id} t={t} />)}<li className="mais-t" style={{ display: 'none' }} /></ul>
            : <div className="proxima vazia"><span>Nenhuma tarefa cadastrada</span><NovaTarefaInline demandaId={d.id} /></div>}
          <div className="meta">
            <div>Chegou em<b>{d.chegou_em ? dataCurta(d.chegou_em) : 'não informada'}</b></div>
            <div>{fin && d.chegou_em ? 'Resolvida em' : 'Parada há'}<b>{fin && d.chegou_em && d.concluida_em ? curto(Math.max(0, diasDesde(d.chegou_em, hoje) - diasDesde(d.concluida_em, hoje))) : curto(dias)}</b></div>
            <div>Tipo<b>{d.tipo}</b></div>
            {d.setor ? <div>Setor<b>{d.setor} · {dias} dias</b></div> : null}
            {d.acompanhar_em ? <div>Acompanhar em<b>{dataCurta(d.acompanhar_em)}</b></div> : null}
          </div>
          <div className="acoes">
            {d.etapa === 'Cadastro' ? <button className="btn mini" onClick={() => void mover(d.id, 'Vistos')}><Icone nome="eye" />Já vi</button> : null}
            <button className="btn mini so-icone" aria-label="Arquivar" title="Arquivar" onClick={() => void arquivar(d.id)}><Icone nome="archive" /></button>
            <button className="btn mini so-icone" aria-haspopup="menu" aria-label="Mover de etapa" title="Mover de etapa" onClick={(e) => abrirMenuMover(d.id, e.currentTarget)}><Icone nome="arrow-right" /></button>
            <button className="btn mini" aria-label="Editar" title="Editar" onClick={abrirEd}><Icone nome="pencil" />Editar</button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MiniCard({ d }: { d: Demanda }) {
  const { abrirJanela, abrirMenuMover, hoje } = useApp();
  const fin = d.etapa === 'Finalizado';
  const abrirEd = () => abrirJanela({ t: 'editar', id: d.id });
  const dias = diasDesdeInstante(d.etapa_desde, hoje);
  return (
    <article className={`mini-card${corCard(d)}${atrasada(d, hoje) ? ' atrasada' : ''}${fin ? ' feita' : ''}`} data-id={d.id}>
      <div className="m-top"><OrigemP d={d} /><button className="mais" aria-haspopup="menu" aria-label="Mais ações: mover de etapa" title="Mover de etapa" onClick={(e) => abrirMenuMover(d.id, e.currentTarget)}><Icone nome="ellipsis" /></button></div>
      <div className="tags"><ChipTipo d={d} /><Numero d={d} /></div>
      <div className="assunto" role="link" tabIndex={0} onClick={abrirEd} onKeyDown={(e) => { if (e.key === 'Enter') abrirEd(); }}>{d.assunto}</div>
      <Desc d={d} />
      <ChipsRow d={d} />
      {d.setor ? <div className="chips"><span className="chip neutro">{d.setor} · {curto(dias)}</span></div> : null}
      <AcaoCard d={d} />
      <BarraProg d={d} />
    </article>
  );
}

