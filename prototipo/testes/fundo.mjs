// Fundo personalizável: padrão do tema, cor (uma por modo) e imagem local (IndexedDB) com desfoque só na camada do fundo.
// Confere aplicação, persistência ao navegar e recarregar, nitidez do conteúdo, bordas sem vazio, cliques, falhas tratadas e os cinco tamanhos.
// Uso (dentro da pasta prototipo): node testes/fundo.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const ctx = await nav.newContext({ viewport: { width: 1480, height: 1000 } });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pg.on('requestfailed', (r) => erros.push('recurso não carregou: ' + r.url()));
pg.on('response', (r) => { if (r.status() >= 400) erros.push('HTTP ' + r.status() + ': ' + r.url()); });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const abrir = async (h) => { await pg.goto(srv.url + '#' + h); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(350); };
const tmp = mkdtempSync(join(tmpdir(), 'dmanda-fundo-'));

// duas imagens de teste, não quadradas (400x200 e 300x500), geradas no navegador e gravadas em arquivos temporários
const gerar = async (w, h, c1, c2, nome) => {
  const b64 = await pg.evaluate(([w, h, c1, c2]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = c1; g.fillRect(0, 0, w / 2, h); g.fillStyle = c2; g.fillRect(w / 2, 0, w / 2, h); return c.toDataURL('image/png').split(',')[1]; }, [w, h, c1, c2]);
  const f = join(tmp, nome); writeFileSync(f, Buffer.from(b64, 'base64')); return f;
};
await abrir('tema=claro&tela=config&balao=nao&aviso=nao');
const imgA = await gerar(400, 200, '#D94F4F', '#4F7FD9', 'a.png'), imgB = await gerar(300, 500, '#4FD97F', '#D9C84F', 'b.png');
writeFileSync(join(tmp, 'nao-e-imagem.txt'), 'texto'); writeFileSync(join(tmp, 'quebrada.png'), Buffer.from('isto não é um png de verdade'));

const bg = () => pg.evaluate(() => { const a = document.querySelector('.app'), b = document.querySelector('.bg'), i = document.querySelector('.bg-img'), cb = getComputedStyle(b), ci = getComputedStyle(i), rb = b.getBoundingClientRect(), ra = a.getBoundingClientRect(), ri = i.getBoundingClientRect();
  return { fundo: a.dataset.fundo, disp: cb.display, cor: cb.backgroundColor, pe: cb.pointerEvents, cobre: Math.abs(rb.width - ra.width) < 1 && Math.abs(rb.height - ra.height) < 1, size: ci.backgroundSize, filtro: ci.filter, imgDisp: ci.display, extra: [rb.left - ri.left, rb.top - ri.top, ri.right - rb.right, ri.bottom - rb.bottom].map((x) => Math.round(x)), vars: a.style.getPropertyValue('--fundo-desfoque') }; });
const superficies = () => pg.evaluate(() => { const q = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return [c.backgroundColor, c.color, c.filter, c.backdropFilter].join('|'); }; return [q('.face.front'), q('.main'), q('.side'), q('.pagehead h1')].join(' ## '); });
const idbTem = () => pg.evaluate(() => new Promise((ok) => { const r = indexedDB.open('dmanda', 1); r.onerror = () => ok('erro'); r.onsuccess = () => { try { const q = r.result.transaction('arquivos').objectStore('arquivos').get('fundo'); q.onsuccess = () => { r.result.close(); ok(q.result ? q.result.size : 0); }; } catch (e) { ok(0); } }; r.onupgradeneeded = () => { r.result.createObjectStore('arquivos'); }; }));

// 1) padrão do tema
await abrir('tema=claro&tela=demandas&vis=cards&balao=nao&aviso=nao');
const padraoClaro = await superficies(); let m = await bg();
ok(m.fundo === 'padrao' && m.disp === 'none', 'padrão do tema (claro): camada do fundo oculta, fundo neutro do Catalyst');

