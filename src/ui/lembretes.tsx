'use client';
// Lembretes discretos de humor: o balão (na entrada do dia e a cada 3 horas de trabalho) e o convite para completar os dias de trabalho sem registro.
// As regras do relógio estão em lib/lembretes.ts (puras e testadas); aqui ficam só o tique, o armazenamento no aparelho e a interface.
// O estado guardado (dmanda:lembretes) tem contagens e datas, nunca o humor. Duas abas do mesmo aparelho dividem o mesmo estado e se revezam por um travamento
// do navegador (Web Locks), então um lembrete não aparece duas vezes nem se perde. Cada aparelho tem o seu relógio; o registro do dia, esse sim, vale para todos (está no banco).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from './contexto';
import { Icone } from './Icone';
import { Janela } from './janela-base';
import { EscalaCinco, FormularioRegistro } from './escala';
import { hojeISO } from '@/lib/demandas';
import { estadoInicial, intervaloEmSegundos, lerEstado, OCIOSO_MS, resolver, tique, type EstadoLembretes, type Pendente } from '@/lib/lembretes';
import { diasPendentes, diaPorExtenso, type Nivel } from '@/lib/registros';

const CHAVE = 'dmanda:lembretes';
const TIQUE_MS = 30_000;
const lerDoAparelho = (dia: string, agora: number): EstadoLembretes => { try { return lerEstado(JSON.parse(localStorage.getItem(CHAVE) ?? 'null'), dia, agora); } catch { return estadoInicial(dia, agora); } };
const gravarNoAparelho = (s: EstadoLembretes) => { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch { /* sem armazenamento: o lembrete vale só nesta visita */ } };
/** Uma aba por vez mexe no estado (se o navegador não tiver o travamento, segue sem ele). */
const exclusivo = async (f: () => void) => { if (typeof navigator !== 'undefined' && navigator.locks?.request) await navigator.locks.request('dmanda-lembretes', f); else f(); };

export function Lembretes({ ocupado }: { ocupado: boolean }) {
  const { registros, carregandoRegistros, erroRegistros, dias, janela, perfilAberto, completarAberto, abrirCompletar, hoje, avisar, ambiente, prefsPerfil, prefsProntas } = useApp();
  const [pendente, setPendente] = useState<Pendente>(null);
  const [convidar, setConvidar] = useState(false);
  const atividade = useRef(0);
  // o tique lê sempre o que há de mais novo sem recriar o relógio
  const dados = useRef({ registros, dias, carregado: false, intervaloS: intervaloEmSegundos(prefsPerfil.balaoH) });
  useEffect(() => { dados.current = { registros, dias, intervaloS: intervaloEmSegundos(prefsPerfil.balaoH), carregado: !carregandoRegistros && !erroRegistros && !!ambiente && ambiente.semLembretes !== true }; });

  const rodar = useCallback(() => exclusivo(() => {
    const d = dados.current;
    if (!d.carregado) return;
    const agora = Date.now(), dia = hojeISO(new Date(agora));
    const out = tique(lerDoAparelho(dia, agora), {
      agora, dia, visivel: document.visibilityState === 'visible', ativo: agora - atividade.current <= OCIOSO_MS, carregado: true,
      registradoHoje: d.registros.some((r) => r.dia === dia), temPendencias: diasPendentes(dia, d.registros, d.dias).length > 0, intervaloS: d.intervaloS,
    });
    if (out.mudou) gravarNoAparelho(out.estado);
    setPendente(out.estado.pendente);
    if (out.convidar) setConvidar(true);
  }), []);

  // uso do aparelho: toque, tecla, mouse ou rolagem renovam o "em uso" (o tique só conta tempo enquanto há uso nos últimos 15 minutos)
  useEffect(() => {
    atividade.current = Date.now();
    const marcar = () => { atividade.current = Date.now(); };
    const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;
    for (const e of eventos) document.addEventListener(e, marcar, { passive: true, capture: true });
    return () => { for (const e of eventos) document.removeEventListener(e, marcar, { capture: true }); };
  }, []);

  // o relógio: um tique ao abrir (assim que os registros foram lidos), a cada 30 s e ao voltar para a aba
  // `semLembretes` só existe em teste automatizado (ver servidor/demandas.ts); sem o ambiente lido, o relógio espera
  const carregado = !carregandoRegistros && !erroRegistros && !!ambiente && ambiente.semLembretes !== true && prefsProntas;
  useEffect(() => {
    if (!carregado) return;
    void rodar();
    const relogio = setInterval(() => void rodar(), TIQUE_MS);
    const voltou = () => { if (document.visibilityState === 'visible') { atividade.current = Date.now(); void rodar(); } };
    document.addEventListener('visibilitychange', voltou);
    return () => { clearInterval(relogio); document.removeEventListener('visibilitychange', voltou); };
  }, [carregado, rodar]);

  // outra aba respondeu ou gerou um lembrete: esta acompanha
  useEffect(() => {
    const f = (e: StorageEvent) => { if (e.key !== CHAVE) return; try { setPendente(lerEstado(JSON.parse(e.newValue ?? 'null'), hojeISO(), Date.now()).pendente); } catch { /* ignora */ } };
    addEventListener('storage', f);
    return () => removeEventListener('storage', f);
  }, []);

  const resolverPendente = useCallback(() => {
    setPendente(null);
    void exclusivo(() => { const agora = Date.now(), dia = hojeISO(new Date(agora)); gravarNoAparelho(resolver(lerDoAparelho(dia, agora))); });
  }, []);

  // registrar hoje pelo Início, pelo Perfil ou por outra janela também responde ao lembrete pendente (senão ele pediria de novo o que acabou de ser registrado)
  useEffect(() => {
    const f = (e: Event) => { if (((e as CustomEvent<string[]>).detail ?? []).includes(hojeISO())) resolverPendente(); };
    addEventListener('dmanda:registro-gravado', f);
    return () => removeEventListener('dmanda:registro-gravado', f);
  }, [resolverPendente]);

  // o convite espera a pessoa terminar o que está fazendo (janela, busca ou Perfil abertos): abre sozinho depois, uma vez
  const livre = !janela && !perfilAberto && !completarAberto && !ocupado;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- consome o convite pendente no instante em que a tela fica livre (passa a janela do contexto e zera o pedido)
  useEffect(() => { if (convidar && livre) { setConvidar(false); abrirCompletar(); } }, [convidar, livre, abrirCompletar]);

  const registroHoje = registros.find((r) => r.dia === hoje) ?? null;
  const mostrar = pendente !== null && livre && !convidar;
  return (
    <>
      {mostrar ? (
        <aside className="balao lg" aria-label="Registro rápido de humor" data-lembrete={pendente}>
          <button type="button" className="icbtn-s" aria-label="Fechar o lembrete" onClick={resolverPendente}><Icone nome="x" /></button>
          <b>{pendente === 'entrada' ? 'Como você começa o dia?' : 'Como você está agora?'}</b>
          <p className="data">Opcional. Escolher um nível já registra.</p>
          <FormularioRegistro key={`${hoje}|${registroHoje?.humor ?? ''}`} dia={hoje} inicial={registroHoje} automatico mini idBase="bal" aoGravar={() => { avisar('Humor registrado'); resolverPendente(); }} />
        </aside>
      ) : null}
      {completarAberto ? <JanelaCompletar /> : null}
    </>
  );
}

