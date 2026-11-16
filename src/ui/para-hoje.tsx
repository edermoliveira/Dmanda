'use client';
// Para hoje e Urgência no Início. As quatro vagas persistentes (decisão 80), a seleção, a prioridade e a reposição são as de lib/para-hoje.ts e do banco; o baralho do celular (decisão 65, aprovado na prévia 887b116,
// decisão 67) foi portado da branch do Início em 14/11/2026 só como apresentação:
//  - computador e iPad: a grade de cards de sempre;
//  - celular: pilha com um card ativo. Deslizar à esquerda manda o card para o fim da ordem de apresentação (guardada só neste aparelho, até a virada do dia em Brasília);
//    deslizar à direita avança a etapa (Cadastro, Vistos, Fazendo, Finalizado) ou, nas etapas de espera, abre o menu para escolher; finalizar com tarefas pendentes pede confirmação.
//    A pilha só avança depois da gravação confirmada; cancelar ou falhar deixa o card ativo. Botões equivalentes fazem o mesmo.
// A vaga, a etapa e a prioridade nunca mudam pelo gesto da esquerda. O primeiro desenho é o mesmo no servidor e no navegador: a ordem guardada só entra depois de montar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './contexto';
import { CardDemanda } from './cartoes';
import { Ajuda } from './ajuda';
import { Baralho, BaralhoSimples, FaixaCards, useModo } from './baralho';
import { eObjeto } from '@/lib/armazenamento';
import { ativoParaOFim, candidatasParaVagas, elegiveisParaHoje, ETAPA_SEGUINTE, etapaDeEspera, ordemDaPilha, precisaCompletar, urgenciasDoInicio, vagasAbertas } from '@/lib/para-hoje';
import { plural, type Demanda } from '@/lib/demandas';

const CHAVE_ORDEM = 'dmanda:para-hoje-ordem';
type OrdemGuardada = { dia: string; ids: string[] };
function lerOrdem(): OrdemGuardada | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_ORDEM) ?? 'null') as unknown;
    if (!eObjeto(v) || typeof v.dia !== 'string' || !Array.isArray(v.ids)) return null;
    return { dia: v.dia, ids: v.ids.filter((x): x is string => typeof x === 'string') };
  } catch { return null; }
}
function gravarOrdem(o: OrdemGuardada) { try { localStorage.setItem(CHAVE_ORDEM, JSON.stringify(o)); } catch { /* sem armazenamento: vale só nesta visita */ } }

type Vaga = { posicao: number; demanda: Demanda };