// 2) cor: uma por modo, só o fundo muda
await abrir('tema=claro&tela=config&balao=nao&aviso=nao');
await pg.click('[data-act="fundo-modo"][data-v="cor"]'); await pg.waitForTimeout(150);
await pg.fill('[data-fundo-cor]', '#336699'); await pg.waitForTimeout(150);
m = await bg();
ok(m.fundo === 'cor' && m.disp === 'block' && m.cor === 'rgb(51, 102, 153)' && m.cobre && m.pe === 'none', 'cor (claro): #336699 aplicada na camada do fundo, cobrindo o app e sem capturar cliques');
await pg.click('[data-nav="demandas"]'); await pg.waitForTimeout(250);
const corClaro = await superficies();
ok(corClaro === padraoClaro, 'com a cor ativa, card, texto, menu e título ficam exatamente como no padrão (só o fundo mudou)');
await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(300);
m = await bg(); ok(m.fundo === 'cor' && m.cor === 'rgb(51, 102, 153)', 'a cor sobrevive à navegação e ao recarregamento');
await pg.click('#g-tema .seg[data-tema="escuro"]'); await pg.waitForTimeout(250);
m = await bg(); ok(m.fundo === 'padrao', 'no modo escuro a cor do claro não vale (cada modo guarda a sua): fundo neutro do escuro');
await pg.click('[data-nav="config"]'); await pg.waitForTimeout(200);
await pg.click('[data-act="fundo-modo"][data-v="cor"]'); await pg.fill('[data-fundo-cor]', '#223344'); await pg.waitForTimeout(150);
m = await bg(); ok(m.fundo === 'cor' && m.cor === 'rgb(34, 51, 68)', 'cor própria do modo escuro (#223344) aplicada');
await pg.click('#g-tema .seg[data-tema="claro"]'); await pg.waitForTimeout(250);
m = await bg(); ok(m.fundo === 'cor' && m.cor === 'rgb(51, 102, 153)', 'voltando ao claro, a cor do claro reaparece');
await pg.click('[data-nav="config"]'); await pg.click('[data-act="fundo-modo"][data-v="padrao"]'); await pg.waitForTimeout(200);
m = await bg(); const prefs = await pg.evaluate(() => localStorage.getItem('dmanda:fundo'));
ok(m.fundo === 'padrao' && JSON.parse(prefs).cor.claro === '#336699', 'Padrão do tema restaura o fundo neutro e preserva as cores já escolhidas e as demais preferências');

