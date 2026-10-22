// Protótipo do Dmanda: dados fictícios, sem rede, sem gravar nada. Hoje no protótipo: quarta-feira, 21/10/2026.
(function () {
  var estado = { dir: 'a', tema: 'claro', dev: 'desktop', tela: 'inicio', virado: {}, fixo: {}, filtroIni: null, tagSel: null, plus: false, humor: 3, vis: 'cards', ord: 'prazo', ordDir: 1, aberto: {}, ag: 'semana', pal: null, fs: 16, ico: 20, cardh: 340, anim: false, iconeEstilo: '', chat: [], lib: 'iconoir', q: '', soAtras: false, grupos: {}, etapaSel: 'Cadastro', perfilAb: false, menuAb: false };

  var NOTAS = {
    a: 'Aurora: vidro estilo Apple em quase tudo, gradiente suave, cantos grandes. Tema definitivo do Dmanda.',
    b: 'Papel: calmo, tom de papel, títulos serifados, vidro discreto. Tema definitivo do Dmanda.',
    c: 'Grafite: denso, bordas finas, ícones duotone, leitura rápida. Tema definitivo do Dmanda.',
    d: 'Catalyst: estilo Apple para Mac e iPad, baseado no kit oficial do Figma. Cinza de sistema, azul, superfícies sólidas, listas com linhas finas e controles compactos.'
  };

  var LOGOS_ORIG = {
    a: '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10 4H32A28 28 0 0 1 32 60H10A6 6 0 0 1 4 54V10A6 6 0 0 1 10 4ZM16 16H18A3 3 0 0 1 21 19V45A3 3 0 0 1 18 48H16A3 3 0 0 1 13 45V19A3 3 0 0 1 16 16ZM28 16H30A3 3 0 0 1 33 19V35A3 3 0 0 1 30 38H28A3 3 0 0 1 25 35V19A3 3 0 0 1 28 16ZM40 16H42A3 3 0 0 1 45 19V25A3 3 0 0 1 42 28H40A3 3 0 0 1 37 25V19A3 3 0 0 1 40 16Z"/></svg>',
    b: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="18" fill="currentColor"/><text x="32" y="46" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="700" font-size="40" fill="var(--acc-ink)">D</text></svg>',
    c: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 6H30A26 26 0 0 1 30 58H10Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><rect x="19" y="36" width="6" height="14" rx="2" fill="currentColor"/><rect x="29" y="26" width="6" height="24" rx="2" fill="currentColor"/><rect x="39" y="16" width="6" height="34" rx="2" fill="currentColor"/></svg>'
  };

  var LOGOS = { a: LOGOS_ORIG.a, b: LOGOS_ORIG.a, c: LOGOS_ORIG.a, d: LOGOS_ORIG.a };

  // Hoje: 21/10/2026. Prazos e datas fictícios. prazo nulo = sem prazo (nada é inventado).
  // area (só processo e protocolo): Geral (azul), Pessoal (verde) ou Compras (amarelo). Os demais tipos têm a frente neutra.
  var DEMANDAS = [
    { id: 1, tipo: 'Processo', area: 'Geral', num: '1842/2026', assunto: 'Resposta ao TCE sobre diárias de 2025', origem: 'TCE-RS', etapa: 'Fazendo', prazoTipo: 'Legal', prazo: '18/10', atraso: 3,
      tarefas: [{ t: 'Levantar diárias de 2025', f: true }, { t: 'Conferir com a Contabilidade', f: true }, { t: 'Redigir a resposta', f: false }, { t: 'Revisão jurídica', f: false }, { t: 'Protocolar', f: false }], chegou: '02/10', parado: 2 },
    { id: 2, tipo: 'Memorando', num: '087/2026', assunto: 'Revisão do contrato de limpeza', origem: 'Gabinete', etapa: 'Vista', prazoTipo: 'Próprio', prazo: '21/10', atraso: 0, tarefas: [], chegou: '19/10', parado: 2 },
    { id: 3, tipo: 'Ofício', num: '311/2026', assunto: 'Parecer sobre cessão de servidor', origem: 'Secretaria de Saúde', etapa: 'Aguardando retorno', setor: 'PGM', diasAg: 9, acompanhar: '24/10', prazoTipo: 'Próprio', prazo: '30/10', atraso: 0,
      tarefas: [{ t: 'Enviar ofício à PGM', f: true }, { t: 'Cobrar o parecer', f: false }], chegou: '08/10', parado: 9 },
    { id: 4, tipo: 'Protocolo', area: 'Pessoal', num: '2210/2026', assunto: 'Nomeação dos aprovados no concurso', origem: 'Recursos Humanos', etapa: 'Cadastro', prazoTipo: 'Legal', prazo: '28/10', atraso: 0, tarefas: [], chegou: '21/10', parado: 0 },
    { id: 5, tipo: 'Portaria', num: '045/2026', assunto: 'Horário de verão dos servidores', origem: 'Gabinete', etapa: 'Fazendo', prazoTipo: 'Próprio', prazo: '25/10', atraso: 0,
      tarefas: [{ t: 'Minutar a portaria', f: true }, { t: 'Assinatura da Prefeita', f: true }], chegou: '15/10', parado: 1 },
    { id: 6, tipo: 'Memorando', num: '071/2026', assunto: 'Reorganização do arquivo morto', origem: 'Secretaria', etapa: 'Finalizado', prazoTipo: 'Próprio', prazo: '14/10', atraso: 0,
      tarefas: [{ t: 'Listar caixas', f: true }, { t: 'Triagem', f: true }, { t: 'Descarte autorizado', f: true }], chegou: '01/10', parado: 0, concluido: '14/10' },
    { id: 7, tipo: 'Processo', area: 'Compras', num: '3120/2026', assunto: 'Registro de preços de material de expediente', origem: 'Setor de Compras', etapa: 'Vista', prazoTipo: 'Próprio', prazo: '29/10', atraso: 0, tarefas: [], chegou: '20/10', parado: 1 },
    { id: 8, tipo: 'Pedido de informação', num: '012/2026', assunto: 'Lotação dos servidores da Secretaria de Obras', origem: 'Câmara de Vereadores', etapa: 'Fazendo', prazoTipo: 'Próprio', prazo: null, atraso: 0,
      tarefas: [{ t: 'Levantar a lotação atual', f: false }], chegou: '14/10', parado: 4 }
  ];

  var NAV = [
    ['inicio', 'Início', 'house'], ['entradas', 'Entradas', 'inbox'], ['demandas', 'Demandas', 'square-kanban'],
    ['agenda', 'Agenda', 'calendar'], ['documentos', 'Documentos', 'file-text'], ['ia', 'IA', 'sparkles'], ['config', 'Configurações', 'settings']
  ];
  var MAIS = [['plus-anot', 'Anotação', 'sticky-note', 1], ['plus-dem', 'Demanda', 'square-kanban', 1], ['plus-ev', 'Evento', 'calendar', 1], ['plus-tar', 'Tarefa', 'check', 0], ['plus-doc', 'Documento', 'file-text', 0], ['plus-chat', 'Chat com a IA', 'message-circle', 0]];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function pct(d) { if (!d.tarefas.length) return null; return Math.round(d.tarefas.filter(function (t) { return t.f; }).length / d.tarefas.length * 100); }

  // ---------- telas ----------
  function stat(n, r, icone, alerta) {
    return '<button class="stat' + (alerta ? ' alerta' : '') + '" data-act="msg" data-m="Abriria a lista filtrada"><span class="n">' + n + '</span><span class="r">' + ic(icone, 'duo') + r + '</span></button>';
  }
  // ---------- paletas e fontes (Configurações) ----------
  var PALETAS = [['Água-marinha', 170, 1], ['Céu', 200, 1], ['Oceano', 220, 1], ['Índigo', 245, 1], ['Violeta', 270, 1], ['Orquídea', 300, 1], ['Rosa', 330, 1], ['Âmbar', 42, 1], ['Oliva', 90, 1], ['Grafite', 220, 0.1]];
  function hsl(h, sa, l, a) { return 'hsl(' + (((h % 360) + 360) % 360) + ' ' + Math.round(sa) + '% ' + l + '%' + (a ? ' / ' + a : '') + ')'; }
  function estiloApp() {
    var v = [], c = estado.pal === null ? null : PALETAS[estado.pal];
    v.push('--fs:' + estado.fs + 'px', '--icn:' + estado.ico + 'px', '--cardh:' + estado.cardh + 'px');
    if (c) {
      var h = c[1], k = c[2];
      if (estado.tema === 'claro') v.push('--acc:' + hsl(h, 72 * k, 48), '--acc-ink:' + hsl(h, 90 * k, 9), '--acc-soft:' + hsl(h, 72 * k, 48, 0.18), '--acc-text:' + hsl(h, 80 * k, 24),
        '--bg1:' + hsl(h, 70 * k, 91), '--bg2:' + hsl(h + 40, 80 * k, 92), '--bg3:' + hsl(h + 80, 70 * k, 94), '--bgbase:' + hsl(h, 40 * k, 96));
      else v.push('--acc:' + hsl(h, 78 * k, 58), '--acc-ink:' + hsl(h, 90 * k, 8), '--acc-soft:' + hsl(h, 78 * k, 58, 0.16), '--acc-text:' + hsl(h, 85 * k, 68),
        '--bg1:' + hsl(h, 45 * k, 15), '--bg2:' + hsl(h + 40, 45 * k, 16), '--bg3:' + hsl(h + 80, 40 * k, 18), '--bgbase:' + hsl(h, 30 * k, 7));
    }
    return v.join(';');
  }
  function iconeEstilo() { return estado.iconeEstilo || (estado.dir === 'c' ? 'duotone' : 'pastilha'); }

  var ETAPAS = ['Cadastro', 'Vista', 'Fazendo', 'Aguardando retorno', 'Finalizado'];
  // ---------- ícones: Iconoir (padrão) ou Lucide; no Iconoir o item ativo usa a versão sólida ----------
  function ic(n, extra) {
    var ex = extra || '', sol = / sol|^sol/.test(' ' + ex), corpo;
    if (estado.lib === 'iconoir') corpo = (sol && window.ICONOIR_SOLIDO[n]) || window.ICONOIR[n] || window.ICONES[n];
    else corpo = window.ICONES[n] || window.ICONOIR[n];
    return '<svg class="ic ' + ex.replace(/\bsol\b/, '').trim() + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (corpo || '') + '</svg>';
  }

  // ---------- peças compartilhadas dos cards ----------
  var TIPO_COR = { Processo: 262, Protocolo: 262, Memorando: 212, 'Ofício': 28, Portaria: 150, 'Pedido de informação': 190, 'Projeto de lei': 340 };
  var ETAPA_COR = { Cadastro: 48, Vista: 205, Fazendo: 262, 'Aguardando retorno': 330, Finalizado: 150 };
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function dataCurta(p) { var m = p.split('/'); return +m[0] + ' ' + MESES[+m[1] - 1]; }
  // ---------- datas do protótipo (hoje = 21/10/2026) ----------
  var HOJE_MS = Date.UTC(2026, 9, 21);
  function ms(c) { var m = c.split('/'); return Date.UTC(2026, +m[1] - 1, +m[0]); }
  function diasAte(c) { return Math.round((ms(c) - HOJE_MS) / 864e5); }
  function diasDesde(c) { return -diasAte(c); }
  function plural(n, u) { return n + ' ' + u + (n === 1 ? '' : 's'); }
  function curto(n) { return n + ' d'; }
  // sem prazo não é inventado: a demanda fica fora dos filtros e mostra só há quanto tempo chegou
  function atrasada(d) { return !!d.prazo && diasAte(d.prazo) < 0 && d.etapa !== 'Finalizado'; }
  function atrasoDias(d) { return atrasada(d) ? -diasAte(d.prazo) : 0; }
  // data que conta para os filtros: quem aguarda retorno só volta quando faltarem 3 dias para o acompanhamento
  function dataFiltro(d) {
    if (d.etapa === 'Finalizado') return null;
    if (d.etapa === 'Aguardando retorno') { var a = d.acompanhar ? diasAte(d.acompanhar) : null; return a !== null && a <= 3 ? d.acompanhar : null; }
    return d.prazo || null;
  }
  function grupoFiltro(d) {
    var c = dataFiltro(d); if (!c) return null;
    var n = diasAte(c);
    return n < 0 ? 'atrasadas' : n === 0 ? 'hoje' : n <= 7 ? 'sete' : null;
  }
  function ordemFiltro(d) { var c = dataFiltro(d); return [c ? diasAte(c) : 999, -diasDesde(d.chegou)]; }
  function porGrupo(g) {
    return DEMANDAS.filter(function (d) { return grupoFiltro(d) === g; }).sort(function (a, b) { var x = ordemFiltro(a), y = ordemFiltro(b); return x[0] - y[0] || x[1] - y[1]; });
  }
  // Foco do dia: até 3 demandas, atrasadas primeiro (a mais antiga), depois hoje, depois os próximos 7 dias
  function focoDoDia() { return porGrupo('atrasadas').concat(porGrupo('hoje'), porGrupo('sete')).slice(0, 3); }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function chipTipo(d) { return '<span class="tag" style="--h:' + (TIPO_COR[d.tipo] || 212) + '">' + esc(d.tipo) + '</span>'; }
  // contagem regressiva: neutra até 6 dias; amarela com 5 e 4; laranja com 3 e 2; vermelha com 1 e no dia; vencido em vermelho vivo. Sem prazo não aparece nada.
  function nivelPrazo(n) { return n <= 1 ? ' n-verm' : n <= 3 ? ' n-lar' : n <= 5 ? ' n-amar' : ''; }
  function chipPrazo(d) {
    if (!d.prazo) return '';
    if (d.etapa === 'Finalizado') return '<span class="pz">' + ic('calendar') + dataCurta(d.prazo) + '</span>';
    var n = diasAte(d.prazo);
    if (n < 0) return '<span class="pz venc">' + ic('calendar') + 'Prazo vencido</span>';
    return '<span class="pz' + nivelPrazo(n) + '">' + ic('calendar') + dataCurta(d.prazo) + ' · ' + (n === 0 ? 'vence hoje' : 'faltam ' + curto(n)) + '</span>';
  }
  // acompanhamento do tempo: desde a chegada até a conclusão (ou até hoje). Sem prazo, nada.
  function chipTempo(d) {
    if (!d.prazo) return '';
    if (d.etapa === 'Finalizado' && d.concluido) return '<span class="tempo mono" title="Da chegada à conclusão">' + ic('clock') + 'Resolvida em ' + curto(Math.max(0, diasDesde(d.chegou) - diasDesde(d.concluido))) + '</span>';
    return '<span class="tempo mono" title="Desde que chegou">' + ic('clock') + (diasDesde(d.chegou) === 0 ? 'Chegou hoje' : 'Chegou há ' + curto(diasDesde(d.chegou))) + '</span>';
  }
  function chipsRow(d) { var c = chipPrazo(d) + chipSelo(d) + chipTempo(d); return c ? '<div class="chips">' + c + '</div>' : ''; }
  // o card nunca tem caixa de marcar a demanda: mostra a próxima tarefa (com caixa) ou, sem tarefas, o botão de concluir
  function acaoCard(d) {
    if (d.etapa === 'Finalizado') return '<button class="btn mini bloco" data-act="reabrir" data-id="' + d.id + '">Reabrir demanda</button>';
    var k = -1; d.tarefas.forEach(function (t, i) { if (k < 0 && !t.f) k = i; });
    if (k > -1) return '<label class="prox-t"><input type="checkbox" data-act="tarefa" data-id="' + d.id + '" data-i="' + k + '"><span><small>Próxima tarefa</small>' + esc(d.tarefas[k].t) + '</span></label>';
    return '<button class="btn pri bloco" data-act="concluir" data-id="' + d.id + '">' + ic('check') + 'Concluir demanda</button>';
  }
  function chipSelo(d) { return d.prazo ? '<span class="selo' + (d.prazoTipo === 'Legal' ? ' legal' : '') + '">' + ic('flag') + d.prazoTipo + '</span>' : ''; }
  // cor de frente do card: documentos em geral são neutros; processos e protocolos têm tom pastel pela área
  var AREA_COR = { Geral: 'azul', Pessoal: 'verde', Compras: 'amar' };
  function corCard(d) { return (d.tipo === 'Processo' || d.tipo === 'Protocolo') && AREA_COR[d.area || 'Geral'] ? ' cat-' + AREA_COR[d.area || 'Geral'] : ''; }
  function origemP(d) { return '<span class="origem-p"><i class="pt" style="--h:' + hue(d.origem) + '"></i>' + esc(d.origem) + '</span>'; }
  function contagem(d) { var f = d.tarefas.filter(function (t) { return t.f; }).length; return d.tarefas.length ? f + '/' + d.tarefas.length : ''; }
  function barraProg(d) {
    var p = pct(d);
    return '<div class="prog"><div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (p === null ? 0 : p) + '" aria-label="Progresso das tarefas"><i style="width:' + (p === null ? 0 : p) + '%"></i></div><b class="mono">' + (p === null ? '—' : contagem(d) + ' · ' + p + '%') + '</b></div>';
  }
  function filtradas() {
    var q = estado.q.trim().toLowerCase();
    return DEMANDAS.filter(function (d) {
      if (estado.soAtras && !atrasada(d)) return false;
      return !q || (d.tipo + ' ' + d.num + ' ' + d.assunto + ' ' + d.origem).toLowerCase().indexOf(q) > -1;
    });
  }

  // ---------- card de dois lados ----------
  // O botão de virar fica nos dois lados. Quem não escolheu nada vê o verso ao passar o mouse; depois do toque, o lado escolhido fica fixo.
  function btnGirar(d, para) {
    return '<button class="girar" data-act="girar" data-id="' + d.id + '" data-lado="' + para + '" aria-label="' + (para === 'verso' ? 'Fixar o verso do card' : 'Fixar a frente do card') + '" title="' + (para === 'verso' ? 'Ver tarefas' : 'Ver a frente') + '">' + ic('rotate-cw') + '</button>';
  }
  function cardHTML(d) {
    var fin = d.etapa === 'Finalizado', at = atrasada(d);
    var etapaChip = fin ? '<span class="chip">Finalizada</span>' : '<span class="chip neutro">' + esc(d.etapa) + (d.etapa === 'Aguardando retorno' ? ' · ' + esc(d.setor) + ' ' + d.diasAg + ' d' : '') + '</span>';
    var frente = '<div class="face front' + corCard(d) + '"><div class="cab">' + origemP(d) + btnGirar(d, 'verso') + '</div>' +
      '<div class="tags">' + chipTipo(d) + '<span class="num mono">' + esc(d.num) + '</span>' + etapaChip + '</div>' +
      '<div class="assunto fit" data-act="abrir" data-id="' + d.id + '" tabindex="0" role="link">' + esc(d.assunto) + '</div>' +
      chipsRow(d) + acaoCard(d) + barraProg(d) + '</div>';
    var tarefas = d.tarefas.length ? '<ul class="tarefas">' + d.tarefas.map(function (t, i) {
      return '<li><label><input type="checkbox" data-act="tarefa" data-id="' + d.id + '" data-i="' + i + '"' + (t.f ? ' checked' : '') + '><span class="' + (t.f ? 'feita' : '') + '">' + esc(t.t) + '</span></label></li>';
    }).join('') + '</ul>' : '<div class="proxima vazia"><span>Nenhuma tarefa cadastrada</span><button data-act="add" data-id="' + d.id + '">+ Adicionar tarefa</button></div>';
    var meta = '<div class="meta"><div>Chegou em<b>' + d.chegou + '</b></div><div>' + (fin ? 'Resolvida em' : 'Parada há') + '<b>' + (fin && d.concluido ? curto(Math.max(0, diasDesde(d.chegou) - diasDesde(d.concluido))) : curto(d.parado)) + '</b></div><div>Tipo<b>' + esc(d.tipo) + '</b></div>' +
      (d.setor ? '<div>Setor<b>' + esc(d.setor) + ' · ' + d.diasAg + ' dias</b></div><div>Acompanhar em<b>' + d.acompanhar + '</b></div>' : '') + '</div>';
    var acoes = '<div class="acoes">' +
      (d.etapa === 'Cadastro' ? '<button class="btn mini" data-act="javi" data-id="' + d.id + '">' + ic('eye') + 'Já vi</button>' : '') +
      '<button class="btn mini so-icone" data-act="msg" data-m="Arquivar" aria-label="Arquivar" title="Arquivar">' + ic('archive') + '</button>' +
      '<button class="btn mini so-icone" data-act="msg" data-m="Mover de etapa" aria-label="Mover de etapa" title="Mover de etapa">' + ic('arrow-right') + '</button>' +
      '<button class="btn mini" data-act="abrir" data-id="' + d.id + '" aria-label="Editar" title="Editar">' + ic('pencil') + 'Editar</button></div>';
    var verso = '<div class="face back"><div class="cab"><span class="num mono">' + esc(d.tipo) + ' ' + esc(d.num) + '</span>' + btnGirar(d, 'frente') + '</div>' + tarefas + meta + acoes + '</div>';
    return '<article class="dcard' + (at ? ' atrasada' : '') + '"' + (estado.fixo[d.id] ? ' data-fix="' + estado.fixo[d.id] + '"' : '') + ' data-id="' + d.id + '"><div class="faces">' + frente + verso + '</div></article>';
  }

  // ---------- visões de Demandas ----------
  function mini(d) {
    var fin = d.etapa === 'Finalizado';
    return '<article class="mini-card' + corCard(d) + (atrasada(d) ? ' atrasada' : '') + (fin ? ' feita' : '') + '" data-id="' + d.id + '"><div class="m-top">' + origemP(d) +
      '<button class="mais" data-act="msg" data-m="Mais ações" aria-label="Mais ações">' + ic('ellipsis') + '</button></div>' +
      '<div class="tags">' + chipTipo(d) + '<span class="num mono">' + esc(d.num) + '</span></div>' +
      '<div class="assunto" data-act="abrir" data-id="' + d.id + '" tabindex="0" role="link">' + esc(d.assunto) + '</div>' +
      chipsRow(d) + (d.setor ? '<div class="chips"><span class="chip neutro">' + esc(d.setor) + ' · ' + d.diasAg + ' d</span></div>' : '') + acaoCard(d) + barraProg(d) + '</article>';
  }
  function quadro() {
    var lista = filtradas();
    return '<div class="etapas-tabs" role="tablist">' + ETAPAS.map(function (et) {
      var n = lista.filter(function (d) { return d.etapa === et; }).length;
      return '<button role="tab" data-act="etapa" data-e="' + et + '" aria-pressed="' + (estado.etapaSel === et) + '" style="--et:' + ETAPA_COR[et] + '"><i class="dot"></i>' + et + ' <span class="cnt">' + n + '</span></button>';
    }).join('') + '</div><div class="quadro">' + ETAPAS.map(function (et) {
      var l = lista.filter(function (d) { return d.etapa === et; });
      return '<section class="coluna' + (estado.etapaSel === et ? ' sel' : '') + '" aria-label="' + et + '" style="--et:' + ETAPA_COR[et] + '"><header><i class="dot"></i><h4>' + et + '</h4><span class="cnt">' + l.length + '</span><span class="esp"></span>' +
        '<button class="icbtn-s" data-act="msg" data-m="Nova demanda em ' + et + '" aria-label="Nova demanda em ' + et + '">' + ic('plus') + '</button><button class="icbtn-s" data-act="msg" data-m="Opções da coluna" aria-label="Opções da coluna">' + ic('ellipsis') + '</button></header>' +
        (l.map(mini).join('') || '<div class="vazio-c">Nenhuma demanda</div>') +
        '<button class="nova" data-act="msg" data-m="Nova demanda em ' + et + '">' + ic('plus') + 'Nova demanda</button></section>';
    }).join('') + '</div>';
  }
  function ordenadas() {
    var k = estado.ord, dir = estado.ordDir;
    function chave(d) {
      if (k === 'num') return d.num;
      if (k === 'assunto') return d.assunto;
      if (k === 'origem') return d.origem;
      if (k === 'etapa') return ETAPAS.indexOf(d.etapa);
      if (k === 'pct') return pct(d) === null ? -1 : pct(d);
      if (!d.prazo) return 9999; var m = d.prazo.split('/'); return +m[1] * 100 + +m[0];
    }
    return filtradas().sort(function (a, b) { var x = chave(a), y = chave(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  }
  function tabela() {
    var cols = [['num', 'Número'], ['assunto', 'Assunto'], ['origem', 'Origem'], ['prazo', 'Prazo'], ['etapa', 'Etapa'], ['pct', 'Andamento']];
    return '<div class="tabela-w"><table class="tabela"><thead><tr>' + cols.map(function (c) {
      var at = estado.ord === c[0];
      return '<th scope="col" aria-sort="' + (at ? (estado.ordDir > 0 ? 'ascending' : 'descending') : 'none') + '"><button data-act="ordenar" data-k="' + c[0] + '">' + c[1] + (at ? ic(estado.ordDir > 0 ? 'arrow-up' : 'arrow-down') : '') + '</button></th>';
    }).join('') + '</tr></thead><tbody>' + ordenadas().map(function (d) {
      return '<tr class="' + (atrasada(d) ? 'atrasada' : '') + '"><td class="mono">' + chipTipo(d) + ' ' + esc(d.num) + '</td><td><b>' + esc(d.assunto) + '</b></td><td>' + origemP(d) + '</td><td>' + chipPrazo(d) + ' ' + chipSelo(d) + '</td><td><span class="et-p" style="--et:' + ETAPA_COR[d.etapa] + '"><i class="dot"></i>' + esc(d.etapa) + '</span></td><td style="min-width:150px">' + barraProg(d) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function lista() {
    var l = filtradas();
    return '<div class="lista">' + ETAPAS.map(function (et) {
      var itens = l.filter(function (d) { return d.etapa === et; }), fechado = estado.grupos[et];
      return '<section class="grupo" style="--et:' + ETAPA_COR[et] + '"><button class="grupo-h" data-act="grupo" data-e="' + et + '" aria-expanded="' + !fechado + '">' + ic('chevron-down', fechado ? 'fechado' : '') + '<i class="dot"></i><b>' + et + '</b><span class="cnt">' + itens.length + '</span></button>' +
        (fechado ? '' : (itens.map(function (d) {
          var ab = estado.aberto[d.id], fin = d.etapa === 'Finalizado';
          var tar = d.tarefas.length ? '<ul class="tarefas">' + d.tarefas.map(function (t, i) { return '<li><label><input type="checkbox" data-act="tarefa" data-id="' + d.id + '" data-i="' + i + '"' + (t.f ? ' checked' : '') + '><span class="' + (t.f ? 'feita' : '') + '">' + esc(t.t) + '</span></label></li>'; }).join('') + '</ul>'
            : '<div class="proxima vazia"><span>Nenhuma tarefa cadastrada</span><button data-act="add" data-id="' + d.id + '">+ Adicionar tarefa</button></div>';
          return '<div class="linha' + (atrasada(d) ? ' atrasada' : '') + (fin ? ' feita' : '') + '"><div class="linha-c">' +
            '<button class="linha-m" data-act="abrirlinha" data-id="' + d.id + '" aria-expanded="' + !!ab + '"><span class="mono num">#' + esc(d.num) + '</span><span class="ass">' + esc(d.assunto) + '</span>' + origemP(d) + chipTipo(d) + '</button>' +
            '<span class="dir">' + chipSelo(d) + chipPrazo(d) + '<b class="mono pc">' + (pct(d) === null ? '—' : pct(d) + '%') + '</b></span></div>' + (ab ? '<div class="linha-d">' + tar + acaoCard(d) + '</div>' : '') + '</div>';
        }).join('') || '<div class="vazio-c">Nenhuma demanda</div>')) + '</section>';
    }).join('') + '</div>';
  }
  function vista() {
    var l = filtradas();
    if (!l.length) return '<div class="vazio">' + ic('search', 'grande') + '<h3>Nenhuma demanda encontrada</h3><p>Ajuste o filtro para ver mais.</p></div>';
    return estado.vis === 'cards' ? '<div class="cards">' + l.map(cardHTML).join('') + '</div>' : estado.vis === 'quadro' ? quadro() : estado.vis === 'tabela' ? tabela() : lista();
  }
  function demandas() {
    var V = [['cards', 'Cards', 'view-grid'], ['quadro', 'Quadro', 'columns'], ['tabela', 'Tabela', 'table'], ['lista', 'Lista', 'list']];
    var nAt = DEMANDAS.filter(atrasada).length;
    return '<div class="toolbar"><div class="tabs" role="group" aria-label="Visão">' + V.map(function (v) {
      return '<button data-act="vis" data-v="' + v[0] + '" aria-pressed="' + (estado.vis === v[0]) + '" aria-label="' + v[1] + '">' + ic(v[2] === 'view-grid' ? 'layout-grid' : v[2]) + '<span class="tx">' + v[1] + '</span></button>';
    }).join('') + '</div><label class="filtro">' + ic('search') + '<input id="fq" placeholder="Filtrar demandas ( / )" value="' + esc(estado.q) + '" aria-label="Filtrar demandas" autocomplete="off"></label>' +
      '<button class="btn gl" data-act="atras" aria-pressed="' + estado.soAtras + '" aria-label="Só atrasadas">' + ic('clock') + '<span class="tx">Só atrasadas' + (nAt ? ' ' + nAt : '') + '</span></button>' +
      '<button class="btn gl" data-act="msg" data-m="Filtros: prazo, origem, tipo" aria-label="Filtros">' + ic('filter') + '<span class="tx">Filtros</span></button>' +
      '<button class="btn escuro" data-act="msg" data-m="Nova demanda" aria-label="Nova demanda">' + ic('plus') + '<span class="tx">Nova demanda</span></button></div><div id="vista">' + vista() + '</div>';
  }

  // ---------- Agenda ----------
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var EVENTOS = [[21, '14:00 a 15:00', 'Reunião com a Prefeita', 'reuniao'], [22, '15:00 a 16:00', 'Audiência pública na Câmara', 'compromisso'], [23, '10:00 a 11:00', 'Reunião de equipe', 'reuniao'], [27, '09:00 a 10:30', 'Visita à Secretaria de Saúde', 'compromisso'], [28, 'dia inteiro', 'Dia do Servidor Público', 'feriado', 'Ponto facultativo']];
  function demDia(dia) { return DEMANDAS.filter(function (d) { if (!d.prazo) return false; var m = d.prazo.split('/'); return +m[0] === dia && m[1] === '10' && d.etapa !== 'Finalizado'; }); }
  function chipD(d) { return '<div class="ag-d' + (atrasada(d) ? ' venc' : '') + '" title="' + esc(d.assunto) + '">' + esc(d.num) + '</div>'; }
  function chipE(x) { return '<div class="ag-e' + (x[3] === 'feriado' ? ' dia' : '') + '"><b class="mono">' + (x[3] === 'feriado' ? '' : x[1].split(' ')[0]) + '</b> ' + esc(x[2]) + '</div>'; }
  function agenda() {
    var tabs = '<div class="filtros"><div class="vis" role="group" aria-label="Visão da agenda">' + [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês']].map(function (t) { return '<button data-act="ag" data-v="' + t[0] + '" aria-pressed="' + (estado.ag === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<span class="chip neutro">' + (estado.ag === 'mes' ? 'outubro de 2026' : estado.ag === 'hoje' ? 'quarta-feira, 21' : '18 a 24 de outubro') + '</span><span class="chip amar">Demandas</span><span class="chip azul">Eventos</span></div>';
    if (estado.ag === 'hoje') {
      return tabs + '<section class="sec"><h3>Compromissos de hoje</h3>' + EVENTOS.filter(function (x) { return x[0] === 21; }).map(function (x) { return '<div class="ag-e grande"><b class="mono">' + x[1] + '</b> ' + esc(x[2]) + '</div>'; }).join('') + '</section>' +
        '<section class="sec"><h3>Vencem hoje</h3><div class="vazio-c">Nenhuma demanda vence hoje</div></section><section class="sec"><h3>Atrasadas</h3>' + chipD(DEMANDAS[0]) + '</section>';
    }
    if (estado.ag === 'semana') {
      var cols = '';
      for (var i = 0; i < 7; i++) {
        var dia = 18 + i, fim = i === 0 || i === 6;
        cols += '<div class="ag-col' + (fim ? ' fim' : '') + (dia === 21 ? ' hoje' : '') + '"><div class="ag-h"><span>' + DIAS[i] + '</span><b class="mono">' + dia + '</b></div>' +
          '<div class="ag-ev">' + EVENTOS.filter(function (x) { return x[0] === dia; }).map(chipE).join('') + '</div><div class="ag-dm">' + demDia(dia).map(chipD).join('') +
          (dia === 24 ? '<div class="ag-d acomp" title="Data de acompanhamento">acompanhar 311</div>' : '') + '</div></div>';
      }
      return tabs + '<div class="ag-sem">' + cols + '</div>';
    }
    var cel = '';
    for (var j = 0; j < 42; j++) {
      var n = j - 3, mes = n >= 1 && n <= 31, fim2 = j % 7 === 0 || j % 7 === 6, qtd = mes ? demDia(n).length : 0;
      cel += '<div class="ag-cel' + (mes ? '' : ' fora') + (fim2 ? ' fim' : '') + (n === 21 ? ' hoje' : '') + '"><b class="mono">' + (mes ? n : (n < 1 ? 30 + n : n - 31)) + '</b>' + (qtd ? '<span class="chip amar">' + qtd + (qtd > 1 ? ' demandas' : ' demanda') + '</span>' : '') +
        (mes ? EVENTOS.filter(function (x) { return x[0] === n; }).map(function (x) { return '<div class="ag-e peq' + (x[3] === 'feriado' ? ' dia' : '') + '">' + esc(x[2]) + '</div>'; }).join('') : '') + '</div>';
    }
    return tabs + '<div class="ag-mes">' + DIAS.map(function (d) { return '<div class="ag-dn">' + d + '</div>'; }).join('') + cel + '</div>';
  }

  // ---------- Documentos, IA, Perfil, Arquivo, Mais ----------
  function documentos() { return '<div class="vazio">' + ic('file-text', 'grande') + '<h3>Conecte o Google Drive</h3><p>Aqui ficarão os modelos e os arquivos ligados às demandas.</p><button class="btn pri" data-act="msg" data-m="Conectar ao Drive">Conectar o Drive</button></div>'; }
  function ia() {
    var base = [['ia', 'Bom dia. Atenção: 1 demanda está vencida (TCE-RS). Às 14h há reunião com a Prefeita e o parecer da PGM está parado há 9 dias. Quer que eu monte o foco do dia?']];
    return '<div class="chat">' + base.concat(estado.chat).map(function (m) { return '<div class="bolha ' + m[0] + '">' + esc(m[1]) + '</div>'; }).join('') +
      '</div><form class="chat-f" data-form="chat"><input name="m" placeholder="Peça algo à estagiária" aria-label="Mensagem" autocomplete="off"><button class="btn pri" type="submit">' + ic('arrow-right') + 'Enviar</button></form>';
  }
  function arquivo() { return '<div class="lista">' + [['Memorando 031/2026', 'Mudança do protocolo', 'Finalizada'], ['Ofício 198/2026', 'Resposta ao Ministério Público', 'Finalizada']].map(function (x) { return '<div class="linha"><div class="linha-c"><span class="mono num">' + x[0] + '</span><span class="ass">' + x[1] + '</span><span class="chip neutro">' + x[2] + '</span><button class="btn mini" data-act="msg" data-m="Desarquivar">Desarquivar</button></div></div>'; }).join('') + '</div>'; }
  function mais() { return '<div class="lista">' + [['entradas', 'Entradas', 'inbox'], ['documentos', 'Documentos', 'file-text'], ['ia', 'IA', 'sparkles'], ['config', 'Configurações', 'settings'], ['arquivo', 'Arquivo', 'archive']].map(function (x) { return '<button class="navi grande" data-nav="' + x[0] + '"><span class="ico">' + ic(x[2], 'duo') + '</span><span>' + x[1] + '</span></button>'; }).join('') + '</div>'; }

  var TITULOS = { inicio: 'Início', entradas: 'Entradas', demandas: 'Demandas', agenda: 'Agenda', documentos: 'Documentos', ia: 'IA', config: 'Configurações', perfil: 'Perfil', arquivo: 'Arquivo', mais: 'Mais' };
  var TELAS_FN = { demandas: demandas, agenda: agenda, documentos: documentos, ia: ia, arquivo: arquivo, mais: mais };

  // ---------- montagem do app ----------
  var SUBS = { inicio: 'Seu dia em um só lugar.', entradas: 'Anotações rápidas que podem virar demandas.', agenda: 'Prazos de demanda e compromissos, juntos.', documentos: 'Modelos e arquivos ligados às demandas.', ia: 'Sua estagiária: pergunta, executa e desfaz.', config: 'Cores, fontes, ícones e tamanhos, com visualização na hora.', perfil: 'Só seu e privado.', arquivo: 'Demandas arquivadas.', mais: 'Outras áreas do Dmanda.' };
  function montar() {
    var f = $('#frame');
    var nav = NAV.filter(function (n) { return n[0] !== 'config'; }).map(function (n) { var at = n[0] === estado.tela; return '<button class="navi" data-nav="' + n[0] + '"' + (at ? ' aria-current="page"' : '') + ' title="' + n[1] + '"><span class="ico">' + ic(n[2], 'duo' + (at ? ' sol' : '')) + '</span><span class="tx">' + n[1] + '</span></button>'; }).join('');
    var cfgAt = estado.tela === 'config';
    var cfgBtn = '<button class="navi" data-nav="config"' + (cfgAt ? ' aria-current="page"' : '') + ' title="Configurações"><span class="ico">' + ic('settings', 'duo' + (cfgAt ? ' sol' : '')) + '</span><span class="tx">Configurações</span></button>';
    var emMais = ['mais', 'entradas', 'documentos', 'ia', 'config', 'arquivo'].indexOf(estado.tela) > -1;
    var bar = [['inicio', 'Início', 'house'], ['demandas', 'Demandas', 'square-kanban']].map(function (n) {
      var at = n[0] === estado.tela;
      return '<button class="bi" data-nav="' + n[0] + '"' + (at ? ' aria-current="page"' : '') + '>' + ic(n[2], 'duo' + (at ? ' sol' : '')) + n[1] + '</button>';
    }).join('') +
      '<button class="mais-c" data-act="plus" aria-label="Criar novo" aria-expanded="' + estado.plus + '">' + ic('plus') + '</button>' +
      '<button class="bi" data-nav="agenda"' + (estado.tela === 'agenda' ? ' aria-current="page"' : '') + '>' + ic('calendar', 'duo' + (estado.tela === 'agenda' ? ' sol' : '')) + 'Agenda</button>' +
      '<button class="bi" data-nav="mais"' + (emMais ? ' aria-current="page"' : '') + '>' + ic('ellipsis') + 'Mais</button>';
    var menu = MAIS.map(function (m, i) { return (i === 3 ? '<hr>' : '') + '<button class="' + (m[3] ? 'rapido' : '') + '" data-act="msg" data-m="Novo: ' + m[1] + '">' + ic(m[2]) + m[1] + '</button>'; }).join('');
    var sub = estado.tela === 'demandas' ? DEMANDAS.length + ' demandas, ' + DEMANDAS.filter(atrasada).length + ' atrasada. Do cadastro à conclusão.' : (SUBS[estado.tela] || '');
    var corpo = (TELAS_FN[estado.tela] || TELAS_FN.inicio)();
    f.innerHTML = '<div class="app" data-dir="' + estado.dir + '" data-tema="' + estado.tema + '" data-ico="' + iconeEstilo() + '" data-anim="' + estado.anim + '" data-dev="' + (estado.dev === 'desktop' || estado.dev === 'media' || estado.dev === 'tablet-h' ? 'desktop' : 'toque') + '">' +
      '<div class="bg"></div>' +
      '<aside class="side" aria-label="Menu"><div class="logo">' + LOGOS[estado.dir] + '<span>Dmanda</span></div>' + nav + '<div class="esp"></div>' + cfgBtn + '<button class="navi col-b" data-act="colapsar" aria-expanded="' + estado.menuAb + '" title="' + (estado.menuAb ? 'Recolher menu' : 'Mostrar menu') + '"><span class="ico">' + ic(estado.menuAb ? 'recolher' : 'expandir') + '</span><span class="tx">' + (estado.menuAb ? 'Recolher menu' : 'Mostrar menu') + '</span></button><div class="rodape">' + esc(estado.cidade || 'Taquara/RS') + '</div></aside>' +
      '<header class="top"><div class="top-logo">' + LOGOS[estado.dir] + '<span>Dmanda</span></div>' +
      '<button class="icbtn buscabtn" data-act="busca" aria-label="Buscar em tudo">' + ic('search') + '<span class="tx">Buscar demanda, entrada, evento ou documento</span><kbd>Ctrl K</kbd></button>' +
      '<button class="icbtn sino" data-act="msg" data-m="Avisos de compromissos" aria-label="Avisos, 2 novos">' + ic('bell') + '<span class="badge">2</span></button>' +
      '<button class="icbtn" data-act="tema" aria-label="Alternar tema claro e escuro">' + ic(estado.tema === 'claro' ? 'moon' : 'sun') + '</button>' +
      '<button class="perfil-b" data-act="perfil" aria-label="Abrir o Perfil"><span class="avatar">' + esc((estado.nome || 'S').charAt(0).toUpperCase()) + '</span><span class="tx">' + esc(estado.nome || 'Secretário') + '</span></button></header>' +
      '<main class="main" id="main">' + (estado.tela === 'inicio' ? '<div class="pagehead inicio"><h1 class="sr">Início</h1><p class="frase-dia">' + esc(window.DM.FRASE || '') + '</p></div>' : '<div class="pagehead"><h1>' + (TITULOS[estado.tela] || '') + '</h1><p>' + sub + '</p></div>') + corpo + '</main>' +
      '<nav class="bar glass" aria-label="Navegação">' + bar + '</nav>' +
      '<button class="fab" data-act="plus" aria-label="Criar novo" aria-expanded="' + estado.plus + '">' + ic('plus') + '</button>' +
      '<div class="menuplus glass' + (estado.plus ? ' aberto' : '') + '" role="menu" aria-label="Criar">' + menu + '</div>' +
      '<div class="busca-ov" id="ov"><div class="busca-box glass" role="dialog" aria-label="Busca"><input id="q" placeholder="Buscar demanda, entrada, evento ou documento" autocomplete="off"><div id="res"></div></div></div>' +
      window.DM.modalHTML() + '<div class="toast" id="toast" role="status"></div></div>';
    // estilo (paleta, fonte, tamanhos) aplicado por DOM: o valor tem aspas e não pode ir dentro do atributo em texto
    $('.app').setAttribute('style', window.DM.estiloApp());
    window.DM.pos();
    ajustar();
    $('#nota-dir').textContent = NOTAS[estado.dir];
  }


  // ---------- ajuste ao espaço: card e nota nunca têm barra de rolagem ----------
  // Sem espaço, some primeiro o que é secundário; o título preenche o espaço que sobrar, até onde couber.
  function ajustar() {
    $$('.face.front').forEach(function (f) {
      $$('.oculto', f).forEach(function (x) { x.classList.remove('oculto'); });
      ['.tempo', '.selo', '.prog', '.tags .chip'].forEach(function (q) { var x = f.querySelector(q); if (x && f.scrollHeight > f.clientHeight + 1) x.classList.add('oculto'); });
    });
    $$('.postit').forEach(function (p) { var t = p.querySelector('.p-tags'); if (t) t.classList.remove('oculto'); var x = p.querySelector('.fit'); if (t && x && x.clientHeight < 40) t.classList.add('oculto'); });
    $$('.fit').forEach(function (el) {
      el.style.webkitLineClamp = 'none';
      var lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.3;
      el.style.webkitLineClamp = String(Math.max(1, Math.floor((el.clientHeight + 1) / lh)));
    });
    $$('.face.back .tarefas').forEach(function (ul) {
      var velho = ul.querySelector('.mais-t'); if (velho) velho.remove();
      var lis = $$('li', ul), n = 0; lis.forEach(function (l) { l.style.display = ''; });
      while (ul.scrollHeight > ul.clientHeight + 1 && n < lis.length - 1) { lis[lis.length - 1 - n].style.display = 'none'; n++; }
      if (n) {
        var m = document.createElement('li'); m.className = 'mais-t'; ul.appendChild(m);
        while (n < lis.length - 1 && ul.scrollHeight > ul.clientHeight + 1) { lis[lis.length - 1 - n].style.display = 'none'; n++; }
        m.textContent = '+' + n + (n === 1 ? ' tarefa' : ' tarefas') + ', abra em Editar';
      }
    });
  }
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(ajustar, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ajustar(); });

  var tt;
  function toast(m, cru) { var t = $('#toast'); if (!t) return; t.textContent = cru ? m : m + ' (exemplo do protótipo)'; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 1800); }
  function trocar(opc) { var y = $('#main') && !(opc.tela && opc.tela !== estado.tela) ? $('#main').scrollTop : 0; if (opc.dir && opc.dir !== estado.dir) window.DM.mudaTema(estado.dir, opc.dir); Object.assign(estado, opc); montar(); if ($('#main')) $('#main').scrollTop = y; }
  function buscar() {
    var q = $('#q').value.toLowerCase(), r = [];
    DEMANDAS.forEach(function (d) { var s = (d.tipo + ' ' + d.num + ' ' + d.assunto + ' ' + d.origem).toLowerCase(); if (!q || s.indexOf(q) > -1) r.push(['Demandas', 'square-kanban', d.tipo + ' ' + d.num + ': ' + d.assunto]); });
    [['Entradas', 'sticky-note', 'Ligar para o RH sobre as escalas #rh'], ['Eventos', 'calendar', 'Reunião com a Prefeita, hoje às 14:00'], ['Documentos', 'file-text', 'Modelo de memorando']].forEach(function (x) { if (!q || x[2].toLowerCase().indexOf(q) > -1) r.push(x); });
    var g = {}; r.forEach(function (x) { (g[x[0]] = g[x[0]] || []).push(x); });
    $('#res').innerHTML = r.length ? Object.keys(g).map(function (k) { return '<h4>' + k + '</h4>' + g[k].map(function (x) { return '<button class="res" data-act="msg" data-m="Abriria o resultado">' + ic(x[1]) + '<span>' + esc(x[2]) + '</span></button>'; }).join(''); }).join('') : '<div class="vazio">Nada encontrado.</div>';
  }
  function abrirBusca() { $('#ov').classList.add('aberto'); $('#q').focus(); buscar(); }
  function fecharBusca() { var o = $('#ov'); if (o) o.classList.remove('aberto'); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-dir],[data-tema],[data-dev],[data-tela],[data-nav],[data-act]'); if (!b) { return; }
    if (b.closest('.ctl')) {
      var g = b.parentNode; $$('.seg', g).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      if (b.dataset.dir) trocar({ dir: b.dataset.dir, plus: false });
      if (b.dataset.tema) trocar({ tema: b.dataset.tema });
      if (b.dataset.tela) trocar({ tela: b.dataset.tela, plus: false });
      if (b.dataset.dev) { var f = $('#frame'); f.style.setProperty('--w', b.dataset.w + 'px'); f.style.setProperty('--h', b.dataset.h + 'px'); trocar({ dev: b.dataset.dev, ag: b.dataset.dev === 'phone' ? 'hoje' : estado.ag }); }
      return;
    }
    if (b.dataset.nav) { var n = b.dataset.nav; trocar({ tela: n, plus: false, menuAb: false }); $$('#g-tela .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tela === estado.tela); }); return; }
    var a = b.dataset.act, id = +b.dataset.id, d = DEMANDAS.filter(function (x) { return x.id === id; })[0];
    if (window.DM.acoes[a]) { window.DM.acoes[a](b, e); return; }
    if (a === 'plus') trocar({ plus: !estado.plus });
    else if (a === 'tema') {
      trocar({ tema: estado.tema === 'claro' ? 'escuro' : 'claro' });
      $$('#g-tema .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tema === estado.tema); });
    }
    else if (a === 'busca') abrirBusca();
    else if (a === 'girar') { estado.fixo[id] = b.dataset.lado; var c = b.closest('.dcard'); c.dataset.fix = b.dataset.lado; }
    else if (a === 'tarefa') { d.tarefas[+b.dataset.i].f = b.checked; trocar({}); }
    else if (a === 'humor') trocar({ humor: +b.dataset.i });
    else if (a === 'javi') { d.etapa = 'Vista'; trocar({}); toast('Marcada como Vista'); }
    else if (a === 'concluir' || a === 'finalizar') { d.etapa = 'Finalizado'; d.concluido = '21/10'; d.tarefas.forEach(function (t) { t.f = true; }); trocar({}); toast('Demanda finalizada'); }
    else if (a === 'reabrir') { d.etapa = 'Fazendo'; d.concluido = null; trocar({}); toast('Reaberta em Fazendo. O histórico foi mantido.'); }
    else if (a === 'add') { d.tarefas.push({ t: 'Nova tarefa', f: false }); trocar({}); toast('Tarefa adicionada'); }
    
    else if (a === 'vis') trocar({ vis: b.dataset.v });
    else if (a === 'etapa') trocar({ etapaSel: b.dataset.e });
    else if (a === 'grupo') { estado.grupos[b.dataset.e] = !estado.grupos[b.dataset.e]; trocar({}); }
    else if (a === 'atras') trocar({ soAtras: !estado.soAtras });
    else if (a === 'lib') trocar({ lib: b.dataset.v });
    else if (a === 'ordenar') trocar({ ordDir: estado.ord === b.dataset.k ? -estado.ordDir : 1, ord: b.dataset.k });
    else if (a === 'abrirlinha') { estado.aberto[id] = !estado.aberto[id]; trocar({}); }
    else if (a === 'ag') trocar({ ag: b.dataset.v });
    else if (a === 'pal') trocar({ pal: +b.dataset.i });
    else if (a === 'ico') trocar({ iconeEstilo: b.dataset.v });
    else if (a === 'anim') trocar({ anim: !estado.anim });
    else if (a === 'msg') { toast(b.dataset.m); if (estado.plus) trocar({ plus: false }); }
    if (a !== 'plus' && a !== 'msg' && estado.plus && !b.closest('.menuplus')) { estado.plus = false; var mp = $('.menuplus'); if (mp) mp.classList.remove('aberto'); }
  });
  document.addEventListener('click', function (e) { if (e.target.id === 'ov') fecharBusca(); });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') buscar();
    else if (e.target.id === 'fq') { estado.q = e.target.value; var v = $('#vista'); if (v) { v.innerHTML = vista(); ajustar(); } }
    else if (e.target.dataset && e.target.dataset.cfg) {
      var k = e.target.dataset.cfg; estado[k] = +e.target.value;
      var app = $('.app'); if (app) app.setAttribute('style', window.DM.estiloApp());
      var out = e.target.parentNode.querySelector('b'); if (out) out.textContent = e.target.value;
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.dataset.form !== 'chat') return;
    e.preventDefault();
    var m = e.target.elements.m.value.trim(); if (!m) return;
    estado.chat.push(['eu', m], ['ia', 'Entendi. No sistema de verdade eu buscaria nos seus dados e executaria, com opção de desfazer. Aqui é só um exemplo.']);
    trocar({});
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { fecharBusca(); if (estado.plus) trocar({ plus: false }); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirBusca(); }
    else if (e.key === '/' && e.target.tagName !== 'INPUT') { e.preventDefault(); var fq = $('#fq'); if (fq) fq.focus(); else abrirBusca(); }
    else if ((e.key === 'Enter') && e.target.dataset && e.target.dataset.act === 'abrir') window.DM.acoes.abrir(e.target);
  });

  window.DM = {
    estado: estado, trocar: trocar, toast: toast, ic: ic, esc: esc, $: $, $$: $$, DEMANDAS: DEMANDAS, EVENTOS: EVENTOS, ETAPAS: ETAPAS,
    PALETAS: PALETAS, hsl: hsl, estiloBase: estiloApp, estiloApp: estiloApp, iconeEstilo: iconeEstilo, cardHTML: cardHTML, stat: stat, focoDoDia: focoDoDia, porGrupo: porGrupo, grupoFiltro: grupoFiltro, diasAte: diasAte, diasDesde: diasDesde, atrasada: atrasada, corCard: corCard, dataCurta: dataCurta, plural: plural, TELAS_FN: TELAS_FN, ajustar: ajustar, chipsRow: chipsRow, acaoCard: acaoCard, FRASE: 'Um passo de cada vez já é caminhar. Hoje, o primeiro é pequeno.',
    acoes: {}, pos: function () {}, modalHTML: function () { return ''; }, mudaTema: function () {}, iniciar: function () {}
  };
  if (window.DM_EXTRA) window.DM_EXTRA(window.DM);

  // Estado inicial pela URL, por exemplo: index.html#dir=b&tema=escuro&dev=phone&tela=demandas
  var TELAS = { desktop: [1360, 780], 'tablet-h': [1180, 780], media: [1000, 780], 'tablet-v': [820, 900], phone: [390, 800] };
  new URLSearchParams(location.hash.slice(1)).forEach(function (v, k) { if (k in estado && k !== 'virado') estado[k] = (typeof estado[k] === 'number' || k === 'pal') && v !== '' && !isNaN(v) ? +v : v; });
  if (!TELAS[estado.dev]) estado.dev = 'desktop';
  new URLSearchParams(location.hash.slice(1)).forEach(function (v, k) { if (k === 'virar') v.split(',').forEach(function (i) { estado.fixo[i] = 'verso'; }); });
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('emo-img') && t.dataset.e) t.replaceWith(document.createTextNode(t.dataset.e));
  }, true);

  var f0 = $('#frame'); f0.style.setProperty('--w', TELAS[estado.dev][0] + 'px'); f0.style.setProperty('--h', TELAS[estado.dev][1] + 'px');
  $$('.ctl .seg').forEach(function (x) { var k = x.dataset.dir ? 'dir' : x.dataset.tema ? 'tema' : x.dataset.dev ? 'dev' : 'tela'; x.setAttribute('aria-pressed', x.dataset[k] === estado[k]); });
  estado.plus = estado.plus === 'true' || estado.plus === true;
  window.DM.iniciar();
  montar();
})();
