// Perfil: histórico dos últimos 28 dias. Uma coluna por dia com a data, linhas de Humor e Energia identificadas, símbolos de tamanho igual,
// conteúdo contido no painel, rolagem só dentro do histórico com as duas pontas alcançáveis, dias sem registro discretos, teclado e toque.
// Uso (dentro da pasta prototipo): node testes/perfil-historico.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const pg = await (await nav.newContext({ viewport: { width: 1480, height: 1000 } })).newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.hist-rol')); await pg.waitForTimeout(400); };
const ROT_H = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'], ROT_E = ['Muito baixa', 'Baixa', 'Média', 'Alta', 'Muito alta'];

for (const modo of ['claro', 'escuro']) for (const dev of ['desktop', 'tablet-h', 'media', 'tablet-v', 'phone']) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=perfil&balao=nao&aviso=nao');
  const m = await pg.evaluate(() => {
    const w = document.querySelector('.hist-w'), pn = w.closest('.painel'), rp = pn.getBoundingClientRect(), rol = document.querySelector('.hist-rol'), rr = rol.getBoundingClientRect();
    const hds = [...document.querySelectorAll('.hd')], datas = hds.map((h) => h.querySelector('span').textContent), lab = [...document.querySelectorAll('.hist-lab b')].map((b) => b.textContent);
    const linhas = [...document.querySelectorAll('.hist-t tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => ({ vazio: td.classList.contains('vazio'), img: td.querySelector('img') && { src: td.querySelector('img').getAttribute('src'), alt: td.querySelector('img').alt, w: Math.round(td.querySelector('img').getBoundingClientRect().width), h: Math.round(td.querySelector('img').getBoundingClientRect().height), ok: td.querySelector('img').complete && td.querySelector('img').naturalWidth > 0 }, cw: Math.round(td.getBoundingClientRect().width) })));
    const a = rol.scrollLeft; rol.scrollLeft = 0; const p = hds[0].getBoundingClientRect(), primeiro = p.left >= rr.left + 1; rol.scrollLeft = rol.scrollWidth; const z = hds[hds.length - 1].getBoundingClientRect(), ultimo = z.right <= rr.right - 1; rol.scrollLeft = rol.scrollWidth;
    const labTop = [...document.querySelectorAll('.hist-lab b')].map((b) => Math.round(b.getBoundingClientRect().top + b.getBoundingClientRect().height / 2)), linTop = [...document.querySelectorAll('.hist-t tbody tr')].map((tr) => { const b = tr.querySelector('td').getBoundingClientRect(); return Math.round(b.top + b.height / 2); });
    return { dentro: rr.left >= rp.left - 1 && rr.right <= rp.right + 1 && w.scrollWidth <= w.clientWidth + 1, rola: rol.scrollWidth > rol.clientWidth + 1, abreNoFim: a > 0 || !(rol.scrollWidth > rol.clientWidth + 1), n: hds.length, datas, lab, linhas, primeiro, ultimo, alinhado: labTop.every((t, i) => Math.abs(t - linTop[i]) <= 1), paginaOk: document.querySelector('.dr').scrollWidth <= document.querySelector('.dr').clientWidth + 1 };
  });
  const emojis = m.linhas.flat().filter((c) => c.img);
  const tam = new Set(emojis.map((c) => c.img.w + 'x' + c.img.h));
  const sem = m.linhas.flat().filter((c) => c.vazio);
  ok(m.n === 28 && m.lab.join() === 'Humor,Energia' && m.dentro && m.paginaOk && m.alinhado, modo + ', ' + dev + ': 28 dias, linhas "' + m.lab.join('" e "') + '" alinhadas às colunas, conteúdo dentro do painel');
  ok(m.rola ? m.primeiro && m.ultimo && m.abreNoFim : true, modo + ', ' + dev + ': ' + (m.rola ? 'rola só dentro do histórico, abre no dia mais recente e as duas pontas são alcançáveis' : 'cabe sem rolar'));
  ok(emojis.length > 20 && emojis.every((c) => c.img.ok) && tam.size === 1 && [...tam][0] === '28x28' && sem.length > 0 && sem.length % 2 === 0, modo + ', ' + dev + ': ' + emojis.length + ' símbolos de ' + [...tam].join(', ') + ' px, ' + sem.length + ' células sem registro discretas');
  const e = m.linhas[1].filter((c) => c.img), h = m.linhas[0].filter((c) => c.img);
  ok(e.every((c) => /energia-[1-5]\.svg$/.test(c.img.src) && c.img.alt === 'Energia: ' + ROT_E[+/energia-(\d)/.exec(c.img.src)[1] - 1]) && h.every((c) => /humor-[1-5]\.png$/.test(c.img.src) && c.img.alt === 'Humor: ' + ROT_H[+/humor-(\d)/.exec(c.img.src)[1] - 1]), modo + ', ' + dev + ': Humor (PNG) e Energia (SVG) com o texto alternativo do nível certo');
}

// datas, valores e teclado
await abrir('tema=claro&dev=desktop&tela=perfil&balao=nao&aviso=nao');
const d = await pg.evaluate(() => [...document.querySelectorAll('.hd')].map((h) => ({ cur: h.querySelector('span').textContent, nome: h.getAttribute('aria-label'), tab: h.tabIndex })));
const esperadas = []; for (let j = 0; j < 28; j++) { const x = new Date(2026, 9, 21 - (27 - j)); esperadas.push(('0' + x.getDate()).slice(-2) + '/' + ('0' + (x.getMonth() + 1)).slice(-2)); }
ok(JSON.stringify(d.map((x) => x.cur)) === JSON.stringify(esperadas) && d[27].cur === '21/10' && d[0].cur === '24/09', 'datas consecutivas de 24/09 a 21/10, terminando hoje');
const sem = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
ok(d.every((x, j) => x.nome.startsWith(sem[new Date(2026, 9, 21 - (27 - j)).getDay()] + ', ' + new Date(2026, 9, 21 - (27 - j)).getDate() + ' de ')), 'cada coluna tem nome completo com dia da semana e data para leitores de tela e dica');
ok(d.filter((x) => x.tab === 0).length === 1 && d[27].tab === 0, 'teclado: uma só parada de Tab no histórico (roving), começando em hoje');
await pg.focus('.hd[data-i="27"]'); await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(100);
const k = await pg.evaluate(() => ({ foco: document.activeElement.dataset.i, det: document.querySelector('#hist-det').textContent, pressed: document.activeElement.getAttribute('aria-pressed') }));
ok(k.foco === '26' && k.pressed === 'true' && /^terça-feira, 20 de outubro/.test(k.det), 'seta para a esquerda vai para 20/10 e o resumo mostra "' + k.det + '"');
await pg.keyboard.press('Home'); await pg.waitForTimeout(100);
const hm = await pg.evaluate(() => ({ foco: document.activeElement.dataset.i, det: document.querySelector('#hist-det').textContent, vis: (() => { const r = document.activeElement.getBoundingClientRect(), s = document.querySelector('.hist-rol').getBoundingClientRect(); return r.left >= s.left - 1 && r.right <= s.right + 1; })() }));
ok(hm.foco === '0' && hm.vis && /^quinta-feira, 24 de setembro/.test(hm.det), 'Home vai ao primeiro dia (24/09), que fica inteiro à vista (' + hm.det + ')');
await pg.click('.hd[data-i="5"]'); await pg.waitForTimeout(100);
ok(/, 29 de setembro: /.test(await pg.textContent('#hist-det')), 'toque ou clique num dia mostra a data e os registros por extenso');
const valores = await pg.evaluate(() => [...document.querySelectorAll('.hist-t tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.classList.contains('vazio') ? '-' : td.querySelector('img').alt.split(': ')[1]).join('|')));
const bate = await pg.evaluate(() => { const ROT_H = ['Muito mal', 'Mal', 'Neutro', 'Bem', 'Muito bem'], ROT_E = ['Muito baixa', 'Baixa', 'Média', 'Alta', 'Muito alta']; return [...Array(28)].map((_, j) => { const i = j + 1, sem = i % 7 === 0 || i % 7 === 6; return sem ? '-' : ROT_H[(i * 3 + 1) % 5] + '/' + ROT_E[(i * 2 + 1) % 5]; }); });
ok(JSON.stringify(valores[0].split('|').map((h, j) => h === '-' ? '-' : h + '/' + valores[1].split('|')[j])) === JSON.stringify(bate), 'os valores de cada dia continuam os mesmos dados do protótipo (dia sem registro continua sem registro, nada foi preenchido)');
// Completar últimos dias continua abrindo a janela
await pg.click('.dr [data-act="completar"]'); await pg.waitForTimeout(300);
ok(await pg.evaluate(() => !!window.DM.estado.modal && /Completar os últimos dias/.test(document.querySelector('.modal').innerText)), '"Completar últimos dias" continua abrindo a janela de preenchimento');
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
