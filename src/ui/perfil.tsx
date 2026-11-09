'use client';
// Perfil (gaveta à direita, aberta pelo avatar e por Configurações > Perfil): humor de hoje, produtividade, o gráfico "Seu ritmo" (semana e mês), o histórico
// dos últimos 28 dias e o registro e a correção dos últimos 5 dias. Privado: sem metas, sem comparação, sem sequência de dias e sem alerta negativo. O humor não vai
// para a busca, a IA, a telemetria nem a cópia dos dados. Zero demandas finalizadas é um valor normal; a falta de registro aparece como "Sem registro".
// Produtividade = demandas finalizadas no dia (data de conclusão), lidas das listas que o aplicativo já tem mais as arquivadas, lidas ao abrir.
import { useEffect, useRef, useState, type KeyboardEvent as TecladoReact } from 'react';
import { useRouter } from 'next/navigation';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { EmojiNivel, FormularioRegistro } from './escala';
import { AVISO_PERFIL, ROTULO_HUMOR, dataCurta, diasPendentes, emJanelaDeCorrecao, fraseDoDia, semanaAbreviada, serieDoPeriodo, textoConcluidas, textoDoDia, DIAS_CORRECAO, type PontoDia } from '@/lib/registros';

export function PerfilGaveta() {
  const { perfilAberto } = useApp();
  return perfilAberto ? <Gaveta /> : null;
}

/** Setas, Home e End entre os botões de um grupo (uma parada de Tab só, a do selecionado). Devolve o índice novo, ou null se a tecla não é de navegação. */
function indiceDaTecla(e: TecladoReact, atual: number, total: number): number | null {
  const k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (e.key === 'Home') return 0;
  if (e.key === 'End') return total - 1;
  return k ? Math.max(0, Math.min(total - 1, atual + k)) : null;
}

