// Segunda camada do protótipo: temas definitivos, fontes em três papéis, energia, janelas de cadastro,
// demanda aberta, Perfil e Configurações completas. Recebe o objeto DM exposto pelo app.js.
window.DM_EXTRA = function (DM) {
  var E = DM.estado, ic = DM.ic, esc = DM.esc, $ = DM.$, $$ = DM.$$, DEM = DM.DEMANDAS, TELAS = DM.TELAS_FN;

  // ---------- fontes: título (principal), secundária (subtítulos e textos) e mono (detalhes) ----------
  function F(n, g) { return '"' + n + '", ' + g; }
  var FT = [['Sora', F('Sora', 'sans-serif')], ['Plus Jakarta Sans', F('Plus Jakarta Sans', 'sans-serif')], ['DM Serif Display', F('DM Serif Display', 'Georgia, serif')],
    ['Fraunces', F('Fraunces', 'Georgia, serif')], ['Manrope', F('Manrope', 'sans-serif')], ['Space Grotesk', F('Space Grotesk', 'sans-serif')],
    ['Playfair Display', F('Playfair Display', 'Georgia, serif')], ['Outfit', F('Outfit', 'sans-serif')], ['Inter', F('Inter', '-apple-system, "SF Pro Text", "Segoe UI", sans-serif')]];
  var FS = [['Inter', F('Inter', 'system-ui, sans-serif')], ['DM Sans', F('DM Sans', 'system-ui, sans-serif')], ['Plus Jakarta Sans', F('Plus Jakarta Sans', 'system-ui, sans-serif')],
    ['Manrope', F('Manrope', 'system-ui, sans-serif')], ['Source Sans 3', F('Source Sans 3', 'system-ui, sans-serif')], ['Nunito Sans', F('Nunito Sans', 'system-ui, sans-serif')]];
  var FM = [['IBM Plex Mono', F('IBM Plex Mono', 'ui-monospace, monospace')], ['JetBrains Mono', F('JetBrains Mono', 'ui-monospace, monospace')], ['DM Mono', F('DM Mono', 'ui-monospace, monospace')],
    ['Space Mono', F('Space Mono', 'ui-monospace, monospace')], ['Fira Code', F('Fira Code', 'ui-monospace, monospace')]];
  var CONJUNTOS = [['Manrope, Inter e IBM Plex Mono', 4, 0, 0], ['Sora, Inter e IBM Plex Mono', 0, 0, 0], ['Jakarta e JetBrains Mono', 1, 2, 1], ['DM Serif, DM Sans e DM Mono', 2, 1, 2], ['Fraunces, Inter e DM Mono', 3, 0, 2], ['Manrope, Inter e JetBrains Mono', 4, 0, 1]];

  // ---------- temas definitivos: cada um guarda suas próprias escolhas ----------
  var TEMAS = [['a', 'Aurora', 'Vidro estilo Apple, gradiente suave'], ['b', 'Papel', 'Calmo, tom de papel e títulos serifados'], ['c', 'Grafite', 'Denso, bordas finas e foco em leitura'], ['d', 'Catalyst', 'Estilo Apple Mac e iPad: cinza de sistema, azul, listas com linhas finas']];
  var KEYS = ['pal', 'fT', 'fS', 'fM', 'iconeEstilo', 'lib', 'fs', 'ico', 'cardh', 'anim'];
  var PADRAO = { a: { fT: 4, fS: 0, fM: 0, iconeEstilo: 'pastilha' }, b: { fT: 3, fS: 0, fM: 0, iconeEstilo: 'pastilha' }, c: { fT: 4, fS: 0, fM: 0, iconeEstilo: 'duotone' }, d: { fT: 8, fS: 0, fM: 0, iconeEstilo: 'fino' } };
  function base(dir) { return Object.assign({ pal: null, fT: 0, fS: 0, fM: 0, iconeEstilo: '', lib: 'iconoir', fs: 16, ico: 20, cardh: 340, anim: false }, PADRAO[dir]); }
  function snap() { var o = {}; KEYS.forEach(function (k) { o[k] = E[k]; }); return o; }
  E.salvo = {}; E.perfilV = 'semana'; E.cidade = 'Taquara/RS'; E.sugestaoPrazo = 30; E.bH = null; E.bE = null; E.alertaParado = 7; E.baloes = 3; E.reduzir = false; E.modal = null; E.rascunho = {}; E.energia = 2; E.col = true; E.balaoAb = false; E.balaoVisto = false;
  E.nome = 'Secretário'; E.cargo = 'Secretário de Administração'; E.orgao = 'Prefeitura de Taquara/RS'; E.expIni = '08:00'; E.expFim = '17:00'; E.lapso = 7; E.ultimo = 8; E.avisos = []; E.perfilNovo = false;
  DM.mudaTema = function (ant, nu) { E.salvo[ant] = snap(); Object.assign(E, E.salvo[nu] || base(nu)); };
  DM.iniciar = function () {
    var h = new URLSearchParams(location.hash.slice(1)), o = base(E.dir);
    KEYS.forEach(function (k) { if (!h.has(k)) E[k] = o[k]; });
    if (E.ultimo >= E.lapso && h.get('aviso') !== 'nao') E.avisos = ['lapso'];
    if (E.tela === 'perfil') { E.tela = 'inicio'; E.perfilAb = true; }
    if (h.get('balao') !== 'nao') setTimeout(function () { if (E.tela === 'inicio' && !E.balaoVisto && !E.modal) { E.balaoVisto = true; E.balaoAb = true; DM.trocar({}); } }, 2500);
    else E.balaoVisto = true;
  };
  DM.estiloApp = function () { return DM.estiloBase() + ';--font:' + FS[E.fS][1] + ';--font-h:' + FT[E.fT][1] + ';--font-n:' + FM[E.fM][1] + ';--font-ui:' + (E.dir === 'b' ? FS[E.fS][1] : FT[E.fT][1]); };
  DM.pos = function () {
    $$('#g-dir .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.dir === E.dir); });
    $$('#g-tema .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tema === E.tema); });
    var app = $('.app'); if (app) { app.dataset.col = 'true'; app.dataset.aberto = E.menuAb; app.dataset.reduzir = E.reduzir; }
    $$('.mini-card').forEach(function (c) { c.draggable = true; });
    if (E.modal) guardar(E.modal);
    if (E.perfilNovo) { E.perfilNovo = false; var x = $('.dr .icbtn-s'); if (x) x.focus(); }
    if (E.modal && E.modal.foco) { E.modal.foco = false; var el = $('.modal input:not([type=checkbox]), .modal textarea'); if (el) el.focus(); }
  };

  // ---------- emojis: PNG do usuário, com reserva ----------
  var EMO_TXT = ['🥴', '🫠', '🙂', '😄', '🥰'], ROT_H = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'], ROT_E = ['Muito baixa', 'Baixa', 'Média', 'Alta', 'Muito alta'];
  function img(tipo, i) { return '<img class="emo-img" src="emojis/' + tipo + '-' + (i + 1) + '.png" alt="" ' + (tipo === 'humor' ? 'data-e="' + EMO_TXT[i] + '"' : 'data-fbi="bat' + i + '"') + '>'; }
  function seletor(tipo, atual, act, rot) {
    return rot.map(function (r, i) { return '<button class="emo' + (tipo === 'energia' ? ' en' : '') + '" data-act="' + act + '" data-i="' + i + '" aria-pressed="' + (atual === i) + '" aria-label="' + r + '" title="' + r + '">' + img(tipo, i) + '</button>'; }).join('');
  }
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('emo-img') && t.dataset.fbi) { var s = document.createElement('span'); s.className = 'emo-fb'; s.innerHTML = ic(t.dataset.fbi); t.replaceWith(s); }
  }, true);

  // ---------- Entradas: post-its ----------
  // n = { t: título (opcional), x: texto, cor: 0 a 5, fixo, ed: última edição }. Abrir a nota não renova a data, só editar.
  var NOTAS_E = DM.NOTAS_E = [
    { t: '', x: 'Ligar para o RH sobre as escalas de fim de ano #rh', cor: 0, fixo: true, ed: '21/10' },
    { t: 'Painel por origem', x: 'Ideia: painel de demandas por origem no relatório mensal #ideia', cor: 1, fixo: false, ed: '20/10' },
    { t: '', x: 'Conferir se a PGM respondeu o ofício 311. Se não, cobrar por telefone #pgm #cobrar', cor: 2, fixo: false, ed: '19/10' },
    { t: 'Diárias', x: 'Pedir à Contabilidade o saldo de diárias de 2025 #tce', cor: 3, fixo: false, ed: '18/10' },
    { t: '', x: 'Reunião de segunda: pauta de compras e registro de preços #reuniao', cor: 4, fixo: false, ed: '17/10' },
    { t: 'Portaria', x: 'Lembrar de assinar a portaria do horário de verão #portaria', cor: 5, fixo: false, ed: '16/10' }
  ];
  var RE_TAG = /#[\p{L}\p{N}_]+/gu;
  function tagsDe(n) { var m = ((n.t || '') + ' ' + n.x).match(RE_TAG) || [], o = []; m.forEach(function (x) { x = x.slice(1).toLowerCase(); if (o.indexOf(x) < 0) o.push(x); }); return o; }
  function limpo(s) { return (s || '').replace(RE_TAG, '').replace(/\s+/g, ' ').trim(); }
  // na grade aparece só o título; sem título, as primeiras frases do texto
  function resumoNota(n) { return limpo(n.t) || limpo(n.x); }
  function corNota(c) { var h = DM.PALETAS[E.pal === null ? 0 : E.pal][1]; return E.tema === 'escuro' ? DM.hsl(h + c * 55, 38, 26) : DM.hsl(h + c * 55, 75, 87); }
  // sem escolha, sorteia entre as cores menos usadas para não repetir demais
  function corAuto() {
    var uso = [0, 0, 0, 0, 0, 0]; NOTAS_E.forEach(function (n) { uso[n.cor]++; });
    var min = Math.min.apply(null, uso), livres = []; uso.forEach(function (u, i) { if (u === min) livres.push(i); });
    return livres[Math.floor(Math.random() * livres.length)];
  }
  function entradas() {
    var cont = {}; NOTAS_E.forEach(function (n) { tagsDe(n).forEach(function (t) { cont[t] = (cont[t] || 0) + 1; }); });
    var lista = NOTAS_E.map(function (n, i) { return [n, i]; }).filter(function (x) { return !E.tagSel || tagsDe(x[0]).indexOf(E.tagSel) > -1; });
    lista.sort(function (a, b) { return (b[0].fixo ? 1 : 0) - (a[0].fixo ? 1 : 0) || a[1] - b[1]; });
    return '<div class="filtros"><button class="btn pri mini" data-act="msg" data-m="Nova nota">' + ic('plus') + 'Nova nota</button>' +
      '<div class="tagbar" role="group" aria-label="Filtrar por tag"><button class="chip neutro" data-act="filtro-tag" data-t="" aria-pressed="' + !E.tagSel + '">Todas ' + NOTAS_E.length + '</button>' +
      Object.keys(cont).sort().map(function (t) { return '<button class="chip neutro mono" data-act="filtro-tag" data-t="' + esc(t) + '" aria-pressed="' + (E.tagSel === t) + '">#' + esc(t) + ' ' + cont[t] + '</button>'; }).join('') + '</div></div>' +
      (lista.length ? '<div class="postits">' + lista.map(function (x, k) {
        var n = x[0], i = x[1];
        return '<div class="pw" style="--rot:' + (k % 3 === 0 ? -.6 : k % 3 === 1 ? .5 : -.2) + 'deg"><article class="postit' + (n.fixo ? ' fixado' : '') + '" style="background:' + corNota(n.cor) + '" data-act="editar-nota" data-i="' + i + '" tabindex="0" role="button" aria-label="Abrir a nota: ' + esc(resumoNota(n)) + '">' +
          '<div class="p-top"><button class="pin-b" data-act="pin" data-i="' + i + '" aria-pressed="' + !!n.fixo + '" aria-label="' + (n.fixo ? 'Desafixar a nota' : 'Fixar a nota') + '" title="' + (n.fixo ? 'Desafixar' : 'Fixar') + '">' + ic('pin') + '</button>' +
          '<button class="pin-b virar" data-act="virar-nota" data-n="' + i + '" aria-label="Virar demanda" title="Virar demanda">' + ic('arrow-right') + '</button></div>' +
          '<p class="p-txt fit' + (n.t && limpo(n.t) ? ' com-titulo' : '') + '">' + esc(resumoNota(n)) + '</p>' +
          '<div class="p-tags">' + tagsDe(n).map(function (t) { return '<span class="mono">#' + esc(t) + '</span>'; }).join(' ') + '</div></article></div>';
      }).join('') + '</div>' : '<div class="vazio">' + ic('sticky-note', 'grande') + '<h3>Nenhuma nota com essa tag</h3><p>Escolha outra tag ou veja todas.</p></div>');
  }
  TELAS.entradas = entradas;

  // ---------- Início ----------
  // Widgets compactos no topo (ampliam ao passar o mouse ou focar), agenda, três filtros e Foco do dia.
  function widget(cls, resumo, cheio) { return '<div class="w ' + cls + '" tabindex="0"><div class="w-r">' + resumo + '</div><div class="w-c painel">' + cheio + '</div></div>'; }
  var DSEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var KIND = { reuniao: ['Reunião', 'users'], compromisso: ['Compromisso', 'map-pin'], feriado: ['Feriado', 'party'] };
  // aviso de emergência: só aparece quando existe e some quando não há mais nenhum
  function avisos() {
    return E.avisos.map(function (id) {
      if (id !== 'lapso') return '';
      return '<section class="aviso" role="status" aria-label="Aviso">' + ic('alert') + '<div class="av-t"><b>Faz ' + E.ultimo + ' dias desde o seu último acesso.</b><p>Prazos e etapas podem ter mudado nesse tempo. Vale revisar todas as demandas agora.</p></div><div class="av-a"><button class="btn pri mini" data-act="aviso-rev">Revisar demandas</button><button class="btn mini" data-act="aviso-fechar" data-av="lapso">Mais tarde</button></div></section>';
    }).join('');
  }
  TELAS.inicio = function () {
    var faixa = '<div class="faixa">' +
      widget('w-data', ic('calendar', 'duo') + '<b class="mono">qua, 21 out</b>', '<div class="data">Hoje</div><b>quarta-feira, 21 de outubro de 2026</b>') +
      widget('w-clima', ic('cloud-sun', 'duo') + '<b class="mono">24°</b>', '<div class="data">' + esc(E.cidade) + '</div><b>24°, parcialmente nublado</b>') +
      widget('w-humor', img('humor', E.humor) + '<span class="w-t">Humor</span>', '<div class="data">Como você está agora?</div><div class="emos" role="group" aria-label="Humor">' + seletor('humor', E.humor, 'humor', ROT_H) + '</div>' +
        '<button class="pend" data-act="completar">' + ic('clock') + '<span>Há 2 dias sem registro. Completar (opcional)</span>' + ic('right') + '</button>') +
      widget('w-energia', img('energia', E.energia) + '<span class="w-t">Energia</span>', '<div class="data">E a energia?</div><div class="emos" role="group" aria-label="Energia">' + seletor('energia', E.energia, 'energia', ROT_E) + '</div>') +
      '</div>';

    var ev = DM.EVENTOS.filter(function (x) { return x[0] >= 21; }).sort(function (a, b) { return a[0] - b[0]; }).slice(0, 6);
    var agenda = '<section class="sec"><h3>Compromissos <button class="link-s" data-nav="agenda">Ver agenda</button></h3><div class="ag-mini-l">' +
      (ev.length ? ev.map(function (x) {
        var k = KIND[x[3]] || KIND.compromisso, hoje = x[0] === 21, q = hoje ? 'hoje' : DSEM[(x[0] - 18) % 7] + ' ' + x[0];
        return '<article class="ag-mini k-' + (KIND[x[3]] ? x[3] : 'compromisso') + (hoje ? ' hoje' : '') + '"><div class="am-top"><span class="am-ic">' + ic(k[1]) + '</span><span class="am-k">' + esc(x[4] || k[0]) + '</span>' + (hoje ? '<span class="am-hoje">Hoje</span>' : '') + '</div>' +
          '<b class="am-t">' + esc(x[2]) + '</b><span class="am-q mono">' + q + ' · ' + (x[3] === 'feriado' ? 'dia inteiro' : x[1]) + '</span></article>';
      }).join('') : '<div class="vazio-c">Nenhum compromisso próximo</div>') + '</div></section>';

    var G = [['atrasadas', 'Atrasadas', 'clock', true], ['hoje', 'Para hoje', 'target'], ['sete', 'Próximos 7 dias', 'calendar']];
    var filtros = '<section class="sec"><div class="stats tres" role="group" aria-label="Filtrar demandas por prazo">' + G.map(function (g) {
      var n = DM.porGrupo(g[0]).length;
      return '<button class="stat' + (g[3] && n ? ' alerta' : '') + '" data-act="filtro-ini" data-g="' + g[0] + '" aria-pressed="' + (E.filtroIni === g[0]) + '"><span class="n">' + n + '</span><span class="r">' + ic(g[2], 'duo') + g[1] + '</span></button>';
    }).join('') + '</div>';
    if (E.filtroIni) {
      var l = DM.porGrupo(E.filtroIni), nome = G.filter(function (g) { return g[0] === E.filtroIni; })[0][1];
      filtros += '<h3 class="sub-f">' + nome + ' <small>' + DM.plural(l.length, 'demanda') + '</small></h3>' + (l.length ? '<div class="cards">' + l.map(DM.cardHTML).join('') + '</div>' : '<div class="vazio-c">Nenhuma demanda neste filtro.</div>');
    }
    filtros += '</section>';

    var foco = DM.focoDoDia();
    return avisos() + faixa + agenda + filtros + '<section class="sec"><h3>Foco do dia <small>até 3 demandas: atrasadas, depois hoje, depois os próximos 7 dias</small></h3>' +
      (foco.length ? '<div class="cards">' + foco.map(DM.cardHTML).join('') + '</div>' : '<div class="vazio-c">Nada urgente por enquanto.</div>') + '</section>';
  };

  // ---------- Perfil ----------
  function dadosDia(i) { return { h: (i * 3 + 1) % 5, e: (i * 2 + 1) % 5, c: (i * 5) % 4, sem: i % 7 === 0 || i % 7 === 6 }; }
  var DIAS7 = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  function corpoPerfil() {
    var mes = E.perfilV === 'mes', n = mes ? 30 : 7, cols = '';
    for (var i = 0; i < n; i++) {
      var d = dadosDia(i + 3);
      cols += '<div class="gcol' + (mes ? ' fina' : '') + '" tabindex="0"><span class="tip">' + (mes ? 'dia ' + (i + 1) : DIAS7[i]) + ': ' + d.c + ' finalizadas' + (d.sem ? '' : ', humor ' + ROT_H[d.h].toLowerCase() + ', energia ' + ROT_E[d.e].toLowerCase()) + '</span><i style="height:' + (8 + d.c * 26) + 'px"></i>' + (mes ? '' : '<span>' + DIAS7[i] + '</span>') + '</div>';
    }
    var hist = '';
    for (var j = 0; j < 28; j++) { var x = dadosDia(j + 1); hist += '<div class="hc" title="' + (x.sem ? 'Sem registro' : ROT_H[x.h]) + '">' + (x.sem ? '<span>—</span>' : img('humor', x.h)) + '</div>'; }
    return '<div class="ind3">' +
      '<section class="painel ind"><h3>Humor</h3><div class="ind-v">' + img('humor', E.humor) + '<b>' + ROT_H[E.humor] + '</b></div><p class="data">Último registro de hoje. Só seu.</p></section>' +
      '<section class="painel ind"><h3>Energia</h3><div class="ind-v">' + img('energia', E.energia) + '<b>' + ROT_E[E.energia] + '</b></div><p class="data">Último registro de hoje. Só seu.</p></section>' +
      '<section class="painel ind"><h3>Produtividade</h3><div class="ind-v"><b class="grande-n">1</b><b>demanda finalizada hoje</b></div><p class="data">Calculada pelas demandas finalizadas no dia.</p></section></div>' +
      '<section class="painel"><div class="ph"><h3>Seu ritmo</h3><div class="tabs" role="group" aria-label="Período">' +
      '<button data-act="perfilv" data-v="semana" aria-pressed="' + !mes + '">Semana</button><button data-act="perfilv" data-v="mes" aria-pressed="' + mes + '">Mês</button></div></div>' +
      '<div class="grafico' + (mes ? ' mes' : '') + '">' + cols + '</div><p class="data">Passe o mouse ou foque numa coluna para ver o resumo do dia. Dia com zero é um dia normal.</p></section>' +
      '<section class="painel"><h3>Histórico dos últimos dias</h3><div class="hist">' + hist + '</div>' +
      '<div class="acoes"><button class="btn mini" data-act="completar">' + ic('clock') + 'Completar últimos dias</button></div></section>' +
      '<section class="painel"><p class="frase">Hoje: 1 demanda finalizada. Dia com zero também acontece e não desfaz o resto da semana.</p>' +
      '<p class="data">Humor e energia são privados e nunca vão para a IA sem a sua permissão. Este espaço não substitui acompanhamento profissional.</p></section>';
  }
  function campoPf(rot, k, tipo, extra) { return '<div class="fld"><label for="pf-' + k + '">' + rot + '</label><input id="pf-' + k + '" data-pref="' + k + '" type="' + (tipo || 'text') + '" value="' + esc(E[k]) + '" ' + (extra || '') + ' autocomplete="off"></div>'; }
  // Perfil abre numa gaveta à direita, com o resto da tela desfocado
  DM.perfilHTML = function () {
    if (!E.perfilAb) return '';
    return '<div class="dr-ov' + (E.perfilNovo ? ' entra' : '') + '" data-act="fechar-perfil"><aside class="dr" role="dialog" aria-modal="true" aria-labelledby="pf-t">' +
      '<header class="m-h"><h3 id="pf-t">Perfil</h3><button class="icbtn-s" data-act="fechar-perfil" aria-label="Fechar o Perfil">' + ic('x') + '</button></header>' +
      '<div class="pf-id"><span class="av" id="pf-av">' + esc((E.nome || 'S').charAt(0).toUpperCase()) + '</span><div><b id="pf-nome">' + esc(E.nome) + '</b><span class="data">' + esc(E.cargo) + '</span></div></div>' +
      '<section class="painel"><h3>Edição rápida</h3>' + campoPf('Nome', 'nome') + campoPf('Cargo', 'cargo') + campoPf('Órgão', 'orgao') +
      '<div class="dois">' + campoPf('Expediente: início', 'expIni', 'time') + campoPf('Expediente: fim', 'expFim', 'time') + '</div>' +
      campoPf('Cidade do clima', 'cidade') + campoPf('Avisar após quantos dias sem uso', 'lapso', 'number', 'min="2" max="60"') +
      '<label class="fld"><span>Balão de humor e energia a cada</span><select data-pref="baloes"><option value="2"' + (E.baloes == 2 ? ' selected' : '') + '>2 horas</option><option value="3"' + (E.baloes == 3 ? ' selected' : '') + '>3 horas</option><option value="4"' + (E.baloes == 4 ? ' selected' : '') + '>4 horas</option></select></label>' +
      '<p class="data">Salvo automaticamente. Só você vê isto.</p></section>' +
      corpoPerfil() + '<div class="acoes"><button class="btn mini" data-act="perfil-cfg">' + ic('settings') + 'Abrir configurações</button></div></aside></div>';
  };

  // ---------- Configurações completas ----------
  function sel(chave, lista, rotulo, fonteAmostra) {
    return '<label class="fld"><span>' + rotulo + '</span><select data-sel="' + chave + '">' + lista.map(function (f, i) { return '<option value="' + i + '"' + (E[chave] === i ? ' selected' : '') + '>' + f[0] + '</option>'; }).join('') + '</select>' +
      '<span class="amostra" style="font-family:' + fonteAmostra + '">Resposta ao Ofício 311/2026, ação e atenção</span></label>';
  }
  TELAS.config = function () {
    var P = DM.PALETAS;
    return '<div class="cfg">' +
      '<section class="painel"><h3>Tema</h3><div class="temas">' + TEMAS.map(function (t) {
        return '<button class="tema-c" data-act="tema-dir" data-v="' + t[0] + '" aria-pressed="' + (E.dir === t[0]) + '"><b>' + t[1] + '</b><span>' + t[2] + '</span></button>';
      }).join('') + '</div><p class="data">Cada tema guarda as suas próprias escolhas de cores, fontes, ícones e tamanhos.</p>' +
      '<div class="acoes"><button class="btn mini" data-act="tema">' + ic(E.tema === 'claro' ? 'moon' : 'sun') + 'Modo ' + (E.tema === 'claro' ? 'escuro' : 'claro') + '</button></div></section>' +
      '<section class="painel"><h3>Cores</h3><div class="pal">' + P.map(function (p, i) {
        return '<button class="sw" data-act="pal" data-i="' + i + '" aria-pressed="' + (E.pal === i || (E.pal === null && i === 0)) + '" aria-label="Paleta ' + p[0] + '" style="--sw1:' + DM.hsl(p[1], 72 * p[2], 48) + ';--sw2:' + DM.hsl(p[1] + 60, 70 * p[2], 80) + '"><i></i><span>' + p[0] + '</span></button>';
      }).join('') + '</div><div class="acoes"><button class="btn mini" data-act="surpreenda">' + ic('sparkles') + 'Surpreenda-me</button>' +
      '<button class="btn mini" data-act="anim" aria-pressed="' + E.anim + '">Fundo animado: ' + (E.anim ? 'ligado' : 'desligado') + '</button></div></section>' +
      '<section class="painel"><h3>Fontes</h3><p class="data">Principal nos títulos, secundária nos subtítulos e textos, mono nos detalhes (números de processo, datas, contadores).</p>' +
      '<div class="acoes">' + CONJUNTOS.map(function (c, i) { return '<button class="btn mini" data-act="conjunto" data-i="' + i + '" aria-pressed="' + (E.fT === c[1] && E.fS === c[2] && E.fM === c[3]) + '">' + c[0] + '</button>'; }).join('') + '</div>' +
      sel('fT', FT, 'Principal (títulos)', FT[E.fT][1]) + sel('fS', FS, 'Secundária (subtítulos e textos)', FS[E.fS][1]) + sel('fM', FM, 'Mono (detalhes)', FM[E.fM][1]) + '</section>' +
      '<section class="painel"><h3>Ícones</h3><div class="acoes">' + [['iconoir', 'Iconoir'], ['lucide', 'Lucide']].map(function (x) {
        return '<button class="btn mini" data-act="lib" data-v="' + x[0] + '" aria-pressed="' + (E.lib === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div><div class="acoes">' + [['pastilha', 'Em pastilha'], ['fino', 'Fino'], ['duotone', 'Duotone']].map(function (x) {
        return '<button class="btn mini" data-act="ico" data-v="' + x[0] + '" aria-pressed="' + (DM.iconeEstilo() === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div><div class="amostra-ic">' + ['house', 'inbox', 'square-kanban', 'calendar', 'file-text', 'sparkles', 'settings', 'clock', 'hourglass'].map(function (n) { return '<span class="ico">' + ic(n, 'duo') + '</span>'; }).join('') + '</div></section>' +
      '<section class="painel"><h3>Tamanhos</h3>' + [['fs', 'Texto', 13, 20], ['ico', 'Ícones', 16, 28], ['cardh', 'Altura dos cards', 300, 420]].map(function (r) {
        return '<label class="rng">' + r[1] + ' <b class="mono">' + E[r[0]] + '</b><input type="range" data-cfg="' + r[0] + '" min="' + r[2] + '" max="' + r[3] + '" value="' + E[r[0]] + '"></label>';
      }).join('') + '<div class="acoes"><button class="btn mini" data-act="restaurar">Restaurar padrão do tema</button></div><p class="data">Os limites impedem texto ilegível e botão abaixo de 44 px.</p></section>' +
      '<section class="painel"><h3>Preferências</h3><div class="acoes"><button class="btn mini" data-act="reduzir" aria-pressed="' + E.reduzir + '">Reduzir movimento: ' + (E.reduzir ? 'ligado' : 'desligado') + '</button></div>' +
      '<label class="fld"><span>Cidade do clima</span><input data-pref="cidade" value="' + esc(E.cidade) + '"></label>' +
      '<label class="fld"><span>Prazo sugerido, em dias (só sugere, nunca preenche sozinho)</span><input data-pref="sugestaoPrazo" type="number" min="1" max="120" value="' + E.sugestaoPrazo + '"></label>' +
      '<label class="fld"><span>Alerta de parado há quantos dias</span><input data-pref="alertaParado" type="number" min="1" max="60" value="' + E.alertaParado + '"></label>' +
      '<label class="fld"><span>Balão de humor e energia a cada</span><select data-pref="baloes"><option value="2"' + (E.baloes == 2 ? ' selected' : '') + '>2 horas</option><option value="3"' + (E.baloes == 3 ? ' selected' : '') + '>3 horas</option><option value="4"' + (E.baloes == 4 ? ' selected' : '') + '>4 horas</option></select></label></section>' +
      '<section class="painel"><h3>Dados e conteúdo</h3><div class="acoes">' +
      '<button class="btn mini" data-act="msg" data-m="Exportar todos os dados">' + ic('export') + 'Exportar dados</button><button class="btn mini" data-act="msg" data-m="Importar dados">' + ic('import') + 'Importar dados</button>' +
      '<button class="btn mini" data-act="msg" data-m="Banco de 500 frases">' + ic('message-circle') + 'Banco de frases (0 de 500)</button>' +
      '<button class="btn mini" data-act="msg" data-m="Feriados e pontos facultativos">' + ic('calendar') + 'Feriados</button>' +
      '<button class="btn mini" data-act="msg" data-m="Tipos de documento">' + ic('file-text') + 'Tipos de documento</button>' +
      '<button class="btn mini" data-act="msg" data-m="Conta Google e Drive">' + ic('globe') + 'Conta Google</button></div></section></div>';
  };

  // ---------- janelas (cadastro rápido, nota, evento, tarefa, demanda aberta, dias sem registro) ----------
  var TIPOS = ['Protocolo', 'Processo', 'Memorando', 'Ofício', 'Pedido de informação', 'Projeto de lei', 'Portaria', 'Outro documento'];
  var HOJE = Date.UTC(2026, 9, 21);
  function isoParaCurto(iso) { var p = iso.split('-'); return p[2] + '/' + p[1]; }
  function curtoParaIso(c) { var p = c.split('/'); return '2026-' + p[1] + '-' + p[0]; }
  function maisDias(n, base) { var p = (base || '2026-10-21').split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 864e5); return d.toISOString().slice(0, 10); }
  // rascunho: texto digitado nunca se perde. Clicar fora de uma janela com texto não fecha; Esc e X fecham e guardam; Cancelar descarta.
  function norm(o) { return JSON.stringify(o, function (k, v) { return v === '' ? undefined : v; }); }
  function dados(m) { return m.t === 'demanda' ? m.copia : m.v; }
  function sujo(m) { return m.base !== undefined && norm(dados(m)) !== m.base; }
  function guardar(m) { if (m && m.key && sujo(m)) E.rascunho[m.key] = m.t === 'demanda' ? { copia: m.copia, v: m.v } : m.v; }
  function abrir(m) { m.v = m.v || {}; m.foco = true; if (m.base === undefined && m.key) m.base = '{}'; DM.trocar({ modal: m, plus: false }); }
  function fechar() { guardar(E.modal); DM.trocar({modal:null}); }
  function fim(o) { if (E.modal && E.modal.key) delete E.rascunho[E.modal.key]; DM.trocar(o); }
  function campo(rot, nome, tipo, v, extra) { return '<div class="fld"><label for="m-' + nome + '">' + rot + '</label><input id="m-' + nome + '" data-v="' + nome + '" type="' + (tipo || 'text') + '" value="' + esc(v || '') + '" ' + (extra || '') + ' autocomplete="off"></div>'; }
  function cab(t) { var m = E.modal; return '<header class="m-h"><h3 id="m-tit">' + t + '</h3><button class="icbtn-s" data-act="fechar-modal" aria-label="Fechar">' + ic('x') + '</button></header>' + (m && m.rec && m.t !== 'demanda' ? '<p class="data rec">Rascunho recuperado. Cancelar descarta o texto.</p>' : ''); }
  function opcoes(k, lista, atual) { return '<div class="opcoes" role="group">' + lista.map(function (o) { return '<button type="button" data-act="m-set" data-k="' + k + '" data-val="' + o + '" aria-pressed="' + (atual === o) + '">' + o + '</button>'; }).join('') + '</div>'; }

  function mNovaDem(m) {
    var v = m.v, cheg = v.chegada || '2026-10-21', tipo = v.tipo || 'Processo', temArea = tipo === 'Processo' || tipo === 'Protocolo';
    var areas = tipo === 'Protocolo' ? ['Geral', 'Pessoal'] : ['Geral', 'Pessoal', 'Compras'];
    return cab('Nova demanda') + '<p class="data">Cadastro rápido. Só o assunto é obrigatório.</p>' +
      campo('Número do processo ou memorando', 'num', 'text', v.num, 'placeholder="Ex.: 2310/2026"') + campo('Assunto', 'assunto', 'text', v.assunto, 'placeholder="Do que se trata?"') +
      campo('Origem', 'origem', 'text', v.origem, 'placeholder="Quem pediu ou de onde veio"') +
      '<div class="fld"><label>Tipo de documento</label>' + opcoes('tipo', TIPOS, tipo) + '</div>' +
      (temArea ? '<div class="fld"><label>Área (define a cor do card)</label>' + opcoes('area', areas, areas.indexOf(v.area) > -1 ? v.area : 'Geral') + '<span class="data">' + (tipo === 'Protocolo' ? 'Protocolo geral é azul e de pessoal é verde. Amarelo (compras) só em processo aberto pelo setor de compras.' : 'Azul: geral. Verde: pessoal. Amarelo: compras.') + '</span></div>' : '') +
      '<div class="dois">' + campo('Chegou em', 'chegada', 'date', cheg) + '<div class="fld"><label>Tipo de prazo</label>' + opcoes('prazoTipo', ['Legal', 'Próprio'], v.prazoTipo || 'Próprio') + '</div></div>' +
      '<div class="fld"><label for="m-prazo">Prazo (opcional)</label><div class="add-t"><input id="m-prazo" data-v="prazo" type="date" value="' + esc(v.prazo || '') + '">' +
      '<button class="btn mini" type="button" data-act="sugerir-prazo">Sugerir ' + E.sugestaoPrazo + ' dias</button>' + (v.prazo ? '<button class="btn mini" type="button" data-act="limpar-prazo">Sem prazo</button>' : '') + '</div>' +
      '<span class="data">' + (v.prazo ? 'Terá contagem regressiva até a data escolhida.' : 'Sem prazo: nada é inventado. Fica só a contagem do tempo desde a chegada.') + '</span></div>' +
      '<footer class="m-f"><span class="data">Rascunho guardado automaticamente</span><span class="esp"></span><button class="btn" data-act="cancelar-modal">Cancelar</button><button class="btn pri" data-act="salvar-dem">Cadastrar</button></footer>';
  }
  function mNota(m) {
    var v = m.v, ed = m.i != null, cor = v.cor == null ? -1 : v.cor;
    var sw = '<button type="button" class="cor-b auto" data-act="m-cor" data-c="-1" aria-pressed="' + (cor === -1) + '" aria-label="Cor automática" title="Automática">' + ic('sparkles') + '</button>' +
      [0, 1, 2, 3, 4, 5].map(function (c) { return '<button type="button" class="cor-b" data-act="m-cor" data-c="' + c + '" aria-pressed="' + (cor === c) + '" aria-label="Cor ' + (c + 1) + '" style="background:' + corNota(c) + '"></button>'; }).join('');
    return cab(ed ? 'Nota' : 'Nova nota') + '<div class="fld"><label for="m-titulo">Título (opcional)</label><input id="m-titulo" data-v="t" value="' + esc(v.t || '') + '" placeholder="Sem título, aparecem as primeiras frases" autocomplete="off"></div>' +
      '<div class="fld"><label for="m-texto">Texto</label><textarea id="m-texto" data-v="x" rows="6" placeholder="Escreva rápido. Use # para tags, em qualquer lugar.">' + esc(v.x || '') + '</textarea></div>' +
      '<div class="fld"><span>Cor</span><div class="cores" role="group" aria-label="Cor da nota">' + sw + '</div><span class="data">Sem escolha, uma cor é aplicada sozinha.</span></div>' +
      '<div class="fld"><button type="button" class="btn mini" data-act="m-pin" aria-pressed="' + !!v.fixo + '">' + ic('pin') + (v.fixo ? 'Fixada' : 'Fixar a nota') + '</button></div>' +
      (ed ? '<p class="data">Editada em ' + esc(v.ed || '') + '. Só editar renova o prazo de 30 dias; abrir não.</p>' : '') +
      '<footer class="m-f">' + (ed ? '<button class="btn mini" data-act="virar-nota" data-n="' + m.i + '">' + ic('arrow-right') + 'Virar demanda</button><button class="btn mini" data-act="arquivar-nota" data-n="' + m.i + '">' + ic('archive') + 'Arquivar</button>' : '<span class="data">Rascunho guardado automaticamente</span>') +
      '<span class="esp"></span><button class="btn" data-act="cancelar-modal">Cancelar</button><button class="btn pri" data-act="salvar-nota">' + (ed ? 'Salvar alterações' : 'Guardar') + '</button></footer>';
  }
  function mEvento(m) {
    var v = m.v;
    return cab('Novo evento') + campo('Título', 'titulo', 'text', v.titulo, 'placeholder="Reunião, compromisso ou lembrete"') + '<div class="fld"><label>Tipo</label>' + opcoes('tipo', ['Reunião', 'Compromisso'], v.tipo || 'Compromisso') + '</div>' + campo('Dia', 'dia', 'date', v.dia || '2026-10-22') +
      '<div class="dois">' + campo('Início', 'ini', 'time', v.ini || '09:00') + campo('Fim', 'fim', 'time', v.fim || '10:00') + '</div>' +
      '<p class="data">Aviso 15 minutos antes (padrão). Sincroniza do Dmanda para o Google Calendar, sem duplicar.</p>' +
      '<footer class="m-f"><span class="esp"></span><button class="btn" data-act="cancelar-modal">Cancelar</button><button class="btn pri" data-act="salvar-ev">Criar evento</button></footer>';
  }
  function mTarefa(m) {
    return cab('Nova tarefa') + '<div class="fld"><label for="m-dem">Em qual demanda?</label><select id="m-dem" data-v="dem">' + DEM.filter(function (d) { return d.etapa !== 'Finalizado'; }).map(function (d) { return '<option value="' + d.id + '"' + (+m.v.dem === d.id ? ' selected' : '') + '>' + esc(d.num + ' · ' + d.assunto) + '</option>'; }).join('') + '</select></div>' +
      campo('Tarefa', 'texto', 'text', m.v.texto, 'placeholder="O que precisa ser feito?"') +
      '<footer class="m-f"><span class="esp"></span><button class="btn" data-act="cancelar-modal">Cancelar</button><button class="btn pri" data-act="salvar-tar">Adicionar</button></footer>';
  }
  function mDemanda(m) {
    var d = m.copia; if (!d) return '';
    var fin = d.etapa === 'Finalizado', temArea = d.tipo === 'Processo' || d.tipo === 'Protocolo';
    var areas = d.tipo === 'Protocolo' ? ['Geral', 'Pessoal'] : ['Geral', 'Pessoal', 'Compras'];
    var tar = d.tarefas.length ? '<ul class="tarefas">' + d.tarefas.map(function (t, i) { return '<li><label><input type="checkbox" data-act="tarefa-m" data-i="' + i + '"' + (t.f ? ' checked' : '') + '><span class="' + (t.f ? 'feita' : '') + '">' + esc(t.t) + '</span></label></li>'; }).join('') + '</ul>' : '<div class="proxima vazia"><span>Nenhuma tarefa cadastrada</span></div>';
    var desde = DM.diasDesde(d.chegou), cont = !d.prazo ? 'Sem prazo cadastrado' : (function () { var n = DM.diasAte(d.prazo); return n < 0 ? 'Atrasada há ' + DM.plural(-n, 'dia') : n === 0 ? 'Vence hoje' : 'Faltam ' + DM.plural(n, 'dia'); })();
    return cab(esc(d.tipo + ' ' + d.num)) + (m.rec ? '<p class="data rec">Rascunho recuperado. Cancelar descarta as alterações.</p>' : '') + '<div class="m-cols"><div>' +
      '<div class="fld"><label for="d-assunto">Assunto</label><input id="d-assunto" data-d="assunto" value="' + esc(d.assunto) + '"></div>' +
      '<div class="dois"><div class="fld"><label for="d-num">Número</label><input id="d-num" data-d="num" value="' + esc(d.num) + '"></div><div class="fld"><label for="d-origem">Origem</label><input id="d-origem" data-d="origem" value="' + esc(d.origem) + '"></div></div>' +
      '<div class="fld"><label>Tipo de documento</label>' + opcoes('tipoDem', TIPOS, d.tipo) + '</div>' +
      (temArea ? '<div class="fld"><label>Área (define a cor do card)</label>' + opcoes('areaDem', areas, areas.indexOf(d.area) > -1 ? d.area : 'Geral') + '</div>' : '') +
      '<div class="dois"><div class="fld"><label for="d-chegou">Chegou em</label><input id="d-chegou" data-d="chegou" type="date" value="' + curtoParaIso(d.chegou) + '"></div><div class="fld"><label>Tipo de prazo</label>' + opcoes('prazoTipoDem', ['Legal', 'Próprio'], d.prazoTipo) + '</div></div>' +
      '<div class="fld"><label for="d-prazo">Prazo (opcional)</label><div class="add-t"><input id="d-prazo" data-d="prazo" type="date" value="' + (d.prazo ? curtoParaIso(d.prazo) : '') + '">' +
      '<button class="btn mini" type="button" data-act="sugerir-prazo-d">Sugerir ' + E.sugestaoPrazo + ' dias</button>' + (d.prazo ? '<button class="btn mini" type="button" data-act="limpar-prazo-d">Sem prazo</button>' : '') + '</div><span class="data">' + cont + '</span></div>' +
      '<div class="fld"><label for="d-etapa">Etapa</label><select id="d-etapa" data-d="etapa">' + DM.ETAPAS.map(function (e) { return '<option' + (e === d.etapa ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></div>' +
      (d.etapa === 'Aguardando retorno' ? '<div class="dois"><div class="fld"><label for="d-setor">Setor</label><input id="d-setor" data-d="setor" value="' + esc(d.setor || '') + '"></div><div class="fld"><label for="d-ac">Acompanhar em</label><input id="d-ac" data-d="acompanhar" type="date" value="' + curtoParaIso(d.acompanhar || '24/10') + '"></div></div>' : '') +
      '</div><div><h4>Tarefas</h4>' + tar + '<div class="add-t"><input id="m-nt" data-v="nt" placeholder="Nova tarefa" aria-label="Nova tarefa" value="' + esc(m.v.nt || '') + '"><button class="btn mini" data-act="add-tarefa-m">' + ic('plus') + 'Adicionar</button></div>' +
      '<div class="meta"><div>Chegou em<b>' + d.chegou + '</b></div><div>' + (fin && d.concluido ? 'Resolvida em' : 'Desde a chegada') + '<b>' + (fin && d.concluido ? Math.max(0, desde - DM.diasDesde(d.concluido)) : desde) + ' d</b></div></div>' +
      '<p class="data">O percentual mede só as tarefas. Concluir todas não muda a etapa sozinho.</p></div></div>' +
      '<footer class="m-f">' + (m.conf ? '<span class="data">Excluir de vez? Não dá para desfazer.</span><button class="btn perigo" data-act="excluir-ok" data-id="' + d.id + '">' + ic('trash') + 'Confirmar exclusão</button>' : '<button class="btn mini" data-act="msg" data-m="Arquivar">' + ic('archive') + 'Arquivar</button><button class="btn mini" data-act="excluir" data-id="' + d.id + '">' + ic('trash') + 'Excluir</button>') +
      '<span class="esp"></span><button class="btn" data-act="cancelar-modal">Cancelar</button>' +
      (fin ? '<button class="btn" data-act="reabrir-m">Reabrir (volta para Fazendo)</button>' : '<button class="btn" data-act="concluir-m">' + ic('check') + 'Concluir demanda</button>') +
      '<button class="btn pri" data-act="salvar-edicao">Salvar alterações</button></footer>';
  }
  function mDias() {
    var dias = [['Terça, 20', 'ter'], ['Segunda, 19', 'seg']];
    return cab('Completar os últimos dias') + '<p class="data">Opcional. Só aparecem dias úteis sem registro (fins de semana e feriados ficam de fora).</p>' +
      dias.map(function (d) { return '<div class="dia-l"><b>' + d[0] + '</b><div class="emos">' + seletor('humor', -1, 'noop', ROT_H) + '</div><div class="emos">' + seletor('energia', -1, 'noop', ROT_E) + '</div></div>'; }).join('') +
      '<footer class="m-f"><span class="esp"></span><button class="btn" data-act="cancelar-modal">Agora não</button><button class="btn pri" data-act="fechar-modal">Salvar</button></footer>';
  }
  function balao() {
    var falta = E.bH === null && E.bE === null ? 'Escolha o humor e a energia para registrar.' : E.bH === null ? 'Falta escolher o humor.' : E.bE === null ? 'Falta escolher a energia.' : '';
    return '<div class="balao lg" role="status"><button class="icbtn-s" data-act="fechar-balao" aria-label="Fechar">' + ic('x') + '</button><b>Um registro rápido?</b><p class="data">Opcional. Só registra quando os dois estiverem escolhidos.</p>' +
      '<div class="emos mini">' + seletor('humor', E.bH, 'humor-b', ROT_H) + '</div><div class="emos mini">' + seletor('energia', E.bE, 'energia-b', ROT_E) + '</div><p class="data balao-f">' + falta + '</p></div>';
  }
  DM.modalHTML = function () {
    var out = '', m = E.modal;
    if (E.balaoAb && E.tela === 'inicio') out += balao();
    if (m) {
      var corpo = m.t === 'dem' ? mNovaDem(m) : m.t === 'nota' ? mNota(m) : m.t === 'ev' ? mEvento(m) : m.t === 'tar' ? mTarefa(m) : m.t === 'demanda' ? mDemanda(m) : mDias();
      out += '<div class="modal-ov" data-act="fechar-ov"><div class="modal lg' + (m.t === 'demanda' ? ' larga' : '') + '" role="dialog" aria-modal="true" aria-labelledby="m-tit">' + corpo + '</div></div>';
    }
    return out + DM.perfilHTML();
  };

  // ---------- ações ----------
  var A = DM.acoes;
  A['tema-dir'] = function (b) { DM.trocar({ dir: b.dataset.v }); };
  A.surpreenda = function () { var c = CONJUNTOS[Math.floor(Math.random() * CONJUNTOS.length)]; DM.trocar({ pal: Math.floor(Math.random() * DM.PALETAS.length), fT: c[1], fS: c[2], fM: c[3] }); };
  A.restaurar = function () { DM.trocar(base(E.dir)); };
  A.conjunto = function (b) { var c = CONJUNTOS[+b.dataset.i]; DM.trocar({ fT: c[1], fS: c[2], fM: c[3] }); };
  A.energia = function (b) { DM.trocar({ energia: +b.dataset.i }); };
  function registrar() {
    if (E.bH !== null && E.bE !== null) { DM.trocar({ humor: E.bH, energia: E.bE, balaoAb: false, bH: null, bE: null }); DM.toast('Humor e energia registrados'); }
    else DM.trocar({});
  }
  A['humor-b'] = function (b) { E.bH = +b.dataset.i; registrar(); };
  A['energia-b'] = function (b) { E.bE = +b.dataset.i; registrar(); };
  A['fechar-balao'] = function () { DM.trocar({ balaoAb: false, bH: null, bE: null }); };
  A['filtro-ini'] = function (b) { DM.trocar({ filtroIni: E.filtroIni === b.dataset.g ? null : b.dataset.g }); };
  A['filtro-tag'] = function (b) { DM.trocar({ tagSel: b.dataset.t || null }); };
  A.noop = function () {};
  A.reduzir = function () { DM.trocar({ reduzir: !E.reduzir }); };
  A.perfilv = function (b) { DM.trocar({ perfilV: b.dataset.v }); };
  A.completar = function () { abrir({ t: 'dias' }); };
  A['fechar-modal'] = fechar;
  A['cancelar-modal'] = function () { if (E.modal && E.modal.key) delete E.rascunho[E.modal.key]; DM.trocar({modal:null}); };
  A['fechar-ov'] = function (b, e) {
    if (e.target !== b) return;
    if (E.modal && sujo(E.modal)) { var el = $('.modal'); if (el) { el.classList.remove('sacudir'); void el.offsetWidth; el.classList.add('sacudir'); } DM.toast('Há texto não salvo. Use Salvar ou Cancelar para sair.', 1); return; }
    fechar();
  };
  A.colapsar = function () { DM.trocar({ menuAb: !E.menuAb }); };
  A.perfil = function () { DM.trocar({ perfilAb: true, perfilNovo: true, plus: false }); };
  A['fechar-perfil'] = function (b, e) { if (b.classList.contains('dr-ov') && e.target !== b) return; DM.trocar({ perfilAb: false }); };
  A['perfil-cfg'] = function () { DM.trocar({ perfilAb: false, tela: 'config' }); };
  A['aviso-fechar'] = function (b) { DM.trocar({ avisos: E.avisos.filter(function (x) { return x !== b.dataset.av; }) }); };
  A['aviso-rev'] = function () { DM.trocar({ avisos: [], tela: 'demandas' }); };
  function real(id) { return DEM.filter(function (x) { return x.id === id; })[0]; }
  // a edição trabalha numa cópia: só vale quando você confirma em "Salvar alterações"
  A.abrir = function (b) { var d = real(+b.dataset.id), orig = JSON.parse(JSON.stringify(d)), r = E.rascunho['d' + d.id]; abrir({ t: 'demanda', id: d.id, key: 'd' + d.id, base: norm(orig), copia: r ? r.copia : orig, v: r ? r.v : {}, rec: !!r }); };
  A['m-set'] = function (b) {
    var m = E.modal, k = b.dataset.k, val = b.dataset.val;
    if (k === 'tipoDem') { m.copia.tipo = val; if (val === 'Protocolo' && m.copia.area === 'Compras') m.copia.area = 'Geral'; }
    else if (k === 'prazoTipoDem') m.copia.prazoTipo = val;
    else if (k === 'areaDem') m.copia.area = val;
    else { m.v[k] = val; if (k === 'tipo' && val === 'Protocolo' && m.v.area === 'Compras') m.v.area = 'Geral'; }
    DM.trocar({});
  };
  A['sugerir-prazo'] = function () { E.modal.v.prazo = maisDias(E.sugestaoPrazo, E.modal.v.chegada); DM.trocar({}); };
  A['limpar-prazo'] = function () { E.modal.v.prazo = ''; DM.trocar({}); };
  A['sugerir-prazo-d'] = function () { var c = E.modal.copia; c.prazo = isoParaCurto(maisDias(E.sugestaoPrazo, curtoParaIso(c.chegou))); DM.trocar({}); };
  A['limpar-prazo-d'] = function () { E.modal.copia.prazo = null; DM.trocar({}); };
  A['tarefa-m'] = function (b) { E.modal.copia.tarefas[+b.dataset.i].f = b.checked; DM.trocar({}); };
  A['salvar-edicao'] = function () { var m = E.modal; Object.assign(real(m.id), m.copia); fim({ modal: null }); DM.toast('Alterações salvas'); };
  A.excluir = function () { E.modal.conf = true; DM.trocar({}); };
  A['excluir-ok'] = function (b) { var i = DEM.findIndex(function (x) { return x.id === +b.dataset.id; }); if (i > -1) DEM.splice(i, 1); fim({ modal: null }); DM.toast('Demanda excluída'); };
  A['concluir-m'] = function () { var m = E.modal, d = real(m.id); Object.assign(d, m.copia, { etapa: 'Finalizado', concluido: '21/10' }); d.tarefas.forEach(function (t) { t.f = true; }); fim({ modal: null }); DM.toast('Demanda concluída'); };
  A['reabrir-m'] = function () { var m = E.modal, d = real(m.id); Object.assign(d, m.copia, { etapa: 'Fazendo', concluido: null }); fim({ modal: null }); DM.toast('Reaberta em Fazendo. O histórico foi mantido.'); };
  A['add-tarefa-m'] = function () {
    var t = (E.modal.v.nt || '').trim() || 'Nova tarefa';
    E.modal.copia.tarefas.push({ t: t, f: false }); E.modal.v.nt = ''; DM.trocar({});
  };
  A['salvar-dem'] = function () {
    var v = E.modal.v; if (!(v.assunto || '').trim()) { DM.toast('Escreva o assunto'); return; }
    var id = DEM.reduce(function (a, d) { return Math.max(a, d.id); }, 0) + 1, tipo = v.tipo || 'Processo', temArea = tipo === 'Processo' || tipo === 'Protocolo';
    var area = temArea ? (v.area === 'Pessoal' || (v.area === 'Compras' && tipo !== 'Protocolo') ? v.area : 'Geral') : undefined;
    DEM.push({ id: id, tipo: tipo, area: area, num: v.num || 's/n', assunto: v.assunto.trim(), origem: v.origem || 'Não informada', etapa: E.modal.etapa || 'Cadastro', prazoTipo: v.prazoTipo || 'Próprio',
      prazo: v.prazo ? isoParaCurto(v.prazo) : null, atraso: 0, tarefas: [], chegou: v.chegada ? isoParaCurto(v.chegada) : '21/10', parado: 0 });
    if (E.modal.nota != null) NOTAS_E.splice(E.modal.nota, 1);
    delete E.rascunho.dem; fim({ modal: null }); DM.toast(v.prazo ? 'Demanda cadastrada' : 'Demanda cadastrada sem prazo');
  };
  A['salvar-nota'] = function () {
    var v = E.modal.v, x = (v.x || '').trim(); if (!x) { DM.toast('Escreva o texto da nota'); return; }
    if (E.modal.i != null) { var n = NOTAS_E[E.modal.i]; Object.assign(n, { t: (v.t || '').trim(), x: x, fixo: !!v.fixo, ed: '21/10' }); if (v.cor != null && v.cor > -1) n.cor = v.cor; fim({ modal: null }); DM.toast('Nota atualizada'); return; }
    NOTAS_E.unshift({ t: (v.t || '').trim(), x: x, cor: v.cor != null && v.cor > -1 ? v.cor : corAuto(), fixo: !!v.fixo, ed: '21/10' });
    delete E.rascunho.nota; fim({ modal: null, tela: 'entradas' }); DM.toast('Anotação guardada');
  };
  A['editar-nota'] = function (b) { var i = +b.dataset.i, n = NOTAS_E[i], o = { t: n.t, x: n.x, cor: n.cor, fixo: n.fixo, ed: n.ed }, r = E.rascunho['nota' + i]; abrir({ t: 'nota', i: i, key: 'nota' + i, base: norm(o), v: r || o, rec: !!r }); };
  A.pin = function (b) { var n = NOTAS_E[+b.dataset.i]; n.fixo = !n.fixo; DM.trocar({}); DM.toast(n.fixo ? 'Nota fixada' : 'Nota desafixada'); };
  A['m-pin'] = function () { E.modal.v.fixo = !E.modal.v.fixo; DM.trocar({}); };
  A['m-cor'] = function (b) { E.modal.v.cor = +b.dataset.c; DM.trocar({}); };
  A['arquivar-nota'] = function (b) { NOTAS_E.splice(+b.dataset.n, 1); fim({ modal: null }); DM.toast('Nota arquivada'); };
  A['virar-nota'] = function (b) { var n = NOTAS_E[+b.dataset.n]; var v = { assunto: n ? resumoNota(n) : '', origem: '' }; abrir({ t: 'dem', nota: +b.dataset.n, key: 'dem-nota' + b.dataset.n, base: norm(v), v: E.rascunho['dem-nota' + b.dataset.n] || v }); };
  A['salvar-ev'] = function () {
    var v = E.modal.v, t = (v.titulo || '').trim(); if (!t) { DM.toast('Escreva o título'); return; }
    var dia = +(v.dia || '2026-10-22').split('-')[2], mes = (v.dia || '2026-10-22').split('-')[1];
    if (mes === '10') DM.EVENTOS.push([dia, (v.ini || '09:00') + ' a ' + (v.fim || '10:00'), t, v.tipo === 'Reunião' ? 'reuniao' : 'compromisso']);
    fim({ modal: null, tela: 'agenda' }); DM.toast('Evento criado');
  };
  A['salvar-tar'] = function () {
    var v = E.modal.v, d = DEM.filter(function (x) { return x.id === +(v.dem || DEM[0].id); })[0], t = (v.texto || '').trim();
    if (!t) { DM.toast('Escreva a tarefa'); return; }
    d.tarefas.push({ t: t, f: false }); fim({ modal: null }); DM.toast('Tarefa adicionada');
  };
  A.msg = function (b) {
    var m = b.dataset.m || '', n = b.dataset.n;
    if (/^Nova demanda|^Novo: Demanda/.test(m)) { var et = m.match(/em (.+)$/); abrir({ t: 'dem', key: 'dem', v: E.rascunho.dem || {}, rec: !!E.rascunho.dem, etapa: et ? et[1] : null }); }
    else if (/^Novo: Anotação|^Nova nota/.test(m)) abrir({ t: 'nota', key: 'nota', v: E.rascunho.nota || {}, rec: !!E.rascunho.nota });
    else if (/^Novo: Evento/.test(m)) abrir({ t: 'ev', key: 'ev', v: E.rascunho.ev || {}, rec: !!E.rascunho.ev });
    else if (/^Novo: Tarefa/.test(m)) abrir({ t: 'tar', key: 'tar', v: E.rascunho.tar || {}, rec: !!E.rascunho.tar });
    else if (/^Novo: Chat/.test(m)) DM.trocar({ tela: 'ia', plus: false });
    else { DM.toast(m); if (E.plus) DM.trocar({ plus: false }); }
  };

  // ---------- campos das janelas e das preferências ----------
  document.addEventListener('input', function (e) {
    var t = e.target, m = E.modal;
    if (t.dataset.v && m) { m.v[t.dataset.v] = t.value; guardar(m); }
    else if (t.dataset.d && m && m.copia) {
      var d = m.copia, k = t.dataset.d;
      if (k === 'prazo') d.prazo = t.value ? isoParaCurto(t.value) : null;
      else if (k === 'acompanhar' || k === 'chegou') { if (t.value) d[k] = isoParaCurto(t.value); }
      else d[k] = t.value;
      guardar(m);
    } else if (t.dataset.pref && t.tagName === 'INPUT') {
      E[t.dataset.pref] = t.type === 'number' ? +t.value : t.value;
      if (t.dataset.pref === 'nome') { var ini = (t.value || 'S').charAt(0).toUpperCase(); $$('.perfil-b .tx').forEach(function (x) { x.textContent = t.value || 'Secretário'; }); $$('.perfil-b .avatar, #pf-av').forEach(function (x) { x.textContent = ini; }); var pn = $('#pf-nome'); if (pn) pn.textContent = t.value; }
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.sel) DM.trocar((function () { var o = {}; o[t.dataset.sel] = +t.value; return o; })());
    else if (t.dataset.pref && t.tagName === 'SELECT') E[t.dataset.pref] = +t.value;
    else if (t.dataset.d === 'etapa' && E.modal && E.modal.copia) { E.modal.copia.etapa = t.value; if (t.value === 'Finalizado') E.modal.copia.tarefas.forEach(function (x) { x.f = true; }); DM.trocar({}); }
    else if ((t.dataset.d === 'prazo' || t.dataset.d === 'chegou') && E.modal && E.modal.copia) DM.trocar({})
    else if (t.dataset.v === 'dem' && E.modal) E.modal.v.dem = t.value;
  });
  // mantém o Tab dentro da janela aberta
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || (!E.modal && !E.perfilAb)) return;
    var raiz = E.modal ? '.modal' : '.dr';
    var f = $$(raiz + ' button, ' + raiz + ' input, ' + raiz + ' select, ' + raiz + ' textarea').filter(function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!f.length) return;
    var p = f[0], u = f[f.length - 1];
    if (e.shiftKey && document.activeElement === p) { e.preventDefault(); u.focus(); }
    else if (!e.shiftKey && document.activeElement === u) { e.preventDefault(); p.focus(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (E.modal) { e.stopImmediatePropagation(); fechar(); }
    else if (E.perfilAb) { e.stopImmediatePropagation(); DM.trocar({ perfilAb: false }); }
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.act === 'editar-nota') A['editar-nota'](e.target); });
  // ---------- Quadro: arrastar o card para outra etapa; atalho N para nova anotação ----------
  var arrastando = null;
  document.addEventListener('dragstart', function (e) { var c = e.target.closest && e.target.closest('.mini-card'); if (!c) return; arrastando = +c.dataset.id; c.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(arrastando)); } catch { /* navegador sem suporte */ } });
  document.addEventListener('dragend', function (e) { var c = e.target.closest && e.target.closest('.mini-card'); if (c) c.classList.remove('arrastando'); $$('.coluna.alvo').forEach(function (x) { x.classList.remove('alvo'); }); arrastando = null; });
  document.addEventListener('dragover', function (e) { var col = e.target.closest && e.target.closest('.coluna'); if (col && arrastando !== null) { e.preventDefault(); $$('.coluna.alvo').forEach(function (x) { if (x !== col) x.classList.remove('alvo'); }); col.classList.add('alvo'); } });
  document.addEventListener('drop', function (e) {
    var col = e.target.closest && e.target.closest('.coluna'); if (!col || arrastando === null) return; e.preventDefault();
    var d = DEM.filter(function (x) { return x.id === arrastando; })[0], et = col.getAttribute('aria-label'); arrastando = null;
    if (d && et && d.etapa !== et) { d.etapa = et; if (et === 'Finalizado') { d.tarefas.forEach(function (x) { x.f = true; }); d.concluido = '21/10'; } if (et === 'Aguardando retorno' && !d.setor) { d.setor = 'Setor a informar'; d.diasAg = 0; d.acompanhar = '28/10'; } DM.trocar({ etapaSel: et }); DM.toast('Movida para ' + et); }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target, digitando = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if (!digitando && !E.modal && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); abrir({ t: 'nota', key: 'nota', v: E.rascunho.nota || {}, rec: !!E.rascunho.nota }); }
  });
};
