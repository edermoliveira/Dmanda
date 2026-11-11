'use client';
// Para hoje e Nova urgência no Início (decisão 64). Quatro vagas reais (guardadas no banco). Três apresentações, escolhidas pela largura do próprio painel:
//  - largo: as quatro vagas lado a lado;
//  - iPad em pé: a faixa mostra duas vagas por vez e rola de lado para as outras duas (rolar é só navegar: não muda ordem nem etapa);
//  - celular: pilha com um card ativo. Deslizar à esquerda manda o card para o fim da ordem de apresentação (guardada só neste aparelho, até a virada do dia em Brasília);
//    deslizar à direita avança a etapa (Cadastro, Vistos, Fazendo, Finalizado) ou, nas etapas de espera, abre o menu para escolher. Botões equivalentes fazem o mesmo.
// A vaga, a etapa e a prioridade nunca mudam pelo gesto da esquerda. O primeiro desenho é o mesmo no servidor e no navegador: a ordem guardada só entra depois de montar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { CardDemanda } from './cartoes';
import { Baralho, BaralhoSimples, useModo } from './baralho';
import { eObjeto } from '@/lib/armazenamento';
import { ativoParaOFim, elegiveisParaHoje, ETAPA_SEGUINTE, etapaDeEspera, ordemDaPilha, organizarPainel, precisaCompletar, vagasAbertas, VAGAS_PARA_HOJE } from '@/lib/para-hoje';
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
function Pilha({ vagas, vagaDe }: { vagas: Vaga[]; vagaDe: (id: string) => number | undefined }) {
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
  const ordem = useMemo(() => ordemDaPilha(ids, guardada && guardada.dia === hoje ? guardada.ids : []), [ids, guardada, hoje]);
  const guardarOrdem = useCallback((novos: string[]) => { const o = { dia: hoje, ids: novos }; setGuardada(o); gravarOrdem(o); }, [hoje]);
  const porId = useMemo(() => new Map(vagas.map((v) => [v.demanda.id, v.demanda] as const)), [vagas]);
  const ativa = porId.get(ordem[0]) ?? null;
  // uma confirmação aberta para um card que já não é o ativo (a lista mudou por baixo, por exemplo ao voltar à aba) não pode travar a pilha
  const confirmarAtivo = confirmar && ativa && confirmar.id === ativa.id ? confirmar : null;

  // card que foi para a escolha de etapa no menu: quando a etapa mudar de verdade, a pilha avança (depois da gravação confirmada)
  useEffect(() => {
    const o = observando.current; if (!o) return;
    const d = demandas.find((x) => x.id === o.id);
    if (Date.now() > o.ate) { observando.current = null; return; }
    if (!d || d.etapa === o.etapa) return;
    observando.current = null;
    if (ordem[0] === o.id) guardarOrdem(ativoParaOFim(ordem));
  }, [demandas, ordem, guardarOrdem]);

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
      if (destino !== 'Finalizado') guardarOrdem(ativoParaOFim(ordem)); // a vaga continua dele; a pilha segue para o próximo
    } finally { gravando.current = false; setOcupado(false); }
  }, [concluir, mover, ordem, guardarOrdem]);

  const avancar = useCallback((ancora: HTMLElement | null) => {
    if (ocupado || gravando.current || confirmarAtivo || !ativa) return;
    const d = ativa;
    if (etapaDeEspera(d.etapa)) { observando.current = { id: d.id, etapa: d.etapa, ate: Date.now() + 60_000 }; if (ancora) abrirMenuMover(d.id, ancora); return; }
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
      direita={{ rotulo: rotuloAvancar, executar: avancar, desabilitado: !destino && !etapaDeEspera(d.etapa), menu: etapaDeEspera(d.etapa) }} />
  );
}

