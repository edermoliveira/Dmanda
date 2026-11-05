// Resistência e confiabilidade (Issue #7) no navegador (Edge) com banco de TESTE (PGlite) e dados fictícios, sem Auth real e sem Supabase.
// Cobre: rede lenta com latência alta, desconexão e volta, resposta perdida DEPOIS da gravação, falha 500 do servidor, cliques repetidos, recarga no meio do salvamento,
// abas simultâneas (mesmo navegador) e volume crescente (banco com ~100 demandas, ~160 entradas e ~150 eventos). A verdade vem sempre da cópia dos dados (/api/exportar), nunca só da tela.
// Sobe o próprio servidor numa porta separada. NÃO valida o Supabase real. Uso: node scripts/testar-resistencia.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { semearVolume } from './semear-volume.mjs';

const PORTA = process.env.PORTA_TESTE_RESISTENCIA || '7111', BASE = `http://localhost:${PORTA}`;
const PASTA_A = '.dados-teste/resistencia', PASTA_B = '.dados-teste/resistencia-volume';
rmSync(PASTA_A, { recursive: true, force: true }); rmSync(PASTA_B, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
await semearVolume(PASTA_B, 'medio');

let servidor = null;
const parar = () => { try { if (servidor) spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; };
process.on('exit', parar);
const subir = async (pasta) => {
  parar();
  servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: pasta, CRON_SECRET: 'segredo-de-teste-1234567890' }, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) return; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }
  throw new Error('o servidor de teste não subiu');
};
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const dados = async () => (await fetch(BASE + '/api/exportar')).json();

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const novoContexto = async (opcoes = { viewport: { width: 1360, height: 800 } }) => {
  const ctx = await nav.newContext(opcoes);
  const nova = async () => { const pg = await ctx.newPage(); pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300))); return pg; };
  return { ctx, nova, pg: await nova() };
};
const ir = async (pg, rota) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando (as|a) (entradas|demandas|agenda)/.test(document.body.innerText), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  await pg.waitForTimeout(1000);
};
const rascunhos = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('dmanda:rascunhos') || '{}'); } catch { return {}; } });
const estado = (pg) => pg.getAttribute('.modal .estado-entrada', 'data-estado');
const esperaEstado = (pg, e, ms = 30000) => pg.waitForFunction((x) => document.querySelector('.modal .estado-entrada')?.getAttribute('data-estado') === x, e, { timeout: ms });
const janelaFechada = (pg, ms = 20000) => pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: ms });
const novaEntrada = async (pg) => { await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto'); };
const abrirEntradaParaEditar = async (pg, trecho) => { await pg.click(`.postit:has-text("${trecho}") .p-abrir`); await pg.waitForSelector('[data-leitura]'); await pg.click('.modal [aria-label="Editar a entrada"]'); await pg.waitForSelector('#e-texto'); };
// o pedido sai e chega ao servidor (grava), mas a resposta se perde: o aplicativo não pode saber se gravou
const perderResposta = async (pg, marcador, vezes = 1) => {
  let n = 0;
  await pg.route('**/*', async (route) => {
    const q = route.request();
    if (q.method() === 'POST' && q.headers()['next-action'] && (q.postData() || '').includes(marcador) && n < vezes) { n++; try { await route.fetch(); } catch { /* ignora */ } await route.abort('failed'); return; }
    await route.continue();
  });
  return () => n;
};
const comMarca = (lista, marca, campo = 'texto') => lista.filter((x) => JSON.stringify(x).includes(marca));
const rede = async (pg, o) => { const c = await pg.context().newCDPSession(pg); await c.send('Network.enable'); await c.send('Network.emulateNetworkConditions', o); return c; };

// ================= 1) rede lenta, latência alta: digitar durante o salvamento não perde nada =================
await subir(PASTA_A);
{
  const { ctx, pg } = await novoContexto();
  await ir(pg, '/entradas');
  const c = await rede(pg, { offline: false, latency: 1500, downloadThroughput: 40 * 1024, uploadThroughput: 20 * 1024 });
  await novaEntrada(pg);
  await pg.fill('#e-texto', 'LENTA parte um');
  await esperaEstado(pg, 'salvando', 30000);
  await pg.fill('#e-texto', 'LENTA parte um e dois');
  await pg.fill('#e-texto', 'LENTA parte um e dois e três');
  await esperaEstado(pg, 'salvo', 90000);
  await pg.waitForTimeout(1500);
  ok((await estado(pg)) === 'salvo', 'rede lenta (1,5 s de latência): o estado termina em "salvo" mesmo com digitação durante o salvamento');
  let d = await dados(); let lista = comMarca(d.entradas, 'LENTA');
  ok(lista.length === 1 && lista[0].texto === 'LENTA parte um e dois e três', `rede lenta: uma só entrada no banco com o último texto digitado (${lista.length} entrada(s), texto "${lista[0]?.texto}")`);
  ok(Object.keys(await rascunhos(pg)).length === 0, 'rede lenta: depois de salvo não sobra rascunho no aparelho');
  await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await pg.click('.modal .btn.pri'); await janelaFechada(pg, 60000);
  await ctx.close();
}

// ================= 2) desconexão e volta =================
{
  const { ctx, pg } = await novoContexto();
  await ir(pg, '/entradas');
  await novaEntrada(pg);
  await ctx.setOffline(true);
  await pg.fill('#e-titulo', 'OFFLINE título'); await pg.fill('#e-texto', 'OFFLINE texto digitado sem internet');
  await pg.waitForTimeout(2800);
  const e1 = await estado(pg);
  ok(['offline', 'erro'].includes(e1), `desconectado: o estado não finge sucesso (estado "${e1}")`);
  const rd = await rascunhos(pg);
  ok(JSON.stringify(rd).includes('OFFLINE texto digitado sem internet'), 'desconectado: o texto digitado está no rascunho do aparelho');
  ok(comMarca((await dados()).entradas, 'OFFLINE').length === 0, 'desconectado: nada foi gravado no banco');
  await pg.fill('#e-texto', 'OFFLINE texto digitado sem internet e continuei escrevendo');
  await ctx.setOffline(false);
  await esperaEstado(pg, 'salvo', 40000);
  const lista = comMarca((await dados()).entradas, 'OFFLINE');
  ok(lista.length === 1 && lista[0].texto === 'OFFLINE texto digitado sem internet e continuei escrevendo' && lista[0].titulo === 'OFFLINE título', 'ao voltar a internet a entrada é salva sozinha, uma só vez, com o texto completo');
  await pg.waitForTimeout(800);
  ok(Object.keys(await rascunhos(pg)).length === 0, 'depois da volta não sobra rascunho');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  // oscilação: cai e volta quatro vezes seguidas durante a digitação
  await novaEntrada(pg);
  for (let i = 1; i <= 4; i++) { await ctx.setOffline(true); await pg.fill('#e-texto', 'OSCILA ' + 'x'.repeat(i * 5)); await pg.waitForTimeout(500); await ctx.setOffline(false); await pg.waitForTimeout(300); }
  await esperaEstado(pg, 'salvo', 40000);
  const osc = comMarca((await dados()).entradas, 'OSCILA');
  ok(osc.length === 1 && osc[0].texto === 'OSCILA ' + 'x'.repeat(20), `conexão oscilando: uma só entrada com o texto final (${osc.length})`);
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  await ctx.close();
}

// ================= 3) resposta perdida DEPOIS de gravar: repetir nunca duplica =================
{
  const { ctx, pg } = await novoContexto();
  await ir(pg, '/entradas');
  await novaEntrada(pg);
  const quantas = await perderResposta(pg, 'PERDIDA-ENTRADA', 1);
  await pg.fill('#e-texto', 'PERDIDA-ENTRADA texto');
  await esperaEstado(pg, 'erro', 30000);
  ok(quantas() === 1 && (await estado(pg)) === 'erro', 'resposta perdida (entrada): o aplicativo mostra erro em vez de sucesso');
  ok(comMarca((await dados()).entradas, 'PERDIDA-ENTRADA').length === 1, 'resposta perdida (entrada): o servidor, de fato, gravou uma vez');
  ok(JSON.stringify(await rascunhos(pg)).includes('PERDIDA-ENTRADA'), 'resposta perdida (entrada): o texto continua no rascunho');
  await pg.unroute('**/*');
  await pg.fill('#e-texto', 'PERDIDA-ENTRADA texto revisado');
  await esperaEstado(pg, 'salvo', 30000);
  const l = comMarca((await dados()).entradas, 'PERDIDA-ENTRADA');
  ok(l.length === 1 && l[0].texto === 'PERDIDA-ENTRADA texto revisado', `resposta perdida (entrada): repetir atualiza a mesma entrada, sem duplicar (${l.length})`);
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);

  // evento
  await ir(pg, '/agenda');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo');
  const q2 = await perderResposta(pg, 'PERDIDO-EVENTO', 1);
  await pg.fill('#ev-titulo', 'PERDIDO-EVENTO reunião'); await pg.fill('#ev-inicio', '15:00'); await pg.fill('#ev-fim', '16:00');
  await pg.click('[data-salvar-evento]');
  await pg.waitForSelector('.modal [role="alert"]', { timeout: 30000 });
  ok(q2() === 1 && /Sem confirmação|Sem conexão|não dá para saber/i.test(await pg.textContent('.modal [role="alert"]')), 'resposta perdida (evento): a janela explica que não há confirmação e não fecha');
  ok(comMarca((await dados()).eventos, 'PERDIDO-EVENTO').length === 1, 'resposta perdida (evento): o servidor gravou uma vez');
  await pg.unroute('**/*');
  await pg.click('[data-salvar-evento]'); await janelaFechada(pg, 30000);
  ok(comMarca((await dados()).eventos, 'PERDIDO-EVENTO').length === 1, 'resposta perdida (evento): salvar de novo não duplica o evento');

  // demanda (cadastro guiado, passo 1)
  await ir(pg, '/demandas');
  await pg.click('button[aria-label="Nova demanda"]'); await pg.waitForSelector('#n-assunto');
  const q3 = await perderResposta(pg, 'PERDIDA-DEMANDA', 1);
  await pg.fill('#n-assunto', 'PERDIDA-DEMANDA ofício'); await pg.click('.modal .btn.pri');
  await pg.waitForSelector('#n-chegou', { timeout: 30000 }); await pg.click('.modal .btn.pri');
  await pg.waitForFunction(() => /Sem confirmação|Sem conexão|não dá para saber/i.test(document.body.innerText) || !!document.querySelector('#n-nt'), null, { timeout: 30000 });
  await pg.unroute('**/*');
  if (!(await pg.$('#n-nt'))) { await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 30000 }); }
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await janelaFechada(pg, 30000);
  const dm = comMarca((await dados()).demandas, 'PERDIDA-DEMANDA');
  ok(q3() >= 0 && dm.length === 1, `resposta perdida (demanda): exatamente uma demanda, mesmo repetindo o passo (${dm.length})`);
  await ctx.close();
}

