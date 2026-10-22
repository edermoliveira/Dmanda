// Protótipo do Dmanda: dados fictícios, sem rede, sem gravar nada. Hoje no protótipo: quarta-feira, 21/10/2026.
(function () {
  var estado = { dir: 'a', tema: 'claro', dev: 'desktop', tela: 'inicio', virado: {}, plus: false, humor: 3, vis: 'cards', ord: 'prazo', ordDir: 1, aberto: {}, ag: 'semana', pal: null, fonte: 0, fs: 15, ico: 20, cardh: 340, anim: false, iconeEstilo: '', chat: [] };

  var NOTAS = {
    a: 'Aurora (a escolhida): estilo Apple com vidro em menu, barra superior, janelas e botão flutuante. Gradiente suave, cards sólidos, cantos de 24 px, logo D de três colunas. Fontes, paleta, ícones e tamanhos podem ser testados em Configurações. Todas as áreas do menu abrem.',
    b: 'Papel: calmo e quase sem vidro. Fundo quente, cards de papel com borda fina, títulos e números em Fraunces (serifada), texto em Inter, ícones Lucide de traço firme em pastilhas suaves. Logo: monograma D em quadrado arredondado.',
    c: 'Grafite: denso e de leitura rápida. Bordas finas, cantos de 10 px, números em JetBrains Mono, faixa única de indicadores, ícones duotone. Logo: três barras ascendentes dentro de um D vazado.'
  };

  var LOGOS_ORIG = {
    a: '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10 4H32A28 28 0 0 1 32 60H10A6 6 0 0 1 4 54V10A6 6 0 0 1 10 4ZM16 16H18A3 3 0 0 1 21 19V45A3 3 0 0 1 18 48H16A3 3 0 0 1 13 45V19A3 3 0 0 1 16 16ZM28 16H30A3 3 0 0 1 33 19V35A3 3 0 0 1 30 38H28A3 3 0 0 1 25 35V19A3 3 0 0 1 28 16ZM40 16H42A3 3 0 0 1 45 19V25A3 3 0 0 1 42 28H40A3 3 0 0 1 37 25V19A3 3 0 0 1 40 16Z"/></svg>',
    b: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="18" fill="currentColor"/><text x="32" y="46" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="700" font-size="40" fill="var(--acc-ink)">D</text></svg>',
    c: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 6H30A26 26 0 0 1 30 58H10Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><rect x="19" y="36" width="6" height="14" rx="2" fill="currentColor"/><rect x="29" y="26" width="6" height="24" rx="2" fill="currentColor"/><rect x="39" y="16" width="6" height="34" rx="2" fill="currentColor"/></svg>'
  };

  var LOGOS = { a: LOGOS_ORIG.a, b: LOGOS_ORIG.a, c: LOGOS_ORIG.a };

  // Hoje: 21/10/2026. Prazos e datas fictícios.
  var DEMANDAS = [
    { id: 1, tipo: 'Processo', num: '1842/2026', assunto: 'Resposta ao TCE sobre diárias de 2025', origem: 'TCE-RS', etapa: 'Fazendo', prazoTipo: 'Legal', prazo: '18/10', atraso: 3,
      tarefas: [{ t: 'Levantar diárias de 2025', f: true }, { t: 'Conferir com a Contabilidade', f: true }, { t: 'Redigir a resposta', f: false }, { t: 'Revisão jurídica', f: false }, { t: 'Protocolar', f: false }], chegou: '02/10', parado: 2 },
    { id: 2, tipo: 'Memorando', num: '087/2026', assunto: 'Revisão do contrato de limpeza', origem: 'Gabinete', etapa: 'Vista', prazoTipo: 'Próprio', prazo: '23/10', atraso: 0, tarefas: [], chegou: '19/10', parado: 2 },
    { id: 3, tipo: 'Ofício', num: '311/2026', assunto: 'Parecer sobre cessão de servidor', origem: 'Secretaria de Saúde', etapa: 'Aguardando retorno', setor: 'PGM', diasAg: 9, acompanhar: '24/10', prazoTipo: 'Próprio', prazo: '30/10', atraso: 0,
      tarefas: [{ t: 'Enviar ofício à PGM', f: true }, { t: 'Cobrar o parecer', f: false }], chegou: '08/10', parado: 9 },
    { id: 4, tipo: 'Processo', num: '2210/2026', assunto: 'Nomeação dos aprovados no concurso', origem: 'Câmara de Vereadores', etapa: 'Cadastro', prazoTipo: 'Legal', prazo: '28/10', atraso: 0, tarefas: [], chegou: '21/10', parado: 0 },
    { id: 5, tipo: 'Portaria', num: '045/2026', assunto: 'Horário de verão dos servidores', origem: 'Gabinete', etapa: 'Fazendo', prazoTipo: 'Próprio', prazo: '25/10', atraso: 0,
      tarefas: [{ t: 'Minutar a portaria', f: true }, { t: 'Assinatura da Prefeita', f: true }], chegou: '15/10', parado: 1 },
    { id: 6, tipo: 'Memorando', num: '071/2026', assunto: 'Reorganização do arquivo morto', origem: 'Secretaria', etapa: 'Finalizado', prazoTipo: 'Próprio', prazo: '14/10', atraso: 0,
      tarefas: [{ t: 'Listar caixas', f: true }, { t: 'Triagem', f: true }, { t: 'Descarte autorizado', f: true }], chegou: '01/10', parado: 0 }
  ];
  var FOCO = [1, 2, 3];

  var NAV = [
    ['inicio', 'Início', 'house'], ['entradas', 'Entradas', 'inbox'], ['demandas', 'Demandas', 'square-kanban'],
    ['agenda', 'Agenda', 'calendar'], ['documentos', 'Documentos', 'file-text'], ['ia', 'IA', 'sparkles'], ['config', 'Configurações', 'settings']
  ];
  var MAIS = [['plus-anot', 'Anotação', 'sticky-note', 1], ['plus-dem', 'Demanda', 'square-kanban', 1], ['plus-ev', 'Evento', 'calendar', 1], ['plus-tar', 'Tarefa', 'check', 0], ['plus-doc', 'Documento', 'file-text', 0], ['plus-chat', 'Chat com a IA', 'message-circle', 0]];

  function ic(n, extra) { return '<svg class="ic ' + (extra || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (window.ICONES[n] || '') + '</svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function pct(d) { if (!d.tarefas.length) return null; return Math.round(d.tarefas.filter(function (t) { return t.f; }).length / d.tarefas.length * 100); }

  // ---------- card de dois lados ----------
  function cardHTML(d) {
    var p = pct(d), pend = d.tarefas.filter(function (t) { return !t.f; }), fin = d.etapa === 'Finalizado';
    var atras = d.atraso > 0 && !fin;
    var meio;
    if (!d.tarefas.length) {
      meio = fin ? '' : '<div class="proxima vazia"><span>Nenhuma tarefa cadastrada</span><button data-act="add" data-id="' + d.id + '">+ Adicionar tarefa</button></div>';
    } else if (pend.length) {
      meio = '<div class="proxima">' + ic('arrow-right') + '<span>Próxima: ' + esc(pend[0].t) + '</span></div>';
    } else if (!fin) {
      meio = '<div class="fin"><span>Todas as tarefas concluídas</span><button data-act="finalizar" data-id="' + d.id + '">Finalizar demanda?</button></div>';
    } else { meio = ''; }
    var barra = '<div class="prog"><div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (p === null ? 0 : p) + '" aria-label="Progresso das tarefas"><i style="width:' + (p === null ? 0 : p) + '%"></i></div><b>' + (p === null ? '—' : p + '%') + '</b></div>';
    var etapaChip = fin ? '<span class="chip">Finalizada</span>' : '<span class="chip neutro">' + esc(d.etapa) + (d.etapa === 'Aguardando retorno' ? ' · ' + d.diasAg + ' d' : '') + '</span>';
    var frente = '<div class="face front">' +
      '<div class="cab"><span class="num">' + esc(d.tipo) + ' ' + esc(d.num) + '</span>' + etapaChip +
      '<button class="girar" data-act="girar" data-id="' + d.id + '" aria-label="Girar o card para ver o verso">' + ic('rotate-cw') + '</button></div>' +
      '<div class="assunto" data-act="abrir" data-id="' + d.id + '" tabindex="0" role="link">' + esc(d.assunto) + '</div>' +
      '<div class="origem">' + ic('building-2') + esc(d.origem) + '</div>' +
      '<div class="prazo' + (atras ? ' atrasada' : '') + '">' + ic(atras ? 'clock' : 'calendar-check') +
      '<span class="chip ' + (atras ? 'perigo' : (d.prazoTipo === 'Legal' ? '' : 'neutro')) + '">' + d.prazoTipo + '</span>' +
      '<span class="data-p">' + d.prazo + (atras ? ' · atrasada há ' + d.atraso + ' dias' : '') + '</span></div>' +
      meio + barra + '</div>';
    var tarefas = d.tarefas.length ? '<ul class="tarefas">' + d.tarefas.map(function (t, i) {
      return '<li><label><input type="checkbox" data-act="tarefa" data-id="' + d.id + '" data-i="' + i + '"' + (t.f ? ' checked' : '') + '><span class="' + (t.f ? 'feita' : '') + '">' + esc(t.t) + '</span></label></li>';
    }).join('') + '</ul>' : '<div class="proxima vazia"><span>Nenhuma tarefa cadastrada</span><button data-act="add" data-id="' + d.id + '">+ Adicionar tarefa</button></div>';
    var meta = '<div class="meta"><div>Chegou em<b>' + d.chegou + '</b></div><div>Dias parada<b>' + d.parado + '</b></div><div>Tipo<b>' + esc(d.tipo) + '</b></div>' +
      (d.setor ? '<div>Setor<b>' + esc(d.setor) + ' · ' + d.diasAg + ' dias</b></div><div>Acompanhar em<b>' + d.acompanhar + '</b></div>' : '') + '</div>';
    var acoes = '<div class="acoes">' +
      (d.etapa === 'Cadastro' ? '<button class="btn pri mini" data-act="javi" data-id="' + d.id + '">' + ic('eye') + 'Já vi</button>' : '') +
      (fin ? '<button class="btn mini" data-act="reabrir" data-id="' + d.id + '">Reabrir</button>' : '<button class="btn pri mini" data-act="concluir" data-id="' + d.id + '">' + ic('check') + 'Concluir</button>') +
      '<button class="btn mini so-icone" data-act="msg" data-m="Arquivar" aria-label="Arquivar" title="Arquivar">' + ic('archive') + '</button>' +
      '<button class="btn mini so-icone" data-act="msg" data-m="Mover de etapa" aria-label="Mover de etapa" title="Mover de etapa">' + ic('arrow-right') + '</button>' +
      '<button class="btn mini so-icone" data-act="msg" data-m="Editar" aria-label="Editar" title="Editar">' + ic('pencil') + '</button></div>';
    var verso = '<div class="face back"><div class="cab"><span class="num">' + esc(d.tipo) + ' ' + esc(d.num) + '</span>' +
      '<button class="girar" data-act="girar" data-id="' + d.id + '" aria-label="Voltar para a frente do card">' + ic('rotate-cw') + '</button></div>' + tarefas + meta + acoes + '</div>';
    return '<article class="dcard' + (atras ? ' atrasada' : '') + (estado.virado[d.id] ? ' virado' : '') + '" data-id="' + d.id + '"><div class="faces">' + frente + verso + '</div></article>';
  }

  // ---------- telas ----------
  function stat(n, r, icone, alerta) {
    return '<button class="stat' + (alerta ? ' alerta' : '') + '" data-act="msg" data-m="Abriria a lista filtrada"><span class="n">' + n + '</span><span class="r">' + ic(icone, 'duo') + r + '</span></button>';
  }
  function inicio() {
    var emojis = ['😔', '🙁', '😐', '🙂', '😄'], rot = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'];
    return '<div class="hero">' +
      '<section class="painel"><div class="data">quarta-feira, 21 de outubro</div><p class="frase">Um passo de cada vez já é caminhar. Hoje, o primeiro é pequeno.</p></section>' +
      '<section class="painel clima"><div>' + ic('cloud-sun', 'duo') + '</div><div><b>24°</b><div class="data">Taquara/RS, parcialmente nublado</div></div></section></div>' +
      '<div class="humor" role="group" aria-label="Como você está agora"><span>Como você está agora?</span>' +
      emojis.map(function (e, i) { return '<button class="emo" data-act="humor" data-i="' + i + '" aria-pressed="' + (estado.humor === i) + '" aria-label="' + rot[i] + '">' + e + '</button>'; }).join('') +
      '<button class="btn mini" data-act="msg" data-m="Registrar energia">' + ic('battery-medium') + 'Energia</button></div>' +
      '<div class="stats">' + stat(1, 'Atrasadas', 'clock', true) + stat(1, 'Para hoje', 'target') + stat(3, 'Próximos 7 dias', 'calendar') + stat(1, 'Aguardando retorno', 'hourglass') + stat(4, 'Entradas sem tratar', 'inbox') + '</div>' +
      '<section class="sec"><h3>Alertas</h3><div class="alertas">' +
      '<div class="alerta-l atrasada">' + ic('clock') + '<span>Resposta ao TCE sobre diárias está atrasada</span><span class="quando">3 dias</span></div>' +
      '<div class="alerta-l">' + ic('calendar') + '<span>Reunião com a Prefeita</span><span class="quando">hoje 14:00</span></div>' +
      '<div class="alerta-l">' + ic('hourglass') + '<span>Parecer da PGM parado há 9 dias</span><span class="quando">acompanhar 24/10</span></div></div></section>' +
      '<section class="sec"><h3>Foco do dia <small>até 3 demandas, você pode trocar</small></h3><div class="cards">' +
      FOCO.map(function (id) { return cardHTML(DEMANDAS.filter(function (d) { return d.id === id; })[0]); }).join('') + '</div></section>';
  }
  // ---------- paletas e fontes (Configurações) ----------
  var PALETAS = [['Água-marinha', 170, 1], ['Céu', 200, 1], ['Oceano', 220, 1], ['Índigo', 245, 1], ['Violeta', 270, 1], ['Orquídea', 300, 1], ['Rosa', 330, 1], ['Âmbar', 42, 1], ['Oliva', 90, 1], ['Grafite', 220, 0.1]];
  var FONTES = [
    ['Sora e Inter', '"Inter", system-ui, sans-serif', '"Sora", "Inter", sans-serif'],
    ['Jakarta', '"Plus Jakarta Sans", system-ui, sans-serif', '"Plus Jakarta Sans", sans-serif'],
    ['DM Sans e DM Serif', '"DM Sans", system-ui, sans-serif', '"DM Serif Display", Georgia, serif'],
    ['Fraunces e Inter', '"Inter", system-ui, sans-serif', '"Fraunces", Georgia, serif'],
    ['Manrope', '"Manrope", system-ui, sans-serif', '"Manrope", sans-serif']
  ];
  function hsl(h, sa, l, a) { return 'hsl(' + (((h % 360) + 360) % 360) + ' ' + Math.round(sa) + '% ' + l + '%' + (a ? ' / ' + a : '') + ')'; }
  function estiloApp() {
    var v = [], c = estado.pal === null ? null : PALETAS[estado.pal], f = FONTES[estado.fonte];
    v.push('--font:' + f[1], '--font-h:' + f[2], '--fs:' + estado.fs + 'px', '--icn:' + estado.ico + 'px', '--cardh:' + estado.cardh + 'px');
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

  // ---------- visões de Demandas ----------
  var ETAPAS = ['Cadastro', 'Vista', 'Fazendo', 'Aguardando retorno', 'Finalizado'];
  function ordenadas() {
    var k = estado.ord, dir = estado.ordDir;
    function chave(d) {
      if (k === 'num') return d.num;
      if (k === 'assunto') return d.assunto;
      if (k === 'origem') return d.origem;
      if (k === 'etapa') return ETAPAS.indexOf(d.etapa);
      if (k === 'pct') return pct(d) === null ? -1 : pct(d);
      var m = d.prazo.split('/'); return +m[1] * 100 + +m[0];
    }
    return DEMANDAS.slice().sort(function (a, b) { var x = chave(a), y = chave(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  }
  function mini(d) {
    var p = pct(d), at = d.atraso > 0 && d.etapa !== 'Finalizado';
    return '<article class="mini-card' + (at ? ' atrasada' : '') + '"><div class="num mono">' + esc(d.tipo) + ' ' + esc(d.num) + '</div><div class="assunto" data-act="abrir" data-id="' + d.id + '" tabindex="0" role="link">' + esc(d.assunto) + '</div>' +
      '<div class="origem">' + ic('building-2') + esc(d.origem) + '</div><div class="prazo' + (at ? ' atrasada' : '') + '"><span class="chip ' + (at ? 'perigo' : 'neutro') + '">' + d.prazoTipo + '</span><span class="mono">' + d.prazo + (at ? ' · atrasada' : '') + '</span></div>' +
      '<div class="prog"><div class="barra"><i style="width:' + (p || 0) + '%"></i></div><b class="mono">' + (p === null ? '—' : p + '%') + '</b></div></article>';
  }
  function quadro() {
    return '<div class="quadro">' + ETAPAS.map(function (et) {
      var l = DEMANDAS.filter(function (d) { return d.etapa === et; });
      return '<section class="coluna" aria-label="' + et + '"><h4>' + et + ' <span class="chip neutro">' + l.length + '</span></h4>' + (l.map(mini).join('') || '<div class="vazio-c">Nenhum card</div>') + '</section>';
    }).join('') + '</div>';
  }
  function tabela() {
    var cols = [['num', 'Número'], ['assunto', 'Assunto'], ['origem', 'Origem'], ['prazo', 'Prazo'], ['etapa', 'Etapa'], ['pct', '%']];
    return '<div class="tabela-w"><table class="tabela"><thead><tr>' + cols.map(function (c) {
      var at = estado.ord === c[0];
      return '<th scope="col" aria-sort="' + (at ? (estado.ordDir > 0 ? 'ascending' : 'descending') : 'none') + '"><button data-act="ordenar" data-k="' + c[0] + '">' + c[1] + (at ? ic(estado.ordDir > 0 ? 'arrow-up' : 'arrow-down') : '') + '</button></th>';
    }).join('') + '</tr></thead><tbody>' + ordenadas().map(function (d) {
      var p = pct(d), at = d.atraso > 0 && d.etapa !== 'Finalizado';
      return '<tr class="' + (at ? 'atrasada' : '') + '"><td class="mono">' + esc(d.num) + '</td><td>' + esc(d.assunto) + '</td><td>' + esc(d.origem) + '</td><td class="mono">' + d.prazo + ' <span class="chip ' + (at ? 'perigo' : 'neutro') + '">' + d.prazoTipo + '</span></td><td>' + esc(d.etapa) + '</td><td class="mono">' + (p === null ? '—' : p + '%') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function lista() {
    return '<div class="lista">' + DEMANDAS.map(function (d) {
      var p = pct(d), at = d.atraso > 0 && d.etapa !== 'Finalizado', ab = estado.aberto[d.id];
      var tar = d.tarefas.length ? '<ul class="tarefas">' + d.tarefas.map(function (t, i) { return '<li><label><input type="checkbox" data-act="tarefa" data-id="' + d.id + '" data-i="' + i + '"' + (t.f ? ' checked' : '') + '><span class="' + (t.f ? 'feita' : '') + '">' + esc(t.t) + '</span></label></li>'; }).join('') + '</ul>'
        : '<div class="proxima vazia"><span>Nenhuma tarefa cadastrada</span><button data-act="add" data-id="' + d.id + '">+ Adicionar tarefa</button></div>';
      return '<div class="linha' + (at ? ' atrasada' : '') + '"><button class="linha-c" data-act="abrirlinha" data-id="' + d.id + '" aria-expanded="' + !!ab + '">' + ic('chevron-right', ab ? 'gira' : '') +
        '<span class="mono num">' + esc(d.num) + '</span><span class="ass">' + esc(d.assunto) + '</span><span class="chip ' + (at ? 'perigo' : 'neutro') + '">' + d.prazo + '</span><b class="mono">' + (p === null ? '—' : p + '%') + '</b></button>' +
        (ab ? '<div class="linha-d">' + tar + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function demandas() {
    var V = [['cards', 'Cards', 'layout-grid'], ['quadro', 'Quadro', 'square-kanban'], ['tabela', 'Tabela', 'table'], ['lista', 'Lista', 'list']];
    return '<div class="filtros"><div class="vis" role="group" aria-label="Visão">' + V.map(function (v) {
      return '<button data-act="vis" data-v="' + v[0] + '" aria-pressed="' + (estado.vis === v[0]) + '">' + ic(v[2]) + v[1] + '</button>';
    }).join('') + '</div><span class="chip perigo">1 atrasada</span><span class="chip neutro">Legal</span><span class="chip neutro">Próprio</span>' +
      '<button class="btn mini" data-nav="arquivo">' + ic('archive') + 'Arquivo</button></div>' +
      (estado.vis === 'cards' ? '<div class="cards">' + DEMANDAS.map(cardHTML).join('') + '</div>' : estado.vis === 'quadro' ? quadro() : estado.vis === 'tabela' ? tabela() : lista());
  }

  // ---------- Entradas ----------
  var NOTAS_E = [
    ['Ligar para o RH sobre as escalas de fim de ano', ['rh'], true], ['Ideia: painel de demandas por origem no relatório mensal', ['ideia'], false],
    ['Conferir se a PGM respondeu o ofício 311', ['pgm', 'cobrar'], false], ['Pedir à Contabilidade o saldo de diárias', ['tce'], false],
    ['Reunião de segunda: pauta de compras', ['reuniao'], false], ['Lembrar de assinar a portaria do horário de verão', ['portaria'], false]
  ];
  function entradas() {
    var h = (PALETAS[estado.pal === null ? 0 : estado.pal])[1], e = estado.tema === 'escuro';
    return '<div class="filtros"><button class="btn pri mini" data-act="msg" data-m="Nova nota">' + ic('plus') + 'Nova nota</button><span class="chip neutro">#rh</span><span class="chip neutro">#tce</span><span class="chip neutro">#ideia</span></div><div class="postits">' +
      NOTAS_E.map(function (n, i) {
        var cor = e ? hsl(h + i * 55, 38, 26) : hsl(h + i * 55, 75, 87);
        return '<article class="postit" style="background:' + cor + '">' + (n[2] ? '<span class="fixo" title="Fixada no topo">' + ic('target') + '</span>' : '') + '<p>' + esc(n[0]) + '</p><div class="tags">' + n[1].map(function (t) { return '<span class="mono">#' + t + '</span>'; }).join(' ') + '</div>' +
          '<div class="acoes"><button class="btn mini" data-act="msg" data-m="Virar demanda: abre o cadastro preenchido">' + ic('arrow-right') + 'Virar demanda</button><button class="btn mini so-icone" data-act="msg" data-m="Arquivar nota" aria-label="Arquivar nota">' + ic('archive') + '</button></div></article>';
      }).join('') + '</div>';
  }

  // ---------- Agenda ----------
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var EVENTOS = [[21, '14:00 a 15:00', 'Reunião com a Prefeita'], [23, '10:00 a 11:00', 'Reunião de equipe'], [27, '09:00 a 10:30', 'Visita à Secretaria de Saúde'], [28, 'dia inteiro', 'Dia do Servidor Público', 1]];
  function demDia(dia) { return DEMANDAS.filter(function (d) { var m = d.prazo.split('/'); return +m[0] === dia && m[1] === '10' && d.etapa !== 'Finalizado'; }); }
  function chipD(d) { return '<div class="ag-d' + (d.atraso > 0 ? ' venc' : '') + '" title="' + esc(d.assunto) + '">' + esc(d.num) + '</div>'; }
  function chipE(x) { return '<div class="ag-e' + (x[3] ? ' dia' : '') + '"><b class="mono">' + (x[3] ? '' : x[1].split(' ')[0]) + '</b> ' + esc(x[2]) + '</div>'; }
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
        (mes ? EVENTOS.filter(function (x) { return x[0] === n; }).map(function (x) { return '<div class="ag-e peq' + (x[3] ? ' dia' : '') + '">' + esc(x[2]) + '</div>'; }).join('') : '') + '</div>';
    }
    return tabs + '<div class="ag-mes">' + DIAS.map(function (d) { return '<div class="ag-dn">' + d + '</div>'; }).join('') + cel + '</div>';
  }

  // ---------- Documentos, IA, Perfil, Arquivo, Mais ----------
  function documentos() { return '<div class="vazio">' + ic('file-text', 'grande') + '<h3>Conecte o Google Drive</h3><p>Aqui ficarão os modelos e os arquivos ligados às demandas.</p><button class="btn pri" data-act="msg" data-m="Conectar ao Drive">Conectar o Drive</button></div>'; }
  function ia() {
    var base = [['ia', 'Bom dia! Hoje você tem 1 demanda atrasada (TCE), 1 reunião às 14h e o parecer da PGM parado há 9 dias. Quer que eu organize o foco do dia?']];
    return '<div class="chat">' + base.concat(estado.chat).map(function (m) { return '<div class="bolha ' + m[0] + '">' + esc(m[1]) + '</div>'; }).join('') +
      '</div><form class="chat-f" data-form="chat"><input name="m" placeholder="Peça algo à estagiária" aria-label="Mensagem" autocomplete="off"><button class="btn pri" type="submit">' + ic('arrow-right') + 'Enviar</button></form>';
  }
  function perfil() {
    var dias = [['seg', 2], ['ter', 1], ['qua', 0], ['qui', 3], ['sex', 2], ['sáb', 0], ['dom', 0]];
    return '<div class="hero"><section class="painel"><h3>Hoje</h3><p class="frase">1 demanda finalizada</p><div class="data">Humor e energia são só seus. Este espaço não substitui acompanhamento profissional.</div></section>' +
      '<section class="painel"><h3>Semana</h3><div class="grafico">' + dias.map(function (d) { return '<div class="gcol" tabindex="0" title="' + d[0] + ': ' + d[1] + ' finalizadas"><i style="height:' + (10 + d[1] * 28) + 'px"></i><span>' + d[0] + '</span></div>'; }).join('') + '</div></section></div>';
  }
  function arquivo() { return '<div class="lista">' + [['Memorando 031/2026', 'Mudança do protocolo', 'Finalizada'], ['Ofício 198/2026', 'Resposta ao Ministério Público', 'Finalizada']].map(function (x) { return '<div class="linha"><div class="linha-c"><span class="mono num">' + x[0] + '</span><span class="ass">' + x[1] + '</span><span class="chip neutro">' + x[2] + '</span><button class="btn mini" data-act="msg" data-m="Desarquivar">Desarquivar</button></div></div>'; }).join('') + '</div>'; }
  function mais() { return '<div class="lista">' + [['entradas', 'Entradas', 'inbox'], ['documentos', 'Documentos', 'file-text'], ['ia', 'IA', 'sparkles'], ['config', 'Configurações', 'settings'], ['arquivo', 'Arquivo', 'archive']].map(function (x) { return '<button class="navi grande" data-nav="' + x[0] + '"><span class="ico">' + ic(x[2], 'duo') + '</span><span>' + x[1] + '</span></button>'; }).join('') + '</div>'; }

  // ---------- Configurações ----------
  function config() {
    return '<div class="cfg">' +
      '<section class="painel"><h3>Cores</h3><div class="pal">' + PALETAS.map(function (p, i) {
        return '<button class="sw" data-act="pal" data-i="' + i + '" aria-pressed="' + (estado.pal === i || (estado.pal === null && i === 0)) + '" aria-label="Paleta ' + p[0] + '" style="--sw1:' + hsl(p[1], 72 * p[2], 48) + ';--sw2:' + hsl(p[1] + 60, 70 * p[2], 80) + '"><i></i><span>' + p[0] + '</span></button>';
      }).join('') + '</div><div class="acoes"><button class="btn mini" data-act="surpreenda">' + ic('sparkles') + 'Surpreenda-me</button><button class="btn mini" data-act="tema">' + ic(estado.tema === 'claro' ? 'moon' : 'sun') + 'Tema ' + (estado.tema === 'claro' ? 'escuro' : 'claro') + '</button>' +
      '<button class="btn mini" data-act="anim" aria-pressed="' + estado.anim + '">Fundo animado: ' + (estado.anim ? 'ligado' : 'desligado') + '</button></div></section>' +
      '<section class="painel"><h3>Fontes</h3><div class="fontes">' + FONTES.map(function (f, i) {
        return '<button class="fonte" data-act="fonte" data-i="' + i + '" aria-pressed="' + (estado.fonte === i) + '"><span style="font-family:' + f[2] + ';font-size:20px;font-weight:700">' + f[0] + '</span><span style="font-family:' + f[1] + ';font-size:13px">Resposta ao Ofício 311/2026, ação, atenção e coração</span></button>';
      }).join('') + '</div></section>' +
      '<section class="painel"><h3>Ícones</h3><div class="acoes">' + [['pastilha', 'Lucide em pastilha'], ['fino', 'Lucide fino'], ['duotone', 'Lucide duotone']].map(function (x) {
        return '<button class="btn mini" data-act="ico" data-v="' + x[0] + '" aria-pressed="' + (iconeEstilo() === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div><div class="amostra-ic">' + ['house', 'inbox', 'square-kanban', 'calendar', 'file-text', 'sparkles', 'settings', 'clock', 'hourglass'].map(function (n) { return '<span class="ico">' + ic(n, 'duo') + '</span>'; }).join('') + '</div></section>' +
      '<section class="painel"><h3>Tamanhos</h3>' + [['fs', 'Texto', 13, 20, estado.fs], ['ico', 'Ícones', 16, 28, estado.ico], ['cardh', 'Altura dos cards', 300, 420, estado.cardh]].map(function (r) {
        return '<label class="rng">' + r[1] + ' <b class="mono">' + r[4] + '</b><input type="range" data-cfg="' + r[0] + '" min="' + r[2] + '" max="' + r[3] + '" value="' + r[4] + '"></label>';
      }).join('') + '<div class="acoes"><button class="btn mini" data-act="restaurar">Restaurar padrão</button></div><p class="data">Os limites impedem texto ilegível e botão abaixo de 44 px.</p></section></div>';
  }

  var TITULOS = { inicio: 'Início', entradas: 'Entradas', demandas: 'Demandas', agenda: 'Agenda', documentos: 'Documentos', ia: 'IA', config: 'Configurações', perfil: 'Perfil', arquivo: 'Arquivo', mais: 'Mais' };
  var TELAS_FN = { inicio: inicio, entradas: entradas, demandas: demandas, agenda: agenda, documentos: documentos, ia: ia, config: config, perfil: perfil, arquivo: arquivo, mais: mais };

  // ---------- montagem do app ----------
  function montar() {
    var f = $('#frame');
    var nav = NAV.map(function (n) { return '<button class="navi" data-nav="' + n[0] + '"' + (n[0] === estado.tela ? ' aria-current="page"' : '') + '><span class="ico">' + ic(n[2], 'duo') + '</span><span class="tx">' + n[1] + '</span></button>'; }).join('');
    var bar = [['inicio', 'Início', 'house'], ['demandas', 'Demandas', 'square-kanban']].map(function (n) {
      return '<button class="bi" data-nav="' + n[0] + '"' + (n[0] === estado.tela ? ' aria-current="page"' : '') + '>' + ic(n[2], 'duo') + n[1] + '</button>';
    }).join('') +
      '<button class="mais-c" data-act="plus" aria-label="Criar novo" aria-expanded="' + estado.plus + '">' + ic('plus') + '</button>' +
      '<button class="bi" data-nav="agenda"' + (estado.tela === 'agenda' ? ' aria-current="page"' : '') + '>' + ic('calendar', 'duo') + 'Agenda</button><button class="bi" data-nav="mais"' + (['mais', 'entradas', 'documentos', 'ia', 'config', 'arquivo'].indexOf(estado.tela) > -1 ? ' aria-current="page"' : '') + '>' + ic('ellipsis') + 'Mais</button>';
    var menu = MAIS.map(function (m, i) { return (i === 3 ? '<hr>' : '') + '<button class="' + (m[3] ? 'rapido' : '') + '" data-act="msg" data-m="Novo: ' + m[1] + '">' + ic(m[2]) + m[1] + '</button>'; }).join('');
    f.innerHTML = '<div class="app" data-dir="' + estado.dir + '" data-tema="' + estado.tema + '" data-ico="' + iconeEstilo() + '" data-anim="' + estado.anim + '" style="' + estiloApp() + '" data-dev="' + (estado.dev === 'desktop' || estado.dev === 'media' || estado.dev === 'tablet-h' ? 'desktop' : 'toque') + '">' +
      '<div class="bg"></div>' +
      '<aside class="side" aria-label="Menu"><div class="logo">' + LOGOS[estado.dir] + '<span>Dmanda</span></div>' + nav + '<div class="esp"></div><div class="rodape">Taquara/RS</div></aside>' +
      '<header class="top"><h2>' + (TITULOS[estado.tela] || '') + '</h2>' +
      '<button class="icbtn buscabtn" data-act="busca" aria-label="Buscar em tudo">' + ic('search') + '<span class="tx">Buscar em tudo</span><kbd>/</kbd></button>' +
      '<button class="icbtn" data-act="tema" aria-label="Alternar tema claro e escuro">' + ic(estado.tema === 'claro' ? 'moon' : 'sun') + '</button>' +
      '<button class="avatar" data-nav="perfil" aria-label="Abrir o Perfil">S</button></header>' +
      '<main class="main" id="main">' + (TELAS_FN[estado.tela] || inicio)() + '</main>' +
      '<nav class="bar glass" aria-label="Navegação">' + bar + '</nav>' +
      '<button class="fab" data-act="plus" aria-label="Criar novo" aria-expanded="' + estado.plus + '">' + ic('plus') + '</button>' +
      '<div class="menuplus glass' + (estado.plus ? ' aberto' : '') + '" role="menu" aria-label="Criar">' + menu + '</div>' +
      '<div class="busca-ov" id="ov"><div class="busca-box glass" role="dialog" aria-label="Busca"><input id="q" placeholder="Buscar demanda, entrada, evento ou documento" autocomplete="off"><div id="res"></div></div></div>' +
      '<div class="toast" id="toast" role="status"></div></div>';
    $('#nota-dir').textContent = NOTAS[estado.dir];
  }

  var tt;
  function toast(m) { var t = $('#toast'); if (!t) return; t.textContent = m + ' (exemplo do protótipo)'; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 1800); }
  function trocar(opc) { var y = $('#main') ? $('#main').scrollTop : 0; Object.assign(estado, opc); montar(); if ($('#main')) $('#main').scrollTop = y; }
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
    if (b.dataset.nav) { var n = b.dataset.nav; trocar({ tela: n, plus: false }); $$('#g-tela .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tela === estado.tela); }); return; }
    var a = b.dataset.act, id = +b.dataset.id, d = DEMANDAS.filter(function (x) { return x.id === id; })[0];
    if (a === 'plus') trocar({ plus: !estado.plus });
    else if (a === 'tema') {
      trocar({ tema: estado.tema === 'claro' ? 'escuro' : 'claro' });
      $$('#g-tema .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tema === estado.tema); });
    }
    else if (a === 'busca') abrirBusca();
    else if (a === 'girar') { estado.virado[id] = !estado.virado[id]; var c = b.closest('.dcard'); c.classList.toggle('virado', !!estado.virado[id]); }
    else if (a === 'tarefa') { d.tarefas[+b.dataset.i].f = b.checked; trocar({}); }
    else if (a === 'humor') trocar({ humor: +b.dataset.i });
    else if (a === 'javi') { d.etapa = 'Vista'; trocar({}); toast('Marcada como Vista'); }
    else if (a === 'concluir' || a === 'finalizar') { d.etapa = 'Finalizado'; trocar({}); toast('Demanda finalizada'); }
    else if (a === 'reabrir') { d.etapa = 'Fazendo'; trocar({}); toast('Reaberta em Fazendo, histórico preservado'); }
    else if (a === 'add') { d.tarefas.push({ t: 'Nova tarefa', f: false }); trocar({}); toast('Tarefa adicionada'); }
    else if (a === 'abrir') toast('Abriria a demanda completa');
    else if (a === 'vis') trocar({ vis: b.dataset.v });
    else if (a === 'ordenar') trocar({ ordDir: estado.ord === b.dataset.k ? -estado.ordDir : 1, ord: b.dataset.k });
    else if (a === 'abrirlinha') { estado.aberto[id] = !estado.aberto[id]; trocar({}); }
    else if (a === 'ag') trocar({ ag: b.dataset.v });
    else if (a === 'pal') trocar({ pal: +b.dataset.i });
    else if (a === 'surpreenda') trocar({ pal: Math.floor(Math.random() * PALETAS.length), fonte: Math.floor(Math.random() * FONTES.length) });
    else if (a === 'fonte') trocar({ fonte: +b.dataset.i });
    else if (a === 'ico') trocar({ iconeEstilo: b.dataset.v });
    else if (a === 'anim') trocar({ anim: !estado.anim });
    else if (a === 'restaurar') trocar({ pal: null, fonte: 0, fs: 15, ico: 20, cardh: 340, anim: false, iconeEstilo: '' });
    else if (a === 'msg') { toast(b.dataset.m); if (estado.plus) trocar({ plus: false }); }
    if (a !== 'plus' && a !== 'msg' && estado.plus && !b.closest('.menuplus')) { estado.plus = false; var mp = $('.menuplus'); if (mp) mp.classList.remove('aberto'); }
  });
  document.addEventListener('click', function (e) { if (e.target.id === 'ov') fecharBusca(); });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') buscar();
    else if (e.target.dataset && e.target.dataset.cfg) {
      var k = e.target.dataset.cfg; estado[k] = +e.target.value;
      var app = $('.app'); if (app) app.setAttribute('style', estiloApp());
      var out = e.target.parentNode.querySelector('b'); if (out) out.textContent = e.target.value;
    }
  });
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = e.target.elements.m.value.trim(); if (!m) return;
    estado.chat.push(['eu', m], ['ia', 'Entendi. No sistema de verdade eu buscaria nos seus dados e executaria, com opção de desfazer. Aqui é só um exemplo.']);
    trocar({});
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { fecharBusca(); if (estado.plus) trocar({ plus: false }); }
    else if (e.key === '/' && e.target.tagName !== 'INPUT') { e.preventDefault(); abrirBusca(); }
    else if ((e.key === 'Enter') && e.target.dataset && e.target.dataset.act === 'abrir') toast('Abriria a demanda completa');
  });

  // Estado inicial pela URL, por exemplo: index.html#dir=b&tema=escuro&dev=phone&tela=demandas
  var TELAS = { desktop: [1360, 780], 'tablet-h': [1180, 780], media: [1000, 780], 'tablet-v': [820, 900], phone: [390, 800] };
  new URLSearchParams(location.hash.slice(1)).forEach(function (v, k) { if (k in estado && k !== 'virado') estado[k] = (typeof estado[k] === 'number' || k === 'pal') && v !== '' && !isNaN(v) ? +v : v; });
  if (!TELAS[estado.dev]) estado.dev = 'desktop';
  new URLSearchParams(location.hash.slice(1)).forEach(function (v, k) { if (k === 'virar') v.split(',').forEach(function (i) { estado.virado[i] = true; }); });
  var f0 = $('#frame'); f0.style.setProperty('--w', TELAS[estado.dev][0] + 'px'); f0.style.setProperty('--h', TELAS[estado.dev][1] + 'px');
  $$('.ctl .seg').forEach(function (x) { var k = x.dataset.dir ? 'dir' : x.dataset.tema ? 'tema' : x.dataset.dev ? 'dev' : 'tela'; x.setAttribute('aria-pressed', x.dataset[k] === estado[k]); });
  estado.plus = estado.plus === 'true' || estado.plus === true;
  montar();
})();
