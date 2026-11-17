'use client';
// Configurações: aparência (modo, destaque, fontes, tamanhos, fundo e movimento, guardados só neste navegador: ver config-aparencia.tsx) e o cadastro de
// dias indisponíveis (feriados e eventos externos de dia inteiro), que as regras de prazo exigem (decisão 32), com o mesmo formulário de Data, Tipo e Descrição da Agenda (dia-indisponivel.tsx). Os dias ficam no Supabase, valem em todos
// os aparelhos e nada é importado nem presumido: só entra o que a pessoa cadastra. Ícones, widgets, preferências do dia a dia e dados seguem em construção.
import { useRef, useState } from 'react';
import { Icone } from './Icone';
import { useApp } from './contexto';
import { SecoesAparencia } from './config-aparencia';
import { SecaoPerfilConfig } from './perfil';
import { CamposDiaIndisponivel, DIA_VAZIO, useGravarDia, type CamposDia } from './dia-indisponivel';
import { dataBR } from '@/lib/demandas';
import { dataComSemana, ROTULO_CATEGORIA, type DiaIndisponivel } from '@/lib/prazos';

export function PaginaConfig() {
  const { dias, excluirDia, carregando } = useApp();
  const [f, setF] = useState<CamposDia>(DIA_VAZIO);
  const { erro, setErro, salvando, gravar } = useGravarDia('cfg');
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const mudar = (p: Partial<CamposDia>) => { setF((x) => ({ ...x, ...p })); setErro(''); };

  const salvar = async () => { if (await gravar(f)) setF(DIA_VAZIO); }; // se falhou, o aviso explica e o que foi digitado continua nos campos
  const editar = (x: DiaIndisponivel) => { setF({ id: x.id, data: x.data, descricao: x.descricao, categoria: x.categoria }); setErro(''); formRef.current?.scrollIntoView({ block: 'nearest' }); document.getElementById('cfg-desc')?.focus(); };

  return (
    <>
      <div className="pagehead"><h1>Configurações</h1><p>Aparência, Perfil e dias indisponíveis para prazos. Ícones, widgets e dados ainda estão em construção.</p></div>
      <div className="cfg">
      <SecoesAparencia />
      <SecaoPerfilConfig />
      <section className="cfg-bloco painel cfg-dias" aria-labelledby="cfg-dias-t">
        <h2 id="cfg-dias-t" style={{ fontSize: 'calc(17px * var(--esc))', margin: '0 0 6px' }}>Dias indisponíveis</h2>
        <p className="data">Feriados e eventos externos de dia inteiro. Sábados e domingos já são considerados. Quando o prazo de uma demanda cai em um desses dias, o vencimento é antecipado para o dia disponível anterior, e é recalculado sozinho (nos dois sentidos) quando você cadastra, altera ou exclui um dia aqui. Nada é importado nem presumido.</p>
        <div className="cfg-dias-form">
          <h3 id="cfg-novo-t" className="cfg-dias-h">{f.id ? 'Alterar dia indisponível' : 'Cadastrar dia indisponível'}</h3>
          <div ref={formRef} className="cfg-form" role="group" aria-labelledby="cfg-novo-t" data-editando={f.id ? 'sim' : undefined}>
            <CamposDiaIndisponivel prefixo="cfg" valor={f} mudar={mudar} aoEnviar={() => void salvar()} />
            {erro ? <p className="data" role="alert" style={{ color: 'var(--perigo)', gridColumn: '1 / -1', margin: 0 }}>{erro}</p> : null}
            <div className="acoes">
              {f.id ? <button type="button" className="btn" disabled={salvando} onClick={() => { setF(DIA_VAZIO); setErro(''); }}>Cancelar</button> : null}
              <button type="button" className="btn pri" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando...' : f.id ? 'Salvar alteração' : 'Cadastrar dia'}</button>
            </div>
          </div>
        </div>
        <div className="cfg-dias-lado">
          <h3 className="cfg-dias-h">Dias cadastrados{dias.length ? <small className="data"> {dias.length}, em ordem de data</small> : null}</h3>
        {!dias.length ? (
          <p className="data">{carregando ? 'Carregando...' : 'Nenhum dia cadastrado. Só os fins de semana ajustam os prazos por enquanto.'}</p>
        ) : (
          <ul className="cfg-lista" aria-label="Dias cadastrados">
            {[...dias].sort((a, b) => a.data.localeCompare(b.data) || a.descricao.localeCompare(b.descricao, 'pt-BR')).map((x) => (
              <li key={x.id} data-dia={x.id} data-categoria={x.categoria}>
                <span className="cfg-dia" title={dataBR(x.data)}>{dataComSemana(x.data)}</span>
                <span className="cfg-desc">{x.descricao}</span>
                <span className="chip neutro cfg-tipo">{ROTULO_CATEGORIA[x.categoria]}</span>
                {excluindo === x.id ? (
                  <span className="cfg-acoes cfg-confirma">
                    <span className="data">Excluir este dia? Os vencimentos afetados serão recalculados.</span>
                    <button type="button" className="btn mini perigo" onClick={async () => { if (await excluirDia(x.id)) setExcluindo((e) => (e === x.id ? null : e)); }}><Icone nome="trash" />Confirmar exclusão</button>
                    <button type="button" className="btn mini" onClick={() => setExcluindo(null)}>Cancelar</button>
                  </span>
                ) : (
                  <span className="cfg-acoes">
                    <button type="button" className="icbtn-s" aria-label={`Editar ${x.descricao}`} title="Editar" onClick={() => editar(x)}><Icone nome="pencil" /></button>
                    <button type="button" className="icbtn-s" aria-label={`Excluir ${x.descricao}`} title="Excluir" onClick={() => setExcluindo(x.id)}><Icone nome="trash" /></button>
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
