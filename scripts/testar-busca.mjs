// Busca global (lupa e Ctrl+K) e botão "+" (decisão 54) no navegador (Edge) com o banco local de TESTE (PGlite): resultados dos quatro tipos, com e sem acento, por trecho e por número,
// arquivados e convertidos com estado, falha de leitura, abertura a partir de outra tela, teclado, foco, rascunhos, gravação sem duplicidade e o menu "+" em várias telas.
// Computador, iPad e iPhone EMULADOS (não são aparelhos reais), claro e escuro, zoom de 125%. Sobe o próprio servidor na porta 7112. Nunca toca o Supabase real.
// Uso: node scripts/testar-busca.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

const PORTA = process.env.PORTA_TESTE_BUSCA || '7112', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/busca';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });

// ---- semente fictícia ----
const USUARIO = '00000000-0000-4000-8000-000000000001';
const db = await abrirBancoTeste({ pasta: PASTA });
await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
const HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
const dem = (assunto, o = {}) => c('criar_demanda', { p: { assunto, tipo: 'Processo', ...o } });
const d1 = await dem('Revisão do contrato de limpeza', { numero: '1842/2026', descricao: 'Fiscalização do contrato com a empresa vencedora', origem: 'Gabinete' });
await c('adicionar_tarefa', { p_demanda: d1.id, p_texto: 'Conferir certidão negativa' });
const d2 = await dem('Parecer sobre a licitação antiga', { numero: '77/2026', tipo: 'Memorando' });
await c('adicionar_tarefa', { p_demanda: d2.id, p_texto: 'Anexar planilha de custos' });
await c('arquivar_demanda', { p_id: d2.id });
const d3 = await dem('Demanda finalizada de teste', { numero: '300/2026' }); await c('concluir_demanda', { p_id: d3.id });
const e1 = await c('criar_entrada', { p: { titulo: 'Ligar para o Jurídico', texto: 'Combinar a reunião das 14h #tce' } });
const e2 = await c('criar_entrada', { p: { titulo: 'Lista de compras do gabinete', texto: 'café e papel' } }); await c('arquivar_entrada', { p_id: e2.id });
const e3 = await c('criar_entrada', { p: { titulo: 'Ideia de capacitação', texto: 'curso de excel para os servidores' } });
await c('criar_demanda_de_entrada', { p_entrada: e3.id, p: { id: randomUUID(), assunto: 'Capacitação dos servidores', tipo: 'Memorando' } });
const ev = (o) => c('criar_evento', { p: { tipo: 'Reunião', ...o } });
const v1 = await ev({ titulo: 'Reunião de secretariado', data: HOJE, inicio: '09:00', fim: '10:00' });
const v2 = await ev({ titulo: 'Audiência pública de março', tipo: 'Compromisso', data: '2027-03-15', dia_inteiro: true });
const v3 = await ev({ titulo: 'Seminário antigo', tipo: 'Compromisso', data: '2026-01-12', dia_inteiro: true });
await db.close();

const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (cond, m) => { total++; console.log((cond ? 'ok     ' : 'FALHOU ') + m); if (!cond) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const novo = async (opcoes, tema = 'claro') => {
  const ctx = await nav.newContext(opcoes);
  await ctx.addInitScript((t) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, tema);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  return { ctx, pg };
};
const ir = async (pg, rota) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando/.test(document.querySelector('.main')?.innerText ?? ''), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  await pg.waitForTimeout(700);
};
const lupa = '.top .buscabtn';
const abrirBusca = async (pg) => { await pg.click(lupa); await pg.waitForSelector('.busca-box input'); };
const digitar = async (pg, q) => { await pg.fill('.busca-box input', q); await pg.waitForTimeout(250); };
const itens = (pg) => pg.$$eval('.busca-box .res', (l) => l.map((b) => ({ tipo: b.dataset.tipo, titulo: b.querySelector('.res-t')?.textContent ?? '', estado: b.querySelector('.res-estado')?.textContent ?? '', detalhe: b.querySelector('.res-d')?.textContent ?? '' })));
const esperarArquivo = (pg) => pg.waitForFunction(() => !/arquivados\.\.\./.test(document.querySelector('.busca-box')?.innerText ?? '') || !document.querySelector('.busca-box .busca-aviso'), null, { timeout: 15000 });
const buscaFechada = (pg) => pg.waitForFunction(() => !document.querySelector('.busca-ov'), null, { timeout: 5000 });
const foco = (pg) => pg.evaluate(() => { const a = document.activeElement; return a ? (a.className || a.tagName) + '|' + (a.getAttribute('aria-label') ?? '') : ''; });
const janelaTexto = (pg) => pg.evaluate(() => document.querySelector('.modal')?.innerText ?? '');
const fecharJanela = async (pg) => { await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 8000 }); };
const rapido = async (pg, termo) => { await abrirBusca(pg); await digitar(pg, termo); await esperarArquivo(pg); const r = await itens(pg); return r; };
const fechaBusca = async (pg) => { await pg.keyboard.press('Escape'); await buscaFechada(pg); };

