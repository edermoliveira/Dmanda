// Decisão 77, no navegador (Edge e, quando existe, o WebKit do Playwright) com banco local de TESTE (PGlite, dados fictícios), porta 7119:
//   revelar o próximo card durante o arrasto (parcial nos dois sentidos, gesto completo, rolagem, foco e clique nos cards de fundo), medido no baralho da Urgência do Início.
// As filas de Demandas > Cards (nove seções) e a Urgência completa são da suíte testar-vagas-carrosseis (decisão 80); as antigas por tipo e área e o "Na fila" saíram da interface.
// O WebKit do Playwright é o motor do Safari no Windows, NÃO o Safari do iPhone: o toque real fica para o aparelho. Uso: node scripts/testar-fila-cards.mjs (nunca toca o Supabase real)
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_FILA || '7119', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/fila-cards', CAPTURAS = '.dados-teste/fila-cards-capturas';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(PASTA, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- dados fictícios: 17 demandas em seis grupos ----------
let HOJE;
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const mk = (assunto, tipo, area, dias, extra = {}) => chamarComoUsuario(db, USUARIO, 'criar_demanda', { p: { assunto, tipo, area, numero: '', etapa: 'Fazendo', ...(dias === null ? {} : { prazo_original: somarDias(HOJE, dias) }), ...extra } });
  // Processo, Geral (azul)
  await mk('PG1 atrasada longa', 'Processo', 'Geral', -5); await mk('PG2 atrasada', 'Processo', 'Geral', -1); await mk('PG3 vence hoje', 'Processo', 'Geral', 0); await mk('PG4 próxima', 'Processo', 'Geral', 3);
  await mk('PG5 pedido da Prefeita sem prazo', 'Processo', 'Geral', null, { origem: 'Prefeita' });
  // Processo, Pessoal (verde)
  await mk('PV1 atrasada', 'Processo', 'Pessoal', -2); await mk('PV2 próxima', 'Processo', 'Pessoal', 2); await mk('PV3 distante', 'Processo', 'Pessoal', 20); await mk('PV4 sem prazo', 'Processo', 'Pessoal', null);
  // Protocolo, Geral (azul)
  await mk('KG1 próxima', 'Protocolo', 'Geral', 1); await mk('KG2 atrasada', 'Protocolo', 'Geral', -3);
  // Memorando e um tipo cadastrado pelo usuário e sem documento
  await mk('ME1 atrasada', 'Memorando', 'Geral', -4); await mk('ME2 próxima', 'Memorando', 'Geral', 5); await mk('ME3 sem prazo', 'Memorando', 'Geral', null); await mk('ME4 distante', 'Memorando', 'Geral', 30);
  await mk('RG1 relatório de gestão hoje', 'Relatório de gestão', 'Geral', 0);
  await mk('SD1 sem documento atrasada', '', 'Geral', -6);
  await db.close();
}

let servidor = null;
const subir = async () => {
  servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/'); if (r.status < 500) break; } catch { /* subindo */ } await esperar(2000); }
};
const parar = () => { if (servidor) { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; } };
process.on('exit', parar);
await subir();

const edge = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
let wk = null; try { wk = await webkit.launch(); } catch (e) { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); }
const erros = [];
const PERFIS = { desktop: { viewport: { width: 1440, height: 900 } }, ipad: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, celular: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } };
const abrir = async (perfil, { motor = edge, wkDevice = false, esquema = 'light', rota = '/', esperar: sel = '[data-painel="para-hoje"] [data-vaga]' } = {}) => {
  const base = wkDevice ? { ...devices['iPhone 13'] } : PERFIS[perfil];
  const ctx = await motor.newContext({ ...base, colorScheme: esquema });
  await ctx.addInitScript((t) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, esquema === 'dark' ? 'escuro' : 'claro');
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForSelector(sel, { timeout: 120000 });
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  const x = pg.locator('.modal-ov button[aria-label="Fechar"]');
  try { await x.first().waitFor({ state: 'visible', timeout: 2500 }); await x.first().click(); } catch { /* não abriu */ }
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await esperar(700);
  return { ctx, pg };
};