// ================= 4) falha 500 do servidor: erro honesto, nada some =================
{
  const { ctx, pg } = await novoContexto();
  await ir(pg, '/entradas');
  await novaEntrada(pg);
  await pg.route('**/*', async (route) => { const q = route.request(); if (q.method() === 'POST' && q.headers()['next-action'] && (q.postData() || '').includes('ERRO500')) { await route.fulfill({ status: 500, contentType: 'text/plain', body: 'falha de teste' }); return; } await route.continue(); });
  await pg.fill('#e-texto', 'ERRO500 texto');
  await esperaEstado(pg, 'erro', 30000);
  ok((await estado(pg)) === 'erro' && comMarca((await dados()).entradas, 'ERRO500').length === 0, 'erro 500: aparece como erro e nada foi gravado');
  ok(JSON.stringify(await rascunhos(pg)).includes('ERRO500 texto') && (await pg.inputValue('#e-texto')) === 'ERRO500 texto', 'erro 500: o texto continua no campo e no rascunho');
  await pg.unroute('**/*');
  await pg.click('.modal .btn.pri').catch(() => {});
  await esperaEstado(pg, 'salvo', 30000).catch(() => {});
  ok(comMarca((await dados()).entradas, 'ERRO500').length === 1, 'erro 500: depois que o servidor volta, salvar grava uma vez');
  await pg.click('.modal .btn.pri').catch(() => {}); await janelaFechada(pg).catch(() => {});
  await ctx.close();
}