/** A pilha do celular do Para hoje: o baralho com a ordem guardada no aparelho, a etapa pelo gesto da direita (ou pelo botão) e a confirmação de finalizar. */
function Pilha({ vagas }: { vagas: Vaga[] }) {
  const { hoje, mover, concluir, abrirMenuMover, demandas } = useApp();
  const [guardada, setGuardada] = useState<OrdemGuardada | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<{ id: string; pendentes: number } | null>(null);
  const [aviso, setAviso] = useState('');
  const observando = useRef<{ id: string; etapa: string; ate: number } | null>(null);
  const gravando = useRef(false);   // uma única gravação por vez, mesmo com o gesto repetido antes de o estado atualizar
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setGuardada(lerOrdem()); const f = (e: StorageEvent) => { if (e.key === CHAVE_ORDEM) setGuardada(lerOrdem()); }; addEventListener('storage', f); return () => removeEventListener('storage', f); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const ids = useMemo(() => vagas.map((v) => v.demanda.id), [vagas]);
  // a ordem guardada vale só no dia em que foi guardada (hoje é a data de Brasília, vinda do contexto): na virada do dia volta a ordem das vagas
  const ordem = useMemo(() => ordemDaPilha(ids, guardada && guardada.dia === hoje ? guardada.ids : []), [ids, guardada, hoje]);
  const guardarOrdem = useCallback((novos: string[]) => { const o = { dia: hoje, ids: novos }; setGuardada(o); gravarOrdem(o); }, [hoje]);
  const porId = useMemo(() => new Map(vagas.map((v) => [v.demanda.id, v.demanda] as const)), [vagas]);
  const vagaDe = useCallback((id: string) => vagas.find((v) => v.demanda.id === id)?.posicao, [vagas]);
  const ativa = porId.get(ordem[0]) ?? null;
  // uma confirmação aberta para um card que já não é o ativo (a lista mudou por baixo, por exemplo ao voltar à aba) não pode travar a pilha
  const confirmarAtivo = confirmar && ativa && confirmar.id === ativa.id ? confirmar : null;

  // card que foi para a escolha de etapa no menu: quando a etapa mudar de verdade (gravação confirmada), a pilha avança
  useEffect(() => {
    const o = observando.current; if (!o) return;
    const d = demandas.find((x) => x.id === o.id);
    if (Date.now() > o.ate) { observando.current = null; return; }
    if (!d || d.etapa === o.etapa) return;
    observando.current = null;
    if (ordem[0] === o.id) guardarOrdem(ativoParaOFim(ordem));
  }, [demandas, ordem, guardarOrdem]);

  // Esc fecha o menu sem escolher nada: a pilha deixa de esperar a mudança de etapa (senão uma mudança feita depois, pelo verso do card, faria a pilha avançar sozinha)
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') observando.current = null; }; addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, []);

  const passar = useCallback(() => {
    if (ocupado || confirmarAtivo || ordem.length < 2) return;
    guardarOrdem(ativoParaOFim(ordem)); setAviso(`Passado para o fim. Agora: ${porId.get(ordem[1])?.assunto ?? ''}`);
  }, [ocupado, confirmarAtivo, ordem, guardarOrdem, porId]);

  const gravar = useCallback(async (d: Demanda, destino: 'Vistos' | 'Fazendo' | 'Finalizado') => {
    if (gravando.current) return;
    gravando.current = true; setOcupado(true);
    try {
      const r = await (destino === 'Finalizado' ? concluir(d.id) : mover(d.id, destino));
      if (!r) return; // falhou (o aviso de erro já apareceu): o card e a ordem ficam como estavam
      if (destino !== 'Finalizado') guardarOrdem(ativoParaOFim(ordem)); // a vaga continua dele; a pilha segue para o próximo (a finalizada libera a vaga e sai sozinha)
    } finally { gravando.current = false; setOcupado(false); }
  }, [concluir, mover, ordem, guardarOrdem]);

  const avancar = useCallback((ancora: HTMLElement | null) => {
    if (ocupado || gravando.current || confirmarAtivo || !ativa) return;
    const d = ativa;
    if (etapaDeEspera(d.etapa)) { observando.current = { id: d.id, etapa: d.etapa, ate: Date.now() + 15_000 }; if (ancora) abrirMenuMover(d.id, ancora); return; }
    const destino = ETAPA_SEGUINTE[d.etapa];
    if (!destino) return;
    if (destino === 'Finalizado') {
      const pendentes = d.tarefas.filter((t) => !t.concluida).length;
      if (pendentes > 0) { setConfirmar({ id: d.id, pendentes }); return; }
    }
    void gravar(d, destino as 'Vistos' | 'Fazendo' | 'Finalizado');
  }, [ocupado, confirmarAtivo, ativa, abrirMenuMover, gravar]);

  if (!ativa) return null;
  const d = ativa, destino = ETAPA_SEGUINTE[d.etapa];
  const rotuloAvancar = etapaDeEspera(d.etapa) ? 'Escolher a etapa' : destino ? (destino === 'Finalizado' ? 'Finalizar' : `Avançar para ${destino}`) : 'Sem etapa seguinte';
  const descricaoAvancar = etapaDeEspera(d.etapa) ? 'escolher a etapa' : destino ? (destino === 'Finalizado' ? 'finalizar' : `para ${destino}`) : 'sem etapa seguinte';
  const rodape = confirmarAtivo ? (
    <div className="ph-confirma" role="alertdialog" aria-label="Finalizar a demanda" data-confirma-finalizar>
      <p>Ao finalizar, {confirmarAtivo.pendentes === 1 ? '1 tarefa pendente será marcada' : `${confirmarAtivo.pendentes} tarefas pendentes serão marcadas`} como concluída{confirmarAtivo.pendentes === 1 ? '' : 's'}.</p>
      <div className="acoes">
        <button type="button" className="btn" autoFocus onClick={() => setConfirmar(null)}>Cancelar</button>
        <button type="button" className="btn pri" disabled={ocupado} onClick={async () => { await gravar(d, 'Finalizado'); setConfirmar(null); }}>Finalizar e concluir {plural(confirmarAtivo.pendentes, 'tarefa')}</button>
      </div>
    </div>
  ) : undefined;
  return (
    <Baralho nome="Para hoje" ordem={ordem} porId={porId} vagaDe={vagaDe} aviso={aviso} travado={ocupado || !!confirmarAtivo} rodape={rodape}
      esquerda={{ rotulo: 'Passar para o fim', executar: passar }}
      direita={{ rotulo: rotuloAvancar, curto: 'Avançar etapa', descricao: `Avançar etapa: ${descricaoAvancar}`, executar: avancar, desabilitado: !destino && !etapaDeEspera(d.etapa), menu: etapaDeEspera(d.etapa) }} />
  );
}

