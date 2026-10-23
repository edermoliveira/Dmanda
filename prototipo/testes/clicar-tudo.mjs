// Teste automático do protótipo: clica em todos os controles de todas as telas, mede o contraste
// de todo texto visível, procura estouro de layout e erros de JavaScript. Rodar a cada etapa.
// Uso (dentro da pasta prototipo): node testes/clicar-tudo.mjs [temas] [modos] [telas-do-aparelho]
//   exemplo: node testes/clicar-tudo.mjs d claro,escuro desktop,phone
// Sem argumentos, testa os quatro temas, nos dois modos, no computador e no celular.
// Usa o Microsoft Edge já instalado (playwright-core não baixa navegador e não pede administrador).
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const [, , aTemas = 'a,b,c,d', aModos = 'claro,escuro', aDevs = 'desktop,phone'] = process.argv;
const TEMAS = aTemas.split(','), MODOS = aModos.split(','), DEVS = aDevs.split(',');
const TELAS = ['inicio', 'entradas', 'demandas', 'agenda', 'documentos', 'ia', 'config', 'arquivo', 'mais'];
const VISOES = { demandas: ['cards', 'quadro', 'tabela', 'lista'], agenda: ['hoje', 'semana', 'mes'] };
// barras de rolagem lateral aceitas (decisão do usuário): Quadro, semana da Agenda, tabela, mês, abas de etapa
const ROLAGEM_OK = '.quadro, .ag-sem, .tabela-w, .ag-mes, .etapas-tabs, .tagbar, .ag-mini-l';

const srv = await servir();
const BASE = srv.url;

