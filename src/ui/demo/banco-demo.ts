// Banco de demonstração da prévia: imita, em memória do navegador, as funções SQL que o aplicativo chama (mesmos nomes, argumentos e respostas).
// Os dados são fictícios e nascem relativos à data de hoje; nada é enviado a servidor algum e tudo some ao recarregar a página.
import type { Chamar } from '@/nucleo/operacoes';
import { ErroConflito, ErroDmanda } from '@/nucleo/validacao';
import { ajustarPrazo, somarDias, type DiaIndisponivel } from '@/lib/prazos';
import { hojeISO, type Demanda, type Etapa } from '@/lib/demandas';
import { QTD_CORES, type Entrada } from '@/lib/entradas';

type Estado = { demandas: Demanda[]; entradas: Entrada[]; dias: DiaIndisponivel[] };
const g = globalThis as unknown as { __dmandaDemo?: Estado };

const agora = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function semente(): Estado {
  const hoje = hojeISO();
  const d = (n: number) => somarDias(hoje, n);
  const em = (n: number) => `${d(n)}T12:00:00.000Z`;
  const dias: DiaIndisponivel[] = [
    { id: uuid(), data: d(14), descricao: 'Feriado de demonstração', categoria: 'Feriado', criado_em: em(-30) },
    { id: uuid(), data: d(6), descricao: 'Audiência pública (evento fictício)', categoria: 'Evento externo', criado_em: em(-30) },
  ];
  const tarefas = (textos: string[], feitas = 0) => textos.map((texto, i) => ({ id: uuid(), texto, concluida: i < feitas, posicao: i + 1 }));
  const base = (o: Partial<Demanda> & { assunto: string }): Demanda => {
    const original = o.prazo_original ?? null;
    const aj = original ? ajustarPrazo(original, dias) : null;
    return {
      id: uuid(), tipo: 'Memorando', area: 'Geral', numero: '', descricao: '', origem: '', etapa: 'Fazendo', etapa_desde: em(-3), chegou_em: null,
      prazo: aj?.prazo ?? null, prazo_original: original, prazo_dias: null, prazo_base_em: null, prazo_ajuste: aj?.ajuste ?? null, prazo_legado: false,
      prazo_tipo: 'Próprio', setor: null, acompanhar_em: null, concluida_em: null, arquivada_em: null, criado_em: em(-10), atualizado_em: em(-1),
      entrada_id: null, versao: 1, tarefas: [], ...o,
    };
  };
  const demandas: Demanda[] = [
    base({ tipo: 'Processo', numero: '1842/2026', assunto: 'Revisão do contrato de limpeza urbana', origem: 'Gabinete da Prefeita', descricao: 'Conferir cláusulas de reajuste e prorrogação antes do vencimento do contrato vigente.', chegou_em: d(-20), prazo_original: d(-6), prazo_tipo: 'Legal', tarefas: tarefas(['Levantar aditivos anteriores', 'Pedir parecer jurídico', 'Comparar com a planilha de custos', 'Redigir minuta de resposta'], 1), criado_em: em(-20) }),
    base({ tipo: 'Ofício', numero: '214/2026', assunto: 'Resposta à Câmara sobre cargos comissionados', origem: 'Câmara de Vereadores', etapa: 'Vistos', chegou_em: d(-4), prazo_original: hoje, prazo_tipo: 'Legal', tarefas: tarefas(['Listar cargos e lotações', 'Revisar texto com a Procuradoria', 'Assinar e protocolar']), criado_em: em(-4) }),
    base({ tipo: 'Memorando', numero: '087/2026', assunto: 'Escala de plantão do fim de ano', origem: 'Recursos Humanos', chegou_em: d(-2), prazo_original: d(2), tarefas: tarefas(['Consolidar pedidos de folga', 'Fechar escala por setor'], 1), criado_em: em(-2) }),
    base({ tipo: 'Protocolo', numero: '5531/2026', area: 'Geral', assunto: 'Pedido de certidão de tempo de serviço', origem: 'Servidor municipal', etapa: 'Cadastro', chegou_em: hoje, prazo_original: d(5), prazo_dias: 5, prazo_base_em: hoje, criado_em: em(0) }),
    base({ tipo: 'Portaria', numero: '031/2026', assunto: 'Nomeação da comissão de licitação', origem: 'Secretaria de Administração', etapa: 'Aguardando retorno', setor: 'Jurídico', chegou_em: d(-9), prazo_original: d(12), acompanhar_em: d(2), tarefas: tarefas(['Enviar minuta ao Jurídico', 'Receber parecer', 'Publicar no diário oficial', 'Arquivar cópia'], 1), criado_em: em(-9) }),
    base({ tipo: 'Processo', numero: '1710/2026', area: 'Compras', assunto: 'Aquisição de equipamentos de informática para as escolas', origem: 'Secretaria de Educação', etapa: 'Aguardando retorno', setor: 'Compras', chegou_em: d(-15), prazo_original: d(15), acompanhar_em: d(-1), tarefas: tarefas(['Cotação com três fornecedores', 'Mapa comparativo de preços', 'Aprovação do secretário']), criado_em: em(-15) }),
    base({ tipo: 'Pedido de informação', numero: '009/2026', assunto: 'Dados completos da frota municipal, incluindo veículos cedidos, locados e em manutenção, solicitados pelo Tribunal de Contas do Estado', origem: 'Tribunal de Contas do Estado', chegou_em: d(-5), prazo_original: d(9), prazo_tipo: 'Legal', tarefas: tarefas(['Pedir planilha à Garagem', 'Conferir placas e contratos de locação'], 0), criado_em: em(-5) }),
    base({ tipo: 'Processo', numero: '0123456789012345678901234567890/2026', assunto: 'Solicitação de reequilíbrio econômico-financeiro do contrato de coleta de resíduos sólidos urbanos, com revisão dos índices e das planilhas de custos do exercício anterior', origem: 'Secretaria Municipal de Planejamento e Gestão Estratégica', chegou_em: d(-3), prazo_original: d(10), prazo_tipo: 'Legal', tarefas: tarefas(['Conferir índices do contrato']), criado_em: em(-3) }),
    base({ tipo: 'Projeto de lei', numero: '12/2026', assunto: 'Reestruturação das gratificações', origem: 'Gabinete da Prefeita', etapa: 'Vistos', tarefas: tarefas(['Ler minuta', 'Simular impacto financeiro', 'Reunião com o Jurídico']), criado_em: em(-6) }),
    base({ tipo: 'Ofício', numero: '198/2026', assunto: 'Cessão de sala para a Defesa Civil', origem: 'Defesa Civil', etapa: 'Finalizado', chegou_em: d(-12), prazo_original: d(-1), concluida_em: d(-1), tarefas: tarefas(['Verificar disponibilidade', 'Responder ao pedido'], 2), criado_em: em(-12) }),
    base({ tipo: 'Memorando', numero: '071/2026', assunto: 'Atualização do cadastro de bens móveis', origem: 'Patrimônio', etapa: 'Finalizado', chegou_em: d(-30), prazo_original: d(-14), concluida_em: d(-12), tarefas: tarefas(['Inventário por sala', 'Conferir baixas'], 2), criado_em: em(-30) }),
    base({ tipo: 'Outro documento', assunto: 'Material de apoio da reunião de planejamento', etapa: 'Fazendo', prazo_original: d(25), criado_em: em(-1) }),
    base({ tipo: 'Protocolo', numero: '4980/2026', assunto: 'Solicitação antiga já arquivada', etapa: 'Finalizado', chegou_em: d(-60), concluida_em: d(-50), arquivada_em: em(-40), prazo_original: d(-52), criado_em: em(-60) }),
  ];
  const e = (o: Partial<Entrada> & { titulo: string }): Entrada => ({ id: uuid(), texto: '', cor: 0, fixada: false, arquivada_em: null, demanda_id: null, versao: 1, criado_em: em(-2), atualizado_em: em(-2), ...o });
  const entradas: Entrada[] = [
    e({ titulo: 'Ligar para o Jurídico', texto: 'Cobrar o parecer da portaria 031/2026. #retorno #juridico', cor: 0, fixada: true, criado_em: em(-1) }),
    e({ titulo: 'Pauta da reunião de segunda', texto: 'Escala de fim de ano, contrato de limpeza e resposta à Câmara. #reuniao', cor: 1, criado_em: em(-2) }),
    e({ titulo: 'Ideia', texto: 'Painel semanal com o que está parado em cada setor. #ideia', cor: 2, criado_em: em(-3) }),
    e({ titulo: '', texto: 'Lembrar de pedir à Garagem a planilha da frota. #frota', cor: 3, criado_em: em(-3) }),
    e({ titulo: 'Compras de escritório', texto: 'Canetas, grampos e toner para a sala 4.', cor: 4, criado_em: em(-5) }),
    e({ titulo: 'Anotação arquivada', texto: 'Já resolvido. #resolvido', cor: 1, arquivada_em: em(-4), criado_em: em(-8) }),
  ];
  return { demandas, entradas, dias };
}