// O painel de execução do dia (o antigo Foco do dia): até 4 vagas persistentes, guardadas no banco. Ao concluir ou arquivar uma demanda, só a vaga liberada é reposta. Uma urgência que surge depois
// das vagas escolhidas aparece na Urgência, sem trocar a seleção. Não é o grupo "Vencem hoje" (que lista tudo o que vence hoje, com ou sem ação).
export function ParaHoje() {
  const { demandas, hoje, dias, paraHoje, sincronizarParaHoje, carregando } = useApp();
  const secao = useRef<HTMLElement>(null);
  const modo = useModo(secao);
  const elegiveis = useMemo(() => elegiveisParaHoje(demandas, hoje, dias), [demandas, hoje, dias]);
  const abertas = useMemo(() => vagasAbertas(paraHoje, demandas), [paraHoje, demandas]);
  const ocupadas = new Set(abertas.map((v) => v.demanda.id));
  const faltaCompletar = precisaCompletar(paraHoje, demandas, elegiveis);
  // as livres são preenchidas pela melhor candidata: pedidos da Prefeita e do Gabinete primeiro, depois a ordem das elegíveis
  const candidatas = faltaCompletar ? candidatasParaVagas(elegiveis, ocupadas).slice(0, 10).map((e) => e.demanda.id).join(',') : '';
  // preenche (ou repõe) só as vagas livres; a lista só muda quando as candidatas mudam, então uma resposta sem efeito não repete a chamada
  useEffect(() => { if (!carregando && hoje !== '2000-01-01' && candidatas) void sincronizarParaHoje(candidatas.split(',')); }, [candidatas, carregando, hoje, sincronizarParaHoje]);
  // Urgência (decisão 80): fora das vagas, sem repetir nenhuma demanda; na web e no iPad é uma faixa de cards lado a lado com rolagem horizontal própria, no iPhone segue o baralho.
  // O Início tem só estas duas seções de demandas: o antigo "Na fila" e as listas dos contadores saíram (as demais demandas estão em Demandas).
  const { demandas: urgentes, proximos } = useMemo(() => urgenciasDoInicio(paraHoje, demandas, hoje, dias), [paraHoje, demandas, hoje, dias]);
  return (
    <section ref={secao} className="sec ph" data-painel="para-hoje" data-modo={modo} aria-labelledby="ph-t">
      <h3><span id="ph-t">Para hoje</span><Ajuda rotulo="Sobre o Para hoje">Demandas para focar hoje, as prioridades do dia</Ajuda></h3>
      {!abertas.length ? <div className="vazio-c">Nada para tocar hoje por enquanto.</div>
        : modo === 'pilha' ? <Pilha vagas={abertas} />
          : <div className="cards">{abertas.map((v) => <div key={v.demanda.id} data-vaga={v.posicao} className="vaga"><CardDemanda d={v.demanda} mostrarRapida /></div>)}</div>}
      <div className="nova-urgencia" data-nova-urgencia data-proximos={proximos || undefined} data-vazia={!urgentes.length || undefined}>
        <h4><span>Urgência</span><Ajuda rotulo="Sobre a Urgência">{proximos ? 'Sem urgências agora: os próximos vencimentos' : 'Pedidos da Prefeita e do Gabinete, atrasadas, as que vencem hoje e os ofícios dos próximos 7 dias'}</Ajuda></h4>
        {!urgentes.length ? <div className="vazio-c">Nenhuma urgência no momento.</div>
          : modo === 'pilha' ? <BaralhoSimples lista={urgentes} nome="Urgência" />
            : <FaixaCards lista={urgentes} rotulo={proximos ? 'Urgência, os próximos vencimentos' : 'Urgência, da mais urgente para a menos urgente'} />}
      </div>
    </section>
  );
}
