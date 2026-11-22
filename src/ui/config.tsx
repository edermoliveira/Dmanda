'use client';
// Configurações: aparência (modo, destaque, fontes, tamanhos, fundo e movimento, guardados só neste navegador: ver config-aparencia.tsx) e o cadastro de
// dias indisponíveis (feriados e eventos externos de dia inteiro, de um dia ou de um período), que as regras de prazo exigem (decisão 32), com o mesmo formulário da Agenda (dia-indisponivel.tsx). Os dias ficam no Supabase, valem em todos
// os aparelhos e nada é importado nem presumido: só entra o que a pessoa cadastra. Ícones, widgets, preferências do dia a dia e dados seguem em construção.
import { useRef, useState } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { SecoesAparencia } from './config-aparencia';
import { SecaoPerfilConfig } from './perfil';
import { SecaoConta, SecaoUsuarios } from './usuarios-acesso';
import { CamposDiaIndisponivel, DIA_VAZIO, ePeriodo, useGravarDia, type CamposDia } from './dia-indisponivel';
import { dataBR } from '@/lib/demandas';
import { agruparDias, dataComSemana, ROTULO_CATEGORIA, type ItemDia } from '@/lib/prazos';

export function PaginaConfig() {
  const { dias, excluirDia, excluirPeriodo, carregando, erroDias } = useApp();
  const [f, setF] = useState<CamposDia>(DIA_VAZIO);
  const { erro, setErro, salvando, gravar } = useGravarDia('cfg');
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const mudar = (p: Partial<CamposDia>) => { setF((x) => ({ ...x, ...p })); setErro(''); };

  const salvar = async () => { if (await gravar(f)) setF(DIA_VAZIO); }; // se falhou, o aviso explica e o que foi digitado continua nos campos
  const editar = (x: ItemDia) => { setF(x.periodo_id ? { periodo_id: x.periodo_id, data: x.inicio, data_fim: x.dias > 1 ? x.fim : '', descricao: x.descricao, categoria: x.categoria } : { id: x.ids[0], data: x.inicio, data_fim: '', descricao: x.descricao, categoria: x.categoria }); setErro(''); formRef.current?.scrollIntoView({ block: 'nearest' }); document.getElementById('cfg-desc')?.focus(); };
  const emAlteracao = !!(f.id || f.periodo_id);
  const itens = agruparDias(dias);

  return (
    <>
      <div className="pagehead"><h1>Configurações</h1><p>Aparência, Perfil, Conta e dias indisponíveis para prazos. Ícones, widgets e dados ainda estão em construção.</p></div>
      <div className="cfg">
      <SecoesAparencia />
      <SecaoPerfilConfig />
      <SecaoConta />
      <SecaoUsuarios />
      <section className="cfg-bloco painel cfg-dias" aria-labelledby="cfg-dias-t">
        <h2 id="cfg-dias-t" style={{ fontSize: 'calc(17px * var(--esc))', margin: '0 0 6px' }}>Dias indisponíveis</h2>
        <p className="data">Feriados e eventos externos de dia inteiro, de um dia ou de um período (curso de vários dias, semana, recesso, inclusive passando de um ano para o outro). Sábados e domingos já são considerados. Quando o prazo de uma demanda cai em um desses dias, o vencimento é antecipado para o dia disponível anterior, e é recalculado sozinho (nos dois sentidos) quando você cadastra, altera ou exclui um dia ou um período aqui. Nada é importado nem presumido.</p>
        <div className="cfg-dias-form">
          <h3 id="cfg-novo-t" className="cfg-dias-h">{f.periodo_id && f.data_fim && f.data_fim !== f.data ? 'Alterar período indisponível' : f.periodo_id || f.id ? 'Alterar dia indisponível' : 'Cadastrar dia ou período indisponível'}</h3>
          <div ref={formRef} className="cfg-form" role="group" aria-labelledby="cfg-novo-t" data-editando={emAlteracao ? 'sim' : undefined}>
            <CamposDiaIndisponivel prefixo="cfg" valor={f} mudar={mudar} aoEnviar={() => void salvar()} />
            {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)', gridColumn: '1 / -1', margin: 0 }}>{erro}</p> : null}
            <div className="acoes">
              {emAlteracao ? <button type="button" className="btn" disabled={salvando} onClick={() => { setF(DIA_VAZIO); setErro(''); }}>Cancelar</button> : null}
              <button type="button" className="btn pri" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando...' : emAlteracao ? 'Salvar alteração' : ePeriodo(f) ? 'Cadastrar período' : 'Cadastrar dia'}</button>
            </div>
          </div>
        </div>
        <div className="cfg-dias-lado">
          <h3 className="cfg-dias-h">Dias cadastrados{!erroDias && dias.length ? <small className="data"> {itens.length === dias.length ? dias.length : `${itens.length} itens, ${dias.length} dias`}, em ordem de data</small> : null}</h3>
        {erroDias ? <p className="data cfg-lista-parcial" data-lista-parcial>{dias.length ? 'A lista abaixo pode estar incompleta: a leitura dos dias cadastrados não terminou. Quando carregar, ela se completa.' : 'Não dá para dizer quais dias estão cadastrados enquanto a leitura não voltar.'} O aviso no topo da tela tem o botão para carregar de novo. Os vencimentos já gravados não mudam.</p> : null}
        {!itens.length ? (
          erroDias ? null : <p className="data">{carregando ? 'Carregando...' : 'Nenhum dia cadastrado. Só os fins de semana ajustam os prazos por enquanto.'}</p>
        ) : (
          <ul className="cfg-lista" aria-label="Dias cadastrados">
            {itens.map((x) => (
              <li key={x.chave} data-dia={x.chave} data-categoria={x.categoria} data-periodo={x.dias > 1 ? 'sim' : undefined}>
                <span className="cfg-dia" title={dataBR(x.inicio)}>{x.dias > 1 ? `${dataComSemana(x.inicio)} a ${dataComSemana(x.fim)}` : dataComSemana(x.inicio)}</span>
                <span className="cfg-desc">{x.descricao}</span>
                <span className="chip neutro cfg-tipo">{ROTULO_CATEGORIA[x.categoria]}{x.dias > 1 ? `, ${x.dias} dias` : ''}</span>
                {excluindo === x.chave ? (
                  <span className="cfg-acoes cfg-confirma">
                    <span className="data">{x.dias > 1 ? `Excluir este período (${x.dias} dias)?` : 'Excluir este dia?'} Os vencimentos afetados serão recalculados.</span>
                    <button type="button" className="btn mini perigo" onClick={async () => { if (await (x.periodo_id ? excluirPeriodo(x.periodo_id) : excluirDia(x.ids[0]))) setExcluindo((e) => (e === x.chave ? null : e)); }}><Icone nome="trash" />Confirmar exclusão</button>
                    <button type="button" className="btn mini" onClick={() => setExcluindo(null)}>Cancelar</button>
                  </span>
                ) : (
                  <span className="cfg-acoes">
                    <button type="button" className="icbtn-s" aria-label={`Editar ${x.descricao}`} title="Editar" onClick={() => editar(x)}><Icone nome="pencil" /></button>
                    <button type="button" className="icbtn-s" aria-label={`Excluir ${x.descricao}`} title="Excluir" onClick={() => setExcluindo(x.chave)}><Icone nome="trash" /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        </div>
      </section>
      </div>
    </>
  );
}
