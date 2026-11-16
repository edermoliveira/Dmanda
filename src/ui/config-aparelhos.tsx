'use client';
// Configurações, Aparelhos (decisão 82): quem pode abrir o Dmanda direto. Lista os aparelhos autorizados (nome, último uso, validade), gera o código de uso único para autorizar outro
// aparelho (10 minutos) e revoga um aparelho específico. Só um aparelho já autorizado chega aqui; o banco recusa os demais. Revogar o aparelho em uso leva à tela de acesso.
import { useCallback, useEffect, useRef, useState } from 'react';
import { criarConvite, listarAparelhos, revogarAparelho } from '@/servidor/aparelhos';
import { VALIDADE_APARELHO_DIAS, VALIDADE_CONVITE_MINUTOS, haQuanto } from '@/lib/aparelho';
import { dataBR } from '@/lib/demandas';

type Aparelho = { id: string; nome: string; criado_em: string; ultimo_uso: string; expira_em: string; revogado_em: string | null; atual: boolean };
type Convite = { codigo: string; expira_em: string };

export function SecaoAparelhos() {
  const [lista, setLista] = useState<Aparelho[] | null>(null);
  const [erro, setErro] = useState('');
  const [convite, setConvite] = useState<Convite | null>(null);
  const [gerando, setGerando] = useState(false);
  const [agora, setAgora] = useState<number | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const trava = useRef(false);

  const carregar = useCallback(async () => {
    const r = await listarAparelhos();
    if (r.ok) { setLista(r.dados); setErro(''); } else { setErro(r.erro); setLista((l) => l ?? []); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void carregar(), 0); return () => clearTimeout(t); }, [carregar]);
  // o relógio só existe no navegador (a renderização do servidor não usa a data de hoje)
  useEffect(() => { const t0 = setTimeout(() => setAgora(Date.now()), 0); const t = setInterval(() => setAgora(Date.now()), 15_000); return () => { clearTimeout(t0); clearInterval(t); }; }, []);

  const gerar = async () => {
    if (trava.current) return;
    trava.current = true; setGerando(true); setErro('');
    const r = await criarConvite();
    trava.current = false; setGerando(false);
    if (r.ok) { setConvite(r.dados); setAgora(Date.now()); } else setErro(r.erro);
  };
  const revogar = async (a: Aparelho) => {
    setRevogando(a.id);
    const r = await revogarAparelho(a.id);
    setRevogando(null); setConfirmando(null);
    if (!r.ok) { setErro(r.erro); return; }
    if (r.dados.atual) { window.location.replace('/acesso?saiu=1'); return; }
    await carregar();
  };

  const faltam = convite && agora !== null ? Math.max(0, Math.ceil((new Date(convite.expira_em).getTime() - agora) / 60_000)) : null;
  const vencido = convite !== null && faltam === 0;
  const ativos = (lista ?? []).filter((a) => !a.revogado_em && new Date(a.expira_em).getTime() > (agora ?? 0));
  const outros = (lista ?? []).filter((a) => !ativos.includes(a));

  return (
    <section className="cfg-bloco painel cfg-aparelhos" aria-labelledby="cfg-apar-dev-t" data-aparelhos>
      <h2 id="cfg-apar-dev-t" style={{ fontSize: 'calc(17px * var(--esc))', margin: '0 0 6px' }}>Aparelhos</h2>
      <p className="data">O Dmanda abre direto nos aparelhos autorizados, sem e-mail nem senha. Para autorizar outro aparelho, gere um código aqui e digite-o nele (vale {VALIDADE_CONVITE_MINUTOS} minutos e uma só vez). Cada aparelho vale por {VALIDADE_APARELHO_DIAS} dias sem uso. O app instalado na tela de início do iPhone é um aparelho à parte e precisa do próprio código.</p>
      <div className="cfg-apar-convite">
        <button type="button" className="btn pri" disabled={gerando} onClick={() => void gerar()} data-gerar-convite>{gerando ? 'Gerando...' : convite && !vencido ? 'Gerar outro código' : 'Autorizar outro aparelho'}</button>
        {convite && !vencido ? (
          <p className="cfg-codigo" role="status" data-codigo-convite><span className="mono">{convite.codigo}</span><small className="data">{faltam === null ? '' : faltam <= 1 ? 'vale por menos de 1 minuto' : `vale por mais ${faltam} minutos`}</small></p>
        ) : convite ? <p className="data" role="status">O código venceu. Gere outro.</p> : null}
      </div>
      {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)' }}>{erro}</p> : null}
      <h3 className="cfg-dias-h">Aparelhos autorizados{lista ? <small className="data"> {ativos.length}</small> : null}</h3>
      {lista === null ? <p className="data">Carregando...</p> : !ativos.length ? <p className="data">Nenhum aparelho registrado ainda. Autorize este e os outros com um código.</p> : (
        <ul className="cfg-apar-lista" aria-label="Aparelhos autorizados">
          {ativos.map((a) => (
            <li key={a.id} data-aparelho={a.id} data-atual={a.atual || undefined}>
              <span className="cfg-apar-nome"><b>{a.nome}</b>{a.atual ? <span className="chip neutro">Este aparelho</span> : null}</span>
              <span className="data">Último uso {agora === null ? '' : haQuanto(a.ultimo_uso, new Date(agora))} · válido até {dataBR(a.expira_em.slice(0, 10))}</span>
              {confirmando === a.id ? (
                <span className="cfg-acoes cfg-confirma">
                  <span className="data">{a.atual ? 'Revogar este aparelho? Você sai do Dmanda aqui e precisará de um código novo.' : 'Revogar este aparelho? Ele perde o acesso na hora.'}</span>
                  <button type="button" className="btn mini perigo" disabled={revogando === a.id} onClick={() => void revogar(a)} data-confirmar-revogar>{revogando === a.id ? 'Revogando...' : 'Confirmar revogação'}</button>
                  <button type="button" className="btn mini" onClick={() => setConfirmando(null)}>Cancelar</button>
                </span>
              ) : (
                <button type="button" className="btn mini" aria-label={`Revogar ${a.nome}${a.atual ? ' (este aparelho)' : ''}`} onClick={() => setConfirmando(a.id)}>Revogar</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {outros.length ? <p className="data" data-revogados>{outros.length === 1 ? '1 aparelho revogado ou vencido' : `${outros.length} aparelhos revogados ou vencidos`}: {outros.slice(0, 5).map((a) => `${a.nome} (${a.revogado_em ? 'revogado' : 'vencido'})`).join(', ')}{outros.length > 5 ? ' e outros' : ''}.</p> : null}
    </section>
  );
}