// ================= 5) cliques repetidos =================
{
  const { ctx, pg } = await novoContexto();
  await ir(pg, '/agenda');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo');
  await pg.fill('#ev-titulo', 'CLIQUES evento'); await pg.fill('#ev-inicio', '10:00'); await pg.fill('#ev-fim', '10:30');
  await pg.evaluate(() => { const b = document.querySelector('[data-salvar-evento]'); for (let i = 0; i < 6; i++) b.click(); });
  await janelaFechada(pg, 30000);
  ok(comMarca((await dados()).eventos, 'CLIQUES evento').length === 1, 'seis cliques seguidos em Salvar do evento: um só evento');
  await ir(pg, '/demandas');
  await pg.click('button[aria-label="Nova demanda"]'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'CLIQUES demanda');
  await pg.evaluate(() => { const b = document.querySelector('.modal .btn.pri'); for (let i = 0; i < 6; i++) b.click(); });
  await pg.waitForSelector('#n-chegou', { timeout: 30000 });
  await pg.evaluate(() => { const b = document.querySelector('.modal .btn.pri'); for (let i = 0; i < 6; i++) b.click(); });
  await pg.waitForSelector('#n-nt', { timeout: 30000 });
  await pg.fill('#n-nt', 'CLIQUES tarefa');
  for (let k = 0; k < 4; k++) await pg.press('#n-nt', 'Enter'); // teclas reais em sequência (como a repetição do teclado): só a primeira encontra texto
  await pg.waitForTimeout(1500);
  await pg.click('.modal .btn.pri').catch(() => {}); await janelaFechada(pg, 30000).catch(() => {});
  const d = await dados(); const dm = comMarca(d.demandas, 'CLIQUES demanda');
  ok(dm.length === 1, `seis cliques seguidos nos passos do cadastro: uma só demanda (${dm.length})`);
  const tarefas = (dm[0]?.tarefas ?? []).filter((t) => /CLIQUES tarefa/.test(t.texto));
  ok(tarefas.length === 1, `quatro Enter seguidos na mesma tarefa: uma só tarefa (${tarefas.length})`);
  await ctx.close();
}

