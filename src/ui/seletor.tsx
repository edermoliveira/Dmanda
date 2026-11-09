'use client';
// Dropdown Catalyst de uma opção cadastrável (origem da solicitação e tipo do documento): o botão mostra o valor escolhido, o popover fica ancorado ao botão com a lista (a escolhida
// marcada), e o rodapé tem "+ Nova origem" (ou "+ Criar tipo"), que abre um campo ali mesmo: o nome só é escolhido depois que o banco confirma a gravação.
// Teclado: seta para baixo ou para cima abre; setas movem; Enter ou Espaço escolhem; Esc fecha (ou cancela a criação) e devolve o foco ao botão; Tab fecha. Toque: linhas de 44 px.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { chaveOpcao } from '@/lib/documentos';

export type CampoOpcao = 'origem' | 'tipo';
const TEXTOS: Record<CampoOpcao, { vazio: string; criar: string; placeholder: string; erroNome: string }> = {
  origem: { vazio: 'Sem origem', criar: '+ Nova origem', placeholder: 'Nome da nova origem', erroNome: 'Digite o nome da origem.' },
  tipo: { vazio: 'Sem documento', criar: '+ Criar tipo', placeholder: 'Nome do novo tipo de documento', erroNome: 'Digite o nome do tipo de documento.' },
};

