// Protótipo do Dmanda: dados fictícios, sem rede, sem gravar nada. Hoje no protótipo: quarta-feira, 21/10/2026.
(function () {
  var estado = { dir: 'a', tema: 'claro', dev: 'desktop', tela: 'inicio', virado: {}, plus: false, humor: 3 };

  var NOTAS = {
    a: 'Aurora: estilo Apple com vidro em menu, barra superior, janelas e botão flutuante. Fundo em gradiente suave, cards sólidos, cantos de 24 px, fonte Plus Jakarta Sans, ícones Lucide de traço fino em pastilha de vidro. Logo: o D de três colunas atual.',
    b: 'Papel: calmo e quase sem vidro. Fundo quente, cards de papel com borda fina, títulos e números em Fraunces (serifada), texto em Inter, ícones Lucide de traço firme em pastilhas suaves. Logo: monograma D em quadrado arredondado.',
    c: 'Grafite: denso e de leitura rápida. Bordas finas, cantos de 10 px, números em JetBrains Mono, faixa única de indicadores, ícones duotone. Logo: três barras ascendentes dentro de um D vazado.'
  };

  var LOGOS = {
    a: '<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10 4H32A28 28 0 0 1 32 60H10A6 6 0 0 1 4 54V10A6 6 0 0 1 10 4ZM16 16H18A3 3 0 0 1 21 19V45A3 3 0 0 1 18 48H16A3 3 0 0 1 13 45V19A3 3 0 0 1 16 16ZM28 16H30A3 3 0 0 1 33 19V35A3 3 0 0 1 30 38H28A3 3 0 0 1 25 35V19A3 3 0 0 1 28 16ZM40 16H42A3 3 0 0 1 45 19V25A3 3 0 0 1 42 28H40A3 3 0 0 1 37 25V19A3 3 0 0 1 40 16Z"/></svg>',
    b: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="4" width="56" height="56" rx="18" fill="currentColor"/><text x="32" y="46" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="700" font-size="40" fill="var(--acc-ink)">D</text></svg>',
    c: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 6H30A26 26 0 0 1 30 58H10Z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><rect x="19" y="36" width="6" height="14" rx="2" fill="currentColor"/><rect x="29" y="26" width="6" height="24" rx="2" fill="currentColor"/><rect x="39" y="16" width="6" height="34" rx="2" fill="currentColor"/></svg>'
  };

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
    var emojis = ['😞', '😕', '😐', '🙂', '😄'], rot = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'];
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
  function demandas() {
    return '<div class="filtros"><div class="vis" role="group" aria-label="Visão">' +
      '<button aria-pressed="true">' + ic('layout-grid') + 'Cards</button><button aria-pressed="false" data-act="msg" data-m="Visão Quadro fora do protótipo">' + ic('square-kanban') + 'Quadro</button>' +
      '<button aria-pressed="false" data-act="msg" data-m="Visão Tabela fora do protótipo">' + ic('table') + 'Tabela</button><button aria-pressed="false" data-act="msg" data-m="Visão Lista fora do protótipo">' + ic('list') + 'Lista</button></div>' +
      '<span class="chip perigo">1 atrasada</span><span class="chip neutro">Legal</span><span class="chip neutro">Próprio</span>' +
      '<button class="btn mini" data-act="msg" data-m="Atalho para o Arquivo">' + ic('archive') + 'Arquivo</button></div>' +
      '<div class="cards">' + DEMANDAS.map(cardHTML).join('') + '</div>';
  }
  var TITULOS = { inicio: 'Início', demandas: 'Demandas' };
  function outra(t) { return '<div class="vazio">' + ic('sparkles') + '<p>' + esc(t) + ' fica fora deste protótipo. Veja Início e Demandas.</p></div>'; }

  // ---------- montagem do app ----------
  function montar() {
    var f = $('#frame');
    var nav = NAV.map(function (n) { return '<button class="navi" data-nav="' + n[0] + '"' + (n[0] === estado.tela ? ' aria-current="page"' : '') + '><span class="ico">' + ic(n[2], 'duo') + '</span><span class="tx">' + n[1] + '</span></button>'; }).join('');
    var bar = [['inicio', 'Início', 'house'], ['demandas', 'Demandas', 'square-kanban']].map(function (n) {
      return '<button class="bi" data-nav="' + n[0] + '"' + (n[0] === estado.tela ? ' aria-current="page"' : '') + '>' + ic(n[2], 'duo') + n[1] + '</button>';
    }).join('') +
      '<button class="mais-c" data-act="plus" aria-label="Criar novo" aria-expanded="' + estado.plus + '">' + ic('plus') + '</button>' +
      '<button class="bi" data-nav="agenda">' + ic('calendar', 'duo') + 'Agenda</button><button class="bi" data-nav="mais">' + ic('ellipsis') + 'Mais</button>';
    var menu = MAIS.map(function (m, i) { return (i === 3 ? '<hr>' : '') + '<button class="' + (m[3] ? 'rapido' : '') + '" data-act="msg" data-m="Novo: ' + m[1] + '">' + ic(m[2]) + m[1] + '</button>'; }).join('');
    f.innerHTML = '<div class="app" data-dir="' + estado.dir + '" data-tema="' + estado.tema + '" data-dev="' + (estado.dev === 'desktop' || estado.dev === 'media' || estado.dev === 'tablet-h' ? 'desktop' : 'toque') + '">' +
      '<div class="bg"></div>' +
      '<aside class="side" aria-label="Menu"><div class="logo">' + LOGOS[estado.dir] + '<span>Dmanda</span></div>' + nav + '<div class="esp"></div><div class="rodape">Taquara/RS</div></aside>' +
      '<header class="top"><h2>' + (TITULOS[estado.tela] || '') + '</h2>' +
      '<button class="icbtn buscabtn" data-act="busca" aria-label="Buscar em tudo">' + ic('search') + '<span class="tx">Buscar em tudo</span><kbd>/</kbd></button>' +
      '<button class="icbtn" data-act="tema" aria-label="Alternar tema claro e escuro">' + ic(estado.tema === 'claro' ? 'moon' : 'sun') + '</button>' +
      '<button class="avatar" data-act="msg" data-m="Abriria o Perfil" aria-label="Abrir o Perfil">S</button></header>' +
      '<main class="main" id="main">' + (estado.tela === 'inicio' ? inicio() : estado.tela === 'demandas' ? demandas() : outra((NAV.filter(function (n) { return n[0] === estado.tela; })[0] || ['', 'Esta área'])[1])) + '</main>' +
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
      if (b.dataset.dev) { var f = $('#frame'); f.style.setProperty('--w', b.dataset.w + 'px'); f.style.setProperty('--h', b.dataset.h + 'px'); trocar({ dev: b.dataset.dev }); }
      return;
    }
    if (b.dataset.nav) { var n = b.dataset.nav; trocar({ tela: n === 'mais' ? 'config' : n, plus: false }); $$('#g-tela .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tela === estado.tela); }); return; }
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
    else if (a === 'msg') { toast(b.dataset.m); if (estado.plus) trocar({ plus: false }); }
    if (a !== 'plus' && a !== 'msg' && estado.plus && !b.closest('.menuplus')) { estado.plus = false; var mp = $('.menuplus'); if (mp) mp.classList.remove('aberto'); }
  });
  document.addEventListener('click', function (e) { if (e.target.id === 'ov') fecharBusca(); });
  document.addEventListener('input', function (e) { if (e.target.id === 'q') buscar(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { fecharBusca(); if (estado.plus) trocar({ plus: false }); }
    else if (e.key === '/' && e.target.tagName !== 'INPUT') { e.preventDefault(); abrirBusca(); }
    else if ((e.key === 'Enter') && e.target.dataset && e.target.dataset.act === 'abrir') toast('Abriria a demanda completa');
  });

  // Estado inicial pela URL, por exemplo: index.html#dir=b&tema=escuro&dev=phone&tela=demandas
  var TELAS = { desktop: [1360, 780], 'tablet-h': [1180, 780], media: [1000, 780], 'tablet-v': [820, 900], phone: [390, 800] };
  new URLSearchParams(location.hash.slice(1)).forEach(function (v, k) { if (k in estado && k !== 'virado') estado[k] = v; });
  if (!TELAS[estado.dev]) estado.dev = 'desktop';
  new URLSearchParams(location.hash.slice(1)).forEach(function (v, k) { if (k === 'virar') v.split(',').forEach(function (i) { estado.virado[i] = true; }); });
  var f0 = $('#frame'); f0.style.setProperty('--w', TELAS[estado.dev][0] + 'px'); f0.style.setProperty('--h', TELAS[estado.dev][1] + 'px');
  $$('.ctl .seg').forEach(function (x) { var k = x.dataset.dir ? 'dir' : x.dataset.tema ? 'tema' : x.dataset.dev ? 'dev' : 'tela'; x.setAttribute('aria-pressed', x.dataset[k] === estado[k]); });
  estado.plus = estado.plus === 'true' || estado.plus === true;
  montar();
})();