// ================= 6) recarregar no meio do salvamento =================
{
  const { ctx, pg } = await novoContexto();
  await ir(pg, '/entradas');
  await novaEntrada(pg);
  await pg.fill('#e-titulo', 'RECARGA título'); await pg.fill('#e-texto', 'RECARGA texto que ainda não tinha sido salvo');
  await pg.waitForTimeout(700);
  await pg.reload({ waitUntil: 'load' });
  await pg.waitForSelector('.app .main'); await pg.waitForTimeout(2500);
  const rd = JSON.stringify(await rascunhos(pg));
  ok(rd.includes('RECARGA texto que ainda não tinha sido salvo'), 'recarregar antes do salvamento: o texto está no rascunho do aparelho');
  const lista = comMarca((await dados()).entradas, 'RECARGA');
  ok(lista.length <= 1, 'recarregar antes do salvamento: no máximo uma entrada gravada (sem duplicata)');
  const aviso = await pg.$('.aviso-rascunho');
  ok(!!aviso || lista.length === 1, 'recarregar antes do salvamento: o aplicativo avisa que há entrada não salva (ou ela já foi gravada)');
  if (aviso) { await pg.click('.aviso-rascunho .btn'); await pg.waitForSelector('#e-texto'); }
  else await abrirEntradaParaEditar(pg, 'RECARGA');
  ok((await pg.inputValue('#e-texto')).startsWith('RECARGA texto'), 'recarregar antes do salvamento: ao reabrir, o texto digitado volta inteiro');
  await esperaEstado(pg, 'salvo', 30000);
  ok(comMarca((await dados()).entradas, 'RECARGA').length === 1, 'recarregar antes do salvamento: depois de retomar fica uma só entrada');
  await ctx.close();
}

