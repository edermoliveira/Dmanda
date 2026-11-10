'use client';
// Campos compartilhados do cadastro guiado e da consulta da demanda: identificação, chegada e prazo (com a prévia do vencimento ajustado) e o editor de tarefas.
// Só o assunto é obrigatório. Número, origem, descrição, chegada e prazo são opcionais e nunca são preenchidos por conta própria.
import { useState, type ReactNode } from 'react';
import { Icone } from './Icone';
import { Opcoes } from './janela-base';
import { SeletorOpcao } from './seletor';
import {
  areasDoTipo, dataBR, diasAte, numeroDe, origemDe, permanencia, plural, PRAZOS, temArea, type Area, type DadosDemanda, type Demanda, type PrazoTipo,
} from '@/lib/demandas';
import { ajustarPrazo, BOTOES_PRAZO, dadosDoPrazo as dadosDoPrazoDe, dataComSemana, normalizarAtalho, prazoPorDias, type DiaIndisponivel } from '@/lib/prazos';
import type { TarefaEdicao } from '@/nucleo/operacoes';

export type Campos = {
  assunto: string; numero: string; origem: string; descricao: string; tipo: string; area: Area; rapida: boolean;
  chegou_em: string; prazo_original: string; prazo_dias: number | null; /** O dia em que o botão de dias foi escolhido (vazio = prazo escolhido à mão). */ prazo_base_em: string; prazo_tipo: PrazoTipo;
  setor: string; acompanhar_em: string; encaminhada_em: string; reiterada_em: string;
};
export const CAMPOS_VAZIOS: Campos = { assunto: '', numero: '', origem: '', descricao: '', tipo: '', area: 'Geral', rapida: false, chegou_em: '', prazo_original: '', prazo_dias: null, prazo_base_em: '', prazo_tipo: 'Próprio', setor: '', acompanhar_em: '', encaminhada_em: '', reiterada_em: '' };

export const doCampos = (d: Demanda): Campos => ({
  assunto: d.assunto, numero: numeroDe(d), origem: origemDe(d), descricao: d.descricao, tipo: d.tipo ?? '', area: d.area, rapida: d.rapida,
  chegou_em: d.chegou_em ?? '', prazo_original: d.prazo_original ?? '', prazo_dias: d.prazo_dias, prazo_base_em: d.prazo_dias !== null ? d.prazo_base_em ?? '' : '', prazo_tipo: d.prazo_tipo, setor: d.setor ?? '', acompanhar_em: d.acompanhar_em ?? '', encaminhada_em: d.encaminhada_em ?? '', reiterada_em: d.reiterada_em ?? '',
});

export type Secao = 'identificacao' | 'descricao' | 'chegada' | 'andamento' | 'tarefas';
export const CAMPOS_DA_SECAO: Record<Exclude<Secao, 'tarefas'>, (keyof Campos)[]> = {
  identificacao: ['assunto', 'numero', 'origem', 'tipo', 'area', 'rapida'],
  descricao: ['descricao'],
  chegada: ['chegou_em', 'prazo_tipo', 'prazo_original', 'prazo_dias', 'prazo_base_em'],
  andamento: ['setor', 'acompanhar_em', 'encaminhada_em', 'reiterada_em'],
};

/**
 * O que enviar ao servidor sobre o prazo (regra pura em lib/prazos.ts). Vai sempre a data original (vazia = sem prazo). Os dias do botão e o dia em que ele foi escolhido
 * (a base, que o banco passa a respeitar) só vão quando mudaram: regravar o mesmo prazo não muda a referência da contagem.
 */
const dadosDoPrazo = (c: Campos, base: Demanda | null): DadosDemanda => dadosDoPrazoDe(c, base);

/** Rascunho recuperado ou demanda aberta: deixa o prazo coerente (base do atalho recuperada quando o atalho a determina; senão prazo manual com a mesma data exibida). */
export const comAtalhoCoerente = (c: Campos, hoje: string): Campos => {
  // rascunhos antigos podem trazer o campo Ano do documento, que saiu da interface (decisão 62): o ano já gravado na demanda não muda por aqui
  const resto: Campos & { ano_documento?: string } = { ...c };
  delete resto.ano_documento;
  return normalizarAtalho(resto, hoje);
};