function Gaveta() {
  const { demandas, arquivadas, carregarArquivadas, registros, erroRegistros, carregandoRegistros, recarregarRegistros, hoje, ambiente, fecharPerfil, abrirCompletar } = useApp();
  const router = useRouter();
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const [diaSel, setDiaSel] = useState('');
  const [arquivo, setArquivo] = useState<'lendo' | 'ok' | 'falhou'>('lendo');
  const ref = useRef<HTMLElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const fechar = useRef(fecharPerfil);
  useEffect(() => { fechar.current = fecharPerfil; });
  const nome = ambiente?.nome || 'Secretário';

  // as arquivadas também contam as finalizadas do dia: leitura silenciosa ao abrir (a falha é dita aqui dentro)
  useEffect(() => {
    let vivo = true;
    void carregarArquivadas(true).then((ok) => { if (vivo) setArquivo(ok ? 'ok' : 'falhou'); });
    return () => { vivo = false; };
  }, [carregarArquivadas]);

  // foco na gaveta ao abrir, Esc fecha (a menos que algo aberto por cima cuide dele), Tab não sai, e ao fechar o foco volta a quem abriu
  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => {
      if (document.querySelector('.modal-ov, .busca-ov, .mv-menu')) return;
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); fechar.current(); return; }
      if (e.key === 'Tab' && ref.current) {
        const itens = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((x) => x.getClientRects().length);
        if (!itens.length) return;
        const atual = itens.indexOf(document.activeElement as HTMLElement);
        const alvo = e.shiftKey ? (atual <= 0 ? itens[itens.length - 1] : null) : (atual === -1 || atual === itens.length - 1 ? itens[0] : null);
        if (alvo) { e.preventDefault(); alvo.focus(); }
      }
    };
    document.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('keydown', tecla, true);
      // o menu da conta (que abriu a gaveta) já não existe: o foco volta ao avatar
      const alvo = origem && origem.isConnected && origem !== document.body ? origem : document.querySelector<HTMLElement>('.perfil-b');
      alvo?.focus?.();
    };
  }, []);

  const todas = [...demandas, ...(arquivadas ?? [])];
  const base = serieDoPeriodo(todas, registros, hoje, 30);
  const hist = base.slice(-28);
  const serie = periodo === 'mes' ? base : base.slice(-7);
  const hojePt = base[base.length - 1];
  const selecionado = base.find((p) => p.dia === diaSel) ?? hojePt;
  const max = Math.max(1, ...serie.map((p) => p.concluidas));
  const registroOk = !erroRegistros && !carregandoRegistros;   // só com os registros lidos é que "Sem registro" é verdade

  // o histórico abre no dia mais recente (a rolagem horizontal vai ao fim)
  useEffect(() => { const r = rolagem.current; if (r) r.scrollLeft = r.scrollWidth; }, [registroOk]);

  const escolher = (dia: string) => setDiaSel(dia);
  const teclaGrupo = (e: TecladoReact, lista: PontoDia[], seletor: string) => {
    const bs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(seletor));
    const i = bs.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const n = indiceDaTecla(e, i, bs.length);
    if (n === null) return;
    e.preventDefault(); bs[n].focus(); escolher(lista[n].dia);
  };
  // dedo ou mouse arrastando sobre o gráfico escolhe o dia sob o ponto (as colunas do mês são finas demais para o toque exato)
  const arrastar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.buttons === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    escolher(serie[Math.max(0, Math.min(serie.length - 1, Math.floor(((e.clientX - r.left) / r.width) * serie.length)))].dia);
  };

  const estadoDoDia = (p: PontoDia) => (p.registro ? `humor ${ROTULO_HUMOR[p.registro.humor].toLowerCase()}` : 'sem registro');
  const roteiroAtivo = serie.some((p) => p.dia === selecionado.dia) ? selecionado.dia : hojePt.dia;
  const histAtivo = hist.some((p) => p.dia === selecionado.dia) ? selecionado.dia : hojePt.dia;

  return (
    <div className="dr-ov entra" onMouseDown={(e) => { if (e.target === e.currentTarget) fecharPerfil(); }}>
      <aside ref={ref} className="dr" role="dialog" aria-modal="true" aria-labelledby="pf-t" tabIndex={-1} data-perfil>
        <header className="m-h"><h3 id="pf-t">Perfil</h3><button type="button" className="icbtn-s" aria-label="Fechar o Perfil" onClick={fecharPerfil}><Icone nome="x" /></button></header>
        <div className="pf-id"><span className="av" aria-hidden="true">{nome.charAt(0).toUpperCase()}</span><div><b>{nome}</b><span className="data">Seu espaço pessoal. Só você vê.</span></div></div>

        {erroRegistros ? (
          <div className="erro-carga" role="alert"><b>Não foi possível ler o humor agora.</b><span>{erroRegistros}</span><button type="button" className="btn mini" onClick={() => void recarregarRegistros()}>Tentar de novo</button></div>
        ) : null}
        {arquivo === 'falhou' ? <p className="data" role="status">Não foi possível ler as demandas arquivadas agora: a contagem de finalizadas pode estar incompleta.</p> : null}

        <div className="ind3">
          <section className="painel ind" data-indicador="humor">
            <h3>Humor</h3>
            <div className="ind-v">{!registroOk ? <b>Indisponível</b> : hojePt.registro ? <><EmojiNivel nivel={hojePt.registro.humor} /><b>{ROTULO_HUMOR[hojePt.registro.humor]}</b></> : <b>Sem registro hoje</b>}</div>
            <p className="data">Último registro de hoje. Só seu.</p>
          </section>
          <section className="painel ind" data-indicador="produtividade">
            <h3>Produtividade</h3>
            <div className="ind-v"><b className="grande-n">{hojePt.concluidas}</b>{' '}<b>{hojePt.concluidas === 1 ? 'demanda finalizada' : 'demandas finalizadas'} hoje</b></div>
            <p className="data">Calculada pelas demandas finalizadas no dia, independentemente do prazo.</p>
          </section>
        </div>

        <section className="painel" aria-labelledby="pf-ritmo">
          <div className="ph"><h3 id="pf-ritmo">Seu ritmo</h3>
            <div className="tabs" role="group" aria-label="Período do gráfico">
              <button type="button" aria-pressed={periodo === 'semana'} onClick={() => setPeriodo('semana')}>Semana</button>
              <button type="button" aria-pressed={periodo === 'mes'} onClick={() => setPeriodo('mes')}>Mês</button>
            </div>
          </div>
          <div className={`grafico${periodo === 'mes' ? ' mes' : ''}`} role="group" aria-label={`Demandas finalizadas por dia, ${periodo === 'mes' ? 'últimos 30 dias' : 'últimos 7 dias'}`} data-periodo={periodo}
            onKeyDown={(e) => teclaGrupo(e, serie, 'button.gcol')} onPointerDown={arrastar} onPointerMove={arrastar}>
            {serie.map((p) => {
              const sel = p.dia === selecionado.dia;
              return (
                <button key={p.dia} type="button" className={`gcol${periodo === 'mes' ? ' fina' : ''}${sel ? ' sel' : ''}${p.concluidas === 0 ? ' zero' : ''}`} aria-pressed={sel} tabIndex={p.dia === roteiroAtivo ? 0 : -1}
                  aria-label={textoDoDia(p, hoje)} data-dia={p.dia} data-n={p.concluidas} onClick={() => escolher(p.dia)}>
                  <span className="tip" aria-hidden="true">{dataCurta(p.dia)}: {textoConcluidas(p.concluidas)}{registroOk ? `, ${estadoDoDia(p)}` : ''}</span>
                  <i style={{ height: `${8 + Math.round((p.concluidas / max) * 100)}px` }} />
                  {periodo === 'semana' ? <span>{semanaAbreviada(p.dia)}</span> : null}
                </button>
              );
            })}
          </div>
          <p className="data">Passe o mouse, toque ou use as setas para ver o resumo de um dia. Dia com zero é um dia normal.</p>
        </section>

        <section className="painel" aria-labelledby="pf-dia" data-dia-sel={selecionado.dia}>
          <h3 id="pf-dia">{selecionado.dia === hoje ? 'Hoje' : 'Dia selecionado'}</h3>
          <p className="data pf-det" id="pf-det" role="status" aria-live="polite">{registroOk ? textoDoDia(selecionado, hoje) : `${textoConcluidas(selecionado.concluidas)}.`}</p>
          {!registroOk ? null : emJanelaDeCorrecao(selecionado.dia, hoje) ? (
            <>
              <h4 className="pf-sub">{selecionado.registro ? 'Corrigir este dia' : 'Registrar este dia'}</h4>
              <FormularioRegistro key={`${selecionado.dia}|${selecionado.registro?.humor ?? ''}`} dia={selecionado.dia} inicial={selecionado.registro} rotuloBotao={selecionado.registro ? 'Atualizar registro' : 'Registrar'} idBase="pf" />
            </>
          ) : <p className="data">Só é possível registrar ou corrigir hoje e os {DIAS_CORRECAO} dias anteriores.</p>}
        </section>

        <section className="painel" aria-labelledby="pf-hist">
          <h3 id="pf-hist">Histórico dos últimos dias</h3>
          <div className="hist-w">
            <div className="hist-lab" aria-hidden="true"><i /><b>Humor</b></div>
            <div ref={rolagem} className="hist-rol" role="region" aria-label="Histórico dos últimos 28 dias; role para os lados para ver os dias anteriores">
              <table className="hist-t" onKeyDown={(e) => teclaGrupo(e, hist, 'button.hd')}>
                <thead><tr><td className="sr">Registro</td>
                  {hist.map((p) => (
                    <th key={p.dia} scope="col" className={p.dia === hoje ? 'hoje' : undefined}>
                      <button type="button" className="hd" aria-pressed={p.dia === selecionado.dia} tabIndex={p.dia === histAtivo ? 0 : -1} aria-label={textoDoDia(p, hoje)} title={textoDoDia(p, hoje)} data-dia={p.dia} onClick={() => escolher(p.dia)}>
                        <b>{p.dia === hoje ? 'hoje' : semanaAbreviada(p.dia)}</b><span>{dataCurta(p.dia)}</span>
                      </button>
                    </th>
                  ))}</tr></thead>
                <tbody>
                  <tr><th scope="row" className="sr">Humor</th>
                    {hist.map((p) => {
                      const nivel = p.registro?.humor ?? null;
                      return <td key={p.dia} className={`hc2${nivel ? '' : ' vazio'}`} data-dia={p.dia}>{!registroOk ? <span aria-label="Indisponível">?</span> : nivel ? <EmojiNivel nivel={nivel} alt={`Humor: ${ROTULO_HUMOR[nivel]}`} /> : <span title="Sem registro" aria-label="Sem registro">—</span>}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="acoes"><button type="button" className="btn mini" onClick={abrirCompletar}><Icone nome="clock" />Completar últimos dias</button></div>
        </section>

        <section className="painel">
          <p className="frase">{fraseDoDia(hojePt.concluidas)}</p>
          <p className="data pf-aviso">{AVISO_PERFIL}</p>
        </section>
        <div className="acoes"><button type="button" className="btn mini" onClick={() => { fecharPerfil(); router.push('/config'); }}><Icone nome="settings" />Abrir configurações</button></div>
      </aside>
    </div>
  );
}

/** O cartão de Configurações > Perfil: leva à mesma gaveta do avatar. */
export function SecaoPerfilConfig() {
  const { abrirPerfil } = useApp();
  return (
    <section className="cfg-bloco painel" aria-labelledby="cfg-perfil-t" data-secao="perfil">
      <h2 id="cfg-perfil-t" style={{ fontSize: 'calc(17px * var(--esc))', margin: '0 0 6px' }}>Perfil</h2>
      <p className="data">Humor e produtividade dos seus dias, com o gráfico semanal e mensal, o histórico e a correção dos últimos 5 dias. É privado: nada disso vai para a busca, a IA nem a cópia dos dados.</p>
      <div className="acoes"><button type="button" className="btn pri" onClick={abrirPerfil}>Abrir o Perfil</button></div>
    </section>
  );
}

/** O quadro de humor no Início: o que foi registrado hoje, o registro (ou a atualização) ali mesmo e o atalho para completar os dias pendentes. */
export function RegistroNoInicio() {
  const { registros, erroRegistros, carregandoRegistros, recarregarRegistros, hoje, dias, abrirCompletar, abrirPerfil } = useApp();
  const [aberto, setAberto] = useState(false);
  const reg = registros.find((r) => r.dia === hoje) ?? null;
  const pend = diasPendentes(hoje, registros, dias).length;
  return (
    <section className="sec" aria-labelledby="ini-hum-t" data-quadro="humor">
      <h3 id="ini-hum-t">Humor <small>só seu</small></h3>
      <div className="painel ini-reg">
        {erroRegistros ? (
          <div className="erro-carga" role="alert"><b>Não foi possível ler o humor agora.</b><button type="button" className="btn mini" onClick={() => void recarregarRegistros()}>Tentar de novo</button></div>
        ) : carregandoRegistros ? <p className="data" role="status">Carregando...</p> : (
          <>
            <div className="ini-reg-v">
              {reg ? (
                <span className="ini-reg-i"><EmojiNivel nivel={reg.humor} /><span>Humor: <b>{ROTULO_HUMOR[reg.humor]}</b></span></span>
              ) : <span>Sem registro hoje.</span>}
              <button type="button" className="btn mini" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{aberto ? 'Fechar' : reg ? 'Atualizar' : 'Registrar'}</button>
              <button type="button" className="btn mini" onClick={abrirPerfil}>Abrir o Perfil</button>
            </div>
            {aberto ? <FormularioRegistro key={`${hoje}|${reg?.humor ?? ''}`} dia={hoje} inicial={reg} rotuloBotao={reg ? 'Atualizar registro' : 'Registrar'} idBase="ini" aoGravar={() => setAberto(false)} /> : null}
            {pend ? <button type="button" className="pend" onClick={abrirCompletar}><Icone nome="clock" /><span>{pend === 1 ? 'Há 1 dia de trabalho sem registro. Completar (opcional)' : `Há ${pend} dias de trabalho sem registro. Completar (opcional)`}</span><Icone nome="right" /></button> : null}
          </>
        )}
      </div>
    </section>
  );
}
