'use client';
// Configurações: aparência (modo, destaque, fontes, tamanhos, fundo e movimento, guardados só neste navegador: ver config-aparencia.tsx) e o cadastro de
// dias indisponíveis (feriados e eventos externos de dia inteiro), que as regras de prazo exigem (decisão 32). Os dias ficam no Supabase, valem em todos
// os aparelhos e nada é importado nem presumido: só entra o que a pessoa cadastra. Ícones, widgets, preferências do dia a dia e dados seguem em construção.
import { useRef, useState } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { SecoesAparencia } from './config-aparencia';
import { SecaoPerfilConfig } from './perfil';
import { dataBR } from '@/lib/demandas';
import { erroDoPagamento, type Pagamento } from '@/lib/pagamentos';
import { dataPorExtenso } from '@/lib/agenda';
import { CATEGORIAS_DIA, dataComSemana, ROTULO_CATEGORIA, type CategoriaDia, type DiaIndisponivel } from '@/lib/prazos';

type Form = { id?: string; data: string; descricao: string; categoria: CategoriaDia };
const VAZIO: Form = { data: '', descricao: '', categoria: 'Feriado' };

/** Configurações, Pagamentos (decisão 64): a data do salário, uma a uma, sem valor e sem recorrência automática. Aparece no mini calendário do Início, em todos os aparelhos. */
function SecaoPagamentos() {
  const { pagamentos, salvarPagamento, excluirPagamento, carregando } = useApp();
  const [data, setData] = useState('');
  const [editando, setEditando] = useState<Pagamento | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const trava = useRef(false);
  const salvar = async () => {
    if (trava.current) return;
    const m = erroDoPagamento(data, pagamentos, editando?.id);
    if (m) { setErro(m); document.getElementById('cfg-pag-data')?.focus(); return; }
    trava.current = true; setSalvando(true); setErro('');
    const ok = await salvarPagamento({ ...(editando ? { id: editando.id } : {}), data });
    trava.current = false; setSalvando(false);
    if (ok) { setData(''); setEditando(null); } // se falhou, o aviso já explicou e a data digitada continua no campo
  };
  return (
    <section className="cfg-bloco painel" aria-labelledby="cfg-pag-t" data-secao="pagamentos">
      <h2 id="cfg-pag-t" className="cfg-titulo">Pagamentos</h2>
      <p className="data">A data em que o salário cai, cadastrada uma a uma. Ela aparece no mini calendário do Início e na Agenda, em todos os seus aparelhos. Sem valores e sem repetição automática: cadastre cada mês quando souber a data.</p>
      <div className="cfg-form" role="group" aria-label={editando ? 'Alterar data de pagamento' : 'Cadastrar data de pagamento'}>
        <div className="fld"><label htmlFor="cfg-pag-data">Data do pagamento</label><input id="cfg-pag-data" type="date" value={data} onChange={(e) => { setData(e.target.value); setErro(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void salvar(); } }} /></div>
        {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)', gridColumn: '1 / -1', margin: 0 }}>{erro}</p> : null}
        <div className="acoes">
          {editando ? <button type="button" className="btn" disabled={salvando} onClick={() => { setEditando(null); setData(''); setErro(''); }}>Cancelar</button> : null}
          <button type="button" className="btn pri" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando...' : editando ? 'Salvar alteração' : 'Cadastrar pagamento'}</button>
        </div>
      </div>
      {!pagamentos.length ? (
        <p className="data" style={{ marginTop: 14 }}>{carregando ? 'Carregando...' : 'Nenhuma data de pagamento cadastrada.'}</p>
      ) : (
        <ul className="cfg-lista" aria-label="Datas de pagamento cadastradas">
          {pagamentos.map((x) => (
            <li key={x.id} data-pagamento={x.id}>
              <span className="cfg-dia">{dataComSemana(x.data)}</span>
              <span className="cfg-desc">{dataPorExtenso(x.data)}</span>
              {excluindo === x.id ? (
                <>
                  <span className="data">Excluir esta data de pagamento?</span>
                  <button type="button" className="btn mini perigo" onClick={async () => { if (await excluirPagamento(x.id)) setExcluindo(null); }}><Icone nome="trash" />Confirmar exclusão</button>
                  <button type="button" className="btn mini" onClick={() => setExcluindo(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <button type="button" className="icbtn-s" aria-label={`Editar o pagamento de ${dataBR(x.data)}`} title="Editar" onClick={() => { setEditando(x); setData(x.data); setErro(''); document.getElementById('cfg-pag-data')?.focus(); }}><Icone nome="pencil" /></button>
                  <button type="button" className="icbtn-s" aria-label={`Excluir o pagamento de ${dataBR(x.data)}`} title="Excluir" onClick={() => setExcluindo(x.id)}><Icone nome="trash" /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PaginaConfig() {
  const { dias, salvarDia, excluirDia, carregando, erroDias } = useApp();
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
    // se falhou, o aviso já explicou e o que foi digitado continua nos campos.
    // O dia entra na lista antes de o recálculo dos prazos terminar: quem já clicou em Editar (ou voltou a digitar) nesse intervalo não perde o que está nos campos.
    if (ok) setF((atual) => (atual.id === f.id && atual.data === f.data && atual.descricao === f.descricao && atual.categoria === f.categoria ? VAZIO : atual));
  };
  const editar = (x: DiaIndisponivel) => { setF({ id: x.id, data: x.data, descricao: x.descricao, categoria: x.categoria }); setErro(''); formRef.current?.scrollIntoView({ block: 'nearest' }); document.getElementById('cfg-desc')?.focus(); };

  return (
    <>
      <div className="pagehead"><h1>Configurações</h1><p>Aparência, Perfil, pagamentos e dias indisponíveis para prazos. Ícones, widgets e dados ainda estão em construção.</p></div>
      <div className="cfg">
      <SecoesAparencia />
      <SecaoPerfilConfig />
      <SecaoPagamentos />
      <section className="cfg-bloco painel" aria-labelledby="cfg-dias-t">
        <h2 id="cfg-dias-t" className="cfg-titulo">Dias indisponíveis</h2>
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
          <p className="data" style={{ marginTop: 14 }}>{carregando ? 'Carregando...' : erroDias ? 'Não foi possível ler os dias cadastrados agora, então esta lista pode estar incompleta. Use "Tentar de novo" no aviso do topo.' : 'Nenhum dia cadastrado. Só os fins de semana ajustam os prazos por enquanto.'}</p>
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
      </div>
    </>
  );
}
