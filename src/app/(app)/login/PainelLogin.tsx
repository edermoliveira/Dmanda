'use client';
import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';

// O login fica fora da casca do painel, mas usa os mesmos tokens e botões do Catalyst, que só valem dentro de ".app[data-dir="d"]".
// O modo (claro ou escuro) vem do atributo que o script do layout já definiu antes de a página aparecer; no servidor e na hidratação vale "claro".
const assinar = (aviso: () => void) => { const o = new MutationObserver(aviso); o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] }); return () => o.disconnect(); };
const ler = () => (document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro');

export function PainelLogin({ children }: { children: ReactNode }) {
  const tema = useSyncExternalStore(assinar, ler, () => 'claro');
  return (
    <div className="app app-login" data-dir="d" data-tema={tema} data-ico="fino"
      style={{ '--font': 'var(--f-inter), system-ui, sans-serif', '--font-h': 'var(--f-inter), system-ui, sans-serif', '--font-ui': 'var(--f-inter), system-ui, sans-serif', '--font-n': 'var(--f-mono), ui-monospace, monospace' } as CSSProperties}>
      {children}
    </div>
  );
}
