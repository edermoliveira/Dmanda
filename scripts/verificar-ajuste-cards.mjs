// Prova que o ajuste de espaço dos cards (src/ui/visoes.tsx, função ajustar) produz exatamente o mesmo resultado visual depois de uma otimização.
// Usa o BUILD DE PRODUÇÃO LOCAL, o banco de TESTE (PGlite) com dados fictícios e o Edge. Nunca toca o Supabase real.
//   node scripts/verificar-ajuste-cards.mjs gravar     (com o build ANTIGO: grava o resultado de referência)
//   node scripts/verificar-ajuste-cards.mjs comparar   (com o build NOVO: compara com a referência e confere a consistência depois de redimensionar e filtrar)
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { semearVolume } from './semear-volume.mjs';

const modo = process.argv[2] || 'comparar';
const PORTA = process.env.PORTA_AJUSTE || '7113', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/ajuste-cards', GOLDEN = '.dados-teste/medicoes/golden-cards.json';
if (!existsSync('.next/BUILD_ID')) { console.error('Faça `npm run build` antes.'); process.exit(2); }
mkdirSync('.dados-teste/medicoes', { recursive: true });
rmSync(PASTA, { recursive: true, force: true });
await semearVolume(PASTA, 'medio');
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', PORTA], { env: { ...process.env, NODE_ENV: 'production', DMANDA_BANCO: 'teste', DMANDA_MEDICAO_LOCAL: 'sim', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 1000)); }

let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions'] });
const pg = await (await nav.newContext({ viewport: { width: 1360, height: 800 } })).newPage();
await pg.goto(BASE + '/demandas', { waitUntil: 'load' });
await pg.waitForSelector('.cards .dcard', { timeout: 60000 });
await pg.waitForFunction(() => !/Carregando/.test(document.body.innerText), null, { timeout: 60000 });
await pg.waitForTimeout(1500);