/** Arrasto com eventos de ponteiro (toque): vale no Edge e no WebKit. `soltar`: 'nao' deixa o dedo no lugar; 'curto' e 'longo' soltam. Devolve o estado visual no ponto do arrasto. */
const arrastar = (pg, sel, dx, soltar) => pg.evaluate(async ({ sel, dx, soltar }) => {
  const el = document.querySelector(`${sel} .ph-arrasto`), r = el.getBoundingClientRect(), y = r.top + r.height * 0.45, x = r.left + r.width / 2;
  el.setPointerCapture = () => {};
  const ev = (tipo, px) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: px, clientY: y }));
  ev('pointerdown', x);
  const passos = Math.abs(dx) > 100 ? 10 : 8;
  for (let i = 1; i <= passos; i++) { ev('pointermove', x + (dx * i) / passos); await new Promise((r2) => setTimeout(r2, 16)); }
  await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2)));
  const p = el.closest('.ph-pilha');
  const faces = [...p.querySelectorAll('.ph-atras[data-face]')].map((f) => { const c = f.querySelector('.face.front'); return { lado: f.dataset.face, vis: getComputedStyle(f).visibility, op: parseFloat(getComputedStyle(f.querySelector('.vaga')).opacity), titulo: f.querySelector('.assunto')?.textContent.trim(), inert: f.inert, pe: getComputedStyle(f).pointerEvents, cor: c ? ([...c.classList].find((k) => k.startsWith('cat-')) ?? '') : null }; });
  const frente = { titulo: el.querySelector('.assunto')?.textContent.trim(), cor: [...el.querySelector('.face.front').classList].find((k) => k.startsWith('cat-')) ?? '', x: el.getBoundingClientRect().left - r.left };
  const estado = { revela: p.dataset.revela ?? null, prog: parseFloat(p.querySelector('.ph-atras')?.style.getPropertyValue('--prog') || '0'), faces, frente };
  if (soltar !== 'nao') ev('pointerup', x + dx);
  return estado;
}, { sel, dx, soltar });
const topoAtivo = (pg, sel) => pg.$eval(`${sel} .ph-arrasto .assunto`, (e) => e.textContent.trim());
const posicao = (pg, sel) => pg.$eval(`${sel} .ph-posicao`, (e) => e.textContent.trim()).catch(() => null);
const rolagem = (pg) => pg.evaluate(() => document.querySelector('.main').scrollTop);