export function SeletorOpcao({ campo, rotulo, valor, aoEscolher, id }: { campo: CampoOpcao; rotulo: string; valor: string; aoEscolher: (nome: string) => void; id: string }) {
  const { opcoes, criarOpcao } = useApp();
  const t = TEXTOS[campo];
  const [aberto, setAberto] = useState(false), [ativo, setAtivo] = useState(0), [criando, setCriando] = useState(false);
  const [nome, setNome] = useState(''), [erro, setErro] = useState(''), [gravando, setGravando] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; largura: number } | null>(null);
  const gatilho = useRef<HTMLButtonElement>(null), pop = useRef<HTMLDivElement>(null), campoNome = useRef<HTMLInputElement>(null), trava = useRef(false);
  const lista = opcoes[campo].map((o) => o.nome);
  // um valor antigo que não está na lista continua visível e escolhido (nada é perdido nem trocado sem querer)
  const itens = valor && !lista.some((n) => chaveOpcao(n) === chaveOpcao(valor)) ? [valor, ...lista] : lista;
  const escolhido = valor ? itens.findIndex((n) => chaveOpcao(n) === chaveOpcao(valor)) : -1;
  const base = useId(), idLista = `${base}-lista`;

  const fechar = useCallback((devolverFoco = true) => { setAberto(false); setPos(null); setCriando(false); setErro(''); setNome(''); if (devolverFoco) gatilho.current?.focus(); }, []);
  const abrir = () => { setAtivo(Math.max(escolhido + 1, 0)); setCriando(false); setErro(''); setAberto(true); };

  // ancora o popover ao botão (relativo ao .app, como o menu de filtros); sem espaço embaixo, abre para cima
  useLayoutEffect(() => {
    if (!aberto) return;
    const ancorar = () => {
      const app = document.querySelector('.app')!.getBoundingClientRect(), b = gatilho.current!.getBoundingClientRect(), h = pop.current?.offsetHeight ?? 260;
      const abaixo = innerHeight - b.bottom, top = abaixo < h + 12 && b.top > h + 12 ? b.top - app.top - h - 6 : b.bottom - app.top + 6;
      setPos({ left: b.left - app.left, top, largura: b.width });
    };
    ancorar();
    window.addEventListener('resize', ancorar); document.addEventListener('scroll', ancorar, true);
    return () => { window.removeEventListener('resize', ancorar); document.removeEventListener('scroll', ancorar, true); };
  }, [aberto, criando]);
  // o popover só aceita foco depois de ancorado (antes disso fica oculto)
  const ancorado = pos !== null;
  useEffect(() => { if (aberto && ancorado && !criando) pop.current?.focus(); }, [aberto, ancorado, criando]);
  useEffect(() => { if (criando) campoNome.current?.focus(); }, [criando]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { const el = e.target as Node; if (!pop.current?.contains(el) && !gatilho.current?.contains(el)) fechar(false); };
    // Esc só fecha este popover (não a janela por baixo): cancela a criação primeiro; depois fecha e devolve o foco ao botão
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (criando) { setCriando(false); setErro(''); setNome(''); queueMicrotask(() => pop.current?.focus()); } else fechar();
    };
    document.addEventListener('mousedown', fora, true); document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('mousedown', fora, true); document.removeEventListener('keydown', tecla, true); };
  }, [aberto, criando, fechar]);

  const escolher = (n: string) => { aoEscolher(n); fechar(); };
  // posição 0 = "sem valor"; 1..n = as opções
  const total = itens.length + 1;
  const teclaLista = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => (a + 1) % total); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => (a - 1 + total) % total); }
    else if (e.key === 'Home') { e.preventDefault(); setAtivo(0); }
    else if (e.key === 'End') { e.preventDefault(); setAtivo(total - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(ativo === 0 ? '' : itens[ativo - 1]); }
    else if (e.key === 'Tab') fechar(false);
  };
  const salvar = async () => {
    if (trava.current) return;
    if (!nome.trim()) { setErro(t.erroNome); campoNome.current?.focus(); return; }
    trava.current = true; setGravando(true); setErro('');
    const r = await criarOpcao(campo, nome);
    trava.current = false; setGravando(false);
    if (r.ok) escolher(r.opcao.nome); else { setErro(r.erro); campoNome.current?.focus(); }
  };
  const alvo = typeof document === 'undefined' ? null : document.querySelector('.app');
  return (
    <>
      <button ref={gatilho} id={id} type="button" className={`sel-trig${valor ? '' : ' vazio'}`} aria-haspopup="listbox" aria-expanded={aberto} aria-controls={aberto ? idLista : undefined} aria-label={`${rotulo}: ${valor || t.vazio}`}
        onClick={() => (aberto ? fechar() : abrir())} onKeyDown={(e) => { if (!aberto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); abrir(); } }}>
        <span className="sel-v">{valor || t.vazio}</span><Icone nome="chevron-down" />
      </button>
      {aberto && alvo ? createPortal(
        <div ref={pop} className="mv-menu sel-pop" tabIndex={-1} role="group" aria-label={rotulo} aria-activedescendant={`${base}-o${ativo}`} data-campo={campo}
          style={pos ? { left: pos.left, top: pos.top, minWidth: Math.max(pos.largura, 240) } : { visibility: 'hidden' }} onKeyDown={criando ? undefined : teclaLista}>
          <div className="mv-t" id={`${base}-t`}>{rotulo}</div>
          <ul id={idLista} role="listbox" aria-labelledby={`${base}-t`} className="sel-lista">
            {[t.vazio, ...itens].map((n, i) => {
              const marcado = i === 0 ? !valor : i - 1 === escolhido;
              return (
                <li key={`${i}-${n}`} id={`${base}-o${i}`} role="option" aria-selected={marcado} data-ativo={i === ativo} className={`sel-op${i === 0 ? ' sem' : ''}`}
                  onMouseEnter={() => setAtivo(i)} onClick={() => escolher(i === 0 ? '' : n)}>
                  <span className="sel-ck">{marcado ? <Icone nome="check" /> : null}</span><span>{n}</span>
                </li>
              );
            })}
          </ul>
          <div className="sel-rodape">
            {criando ? (
              <div className="sel-novo">
                <input ref={campoNome} value={nome} maxLength={80} placeholder={t.placeholder} aria-label={t.placeholder} aria-invalid={!!erro} aria-describedby={erro ? `${base}-e` : undefined} autoComplete="off" disabled={gravando}
                  onChange={(e) => { setNome(e.target.value); setErro(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void salvar(); } }} />
                <div className="sel-acoes">
                  <button type="button" className="btn mini" disabled={gravando} onClick={() => { setCriando(false); setErro(''); setNome(''); queueMicrotask(() => pop.current?.focus()); }}>Cancelar</button>
                  <button type="button" className="btn mini pri" disabled={gravando} onClick={() => void salvar()}>{gravando ? 'Gravando...' : 'Salvar'}</button>
                </div>
                {erro ? <p className="sel-erro" id={`${base}-e`} role="alert">{erro}</p> : null}
              </div>
            ) : <button type="button" className="sel-criar" onClick={() => { setCriando(true); setErro(''); }}>{t.criar}</button>}
          </div>
        </div>, alvo) : null}
    </>
  );
}
