'use client';
// Janelas do aplicativo: o cadastro guiado de demanda (cadastro.tsx), a consulta e edição da demanda (detalhe.tsx) e a nova tarefa do menu "+".
// Regras de rascunho do protótipo aprovado: clicar fora não fecha se houver texto novo; Esc e X fecham e guardam o rascunho; Cancelar descarta.
import { useEffect, useState } from 'react';
import { useApp } from './contexto';
import { Janela } from './janela-base';
import { JanelaNova } from './cadastro';
import { JanelaDemanda } from './detalhe';
import { JanelaEntradaRoteada } from './entradas';
import { titulo } from '@/lib/demandas';

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
          <div className="fld"><label htmlFor="t-dem">Em qual demanda?</label><select id="t-dem" value={dem} onChange={(e) => setDem(e.target.value)}>{abertas.map((d) => <option key={d.id} value={d.id}>{`${titulo(d)} · ${d.assunto}`}</option>)}</select></div>
          <div className="fld"><label htmlFor="t-texto">Tarefa</label><input id="t-texto" value={texto} placeholder="O que precisa ser feito?" onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar(); } }} /></div>
        </>
      ) : <p className="data">Não há demanda em aberto. Cadastre uma demanda antes de adicionar tarefas.</p>}
    </Janela>
  );
}

// Virar demanda: o cadastro guiado abre com a anotação de origem já lida da lista de Entradas. Sem a anotação (excluída em outro aparelho) e sem cadastro em andamento, não há o que abrir.
function JanelaNovaDeEntrada({ entradaId }: { entradaId: string }) {
  const { entradas, rascunhos, fecharJanela, avisar } = useApp();
  const entrada = entradas.find((x) => x.id === entradaId) ?? null;
  const retomando = !!rascunhos['nova'];
  const semNota = !entrada && !retomando;
  useEffect(() => { if (semNota) { avisar('Esta entrada não está mais em Entradas.', true); fecharJanela(); } }, [semNota, avisar, fecharJanela]);
  return semNota ? null : <JanelaNova entradaId={entradaId} entrada={entrada} />;
}

export function Janelas() {
  const { janela, carregando, carregandoEntradas } = useApp();
  if (!janela) return null;
  if (janela.t === 'editar') return <JanelaDemanda id={janela.id} />;
  // o cadastro retomado precisa da lista carregada para reencontrar a demanda já criada; a anotação de origem, da lista de Entradas
  if (janela.t === 'nova') return carregando || (janela.entradaId && carregandoEntradas) ? null : janela.entradaId ? <JanelaNovaDeEntrada entradaId={janela.entradaId} /> : <JanelaNova />;
  if (janela.t === 'entrada') return carregandoEntradas ? null : <JanelaEntradaRoteada id={janela.id} />;
  return <JanelaTarefa />;
}