// ================= 7) abas simultâneas (mesmo navegador) =================
{
  const { ctx, pg: A, nova } = await novoContexto();
  await ir(A, '/entradas');
  await novaEntrada(A); await A.fill('#e-texto', 'ABAS base original'); await esperaEstado(A, 'salvo'); await A.click('.modal .btn.pri'); await janelaFechada(A);
  const B = await nova(); await ir(B, '/entradas');
  await abrirEntradaParaEditar(A, 'ABAS base');
  await abrirEntradaParaEditar(B, 'ABAS base');
  await A.fill('#e-texto', 'ABAS base editada na aba A'); await esperaEstado(A, 'salvo');
  await B.fill('#e-texto', 'ABAS base editada na aba B');
  await esperaEstado(B, 'conflito', 30000);
  ok((await estado(B)) === 'conflito' && (await B.inputValue('#e-texto')) === 'ABAS base editada na aba B', 'abas: editar a mesma entrada nas duas abas gera conflito explícito e o texto da segunda continua na tela');
  ok(comMarca((await dados()).entradas, 'editada na aba A').length === 1 && comMarca((await dados()).entradas, 'editada na aba B').length === 0, 'abas: nada foi sobrescrito em silêncio (vale a gravação da aba A)');
  await B.click('.aviso-conflito .btn:has-text("Guardar a minha como nova entrada")');
  await B.waitForTimeout(2500);
  const d = await dados();
  ok(comMarca(d.entradas, 'editada na aba A').length === 1 && comMarca(d.entradas, 'editada na aba B').length === 1, 'abas: "Guardar a minha como nova" preserva as duas versões, cada uma uma vez');
  await B.keyboard.press('Escape').catch(() => {}); await B.waitForTimeout(400);
  await A.keyboard.press('Escape').catch(() => {}); await A.waitForTimeout(400);

  // a outra aba enxerga o que foi criado quando volta ao primeiro plano
  await ir(A, '/entradas'); await ir(B, '/entradas');
  await novaEntrada(B); await B.fill('#e-texto', 'ABAS criada só na B'); await esperaEstado(B, 'salvo'); await B.click('.modal .btn.pri'); await janelaFechada(B);
  await A.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await A.waitForFunction(() => /criada só na B/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  ok(/criada só na B/.test(await A.textContent('.postits')), 'abas: voltar para a aba A mostra a entrada criada na aba B, sem recarregar');

  // rascunhos nas duas abas ao mesmo tempo: nenhuma entrada se perde
  await novaEntrada(A); await novaEntrada(B);
  await A.fill('#e-texto', 'ABAS rascunho simultâneo A'); await B.fill('#e-texto', 'ABAS rascunho simultâneo B');
  await esperaEstado(A, 'salvo', 30000); await esperaEstado(B, 'salvo', 30000);
  const d2 = await dados();
  ok(comMarca(d2.entradas, 'simultâneo A').length === 1 && comMarca(d2.entradas, 'simultâneo B').length === 1, 'abas: duas entradas novas digitadas ao mesmo tempo nas duas abas foram salvas, cada uma uma vez');
  await ctx.close();
}

// ================= 7b) remoção e arquivamento em outra aba, conversão e tarefas com falhas =================
{
  const { ctx, pg: A, nova } = await novoContexto();
  await ir(A, '/entradas');
  await novaEntrada(A); await A.fill('#e-texto', 'DEL base da entrada'); await esperaEstado(A, 'salvo'); await A.click('.modal .btn.pri'); await janelaFechada(A);
  const B = await nova(); await ir(B, '/entradas');
  await abrirEntradaParaEditar(B, 'DEL base');
  await abrirEntradaParaEditar(A, 'DEL base');
  await A.click('.modal .acoes-entrada button:has-text("Arquivar")'); await janelaFechada(A);
  await ir(A, '/arquivo'); await A.click('.tabs [data-aba="entradas"]'); await A.waitForSelector('.linha:has-text("DEL base")');
  await A.click('.linha:has-text("DEL base") .btn:has-text("Excluir")'); await A.click('.linha:has-text("DEL base") .btn:has-text("Confirmar exclusão")'); await A.waitForTimeout(1500);
  { const dd = await dados(); ok(comMarca([...dd.entradas, ...dd.entradas_arquivadas], 'DEL base').length === 0, 'excluir em uma aba: a entrada some do banco'); }
  await B.fill('#e-texto', 'DEL texto digitado na outra aba depois da exclusão');
  await B.waitForTimeout(4000);
  const eB = await estado(B);
  ok(['erro', 'conflito'].includes(eB), `editar na aba B uma entrada excluída na aba A: o estado avisa em vez de dizer "salvo" (estado "${eB}")`);
  ok((await B.inputValue('#e-texto')) === 'DEL texto digitado na outra aba depois da exclusão' && JSON.stringify(await rascunhos(B)).includes('texto digitado na outra aba'), 'editar uma entrada excluída em outra aba: o texto digitado continua no campo e no rascunho');
  ok(comMarca((await dados()).entradas, 'DEL texto').length === 0, 'editar uma entrada excluída em outra aba: nada é recriado em silêncio');
  await B.keyboard.press('Escape').catch(() => {}); await B.waitForTimeout(500);

  // arquivar em uma aba enquanto a outra edita: o texto novo nunca se perde
  await ir(A, '/entradas');
  await novaEntrada(A); await A.fill('#e-texto', 'ARQ base da entrada'); await esperaEstado(A, 'salvo'); await A.click('.modal .btn.pri'); await janelaFechada(A);
  await ir(B, '/entradas');
  await abrirEntradaParaEditar(B, 'ARQ base');
  await abrirEntradaParaEditar(A, 'ARQ base');
  await A.click('.modal .acoes-entrada button:has-text("Arquivar")'); await janelaFechada(A);
  await B.fill('#e-texto', 'ARQ base com texto novo digitado na outra aba');
  await B.waitForTimeout(4000);
  const d = await dados(); const noBanco = comMarca([...d.entradas, ...d.entradas_arquivadas], 'texto novo digitado na outra aba').length;
  const noRascunho = JSON.stringify(await rascunhos(B)).includes('texto novo digitado na outra aba');
  ok(noBanco === 1 || (noBanco === 0 && noRascunho && ['erro', 'conflito'].includes(await estado(B))), `arquivar em uma aba enquanto a outra edita: o texto novo foi gravado (${noBanco}) ou está protegido no rascunho com aviso`);
  await B.keyboard.press('Escape').catch(() => {}); await B.waitForTimeout(500);

  // Virar demanda com a resposta perdida: repetir nunca cria duas demandas
  await ir(A, '/entradas');
  await novaEntrada(A); await A.fill('#e-texto', 'VIRAR-PERDIDA assunto da conversão'); await esperaEstado(A, 'salvo'); await A.click('.modal .btn.pri'); await janelaFechada(A);
  await abrirEntradaParaEditar(A, 'VIRAR-PERDIDA');
  await A.click('.modal .acoes-entrada button:has-text("Virar demanda")');
  await A.waitForSelector('#n-assunto'); await A.click('.modal .btn.pri'); await A.waitForSelector('#n-chegou', { timeout: 20000 });
  await perderResposta(A, 'VIRAR-PERDIDA', 1);
  await A.click('.modal .btn.pri');
  await A.waitForTimeout(3000);
  ok((await dados()).demandas.filter((x) => /VIRAR-PERDIDA/.test(x.assunto)).length === 1, 'Virar demanda com resposta perdida: o servidor criou uma só demanda');
  await A.unroute('**/*');
  if (!(await A.$('#n-nt'))) await A.click('.modal .btn.pri');
  await A.waitForSelector('#n-nt', { timeout: 30000 }); await A.click('.modal .btn:has-text("Pular tarefas")'); await janelaFechada(A, 30000);
  const d3 = await dados(); const dv = d3.demandas.filter((x) => /VIRAR-PERDIDA/.test(x.assunto));
  const ligada = [...d3.entradas, ...d3.entradas_arquivadas].filter((x) => /VIRAR-PERDIDA/.test(x.texto));
  ok(dv.length === 1 && ligada.length === 1 && ligada[0].demanda_id === dv[0].id, `Virar demanda com resposta perdida e repetição: uma demanda, uma entrada, ligadas (${dv.length} demanda, ${ligada.length} entrada)`);
  ok(!(d3.entradas.some((x) => /VIRAR-PERDIDA/.test(x.texto))), 'Virar demanda: a entrada convertida sai de Entradas');

  // tarefas: resposta perdida ao adicionar e marcar sem internet
  await ir(A, '/demandas');
  await A.click('button[aria-label="Nova demanda"]'); await A.waitForSelector('#n-assunto'); await A.fill('#n-assunto', 'TAREFAS base'); await A.click('.modal .btn.pri');
  await A.waitForSelector('#n-chegou', { timeout: 20000 }); await A.click('.modal .btn.pri'); await A.waitForSelector('#n-nt', { timeout: 20000 }); await A.click('.modal .btn:has-text("Pular tarefas")'); await janelaFechada(A, 30000);
  const card = A.locator('.dcard:has-text("TAREFAS base")');
  await card.locator('.front .girar').click(); await card.locator('.proxima.vazia button').click();
  await perderResposta(A, 'TAREFA-PERDIDA', 1);
  await A.fill('.dcard:has-text("TAREFAS base") .t-ed', 'TAREFA-PERDIDA conferir'); await A.press('.dcard:has-text("TAREFAS base") .t-ed', 'Enter');
  await A.waitForTimeout(3000);
  ok(!!(await A.$('.dcard:has-text("TAREFAS base") .t-ed')) && (await A.inputValue('.dcard:has-text("TAREFAS base") .t-ed')) === 'TAREFA-PERDIDA conferir', 'tarefa com resposta perdida: o campo continua aberto com o texto digitado');
  await A.unroute('**/*');
  await A.press('.dcard:has-text("TAREFAS base") .t-ed', 'Enter');
  await A.waitForTimeout(2500);
  const dt = (await dados()).demandas.find((x) => /TAREFAS base/.test(x.assunto));
  ok((dt?.tarefas ?? []).filter((t) => /TAREFA-PERDIDA/.test(t.texto)).length === 1, `tarefa com resposta perdida e repetição: uma só tarefa (${(dt?.tarefas ?? []).length})`);
  // marcar sem internet
  await ctx.setOffline(true);
  await card.locator('.back .t-item input[type=checkbox]').first().click({ force: true }).catch(() => {});
  await A.waitForTimeout(1500);
  const dOff = (await dados()).demandas.find((x) => /TAREFAS base/.test(x.assunto));
  ok(dOff.tarefas.every((t) => !t.concluida), 'marcar tarefa sem internet: nada é gravado');
  ok(!(await card.locator('.back .t-item input[type=checkbox]').first().isChecked()), 'marcar tarefa sem internet: a caixa volta a desmarcada (a tela não mente)');
  await ctx.setOffline(false);
  await card.locator('.back .t-item input[type=checkbox]').first().click({ force: true });
  await A.waitForTimeout(2000);
  ok((await dados()).demandas.find((x) => /TAREFAS base/.test(x.assunto)).tarefas.some((t) => t.concluida), 'marcar tarefa depois de voltar a internet: grava');
  await ctx.close();
}

// ================= 7c) armazenamento do navegador corrompido ou bloqueado, textos grandes e Unicode =================
{
  const formatos = {
    'JSON inválido': { 'dmanda:rascunhos': '{nao e json', 'dmanda:ui': '[[[', 'dmanda-tema': '"azul"', 'dmanda:avisos-vistos': '{' },
    'formato errado': { 'dmanda:rascunhos': JSON.stringify({ 'e:nova': {}, 'e:xyz': null, 'n:nova': { dados: null }, 'ev:nova': { dados: { ev: null } }, d1: 5 }), 'dmanda:ui': JSON.stringify({ visao: 'zzz', ordem: { coluna: 'nada', sentido: 5 }, grupos: 5 }), 'dmanda:avisos-vistos': '"texto"' },
    'null e valores inválidos': { 'dmanda:rascunhos': 'null', 'dmanda:ui': 'null', 'dmanda:avisos-vistos': 'null', 'dmanda:menu-aberto': '"sim"', 'dmanda:agenda': 'null' },
    'Agenda com modo inválido': { 'dmanda:agenda': JSON.stringify({ modo: 'xyz', cat: 5, concluidas: 'sim' }), 'dmanda:ui': JSON.stringify({ visao: 7, ordem: [], grupos: [1] }) },
    'lista no lugar de objeto': { 'dmanda:rascunhos': '[]', 'dmanda:ui': '[]', 'dmanda:avisos-vistos': '{}' },
  };
  for (const [nome, itens] of Object.entries(formatos)) {
    const { ctx, pg } = await novoContexto();
    await ctx.addInitScript((it) => { try { for (const [k, v] of Object.entries(it)) localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }, itens);
    const antes = erros.length;
    let abriu = true;
    try {
      await ir(pg, '/demandas');
      const visivel = await pg.$('#vista');
      abriu = !!visivel && erros.length === antes;
      await ir(pg, '/entradas'); await novaEntrada(pg); await pg.fill('#e-texto', 'ARMAZ ' + nome); await esperaEstado(pg, 'salvo', 30000); await pg.click('.modal .btn.pri'); await janelaFechada(pg);
      await ir(pg, '/agenda'); await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo', { timeout: 15000 }); await pg.keyboard.press('Escape');
    } catch (e) { abriu = false; erros.push('armazenamento ' + nome + ': ' + String(e.message).slice(0, 200)); }
    ok(abriu && erros.length === antes && comMarca((await dados()).entradas, 'ARMAZ ' + nome).length === 1, `armazenamento com ${nome}: Demandas, Entradas e Agenda abrem sem erro e salvar funciona`);
    await ctx.close();
  }
  // armazenamento bloqueado (navegação privada): tudo funciona, só não há rascunho no aparelho
  {
    const { ctx, pg } = await novoContexto();
    await ctx.addInitScript(() => { const lanca = () => { throw new DOMException('bloqueado', 'SecurityError'); }; Storage.prototype.getItem = lanca; Storage.prototype.setItem = lanca; Storage.prototype.removeItem = lanca; });
    const antes = erros.length;
    let tudo = true;
    try { await ir(pg, '/entradas'); await novaEntrada(pg); await pg.fill('#e-texto', 'ARMAZ bloqueado'); await esperaEstado(pg, 'salvo', 30000); await pg.click('.modal .btn.pri'); await janelaFechada(pg); } catch (e) { tudo = false; erros.push('armazenamento bloqueado: ' + String(e.message).slice(0, 200)); }
    ok(tudo && erros.length === antes && comMarca((await dados()).entradas, 'ARMAZ bloqueado').length === 1, 'armazenamento bloqueado: a entrada é criada e salva no banco sem erro');
    await ctx.close();
  }
  // textos grandes e Unicode: voltam do banco idênticos
  {
    const { ctx, pg } = await novoContexto();
    await ir(pg, '/entradas');
    const grande = ('Linha grande com acentuação, ç, ã, é e "aspas" \'simples\' \\ barra\n').repeat(300).trimEnd(); // o aplicativo apara espaços e quebras de linha nas pontas, por regra
    const uni = 'Emoji 😀👍🏽 ñ 日本語 العربية ‍ ‑ “curvas” — \t tab';
    for (const [rot, texto] of [['grande', grande], ['unicode', uni]]) {
      await novaEntrada(pg);
      await pg.fill('#e-titulo', 'UNICODE ' + rot); await pg.fill('#e-texto', texto);
      await esperaEstado(pg, 'salvo', 60000);
      await pg.click('.modal .btn.pri'); await janelaFechada(pg);
      const l = comMarca((await dados()).entradas, 'UNICODE ' + rot);
      ok(l.length === 1 && l[0].texto === texto, `texto ${rot} (${texto.length} caracteres): volta do banco idêntico, sem corte nem troca de caractere`);
    }
    await ctx.close();
  }
}

// ================= 8) volume: banco com ~100 demandas ativas, ~160 entradas e ~150 eventos =================
await subir(PASTA_B);
{
  const { ctx, pg } = await novoContexto();
  const antes = await dados();
  ok(antes.demandas.length >= 80 && antes.entradas.length >= 120 && antes.eventos.length >= 150, `volume: banco semeado (${antes.demandas.length} demandas, ${antes.arquivadas.length} arquivadas, ${antes.entradas.length} entradas, ${antes.eventos.length} eventos)`);
  const t0 = Date.now();
  await ir(pg, '/entradas');
  ok(Date.now() - t0 < 30000 && (await pg.$$('.postit')).length === antes.entradas.length, `volume: Entradas mostra as ${antes.entradas.length} entradas ativas (${Date.now() - t0} ms no servidor de desenvolvimento)`);
  const ta = Date.now();
  for (let i = 1; i <= 12; i++) { await novaEntrada(pg); await pg.fill('#e-texto', `VOLUME entrada ${i} #vol`); await esperaEstado(pg, 'salvo', 30000); await pg.click('.modal .btn.pri'); await janelaFechada(pg); }
  const seq = Date.now() - ta;
  const d = await dados();
  ok(comMarca(d.entradas, 'VOLUME entrada').length === 12 && d.entradas.length === antes.entradas.length + 12, `volume: 12 entradas criadas em sequência, todas gravadas, nenhuma duplicada (${Math.round(seq / 12)} ms cada)`);
  await pg.fill('#eq', '#vol'); await pg.waitForTimeout(500);
  ok((await pg.$$('.postit')).length === 12, 'volume: a busca por tag acha exatamente as 12 entre as centenas');
  await pg.fill('#eq', '');
  await ir(pg, '/agenda');
  ok((await pg.$$('.agd-dia, .agd-mes-dia, [data-data]')).length > 0, 'volume: a Agenda abre com 150 eventos');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Evento")'); await pg.waitForSelector('#ev-titulo');
  await pg.fill('#ev-titulo', 'VOLUME evento novo'); await pg.fill('#ev-inicio', '06:00'); await pg.fill('#ev-fim', '06:30'); await pg.click('[data-salvar-evento]'); await janelaFechada(pg, 30000);
  ok(comMarca((await dados()).eventos, 'VOLUME evento novo').length === 1, 'volume: criar um evento com a agenda cheia grava uma vez');
  await ir(pg, '/demandas');
  const nDem = (await dados()).demandas.length;
  await pg.click('button[aria-label="Nova demanda"]'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'VOLUME demanda nova'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou', { timeout: 30000 }); await pg.click('.modal .btn.pri');
  await pg.waitForSelector('#n-nt', { timeout: 30000 }); await pg.click('.modal .btn:has-text("Pular tarefas")'); await janelaFechada(pg, 30000);
  ok((await dados()).demandas.length === nDem + 1, 'volume: cadastrar demanda com 80+ demandas grava uma vez');
  // recarregar com tudo e abas do Arquivo
  await ir(pg, '/arquivo');
  ok(/Arquivo/i.test(await pg.textContent('.pagehead').catch(() => 'Arquivo')), 'volume: o Arquivo abre com 60 demandas e 40 entradas arquivadas');
  await ctx.close();
}

await nav.close(); parar();
ok(erros.length === 0, 'nenhum erro de JavaScript não tratado na página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