// ---------- funções que rodam dentro da página ----------
function medirNaPagina(rolagemOk) {
  const app = document.querySelector('.app'), out = { contraste: [], estouro: [], pequenos: [] };
  if (!app) return out;
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const mix = (c, b) => [c[0] * c[3] + b[0] * (1 - c[3]), c[1] * c[3] + b[1] * (1 - c[3]), c[2] * c[3] + b[2] * (1 - c[3]), 1];
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const base = rgba(getComputedStyle(document.body).backgroundColor) || [252, 252, 252, 1];
  const visivel = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const nome = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase()) + ' "' + (el.textContent || '').trim().slice(0, 40) + '"';
  for (const el of app.querySelectorAll('*')) {
    if (!visivel(el) || el.closest('.saindo, .sr, [aria-hidden="true"], svg')) continue;
    const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'range' && el.value);
    if (!temTexto) continue;
    if (el.disabled || el.closest('[disabled]')) continue;
    const r = el.getBoundingClientRect(), fr = document.querySelector('#frame').getBoundingClientRect();
    if (r.bottom < fr.top || r.top > fr.bottom || r.right < fr.left || r.left > fr.right) continue;
    // fundo efetivo: compõe as camadas até achar uma opaca; gradiente ou imagem no caminho torna a medida incerta
    let camadas = [], incerto = false, opac = 1, n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      opac *= +cs.opacity;
      if (cs.backgroundImage !== 'none' && !n.classList.contains('postit')) { if (!/gradient\(.*(hsl\(0 0% 98\.8% \/ \.1|rgba\(252, 252, 252, 0\.1)/.test(cs.backgroundImage)) incerto = true; }
      const b = rgba(cs.backgroundColor); if (b && b[3] > 0) { camadas.push(b); if (b[3] >= 0.99) break; }
      n = n.parentElement;
    }
    if (incerto) continue;
    let fundo = base; for (let i = camadas.length - 1; i >= 0; i--) fundo = mix(camadas[i], fundo);
    let cor = rgba(getComputedStyle(el).color); if (!cor) continue;
    cor = mix([cor[0], cor[1], cor[2], cor[3] * opac], fundo);
    const k = razao(cor, fundo), cs = getComputedStyle(el), px = parseFloat(cs.fontSize), negrito = +cs.fontWeight >= 700;
    const minimo = px >= 24 || (px >= 18.66 && negrito) ? 3 : 4.5;
    if (k < minimo) out.contraste.push({ el: nome(el), razao: +k.toFixed(2), minimo });
  }
  // estouro: a área principal nunca rola para o lado; peças não passam da tela
  const main = app.querySelector('.main');
  if (main && main.scrollWidth > main.clientWidth + 1) {
    const largo = [...main.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(), m = main.getBoundingClientRect(); return visivel(e) && r.right > m.right + 1 && !e.closest(rolagemOk); }).slice(0, 4).map(nome);
    if (largo.length) out.estouro.push({ el: '.main rola para o lado', detalhe: largo });
  }
  for (const el of app.querySelectorAll('.btn, .icbtn, button.chip, .navi, .bi, .stat')) {
    if (!visivel(el) || el.closest(rolagemOk) || el.closest('.saindo')) continue;
    // mede o texto (e não a área de toque invisível do ::after, que passa da borda de propósito)
    // (selos em posição absoluta, como o número de avisos do sino, também ficam de fora)
    let esq = Infinity, dir = -Infinity;
    for (const c of el.childNodes) {
      if (c.nodeType === 1 && getComputedStyle(c).position === 'absolute') continue;
      let q; if (c.nodeType === 3) { if (!c.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(c); q = rg.getBoundingClientRect(); } else if (c.nodeType === 1) q = c.getBoundingClientRect(); else continue;
      if (q.width) { esq = Math.min(esq, q.left); dir = Math.max(dir, q.right); }
    }
    const cs2 = getComputedStyle(el), dentro = el.clientWidth - parseFloat(cs2.paddingLeft) - parseFloat(cs2.paddingRight);
    if (dir - esq > dentro + 2 && cs2.textOverflow !== 'ellipsis') out.estouro.push({ el: nome(el), detalhe: 'texto maior que o botão' });
    const r = el.getBoundingClientRect(); if (Math.min(r.width, r.height) < 24) out.pequenos.push(nome(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return out;
}

const navegador = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--disable-background-networking', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] }) // flags que poupam memória;
const pagina = await navegador.newPage({ viewport: { width: 1480, height: 1000 } });
const erros = [];
pagina.on('pageerror', (e) => erros.push(String(e.message || e)));
pagina.on('console', (m) => { if (m.type() === 'error' && !/energia-\d\.png|404|Failed to load resource/.test(m.text())) erros.push(m.text()); });
pagina.on('dialog', (d) => d.dismiss());

const relatorio = { cliques: 0, semEfeito: [], naoClicavel: [], erros: [], contraste: [], estouro: [], pequenos: [] };
const unico = (lista, item) => { const k = JSON.stringify(item); if (!lista.some((x) => JSON.stringify(x) === k)) lista.push(item); };

async function preparar(dir, tema, dev, tela) {
  await pagina.goto(BASE + '#dir=' + dir + '&tema=' + tema + '&dev=' + dev + '&tela=' + tela + '&balao=nao&aviso=nao');
  await pagina.waitForFunction(() => window.DM && document.querySelector('.app'));
  // sem animação durante os cliques (peça em movimento não recebe clique); a medida de contraste é feita depois
  await pagina.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  await pagina.evaluate(() => { const E = window.DM.estado; window.__ini = { dir: E.dir, tema: E.tema, lib: E.lib, iconeEstilo: E.iconeEstilo }; window.__reset = (o) => { const E = window.DM.estado; E.edT = null; E.fixo = {}; const ov = document.getElementById('ov'); if (ov) ov.classList.remove('aberto'); window.DM.trocar(Object.assign({ modal: null, plus: false, perfilAb: false, balaoAb: false, menuAb: false, dir: window.__ini.dir, tema: window.__ini.tema, lib: window.__ini.lib, iconeEstilo: window.__ini.iconeEstilo, reduzir: false }, o)); document.activeElement && document.activeElement.blur && document.activeElement.blur(); }; });
}
// retrato da tela: o HTML inteiro, o aviso (toast) e o estado da busca
const FOTO = () => { const a = document.querySelector('.app'), t = document.querySelector('#toast'); let h = 0; const s = a.outerHTML + '|' + (t ? t.className + t.textContent : '') + '|' + JSON.stringify(window.DM.estado, (k, v) => (k === 'salvo' ? undefined : v)); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
const SEL = '.app button, .app [data-act], .app [data-nav], .app input[type="checkbox"], .app [role="button"]';
async function clicarTudo(ctx, estadoTela) {
  const n = await pagina.evaluate((s) => document.querySelectorAll(s).length, SEL);
  for (let i = 0; i < n; i++) {
    await pagina.evaluate((o) => window.__reset(o), estadoTela);
    // o mouse sai de cima do menu lateral (que abre ao passar o mouse e cobre o conteúdo)
    await pagina.mouse.move(1470, 990);
    await pagina.waitForTimeout(30);
    const alvo = pagina.locator(SEL).nth(i);
    if (!(await alvo.count())) break;
    const info = await alvo.evaluate((el) => { const r = el.getBoundingClientRect(); return { vis: r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.saindo'), dis: el.disabled, nome: (el.getAttribute('aria-label') || el.textContent || el.className || '').trim().replace(/\s+/g, ' ').slice(0, 50), act: el.dataset.act || el.dataset.nav || '', sel: el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-current') === 'page' }; });
    if (!info.vis || info.dis) continue;
    // controle do verso: fixa o verso do card antes (como faria o usuário ao girar)
    if (await alvo.evaluate((el) => { const c = el.closest('.face.back') && el.closest('.dcard'); if (c) c.dataset.fix = 'verso'; return !!c; })) await pagina.waitForTimeout(20);
    const antes = await pagina.evaluate(FOTO);
    const nErros = erros.length;
    try { await alvo.click({ timeout: 1200 }); }
    catch { try { const quem = await alvo.evaluate((el) => { const r = el.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t ? t.tagName.toLowerCase() + '.' + String(t.className).split(' ').slice(0, 2).join('.') : 'fora da tela'; }); await alvo.click({ timeout: 800, force: true }); unico(relatorio.naoClicavel, ctx + ': ' + info.nome + ' (coberto por ' + quem + ')'); } catch { unico(relatorio.naoClicavel, ctx + ': ' + info.nome); continue; } }
    relatorio.cliques++;
    await pagina.waitForTimeout(140);
    if (erros.length > nErros) erros.splice(nErros).forEach((e) => unico(relatorio.erros, ctx + ' ao clicar em "' + info.nome + '": ' + e));
    const depois = await pagina.evaluate(FOTO);
    const focoMudou = await pagina.evaluate(() => document.activeElement && document.activeElement !== document.body);
    // o que já estava escolhido (aba atual, item atual do menu) não muda nada ao ser clicado de novo, e está certo
    if (antes === depois && !focoMudou && info.act !== 'noop' && !info.sel) unico(relatorio.semEfeito, ctx + ': ' + info.nome);
    // depois de cada clique: Esc fecha o que abriu sem erro
    await pagina.keyboard.press('Escape');
  }
}
async function medir(ctx) {
  await pagina.waitForTimeout(650);
  const m = await pagina.evaluate(medirNaPagina, ROLAGEM_OK);
  m.contraste.forEach((x) => unico(relatorio.contraste, ctx + ': ' + x.el + ' ' + x.razao + ':1 (mínimo ' + x.minimo + ')'));
  m.estouro.forEach((x) => unico(relatorio.estouro, ctx + ': ' + x.el + ' ' + JSON.stringify(x.detalhe)));
  m.pequenos.forEach((x) => unico(relatorio.pequenos, ctx + ': ' + x));
}

const inicio = Date.now();
for (const dir of TEMAS) for (const tema of MODOS) for (const dev of DEVS) {
  for (const tela of TELAS) {
    const ctx = dir + '/' + tema + '/' + dev + '/' + tela;
    await preparar(dir, tema, dev, tela);
    for (const v of VISOES[tela] || [null]) {
      const o = { tela }; if (v) o[tela === 'demandas' ? 'vis' : 'ag'] = v;
      await pagina.evaluate((x) => window.__reset(x), o);
      await medir(ctx + (v ? '/' + v : ''));
      await clicarTudo(ctx + (v ? '/' + v : ''), o);
    }
    // janelas abertas também são medidas
    if (tela === 'demandas') {
      for (const abre of ['abrir', 'nova']) {
        await pagina.evaluate((a) => { window.__reset({ tela: 'demandas', vis: 'cards' }); if (a === 'abrir') window.DM.acoes.abrir({ dataset: { id: '1' } }); else window.DM.acoes.msg({ dataset: { m: 'Nova demanda' } }); }, abre);
        await medir(ctx + '/janela-' + abre);
      }
    }
    if (tela === 'agenda') { await pagina.evaluate(() => { window.__reset({ tela: 'agenda', ag: 'semana' }); window.DM.acoes['ev-dia']({ dataset: { dia: '23' } }); }); await medir(ctx + '/janela-evento'); }
    if (erros.length) erros.splice(0).forEach((e) => unico(relatorio.erros, ctx + ': ' + e));
  }
  console.log('ok ' + dir + '/' + tema + '/' + dev + ' (' + Math.round((Date.now() - inicio) / 1000) + ' s)');
}
await navegador.close(); srv.fechar();

const linha = (t, l) => { console.log('\n' + t + ': ' + l.length); l.slice(0, 60).forEach((x) => console.log('  - ' + x)); if (l.length > 60) console.log('  ... e mais ' + (l.length - 60)); };
console.log('\nCliques feitos: ' + relatorio.cliques);
linha('Erros de JavaScript', relatorio.erros);
linha('Textos com contraste abaixo do mínimo', relatorio.contraste);
linha('Estouro de layout', relatorio.estouro);
linha('Controles não clicáveis', relatorio.naoClicavel);
linha('Cliques sem efeito visível (conferir)', relatorio.semEfeito);
linha('Alvos menores que 24 px (conferir área de toque)', relatorio.pequenos);
process.exit(relatorio.erros.length || relatorio.contraste.length || relatorio.estouro.length ? 1 : 0);