// estado de ajuste de cada card (frente e verso), em ordem de aparição
const capturar = () => pg.evaluate(() => [...document.querySelectorAll('.cards .dcard')].map((c) => {
  const f = c.querySelector('.face.front'), t = f.querySelector('.assunto.fit'), ds = f.querySelector('.desc'), ul = c.querySelector('.face.back .tarefas');
  return {
    id: c.getAttribute('data-id'), titulo: t?.style.webkitLineClamp ?? '', desc: ds ? ds.style.webkitLineClamp + (ds.classList.contains('oculto') ? '|oculto' : '') : '-',
    ocultos: [...f.querySelectorAll('.oculto')].map((x) => x.className.replace(/\s*oculto\s*/, ' ').trim() || x.tagName).join(','),
    tarefas: ul ? [...ul.querySelectorAll('li')].map((l) => (l.style.display === 'none' ? 'x' : l.classList.contains('mais-t') ? 'M:' + l.textContent : 'o')).join('') : '-',
  };
}));
// post-its de Entradas: o mesmo tipo de ajuste (linhas inteiras que cabem, tags que saem, descrição que some)
const capturarNotas = () => pg.evaluate(() => [...document.querySelectorAll('.postits .postit')].map((p) => {
  const x = p.querySelector('.p-txt.fit, .p-desc.fit'), tg = p.querySelector('.p-tags');
  return { id: p.getAttribute('data-id'), clamp: x?.style.webkitLineClamp ?? '-', maxh: x?.style.maxHeight ?? '-', xo: x?.classList.contains('oculto') ?? false, to: tg?.classList.contains('oculto') ?? false };
}));
const semId = (lista) => lista.map((x) => { const { id, ...resto } = x; void id; return JSON.stringify(resto); }).sort();
const esperar = async () => { await pg.waitForTimeout(700); await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
const L = [1360, 1024, 820, 390];
const colhido = {};
for (const w of L) { await pg.setViewportSize({ width: w, height: 800 }); await esperar(); colhido[w] = await capturar(); }
ok(Object.values(colhido).every((x) => x.length >= 80), `${colhido[1360].length} cards capturados em ${L.length} larguras`);
await pg.goto(BASE + '/entradas', { waitUntil: 'load' });
await pg.waitForSelector('.postits .postit', { timeout: 60000 });
await pg.waitForFunction(() => !/Carregando/.test(document.body.innerText), null, { timeout: 60000 });
await pg.waitForTimeout(1500);
const notas = {};
for (const w of [1360, 820, 390]) { await pg.setViewportSize({ width: w, height: 800 }); await esperar(); notas[w] = await capturarNotas(); }
colhido.notas = notas;
ok(notas[1360].length >= 100, `${notas[1360].length} post-its capturados em 3 larguras`);

if (modo === 'gravar') {
  writeFileSync(GOLDEN, JSON.stringify(colhido));
  console.log('Referência gravada em ' + GOLDEN);
} else {
  const ref = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  for (const w of L) {
    const a = semId(ref[w]), b = semId(colhido[w]); let dif = 0, ex = '';
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { dif++; if (!ex) ex = a[i] + ' => ' + b[i]; }
    ok(dif === 0, `largura ${w}: ajuste idêntico ao da referência (${dif} diferenças)${ex ? ' ex: ' + ex : ''}`);
  }
  for (const w of [1360, 820, 390]) {
    const a = semId(ref.notas[w]), b = semId(colhido.notas[w]); let dif = 0, ex = '';
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { dif++; if (!ex) ex = a[i] + ' => ' + b[i]; }
    ok(dif === 0, `post-its, largura ${w}: ajuste idêntico ao da referência (${dif} diferenças)${ex ? ' ex: ' + ex : ''}`);
  }
  await pg.setViewportSize({ width: 1360, height: 800 }); await esperar();
  ok(JSON.stringify(await capturarNotas()) === JSON.stringify(colhido.notas[1360]), 'post-its: voltar da largura de celular reproduz o ajuste original');
  await pg.fill('#eq', 'tag3'); await esperar();
  const nf = await capturarNotas(); const mapa = new Map(colhido.notas[1360].map((x) => [x.id, JSON.stringify(x)]));
  ok(nf.length > 0 && nf.length < colhido.notas[1360].length && nf.every((x) => mapa.get(x.id) === JSON.stringify(x)), `post-its: buscar mantém o ajuste de cada nota que continua (${nf.length})`);
  await pg.fill('#eq', ''); await esperar();
  ok(JSON.stringify(await capturarNotas()) === JSON.stringify(colhido.notas[1360]), 'post-its: limpar a busca reproduz o ajuste original');
  await pg.goto(BASE + '/demandas', { waitUntil: 'load' }); await pg.waitForSelector('.cards .dcard', { timeout: 60000 }); await pg.waitForTimeout(1500);
  // consistência: voltar à largura inicial reproduz o mesmo resultado (nada ficou preso de uma largura menor)
  await pg.setViewportSize({ width: 1360, height: 800 }); await esperar();
  ok(JSON.stringify(await capturar()) === JSON.stringify(colhido[1360]), 'voltar de 390 px para 1360 px reproduz o ajuste original (o que saiu volta a aparecer)');
  // filtrar e limpar o filtro: o ajuste dos que ficaram é o mesmo, e depois de limpar tudo volta ao original
  await pg.fill('#fq', 'fictícia 1'); await esperar();
  const filtrado = await capturar();
  const porId = new Map(colhido[1360].map((x) => [x.id, JSON.stringify(x)]));
  ok(filtrado.length > 0 && filtrado.length < colhido[1360].length && filtrado.every((x) => porId.get(x.id) === JSON.stringify(x)), `filtrar mantém o ajuste de cada card que continua na tela (${filtrado.length} cards)`);
  await pg.fill('#fq', ''); await esperar();
  ok(JSON.stringify(await capturar()) === JSON.stringify(colhido[1360]), 'limpar o filtro reproduz o ajuste original de todos os cards');
  // trocar de visão e voltar
  await pg.click('.tabs button[data-v="tabela"]'); await esperar(); await pg.click('.tabs button[data-v="cards"]'); await esperar();
  ok(JSON.stringify(await capturar()) === JSON.stringify(colhido[1360]), 'trocar de visão e voltar a Cards reproduz o ajuste original');
  // tamanho de letra do app (zoom do navegador mudaria a largura útil): muda a variável de escala e confere que o ajuste reage
  const antes = JSON.stringify(await capturar());
  await pg.evaluate(() => { document.querySelector('.app').style.setProperty('--esc', '1.15'); });
  await esperar(); await pg.setViewportSize({ width: 1361, height: 800 }); await esperar();
  const depois = JSON.stringify(await capturar());
  await pg.evaluate(() => { document.querySelector('.app').style.removeProperty('--esc'); });
  await pg.setViewportSize({ width: 1360, height: 800 }); await esperar();
  ok(JSON.stringify(await capturar()) === antes, 'depois de mudar e restaurar a escala de letra, o ajuste volta ao original' + (depois === antes ? ' (a escala 1,15 não alterou nenhum card)' : ''));
}
await nav.close(); parar();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
