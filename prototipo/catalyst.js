// Movimento do tema Catalyst (iOS 27): o protótipo redesenha o app inteiro a cada ação, então este
// observador compara a tela de antes com a de depois e anima só o que mudou:
// entrada de tela, folhas, menus e gaveta (e a saída deles, por clones), e a capsula de seleção
// que desliza entre abas (técnica FLIP). Só age quando o tema é o Catalyst (data-dir="d").
(function () {
  var frame = document.getElementById('frame');
  if (!frame || !window.MutationObserver) return;
  var MOLA = 'cubic-bezier(.32,1.25,.5,1)';
  var anterior = null;      // resumo da tela anterior
  var capsulas = {};        // posição da seleção antes do clique, por contêiner
  var GRUPOS = [['.tabs', 'button[aria-pressed="true"]'], ['.side', '.navi[aria-current="page"]'], ['.bar', '.bi[aria-current="page"]']];
  var SAIDAS = [['.modal-ov', '.modal-ov'], ['.busca-ov.aberto', '.busca-ov'], ['.dr-ov', '.dr-ov'], ['.menuplus.aberto', '.menuplus'], ['.balao', '.balao']];

  function reduzido() { var a = frame.querySelector('.app'); return (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || (a && a.dataset.reduzir === 'true'); }
  function ret(el, pai) { return { l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, n: pai.children.length }; }

  // antes de qualquer clique: guarda onde a seleção estava
  function guardar() {
    capsulas = {};
    var app = frame.querySelector('.app'); if (!app || app.dataset.dir !== 'd') return;
    GRUPOS.forEach(function (g) {
      Array.prototype.forEach.call(app.querySelectorAll(g[0]), function (c, i) {
        var s = c.querySelector(g[1]); if (s) capsulas[g[0] + i] = ret(s, c);
      });
    });
    capsulas.tela = app.querySelector('.navi[aria-current="page"]') ? (app.querySelector('.navi[aria-current="page"]').dataset.nav || '') : '';
  }
  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, guardar, true); });
  document.addEventListener('click', guardar, true);

  function resumo(app) {
    return {
      chave: app.dataset.dir + app.dataset.tema + app.dataset.dev + (window.DM && DM.estado ? DM.estado.tela : ''),
      modal: !!app.querySelector('.modal-ov'), busca: !!app.querySelector('.busca-ov.aberto'), plus: !!app.querySelector('.menuplus.aberto'),
      perfil: !!app.querySelector('.dr-ov'), balao: !!app.querySelector('.balao')
    };
  }

  function marcar(app, nome) { app.setAttribute('data-t-' + nome, ''); setTimeout(function () { app.removeAttribute('data-t-' + nome); }, 900); }

  function capsula(app, animar) {
    GRUPOS.forEach(function (g) {
      Array.prototype.forEach.call(app.querySelectorAll(g[0]), function (c, i) {
        var s = c.querySelector(g[1]), t = c.querySelector(':scope > .thumb');
        if (!s) { if (t) t.remove(); return; }
        if (!t) { t = document.createElement('i'); t.className = 'thumb'; c.insertBefore(t, c.firstChild); }
        var n = ret(s, c), a = capsulas[g[0] + i], pos = { left: n.l + 'px', top: n.t + 'px', width: n.w + 'px', height: n.h + 'px' };
        Object.assign(t.style, pos);
        if (animar && a && !reduzido() && (a.l !== n.l || a.t !== n.t || a.w !== n.w || a.h !== n.h) && a.n === n.n && t.animate) {
          t.animate([{ left: a.l + 'px', top: a.t + 'px', width: a.w + 'px', height: a.h + 'px' }, pos], { duration: 520, easing: MOLA });
        }
      });
    });
  }

  function saidas(velho, app) {
    if (!velho || reduzido()) return;
    SAIDAS.forEach(function (s) {
      var antes = velho.querySelector(s[0]), agora = app.querySelector(s[0]);
      if (antes && !agora) {
        var c = antes.cloneNode(true); c.classList.add('saindo'); c.removeAttribute('data-act'); app.appendChild(c);
        // sem o menu aberto, o clone precisa continuar visível durante a saída
        if (s[1] === '.menuplus') c.classList.add('aberto');
        setTimeout(function () { if (c.parentNode) c.remove(); }, 380);
      }
    });
  }

  function aoTrocar(muts) {
    var velho = null, app = frame.querySelector('.app');
    muts.forEach(function (m) { Array.prototype.forEach.call(m.removedNodes, function (n) { if (n.nodeType === 1 && n.classList.contains('app')) velho = n; }); });
    if (!app) return;
    if (app.dataset.dir !== 'd') { anterior = null; return; }
    var r = resumo(app), primeira = !anterior;
    capsula(app, !primeira && anterior.chave === r.chave);
    if (!primeira && !reduzido()) {
      if (anterior.chave !== r.chave) marcar(app, 'tela');
      if (!anterior.modal && r.modal) marcar(app, 'modal');
      if (!anterior.busca && r.busca) marcar(app, 'busca');
      if (!anterior.plus && r.plus) marcar(app, 'plus');
      if (!anterior.perfil && r.perfil) marcar(app, 'perfil');
      if (!anterior.balao && r.balao) marcar(app, 'balao');
      saidas(velho, app);
    }
    anterior = r;
  }
  new MutationObserver(aoTrocar).observe(frame, { childList: true });

  // largura mudou (resize, fontes): reposiciona as capsulas sem animar
  function reposicionar() { var a = frame.querySelector('.app'); if (a && a.dataset.dir === 'd') { capsulas = {}; capsula(a, false); } }
  if (window.ResizeObserver) new ResizeObserver(function () { clearTimeout(reposicionar.t); reposicionar.t = setTimeout(reposicionar, 60); }).observe(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reposicionar);
  // primeira montagem (já ocorreu antes do observador)
  var a0 = frame.querySelector('.app'); if (a0 && a0.dataset.dir === 'd') { anterior = resumo(a0); capsula(a0, false); }
})();