export function ParaHoje() {
  const { demandas, hoje, dias, paraHoje, sincronizarParaHoje, carregando } = useApp();
  const secao = useRef<HTMLElement>(null);
  const faixa = useRef<HTMLDivElement>(null);
  const modo = useModo(secao);
  const elegiveis = useMemo(() => elegiveisParaHoje(demandas, hoje, dias), [demandas, hoje, dias]);
  const abertas = vagasAbertas(paraHoje, demandas);
  const ocupadas = new Set(abertas.map((v) => v.demanda.id));
  const faltaCompletar = precisaCompletar(paraHoje, demandas, elegiveis);
  const candidatas = faltaCompletar ? elegiveis.filter((e) => !ocupadas.has(e.demanda.id)).slice(0, 10).map((e) => e.demanda.id).join(',') : '';
  // preenche (ou repõe) só as vagas livres; a lista só muda quando as candidatas mudam, então uma resposta sem efeito não repete a chamada
  useEffect(() => { if (!carregando && hoje !== '2000-01-01' && candidatas) void sincronizarParaHoje(candidatas.split(',')); }, [candidatas, carregando, hoje, sincronizarParaHoje]);
  // Exibição (decisões 61 e 64): os pedidos da Prefeita e do Gabinete que ocupam vagas vêm antes das comuns (a posição gravada não muda). Com as quatro vagas cheias, a prioridade elegível de fora
  // abre a faixa Nova urgência, antes das urgências comuns. Cada demanda aparece uma só vez, em uma das duas seções.
  const painel = useMemo(() => organizarPainel(paraHoje, demandas, elegiveis), [paraHoje, demandas, elegiveis]);
  const vagas = useMemo(() => [...painel.prioritariasNasVagas, ...painel.comunsNasVagas], [painel]);
  const urgencias = painel.novaUrgencia.slice(0, VAGAS_PARA_HOJE);
  const vazio = !vagas.length;
  const rolar = (sentido: 1 | -1) => { const f = faixa.current; if (f) f.scrollBy({ left: sentido * (f.clientWidth + 14), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  return (
    <section ref={secao} className="sec ph" data-painel="para-hoje" data-modo={modo} aria-labelledby="ph-t">
      <h3 id="ph-t">Para hoje <small>até {VAGAS_PARA_HOJE} demandas para tocar hoje: pedidos da Prefeita e do Gabinete primeiro, depois atrasadas e as que vencem hoje</small></h3>
      {vazio ? <div className="vazio-c">Nada para tocar hoje por enquanto.</div> : modo === 'pilha' ? <Pilha vagas={vagas} vagaDe={(id) => vagas.find((v) => v.demanda.id === id)?.posicao} /> : (
        <>
          {modo === 'duas' && vagas.length > 2 ? (
            <div className="ph-nav" role="group" aria-label="Ver outras vagas">
              <span className="data">Deslize para o lado: mais {vagas.length - 2} {vagas.length - 2 === 1 ? 'vaga' : 'vagas'}</span>
              <button type="button" className="icbtn-s ph-ant" aria-label="Vagas anteriores" onClick={() => rolar(-1)}><Icone nome="chevron-right" /></button>
              <button type="button" className="icbtn-s" aria-label="Próximas vagas" onClick={() => rolar(1)}><Icone nome="chevron-right" /></button>
            </div>
          ) : null}
          <div ref={faixa} className="cards ph-cards" data-faixa>
            {vagas.map((v) => <div key={v.demanda.id} data-vaga={v.posicao} className="vaga"><CardDemanda d={v.demanda} mostrarRapida /></div>)}
          </div>
        </>
      )}
      {urgencias.length ? (
        <div className="nova-urgencia" role="status" data-nova-urgencia>
          <h4>Nova urgência <small>fora das suas vagas, sem trocar a seleção</small></h4>
          {modo === 'pilha' ? <BaralhoSimples lista={urgencias.map((e) => e.demanda)} nome="Nova urgência" foraDaVaga={new Set(urgencias.filter((e) => e.prioritaria).map((e) => e.demanda.id))} />
            : <div className="cards ph-cards-urg">{urgencias.map((e) => <div key={e.demanda.id} className="vaga" {...(e.prioritaria ? { 'data-fora-vaga': '' } : {})}><CardDemanda d={e.demanda} mostrarRapida /></div>)}</div>}
        </div>
      ) : null}
    </section>
  );
}