// ---------- 4) revelar o próximo durante o arrasto ----------
const MOTORES = [['Edge', edge, false], ...(wk ? [['WebKit emulado', wk, true]] : [])];
for (const [nome, motor, wkDev] of MOTORES) for (const esquema of ['light', 'dark']) {
  const R = `${nome}, ${esquema === 'dark' ? 'escuro' : 'claro'}`;
  const { ctx, pg } = await abrir('celular', { motor, wkDevice: wkDev, esquema });
  const NU = '[data-nova-urgencia] .ph-pilha';
  await pg.$eval(NU, (e) => e.scrollIntoView({ block: 'center' })); await esperar(500);
  const total0 = Number(await pg.$eval(NU, (e) => e.dataset.total));
  ok(total0 >= 4, `${R}: a Urgência tem ${total0} cards para a pilha (mais de três)`);
  const t0 = await topoAtivo(pg, NU), st0 = await rolagem(pg);
  // parcial para a esquerda: revela o PRÓXIMO; o card da frente acompanha o dedo e volta ao soltar
  const e1 = await arrastar(pg, NU, -50, 'nao');
  const fe = e1.faces.find((f) => f.lado === 'esq');
  ok(e1.revela === 'esq' && fe && fe.vis === 'visible' && fe.op > 0.9 && !!fe.titulo && fe.titulo !== t0 && e1.frente.x < -40, `${R}: arrastando para a esquerda o card de baixo aparece (${fe?.titulo?.slice(0, 22)}; opacidade ${fe?.op.toFixed(2)})`);
  ok(fe?.cor === (await pg.$eval(`${NU} .ph-atras[data-face="esq"] .face.front`, (e) => [...e.classList].find((k) => k.startsWith('cat-')) ?? '')) && fe?.inert === true && fe?.pe === 'none', `${R}: o card de fundo é só visual (inert, sem clique) e traz a cor do próprio card`);
  await pg.evaluate((sel) => document.querySelector(`${sel} .ph-arrasto`).dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0 })), NU);
  await esperar(500);
  ok((await topoAtivo(pg, NU)) === t0 && (await posicao(pg, NU)) === `1 de ${total0}` && (await pg.$eval(NU, (e) => e.dataset.revela ?? 'nada')) === 'nada', `${R}: soltar um gesto curto devolve o card da frente e a ordem não muda (${await posicao(pg, NU)})`);
  // parcial para a direita: na navegação revela o ÚLTIMO da ordem (o "anterior")
  const e2 = await arrastar(pg, NU, 50, 'nao');
  const fd = e2.faces.find((f) => f.lado === 'dir'), fe2 = e2.faces.find((f) => f.lado === 'esq');
  ok(e2.revela === 'dir' && fd && fd.vis === 'visible' && fd.op > 0.9 && fe2?.vis === 'hidden' && !!fd.titulo && fd.titulo !== t0 && fd.titulo !== fe?.titulo, `${R}: arrastando para a direita aparece o card que voltaria (${fd?.titulo?.slice(0, 22)}), não o da esquerda`);
  await pg.evaluate((sel) => document.querySelector(`${sel} .ph-arrasto`).dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0 })), NU);
  await esperar(500);
  ok((await topoAtivo(pg, NU)) === t0 && (await rolagem(pg)) === st0, `${R}: o gesto curto para a direita também devolve o card, sem a página saltar (rolagem ${st0} e ${await rolagem(pg)})`);
  await pg.screenshot({ path: `${CAPTURAS}/revela-${nome.startsWith('Web') ? 'webkit' : 'edge'}-${esquema}-antes.png` });
  // gesto completo para a esquerda: assume a frente o card que foi revelado
  await arrastar(pg, NU, -220, 'longo');
  await esperar(800);
  ok((await topoAtivo(pg, NU)) === fe.titulo && (await posicao(pg, NU)) === `1 de ${total0}`, `${R}: o gesto completo para a esquerda leva à frente exatamente o card revelado (${(await topoAtivo(pg, NU)).slice(0, 22)})`);
  // gesto completo para a direita: volta o que estava no fim, o mesmo que foi mostrado
  const antes = await topoAtivo(pg, NU);
  const e4 = await arrastar(pg, NU, 220, 'nao');
  const fdd = e4.faces.find((f) => f.lado === 'dir');
  await pg.evaluate((sel) => document.querySelector(`${sel} .ph-arrasto`).dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 9999, clientY: 0 })), NU);
  await esperar(800);
  const depois = await topoAtivo(pg, NU);
  ok(depois === fdd.titulo && depois !== antes, `${R}: o gesto completo para a direita leva à frente exatamente o card que foi mostrado (${depois.slice(0, 22)})`);
  ok((await rolagem(pg)) === st0, `${R}: depois de gestos completos nos dois sentidos a página não saltou (${st0} e ${await rolagem(pg)})`);
  // rolagem vertical por cima do card continua livre e não revela nada
  await pg.evaluate(() => document.querySelector('.main').scrollTo({ top: 0 })); await esperar(200);
  ok((await pg.$eval(NU, (e) => e.dataset.revela ?? 'nada')) === 'nada', `${R}: sem arrasto, nenhuma face de fundo é revelada`);
  // clique e foco nos cards de fundo: nada acontece neles
  const info = await pg.evaluate((sel) => { const f = document.querySelector(`${sel} .ph-atras[data-face="esq"]`), tab = [...f.querySelectorAll('button, [tabindex="0"], a')].map((e) => e.tabIndex); return { inert: f.inert, ocultoAria: f.getAttribute('aria-hidden'), focaveis: tab.length }; }, NU);
  ok(info.inert && info.ocultoAria === 'true', `${R}: o card de fundo fica fora da ordem de foco e escondido dos leitores de tela (inert, aria-hidden)`);
  if (esquema === 'light' || esquema === 'dark') {
    await pg.$eval(NU, (e) => e.scrollIntoView({ block: 'center' })); await esperar(300);
    await arrastar(pg, NU, -60, 'nao'); await esperar(200);
    await pg.screenshot({ path: `${CAPTURAS}/revela-${nome.startsWith('Web') ? 'webkit' : 'edge'}-${esquema}-arrastando.png` });
  }
  await ctx.close();
}

await wk?.close();
parar();
await edge.close();
ok(erros.length === 0, `nenhum erro de console ou de página${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
console.log(`\nCapturas para abrir localmente: ${CAPTURAS}`);
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