// 3) imagem: escolher, desfoque, nitidez, bordas, cliques
await pg.click('[data-act="fundo-modo"][data-v="imagem"]'); await pg.waitForTimeout(150);
await pg.setInputFiles('[data-fundo-arquivo]', imgA); await pg.waitForTimeout(700);
m = await bg();
ok(m.fundo === 'imagem' && m.imgDisp === 'block' && m.size === 'cover' && m.filtro === 'blur(8px)' && m.cobre && m.pe === 'none', 'imagem 400x200 aplicada: object cover (sem distorcer), desfoque inicial de 8 px só na camada da imagem');
ok(m.extra.every((x) => x >= 16), 'a imagem passa da caixa do fundo em todas as bordas (' + m.extra.join(', ') + ' px): nenhuma borda vazia pelo desfoque');
ok((await idbTem()) > 0, 'o arquivo da imagem foi guardado no IndexedDB (' + (await idbTem()) + ' bytes), não no localStorage');
const prefTexto = await pg.evaluate(() => localStorage.getItem('dmanda:fundo'));
ok(prefTexto.length < 300 && !/data:image|base64/.test(prefTexto), 'a preferência em texto é pequena e não contém imagem (' + prefTexto.length + ' caracteres)');
const idImg = await pg.evaluate(() => { const i = document.querySelector('.bg-img'); window.__i = i; return !!i; });
await pg.evaluate(() => { const r = document.querySelector('[data-fundo-desf]'); r.value = '24'; r.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForTimeout(100);
m = await bg(); const mesmo = await pg.evaluate(() => window.__i === document.querySelector('.bg-img') && document.querySelector('#fundo-desf-v').textContent);
ok(idImg && m.filtro === 'blur(24px)' && mesmo === '24 px' && m.extra.every((x) => x >= 48), 'barra de desfoque: 24 px aplicado ao vivo, sem redesenhar a página (' + mesmo + '), imagem ainda além das bordas (' + m.extra.join(', ') + ')');
await pg.evaluate(() => { const r = document.querySelector('[data-fundo-desf]'); r.value = '0'; r.dispatchEvent(new Event('input', { bubbles: true })); });
m = await bg(); ok(m.filtro === 'blur(0px)' || m.filtro === 'none', 'desfoque 0 px: imagem nítida');
await pg.evaluate(() => { const r = document.querySelector('[data-fundo-desf]'); r.value = '12'; r.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.click('[data-nav="demandas"]'); await pg.waitForTimeout(300);
const nit = await pg.evaluate(() => { const alvos = ['.face.front', '.main', '.side', '.top', '.pagehead h1', '.toolbar'].map((s) => document.querySelector(s)).filter(Boolean); const comFiltro = []; alvos.forEach((a) => { for (let e = a; e && e !== document.body; e = e.parentElement) { const f = getComputedStyle(e).filter; if (f !== 'none') comFiltro.push(a.className + ' <- ' + e.className + ' ' + f); } }); const c = document.querySelector('.face.front').getBoundingClientRect(), topo = document.elementFromPoint(c.left + c.width / 2, c.top + 20); return { comFiltro, clicavel: !!topo && !!topo.closest('.face.front') }; });
ok(nit.comFiltro.length === 0 && nit.clicavel, 'desfoque só no fundo: nenhum card, menu, título ou barra tem filtro, e os cards continuam recebendo cliques');
await pg.screenshot({ path: join(tmp, 'imagem-claro.png') });
await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(700);
m = await bg(); ok(m.fundo === 'imagem' && m.filtro === 'blur(12px)', 'imagem e desfoque (12 px) sobrevivem à navegação e ao recarregamento');
await pg.click('#g-tema .seg[data-tema="escuro"]'); await pg.waitForTimeout(300); m = await bg();
ok(m.fundo === 'imagem' && m.filtro === 'blur(12px)', 'ao alternar para o escuro a imagem continua, com superfícies e textos do modo escuro');
await pg.click('#g-tema .seg[data-tema="claro"]'); await pg.waitForTimeout(300);

// 4) substituir e remover
await pg.click('[data-nav="config"]'); await pg.waitForTimeout(200);
const tam1 = await idbTem();
await pg.click('[data-act="fundo-escolher"]', { trial: true });
await pg.setInputFiles('[data-fundo-arquivo]', imgB); await pg.waitForTimeout(700);
const tam2 = await idbTem(); m = await bg();
ok(tam2 > 0 && tam2 !== tam1 && m.fundo === 'imagem' && m.size === 'cover', 'substituir troca o arquivo guardado (' + tam1 + ' para ' + tam2 + ' bytes) e mantém a proporção (cover)');
await pg.click('[data-act="fundo-remover"]'); await pg.waitForTimeout(500); m = await bg();
ok((await idbTem()) === 0 && m.fundo === 'padrao' && JSON.parse(await pg.evaluate(() => localStorage.getItem('dmanda:fundo'))).imagem === false, 'remover apaga o arquivo do IndexedDB e volta ao padrão do tema');
await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await pg.waitForTimeout(400);
m = await bg(); ok(m.fundo === 'padrao', 'depois de remover e recarregar, continua no padrão');

// 5) falhas tratadas, interface utilizável
await pg.click('[data-nav="config"]'); await pg.click('[data-act="fundo-modo"][data-v="imagem"]'); await pg.waitForTimeout(150);
await pg.setInputFiles('[data-fundo-arquivo]', join(tmp, 'nao-e-imagem.txt')); await pg.waitForTimeout(300);
let msg = await pg.textContent('#fundo-msg'); ok(/Escolha um arquivo de imagem/.test(msg), 'arquivo que não é imagem: mensagem clara (' + msg + ')');
await pg.setInputFiles('[data-fundo-arquivo]', join(tmp, 'quebrada.png')); await pg.waitForTimeout(500);
msg = await pg.textContent('#fundo-msg'); ok(/Não foi possível abrir esse arquivo como imagem/.test(msg) && (await bg()).fundo === 'padrao', 'imagem corrompida: mensagem clara e fundo inalterado (' + msg + ')');
await pg.evaluate(() => { indexedDB.open = () => { throw new Error('bloqueado'); }; });
await pg.setInputFiles('[data-fundo-arquivo]', imgA); await pg.waitForTimeout(500);
msg = await pg.textContent('#fundo-msg'); ok(/Não foi possível guardar a imagem/.test(msg) && (await bg()).fundo === 'padrao', 'armazenamento indisponível: mensagem clara e fundo inalterado (' + msg + ')');
await pg.click('[data-nav="inicio"]'); await pg.waitForTimeout(250);
ok(await pg.evaluate(() => window.DM.estado.tela === 'inicio' && !!document.querySelector('.app .main').children.length), 'depois das falhas a interface continua utilizável (navegação funciona)');

// 6) os cinco tamanhos, claro e escuro, com a imagem guardada
await abrir('tema=claro&tela=config&balao=nao&aviso=nao');
await pg.click('[data-act="fundo-modo"][data-v="imagem"]'); await pg.setInputFiles('[data-fundo-arquivo]', imgA); await pg.waitForTimeout(700);
for (const modo of ['claro', 'escuro']) for (const dev of ['desktop', 'tablet-h', 'media', 'tablet-v', 'phone']) {
  await abrir('tema=' + modo + '&dev=' + dev + '&tela=demandas&vis=cards&balao=nao&aviso=nao'); await pg.waitForTimeout(400);
  const r = await bg(); const sup = await pg.evaluate(() => { const f = document.querySelector('.face.front'); return f && getComputedStyle(f).filter === 'none' && getComputedStyle(document.querySelector('.main')).filter === 'none'; });
  ok(r.fundo === 'imagem' && r.cobre && r.size === 'cover' && r.extra.every((x) => x >= 16) && sup, modo + ', ' + dev + ': imagem cobre o app sem bordas vazias e o conteúdo fica nítido');
}
await pg.screenshot({ path: join(tmp, 'imagem-celular-escuro.png') });
// Mostrar menu continua funcionando com o fundo ativo
await abrir('tema=claro&dev=desktop&tela=inicio&menuAb=false&balao=nao&aviso=nao');
await pg.click('.col-b'); await pg.waitForTimeout(250); await pg.click('[data-nav="demandas"]'); await pg.waitForTimeout(250);
await abrir('tema=claro&dev=desktop&tela=demandas&balao=nao&aviso=nao'); // sem menuAb no endereço: vale a escolha guardada
ok(await pg.evaluate(() => document.querySelector('.app').dataset.aberto === 'true' && document.querySelector('.app').dataset.fundo === 'imagem'), 'Mostrar menu continua aberto ao navegar e recarregar, com o fundo em imagem');
ok(erros.length === 0, 'sem erros de JavaScript, de console nem de recursos' + (erros.length ? ': ' + [...new Set(erros)].join(' | ') : ''));
console.log('Capturas de apoio (temporárias): ' + tmp);
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