const estado = (): Estado => (g.__dmandaDemo ??= semente());
const clonar = <T,>(x: T): T => structuredClone(x);
const achar = (id: unknown): Demanda => { const d = estado().demandas.find((x) => x.id === id); if (!d) throw new ErroDmanda('Demanda não encontrada.'); return d; };
const acharEntrada = (id: unknown): Entrada => { const e = estado().entradas.find((x) => x.id === id); if (!e) throw new ErroDmanda('Anotação não encontrada.'); return e; };
const tocar = (d: Demanda) => { d.versao += 1; d.atualizado_em = agora(); };
const renumerar = (d: Demanda) => d.tarefas.forEach((t, i) => { t.posicao = i + 1; });

function recalcular(d: Demanda) {
  if (!d.prazo_original) { d.prazo = null; d.prazo_ajuste = null; return; }
  const a = ajustarPrazo(d.prazo_original, estado().dias);
  d.prazo = a.prazo; d.prazo_ajuste = a.ajuste;
}
/** Recalcula os vencimentos das demandas abertas depois de mudar o calendário; devolve quantas mudaram (a versão sobe, como no banco). */
function recalcularTodas(): number {
  let n = 0;
  for (const d of estado().demandas) {
    if (d.etapa === 'Finalizado' || !d.prazo_original) continue;
    const antes = `${d.prazo}|${d.prazo_ajuste}`;
    recalcular(d);
    if (antes !== `${d.prazo}|${d.prazo_ajuste}`) { tocar(d); n += 1; }
  }
  return n;
}
function mudarEtapa(d: Demanda, etapa: Etapa) {
  if (d.etapa === etapa) return;
  d.etapa = etapa; d.etapa_desde = agora();
  if (etapa === 'Finalizado') { d.concluida_em = hojeISO(); d.tarefas.forEach((t) => { t.concluida = true; }); } else d.concluida_em = null;
}
function aplicar(d: Demanda, p: Record<string, unknown>) {
  for (const k of ['tipo', 'area', 'numero', 'assunto', 'descricao', 'origem', 'chegou_em', 'prazo_tipo', 'setor', 'acompanhar_em'] as const) if (k in p) (d as Record<string, unknown>)[k] = p[k] ?? null;
  if ('prazo_original' in p || 'prazo_dias' in p) {
    d.prazo_original = (p.prazo_original as string | null | undefined) ?? (('prazo_original' in p) ? null : d.prazo_original);
    d.prazo_dias = (p.prazo_dias as number | null | undefined) ?? null;
    d.prazo_base_em = d.prazo_dias ? hojeISO() : null;
    d.prazo_legado = false;
    recalcular(d);
  }
  if (typeof p.etapa === 'string') mudarEtapa(d, p.etapa as Etapa);
}
const virar = (d: Demanda) => clonar(d);
const entradaJson = (e: Entrada) => clonar(e);

