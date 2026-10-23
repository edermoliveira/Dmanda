// Regressão do botão "Mostrar menu" (menu lateral expandido): a escolha deve valer ao navegar, ao voltar e ao recarregar.
// Causa original: o clique em qualquer item do menu zerava menuAb (app.js) e o estado não era guardado.
// Uso (dentro da pasta prototipo): node testes/menu.mjs
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const srv = await servir();
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=384'] });
const ctx = await nav.newContext({ viewport: { width: 1480, height: 1000 } });
const pg = await ctx.newPage();
const erros = []; pg.on('pageerror', (e) => erros.push(String(e.message || e)));
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'ok     ' : 'FALHOU ') + msg); if (!c) falhas++; };
const url = (dev, tela = 'inicio') => srv.url + '#dir=d&tema=claro&dev=' + dev + '&tela=' + tela + '&balao=nao&aviso=nao';
const sem = async () => pg.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
const estado = () => pg.evaluate(() => { const a = document.querySelector('.app'), b = document.querySelector('.col-b'), s = document.querySelector('.side'); const r = s.getBoundingClientRect(); return { aberto: a.dataset.aberto, exp: b && b.getAttribute('aria-expanded'), nome: b && b.getAttribute('aria-label'), larg: Math.round(r.width), tela: window.DM.estado.tela, vis: b ? getComputedStyle(b).display !== 'none' : false }; });
const abrir = async (dev, tela) => { await pg.goto(url(dev, tela)); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app')); await sem(); await pg.mouse.move(1470, 990); await pg.waitForTimeout(150); };

// 0) começa limpo
await pg.goto(url('desktop')); await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

// 1) computador: mostrar, navegar, voltar
await abrir('desktop', 'inicio');
let s = await estado();
ok(s.vis && s.aberto === 'false' && s.exp === 'false' && s.nome === 'Mostrar menu', 'computador: começa recolhido, com o botão "Mostrar menu"');
await pg.click('.col-b'); await pg.mouse.move(1470, 990); await pg.waitForTimeout(100);
s = await estado();
ok(s.aberto === 'true' && s.exp === 'true' && s.nome === 'Recolher menu' && s.larg > 200, 'mostrar: menu expandido, aria-expanded e nome refletem o estado');
await pg.click('.navi[data-nav="demandas"]'); await pg.mouse.move(1470, 990); await pg.waitForTimeout(100);
s = await estado();
ok(s.tela === 'demandas' && s.aberto === 'true' && s.exp === 'true' && s.larg > 200, 'navegar para Demandas: o menu continua expandido');
await pg.click('.navi[data-nav="agenda"]'); await pg.click('.navi[data-nav="inicio"]'); await pg.mouse.move(1470, 990); await pg.waitForTimeout(100);
s = await estado();
ok(s.tela === 'inicio' && s.aberto === 'true' && s.larg > 200, 'voltar para Início depois de outra seção: continua expandido');

// 2) recarregar mantém a escolha
await abrir('desktop', 'documentos');
s = await estado();
ok(s.aberto === 'true' && s.exp === 'true' && s.larg > 200, 'recarregar a página: a escolha continua');

// 3) ação inversa
await pg.click('.col-b'); await pg.mouse.move(1470, 990); await pg.waitForTimeout(100);
s = await estado();
ok(s.aberto === 'false' && s.exp === 'false' && s.nome === 'Mostrar menu' && s.larg < 140, 'recolher: volta a só ícones');
await pg.click('.navi[data-nav="ia"]'); await pg.mouse.move(1470, 990); await pg.waitForTimeout(100);
s = await estado();
ok(s.tela === 'ia' && s.aberto === 'false', 'navegar recolhido: continua recolhido');
await abrir('desktop', 'inicio');
s = await estado();
ok(s.aberto === 'false', 'recarregar recolhido: continua recolhido');

// 4) conteúdo não fica coberto quando expandido (a coluna do menu cresce)
await pg.click('.col-b'); await pg.mouse.move(1470, 990); await pg.waitForTimeout(100);
const cobre = await pg.evaluate(() => { const s = document.querySelector('.side').getBoundingClientRect(), m = document.querySelector('.main'); const c = m.querySelector('.pagehead, h1, .frase-dia'); if (!c) return null; return c.getBoundingClientRect().left - s.right; });
ok(cobre === null || cobre >= -1, 'expandido: o conteúdo começa à direita do menu (folga ' + Math.round(cobre) + ' px)');

// 5) telas estreitas: a preferência guardada não deixa menu sobre o conteúdo
for (const [dev, nome] of [['media', 'janela média (1000 px)'], ['tablet-v', 'iPad vertical'], ['phone', 'celular']]) {
  await abrir(dev, 'inicio'); s = await estado();
  ok(!s.vis, nome + ': não há botão "Mostrar menu"');
  const sobre = await pg.evaluate(() => { const sd = document.querySelector('.side'); if (!sd || getComputedStyle(sd).display === 'none') return 0; return Math.round(sd.getBoundingClientRect().width); });
  ok(sobre < 140, nome + ': com a preferência guardada como aberto, o menu não cobre o conteúdo (largura ' + sobre + ' px)');
}
// 6) celular: a navegação continua pela barra inferior
await abrir('phone', 'inicio');
await pg.click('.bar [data-nav="agenda"]').catch(() => {});
ok((await estado()).tela === 'agenda', 'celular: a barra inferior navega normalmente');

// 7) endereço com menuAb explícito não quebra
await pg.goto(srv.url + '#dir=d&tema=claro&dev=desktop&tela=inicio&menuAb=false&balao=nao&aviso=nao'); await pg.reload(); await pg.waitForFunction(() => window.DM && document.querySelector('.app'));
s = await estado(); ok(s.aberto === 'false' && s.nome === 'Mostrar menu', 'endereço com menuAb=false: abre recolhido, com o nome certo');

ok(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros[0] : ''));
await nav.close(); srv.fechar();
console.log(falhas ? '\n' + falhas + ' verificação(ões) falharam.' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
