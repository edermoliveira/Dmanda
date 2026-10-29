'use client';
// Configurações: por enquanto só o cadastro mínimo de dias indisponíveis (feriados e eventos externos de dia inteiro), que as regras de prazo exigem (decisão 27).
// Cores, fontes, ícones, tamanhos e demais ajustes ainda não foram construídos (o protótipo mostra o desenho aprovado). Os dias ficam no Supabase, valem em todos
// os aparelhos e nada é importado nem presumido: só entra o que a pessoa cadastra.
import { useRef, useState } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { dataBR } from '@/lib/demandas';
import { CATEGORIAS_DIA, dataComSemana, ROTULO_CATEGORIA, type CategoriaDia, type DiaIndisponivel } from '@/lib/prazos';

type Form = { id?: string; data: string; descricao: string; categoria: CategoriaDia };
const VAZIO: Form = { data: '', descricao: '', categoria: 'Feriado' };

export function PaginaConfig() {
  const { dias, salvarDia, excluirDia, carregando } = useApp();
  const [f, setF] = useState<Form>(VAZIO);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const trava = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);

  const salvar = async () => {
    if (trava.current) return;
    if (!f.data) { setErro('Informe a data.'); document.getElementById('cfg-data')?.focus(); return; }
    if (!f.descricao.trim()) { setErro('Descreva o dia, por exemplo: Natal.'); document.getElementById('cfg-desc')?.focus(); return; }
    trava.current = true; setSalvando(true); setErro('');
    const ok = await salvarDia({ ...(f.id ? { id: f.id } : {}), data: f.data, descricao: f.descricao.trim(), categoria: f.categoria });
    trava.current = false; setSalvando(false);
    if (ok) setF(VAZIO); // se falhou, o aviso já explicou e o que foi digitado continua nos campos
  };
  const editar = (x: DiaIndisponivel) => { setF({ id: x.id, data: x.data, descricao: x.descricao, categoria: x.categoria }); setErro(''); formRef.current?.scrollIntoView({ block: 'nearest' }); document.getElementById('cfg-desc')?.focus(); };

  return (
    <>
      <div className="pagehead"><h1>Configurações</h1><p>Dias indisponíveis para prazos. Cores, fontes e tamanhos ainda estão em construção.</p></div>
      <section className="cfg-bloco" aria-labelledby="cfg-dias-t">
        <h2 id="cfg-dias-t" style={{ fontSize: 17, margin: '0 0 6px' }}>Dias indisponíveis</h2>
        <p className="data">Feriados e eventos externos de dia inteiro. Sábados e domingos já são considerados. Quando o prazo de uma demanda cai em um desses dias, o vencimento é antecipado para o dia disponível anterior, e é recalculado sozinho (nos dois sentidos) quando você cadastra, altera ou exclui um dia aqui. Nada é importado nem presumido.</p>
        <div ref={formRef} className="cfg-form" role="group" aria-label={f.id ? 'Alterar dia indisponível' : 'Cadastrar dia indisponível'}>
          <div className="fld"><label htmlFor="cfg-data">Data</label><input id="cfg-data" type="date" value={f.data} onChange={(e) => { setF({ ...f, data: e.target.value }); setErro(''); }} /></div>
          <div className="fld"><label htmlFor="cfg-cat">Categoria</label><select id="cfg-cat" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as CategoriaDia })}>{CATEGORIAS_DIA.map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>)}</select></div>
          <div className="fld" style={{ gridColumn: '1 / -1' }}><label htmlFor="cfg-desc">Descrição</label><input id="cfg-desc" value={f.descricao} maxLength={160} placeholder="Ex.: Natal, Aniversário da cidade, Congresso da AMVARS" autoComplete="off" onChange={(e) => { setF({ ...f, descricao: e.target.value }); setErro(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void salvar(); } }} /></div>
          {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)', gridColumn: '1 / -1', margin: 0 }}>{erro}</p> : null}
          <div className="acoes">
            {f.id ? <button type="button" className="btn" disabled={salvando} onClick={() => { setF(VAZIO); setErro(''); }}>Cancelar</button> : null}
            <button type="button" className="btn pri" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando...' : f.id ? 'Salvar alteração' : 'Cadastrar dia'}</button>
          </div>
        </div>
        {!dias.length ? (
          <p className="data" style={{ marginTop: 14 }}>{carregando ? 'Carregando...' : 'Nenhum dia cadastrado. Só os fins de semana ajustam os prazos por enquanto.'}</p>
        ) : (
          <ul className="cfg-lista" aria-label="Dias cadastrados">
            {dias.map((x) => (
              <li key={x.id} data-dia={x.id}>
                <span className="cfg-dia" title={dataBR(x.data)}>{dataComSemana(x.data)}</span>
                <span className="chip neutro">{ROTULO_CATEGORIA[x.categoria]}</span>
                <span className="cfg-desc">{x.descricao}</span>
                {excluindo === x.id ? (
                  <>
                    <span className="data">Excluir este dia? Os vencimentos afetados serão recalculados.</span>
                    <button type="button" className="btn mini perigo" onClick={async () => { if (await excluirDia(x.id)) setExcluindo(null); }}><Icone nome="trash" />Confirmar exclusão</button>
                    <button type="button" className="btn mini" onClick={() => setExcluindo(null)}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="icbtn-s" aria-label={`Editar ${x.descricao}`} title="Editar" onClick={() => editar(x)}><Icone nome="pencil" /></button>
                    <button type="button" className="icbtn-s" aria-label={`Excluir ${x.descricao}`} title="Excluir" onClick={() => setExcluindo(x.id)}><Icone nome="trash" /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