// ---------- Completar os últimos dias ----------
type Escolha = { h?: Nivel };
export function JanelaCompletar() {
  const { registros, dias, hoje, fecharCompletar, registrarDias, avisar, erroRegistros } = useApp();
  const lista = diasPendentes(hoje, registros, dias);
  const [sel, setSel] = useState<Record<string, Escolha>>({});
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState('');
  const trava = useRef(false);
  const completos = lista.filter((d) => sel[d]?.h);
  const sujo = Object.keys(sel).length > 0;
  const escolher = (d: string, n: Nivel) => { setSel((s) => ({ ...s, [d]: { h: n } })); setErro(''); };
  const salvar = async () => {
    if (trava.current || !completos.length) return;
    trava.current = true; setGravando(true); setErro('');
    const r = await registrarDias(completos.map((d) => ({ dia: d, humor: sel[d]!.h! })));
    trava.current = false; setGravando(false);
    if (!r.ok) { setErro(r.erro); return; }   // as escolhas continuam na tela
    avisar(completos.length === 1 ? 'Dia registrado' : `${completos.length} dias registrados`);
    setSel((s) => { const n = { ...s }; for (const d of completos) delete n[d]; return n; });
    if (completos.length === lista.length) fecharCompletar();
  };
  return (
    <Janela titulo="Completar os últimos dias" foco="janela" aoFechar={fecharCompletar} sujo={sujo}
      rodape={<><span className="esp" /><button type="button" className="btn" onClick={fecharCompletar}>Agora não</button><button type="button" className="btn pri" disabled={gravando || !completos.length} onClick={() => void salvar()}>{gravando ? 'Gravando...' : completos.length > 1 ? `Salvar ${completos.length} dias` : 'Salvar'}</button></>}>
      <p className="data">Opcional. Só aparecem os dias de trabalho dos últimos 5 dias que ainda não têm registro (sábados, domingos e feriados cadastrados ficam de fora). Escolha o humor de cada dia que quiser.</p>
      {erroRegistros ? <p className="reg-erro" role="alert">Não foi possível ler os seus registros agora. Os dias abaixo podem já ter registro.</p> : null}
      {lista.length ? lista.map((d) => {
        const s = sel[d] ?? {};
        return (
          <div key={d} className="dia-l" data-dia={d}>
            <b>{diaPorExtenso(d).replace(/^./, (c) => c.toUpperCase())}</b>
            <div className="reg-l"><span>Humor</span><EscalaCinco valor={s.h ?? null} aoEscolher={(n) => escolher(d, n)} rotulo={`Humor de ${diaPorExtenso(d)}`} mini desativada={gravando} /></div>
          </div>
        );
      }) : <p className="vazio-c" role="status">Tudo em dia: não há dia de trabalho sem registro nos últimos 5 dias.</p>}
      {erro ? <p className="reg-erro" role="alert">{erro} As escolhas continuam aqui.</p> : null}
    </Janela>
  );
}