// ================= 1) computador, claro =================
const t1 = await novo({ viewport: { width: 1360, height: 900 } });
{
  const { pg } = t1;
  await ir(pg, '/demandas');
  ok(!!(await pg.$(lupa)) && (await pg.getAttribute(lupa, 'aria-disabled')) === null, 'a lupa do topo está ativa (sem aria-disabled)');
  // foco e Esc
  await pg.focus(lupa); await pg.keyboard.press('Enter'); await pg.waitForSelector('.busca-box input');
  ok(/combobox|INPUT/i.test(await pg.evaluate(() => document.activeElement?.getAttribute('role') ?? document.activeElement?.tagName)), 'ao abrir pelo teclado (Enter na lupa), o foco vai ao campo de busca');
  ok((await pg.$eval('.busca-box', (e) => e.getAttribute('aria-modal'))) === 'true', 'a busca é um diálogo modal');
  const vazio = (await pg.textContent('.busca-box .busca-aviso')) ?? '';
  ok(/Digite para buscar/.test(vazio) && (await pg.$$('.busca-box .res')).length === 0, 'consulta vazia: mostra a orientação, sem resultados nem "nenhum resultado"');
  await pg.keyboard.press('Escape'); await buscaFechada(pg);
  ok((await foco(pg)).includes('buscabtn'), 'Esc fecha e o foco volta à lupa');
  // Ctrl+K
  await pg.keyboard.press('Control+k'); await pg.waitForSelector('.busca-box input');
  ok(true, 'Ctrl+K abre a busca');
  await pg.keyboard.press('Control+k'); await pg.waitForTimeout(200);
  ok((await pg.$$('.busca-ov')).length === 1, 'Ctrl+K com a busca aberta não abre outra');
  await fechaBusca(pg);
  // não vale digitando em um campo
  await pg.focus('#fq'); await pg.keyboard.press('Control+k'); await pg.waitForTimeout(250);
  ok((await pg.$$('.busca-ov')).length === 0, 'Ctrl+K digitando em um campo não abre a busca');
  await pg.evaluate(() => document.activeElement?.blur());
  // com janela aberta não vale
  await pg.keyboard.press('n'); await pg.waitForSelector('#e-texto');
  await pg.evaluate(() => document.activeElement?.blur()); await pg.keyboard.press('Control+k'); await pg.waitForTimeout(250);
  ok((await pg.$$('.busca-ov')).length === 0 && !!(await pg.$('.modal')), 'Ctrl+K com uma janela aberta não abre a busca nem tira a janela');
  await fecharJanela(pg);

  // ---- conteúdo: acento, trecho, número ----
  let r = await rapido(pg, 'reuniao');
  ok(r.some((x) => x.tipo === 'evento' && x.titulo === 'Reunião de secretariado') && r.some((x) => x.tipo === 'entrada' && x.titulo === 'Ligar para o Jurídico'), '"reuniao" (sem acento) acha o evento e a entrada com "reunião"');
  await digitar(pg, 'REUNIÃO'); r = await itens(pg);
  ok(r.some((x) => x.tipo === 'evento') && r.some((x) => x.tipo === 'entrada'), '"REUNIÃO" (maiúsculas e acento) acha os mesmos');
  await digitar(pg, '1842'); r = await itens(pg);
  ok(r.length === 1 && r[0].tipo === 'demanda' && /Processo 1842\/2026/.test(r[0].detalhe), 'o número "1842" acha só a demanda, com o tipo e o número no detalhe');
  await digitar(pg, '1842/2026'); r = await itens(pg);
  ok(r.length === 1 && r[0].tipo === 'demanda', 'o número completo "1842/2026" acha a demanda');
  await digitar(pg, 'fiscaliz'); r = await itens(pg);
  ok(r.length === 1 && r[0].tipo === 'demanda', 'um trecho da descrição ("fiscaliz") acha a demanda');
  await digitar(pg, 'certidao negativa'); r = await itens(pg);
  ok(r.length === 1 && r[0].tipo === 'tarefa' && /Da demanda Processo 1842\/2026/.test(r[0].detalhe), 'a tarefa aparece como Tarefa, com a demanda de origem');
  await digitar(pg, 'planilha'); r = await itens(pg);
  ok(r.length === 1 && r[0].tipo === 'tarefa' && r[0].estado === 'Arquivada', 'tarefa de demanda arquivada: aparece com o estado Arquivada');
  await digitar(pg, 'licitacao antiga'); r = await itens(pg);
  ok(r.length === 1 && r[0].tipo === 'demanda' && r[0].estado === 'Arquivada', 'demanda arquivada: aparece com o estado Arquivada');
  await digitar(pg, 'compras'); r = await itens(pg);
  ok(r.length === 1 && r[0].tipo === 'entrada' && r[0].estado === 'Arquivada', 'entrada arquivada: aparece com o estado Arquivada');
  await digitar(pg, 'capacitacao'); r = await itens(pg);
  ok(r.some((x) => x.tipo === 'entrada' && x.estado === 'Convertida em demanda') && r.some((x) => x.tipo === 'demanda' && x.titulo === 'Capacitação dos servidores'), 'entrada convertida aparece com o estado e a demanda criada também');
  await digitar(pg, 'finalizada de teste'); r = await itens(pg);
  ok(r.length === 1 && r[0].estado === 'Finalizada', 'demanda finalizada aparece com o estado Finalizada');
  await digitar(pg, '#tce'); r = await itens(pg);
  ok(r.length === 1 && r[0].tipo === 'entrada', 'a tag "#tce" acha a entrada');
  await digitar(pg, 'audiencia marco'); r = await itens(pg);
  ok(r.length === 1 && r[0].tipo === 'evento' && /15\/03\/2027/.test(r[0].detalhe), 'evento de outro mês e ano: achado, com a data no detalhe');
  await digitar(pg, 'zzzqqq'); r = await itens(pg);
  const semRes = (await pg.textContent('.busca-box .busca-aviso')) ?? '';
  ok(r.length === 0 && /Nenhum resultado para “zzzqqq”/.test(semRes), 'consulta sem resposta: "Nenhum resultado para ...", diferente da consulta vazia');
  await digitar(pg, '   '); ok(/Digite para buscar/.test((await pg.textContent('.busca-box .busca-aviso')) ?? ''), 'só espaços conta como consulta vazia');
  // teclado: setas e Enter
  await digitar(pg, 'reuniao');
  const ids0 = await pg.getAttribute('.busca-box input', 'aria-activedescendant');
  await pg.keyboard.press('ArrowDown');
  const ids1 = await pg.getAttribute('.busca-box input', 'aria-activedescendant');
  ok(!!ids0 && !!ids1 && ids0 !== ids1 && (await pg.$$eval('.busca-box .res[aria-selected="true"]', (l) => l.length)) === 1, 'as setas movem a opção ativa (aria-activedescendant) e só uma fica selecionada');
  await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab');
  ok((await pg.$eval('.busca-box', (b) => b.contains(document.activeElement))), 'o Tab não sai da busca');
  await fechaBusca(pg);

  // ---- abrir resultados a partir de outra tela ----
  // filtro da tela atual não esconde resultados
  await pg.fill('#fq', 'xxxxx'); await pg.waitForTimeout(300);
  r = await rapido(pg, '1842'); ok(r.length === 1, 'o filtro da tela Demandas não esconde resultados da busca');
  await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal');
  ok(/Revisão do contrato de limpeza/.test(await janelaTexto(pg)) && new URL(pg.url()).pathname === '/demandas', 'Enter abre a consulta da demanda sem sair da tela');
  await fecharJanela(pg);
  ok((await foco(pg)).includes('buscabtn'), 'ao fechar a janela aberta pela busca, o foco volta à lupa');
  await pg.fill('#fq', '');
  // demanda arquivada
  r = await rapido(pg, 'licitacao antiga'); await pg.click('.busca-box .res'); await pg.waitForSelector('.modal');
  ok(/Parecer sobre a licitação antiga/.test(await janelaTexto(pg)), 'demanda arquivada abre na consulta');
  await fecharJanela(pg);
  // tarefa abre a demanda de origem
  await rapido(pg, 'certidao'); await pg.click('.busca-box .res'); await pg.waitForSelector('.modal');
  ok(/Revisão do contrato de limpeza/.test(await janelaTexto(pg)) && /certidão negativa/i.test(await janelaTexto(pg)), 'a tarefa abre a demanda de origem, onde ela aparece');
  await fecharJanela(pg);
  // evento fora do período: a partir da Agenda no mês de hoje
  await ir(pg, '/agenda');
  await rapido(pg, 'audiencia publica'); await pg.click('.busca-box .res'); await pg.waitForSelector('#ev-titulo, .modal');
  ok(/Audiência pública de março/.test(await janelaTexto(pg)) && (await pg.$$('.modal')).length === 1, 'evento fora do período exibido da Agenda abre pelo fluxo existente');
  await fecharJanela(pg);
  await rapido(pg, 'seminario antigo'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal');
  ok(/Seminário antigo/.test(await janelaTexto(pg)), 'evento passado abre também');
  await fecharJanela(pg);
  // entradas: ativa, arquivada e convertida, a partir da Agenda
  await rapido(pg, 'ligar juridico'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal [data-leitura]');
  ok(/Ligar para o Jurídico/.test(await janelaTexto(pg)) && !!(await pg.$('.modal [aria-label="Editar a entrada"]')) && new URL(pg.url()).pathname === '/agenda', 'entrada ativa abre na leitura (com o lápis para editar) a partir da Agenda');
  await fecharJanela(pg);
  await rapido(pg, 'lista de compras'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal');
  ok(/Lista de compras do gabinete/.test(await pg.evaluate(() => document.querySelector('.modal')?.innerText + [...document.querySelectorAll('.modal input, .modal textarea')].map((i) => i.value).join(' '))), 'entrada arquivada abre');
  await fecharJanela(pg);
  await rapido(pg, 'ideia de capacitacao'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal');
  const conv = await pg.evaluate(() => document.querySelector('.modal')?.innerText + ' ' + [...document.querySelectorAll('.modal input, .modal textarea')].map((i) => `${i.value}|${i.readOnly || i.disabled}`).join(' '));
  ok(/Ideia de capacitação/.test(conv) && !(await pg.$('.modal [aria-label="Editar a entrada"]')) && !(await pg.$('.modal .btn:has-text("Virar demanda")')), 'entrada convertida abre só para leitura (sem Virar demanda)');
  await fecharJanela(pg);

  // rascunho: edita uma entrada, sai com Esc, a busca a reabre com o rascunho
  await ir(pg, '/entradas');
  await rapido(pg, 'ligar juridico'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal [aria-label="Editar a entrada"]');
  await pg.click('.modal [aria-label="Editar a entrada"]'); await pg.waitForSelector('#e-texto');
  await pg.fill('#e-texto', 'Combinar a reunião das 14h #tce RASCUNHO-BUSCA'); await pg.waitForTimeout(150);
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 8000 }).catch(() => {});
  if (await pg.$('.modal-ov')) { const b = await pg.$('.modal .btn.pri'); await b?.click(); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 8000 }); }
  await rapido(pg, 'ligar juridico'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal');
  if (await pg.$('.modal [aria-label="Editar a entrada"]')) { await pg.click('.modal [aria-label="Editar a entrada"]'); }
  await pg.waitForSelector('#e-texto');
  ok(/RASCUNHO-BUSCA/.test(await pg.inputValue('#e-texto')), 'abrir pela busca uma entrada com rascunho retoma o que foi digitado');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  if (await pg.$('.modal-ov')) { const b = await pg.$('.modal .btn:has-text("Descartar")') ?? await pg.$('.modal .btn.pri'); await b?.click(); await pg.waitForTimeout(500); }

  // ---- falha de leitura ----
  await ir(pg, '/demandas');
  await pg.route('**/*', (rota) => (rota.request().method() === 'POST' && rota.request().headers()['next-action'] ? rota.abort() : rota.continue()));
  await abrirBusca(pg); await digitar(pg, 'reuniao');
  await pg.waitForSelector('.busca-aviso.erro', { timeout: 15000 });
  const erroT = (await pg.textContent('.busca-aviso.erro')) ?? '';
  ok(/arquivados/.test(erroT) && (await pg.getAttribute('.busca-aviso.erro', 'role')) === 'alert', 'falha ao ler os arquivados: aviso com role=alert dizendo que o resultado pode estar incompleto');
  ok((await itens(pg)).some((x) => x.tipo === 'evento'), 'mesmo com a falha, os resultados já carregados continuam à vista');
  await digitar(pg, 'zzzqqq');
  ok(/Nada encontrado no que foi possível ler/.test((await pg.textContent('.busca-box')) ?? '') && !/Nenhum resultado para/.test((await pg.textContent('.busca-box')) ?? ''), 'sem resultado e com falha: não afirma "nenhum resultado", diz que só pôde olhar o que carregou');
  await pg.unroute('**/*'); await fechaBusca(pg);
}

// ================= 2) botão "+": menu, várias telas, cancelar, salvar =================
{
  const { pg } = t1;
  for (const rota of ['/', '/agenda', '/entradas', '/demandas', '/config']) {
    await ir(pg, rota);
    await pg.click('.fab'); await pg.waitForSelector('.menuplus.aberto');
    const nomes = await pg.$$eval('.menuplus [role="menuitem"]', (l) => l.map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(nomes.slice(0, 3).join('|') === 'Nova entrada|Nova demanda|Novo evento' && /Nova tarefa/.test(nomes[3]), `${rota}: o "+" lista Nova entrada, Nova demanda e Novo evento nas três primeiras posições, depois Nova tarefa`);
    const des = await pg.$$eval('.menuplus [role="menuitem"][aria-disabled="true"]', (l) => l.map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(des.length === 2 && /Documento.*em breve/.test(des[0]) && /Chat com a IA.*em breve/.test(des[1]), `${rota}: Documento e Chat estão identificados como "em breve" e desativados`);
    await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.menuplus.aberto'));
    ok((await foco(pg)).includes('fab'), `${rota}: Esc fecha o menu e o foco volta ao botão +`);
  }
  // Nova demanda a partir da Agenda: Esc guarda rascunho, reabrir retoma, Cancelar descarta
  await ir(pg, '/agenda');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Nova demanda")'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'Demanda criada pelo mais'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  if (await pg.$('.confirma-fechar')) { await pg.click('.confirma-fechar .btn.pri'); }
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 8000 });
  ok(new URL(pg.url()).pathname === '/agenda', 'abrir e fechar a janela do "+" preserva a tela de origem');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Nova demanda")'); await pg.waitForSelector('#n-assunto');
  ok((await pg.inputValue('#n-assunto')) === 'Demanda criada pelo mais', 'o rascunho da nova demanda volta ao reabrir pelo "+"');
  await pg.click('.modal .btn:has-text("Cancelar")'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'));
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Nova demanda")'); await pg.waitForSelector('#n-assunto');
  ok((await pg.inputValue('#n-assunto')) === '', 'Cancelar descarta o rascunho');
  // criação sem duplicar: duplo clique no botão do passo 2
  await pg.fill('#n-assunto', 'Demanda unica do mais'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  await pg.dblclick('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 15000 });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  if (await pg.$('.confirma-fechar')) await pg.click('.confirma-fechar .btn.pri');
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 8000 });
  let r = await rapido(pg, 'demanda unica do mais'); ok(r.filter((x) => x.tipo === 'demanda').length === 1, 'Nova demanda pelo "+": gravada uma única vez (duplo clique no passo 2)');
  await fechaBusca(pg);
  // Novo evento a partir de Demandas: cria uma vez, aparece na Agenda
  await ir(pg, '/demandas');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Novo evento")'); await pg.waitForSelector('#ev-titulo');
  await pg.fill('#ev-titulo', 'Evento unico do mais');
  await pg.dblclick('[data-salvar-evento]'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 15000 });
  r = await rapido(pg, 'evento unico do mais'); ok(r.filter((x) => x.tipo === 'evento').length === 1, 'Novo evento pelo "+": gravado uma única vez (duplo clique)');
  await fechaBusca(pg);
  // Nova entrada a partir da Agenda: salva sozinha, uma única vez
  await ir(pg, '/agenda');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Nova entrada")'); await pg.waitForSelector('#e-texto');
  await pg.fill('#e-texto', 'Entrada unica do mais'); await pg.waitForFunction(() => document.querySelector('.modal .estado-entrada')?.getAttribute('data-estado') === 'salvo', null, { timeout: 15000 });
  await fecharJanela(pg);
  r = await rapido(pg, 'entrada unica do mais'); ok(r.filter((x) => x.tipo === 'entrada').length === 1, 'Nova entrada pelo "+": gravada uma única vez');
  await fechaBusca(pg);
  // Nova tarefa, escolhendo a demanda
  await ir(pg, '/entradas');
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Nova tarefa")'); await pg.waitForSelector('#t-dem');
  ok((await pg.$$eval('#t-dem option', (o) => o.length)) >= 2, 'Nova tarefa pede a demanda de destino');
  await pg.selectOption('#t-dem', { index: 0 }); await pg.fill('#t-texto', 'Tarefa unica do mais');
  await pg.dblclick('.modal .btn.pri'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 15000 });
  r = await rapido(pg, 'tarefa unica do mais'); ok(r.filter((x) => x.tipo === 'tarefa').length === 1, 'Nova tarefa pelo "+": gravada uma única vez');
  await fechaBusca(pg);
  // Documento e Chat só avisam
  await pg.click('.fab'); await pg.click('.menuplus [role="menuitem"]:has-text("Documento")', { force: true }); await pg.waitForSelector('#toast.on');
  ok(/Documento ainda não está implementado/.test((await pg.textContent('#toast')) ?? '') && !(await pg.$('.modal-ov')), 'Documento só avisa que está indisponível');
  // atalho N preservado e busca aberta bloqueia o N
  await pg.waitForTimeout(2500); await pg.evaluate(() => document.activeElement?.blur());
  await pg.keyboard.press('Escape'); await pg.keyboard.press('n'); await pg.waitForSelector('#e-texto'); await fecharJanela(pg);
  ok(true, 'o atalho N continua abrindo Nova entrada');
  await abrirBusca(pg); await pg.keyboard.type('nn'); await pg.waitForTimeout(250);
  ok(!(await pg.$('.modal-ov')) && (await pg.inputValue('.busca-box input')) === 'nn', 'digitar "n" no campo da busca não abre Nova entrada');
  await fechaBusca(pg);
}
await t1.ctx.close();

// ================= 3) escuro, zoom 125%, iPad e iPhone emulados =================
const perfis = [
  ['computador escuro', { viewport: { width: 1360, height: 900 } }, 'escuro'],
  ['computador com zoom de 125% (1088 px CSS, densidade 1,25)', { viewport: { width: 1088, height: 720 }, deviceScaleFactor: 1.25 }, 'claro'],
  ['iPad emulado (820x1180, toque)', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, 'claro'],
  ['iPhone emulado (390x844, toque)', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 'escuro'],
];
for (const [nome, opcoes, tema] of perfis) {
  const { ctx, pg } = await novo(opcoes, tema);
  await ir(pg, '/entradas');
  const toque = !!opcoes.hasTouch;
  if (toque) await pg.tap(lupa); else await pg.click(lupa);
  await pg.waitForSelector('.busca-box input');
  const caixa = await pg.$eval(lupa, (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  ok(caixa.w >= 44 && caixa.h >= 44, `${nome}: a lupa mantém o alvo de pelo menos 44 px (${Math.round(caixa.w)}x${Math.round(caixa.h)})`);
  await digitar(pg, 'reuniao'); await esperarArquivo(pg);
  const m = await pg.evaluate(() => {
    const b = document.querySelector('.busca-box').getBoundingClientRect(), o = document.querySelector('.busca-ov').getBoundingClientRect();
    const doc = document.documentElement;
    const cs = getComputedStyle(document.querySelector('.busca-box')), ci = getComputedStyle(document.querySelector('.busca-box input'));
    return { dentro: b.left >= o.left - 1 && b.right <= o.right + 1 && b.bottom <= o.bottom + 1 && b.top >= o.top - 1, rolaX: doc.scrollWidth > doc.clientWidth + 1, campo: parseFloat(ci.fontSize), fundo: cs.backgroundColor, texto: ci.color, tema: document.documentElement.dataset.tema };
  });
  ok(m.dentro && !m.rolaX, `${nome}: a caixa da busca cabe na tela, sem rolagem horizontal da página`);
  if (toque) ok(m.campo >= 16, `${nome}: o campo da busca tem 16 px ou mais (${m.campo}), sem zoom ao focar`);
  const lum = (css) => { const n = css.match(/[\d.]+/g).map(Number); return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]; };
  ok(tema === 'escuro' ? lum(m.fundo) < 90 && lum(m.texto) > 120 : lum(m.fundo) > 150 && lum(m.texto) < 120, `${nome}: tema ${tema}, caixa e texto com fundo e letra de lados opostos`);
  // abrir um resultado nessa largura
  const alvo = pg.locator('.busca-box .res[data-tipo="evento"]').first();
  if (toque) await alvo.tap(); else await alvo.click();
  await pg.waitForSelector('.modal', { timeout: 10000 });
  ok(/Reunião de secretariado/.test(await janelaTexto(pg)) && !(await pg.$('.busca-ov')), `${nome}: tocar/clicar em um resultado fecha a busca e abre o registro`);
  await fecharJanela(pg);
  // "+": barra inferior nas estreitas, flutuante nas largas
  const estreita = opcoes.viewport.width < 900;
  const gatilho = estreita ? '.mais-c' : '.fab';
  const vis = await pg.$eval(gatilho, (e) => e.offsetParent !== null && e.getBoundingClientRect().width >= 44);
  ok(vis, `${nome}: o "+" usa ${estreita ? 'o botão central da barra inferior' : 'o botão flutuante'} (≥ 44 px)`);
  if (toque) await pg.tap(gatilho); else await pg.click(gatilho);
  await pg.waitForSelector('.menuplus.aberto');
  const menu = await pg.$eval('.menuplus', (e) => { const r = e.getBoundingClientRect(), a = document.querySelector('.app').getBoundingClientRect(); return r.left >= a.left - 1 && r.right <= a.right + 1 && r.top >= a.top - 1 && r.bottom <= a.bottom + 1; });
  ok(menu, `${nome}: o menu "+" cabe inteiro na tela`);
  const item = pg.locator('.menuplus [role="menuitem"]:has-text("Novo evento")');
  if (toque) await item.tap(); else await item.click();
  await pg.waitForSelector('#ev-titulo'); await fecharJanela(pg);
  await ctx.close();
}

ok(erros.length === 0, `sem erros de página nem de console (${erros.length})${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
await nav.close(); parar();
console.log(`\n${total - falhas}/${total} verificações passaram`);
process.exit(falhas ? 1 : 0);
