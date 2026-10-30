'use client';
// Menu do avatar do topo (computador e celular). Por ora só tem "Sair"; o Perfil ainda não existe. Mesmo desenho e teclado do menu "Mover para".
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from './contexto';
import { sairDaConta } from '@/servidor/demandas';

export function MenuConta({ ponto, fechar }: { ponto: { x: number; y: number }; fechar: () => void }) {
  const { ambiente, avisar } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const gatilho = useRef<Element | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const teste = !!ambiente?.teste;

  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    gatilho.current = document.activeElement;
    const app = document.querySelector('.app')!.getBoundingClientRect();
    const w = m.offsetWidth;
    m.style.left = `${Math.min(Math.max(8, ponto.x - w), app.width - w - 8)}px`;
    m.style.top = `${ponto.y + 6}px`;
    (m.querySelector<HTMLElement>('button:not([aria-disabled="true"])') ?? m).focus();
  }, [ponto]);

  useEffect(() => {
    const fora = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest?.('.mv-menu') && !t.closest?.('.perfil-b')) fechar(); };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); const g = gatilho.current as HTMLElement | null; fechar(); setTimeout(() => g?.focus?.(), 0); }
      if (e.key === 'Tab') fechar();
    };
    document.addEventListener('click', fora, true); document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('click', fora, true); document.removeEventListener('keydown', tecla, true); };
  }, [fechar]);

  const sair = async () => {
    if (saindo || teste) return;
    setSaindo(true);
    const r = await sairDaConta().catch(() => ({ ok: false as const, erro: 'Não foi possível sair agora. Tente de novo.', sessaoLocalEncerrada: false }));
    if (!r.ok && !r.sessaoLocalEncerrada) { setSaindo(false); fechar(); avisar(r.erro, true); return; }
    // navegação completa que troca a entrada do histórico: descarta o estado da interface (demandas na memória) e o proxy exige novo login.
    // Se o servidor de Auth não confirmou o encerramento (a sessão deste navegador já foi apagada), o login diz isso em vez de fingir sucesso.
    window.location.replace(r.ok ? '/login?saiu=1' : '/login?saiu=parcial');
  };

  // Cópia dos dados: baixa o JSON pela rota /api/exportar. Só avisa sucesso depois de receber o arquivo; sessão encerrada vai ao login.
  const baixar = async () => {
    if (baixando) return;
    setBaixando(true);
    try {
      const r = await fetch('/api/exportar', { cache: 'no-store', redirect: 'manual' });
      if (r.type === 'opaqueredirect') { window.location.replace('/login?encerrada=1'); return; }
      if (!r.ok) throw new Error('falha');
      const nome = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? 'dmanda-copia.json';
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      fechar(); avisar('Cópia baixada: ' + nome + '. Guarde em um lugar privado; ela tem seus dados reais.');
    } catch {
      fechar(); avisar('Não foi possível gerar a cópia agora. Nada foi baixado. Tente de novo.', true);
    } finally { setBaixando(false); }
  };

  return (
    <div ref={ref} className="mv-menu" role="menu" aria-label="Conta">
      <div className="mv-t">{ambiente?.nome || 'Conta'}</div>
      <button type="button" role="menuitem" aria-disabled={baixando || undefined} onClick={() => void baixar()}>
        <span>{baixando ? 'Gerando...' : 'Baixar cópia dos dados'}</span><small>arquivo JSON</small>
      </button>
      <button type="button" role="menuitem" aria-disabled={saindo || teste || undefined} onClick={() => void sair()}>
        <span>{saindo ? 'Saindo...' : 'Sair'}</span><small>{teste ? 'indisponível no teste' : 'só neste navegador'}</small>
      </button>
    </div>
  );
}
