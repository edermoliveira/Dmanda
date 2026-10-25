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
  var KEYS = ['pal', 'fT', 'fS', 'fM', 'iconeEstilo', 'lib', 'fs', 'ico', 'cardh'];
  var PADRAO = { fT: 8, fS: 0, fM: 0, iconeEstilo: 'fino' };
  function base() { return Object.assign({ pal: null, fT: 0, fS: 0, fM: 0, iconeEstilo: '', lib: 'iconoir', fs: 16, ico: 20, cardh: 340 }, PADRAO); }
  function snap() { var o = {}; KEYS.forEach(function (k) { o[k] = E[k]; }); return o; }
  E.perfilV = 'semana'; E.cidade = 'Taquara/RS'; E.sugestaoPrazo = 30; E.bH = null; E.bE = null; E.alertaParado = 7; E.baloes = 3; E.reduzir = false; E.modal = null; E.rascunho = {}; E.energia = 2; E.col = true; E.balaoAb = false; E.balaoVisto = false;
  E.nome = 'Secretário'; E.cargo = 'Secretário de Administração'; E.orgao = 'Prefeitura de Taquara/RS'; E.expIni = '08:00'; E.expFim = '17:00'; E.lapso = 7; E.ultimo = 8; E.avisos = []; E.perfilNovo = false;
  // "Mostrar menu" é preferência da interface: vale ao navegar e ao recarregar (guardada só no navegador; sem armazenamento, começa recolhido)
  var MENU_CHAVE = 'dmanda:menu-aberto';
  function menuGuardado() { try { return localStorage.getItem(MENU_CHAVE) === 'true'; } catch (x) { return false; } }
  function guardarMenu(v) { try { localStorage.setItem(MENU_CHAVE, v ? 'true' : 'false'); } catch (x) { /* sem armazenamento: vale só nesta visita */ } }
  DM.iniciar = function () {
    var h = new URLSearchParams(location.hash.slice(1)), o = base();
    E.menuAb = h.has('menuAb') ? h.get('menuAb') === 'true' : menuGuardado();
    KEYS.forEach(function (k) { if (!h.has(k)) E[k] = o[k]; });
    if (E.ultimo >= E.lapso && h.get('aviso') !== 'nao') E.avisos = ['lapso'];
    if (E.tela === 'perfil') { E.tela = 'inicio'; E.perfilAb = true; }
    if (h.get('balao') !== 'nao') setTimeout(function () { if (E.tela === 'inicio' && !E.balaoVisto && !E.modal) { E.balaoVisto = true; E.balaoAb = true; DM.trocar({}); } }, 2500);
    else E.balaoVisto = true;
    DM.carregaFundo();
  };
  DM.estiloApp = function () { return DM.estiloBase() + ';--font:' + FS[E.fS][1] + ';--font-h:' + FT[E.fT][1] + ';--font-n:' + FM[E.fM][1] + ';--font-ui:' + FT[E.fT][1]; };
  DM.pos = function () {
    $$('#g-tema .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tema === E.tema); });
    DM.aplicarFundo();
    var hr = $('.hist-rol'); if (hr) hr.scrollLeft = hr.scrollWidth; // abre no dia mais recente
    var app = $('.app'); if (app) { app.dataset.col = 'true'; app.dataset.aberto = E.menuAb; app.dataset.reduzir = E.reduzir; }
    if (E.modal) guardar(E.modal);
    if (E.perfilNovo) { E.perfilNovo = false; var x = $('.dr .icbtn-s'); if (x) x.focus(); }
    if (E.modal && E.modal.foco) { E.modal.foco = false; var el = $('.modal input:not([type=checkbox]), .modal textarea'); if (el) el.focus(); }
  };

  // ---------- Fundo: padrão do tema, cor ou imagem (preferência só deste navegador; sem backend nem sincronização) ----------
  // Preferências pequenas (modo, cor de cada modo, desfoque) ficam no localStorage; o arquivo da imagem fica no IndexedDB, nunca em texto nem no Git.
  var FUNDO_CHAVE = 'dmanda:fundo', IDB_NOME = 'dmanda', IDB_LOJA = 'arquivos', IMG_MAX = 15 * 1024 * 1024, fundoURL = null;
  E.fundo = { modo: 'padrao', cor: { claro: null, escuro: null }, desfoque: 8, imagem: false }; E.fundoMsg = '';
  (function () {
    try {
      var j = JSON.parse(localStorage.getItem(FUNDO_CHAVE) || 'null'); if (!j || typeof j !== 'object') return; var hex = /^#[0-9a-f]{6}$/i;
      if (['padrao', 'cor', 'imagem'].indexOf(j.modo) > -1) E.fundo.modo = j.modo;
      if (j.cor && hex.test(j.cor.claro)) E.fundo.cor.claro = j.cor.claro; if (j.cor && hex.test(j.cor.escuro)) E.fundo.cor.escuro = j.cor.escuro;
      if (+j.desfoque >= 0 && +j.desfoque <= 24) E.fundo.desfoque = Math.round(+j.desfoque);
      E.fundo.imagem = j.imagem === true;
    } catch (x) { /* preferência ilegível: começa no padrão */ }
  })();
  function guardaFundo() { try { localStorage.setItem(FUNDO_CHAVE, JSON.stringify(E.fundo)); return true; } catch (x) { E.fundoMsg = 'Não foi possível guardar a preferência de fundo neste navegador. Ela vale só até recarregar a página.'; return false; } }
  function idb(fn) {
    return new Promise(function (ok, no) {
      var r; try { r = indexedDB.open(IDB_NOME, 1); } catch (x) { return no(x); }
      r.onupgradeneeded = function () { r.result.createObjectStore(IDB_LOJA); };
      r.onerror = function () { no(r.error || new Error('indexedDB')); };
      r.onsuccess = function () {
        var db = r.result;
        try { var t = db.transaction(IDB_LOJA, 'readwrite'), q = fn(t.objectStore(IDB_LOJA)); t.oncomplete = function () { db.close(); ok(q && q.result); }; t.onerror = t.onabort = function () { db.close(); no(t.error || new Error('transação')); }; }
        catch (x) { db.close(); no(x); }
      };
    });
  }
  function trocaURL(blob) { if (fundoURL) URL.revokeObjectURL(fundoURL); fundoURL = blob ? URL.createObjectURL(blob) : null; }
  function aplicarFundo() {
    var app = $('.app'); if (!app) return; var f = E.fundo, cor = f.cor[E.tema];
    app.dataset.fundo = f.modo === 'imagem' && fundoURL ? 'imagem' : f.modo === 'cor' && cor ? 'cor' : 'padrao';
    app.style.setProperty('--fundo-desfoque', f.desfoque + 'px');
    if (cor) app.style.setProperty('--fundo-cor', cor); else app.style.removeProperty('--fundo-cor');
    if (fundoURL) app.style.setProperty('--fundo-img', 'url("' + fundoURL + '")'); else app.style.removeProperty('--fundo-img');
    var bg = $('.bg', app); if (bg && !bg.firstChild) bg.innerHTML = '<i class="bg-img"></i>';
    var ci = $('[data-fundo-cor]'); if (ci && !cor) ci.value = hexAtual(); // sem cor escolhida, o seletor começa na cor do fundo padrão do modo
  }
  DM.aplicarFundo = aplicarFundo;
  function mensagemFundo(t) { E.fundoMsg = t; var p = $('#fundo-msg'); if (p) p.textContent = t; }
  DM.carregaFundo = function () { // ao abrir: traz a imagem guardada, se houver
    if (!E.fundo.imagem) return;
    idb(function (s) { return s.get('fundo'); }).then(function (blob) {
      if (blob) { trocaURL(blob); aplicarFundo(); if (E.tela === 'config') DM.trocar({}); }
      else { E.fundo.imagem = false; guardaFundo(); mensagemFundo('A imagem de fundo guardada não foi encontrada. O fundo voltou ao padrão do tema.'); aplicarFundo(); }
    }).catch(function () { mensagemFundo('Não foi possível ler a imagem de fundo guardada neste navegador. O fundo está no padrão do tema.'); aplicarFundo(); });
  };
  function hexAtual() { var h = (getComputedStyle($('.app')).getPropertyValue('--bgbase') || '').trim(); return /^#[0-9a-f]{6}$/i.test(h) ? h : '#F2F2F7'; }
  DM.cfgFundo = function () {
    var f = E.fundo, tem = !!fundoURL, cor = f.cor[E.tema] || '';
    return '<section class="painel" id="cfg-fundo"><h3>Fundo</h3>' +
      '<div class="seg-p" role="group" aria-label="Tipo de fundo">' + [['padrao', 'Padrão do tema'], ['cor', 'Cor'], ['imagem', 'Imagem']].map(function (x) { return '<button data-act="fundo-modo" data-v="' + x[0] + '" aria-pressed="' + (f.modo === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (f.modo === 'padrao' ? '<p class="data">Fundo neutro do Catalyst, conforme o modo claro ou escuro.</p>' : '') +
      (f.modo === 'cor' ? '<label class="fld fundo-cor"><span>Cor do fundo no modo ' + E.tema + ' (cada modo guarda a sua)</span><input type="color" data-fundo-cor value="' + cor + '" aria-label="Cor do fundo no modo ' + E.tema + '"></label>' +
        '<p class="data">Só o fundo muda. Cards, classificações, controles e textos continuam como estão.</p>' : '') +
      (f.modo === 'imagem' ? '<div class="acoes"><button class="btn mini" data-act="fundo-escolher">' + (tem ? 'Substituir imagem' : 'Escolher imagem') + '</button>' + (tem ? '<button class="btn mini" data-act="fundo-remover">Remover imagem</button>' : '') + '</div>' +
        '<input type="file" accept="image/*" data-fundo-arquivo hidden aria-label="Arquivo de imagem do fundo">' +
        (tem ? '<label class="rng">Desfoque <b class="mono" id="fundo-desf-v">' + f.desfoque + ' px</b><input type="range" data-fundo-desf min="0" max="24" step="1" value="' + f.desfoque + '" aria-label="Desfoque da imagem de fundo"></label>' +
          '<div class="fundo-previa" aria-hidden="true"><i style="background-image:url(\'' + fundoURL + '\');filter:blur(' + Math.round(f.desfoque / 2) + 'px)"></i></div>' : '<p class="data">Escolha uma imagem do seu computador. Ela fica só neste navegador e não é enviada a lugar nenhum.</p>') : '') +
      '<p class="data" id="fundo-msg" role="status" aria-live="polite">' + esc(E.fundoMsg) + '</p></section>';
  };
  DM.acoes['fundo-modo'] = function (b) { E.fundo.modo = b.dataset.v; E.fundoMsg = ''; guardaFundo(); DM.trocar({}); };
  DM.acoes['fundo-escolher'] = function () { var i = $('[data-fundo-arquivo]'); if (i) i.click(); };
  DM.acoes['fundo-remover'] = function () {
    idb(function (s) { return s.delete('fundo'); }).then(function () { trocaURL(null); E.fundo.imagem = false; E.fundo.modo = 'padrao'; E.fundoMsg = 'Imagem removida. O fundo voltou ao padrão do tema.'; guardaFundo(); DM.trocar({}); })
      .catch(function () { mensagemFundo('Não foi possível remover a imagem guardada. Tente de novo.'); });
  };
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.hasAttribute || !t.hasAttribute('data-fundo-arquivo')) return;
    var arq = t.files && t.files[0]; t.value = ''; if (!arq) return;
    if (!/^image\//.test(arq.type)) return mensagemFundo('Escolha um arquivo de imagem (JPG, PNG, WebP ou GIF).');
    if (arq.size > IMG_MAX) return mensagemFundo('A imagem tem ' + (arq.size / 1048576).toFixed(1).replace('.', ',') + ' MB. O limite é 15 MB.');
    var teste = new Image(), url = URL.createObjectURL(arq);
    teste.onload = function () {
      URL.revokeObjectURL(url);
      idb(function (s) { return s.put(arq, 'fundo'); }).then(function () { trocaURL(arq); E.fundo.imagem = true; E.fundo.modo = 'imagem'; E.fundoMsg = 'Imagem aplicada.'; guardaFundo(); DM.trocar({}); })
        .catch(function () { mensagemFundo('Não foi possível guardar a imagem neste navegador (o armazenamento pode estar bloqueado ou cheio). O fundo não foi alterado.'); });
    };
    teste.onerror = function () { URL.revokeObjectURL(url); mensagemFundo('Não foi possível abrir esse arquivo como imagem. Tente outro.'); };
    teste.src = url;
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t.hasAttribute) return;
    if (t.hasAttribute('data-fundo-cor') && /^#[0-9a-f]{6}$/i.test(t.value)) { E.fundo.cor[E.tema] = t.value; guardaFundo(); aplicarFundo(); }
    else if (t.hasAttribute('data-fundo-desf')) {
      E.fundo.desfoque = Math.max(0, Math.min(24, Math.round(+t.value))); guardaFundo(); aplicarFundo();
      var v = $('#fundo-desf-v'); if (v) v.textContent = E.fundo.desfoque + ' px';
      var pv = $('.fundo-previa i'); if (pv) pv.style.filter = 'blur(' + Math.round(E.fundo.desfoque / 2) + 'px)';
    }
  });

  // ---------- emojis: humor em PNG e energia em SVG colorido, do usuário (sem reserva: se faltar, o erro aparece) ----------
  var EMO_TXT = ['🥴', '🫠', '🙂', '😄', '🥰'], ROT_H = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'], ROT_E = ['Muito baixa', 'Baixa', 'Média', 'Alta', 'Muito alta'];
  // energia: SVG usado direto em <img> (cores e transparência originais, sem currentColor); humor: PNG
  function img(tipo, i, alt) { return '<img class="emo-img" src="emojis/' + tipo + '-' + (i + 1) + (tipo === 'energia' ? '.svg' : '.png') + '" alt="' + (alt || '') + '"' + (tipo === 'humor' ? ' data-e="' + EMO_TXT[i] + '"' : '') + '>'; }
  function seletor(tipo, atual, act, rot) {
    return rot.map(function (r, i) { return '<button class="emo' + (tipo === 'energia' ? ' en' : '') + '" data-act="' + act + '" data-i="' + i + '" aria-pressed="' + (atual === i) + '" aria-label="' + r + '" title="' + r + '">' + img(tipo, i) + '</button>'; }).join('');
  }

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
  var KIND = { reuniao: ['Reunião', 'users'], compromisso: ['Compromisso', 'map-pin'], lembrete: ['Lembrete', 'bell'], feriado: ['Feriado', 'party'] };
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
      widget('w-energia', img('energia', E.energia, 'Energia: ' + ROT_E[E.energia]) + '<span class="w-t">Energia</span>', '<div class="data">E a energia?</div><div class="emos" role="group" aria-label="Energia">' + seletor('energia', E.energia, 'energia', ROT_E) + '</div>') +
      '</div>';

    var ev = DM.EVENTOS.filter(function (x) { return x[0] >= 21; }).sort(function (a, b) { return a[0] - b[0] || (a[1] < b[1] ? -1 : 1); }).slice(0, 6);
    var agenda = '<section class="sec"><h3>Compromissos <button class="link-s" data-nav="agenda">Ver agenda</button></h3><div class="ag-mini-l">' +
      (ev.length ? ev.map(function (x) {
        var k = KIND[x[3]] || KIND.compromisso, hoje = x[0] === 21, amanha = x[0] === 22, q = hoje ? 'hoje' : amanha ? 'amanhã' : DSEM[(x[0] - 18) % 7] + ' ' + x[0];
        return '<button class="ag-mini k-' + (KIND[x[3]] ? x[3] : 'compromisso') + (hoje ? ' hoje' : '') + (amanha ? ' amanha' : '') + '" data-act="ed-ev" data-k="' + DM.EVENTOS.indexOf(x) + '" aria-label="' + esc(x[2]) + ', ' + q + '. Abrir e editar"><span class="am-top"><span class="am-ic">' + ic(k[1]) + '</span><span class="am-k">' + esc(x[4] || k[0]) + '</span>' +
          (hoje ? '<span class="am-hoje">Hoje</span>' : amanha ? '<span class="am-hoje am-amanha">Amanhã</span>' : '') + '</span>' +
          '<b class="am-t">' + esc(x[2]) + '</b><span class="am-q mono">' + q + ' · ' + (x[3] === 'feriado' ? 'dia inteiro' : x[1]) + '</span></button>';
      }).join('') : '<div class="vazio-c">Nenhum compromisso próximo</div>') + '</div></section>';

    var G = [['atrasadas', 'Atrasadas', 'clock', true], ['hoje', 'Para hoje', 'target'], ['sete', 'Próximos 7 dias', 'calendar']];
    var filtros = '<section class="sec"><div class="stats tres" role="group" aria-label="Filtrar demandas por prazo">' + G.map(function (g) {
      var n = DM.porGrupo(g[0]).length;
      return '<button class="stat st-' + g[0] + (g[3] && n ? ' alerta' : '') + '" data-act="filtro-ini" data-g="' + g[0] + '" aria-pressed="' + (E.filtroIni === g[0]) + '"><span class="st-ic">' + ic(g[2]) + '</span><span class="n">' + n + '</span><span class="r">' + g[1] + '</span></button>';
    }).join('') + '</div>';
    if (E.filtroIni) {
      var l = DM.porGrupo(E.filtroIni), nome = G.filter(function (g) { return g[0] === E.filtroIni; })[0][1];
      filtros += '<h3 class="sub-f">' + nome + ' <small>' + DM.plural(l.length, 'demanda') + '</small></h3>' + (l.length ? '<div class="cards">' + l.map(DM.cardHTML).join('') + '</div>' : '<div class="vazio-c">Nenhuma demanda neste filtro.</div>');
    }
    filtros += '</section>';

    var foco = DM.focoDoDia();
    return avisos() + faixa + (DM.widgetsHTML ? DM.widgetsHTML() : '') + agenda + filtros + '<section class="sec"><h3>Foco do dia <small>até 3 demandas: atrasadas, depois hoje, depois os próximos 7 dias</small></h3>' +
      (foco.length ? '<div class="cards">' + foco.map(DM.cardHTML).join('') + '</div>' : '<div class="vazio-c">Nada urgente por enquanto.</div>') + '</section>';
  };

  // ---------- Perfil ----------
  function dadosDia(i) { return { h: (i * 3 + 1) % 5, e: (i * 2 + 1) % 5, c: (i * 5) % 4, sem: i % 7 === 0 || i % 7 === 6 }; }
  var DIAS7 = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  // Histórico dos últimos 28 dias: uma coluna por dia (data no cabeçalho) e uma linha para Humor e outra para Energia, com rolagem só dentro do histórico.
  // Os valores continuam os de dadosDia (dados do protótipo); a data de cada coluna conta de hoje (21/10/2026) para trás. Dia sem registro aparece discreto.
  var SEM_ABR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], SEM_COMPLETO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  var MES_COMPLETO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function diaHist(j) { var d = new Date(2026, 9, 21 - (27 - j)), x = dadosDia(j + 1); return { d: d, x: x, curto: ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2), abr: SEM_ABR[d.getDay()], completo: SEM_COMPLETO[d.getDay()] + ', ' + d.getDate() + ' de ' + MES_COMPLETO[d.getMonth()] }; }
  function textoDiaHist(h) { return h.completo + (h.x.sem ? ': sem registro' : ': humor ' + ROT_H[h.x.h].toLowerCase() + ', energia ' + ROT_E[h.x.e].toLowerCase()); }
  function historicoHTML() {
    var th = '', lh = '', le = '';
    for (var j = 0; j < 28; j++) {
      var h = diaHist(j), hoje = j === 27;
      th += '<th scope="col"' + (hoje ? ' class="hoje"' : '') + '><button type="button" class="hd" tabindex="' + (hoje ? 0 : -1) + '" data-act="hist-dia" data-i="' + j + '" aria-pressed="' + hoje + '" aria-label="' + textoDiaHist(h) + '" title="' + textoDiaHist(h) + '"><b>' + (hoje ? 'hoje' : h.abr) + '</b><span>' + h.curto + '</span></button></th>';
      lh += '<td class="hc2' + (h.x.sem ? ' vazio' : '') + '">' + (h.x.sem ? '<span title="Sem registro" aria-label="Sem registro">—</span>' : img('humor', h.x.h, 'Humor: ' + ROT_H[h.x.h])) + '</td>';
      le += '<td class="hc2' + (h.x.sem ? ' vazio' : '') + '">' + (h.x.sem ? '<span title="Sem registro" aria-label="Sem registro">—</span>' : img('energia', h.x.e, 'Energia: ' + ROT_E[h.x.e])) + '</td>';
    }
    // os nomes das linhas ficam numa coluna fixa ao lado (visual) e como cabeçalhos de linha ocultos na tabela (leitores de tela)
    return '<div class="hist-w"><div class="hist-lab" aria-hidden="true"><i></i><b>Humor</b><b>Energia</b></div><div class="hist-rol" role="region" aria-label="Histórico dos últimos 28 dias; role para os lados para ver os dias anteriores"><table class="hist-t"><thead><tr><td class="sr">Registro</td>' + th + '</tr></thead>' +
      '<tbody><tr><th scope="row" class="sr">Humor</th>' + lh + '</tr><tr><th scope="row" class="sr">Energia</th>' + le + '</tr></tbody></table></div></div>' +
      '<p class="data" id="hist-det" role="status" aria-live="polite">' + textoDiaHist(diaHist(27)) + '</p>';
  }
  DM.acoes['hist-dia'] = function (b) {
    $$('.hd').forEach(function (x) { var on = x === b; x.setAttribute('aria-pressed', on); x.tabIndex = on ? 0 : -1; });
    var det = $('#hist-det'); if (det) det.textContent = textoDiaHist(diaHist(+b.dataset.i));
  };
  document.addEventListener('keydown', function (e) {
    var b = e.target.closest && e.target.closest('.hd'); if (!b) return;
    var k = { ArrowRight: 1, ArrowLeft: -1 }[e.key], hs = $$('.hd'), i = hs.indexOf(b);
    if (e.key === 'Home') k = -i; else if (e.key === 'End') k = hs.length - 1 - i;
    if (k === undefined || k === 0) return; e.preventDefault();
    var n = hs[Math.max(0, Math.min(hs.length - 1, i + k))]; n.focus(); DM.acoes['hist-dia'](n);
  });
  function corpoPerfil() {
    var mes = E.perfilV === 'mes', n = mes ? 30 : 7, cols = '';
    for (var i = 0; i < n; i++) {
      var d = dadosDia(i + 3);
      cols += '<div class="gcol' + (mes ? ' fina' : '') + '" tabindex="0"><span class="tip">' + (mes ? 'dia ' + (i + 1) : DIAS7[i]) + ': ' + d.c + ' finalizadas' + (d.sem ? '' : ', humor ' + ROT_H[d.h].toLowerCase() + ', energia ' + ROT_E[d.e].toLowerCase()) + '</span><i style="height:' + (8 + d.c * 26) + 'px"></i>' + (mes ? '' : '<span>' + DIAS7[i] + '</span>') + '</div>';
    }
    return '<div class="ind3">' +
      '<section class="painel ind"><h3>Humor</h3><div class="ind-v">' + img('humor', E.humor) + '<b>' + ROT_H[E.humor] + '</b></div><p class="data">Último registro de hoje. Só seu.</p></section>' +
      '<section class="painel ind"><h3>Energia</h3><div class="ind-v">' + img('energia', E.energia) + '<b>' + ROT_E[E.energia] + '</b></div><p class="data">Último registro de hoje. Só seu.</p></section>' +
      '<section class="painel ind"><h3>Produtividade</h3><div class="ind-v"><b class="grande-n">1</b><b>demanda finalizada hoje</b></div><p class="data">Calculada pelas demandas finalizadas no dia.</p></section></div>' +
      '<section class="painel"><div class="ph"><h3>Seu ritmo</h3><div class="tabs" role="group" aria-label="Período">' +
      '<button data-act="perfilv" data-v="semana" aria-pressed="' + !mes + '">Semana</button><button data-act="perfilv" data-v="mes" aria-pressed="' + mes + '">Mês</button></div></div>' +
      '<div class="grafico' + (mes ? ' mes' : '') + '">' + cols + '</div><p class="data">Passe o mouse ou foque numa coluna para ver o resumo do dia. Dia com zero é um dia normal.</p></section>' +
      '<section class="painel"><h3>Histórico dos últimos dias</h3><p class="data">Dados de exemplo do protótipo: as datas são demonstrativas.</p>' + historicoHTML() +
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
      // Aparência e Cores num só painel largo (modo, cor de destaque da interface); o fundo vem logo depois e os demais painéis se acomodam em colunas
      '<section class="painel cfg-topo"><div class="cfg-cab"><h3>Aparência</h3><div class="acoes"><button class="btn mini" data-act="tema">' + ic(E.tema === 'claro' ? 'moon' : 'sun') + 'Modo ' + (E.tema === 'claro' ? 'escuro' : 'claro') + '</button>' +
      '<button class="btn mini" data-act="surpreenda">' + ic('sparkles') + 'Surpreenda-me</button></div></div>' +
      '<h4 class="cfg-sub">Cor de destaque da interface</h4><div class="pal">' + P.map(function (p, i) {
        return '<button class="sw" data-act="pal" data-i="' + i + '" aria-pressed="' + (E.pal === i || (E.pal === null && i === 0)) + '" aria-label="Paleta ' + p[0] + '" style="--sw1:' + DM.hsl(p[1], 72 * p[2], 48) + ';--sw2:' + DM.hsl(p[1] + 60, 70 * p[2], 80) + '"><i></i><span>' + p[0] + '</span></button>';
      }).join('') + '</div></section>' + DM.cfgFundo() +
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
      (DM.cfgWidgets ? DM.cfgWidgets() : '') +
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
  DM.abrirJanela = abrir; DM.norm = norm; DM.corNota = corNota; DM.corAuto = corAuto; DM.tagsDe = tagsDe;
  function fim(o) { if (E.modal && E.modal.key) delete E.rascunho[E.modal.key]; DM.trocar(o); }
  function campo(rot, nome, tipo, v, extra) { return '<div class="fld"><label for="m-' + nome + '">' + rot + '</label><input id="m-' + nome + '" data-v="' + nome + '" type="' + (tipo || 'text') + '" value="' + esc(v || '') + '" ' + (extra || '') + ' autocomplete="off"></div>'; }
  function cab(t, extra) { var m = E.modal; return '<header class="m-h"><h3 id="m-tit">' + t + '</h3><button class="icbtn-s" data-act="fechar-modal" aria-label="Fechar">' + ic('x') + '</button>' + (extra || '') + '</header>' + (m && m.rec && m.t !== 'demanda' ? '<p class="data rec">Rascunho recuperado. Cancelar descarta o texto.</p>' : ''); }
  function opcoes(k, lista, atual) { return '<div class="opcoes" role="group">' + lista.map(function (o) { return '<button type="button" data-act="m-set" data-k="' + k + '" data-val="' + o + '" aria-pressed="' + (atual === o) + '">' + o + '</button>'; }).join('') + '</div>'; }

  // grupo de campos com título (Identificação, Descrição, Datas e prazo...), usado nos formulários de demanda
  function grp(titulo, corpo, dica) { return '<section class="m-grp"><h4>' + titulo + (dica ? ' <small class="data">' + dica + '</small>' : '') + '</h4>' + corpo + '</section>'; }
  function mNovaDem(m) {
    var v = m.v, cheg = v.chegada || '2026-10-21', tipo = v.tipo || 'Processo', temArea = tipo === 'Processo' || tipo === 'Protocolo';
    var areas = tipo === 'Protocolo' ? ['Geral', 'Pessoal'] : ['Geral', 'Pessoal', 'Compras'];
    return cab('Nova demanda') + '<p class="data">Cadastro rápido. Só o assunto é obrigatório.</p>' +
      grp('Identificação', campo('Assunto', 'assunto', 'text', v.assunto, 'placeholder="Do que se trata?"') + '<div class="dois">' + campo('Número do processo ou memorando', 'num', 'text', v.num, 'placeholder="Ex.: 2310/2026"') + campo('Origem', 'origem', 'text', v.origem, 'placeholder="Quem pediu ou de onde veio"') + '</div>' +
        '<div class="fld"><label>Tipo de documento</label>' + opcoes('tipo', TIPOS, tipo) + '</div>' +
        (temArea ? '<div class="fld"><label>Área (define a cor do card)</label>' + opcoes('area', areas, areas.indexOf(v.area) > -1 ? v.area : 'Geral') + '<span class="data">' + (tipo === 'Protocolo' ? 'Protocolo geral é azul e de pessoal é verde. Amarelo (compras) só em processo aberto pelo setor de compras.' : 'Azul: geral. Verde: pessoal. Amarelo: compras.') + '</span></div>' : '')) +
      grp('Descrição', '<div class="fld"><label class="sr" for="m-descricao">Descrição (opcional)</label><textarea id="m-descricao" data-v="descricao" rows="4" placeholder="Explique do que se trata, sem sobrecarregar o assunto">' + esc(v.descricao || '') + '</textarea></div>', 'opcional') +
      grp('Datas e prazo', '<div class="dois">' + campo('Chegou em', 'chegada', 'date', cheg) + '<div class="fld"><label>Tipo de prazo</label>' + opcoes('prazoTipo', ['Legal', 'Próprio'], v.prazoTipo || 'Próprio') + '</div></div>' +
        '<div class="fld"><label for="m-prazo">Prazo (opcional)</label><div class="add-t"><input id="m-prazo" data-v="prazo" type="date" value="' + esc(v.prazo || '') + '">' +
        '<button class="btn mini" type="button" data-act="sugerir-prazo">Sugerir ' + E.sugestaoPrazo + ' dias</button>' + (v.prazo ? '<button class="btn mini" type="button" data-act="limpar-prazo">Sem prazo</button>' : '') + '</div>' +
        '<span class="data">' + (v.prazo ? 'Terá contagem regressiva até a data escolhida.' : 'Sem prazo: nada é inventado. Fica só a contagem do tempo desde a chegada.') + '</span></div>') +
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
  var TIPOS_EV = ['Reunião', 'Compromisso', 'Lembrete', 'Feriado ou ponto facultativo'];
  var KIND_EV = { 'Reunião': 'reuniao', Compromisso: 'compromisso', Lembrete: 'lembrete', 'Feriado ou ponto facultativo': 'feriado' };
  var DSEM_L = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  function diaPorExtenso(iso) { var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return DSEM_L[d.getUTCDay()] + ', ' + (+p[2]) + ' de ' + ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][+p[1] - 1]; }
  // o evento guardado vira os campos da janela (e volta ao salvar)
  DM.evParaCampos = function (x) {
    var tipo = Object.keys(KIND_EV).filter(function (k) { return KIND_EV[k] === x[3]; })[0] || 'Compromisso', h = x[1].split(' a ');
    return { titulo: x[2], tipo: tipo, dia: '2026-10-' + String(x[0]).padStart(2, '0'), ini: x[3] === 'feriado' ? '' : h[0], fim: x[3] === 'feriado' ? '' : (h[1] || '') };
  };
  function mEvento(m) {
    var v = m.v, ed = m.k != null, tipo = v.tipo || 'Compromisso', dia = v.dia || '2026-10-22', inteiro = tipo === 'Feriado ou ponto facultativo';
    return cab(ed ? 'Editar evento' : 'Novo evento') + (m.diaFixo && !ed ? '<p class="data dia-esc">' + ic('calendar') + 'Dia escolhido na agenda: <b>' + diaPorExtenso(dia) + '</b></p>' : '') +
      campo('Título', 'titulo', 'text', v.titulo, 'placeholder="Do que se trata?"') + '<div class="fld"><label>Tipo</label>' + opcoes('tipo', TIPOS_EV, tipo) + '</div>' + campo('Dia', 'dia', 'date', dia) +
      (inteiro ? '<p class="data">Dia inteiro: aparece ocupando o dia e conta para o preenchimento de humor.</p>' : '<div class="dois">' + campo('Início', 'ini', 'time', v.ini || '09:00') + campo('Fim', 'fim', 'time', v.fim || '10:00') + '</div>') +
      '<p class="data">' + (inteiro ? 'Aviso próprio de dia inteiro (nada à meia-noite).' : 'Aviso 15 minutos antes (padrão).') + ' Sincroniza do Dmanda para o Google Calendar, sem duplicar.</p>' +
      '<footer class="m-f">' + (ed ? (m.conf ? '<span class="data">Excluir este evento?</span><button class="btn perigo" data-act="excluir-ev-ok">' + ic('trash') + 'Confirmar exclusão</button>' : '<button class="btn mini" data-act="excluir-ev">' + ic('trash') + 'Excluir</button>') : '') +
      '<span class="esp"></span><button class="btn" data-act="cancelar-modal">Cancelar</button><button class="btn pri" data-act="salvar-ev">' + (ed ? 'Salvar alterações' : 'Criar evento') + '</button></footer>';
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
    var tar = d.tarefas.length ? '<ul class="tarefas ed">' + d.tarefas.map(function (t, i) {
      return '<li class="t-item"><input type="checkbox" data-act="tarefa-m" data-i="' + i + '"' + (t.f ? ' checked' : '') + ' aria-label="Concluir a tarefa ' + (i + 1) + '"><input class="t-campo' + (t.f ? ' feita' : '') + '" data-tm="' + i + '" value="' + esc(t.t) + '" aria-label="Texto da tarefa ' + (i + 1) + '" autocomplete="off">' +
        '<button class="t-lapis" data-act="del-tarefa-m" data-i="' + i + '" aria-label="Remover a tarefa ' + (i + 1) + '" title="Remover">' + ic('trash') + '</button></li>';
    }).join('') + '</ul>' : '<div class="proxima vazia"><span>Nenhuma tarefa cadastrada</span></div>';
    var desde = DM.diasDesde(d.chegou), cont = !d.prazo ? 'Sem prazo cadastrado' : (function () { var n = DM.diasAte(d.prazo); return n < 0 ? 'Atrasada há ' + DM.plural(-n, 'dia') : n === 0 ? 'Vence hoje' : 'Faltam ' + DM.plural(n, 'dia'); })();
    // no celular Arquivar e Excluir saem do rodapé fixo e ficam neste menu do cabeçalho (os botões do rodapé continuam, só ocultos nessa largura)
    var maisAcoes = m.conf ? '' : '<button type="button" class="icbtn-s m-mais" data-act="m-acoes" aria-haspopup="menu" aria-label="Mais ações da demanda: arquivar ou excluir" title="Mais ações">' + ic('ellipsis') + '</button>';
    return cab(esc(d.tipo + ' ' + d.num), maisAcoes) + (m.rec ? '<p class="data rec">Rascunho recuperado. Cancelar descarta as alterações.</p>' : '') + '<div class="m-cols"><div>' +
      grp('Identificação', '<div class="fld"><label for="d-assunto">Assunto</label><input id="d-assunto" data-d="assunto" value="' + esc(d.assunto) + '"></div>' +
        '<div class="dois"><div class="fld"><label for="d-num">Número</label><input id="d-num" data-d="num" value="' + esc(d.num) + '"></div><div class="fld"><label for="d-origem">Origem</label><input id="d-origem" data-d="origem" value="' + esc(d.origem) + '"></div></div>' +
        '<div class="fld"><label>Tipo de documento</label>' + opcoes('tipoDem', TIPOS, d.tipo) + '</div>' +
        (temArea ? '<div class="fld"><label>Área (define a cor do card)</label>' + opcoes('areaDem', areas, areas.indexOf(d.area) > -1 ? d.area : 'Geral') + '</div>' : '')) +
      grp('Descrição', '<div class="fld"><label class="sr" for="d-descricao">Descrição (opcional)</label><textarea id="d-descricao" data-d="descricao" rows="5" placeholder="Explique do que se trata, sem sobrecarregar o assunto">' + esc(d.descricao || '') + '</textarea></div>', 'opcional') +
      grp('Andamento', '<div class="fld"><label for="d-etapa">Etapa</label><select id="d-etapa" data-d="etapa">' + DM.ETAPAS.map(function (e) { return '<option' + (e === d.etapa ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></div>' +
        (d.etapa === 'Aguardando retorno' ? '<div class="dois"><div class="fld"><label for="d-setor">Setor</label><input id="d-setor" data-d="setor" value="' + esc(d.setor || '') + '"></div><div class="fld"><label for="d-ac">Acompanhar em</label><input id="d-ac" data-d="acompanhar" type="date" value="' + curtoParaIso(d.acompanhar || '24/10') + '"></div></div>' : '')) +
      '</div><div>' +
      grp('Datas e prazo', '<div class="dois"><div class="fld"><label for="d-chegou">Chegou em</label><input id="d-chegou" data-d="chegou" type="date" value="' + curtoParaIso(d.chegou) + '"></div><div class="fld"><label>Tipo de prazo</label>' + opcoes('prazoTipoDem', ['Legal', 'Próprio'], d.prazoTipo) + '</div></div>' +
        '<div class="fld"><label for="d-prazo">Prazo (opcional)</label><div class="add-t"><input id="d-prazo" data-d="prazo" type="date" value="' + (d.prazo ? curtoParaIso(d.prazo) : '') + '">' +
        '<button class="btn mini" type="button" data-act="sugerir-prazo-d">Sugerir ' + E.sugestaoPrazo + ' dias</button>' + (d.prazo ? '<button class="btn mini" type="button" data-act="limpar-prazo-d">Sem prazo</button>' : '') + '</div></div>' +
        '<div class="meta calc" role="group" aria-label="Calculado automaticamente"><div>Prazo<b>' + cont + '</b></div><div>' + (fin && d.concluido ? 'Resolvida em' : 'Desde a chegada') + '<b>' + (fin && d.concluido ? Math.max(0, desde - DM.diasDesde(d.concluido)) : desde) + ' d</b></div></div>') +
      grp('Tarefas', tar + '<div class="add-t"><input id="m-nt" data-v="nt" placeholder="Nova tarefa" aria-label="Nova tarefa" value="' + esc(m.v.nt || '') + '"><button class="btn mini" data-act="add-tarefa-m">' + ic('plus') + 'Adicionar</button></div>' +
        '<p class="data m-prog">' + (d.tarefas.length ? d.tarefas.filter(function (t) { return t.f; }).length + ' de ' + d.tarefas.length + ' concluídas (' + Math.round(100 * d.tarefas.filter(function (t) { return t.f; }).length / d.tarefas.length) + '%). ' : 'Nenhuma tarefa ainda. ') + 'O percentual mede só as tarefas. Concluir todas não muda a etapa sozinho.</p>', 'toque no texto para alterar') +
      '</div></div>' +
      '<footer class="m-f">' + (m.conf ? '<span class="data">Excluir de vez? Não dá para desfazer.</span><button class="btn perigo" data-act="excluir-ok" data-id="' + d.id + '">' + ic('trash') + 'Confirmar exclusão</button>' : '<button class="btn mini m-sec" data-act="msg" data-m="Arquivar">' + ic('archive') + 'Arquivar</button><button class="btn mini m-sec" data-act="excluir" data-id="' + d.id + '">' + ic('trash') + 'Excluir</button>') +
      '<span class="esp"></span><button class="btn" data-act="cancelar-modal">Cancelar</button>' +
      (fin ? '<button class="btn" data-act="reabrir-m">Reabrir (volta para Fazendo)</button>' : '<button class="btn" data-act="concluir-m">' + ic('check') + 'Concluir demanda</button>') +
      '<button class="btn pri" data-act="salvar-edicao" aria-label="Salvar alterações">Salvar<span class="rot-ext"> alterações</span></button></footer>';
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
  A.surpreenda = function () { var c = CONJUNTOS[Math.floor(Math.random() * CONJUNTOS.length)]; DM.trocar({ pal: Math.floor(Math.random() * DM.PALETAS.length), fT: c[1], fS: c[2], fM: c[3] }); };
  A.restaurar = function () { DM.trocar(base()); };
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
  A.colapsar = function () { guardarMenu(!E.menuAb); DM.trocar({ menuAb: !E.menuAb }); };
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
  A['salvar-edicao'] = function () { var m = E.modal; m.copia.tarefas = m.copia.tarefas.filter(function (t) { return (t.t || '').trim(); }); m.copia.descricao = (m.copia.descricao || '').trim(); Object.assign(real(m.id), m.copia); fim({ modal: null }); DM.toast('Alterações salvas', 1); };
  A.excluir = function () { E.modal.conf = true; DM.trocar({}); };
  A['excluir-ok'] = function (b) { var i = DEM.findIndex(function (x) { return x.id === +b.dataset.id; }); if (i > -1) DEM.splice(i, 1); fim({ modal: null }); DM.toast('Demanda excluída'); };
  A['concluir-m'] = function () { var m = E.modal, d = real(m.id); Object.assign(d, m.copia, { etapa: 'Finalizado', concluido: '21/10' }); d.tarefas.forEach(function (t) { t.f = true; }); fim({ modal: null }); DM.toast('Demanda concluída'); };
  A['reabrir-m'] = function () { var m = E.modal, d = real(m.id); Object.assign(d, m.copia, { etapa: 'Fazendo', concluido: null }); fim({ modal: null }); DM.toast('Reaberta em Fazendo. O histórico foi mantido.'); };
  A['add-tarefa-m'] = function () {
    var t = (E.modal.v.nt || '').trim() || 'Nova tarefa';
    var c = E.modal.copia; c.tarefas.push({ t: t, f: false }); E.modal.v.nt = '';
    if (c.etapa === 'Cadastro') { c.etapa = 'Vistos'; DM.toast('Com tarefa cadastrada, a demanda vai para Vistos ao salvar', 1); }
    DM.trocar({});
  };
  A['del-tarefa-m'] = function (b) { E.modal.copia.tarefas.splice(+b.dataset.i, 1); DM.trocar({}); };
  A['salvar-dem'] = function () {
    var v = E.modal.v; if (!(v.assunto || '').trim()) { DM.toast('Escreva o assunto'); return; }
    var id = DEM.reduce(function (a, d) { return Math.max(a, d.id); }, 0) + 1, tipo = v.tipo || 'Processo', temArea = tipo === 'Processo' || tipo === 'Protocolo';
    var area = temArea ? (v.area === 'Pessoal' || (v.area === 'Compras' && tipo !== 'Protocolo') ? v.area : 'Geral') : undefined;
    DEM.push({ id: id, tipo: tipo, area: area, num: v.num || 's/n', assunto: v.assunto.trim(), descricao: (v.descricao || '').trim(), origem: v.origem || 'Não informada', etapa: E.modal.etapa || 'Cadastro', prazoTipo: v.prazoTipo || 'Próprio',
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
    var m = E.modal, v = m.v, t = (v.titulo || '').trim(); if (!t) { DM.toast('Escreva o título', 1); return; }
    var iso = v.dia || '2026-10-22', dia = +iso.split('-')[2], mes = iso.split('-')[1], kind = KIND_EV[v.tipo || 'Compromisso'];
    var x = [dia, kind === 'feriado' ? 'dia inteiro' : (v.ini || '09:00') + ' a ' + (v.fim || '10:00'), t, kind];
    if (kind === 'feriado') x.push(/ponto/i.test(t) ? 'Ponto facultativo' : 'Feriado');
    if (m.k != null) { if (mes === '10') DM.EVENTOS[m.k] = x; else DM.EVENTOS.splice(m.k, 1); fim({ modal: null }); DM.toast('Evento alterado', 1); return; }
    if (mes === '10') DM.EVENTOS.push(x);
    fim(m.diaFixo || E.tela === 'inicio' || E.tela === 'ia' ? { modal: null } : { modal: null, tela: 'agenda' }); DM.toast(mes === '10' ? 'Evento criado em ' + dia + '/10' : 'Evento criado (fora de outubro, não aparece no protótipo)', 1);
  };
  // "+" do dia: o cadastro já vem com a data daquele dia
  A['ev-dia'] = function (b) { var iso = '2026-10-' + String(+b.dataset.dia).padStart(2, '0'), r = E.rascunho['ev-' + iso]; abrir({ t: 'ev', key: 'ev-' + iso, diaFixo: true, base: norm({ dia: iso }), v: r || { dia: iso }, rec: !!r }); };
  A['ed-ev'] = function (b) { var k = +b.dataset.k, x = DM.EVENTOS[k]; if (!x) return; var o = DM.evParaCampos(x), r = E.rascunho['evk' + k]; abrir({ t: 'ev', k: k, key: 'evk' + k, base: norm(o), v: r || o, rec: !!r }); };
  A['excluir-ev'] = function () { E.modal.conf = true; DM.trocar({}); };
  A['excluir-ev-ok'] = function () { DM.EVENTOS.splice(E.modal.k, 1); fim({ modal: null }); DM.toast('Evento excluído', 1); };
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
    else if (t.dataset.tm && m && m.copia) { m.copia.tarefas[+t.dataset.tm].t = t.value; guardar(m); }
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
    else if (t.dataset.v === 'dia' && E.modal && E.modal.t === 'ev') DM.trocar({});
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
    if (e.key !== 'Escape' || $('.mv-menu')) return; // com um menu aberto, o Esc fecha só o menu
    if (E.modal) { e.stopImmediatePropagation(); fechar(); }
    else if (E.perfilAb) { e.stopImmediatePropagation(); DM.trocar({ perfilAb: false }); }
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.act === 'editar-nota') A['editar-nota'](e.target); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'm-nt') { e.preventDefault(); A['add-tarefa-m'](); var n = $('#m-nt'); if (n) n.focus(); } });
  // ---------- Quadro: mover a demanda entre etapas ----------
  // Uma só regra de transição para o arraste (mouse, toque e caneta) e para o menu "Mover para" (alternativa pelo teclado):
  // concluir e reabrir seguem as mesmas regras dos botões "Concluir demanda" e "Reabrir demanda" (app.js).
  DM.moverEtapa = function (id, et) {
    var d = real(id); if (!d || !et || d.etapa === et) return false;
    var de = d.etapa, msg;
    if (de === 'Finalizado' && et !== 'Fazendo') { DM.toast('Para reabrir, mova a demanda para Fazendo.', 1); return false; }
    if (et === 'Finalizado') { d.etapa = et; d.concluido = '21/10'; d.tarefas.forEach(function (x) { x.f = true; }); msg = 'Demanda finalizada. As tarefas foram marcadas como concluídas.'; }
    else if (de === 'Finalizado') { d.etapa = 'Fazendo'; d.concluido = null; msg = 'Reaberta em Fazendo. O histórico foi mantido.'; }
    else { d.etapa = et; msg = 'Movida para ' + et + (et === 'Aguardando retorno' && !d.setor ? '. Informe o setor e a data de acompanhamento em Editar.' : ''); } // sem setor nem datas inventados: só o destino escolhido
    DM.trocar({ etapaSel: et }); DM.toast(msg, 1);
    return true;
  };

  // menu "Mover para": botão do card (Mais ações ou Mover de etapa) abre a lista de etapas; Esc fecha e devolve o foco
  var COR_ETAPA = { Cadastro: 48, Vistos: 205, Fazendo: 262, 'Aguardando retorno': 330, Finalizado: 150 };
  function fechaMenuMover(volta) { var m = $('.mv-menu'); if (!m) return; var g = m._gatilho; m.remove(); if (volta && g && g.isConnected) g.focus(); }
  // menu de ações do formulário (celular): cada item aciona o botão original do rodapé, então confirmações e regras são as mesmas
  A['m-acoes'] = function (b) {
    var ja = $('.mv-menu'); if (ja) { var igual = ja._gatilho === b; fechaMenuMover(false); if (igual) return; }
    var origem = $$('.modal .m-f .m-sec'); if (!origem.length) return;
    var fr = $('.app'), rf = fr.getBoundingClientRect(), rb = b.getBoundingClientRect(), m = document.createElement('div');
    m.className = 'mv-menu'; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', 'Ações da demanda'); m._gatilho = b;
    m.innerHTML = origem.map(function (o, i) { var destrutivo = o.dataset.act === 'excluir'; return '<button type="button" role="menuitem" data-orig="' + i + '"' + (destrutivo ? ' class="perigo"' : '') + '>' + o.innerHTML + '</button>'; }).join('');
    fr.appendChild(m); var w = m.offsetWidth;
    m.style.left = Math.min(Math.max(8, rb.right - rf.left - w), rf.width - w - 8) + 'px'; m.style.top = (rb.bottom - rf.top + 6) + 'px';
    m._origem = origem; var it = $$('button', m); if (it[0]) it[0].focus();
  };
  A['mover-menu'] = function (b) {
    var ja = $('.mv-menu'); if (ja) { var igual = ja._gatilho === b; fechaMenuMover(false); if (igual) return; }
    var d = real(+b.dataset.id); if (!d) return;
    var fr = $('.app'), rf = fr.getBoundingClientRect(), rb = b.getBoundingClientRect();
    var m = document.createElement('div'); m.className = 'mv-menu'; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', 'Mover ' + d.tipo + ' ' + d.num + ' para a etapa'); m._gatilho = b;
    m.innerHTML = '<div class="mv-t">Mover para</div>' + DM.ETAPAS.map(function (et) {
      var atual = et === d.etapa, bloq = !atual && d.etapa === 'Finalizado' && et !== 'Fazendo';
      return '<button type="button" role="menuitemradio" aria-checked="' + atual + '" data-et="' + et + '"' + (atual || bloq ? ' aria-disabled="true"' : '') + (bloq ? ' title="Para reabrir, mova para Fazendo"' : '') + '><i class="dot" style="--et:' + COR_ETAPA[et] + '"></i><span>' + et + '</span>' + (atual ? '<small>atual</small>' : '') + '</button>';
    }).join('');
    fr.appendChild(m);
    var w = m.offsetWidth, h = m.offsetHeight;
    var x = Math.min(Math.max(8, rb.right - rf.left - w), rf.width - w - 8), y = rb.bottom - rf.top + 6; if (y + h > rf.height - 8) y = Math.max(8, rb.top - rf.top - h - 6);
    m.style.left = x + 'px'; m.style.top = y + 'px';
    var itens = $$('button:not([aria-disabled="true"])', m); (itens.filter(function (i) { return i.getAttribute('aria-checked') !== 'true'; })[0] || itens[0] || m).focus();
  };
  document.addEventListener('click', function (e) {
    var oi = e.target.closest && e.target.closest('.mv-menu button[data-orig]');
    if (oi) { e.stopPropagation(); var mm = oi.closest('.mv-menu'), alvo = mm._origem[+oi.dataset.orig]; mm.remove(); alvo.click(); return; }
    var it = e.target.closest && e.target.closest('.mv-menu button[data-et]');
    if (it) { e.stopPropagation(); if (it.getAttribute('aria-disabled') === 'true') return; var m = it.closest('.mv-menu'), id = +m._gatilho.dataset.id; m.remove(); DM.moverEtapa(id, it.dataset.et); return; }
    if ($('.mv-menu') && !(e.target.closest && e.target.closest('.mv-menu, [data-act="mover-menu"], [data-act="m-acoes"]'))) fechaMenuMover(false);
  }, true);
  document.addEventListener('keydown', function (e) {
    var m = $('.mv-menu'); if (!m) return;
    if (e.key === 'Escape') { e.stopImmediatePropagation(); fechaMenuMover(true); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var its = $$('button:not([aria-disabled="true"])', m), i = its.indexOf(document.activeElement); its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length].focus(); }
    if (e.key === 'Tab') fechaMenuMover(false);
  }, true);

  // arraste por ponteiro: mouse (depois de 6 px de movimento), toque e caneta (depois de segurar 380 ms; mexer antes disso é rolagem).
  // O card acompanha o dedo, a coluna de destino (ou a aba da etapa, quando só uma coluna cabe) fica destacada e as bordas rolam o Quadro.
  // Botões, caixas de marcar, texto de tarefa e links do card nunca iniciam o arraste.
  var PD = null, semClique = 0, SKIP = 'button, input, textarea, select, a, [contenteditable], .t-txt, .prox-t, .t-ed';
  function alvoSob(x, y) {
    var els = document.elementsFromPoint(x, y);
    for (var i = 0; i < els.length; i++) { var t = els[i].closest && els[i].closest('.etapas-tabs button[data-e], .coluna'); if (t && t.closest('.frame')) return t; }
    return null;
  }
  function etapaDe(t) { return t ? (t.dataset.e || t.getAttribute('aria-label')) : null; }
  function marcaAlvo(t) { $$('.coluna.alvo, .etapas-tabs button.alvo').forEach(function (x) { if (x !== t) x.classList.remove('alvo'); }); if (t) t.classList.add('alvo'); }
  function pdLimpa() {
    if (!PD) return; clearTimeout(PD.timer); cancelAnimationFrame(PD.raf);
    if (PD.ghost) PD.ghost.remove(); if (PD.card) PD.card.classList.remove('arrastando', 'segurando');
    marcaAlvo(null); var ap = $('.app'); if (ap) ap.classList.remove('arrastando-ativo'); PD = null;
  }
  function pdMover() {
    if (!PD || !PD.ativo) return; var fr = $('.app').getBoundingClientRect();
    PD.ghost.style.left = (PD.x - fr.left - PD.dx) + 'px'; PD.ghost.style.top = (PD.y - fr.top - PD.dy) + 'px';
    marcaAlvo(alvoSob(PD.x, PD.y));
  }
  function pdRola() {
    if (!PD || !PD.ativo) return;
    var borda = 64, q = $('.quadro'), tabs = $('.etapas-tabs'), main = $('.main');
    [q, tabs].forEach(function (s) {
      if (!s || !s.getBoundingClientRect().width || s.scrollWidth <= s.clientWidth) return; var r = s.getBoundingClientRect();
      if (PD.x < r.left + borda) s.scrollLeft -= Math.ceil((borda - (PD.x - r.left)) / 4); else if (PD.x > r.right - borda) s.scrollLeft += Math.ceil((borda - (r.right - PD.x)) / 4);
    });
    if (main) { var rm = main.getBoundingClientRect(); if (PD.y < rm.top + borda) main.scrollTop -= Math.ceil((borda - (PD.y - rm.top)) / 4); else if (PD.y > rm.bottom - borda) main.scrollTop += Math.ceil((borda - (rm.bottom - PD.y)) / 4); }
    pdMover(); PD.raf = requestAnimationFrame(pdRola);
  }
  function pdComeca() {
    if (!PD || PD.ativo) return; PD.ativo = true; clearTimeout(PD.timer);
    var c = PD.card, r = c.getBoundingClientRect(), g = c.cloneNode(true);
    g.classList.add('fantasma'); g.classList.remove('arrastando', 'segurando'); g.removeAttribute('data-id'); g.setAttribute('aria-hidden', 'true'); g.style.width = r.width + 'px';
    PD.dx = PD.x0 - r.left; PD.dy = PD.y0 - r.top; $('.app').appendChild(g); PD.ghost = g;
    c.classList.add('arrastando'); $('.app').classList.add('arrastando-ativo');
    pdMover(); PD.raf = requestAnimationFrame(pdRola);
  }
  document.addEventListener('pointerdown', function (e) {
    if (PD) pdLimpa();
    if (e.button > 0 || E.modal || $('.mv-menu')) return;
    var c = e.target.closest && e.target.closest('.mini-card'); if (!c || !c.closest('.quadro') || (e.target.closest && e.target.closest(SKIP))) return;
    PD = { id: +c.dataset.id, card: c, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, pid: e.pointerId, tipo: e.pointerType, ativo: false };
    if (e.pointerType !== 'mouse') { c.classList.add('segurando'); PD.timer = setTimeout(pdComeca, 380); }
  });
  document.addEventListener('pointermove', function (e) {
    if (!PD || e.pointerId !== PD.pid) return; PD.x = e.clientX; PD.y = e.clientY;
    if (!PD.ativo) {
      var dist = Math.hypot(PD.x - PD.x0, PD.y - PD.y0);
      if (PD.tipo === 'mouse') { if (dist > 6) pdComeca(); }
      else if (dist > 10) pdLimpa(); // moveu antes de segurar: é rolagem da página ou do Quadro
      return;
    }
    e.preventDefault(); pdMover();
  });
  function pdFim(e, cancelado) {
    if (!PD || e.pointerId !== PD.pid) return;
    var foi = PD.ativo, id = PD.id, et = !cancelado && foi ? etapaDe(alvoSob(e.clientX, e.clientY)) : null;
    pdLimpa(); if (foi) { semClique = Date.now(); if (et) DM.moverEtapa(id, et); }
  }
  document.addEventListener('pointerup', function (e) { pdFim(e, false); });
  document.addEventListener('pointercancel', function (e) { pdFim(e, true); });
  document.addEventListener('touchmove', function (e) { if (PD && PD.ativo) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { if (PD) e.preventDefault(); });
  document.addEventListener('click', function (e) { if (Date.now() - semClique < 120) { e.stopPropagation(); e.preventDefault(); semClique = 0; } }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && PD && PD.ativo) { e.stopImmediatePropagation(); pdLimpa(); } }, true);
  // atalho N para nova anotação
  document.addEventListener('keydown', function (e) {
    var t = e.target, digitando = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if (!digitando && !E.modal && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); abrir({ t: 'nota', key: 'nota', v: E.rascunho.nota || {}, rec: !!E.rascunho.nota }); }
  });
};