function criarDemandaDados(p: Record<string, unknown>, entradaId: string | null): Demanda {
  const id = (p.id as string | undefined) ?? uuid();
  const jaExiste = estado().demandas.find((x) => x.id === id);
  if (jaExiste) return jaExiste; // repetir a criação com a mesma identidade devolve a mesma demanda
  const d: Demanda = {
    id, tipo: 'Memorando', area: 'Geral', numero: '', assunto: '', descricao: '', origem: '', etapa: 'Cadastro', etapa_desde: agora(), chegou_em: null, prazo: null, prazo_original: null,
    prazo_dias: null, prazo_base_em: null, prazo_ajuste: null, prazo_legado: false, prazo_tipo: 'Próprio', setor: null, acompanhar_em: null, concluida_em: null, arquivada_em: null,
    criado_em: agora(), atualizado_em: agora(), entrada_id: entradaId, versao: 1, tarefas: [],
  };
  aplicar(d, p);
  estado().demandas.push(d);
  return d;
}

/** As funções do banco, uma a uma, na mesma forma de chamada do transporte real (nome da função e argumentos). */
export const chamarDemo: Chamar = async (funcao, a) => {
  const s = estado();
  switch (funcao) {
    case 'listar_demandas': return clonar(s.demandas.filter((d) => (a.p_arquivadas ? !!d.arquivada_em : !d.arquivada_em)).sort((x, y) => x.criado_em.localeCompare(y.criado_em) || x.id.localeCompare(y.id)));
    case 'buscar_demanda': return virar(achar(a.p_id));
    case 'criar_demanda': return virar(criarDemandaDados(a.p as Record<string, unknown>, null));
    case 'criar_demanda_de_entrada': {
      const en = acharEntrada(a.p_entrada);
      if (en.demanda_id) throw new ErroDmanda('Esta anotação já virou demanda.');
      const d = criarDemandaDados(a.p as Record<string, unknown>, en.id);
      en.demanda_id = d.id; en.versao += 1; en.atualizado_em = agora();
      return virar(d);
    }
    case 'salvar_demanda': {
      const d = achar(a.p_id);
      if (d.versao !== a.p_versao) throw new ErroConflito('Esta demanda foi alterada em outro aparelho ou janela depois que você abriu a edição. Nada foi gravado.');
      aplicar(d, a.p as Record<string, unknown>);
      const lista = a.p_tarefas as { id?: string; texto: string; concluida: boolean }[] | null;
      if (lista) d.tarefas = lista.map((t, i) => ({ id: t.id ?? uuid(), texto: t.texto, concluida: t.concluida, posicao: i + 1 }));
      tocar(d); return virar(d);
    }
    case 'mover_etapa': { const d = achar(a.p_id); mudarEtapa(d, a.p_etapa as Etapa); tocar(d); return virar(d); }
    case 'concluir_demanda': { const d = achar(a.p_id); mudarEtapa(d, 'Finalizado'); tocar(d); return virar(d); }
    case 'reabrir_demanda': { const d = achar(a.p_id); d.concluida_em = null; d.etapa = a.p_etapa as Etapa; d.etapa_desde = agora(); tocar(d); return virar(d); }
    case 'arquivar_demanda': { const d = achar(a.p_id); d.arquivada_em = agora(); tocar(d); return virar(d); }
    case 'desarquivar_demanda': { const d = achar(a.p_id); d.arquivada_em = null; tocar(d); return virar(d); }
    case 'excluir_demanda': {
      if (a.p_confirmado !== true) throw new ErroDmanda('A exclusão precisa de confirmação.');
      const d = achar(a.p_id); s.demandas = s.demandas.filter((x) => x.id !== d.id);
      s.entradas.forEach((e) => { if (e.demanda_id === d.id) e.demanda_id = null; });
      return { id: d.id, excluida: true };
    }
    case 'adicionar_tarefa': {
      const d = achar(a.p_demanda), tid = (a.p_id as string | undefined) ?? uuid();
      if (!d.tarefas.some((t) => t.id === tid)) { d.tarefas.push({ id: tid, texto: String(a.p_texto), concluida: false, posicao: d.tarefas.length + 1 }); tocar(d); }
      return virar(d);
    }
    case 'editar_tarefa': case 'marcar_tarefa': case 'excluir_tarefa': {
      const d = s.demandas.find((x) => x.tarefas.some((t) => t.id === a.p_id));
      if (!d) throw new ErroDmanda('Tarefa não encontrada.');
      const t = d.tarefas.find((x) => x.id === a.p_id)!;
      if (funcao === 'editar_tarefa') t.texto = String(a.p_texto);
      else if (funcao === 'marcar_tarefa') t.concluida = a.p_concluida === true;
      else { d.tarefas = d.tarefas.filter((x) => x !== t); renumerar(d); }
      tocar(d); return virar(d);
    }
    case 'listar_dias_indisponiveis': return clonar([...s.dias].sort((x, y) => x.data.localeCompare(y.data) || (x.criado_em ?? '').localeCompare(y.criado_em ?? '')));
    case 'salvar_dia_indisponivel': {
      const p = a.p as { id?: string; data: string; descricao: string; categoria: DiaIndisponivel['categoria'] };
      let dia = p.id ? s.dias.find((x) => x.id === p.id) : undefined;
      if (dia) Object.assign(dia, { data: p.data, descricao: p.descricao, categoria: p.categoria });
      else { dia = { id: p.id ?? uuid(), data: p.data, descricao: p.descricao, categoria: p.categoria, criado_em: agora() }; s.dias.push(dia); }
      return { dia: clonar(dia), recalculadas: recalcularTodas() };
    }
    case 'excluir_dia_indisponivel': {
      const dia = s.dias.find((x) => x.id === a.p_id); if (!dia) throw new ErroDmanda('Dia não encontrado.');
      s.dias = s.dias.filter((x) => x !== dia);
      return { id: dia.id, excluido: true, recalculadas: recalcularTodas() };
    }
    case 'estado_rotina': return { ultima_ok: null, ultima_falha: null, resumo_data: null, resumo_calculado_em: null };
    // ---------- Entradas ----------
    case 'listar_entradas': return clonar(s.entradas.filter((e) => (a.p_arquivadas ? !!e.arquivada_em || !!e.demanda_id : !e.arquivada_em && !e.demanda_id)).sort((x, y) => y.criado_em.localeCompare(x.criado_em) || x.id.localeCompare(y.id)));
    case 'buscar_entrada': return entradaJson(acharEntrada(a.p_id));
    case 'criar_entrada': {
      const p = a.p as Partial<Entrada>;
      const ja = p.id ? s.entradas.find((x) => x.id === p.id) : undefined;
      if (ja) return entradaJson(ja);
      const uso = Array.from({ length: QTD_CORES }, (_, c) => s.entradas.filter((x) => x.cor === c).length);
      const cor = typeof p.cor === 'number' ? p.cor : uso.indexOf(Math.min(...uso));
      const n: Entrada = { id: p.id ?? uuid(), titulo: p.titulo ?? '', texto: p.texto ?? '', cor, fixada: p.fixada === true, arquivada_em: null, demanda_id: null, versao: 1, criado_em: agora(), atualizado_em: agora() };
      s.entradas.push(n); return entradaJson(n);
    }
    case 'salvar_entrada': {
      const e = acharEntrada(a.p_id);
      if (e.demanda_id) throw new ErroDmanda('Esta anotação já virou demanda e não pode mais ser alterada.');
      if (e.versao !== a.p_versao) throw new ErroConflito('Esta anotação foi alterada em outro aparelho ou janela depois que você abriu a edição. Nada foi gravado.');
      const p = a.p as Partial<Entrada>, fim = { ...e, ...p };
      if (!fim.titulo && !fim.texto) throw new ErroDmanda('A anotação não pode ficar vazia. Para tirá-la da lista, arquive.');
      Object.assign(e, p); e.versao += 1; e.atualizado_em = agora(); return entradaJson(e);
    }
    case 'fixar_entrada': { const e = acharEntrada(a.p_id); e.fixada = a.p_fixada === true; e.versao += 1; e.atualizado_em = agora(); return entradaJson(e); }
    case 'arquivar_entrada': { const e = acharEntrada(a.p_id); e.arquivada_em = agora(); e.versao += 1; e.atualizado_em = agora(); return entradaJson(e); }
    case 'desarquivar_entrada': { const e = acharEntrada(a.p_id); e.arquivada_em = null; e.versao += 1; e.atualizado_em = agora(); return entradaJson(e); }
    case 'excluir_entrada': {
      if (a.p_confirmado !== true) throw new ErroDmanda('A exclusão precisa de confirmação.');
      const e = acharEntrada(a.p_id); s.entradas = s.entradas.filter((x) => x !== e); return { id: e.id, excluida: true };
    }
    default: throw new ErroDmanda('Esta operação não existe na prévia.');
  }
};

/** Cópia dos dados fictícios da prévia, no mesmo formato geral de arquivo JSON (só para avaliar a tela de Baixar cópia). */
export const copiaDemo = () => JSON.stringify({ aviso: 'Dados fictícios da prévia do Dmanda. Não são dados reais.', gerado_em: agora(), ...estado() }, null, 2);
