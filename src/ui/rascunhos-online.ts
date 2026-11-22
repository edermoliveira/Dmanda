'use client';
// Liga o motor dos rascunhos online (lib/fila-rascunhos.ts) à interface (decisão 92). As janelas continuam lendo `rascunhos[chave]` e chamando `guardarRascunho(chave, r | null)`; por baixo, o banco é a fonte
// e o navegador guarda só a fila temporária de alterações pendentes, separada por usuário. Sem usuário identificado (antes da carga) nada é lido nem gravado.
import { useCallback, useEffect, useRef, useState } from 'react';
import { MotorRascunhos, CHAVE_FILA, type Api, type Dados, type EstadoRascunhos } from '@/lib/fila-rascunhos';
import { chamarRascunhos } from './rascunhos-api';

const api: Api = {
  listar: () => chamarRascunhos({ acao: 'listar' }) as ReturnType<Api['listar']>,
  salvar: (id, chave, dados, base, op) => chamarRascunhos({ acao: 'salvar', id, chave, dados, base, op }) as ReturnType<Api['salvar']>,
  resolver: (id, dados, base, op) => chamarRascunhos({ acao: 'resolver', id, dados, base, op }) as ReturnType<Api['resolver']>,
  encerrar: (id, chave, estado) => chamarRascunhos({ acao: 'encerrar', id, chave, estado }),
};
const armazem = {
  ler: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  gravar: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};
export type Instantaneo = { rascunhos: Record<string, Dados>; estado: EstadoRascunhos; conflitos: { chave: string; versao: number; outras: number }[]; pendentes: number };
const VAZIO: Instantaneo = { rascunhos: {}, estado: 'nenhum', conflitos: [], pendentes: 0 };

export function useRascunhosOnline(usuarioId: string | null) {
  const [snap, setSnap] = useState<Instantaneo>(VAZIO);
  const motor = useRef<MotorRascunhos | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!usuarioId) { motor.current = null; setSnap(VAZIO); return; }
    const exclusivo = <T,>(f: () => Promise<T>): Promise<T> => (typeof navigator !== 'undefined' && navigator.locks ? (navigator.locks.request(`dmanda-fila-${usuarioId}`, f) as unknown as Promise<T>) : f());
    const m = new MotorRascunhos({
      usuarioId, api, armazem, exclusivo,
      aoMudar: () => setSnap({ rascunhos: m.rascunhos(), estado: m.estado(), conflitos: m.conflitos(), pendentes: m.pendentes() }),
    });
    motor.current = m;
    setSnap({ rascunhos: m.rascunhos(), estado: m.estado(), conflitos: m.conflitos(), pendentes: m.pendentes() });   // o que estava na fila deste usuário aparece já, antes de falar com o banco
    void m.iniciar().catch(() => {});
    // reconexão e saída de cena: envia o que estiver pendente; outra aba do mesmo aparelho mexendo na fila: atualiza o que se vê
    const aoVoltar = () => { void m.sincronizar().then(() => m.enviarAgora()).catch(() => {}); };
    const aoSair = () => { if (document.visibilityState === 'hidden') void m.enviarAgora().catch(() => {}); else void m.sincronizar().catch(() => {}); };
    const aoOutraAba = (e: StorageEvent) => { if (e.key === CHAVE_FILA(usuarioId)) setSnap({ rascunhos: m.rascunhos(), estado: m.estado(), conflitos: m.conflitos(), pendentes: m.pendentes() }); };
    window.addEventListener('online', aoVoltar); document.addEventListener('visibilitychange', aoSair); window.addEventListener('pagehide', aoSair); window.addEventListener('storage', aoOutraAba);
    return () => { m.parar(); motor.current = null; window.removeEventListener('online', aoVoltar); document.removeEventListener('visibilitychange', aoSair); window.removeEventListener('pagehide', aoSair); window.removeEventListener('storage', aoOutraAba); };
  }, [usuarioId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const guardar = useCallback((chave: string, r: Dados | null) => { motor.current?.guardar(chave, r); }, []);
  const tentarDeNovo = useCallback(() => { void motor.current?.tentarDeNovo(); }, []);
  const resolver = useCallback((chave: string, escolha: 'meu' | 'outro') => { void motor.current?.resolver(chave, escolha); }, []);
  const sincronizar = useCallback(async () => { await motor.current?.sincronizar(); await motor.current?.enviarAgora(); }, []);
  return { ...snap, guardar, tentarDeNovo, resolver, sincronizar };
}