/** Todos os campos do cadastro guiado (nada de valor padrão inventado: número, origem, chegada e prazo vazios seguem vazios). Com a demanda já criada, "base" evita refazer a contagem dos dias. */
export function paraDadosNovos(c: Campos, base: Demanda | null = null): DadosDemanda {
  return {
    assunto: c.assunto, numero: c.numero, origem: c.origem, descricao: c.descricao, tipo: c.tipo.trim() || null, area: c.area, rapida: c.rapida,
    chegou_em: c.chegou_em || null, prazo_tipo: c.prazo_tipo, ...dadosDoPrazo(c, base),
  };
}

/** Só os campos de uma seção (o salvamento por seção nunca regrava o que não foi editado). */
export function paraDadosSecao(secao: Exclude<Secao, 'tarefas'>, c: Campos, base: Demanda | null): DadosDemanda {
  if (secao === 'identificacao') return { assunto: c.assunto, numero: c.numero, origem: c.origem, tipo: c.tipo.trim() || null, area: c.area, rapida: c.rapida };
  if (secao === 'descricao') return { descricao: c.descricao };
  if (secao === 'chegada') return { chegou_em: c.chegou_em || null, prazo_tipo: c.prazo_tipo, ...dadosDoPrazo(c, base) };
  return { setor: c.setor.trim() || null, acompanhar_em: c.acompanhar_em || null, encaminhada_em: c.encaminhada_em || null, reiterada_em: c.reiterada_em || null };
}

/** Campos de um grupo que diferem do original. */
export const mudou = (c: Campos, base: Campos, chaves: (keyof Campos)[]) => chaves.some((k) => c[k] !== base[k]);

export const novoUuid = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (n) => (Number(n) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(n) / 4)))).toString(16));

/**
 * Identidade de uma tentativa de gravar um texto digitado. Repetir com o MESMO texto (depois de uma resposta perdida, por exemplo) reaproveita o identificador, e o banco devolve o que já
 * gravou em vez de criar outro; outro texto é outra tentativa. Chamar `limpar` quando a gravação for confirmada.
 */
function novaTentativa() {
  let atual: { texto: string; id: string } | null = null;
  return {
    id: (texto: string) => { if (atual?.texto !== texto) atual = { texto, id: novoUuid() }; return atual.id; },
    limpar: () => { atual = null; },
  };
}
export const useTentativa = () => useState(novaTentativa)[0];

// ---------- identificação ----------
// Ordem de leitura: Assunto (o único obrigatório, em destaque), Origem da solicitação e, separado, o Documento associado (tipo e número lado a lado, com o exemplo 250/2026).
// O ano do documento não é mais um campo (decisão 62): o número fica como foi digitado e o filtro de ano lê o ano do próprio número.
export function CamposIdentificacao({ c, mudar, prefixo, comDescricao, nota }: { c: Campos; mudar: (p: Partial<Campos>) => void; prefixo: string; comDescricao?: boolean; nota?: boolean }) {
  const area = temArea(c.tipo), areas = areasDoTipo(c.tipo || null);
  return (
    <>
      <div className="fld fld-assunto"><label htmlFor={`${prefixo}-assunto`}>Assunto <small className="data">(obrigatório)</small></label><input id={`${prefixo}-assunto`} value={c.assunto} placeholder="Do que se trata?" maxLength={300} autoComplete="off" onChange={(e) => mudar({ assunto: e.target.value })} /></div>
      <div className="fld"><label htmlFor={`${prefixo}-origem`}>Origem da solicitação <small className="data">(opcional)</small></label>
        <SeletorOpcao campo="origem" id={`${prefixo}-origem`} rotulo="Origem da solicitação" valor={c.origem} aoEscolher={(v) => mudar({ origem: v })} />
      </div>
      <div className="grp-doc" role="group" aria-labelledby={`${prefixo}-doc-t`}>
        <p className="grp-doc-t" id={`${prefixo}-doc-t`}>Documento associado <small className="data">(opcional: pode chegar depois)</small></p>
        <div className="dois">
          <div className="fld"><label htmlFor={`${prefixo}-tipo`}>Tipo do documento</label>
            <SeletorOpcao campo="tipo" id={`${prefixo}-tipo`} rotulo="Tipo do documento" valor={c.tipo} aoEscolher={(v) => mudar({ tipo: v, area: v === 'Protocolo' && c.area === 'Compras' ? 'Geral' : c.area })} />
          </div>
          <div className="fld"><label htmlFor={`${prefixo}-num`}>Número do documento</label><input id={`${prefixo}-num`} value={c.numero} placeholder="Ex.: 250/2026" maxLength={80} autoComplete="off" onChange={(e) => mudar({ numero: e.target.value })} /></div>
        </div>
        {area ? (
          <div className="fld"><label>Área (define a cor do card)</label><Opcoes lista={areas} valor={areas.includes(c.area) ? c.area : 'Geral'} rotulo="Área" aoEscolher={(v) => mudar({ area: v })} />
            {nota ? <span className="data">{c.tipo === 'Protocolo' ? 'Protocolo geral é azul e de pessoal é verde. Amarelo (compras) só em processo aberto pelo setor de compras.' : 'Azul: geral. Verde: pessoal. Amarelo: compras.'}</span> : null}
          </div>
        ) : null}
      </div>
      <label className="chk-l"><input type="checkbox" checked={c.rapida} onChange={(e) => mudar({ rapida: e.target.checked })} /> <span>Rápida <small className="data">(resolve em pouco tempo; ajuda a escolher o Para hoje)</small></span></label>
      {comDescricao ? <Descricao c={c} mudar={mudar} prefixo={prefixo} /> : null}
    </>
  );
}

