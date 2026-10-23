// Quinta rodada (22/10/2026): widgets do Início (com Pomodoro), widgets nas Configurações e
// a IA que registra entrada ou evento a partir de um texto escrito de qualquer jeito.
// Recebe o objeto DM exposto pelo app.js, depois do extra.js.

// ícones novos (mesmo traço do Iconoir), valem para as duas bibliotecas
(function () {
  var N = {
    minus: '<path d="M6 12h12"/>',
    play: '<path d="M7.5 5.6v12.8a.6.6 0 0 0 .9.5l10.2-6.4a.6.6 0 0 0 0-1L8.4 5.1a.6.6 0 0 0-.9.5Z"/>',
    pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1"/><rect x="13.9" y="5" width="3.6" height="14" rx="1"/>',
    timer: '<path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    widgets: '<rect x="3" y="3" width="8" height="8" rx="2.5"/><rect x="13" y="3" width="8" height="8" rx="2.5"/><rect x="3" y="13" width="18" height="8" rx="2.5"/>',
    send: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>'
  };
  Object.keys(N).forEach(function (k) { window.ICONOIR[k] = window.ICONOIR[k] || N[k]; window.ICONES[k] = window.ICONES[k] || N[k]; });
})();

window.DM_V5 = function (DM) {
  var E = DM.estado, ic = DM.ic, esc = DM.esc, $ = DM.$, $$ = DM.$$, TELAS = DM.TELAS_FN, A = DM.acoes;

  // ---------- widgets do Início ----------
  // tamanho p = pequeno (quadrado), m = médio (dois quadrados). Cada um pode ser ligado ou desligado nas Configurações.
  var WG = [['pomo', 'Pomodoro', 'timer', 'm', 'Timer de foco e pausa, com o tempo que você quiser'], ['hoje', 'Hoje na agenda', 'calendar', 'p', 'O dia de hoje e os próximos compromissos'],
    ['mes', 'Calendário', 'calendar-check', 'p', 'O mês, com os dias que têm compromisso'], ['clima', 'Clima', 'cloud-sun', 'p', 'Temperatura e previsão da cidade'], ['nota', 'Última anotação', 'sticky-note', 'p', 'A nota mais recente de Entradas']];
  E.widgets = { pomo: true, hoje: true, mes: true, clima: false, nota: false };
  E.pomo = { modo: 'foco', min: { foco: 25, pausa: 5 }, rest: null, fim: null, rodando: false, acabou: false };

  function total() { return E.pomo.min[E.pomo.modo] * 60; }
  function restante() { var P = E.pomo; return P.rodando ? Math.max(0, Math.ceil((P.fim - Date.now()) / 1000)) : P.rest != null ? P.rest : total(); }
  function mmss(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  var VOLTA = 2 * Math.PI * 44;
  function pomoHTML() {
    var P = E.pomo, r = restante(), inicial = !P.rodando && P.rest == null, frac = r / total(), foco = P.modo === 'foco';
    var centro = inicial ? '<label class="pomo-ed"><input class="mono" type="number" inputmode="numeric" min="1" max="180" value="' + P.min[P.modo] + '" data-pomo-min aria-label="Minutos de ' + (foco ? 'foco' : 'pausa') + '"><span>min</span></label>'
      : '<b class="pomo-t mono" aria-live="off">' + mmss(r) + '</b><span class="pomo-s">' + (P.rodando ? (foco ? 'focando' : 'pausa') : 'pausado') + '</span>';
    return '<section class="wg wg-m wg-pomo' + (foco ? '' : ' pausa') + (P.acabou ? ' acabou' : '') + (P.rodando ? ' rodando' : '') + '" aria-label="Pomodoro">' +
      '<div class="pomo-anel"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="trilho" cx="50" cy="50" r="44"/><circle class="arco" cx="50" cy="50" r="44" stroke-dasharray="' + VOLTA.toFixed(2) + '" stroke-dashoffset="' + (VOLTA * (1 - frac)).toFixed(2) + '"/></svg><div class="pomo-c">' + centro + '</div></div>' +
      '<div class="pomo-lado"><div class="wg-h">' + ic('timer') + '<b>Pomodoro</b></div>' +
      '<div class="seg-p" role="group" aria-label="Modo do timer"><button data-act="pomo-modo" data-v="foco" aria-pressed="' + foco + '">Foco</button><button data-act="pomo-modo" data-v="pausa" aria-pressed="' + !foco + '">Pausa</button></div>' +
      '<div class="pomo-ctl"><button class="pomo-b" data-act="pomo-passo" data-n="-5" aria-label="Menos 5 minutos"' + (inicial && P.min[P.modo] > 1 ? '' : ' disabled') + '>' + ic('minus') + '</button>' +
      '<button class="pomo-b play" data-act="pomo-play" aria-label="' + (P.rodando ? 'Pausar' : r < total() ? 'Continuar' : 'Começar') + '">' + ic(P.rodando ? 'pause' : 'play') + '</button>' +
      '<button class="pomo-b" data-act="pomo-passo" data-n="5" aria-label="Mais 5 minutos"' + (inicial && P.min[P.modo] < 180 ? '' : ' disabled') + '>' + ic('plus') + '</button>' +
      '<button class="pomo-b" data-act="pomo-zerar" aria-label="Recomeçar"' + (inicial ? ' disabled' : '') + '>' + ic('rotate-cw') + '</button></div></div></section>';
  }
  // redesenha só o widget (o resto da tela fica como está); o campo de minutos pode disparar isto ao perder o foco
  var pintando = false;
  function repintaPomo() {
    var w = $('.wg-pomo'); if (!w || !w.isConnected || pintando) return;
    pintando = true; try { var t = document.createElement('div'); t.innerHTML = pomoHTML(); w.replaceWith(t.firstChild); } finally { pintando = false; }
  }
  setInterval(function () {
    var P = E.pomo; if (!P.rodando) return;
    var r = restante(), t = $('.pomo-t'), arco = $('.wg-pomo .arco');
    if (t) t.textContent = mmss(r);
    if (arco) arco.setAttribute('stroke-dashoffset', (VOLTA * (1 - r / total())).toFixed(2));
    if (r <= 0) {
      var eraFoco = P.modo === 'foco';
      Object.assign(P, { rodando: false, rest: null, fim: null, modo: eraFoco ? 'pausa' : 'foco', acabou: true });
      repintaPomo(); DM.toast(eraFoco ? 'Foco encerrado. Que tal uma pausa?' : 'Pausa encerrada. Pronto para mais um foco?', 1);
      setTimeout(function () { P.acabou = false; var w = $('.wg-pomo'); if (w) w.classList.remove('acabou'); }, 4000);
    }
  }, 250);
  A['pomo-play'] = function () { var P = E.pomo; if (P.rodando) { P.rest = restante(); P.rodando = false; } else { P.fim = Date.now() + restante() * 1000; P.rodando = true; P.rest = null; } P.acabou = false; repintaPomo(); };
  A['pomo-zerar'] = function () { Object.assign(E.pomo, { rodando: false, rest: null, fim: null }); repintaPomo(); };
  A['pomo-modo'] = function (b) { Object.assign(E.pomo, { modo: b.dataset.v, rodando: false, rest: null, fim: null }); repintaPomo(); };
  A['pomo-passo'] = function (b) { var P = E.pomo; P.min[P.modo] = Math.min(180, Math.max(1, P.min[P.modo] + +b.dataset.n)); repintaPomo(); };
  document.addEventListener('input', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-pomo-min')) { var v = Math.round(+e.target.value); if (v >= 1 && v <= 180) E.pomo.min[E.pomo.modo] = v; } });
  document.addEventListener('change', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-pomo-min')) setTimeout(repintaPomo, 0); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-pomo-min')) { e.preventDefault(); e.target.blur(); A['pomo-play'](); } });

  function evOrd() { return DM.EVENTOS.slice().sort(function (a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : 1); }); }
  function wgHoje() {
    var hoje = evOrd().filter(function (x) { return x[0] === 21; }), prox = hoje.length ? hoje : evOrd().filter(function (x) { return x[0] > 21; }).slice(0, 1);
    return '<button class="wg wg-p wg-hoje" data-act="wg-ag" data-v="hoje" aria-label="Hoje na agenda. Abrir a agenda"><span class="wg-dia">Qua <span>out</span></span><b class="wg-num">21</b>' +
      '<span class="wg-evs">' + (prox.length ? prox.slice(0, 2).map(function (x) { return '<span class="wg-ev k-' + x[3] + '"><b>' + esc(x[2]) + '</b><span class="mono">' + (x[0] === 21 ? '' : x[0] === 22 ? 'amanhã · ' : x[0] + '/10 · ') + (x[3] === 'feriado' ? 'dia inteiro' : x[1].split(' a ')[0]) + '</span></span>'; }).join('') : '<span class="data">Nada marcado</span>') + '</span></button>';
  }
  function wgMes() {
    var tem = {}; DM.EVENTOS.forEach(function (x) { tem[x[0]] = 1; });
    var g = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(function (l) { return '<i class="l">' + l + '</i>'; }).join('');
    for (var j = 0; j < 35; j++) { var n = j - 3; g += n >= 1 && n <= 31 ? '<i class="' + (n === 21 ? 'h' : '') + (tem[n] ? ' t' : '') + (j % 7 === 0 || j % 7 === 6 ? ' f' : '') + '">' + n + '</i>' : '<i></i>'; }
    return '<button class="wg wg-p wg-mes" data-act="wg-ag" data-v="mes" aria-label="Calendário de outubro. Abrir a agenda do mês"><span class="wg-dia">OUTUBRO</span><span class="mg mono">' + g + '</span></button>';
  }
  function wgClima() {
    return '<section class="wg wg-p wg-clima" aria-label="Clima"><span class="wg-cid">' + esc(E.cidade) + '</span><b class="wg-temp">24°</b><span class="wg-ceu">' + ic('cloud-sun') + 'Parcialmente nublado</span><span class="wg-mm mono">máx. 27° · mín. 16°</span></section>';
  }
  function wgNota() {
    var n = DM.NOTAS_E[0];
    if (!n) return '<section class="wg wg-p wg-nota"><span class="wg-dia">ENTRADAS</span><span class="data">Nenhuma anotação ainda.</span></section>';
    return '<button class="wg wg-p wg-nota" data-act="editar-nota" data-i="0" style="--nota:' + DM.corNota(n.cor) + '" aria-label="Abrir a última anotação"><span class="wg-dia">ÚLTIMA ANOTAÇÃO</span><span class="wg-ntx">' + esc((n.t || n.x).replace(/#[\p{L}\p{N}_]+/gu, '').trim()) + '</span></button>';
  }
  var FAZ = { pomo: pomoHTML, hoje: wgHoje, mes: wgMes, clima: wgClima, nota: wgNota };
  DM.widgetsHTML = function () {
    var on = WG.filter(function (w) { return E.widgets[w[0]]; });
    return on.length ? '<section class="widgets" aria-label="Widgets">' + on.map(function (w) { return FAZ[w[0]](); }).join('') + '</section>' : '';
  };
  A['wg-ag'] = function (b) { DM.trocar({ tela: 'agenda', ag: b.dataset.v }); };
  DM.cfgWidgets = function () {
    return '<section class="painel"><h3>Widgets do Início</h3><p class="data">Ligue os que quiser ver no Início. Ficam em quadradinhos, como os widgets do iPhone.</p><div class="wg-cfg">' + WG.map(function (w) {
      return '<div class="wg-l"><span class="ico">' + ic(w[2], 'duo') + '</span><span class="wg-l-t"><b>' + w[1] + '</b><small>' + w[4] + (w[3] === 'm' ? ' (tamanho médio)' : '') + '</small></span>' +
        '<button class="switch" role="switch" aria-checked="' + !!E.widgets[w[0]] + '" data-act="wg-tog" data-w="' + w[0] + '" aria-label="' + w[1] + '"></button></div>';
    }).join('') + '</div></section>';
  };
  A['wg-tog'] = function (b) { E.widgets[b.dataset.w] = !E.widgets[b.dataset.w]; DM.trocar({}); DM.toast((E.widgets[b.dataset.w] ? 'Widget ligado: ' : 'Widget desligado: ') + b.getAttribute('aria-label'), 1); };

  // Agenda no toque: tocar no dia mostra o "+" daquele dia
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.ag-cel:not(.fora), .ag-col'); if (!c || e.target.closest('button')) return;
    $$('.ag-cel.mostra, .ag-col.mostra').forEach(function (x) { if (x !== c) x.classList.remove('mostra'); });
    c.classList.toggle('mostra');
  });

  // ---------- IA: escreva de qualquer jeito, ela organiza como entrada ou evento ----------
  // No protótipo a leitura do texto é feita por regras simples; no sistema real o modelo entende o pedido
  // e o código do Dmanda executa, sempre com confirmação e com desfazer.
  E.chat = []; E.iaModo = 'auto';
  function sa(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var SEM = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  function acharData(b) {
    var m;
    if (/depois de amanha/.test(b)) return 23;
    if (/\bamanha\b/.test(b)) return 22;
    if (/\bhoje\b/.test(b)) return 21;
    if ((m = b.match(/\b(\d{1,2})\/(\d{1,2})\b/))) return +m[2] === 10 ? +m[1] : { dia: +m[1], mes: +m[2] };
    if ((m = b.match(/\bdia (\d{1,2})\b/))) return +m[1] >= 21 ? +m[1] : { dia: +m[1], mes: 11 };
    for (var i = 0; i < 7; i++) if (new RegExp('\\b' + SEM[i] + '\\b').test(b)) { var d = 21 + ((i - 3 + 7) % 7 || 7); return d <= 31 ? d : { dia: d - 31, mes: 11 }; }
    return null;
  }
  function acharHoras(b) {
    var re = /\b(?:as |das |a partir das )?(\d{1,2})(?::(\d{2})|h(\d{2})?)(?![\d/])|\b(?:as|das) (\d{1,2})\b(?![\d/:h])/g, m, o = [];
    while ((m = re.exec(b))) { var h = +(m[1] || m[4]), mi = +(m[2] || m[3] || 0); if (h <= 23 && mi <= 59) o.push(String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0')); }
    return o;
  }
  var TAGS = [['rh', /\brh\b|recursos humanos|escala|servidor|ferias|folha/], ['tce', /\btce\b|tribunal de contas/], ['pgm', /\bpgm\b|parecer|juridic|procuradoria/], ['compras', /compra|licita|registro de preco|pregao/],
    ['cobrar', /cobrar|reiterar|cobranca/], ['camara', /camara|vereador/], ['saude', /saude/], ['obras', /\bobras\b/], ['financas', /contab|diaria|orcament|empenho/], ['prefeita', /prefeita|gabinete/], ['ideia', /\bideia\b/]];
  var CLASSE = [['Ligação', /\bligar\b|telefon|ligacao/, 0], ['Cobrança', /cobrar|reiterar|cobranca/, 1], ['Ideia', /\bideia\b/, 2], ['Lembrete', /lembr|nao esquecer/, 3], ['Pendência', /./, 4]];
  var EVTXT = /reuni|audiencia|visita|encontro|compromisso|consulta|evento|palestra|sessao|almoco|cafe com/;
  // limites de palavra que entendem acentos (o \b do JavaScript não reconhece "ã" nem "à")
  var I = '(?<![\\p{L}\\p{N}])', F = '(?![\\p{L}\\p{N}])';
  function R(s) { return new RegExp(I + s + F, 'giu'); }
  function soTexto(t) { return t.replace(/#[\p{L}\p{N}_]+/gu, '').replace(R('pro'), 'para o').replace(R('pra'), 'para a'); }
  function arrumar(t) { return t.replace(/\s+([,.;!?])/g, '$1').replace(/\s{2,}/g, ' ').replace(/^[\s,.;:]+|[\s,;:]+$/g, '').trim(); }
  function limparTexto(t) {
    return arrumar(soTexto(t).replace(R('(?:na )?(?:semana que vem|pr[óo]xima semana)'), '').replace(R('depois de amanh[ãa]'), '').replace(R('amanh[ãa]'), '').replace(R('hoje'), '')
      .replace(R('(?:na |no |nesta |neste |pr[óo]xima |pr[óo]ximo )?(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?'), '')
      .replace(R('(?:às|as|das|a partir das)\\s+\\d{1,2}(?::\\d{2}|h\\d{0,2})?'), '').replace(R('\\d{1,2}(?::\\d{2}|h\\d{0,2})'), '')
      .replace(R('(?:dia )?\\d{1,2}\\/\\d{1,2}'), '').replace(R('dia \\d{1,2}'), ''));
  }
  function semInicio(t) { var r = /^(preciso|tenho que|tenho de|lembrar de|n[ãa]o esquecer de|anotar( que)?|registrar|marcar( uma)?|agendar( uma)?|quero|vou|favor|ideia:?|nota:?|lembrete:?)\s+/i; while (r.test(t)) t = t.replace(r, ''); return t; }
  function maiuscula(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
  function interpretar(txt, modo) {
    var b = sa(txt), data = acharData(b), horas = acharHoras(b), limpo = semInicio(limparTexto(txt));
    var tipo = modo === 'entrada' ? 'entrada' : modo === 'evento' ? 'evento' : (horas.length || EVTXT.test(b)) ? 'evento' : 'entrada';
    var corte = limpo.split(/\s+(?:sobre|para tratar|a respeito d[eoa]s?|referente a)\s+|[,.;:!?]\s+|\s+e depois\s+/i), titulo = corte[0].split(/\s+/).slice(0, 8).join(' ').replace(/[.,;:]+$/, '');
    // na entrada a descrição guarda a data como foi escrita; no evento a data e a hora vão para campos próprios
    var desc = maiuscula(tipo === 'entrada' ? semInicio(arrumar(soTexto(txt))) : limpo).replace(/[.!]*$/, '.');
    if (sa(desc).replace(/[^a-z0-9]/g, '') === sa(titulo).replace(/[^a-z0-9]/g, '')) desc = '';
    var tags = (txt.match(/#[\p{L}\p{N}_]+/gu) || []).map(function (x) { return x.slice(1).toLowerCase(); });
    TAGS.forEach(function (t) { if (tags.length < 3 && tags.indexOf(t[0]) < 0 && t[1].test(b)) tags.push(t[0]); });
    if (tipo === 'entrada') {
      var c = CLASSE.filter(function (k) { return k[1].test(b); })[0];
      return { tipo: 'entrada', classe: c[0], cor: c[2], titulo: maiuscula(titulo), desc: desc, tags: tags.slice(0, 3), data: data };
    }
    var k = /reuni/.test(b) ? 'Reunião' : /feriado|ponto facultativo/.test(b) ? 'Feriado ou ponto facultativo' : /lembr|nao esquecer/.test(b) ? 'Lembrete' : 'Compromisso';
    var ini = horas[0] || '', fim = horas[1] || (ini ? String((+ini.slice(0, 2) + 1) % 24).padStart(2, '0') + ini.slice(2) : '');
    return { tipo: 'evento', kind: k, titulo: maiuscula(titulo), desc: desc, tags: tags.slice(0, 3), dia: typeof data === 'number' ? data : null, fora: data && typeof data === 'object' ? data : null, ini: ini, fim: fim, fimSug: !horas[1] && !!ini };
  }
  var EXEMPLOS = ['ligar pro RH amanhã sobre as escalas de fim de ano', 'reunião com a PGM sexta às 10h sobre o parecer do ofício 311', 'ideia: relatório mensal com as demandas por origem', 'cobrar a contabilidade do saldo de diárias #tce'];
  function propHTML(m, i) {
    var p = m.prop, ent = p.tipo === 'entrada', st = m.st;
    var linhas = ent
      ? '<span class="prop-c">' + (p.tags.length ? p.tags.map(function (t) { return '<span class="chip neutro">#' + esc(t) + '</span>'; }).join('') : '<span class="data">Sem tags</span>') + '<span class="prop-cor" style="background:' + DM.corNota(p.cor) + '" title="Cor da nota"></span><span class="data">' + p.classe + '</span></span>'
      : '<span class="prop-c"><span class="chip neutro">' + ic('calendar') + (p.dia ? p.dia + '/10' : p.fora ? p.fora.dia + '/' + p.fora.mes : 'dia não informado') + '</span><span class="chip neutro mono">' + (p.kind === 'Feriado ou ponto facultativo' ? 'dia inteiro' : p.ini ? p.ini + ' a ' + p.fim : 'sem horário') + '</span>' + (p.fimSug ? '<span class="data">fim sugerido: 1 hora</span>' : '') + '</span>' +
        (p.tags.length ? '<span class="prop-c">' + p.tags.map(function (t) { return '<span class="chip neutro">#' + esc(t) + '</span>'; }).join('') + '</span>' : '');
    var falta = !ent && (!p.dia || (!p.ini && p.kind !== 'Feriado ou ponto facultativo' && p.kind !== 'Lembrete'));
    var acoes = st === 'pendente' ? '<button class="btn pri mini" data-act="ia-reg" data-i="' + i + '"' + (falta ? ' disabled' : '') + '>' + ic('check') + 'Registrar</button><button class="btn mini" data-act="ia-aj" data-i="' + i + '">' + ic('pencil') + 'Ajustar</button>' +
        '<button class="btn mini" data-act="ia-trocar" data-i="' + i + '">' + (ent ? 'É um evento' : 'É uma entrada') + '</button><button class="btn mini" data-act="ia-desc" data-i="' + i + '">Descartar</button>' + (falta ? '<span class="data">' + (p.dia ? 'Falta o horário.' : p.fora ? 'Fora de outubro: ajuste a data.' : 'Falta o dia.') + ' Use Ajustar.</span>' : '')
      : st === 'feito' ? '<span class="data ok">' + ic('check') + (ent ? 'Registrada em Entradas.' : 'Registrado na Agenda.') + '</span><button class="btn mini" data-act="ia-desf" data-i="' + i + '">' + ic('undo') + 'Desfazer</button><button class="btn mini" data-act="ia-ver" data-i="' + i + '">Ver</button>'
      : st === 'desfeito' ? '<span class="data">Desfeito. Nada ficou registrado.</span>' : '<span class="data">Descartado.</span>';
    return '<article class="prop' + (st === 'feito' ? ' feito' : '') + (st === 'desfeito' || st === 'descartado' ? ' apagado' : '') + '"><span class="prop-k">' + (ent ? 'Entrada' : 'Evento · ' + (p.kind === 'Feriado ou ponto facultativo' ? 'Feriado' : p.kind)) + '</span>' +
      '<b class="prop-t">' + esc(p.titulo || 'Sem título') + '</b>' + (p.desc ? '<p class="prop-d">' + esc(p.desc) + '</p>' : '') + linhas + '<div class="acoes">' + acoes + '</div></article>';
  }
  TELAS.ia = function () {
    var M = [['auto', 'Automático'], ['entrada', 'Entrada'], ['evento', 'Evento']];
    var intro = '<div class="bolha ia">Escreva do seu jeito o que quer guardar. Eu organizo como <b>entrada</b> ou <b>evento</b>: título, descrição, tags e cor. Você confere antes, e tudo pode ser desfeito.</div>';
    var ex = E.chat.length ? '' : '<div class="ia-ex" role="group" aria-label="Exemplos">' + EXEMPLOS.map(function (x) { return '<button class="chip neutro" data-act="ia-ex" data-t="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>';
    return '<div class="ia-modos"><span class="data">Registrar como</span><div class="tabs" role="group" aria-label="Registrar como">' + M.map(function (m) { return '<button data-act="ia-modo" data-v="' + m[0] + '" aria-pressed="' + (E.iaModo === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="chat">' + intro + ex + E.chat.map(function (m, i) { return m.de === 'eu' ? '<div class="bolha eu">' + esc(m.tx) + '</div>' : '<div class="bolha ia">' + esc(m.tx) + '</div>' + (m.prop ? propHTML(m, i) : ''); }).join('') + '</div>' +
      '<form class="chat-f" data-form="chat"><input name="m" placeholder="Ex.: reunião com a PGM sexta às 10h sobre o ofício 311" aria-label="Escreva o que quer registrar" autocomplete="off"><button class="btn pri" type="submit" aria-label="Enviar">' + ic('send') + 'Enviar</button></form>';
  };
  function responder(txt) {
    E.chat.push({ de: 'eu', tx: txt });
    if (/\?\s*$/.test(txt)) { E.chat.push({ de: 'ia', tx: 'No sistema de verdade eu consultaria os seus dados para responder. Aqui no protótipo eu mostro o registro de entradas e eventos: escreva algo que você quer guardar.' }); return; }
    var p = interpretar(txt, E.iaModo);
    E.chat.push({ de: 'ia', tx: p.tipo === 'entrada' ? 'Entendi como entrada (' + p.classe.toLowerCase() + '). Confira e registre:' : 'Entendi como evento (' + p.kind.toLowerCase().replace('feriado ou ponto facultativo', 'dia inteiro') + '). Confira e registre:', prop: p, st: 'pendente' });
  }
  function rolarChat() { var mn = $('#main'); if (mn) mn.scrollTop = mn.scrollHeight; var f = $('.chat-f input'); if (f) f.focus(); }
  document.addEventListener('submit', function (e) {
    if (e.target.dataset.form !== 'chat') return;
    e.preventDefault();
    var t = e.target.elements.m.value.trim(); if (!t) return;
    responder(t); DM.trocar({}); rolarChat();
  });
  function msg(b) { return E.chat[+b.dataset.i]; }
  function notaDe(p) { return { t: p.titulo, x: (p.desc || p.titulo) + (p.tags.length ? ' ' + p.tags.map(function (t) { return '#' + t; }).join(' ') : ''), cor: p.cor, fixo: false, ed: '21/10' }; }
  function evDe(p) { var x = [p.dia, p.kind === 'Feriado ou ponto facultativo' ? 'dia inteiro' : p.ini ? p.ini + ' a ' + p.fim : 'dia inteiro', p.titulo, { 'Reunião': 'reuniao', Compromisso: 'compromisso', Lembrete: 'lembrete', 'Feriado ou ponto facultativo': 'feriado' }[p.kind]]; if (x[3] === 'feriado') x.push('Feriado'); return x; }
  A['ia-ex'] = function (b) { var f = $('.chat-f input'); if (f) { f.value = b.dataset.t; f.focus(); } };
  A['ia-modo'] = function (b) { DM.trocar({ iaModo: b.dataset.v }); };
  A['ia-reg'] = function (b) {
    var m = msg(b), p = m.prop;
    if (p.tipo === 'entrada') { m.ref = notaDe(p); DM.NOTAS_E.unshift(m.ref); } else { m.ref = evDe(p); DM.EVENTOS.push(m.ref); }
    m.st = 'feito'; DM.trocar({}); DM.toast(p.tipo === 'entrada' ? 'Entrada registrada' : 'Evento registrado em ' + p.dia + '/10', 1);
  };
  A['ia-desf'] = function (b) {
    var m = msg(b), l = m.prop.tipo === 'entrada' ? DM.NOTAS_E : DM.EVENTOS, k = l.indexOf(m.ref);
    if (k > -1) l.splice(k, 1); m.st = 'desfeito'; DM.trocar({}); DM.toast('Desfeito', 1);
  };
  A['ia-desc'] = function (b) { msg(b).st = 'descartado'; DM.trocar({}); };
  A['ia-trocar'] = function (b) { var m = msg(b), txt = E.chat[+b.dataset.i - 1].tx; m.prop = interpretar(txt, m.prop.tipo === 'entrada' ? 'evento' : 'entrada'); m.tx = m.prop.tipo === 'entrada' ? 'Certo, como entrada (' + m.prop.classe.toLowerCase() + '):' : 'Certo, como evento (' + m.prop.kind.toLowerCase() + '):'; DM.trocar({}); };
  A['ia-ver'] = function (b) { var m = msg(b); DM.trocar(m.prop.tipo === 'entrada' ? { tela: 'entradas' } : { tela: 'agenda', ag: 'semana' }); };
  // Ajustar abre a janela normal já preenchida; ao salvar, a mensagem fica como registrada
  A['ia-aj'] = function (b) {
    var i = +b.dataset.i, p = msg(b).prop;
    if (p.tipo === 'entrada') { var n = notaDe(p); DM.abrirJanela({ t: 'nota', key: 'ia' + i, iaMsg: i, base: DM.norm({}), v: { t: n.t, x: n.x, cor: n.cor } }); }
    else DM.abrirJanela({ t: 'ev', key: 'ia' + i, iaMsg: i, base: DM.norm({}), v: { titulo: p.titulo, tipo: p.kind, dia: p.dia ? '2026-10-' + String(p.dia).padStart(2, '0') : p.fora ? '2026-' + String(p.fora.mes).padStart(2, '0') + '-' + String(p.fora.dia).padStart(2, '0') : '2026-10-22', ini: p.ini, fim: p.fim } });
  };
  ['salvar-nota', 'salvar-ev'].forEach(function (k) {
    var orig = A[k];
    A[k] = function (b, e) {
      var m = E.modal, i = m && m.iaMsg, antes = k === 'salvar-nota' ? DM.NOTAS_E[0] : DM.EVENTOS[DM.EVENTOS.length - 1];
      orig(b, e);
      if (i == null || E.modal) return;
      var depois = k === 'salvar-nota' ? DM.NOTAS_E[0] : DM.EVENTOS[DM.EVENTOS.length - 1];
      if (depois !== antes) { E.chat[i].st = 'feito'; E.chat[i].ref = depois; if (k === 'salvar-ev') { E.chat[i].prop.dia = depois[0]; } }
      DM.trocar({ tela: 'ia' });
    };
  });
};
