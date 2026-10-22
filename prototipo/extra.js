// Segunda camada do protótipo: temas definitivos, fontes em três papéis, energia, janelas de cadastro,
// demanda aberta, Perfil e Configurações completas. Recebe o objeto DM exposto pelo app.js.
window.DM_EXTRA = function (DM) {
  var E = DM.estado, ic = DM.ic, esc = DM.esc, $ = DM.$, $$ = DM.$$, DEM = DM.DEMANDAS, TELAS = DM.TELAS_FN;

  // ---------- fontes: título (principal), secundária (subtítulos e textos) e mono (detalhes) ----------
  function F(n, g) { return '"' + n + '", ' + g; }
  var FT = [['Sora', F('Sora', 'sans-serif')], ['Plus Jakarta Sans', F('Plus Jakarta Sans', 'sans-serif')], ['DM Serif Display', F('DM Serif Display', 'Georgia, serif')],
    ['Fraunces', F('Fraunces', 'Georgia, serif')], ['Manrope', F('Manrope', 'sans-serif')], ['Space Grotesk', F('Space Grotesk', 'sans-serif')],
    ['Playfair Display', F('Playfair Display', 'Georgia, serif')], ['Outfit', F('Outfit', 'sans-serif')]];
  var FS = [['Inter', F('Inter', 'system-ui, sans-serif')], ['DM Sans', F('DM Sans', 'system-ui, sans-serif')], ['Plus Jakarta Sans', F('Plus Jakarta Sans', 'system-ui, sans-serif')],
    ['Manrope', F('Manrope', 'system-ui, sans-serif')], ['Source Sans 3', F('Source Sans 3', 'system-ui, sans-serif')], ['Nunito Sans', F('Nunito Sans', 'system-ui, sans-serif')]];
  var FM = [['IBM Plex Mono', F('IBM Plex Mono', 'ui-monospace, monospace')], ['JetBrains Mono', F('JetBrains Mono', 'ui-monospace, monospace')], ['DM Mono', F('DM Mono', 'ui-monospace, monospace')],
    ['Space Mono', F('Space Mono', 'ui-monospace, monospace')], ['Fira Code', F('Fira Code', 'ui-monospace, monospace')]];
  var CONJUNTOS = [['Sora, Inter e IBM Plex Mono', 0, 0, 0], ['Jakarta e JetBrains Mono', 1, 2, 1], ['DM Serif, DM Sans e DM Mono', 2, 1, 2], ['Fraunces, Inter e DM Mono', 3, 0, 2], ['Manrope, Inter e JetBrains Mono', 4, 0, 1]];

  // ---------- temas definitivos: cada um guarda suas próprias escolhas ----------
  var TEMAS = [['a', 'Aurora', 'Vidro estilo Apple, gradiente suave'], ['b', 'Papel', 'Calmo, tom de papel e títulos serifados'], ['c', 'Grafite', 'Denso, bordas finas e foco em leitura']];
  var KEYS = ['pal', 'fT', 'fS', 'fM', 'iconeEstilo', 'lib', 'fs', 'ico', 'cardh', 'anim'];
  var PADRAO = { a: { fT: 0, fS: 0, fM: 0, iconeEstilo: 'pastilha' }, b: { fT: 3, fS: 0, fM: 2, iconeEstilo: 'pastilha' }, c: { fT: 4, fS: 0, fM: 1, iconeEstilo: 'duotone' } };
  function base(dir) { return Object.assign({ pal: null, fT: 0, fS: 0, fM: 0, iconeEstilo: '', lib: 'iconoir', fs: 15, ico: 20, cardh: 340, anim: false }, PADRAO[dir]); }
  function snap() { var o = {}; KEYS.forEach(function (k) { o[k] = E[k]; }); return o; }
  E.salvo = {}; E.perfilV = 'semana'; E.cidade = 'Taquara/RS'; E.prazoAuto = 30; E.alertaParado = 7; E.baloes = 3; E.reduzir = false; E.modal = null; E.rascunho = {}; E.energia = 2; E.col = false; E.balaoAb = false; E.balaoVisto = false;
  DM.mudaTema = function (ant, nu) { E.salvo[ant] = snap(); Object.assign(E, E.salvo[nu] || base(nu)); };
  DM.iniciar = function () {
    var h = new URLSearchParams(location.hash.slice(1)), o = base(E.dir);
    KEYS.forEach(function (k) { if (!h.has(k)) E[k] = o[k]; });
    if (h.get('balao') !== 'nao') setTimeout(function () { if (E.tela === 'inicio' && !E.balaoVisto && !E.modal) { E.balaoVisto = true; E.balaoAb = true; DM.trocar({}); } }, 2500);
    else E.balaoVisto = true;
  };
  DM.estiloApp = function () { return DM.estiloBase() + ';--font:' + FS[E.fS][1] + ';--font-h:' + FT[E.fT][1] + ';--font-n:' + FM[E.fM][1]; };
  DM.pos = function () {
    $$('#g-dir .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.dir === E.dir); });
    $$('#g-tema .seg').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.tema === E.tema); });
    var app = $('.app'); if (app) { app.dataset.col = E.col; app.dataset.reduzir = E.reduzir; }
    $$('.mini-card').forEach(function (c) { var b = c.querySelector('.circ'); if (b) { c.dataset.id = b.dataset.id; c.draggable = true; } });
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

  // ---------- Início ----------
  TELAS.inicio = function () {
    return '<div class="hero"><section class="painel"><div class="data">quarta-feira, 21 de outubro</div><p class="frase">Um passo de cada vez já é caminhar. Hoje, o primeiro é pequeno.</p></section>' +
      '<section class="painel clima"><div>' + ic('cloud-sun', 'duo') + '</div><div><b>24°</b><div class="data">' + esc(E.cidade) + ', parcialmente nublado</div></div></section></div>' +
      '<section class="painel registro"><div class="reg-l"><span>Como você está agora?</span><div class="emos" role="group" aria-label="Humor">' + seletor('humor', E.humor, 'humor', ROT_H) + '</div></div>' +
      '<div class="reg-l"><span>E a energia?</span><div class="emos" role="group" aria-label="Energia">' + seletor('energia', E.energia, 'energia', ROT_E) + '</div></div>' +
      '<button class="pend" data-act="completar">' + ic('clock') + '<span>Há 2 dias sem registro. Completar agora (opcional)</span>' + ic('right') + '</button></section>' +
      '<div class="stats">' + DM.stat(1, 'Atrasadas', 'clock', true) + DM.stat(1, 'Para hoje', 'target') + DM.stat(3, 'Próximos 7 dias', 'calendar') + DM.stat(1, 'Aguardando retorno', 'hourglass') + DM.stat(4, 'Entradas sem tratar', 'inbox') + '</div>' +
      '<section class="sec"><h3>Alertas</h3><div class="alertas">' +
      '<div class="alerta-l atrasada">' + ic('clock') + '<span>Resposta ao TCE sobre diárias está atrasada</span><span class="quando">3 dias</span></div>' +
      '<div class="alerta-l">' + ic('calendar') + '<span>Reunião com a Prefeita</span><span class="quando">hoje 14:00</span></div>' +
      '<div class="alerta-l">' + ic('hourglass') + '<span>Parecer da PGM parado há ' + E.alertaParado + '+ dias</span><span class="quando">acompanhar 24/10</span></div></div></section>' +
      '<section class="sec"><h3>Foco do dia <small>até 3 demandas, você pode trocar</small></h3><div class="cards">' +
      DM.FOCO.map(function (id) { return DM.cardHTML(DEM.filter(function (d) { return d.id === id; })[0]); }).join('') + '</div></section>';
  };

  // ---------- Perfil ----------
  function dadosDia(i) { return { h: (i * 3 + 1) % 5, e: (i * 2 + 1) % 5, c: (i * 5) % 4, sem: i % 7 === 0 || i % 7 === 6 }; }
  var DIAS7 = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  TELAS.perfil = function () {
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
      '<section class="painel"><p class="frase">Hoje você finalizou 1 demanda. Cada dia tem o seu ritmo, e isso é parte do caminho.</p>' +
      '<p class="data">Humor e energia são privados e nunca vão para a IA sem a sua permissão. Este espaço não substitui acompanhamento profissional.</p></section>';
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
      '<label class="fld"><span>Prazo automático, em dias (sem prazo informado)</span><input data-pref="prazoAuto" type="number" min="1" max="120" value="' + E.prazoAuto + '"></label>' +
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
  var TIPOS = ['Processo', 'Memorando', 'Ofício', 'Portaria', 'Reunião', 'Pedido pessoal'];
  var HOJE = Date.UTC(2026, 9, 21);
  function isoParaCurto(iso) { var p = iso.split('-'); return p[2] + '/' + p[1]; }
  function curtoParaIso(c) { var p = c.split('/'); return '2026-' + p[1] + '-' + p[0]; }
  function atrasoDe(iso) { var p = iso.split('-'); var d = Date.UTC(+p[0], +p[1] - 1, +p[2]); return Math.max(0, Math.round((HOJE - d) / 864e5)); }
  function maisDias(n) { var d = new Date(HOJE + n * 864e5); return d.toISOString().slice(0, 10); }
  function abrir(m) { m.v = m.v || {}; m.foco = true; DM.trocar({ modal: m, plus: false }); }
  function fechar() { DM.trocar({ modal: null }); }
  function campo(rot, nome, tipo, v, extra) { return '<div class="fld"><label for="m-' + nome + '">' + rot + '</label><input id="m-' + nome + '" data-v="' + nome + '" type="' + (tipo || 'text') + '" value="' + esc(v || '') + '" ' + (extra || '') + ' autocomplete="off"></div>'; }
  function cab(t) { return '<header class="m-h"><h3>' + t + '</h3><button class="icbtn-s" data-act="fechar-modal" aria-label="Fechar">' + ic('x') + '</button></header>'; }
  function opcoes(k, lista, atual) { return '<div class="opcoes" role="group">' + lista.map(function (o) { return '<button type="button" data-act="m-set" data-k="' + k + '" data-val="' + o + '" aria-pressed="' + (atual === o) + '">' + o + '</button>'; }).join('') + '</div>'; }

  function mNovaDem(m) {
    var v = m.v;
    return cab('Nova demanda') + '<p class="data">Cadastro rápido. Só o assunto é obrigatório.</p>' +
      campo('Número do processo ou memorando', 'num', 'text', v.num, 'placeholder="Ex.: 2310/2026"') + campo('Assunto', 'assunto', 'text', v.assunto, 'placeholder="Do que se trata?"') +
      campo('Origem', 'origem', 'text', v.origem, 'placeholder="Quem pediu ou de onde veio"') +
      '<div class="fld"><label>Tipo de documento (opcional)</label>' + opcoes('tipo', TIPOS, v.tipo) + '</div>' +
      '<div class="fld"><label>Prazo</label>' + opcoes('prazoTipo', ['Legal', 'Próprio'], v.prazoTipo || 'Próprio') + '</div>' +
      campo('Data do prazo (vazio: ' + E.prazoAuto + ' dias automáticos)', 'prazo', 'date', v.prazo) +
      '<footer class="m-f"><span class="data">Rascunho guardado automaticamente</span><span class="esp"></span><button class="btn" data-act="fechar-modal">Cancelar</button><button class="btn pri" data-act="salvar-dem">Cadastrar</button></footer>';
  }
  function mNota(m) {
    return cab('Nova anotação') + '<div class="fld"><label for="m-texto">Texto</label><textarea id="m-texto" data-v="texto" rows="5" placeholder="Escreva rápido. Use # para tags.">' + esc(m.v.texto || '') + '</textarea></div>' +
      '<footer class="m-f"><span class="data">Rascunho guardado automaticamente</span><span class="esp"></span><button class="btn" data-act="fechar-modal">Cancelar</button><button class="btn pri" data-act="salvar-nota">Guardar</button></footer>';
  }
  function mEvento(m) {
    var v = m.v;
    return cab('Novo evento') + campo('Título', 'titulo', 'text', v.titulo, 'placeholder="Reunião, compromisso ou lembrete"') + campo('Dia', 'dia', 'date', v.dia || '2026-10-22') +
      '<div class="dois">' + campo('Início', 'ini', 'time', v.ini || '09:00') + campo('Fim', 'fim', 'time', v.fim || '10:00') + '</div>' +
      '<p class="data">Aviso 15 minutos antes (padrão). Sincroniza do Dmanda para o Google Calendar, sem duplicar.</p>' +
      '<footer class="m-f"><span class="esp"></span><button class="btn" data-act="fechar-modal">Cancelar</button><button class="btn pri" data-act="salvar-ev">Criar evento</button></footer>';
  }
  function mTarefa(m) {
    return cab('Nova tarefa') + '<div class="fld"><label for="m-dem">Em qual demanda?</label><select id="m-dem" data-v="dem">' + DEM.filter(function (d) { return d.etapa !== 'Finalizado'; }).map(function (d) { return '<option value="' + d.id + '"' + (+m.v.dem === d.id ? ' selected' : '') + '>' + esc(d.num + ' · ' + d.assunto) + '</option>'; }).join('') + '</select></div>' +
      campo('Tarefa', 'texto', 'text', m.v.texto, 'placeholder="O que precisa ser feito?"') +
      '<footer class="m-f"><span class="esp"></span><button class="btn" data-act="fechar-modal">Cancelar</button><button class="btn pri" data-act="salvar-tar">Adicionar</button></footer>';
  }
  function mDemanda(m) {
    var d = DEM.filter(function (x) { return x.id === m.id; })[0]; if (!d) return '';
    var fin = d.etapa === 'Finalizado';
    var tar = d.tarefas.length ? '<ul class="tarefas">' + d.tarefas.map(function (t, i) { return '<li><label><input type="checkbox" data-act="tarefa" data-id="' + d.id + '" data-i="' + i + '"' + (t.f ? ' checked' : '') + '><span class="' + (t.f ? 'feita' : '') + '">' + esc(t.t) + '</span></label></li>'; }).join('') + '</ul>' : '<div class="proxima vazia"><span>Nenhuma tarefa cadastrada</span></div>';
    return cab(esc(d.tipo + ' ' + d.num)) + '<div class="m-cols"><div>' +
      '<div class="fld"><label for="d-assunto">Assunto</label><input id="d-assunto" data-d="assunto" value="' + esc(d.assunto) + '"></div>' +
      '<div class="dois"><div class="fld"><label for="d-num">Número</label><input id="d-num" data-d="num" value="' + esc(d.num) + '"></div><div class="fld"><label for="d-origem">Origem</label><input id="d-origem" data-d="origem" value="' + esc(d.origem) + '"></div></div>' +
      '<div class="fld"><label>Tipo de documento</label>' + opcoes('tipoDem', TIPOS, d.tipo) + '</div>' +
      '<div class="dois"><div class="fld"><label for="d-prazo">Prazo</label><input id="d-prazo" data-d="prazo" type="date" value="' + curtoParaIso(d.prazo) + '"></div><div class="fld"><label>Tipo de prazo</label>' + opcoes('prazoTipoDem', ['Legal', 'Próprio'], d.prazoTipo) + '</div></div>' +
      '<div class="fld"><label for="d-etapa">Etapa</label><select id="d-etapa" data-d="etapa">' + DM.ETAPAS.map(function (e) { return '<option' + (e === d.etapa ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></div>' +
      (d.etapa === 'Aguardando retorno' ? '<div class="dois"><div class="fld"><label for="d-setor">Setor</label><input id="d-setor" data-d="setor" value="' + esc(d.setor || '') + '"></div><div class="fld"><label for="d-ac">Acompanhar em</label><input id="d-ac" data-d="acompanhar" type="date" value="' + curtoParaIso(d.acompanhar || '24/10') + '"></div></div>' : '') +
      '</div><div><h4>Tarefas</h4>' + tar + '<div class="add-t"><input id="m-nt" data-v="nt" placeholder="Nova tarefa" aria-label="Nova tarefa" value="' + esc(m.v.nt || '') + '"><button class="btn mini" data-act="add-tarefa-m" data-id="' + d.id + '">' + ic('plus') + 'Adicionar</button></div>' +
      '<div class="meta"><div>Chegou em<b>' + d.chegou + '</b></div><div>Dias parada<b>' + d.parado + '</b></div></div>' +
      '<p class="data">O percentual mede só as tarefas. Concluir todas não muda a etapa sozinho.</p></div></div>' +
      '<footer class="m-f">' + (m.conf ? '<span class="data">Excluir de vez? Não dá para desfazer.</span><button class="btn perigo" data-act="excluir-ok" data-id="' + d.id + '">' + ic('trash') + 'Confirmar exclusão</button>' : '<button class="btn mini" data-act="msg" data-m="Arquivar">' + ic('archive') + 'Arquivar</button><button class="btn mini" data-act="excluir" data-id="' + d.id + '">' + ic('trash') + 'Excluir</button>') +
      '<span class="esp"></span>' + (fin ? '<button class="btn pri" data-act="reabrir-m" data-id="' + d.id + '">Reabrir (volta para Fazendo)</button>' : '<button class="btn pri" data-act="concluir-m" data-id="' + d.id + '">' + ic('check') + 'Concluir</button>') + '</footer>';
  }
  function mDias() {
    var dias = [['Terça, 20', 'ter'], ['Segunda, 19', 'seg']];
    return cab('Completar os últimos dias') + '<p class="data">Opcional. Só aparecem dias úteis sem registro (fins de semana e feriados ficam de fora).</p>' +
      dias.map(function (d) { return '<div class="dia-l"><b>' + d[0] + '</b><div class="emos">' + seletor('humor', -1, 'noop', ROT_H) + '</div><div class="emos">' + seletor('energia', -1, 'noop', ROT_E) + '</div></div>'; }).join('') +
      '<footer class="m-f"><span class="esp"></span><button class="btn" data-act="fechar-modal">Agora não</button><button class="btn pri" data-act="fechar-modal">Salvar</button></footer>';
  }
  function balao() {
    return '<div class="balao lg" role="status"><button class="icbtn-s" data-act="fechar-balao" aria-label="Fechar">' + ic('x') + '</button><b>Um registro rápido?</b><p class="data">Opcional. Só o último de cada indicador fica no dia.</p>' +
      '<div class="emos mini">' + seletor('humor', E.humor, 'humor-b', ROT_H) + '</div><div class="emos mini">' + seletor('energia', E.energia, 'energia-b', ROT_E) + '</div></div>';
  }
  DM.modalHTML = function () {
    var out = '', m = E.modal;
    if (E.balaoAb && E.tela === 'inicio') out += balao();
    if (m) {
      var corpo = m.t === 'dem' ? mNovaDem(m) : m.t === 'nota' ? mNota(m) : m.t === 'ev' ? mEvento(m) : m.t === 'tar' ? mTarefa(m) : m.t === 'demanda' ? mDemanda(m) : mDias();
      out += '<div class="modal-ov" data-act="fechar-ov"><div class="modal lg' + (m.t === 'demanda' ? ' larga' : '') + '" role="dialog" aria-modal="true">' + corpo + '</div></div>';
    }
    return out;
  };

  // ---------- ações ----------
  var A = DM.acoes;
  A['tema-dir'] = function (b) { DM.trocar({ dir: b.dataset.v }); };
  A.conjunto = function (b) { var c = CONJUNTOS[+b.dataset.i]; DM.trocar({ fT: c[1], fS: c[2], fM: c[3] }); };
  A.energia = function (b) { DM.trocar({ energia: +b.dataset.i }); };
  A['humor-b'] = function (b) { DM.trocar({ humor: +b.dataset.i, balaoAb: false }); DM.toast('Humor registrado'); };
  A['energia-b'] = function (b) { DM.trocar({ energia: +b.dataset.i, balaoAb: false }); DM.toast('Energia registrada'); };
  A['fechar-balao'] = function () { DM.trocar({ balaoAb: false }); };
  A.noop = function () {};
  A.reduzir = function () { DM.trocar({ reduzir: !E.reduzir }); };
  A.perfilv = function (b) { DM.trocar({ perfilV: b.dataset.v }); };
  A.colapsar = function () { DM.trocar({ col: !E.col }); };
  A.completar = function () { abrir({ t: 'dias' }); };
  A['fechar-modal'] = fechar;
  A['fechar-ov'] = function (b, e) { if (e.target === b) fechar(); };
  A.abrir = function (b) { abrir({ t: 'demanda', id: +b.dataset.id }); };
  A['m-set'] = function (b) {
    var m = E.modal, k = b.dataset.k, val = b.dataset.val;
    if (k === 'tipoDem' || k === 'prazoTipoDem') { var d = DEM.filter(function (x) { return x.id === m.id; })[0]; if (k === 'tipoDem') d.tipo = val; else d.prazoTipo = val; }
    else m.v[k] = val;
    DM.trocar({});
  };
  A.excluir = function () { E.modal.conf = true; DM.trocar({}); };
  A['excluir-ok'] = function (b) { var i = DEM.findIndex(function (x) { return x.id === +b.dataset.id; }); if (i > -1) DEM.splice(i, 1); DM.trocar({ modal: null }); DM.toast('Demanda excluída'); };
  A['concluir-m'] = function (b) { DEM.filter(function (x) { return x.id === +b.dataset.id; })[0].etapa = 'Finalizado'; DM.trocar({}); DM.toast('Demanda finalizada'); };
  A['reabrir-m'] = function (b) { DEM.filter(function (x) { return x.id === +b.dataset.id; })[0].etapa = 'Fazendo'; DM.trocar({}); DM.toast('Reaberta em Fazendo, histórico preservado'); };
  A['add-tarefa-m'] = function (b) {
    var d = DEM.filter(function (x) { return x.id === +b.dataset.id; })[0], t = (E.modal.v.nt || '').trim() || 'Nova tarefa';
    d.tarefas.push({ t: t, f: false }); E.modal.v.nt = ''; DM.trocar({});
  };
  A['salvar-dem'] = function () {
    var v = E.modal.v; if (!(v.assunto || '').trim()) { DM.toast('Escreva o assunto'); return; }
    var iso = v.prazo || maisDias(E.prazoAuto), id = DEM.reduce(function (a, d) { return Math.max(a, d.id); }, 0) + 1;
    DEM.push({ id: id, tipo: v.tipo || 'Processo', num: v.num || 's/n', assunto: v.assunto.trim(), origem: v.origem || 'Não informada', etapa: E.modal.etapa || 'Cadastro', prazoTipo: v.prazoTipo || 'Próprio', prazo: isoParaCurto(iso), atraso: atrasoDe(iso), tarefas: [], chegou: '21/10', parado: 0 });
    if (E.modal.nota != null) DM.NOTAS_E.splice(E.modal.nota, 1);
    delete E.rascunho.dem; DM.trocar({ modal: null }); DM.toast(v.prazo ? 'Demanda cadastrada' : 'Demanda cadastrada com prazo de ' + E.prazoAuto + ' dias');
  };
  A['salvar-nota'] = function () {
    var t = (E.modal.v.texto || '').trim(); if (!t) { DM.toast('Escreva a anotação'); return; }
    var tags = (t.match(/#(\w+)/g) || []).map(function (x) { return x.slice(1); });
    DM.NOTAS_E.unshift([t.replace(/#\w+/g, '').trim() || t, tags, false]); delete E.rascunho.nota; DM.trocar({ modal: null, tela: 'entradas' }); DM.toast('Anotação guardada');
  };
  A['salvar-ev'] = function () {
    var v = E.modal.v, t = (v.titulo || '').trim(); if (!t) { DM.toast('Escreva o título'); return; }
    var dia = +(v.dia || '2026-10-22').split('-')[2], mes = (v.dia || '2026-10-22').split('-')[1];
    if (mes === '10') DM.EVENTOS.push([dia, (v.ini || '09:00') + ' a ' + (v.fim || '10:00'), t]);
    DM.trocar({ modal: null, tela: 'agenda' }); DM.toast('Evento criado');
  };
  A['salvar-tar'] = function () {
    var v = E.modal.v, d = DEM.filter(function (x) { return x.id === +(v.dem || DEM[0].id); })[0], t = (v.texto || '').trim();
    if (!t) { DM.toast('Escreva a tarefa'); return; }
    d.tarefas.push({ t: t, f: false }); DM.trocar({ modal: null }); DM.toast('Tarefa adicionada');
  };
  A.msg = function (b) {
    var m = b.dataset.m || '', n = b.dataset.n;
    if (/^Virar demanda/.test(m)) { var nota = DM.NOTAS_E[+n]; abrir({ t: 'dem', nota: +n, v: { assunto: nota ? nota[0].split('\n')[0] : '', origem: '' } }); }
    else if (/^Nova demanda|^Novo: Demanda/.test(m)) { var et = m.match(/em (.+)$/); abrir({ t: 'dem', v: E.rascunho.dem || {}, etapa: et ? et[1] : null }); }
    else if (/^Novo: Anotação|^Nova nota/.test(m)) abrir({ t: 'nota', v: E.rascunho.nota || {} });
    else if (/^Novo: Evento/.test(m)) abrir({ t: 'ev', v: {} });
    else if (/^Novo: Tarefa/.test(m)) abrir({ t: 'tar', v: {} });
    else if (/^Novo: Chat/.test(m)) DM.trocar({ tela: 'ia', plus: false });
    else { DM.toast(m); if (E.plus) DM.trocar({ plus: false }); }
  };

  // ---------- campos das janelas e das preferências ----------
  document.addEventListener('input', function (e) {
    var t = e.target, m = E.modal;
    if (t.dataset.v && m) { m.v[t.dataset.v] = t.value; if (m.t === 'dem' || m.t === 'nota') E.rascunho[m.t] = m.v; }
    else if (t.dataset.d && m) {
      var d = DEM.filter(function (x) { return x.id === m.id; })[0], k = t.dataset.d;
      if (k === 'prazo') { d.prazo = isoParaCurto(t.value); d.atraso = atrasoDe(t.value); }
      else if (k === 'acompanhar') d.acompanhar = isoParaCurto(t.value);
      else d[k] = t.value;
    } else if (t.dataset.pref && t.tagName === 'INPUT') E[t.dataset.pref] = t.type === 'number' ? +t.value : t.value;
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.sel) DM.trocar((function () { var o = {}; o[t.dataset.sel] = +t.value; return o; })());
    else if (t.dataset.pref && t.tagName === 'SELECT') E[t.dataset.pref] = +t.value;
    else if (t.dataset.d === 'etapa' && E.modal) { DEM.filter(function (x) { return x.id === E.modal.id; })[0].etapa = t.value; DM.trocar({}); }
    else if (t.dataset.v === 'dem' && E.modal) E.modal.v.dem = t.value;
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && E.modal) { e.stopImmediatePropagation(); fechar(); } }, true);
  // ---------- Quadro: arrastar o card para outra etapa; atalho N para nova anotação ----------
  var arrastando = null;
  document.addEventListener('dragstart', function (e) { var c = e.target.closest && e.target.closest('.mini-card'); if (!c) return; arrastando = +c.dataset.id; c.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(arrastando)); } catch { /* navegador sem suporte */ } });
  document.addEventListener('dragend', function (e) { var c = e.target.closest && e.target.closest('.mini-card'); if (c) c.classList.remove('arrastando'); $$('.coluna.alvo').forEach(function (x) { x.classList.remove('alvo'); }); arrastando = null; });
  document.addEventListener('dragover', function (e) { var col = e.target.closest && e.target.closest('.coluna'); if (col && arrastando !== null) { e.preventDefault(); $$('.coluna.alvo').forEach(function (x) { if (x !== col) x.classList.remove('alvo'); }); col.classList.add('alvo'); } });
  document.addEventListener('drop', function (e) {
    var col = e.target.closest && e.target.closest('.coluna'); if (!col || arrastando === null) return; e.preventDefault();
    var d = DEM.filter(function (x) { return x.id === arrastando; })[0], et = col.getAttribute('aria-label'); arrastando = null;
    if (d && et && d.etapa !== et) { d.etapa = et; if (et === 'Aguardando retorno' && !d.setor) { d.setor = 'Setor a informar'; d.diasAg = 0; d.acompanhar = '28/10'; } DM.trocar({ etapaSel: et }); DM.toast('Movida para ' + et); }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target, digitando = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if (!digitando && !E.modal && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); abrir({ t: 'nota', v: E.rascunho.nota || {} }); }
  });
};