export function Descricao({ c, mudar, prefixo }: { c: Campos; mudar: (p: Partial<Campos>) => void; prefixo: string }) {
  return <div className="fld"><label htmlFor={`${prefixo}-descricao`}>Breve descrição <small className="data">(opcional)</small></label><textarea id={`${prefixo}-descricao`} rows={4} value={c.descricao} placeholder="Explique do que se trata, sem sobrecarregar o assunto" onChange={(e) => mudar({ descricao: e.target.value })} /></div>;
}

// ---------- chegada e prazo ----------
/** Descreve o vencimento que o banco vai gravar para a data original escolhida, com a mesma regra dele (antecipa para o primeiro dia disponível). */
export function PreviaPrazo({ c, dias, hoje }: { c: Campos; dias: readonly DiaIndisponivel[]; hoje: string }) {
  if (!c.prazo_original) return <p className="prev-prazo" role="status">Sem prazo: a demanda fica sem vencimento e nada é inventado.</p>;
  let r: ReturnType<typeof ajustarPrazo>;
  try { r = ajustarPrazo(c.prazo_original, dias); } catch (e) { return <p className="prev-prazo" role="alert">{(e as Error).message}</p>; }
  const k = diasAte(r.prazo, hoje);
  const quanto = k < 0 ? `vencida há ${plural(-k, 'dia')}` : k === 0 ? 'vence hoje' : `faltam ${plural(k, 'dia')}`;
  return (
    <p className="prev-prazo" role="status">
      {c.prazo_dias ? <>{c.prazo_dias} dias corridos a partir de {dataBR(c.prazo_base_em || hoje)}{!c.prazo_base_em || c.prazo_base_em === hoje ? ' (hoje)' : ' (o dia em que o botão foi escolhido)'}, excluindo o dia inicial: prazo original <b>{dataComSemana(c.prazo_original)}</b>. </> : <>Prazo original: <b>{dataComSemana(c.prazo_original)}</b>. </>}
      {r.ajuste ? <>Vencimento antecipado para <b>{dataComSemana(r.prazo)}</b> ({quanto}).<span className="ajuste">Dias pulados: {r.ajuste}.</span></> : <>Vencimento: <b>{dataComSemana(r.prazo)}</b> ({quanto}).</>}
    </p>
  );
}

