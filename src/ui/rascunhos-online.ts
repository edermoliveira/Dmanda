'use client';
// Liga o motor dos rascunhos online (lib/fila-rascunhos.ts) à interface (decisão 92). As janelas continuam lendo `rascunhos[chave]` e chamando `guardarRascunho(chave, r | null)`; por baixo, o banco é a fonte
// e o navegador guarda só a fila temporária de alterações pendentes, separada por usuário e com o dono identificado. Sem usuário identificado (antes da carga) nada é lido nem gravado.
// Cada envio leva o dono da fila: se a sessão deste navegador passou a ser de OUTRA conta, o servidor recusa e o motor para (a fila continua guardada para a dona, sem ir em nome de ninguém).
import { useCallback, useEffect, useRef, useState } from 'react';
import { MotorRascunhos, CHAVE_FILA, type Api, type Bloqueio, type Dados, type EstadoRascunho, type EstadoRascunhos } from '@/lib/fila-rascunhos';
import { chamarRascunhos } from './rascunhos-api';

const apiDe = (dono: string): Api => ({
  listar: () => chamarRascunhos({ acao: 'listar', dono }) as ReturnType<Api['listar']>,
  salvar: (id, chave, dados, base, op) => chamarRascunhos({ acao: 'salvar', dono, id, chave, dados, base, op }) as ReturnType<Api['salvar']>,
  resolver: (id, dados, base, op) => chamarRascunhos({ acao: 'resolver', dono, id, dados, base, op }) as ReturnType<Api['resolver']>,
  encerrar: (id, chave, estado) => chamarRascunhos({ acao: 'encerrar', dono, id, chave, estado }),
});
const armazem = {
  ler: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  gravar: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};
export type Instantaneo = {
  rascunhos: Record<string, Dados>; estado: EstadoRascunhos; porChave: Record<string, EstadoRascunho>; conflitos: { chave: string; versao: number; outras: number }[];
  pendentes: number; bloqueio: Bloqueio | null; pronto: boolean; dono: { id: string; email: string | null } | null;
};
const VAZIO: Instantaneo = { rascunhos: {}, estado: 'nenhum', porChave: {}, conflitos: [], pendentes: 0, bloqueio: null, pronto: false, dono: null };
const foto = (m: MotorRascunhos): Instantaneo => ({ rascunhos: m.rascunhos(), estado: m.estado(), porChave: m.porChave(), conflitos: m.conflitos(), pendentes: m.pendentes(), bloqueio: m.bloqueio, pronto: m.pronto, dono: m.dono() });

/** Avisa o aplicativo de que o banco recusou a identidade (acesso revogado): a tela de acesso revogado assume. */
export const avisarRevogado = () => { try { window.dispatchEvent(new CustomEvent('dmanda:revogado')); } catch { /* fora do navegador */ } };

export function useRascunhosOnline(usuarioId: string | null, email: string | null) {
  const [snap, setSnap] = useState<Instantaneo>(VAZIO);
  const motor = useRef<MotorRascunhos | null>(null);
  const emailRef = useRef(email);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!usuarioId) { motor.current = null; setSnap(VAZIO); return; }
    const exclusivo = <T,>(f: () => Promise<T>): Promise<T> => (typeof navigator !== 'undefined' && navigator.locks ? (navigator.locks.request(`dmanda-fila-${usuarioId}`, f) as unknown as Promise<T>) : f());
    let avisou = false;
    const m = new MotorRascunhos({
      usuarioId, email: emailRef.current, api: apiDe(usuarioId), armazem, exclusivo,
      aoMudar: () => { setSnap(foto(m)); if (m.bloqueio === 'revogado' && !avisou) { avisou = true; avisarRevogado(); } },
    });
    motor.current = m;
    setSnap(foto(m));   // o que estava na fila deste usuário aparece já, antes de falar com o banco
    void m.iniciar().catch(() => {});
    const limitePronto = setTimeout(() => m.forcarPronto(), 4000);   // rede presa não pode impedir de abrir as janelas
    // reconexão e saída de cena: envia o que estiver pendente; ao voltar ao primeiro plano relê o banco; outra aba do mesmo aparelho mexendo na fila: atualiza o que se vê
    const aoVoltar = () => { void m.sincronizar().then(() => m.enviarAgora()).catch(() => {}); };
    const aoSair = () => { if (document.visibilityState === 'hidden') void m.enviarAgora().catch(() => {}); else void m.sincronizar().catch(() => {}); };
    const aoOutraAba = (e: StorageEvent) => { if (e.key === CHAVE_FILA(usuarioId)) setSnap(foto(m)); };
    window.addEventListener('online', aoVoltar); document.addEventListener('visibilitychange', aoSair); window.addEventListener('pagehide', aoSair); window.addEventListener('storage', aoOutraAba);
    return () => { clearTimeout(limitePronto); m.parar(); motor.current = null; window.removeEventListener('online', aoVoltar); document.removeEventListener('visibilitychange', aoSair); window.removeEventListener('pagehide', aoSair); window.removeEventListener('storage', aoOutraAba); };
  }, [usuarioId]);
  useEffect(() => { emailRef.current = email; motor.current?.definirEmail(email); }, [email]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const guardar = useCallback((chave: string, r: Dados | null) => { motor.current?.guardar(chave, r); }, []);
  const tentarDeNovo = useCallback(() => { void motor.current?.tentarDeNovo(); }, []);
  const resolver = useCallback((chave: string, escolha: 'meu' | 'outro') => { void motor.current?.resolver(chave, escolha); }, []);
  const sincronizar = useCallback(async () => { await motor.current?.sincronizar(); await motor.current?.enviarAgora(); }, []);
  return { ...snap, guardar, tentarDeNovo, resolver, sincronizar };
}
