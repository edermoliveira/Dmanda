'use client';
// Configurações > Aparência: modo claro ou escuro, tamanho do texto com prévia, cores do tema por tokens e restauração do padrão Órbita.
// Tudo fica só neste aparelho (localStorage); nada disso vai ao banco. Combinação com contraste insuficiente é recusada com explicação.
import { useState } from 'react';
import { useApp } from './contexto';
import { ESCALA_MAX, ESCALA_MIN, ESCALA_PASSO, PADRAO, ROTULO_TOKEN, problemaDeContraste, type TokenCor } from '@/lib/aparencia';

const TOKENS: TokenCor[] = ['fundo', 'texto', 'acento'];

export function Aparencia() {
  const { tema, definirTema, escala, definirEscala, cores, definirCor, restaurarAparencia } = useApp();
  const [erro, setErro] = useState('');
  const atuais = cores[tema] ?? {};
  const mudou = Object.values(cores).some((m) => m && Object.keys(m).length > 0) || escala !== 1; // qualquer modo, não só o atual
  const escolher = (t: TokenCor, valor: string) => {
    const p = problemaDeContraste(tema, { ...atuais, [t]: valor });
    if (p) { setErro(`${ROTULO_TOKEN[t]}: ${p} A cor anterior foi mantida.`); return; }
    setErro(''); definirCor(tema, t, valor);
  };
  return (
    <section className="cfg-bloco" aria-labelledby="cfg-ap-t">
      <h2 id="cfg-ap-t" style={{ fontSize: 'calc(17px * var(--esc))', margin: '0 0 6px' }}>Aparência</h2>
      <p className="data">Vale só neste aparelho. Cada aparelho guarda a própria escolha. O padrão Órbita continua valendo até você mudar alguma coisa.</p>
      <div className="ap-grade">
        <div className="ap-linha">
          <span className="rot" id="ap-modo">Modo</span>
          <div className="ap-seg" role="group" aria-labelledby="ap-modo">
            <button type="button" aria-pressed={tema === 'claro'} onClick={() => definirTema('claro')}>Claro</button>
            <button type="button" aria-pressed={tema === 'escuro'} onClick={() => definirTema('escuro')}>Escuro</button>
          </div>
        </div>
        <div className="ap-linha">
          <label htmlFor="ap-escala">Tamanho do texto</label>
          <div className="ap-escala">
            <input id="ap-escala" type="range" min={ESCALA_MIN} max={ESCALA_MAX} step={ESCALA_PASSO} value={escala} onChange={(e) => definirEscala(Number(e.target.value))} aria-valuetext={`${Math.round(escala * 100)}%`} />
            <output htmlFor="ap-escala">{Math.round(escala * 100)}%</output>
          </div>
          <div className="ap-previa" aria-live="off">
            <b>Ofício 214/2026</b>
            <span className="data">Prazo em 5 dias · 2 de 4 tarefas concluídas</span>
          </div>
        </div>
        <div className="ap-linha">
          <span className="rot">Cores do modo {tema}</span>
          <div className="ap-cor">
            {TOKENS.map((t) => (
              <label key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input type="color" aria-label={`Cor de ${ROTULO_TOKEN[t].toLowerCase()} no modo ${tema}`} value={(atuais[t] ?? PADRAO[tema][t]).toLowerCase()} onChange={(e) => escolher(t, e.target.value)} />
                <span>{ROTULO_TOKEN[t]} <span className="hex">{(atuais[t] ?? PADRAO[tema][t]).toUpperCase()}</span></span>
              </label>
            ))}
          </div>
        </div>
        {erro ? <p className="ap-aviso" role="alert">{erro}</p> : null}
        <div className="ap-linha">
          <button type="button" className="btn" disabled={!mudou} onClick={() => { setErro(''); restaurarAparencia(); }}>Restaurar padrão Órbita</button>
        </div>
      </div>
    </section>
  );
}