export function CamposChegadaPrazo({ c, mudar, prefixo, hoje, dias, legado }: { c: Campos; mudar: (p: Partial<Campos>) => void; prefixo: string; hoje: string; dias: readonly DiaIndisponivel[]; legado?: boolean }) {
  const perm = c.chegou_em ? permanencia({ chegou_em: c.chegou_em }, hoje) : null;
  return (
    <>
      <div className="fld">
        <label htmlFor={`${prefixo}-chegou`}>Quando chegou <small className="data">(opcional)</small></label>
        <div className="add-t">
          <input id={`${prefixo}-chegou`} type="date" value={c.chegou_em} onChange={(e) => mudar({ chegou_em: e.target.value })} />
          {c.chegou_em ? <button className="btn mini" type="button" onClick={() => mudar({ chegou_em: '' })}>Sem data</button> : null}
        </div>
        <span className="data">{c.chegou_em ? (perm === null ? '' : `Na Secretaria há ${plural(perm, 'dia')} corridos (contados desde a chegada, não desde o cadastro).`) : 'Data de chegada não informada. Sem ela não existe contagem de permanência.'}</span>
      </div>
      <div className="fld"><label>Tipo de prazo</label><Opcoes lista={PRAZOS} valor={c.prazo_tipo} rotulo="Tipo de prazo" aoEscolher={(v) => mudar({ prazo_tipo: v })} /></div>
      <div className="fld">
        <label htmlFor={`${prefixo}-prazo`}>Data final do prazo <small className="data">(opcional)</small></label>
        <div className="add-t">
          <input id={`${prefixo}-prazo`} type="date" value={c.prazo_original} onChange={(e) => mudar({ prazo_original: e.target.value, prazo_dias: null, prazo_base_em: '' })} />
          {c.prazo_original ? <button className="btn mini" type="button" onClick={() => mudar({ prazo_original: '', prazo_dias: null, prazo_base_em: '' })}>Sem prazo</button> : null}
        </div>
        <div className="dias-btns" role="group" aria-label="Prazo em dias corridos a partir de hoje">
          {BOTOES_PRAZO.map((n) => <button key={n} type="button" className="btn mini" aria-pressed={c.prazo_dias === n} onClick={() => mudar({ prazo_original: prazoPorDias(n, hoje), prazo_dias: n, prazo_base_em: hoje })}>{n} dias</button>)}
        </div>
        <span className="data">Os botões contam dias corridos a partir do dia em que você clica, não da chegada, e esse dia fica guardado: reabrir o rascunho ou virar o dia não muda a data. Clique de novo para contar a partir de outro dia. Se a data cair em fim de semana, feriado ou evento externo de dia inteiro, o vencimento é antecipado para o dia disponível anterior.</span>
        <PreviaPrazo c={c} dias={dias} hoje={hoje} />
        {legado ? <span className="data">Este prazo existia antes do cálculo por prazo original e foi mantido como referência.</span> : null}
      </div>
    </>
  );
}

// ---------- tarefas (desenho aprovado da área de tarefas) ----------
export type TarefaForm = { chave: string; id?: string; texto: string; concluida: boolean };
export const chaveTarefa = () => Math.random().toString(36).slice(2);
export const paraEnvio = (l: TarefaForm[]): TarefaEdicao[] => l.filter((t) => t.texto.trim()).map((t) => ({ ...(t.id ? { id: t.id } : {}), texto: t.texto.trim(), concluida: t.concluida }));

export function EditorTarefas({ tarefas, setTarefas, nt, setNt, idNt = 'm-nt', aviso }: { tarefas: TarefaForm[]; setTarefas: (f: (l: TarefaForm[]) => TarefaForm[]) => void; nt: string; setNt: (v: string) => void; idNt?: string; aviso?: ReactNode }) {
  const adicionar = () => { const v = nt.trim(); if (!v) return; setTarefas((l) => [...l, { chave: chaveTarefa(), texto: v, concluida: false }]); setNt(''); };
  const feitas = tarefas.filter((t) => t.concluida).length;
  return (
    <>
      {tarefas.length ? (
        <ul className="tarefas ed">
          {tarefas.map((t, i) => (
            <li key={t.chave} className="t-item">
              <input type="checkbox" checked={t.concluida} aria-label={`Concluir a tarefa ${i + 1}`} onChange={(e) => setTarefas((l) => l.map((x) => (x.chave === t.chave ? { ...x, concluida: e.target.checked } : x)))} />
              <input className={`t-campo${t.concluida ? ' feita' : ''}`} value={t.texto} aria-label={`Texto da tarefa ${i + 1}`} autoComplete="off" onChange={(e) => setTarefas((l) => l.map((x) => (x.chave === t.chave ? { ...x, texto: e.target.value } : x)))} />
              <button type="button" className="t-lapis" aria-label={`Remover a tarefa ${i + 1}`} title="Remover" onClick={() => setTarefas((l) => l.filter((x) => x.chave !== t.chave))}><Icone nome="trash" /></button>
            </li>
          ))}
        </ul>
      ) : <div className="proxima vazia"><span>Nenhuma tarefa cadastrada</span></div>}
      <div className="add-t">
        <input id={idNt} value={nt} placeholder="Nova tarefa" aria-label="Nova tarefa" autoComplete="off" onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }} />
        <button className="btn mini" type="button" onClick={adicionar}><Icone nome="plus" />Adicionar</button>
      </div>
      <p className="data m-prog">{tarefas.length ? `${feitas} de ${tarefas.length} concluídas (${Math.round((100 * feitas) / tarefas.length)}%). ` : 'Nenhuma tarefa ainda. '}{aviso ?? 'O percentual mede só as tarefas. Concluir todas não muda a etapa sozinho.'}</p>
    </>
  );
}

