// Teste de ponta a ponta da aplicação funcional, no navegador (Edge), com o banco local de TESTE (PGlite, mesmas migrações do Supabase).
// Sobe o próprio servidor numa porta separada, com uma pasta de dados nova, e no fim lê direto do banco o que foi gravado.
// NÃO valida o Supabase real nem o login Google (ainda sem projeto e credenciais). Uso: node scripts/testar-app.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, readFileSync } from 'node:fs';
import { abrirBancoTeste } from '../src/servidor/banco-teste-base.mjs';

const SEGREDO = 'segredo-de-teste-1234567890';
const PORTA = process.env.PORTA_TESTE || '7103', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/e2e';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: SEGREDO }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };

async function esperarServidor() { for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) return; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); } throw new Error('servidor não subiu'); }
await esperarServidor();

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const ctx = await nav.newContext({ viewport: { width: 1360, height: 780 } });
const pg = await ctx.newPage();
const erros = [];
let falhaProposital = false; // durante o teste de falha de rede os erros de rede são esperados
pg.on('pageerror', (e) => { if (!falhaProposital) erros.push('pageerror em ' + pg.url().replace(BASE, '') + ': ' + e.message.slice(0, 1500)); });
pg.on('console', (m) => { if (m.type() === 'error' && !falhaProposital) erros.push('console em ' + pg.url().replace(BASE, '') + ': ' + m.text().slice(1100, 3200)); });
const ir = async (rota) => { await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 }); await pg.waitForFunction(() => !document.body.innerText.includes('Carregando as demandas'), null, { timeout: 60000 }); await pg.waitForTimeout(400); };
// espera o aviso que combina com o padrão (evita ler um aviso antigo ainda na tela)
const avisoRe = async (re) => pg.waitForFunction((p) => { const t = document.querySelector('#toast'); return t && t.classList.contains('on') && new RegExp(p, 'i').test(t.textContent); }, re.source, { timeout: 8000 }).then(() => true, () => false);
const aviso = async () => { await pg.waitForSelector('#toast.on', { timeout: 8000 }); return pg.textContent('#toast'); };
const assuntos = (sel = '.dcard .assunto') => pg.$$eval(sel, (e) => e.map((x) => x.textContent.trim()));

// 1) estado vazio e cadastro guiado em três passos
const hojeSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const somaDias = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
const passoAtual = () => pg.$$eval('.modal .passos li', (e) => e.findIndex((x) => x.getAttribute('aria-current') === 'step') + 1);
const primario = () => pg.textContent('.modal .m-f .btn.pri');
// cadastra pelo caminho curto (assunto, pular a chegada e o prazo, pular ou concluir as tarefas) e espera a janela fechar
const criarRapido = async (page, assunto, { tipo, tarefas = [] } = {}) => {
  await page.click('button[aria-label="Nova demanda"]'); await page.waitForSelector('#n-assunto');
  if (tipo) await page.click(`.modal .opcoes button:has-text("${tipo}")`);
  await page.fill('#n-assunto', assunto); await page.click('.modal .btn.pri');
  await page.waitForSelector('#n-chegou'); await page.click('.modal .btn.pri');
  await page.waitForSelector('#n-nt');
  if (tarefas.length) { for (const t of tarefas) { await page.fill('#n-nt', t); await page.press('#n-nt', 'Enter'); } await page.click('.modal .btn.pri'); } else await page.click('.modal .btn:has-text("Pular tarefas")');
  await page.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 20000 });
};
await ir('/demandas');
ok(/Nenhuma demanda cadastrada/.test(await pg.textContent('#vista')) && /0 demandas, 0 atrasadas/.test(await pg.textContent('.pagehead')), 'estado vazio honesto (sem dados de exemplo) e contagem zerada');
ok(await pg.waitForSelector('.faixa-teste', { timeout: 8000 }).then(() => true, () => false), 'o banner avisa que é o banco local de teste');
await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('.modal');
ok((await pg.$$eval('.modal .passos li span', (e) => e.map((x) => x.textContent))).join('|') === 'Identificação|Chegada e prazo|Tarefas' && await passoAtual() === 1, 'cadastro guiado: três passos (Identificação, Chegada e prazo, Tarefas), começando no primeiro');
ok((await pg.$$eval('.modal label', (e) => e.map((x) => x.textContent))).some((t) => /Assunto.*obrigatório/.test(t)) && (await pg.$$eval('.modal label', (e) => e.filter((x) => /opcional/.test(x.textContent)).length)) >= 3, 'passo 1: só o assunto é marcado como obrigatório; número, origem e descrição aparecem como opcionais');
await pg.click('.modal .btn.pri'); await pg.waitForTimeout(300);
ok(/Informe o assunto/.test(await pg.textContent('.modal')) && await passoAtual() === 1, 'passo 1: avançar sem assunto mostra a validação e não sai do passo');
await pg.fill('#n-assunto', 'Resposta ao TCE sobre diárias'); await pg.fill('#n-num', '1842/2026'); await pg.fill('#n-origem', 'TCE-RS'); await pg.fill('#n-descricao', 'Texto da descrição da demanda de teste');
await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
ok(await passoAtual() === 2 && (await pg.$$('.dcard')).length === 0, 'passo 1 para o 2 não grava nada: ainda não existe nenhum card');
ok(/Não informada|não informada/.test(await pg.textContent('.modal')) && /sem ela não existe contagem/i.test(await pg.textContent('.modal')), 'passo 2: sem data de chegada, a tela diz que não foi informada e que não há contagem de permanência');
ok(/salva no Dmanda e fica na etapa Cadastro/.test(await pg.textContent('.modal .aviso-passo')) && await primario() === 'Pular e salvar demanda', 'passo 2: o aviso e o botão dizem que a demanda é criada aqui, na etapa Cadastro (com tudo vazio o botão é "Pular e salvar demanda")');
// X no meio do cadastro guarda o rascunho e não cria nada; reabrir recupera
await pg.fill('#n-chegou', '2020-01-02');
await pg.waitForTimeout(700);
await pg.click('.modal [aria-label="Fechar"]'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 5000 });
ok((await pg.$$('.dcard')).length === 0, 'fechar pelo X antes de salvar não cria demanda');
await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('.modal');
ok(!!(await pg.$('.modal .rec')) && await passoAtual() === 2 && (await pg.inputValue('#n-chegou')) === '2020-01-02' && (await pg.click('.modal .btn:has-text("Voltar")'), await pg.waitForSelector('#n-assunto'), await pg.inputValue('#n-assunto')) === 'Resposta ao TCE sobre diárias' && (await pg.click('.modal .btn.pri'), await pg.waitForSelector('#n-chegou'), true), 'o rascunho do cadastro volta no mesmo passo, com tudo o que foi digitado');
// chegada antiga, tipo de prazo e os botões de dias: contam a partir de hoje, nunca da chegada
await pg.click('.modal .opcoes button:has-text("Legal")');
const prazoDoBotao = {};
for (const n of [5, 10, 20, 30]) { await pg.click(`.modal .dias-btns button:has-text("${n} dias")`); prazoDoBotao[n] = await pg.inputValue('#n-prazo'); }
ok([5, 10, 20, 30].every((n) => prazoDoBotao[n] === somaDias(hojeSP, n)) && (await pg.inputValue('#n-chegou')) === '2020-01-02', 'os botões de 5, 10, 20 e 30 dias somam dias corridos a partir de hoje (a chegada, de 2020, não entra na conta)');
ok(/prazo original/i.test(await pg.textContent('.modal .prev-prazo')) && (await pg.getAttribute('.modal .dias-btns button:has-text("30 dias")', 'aria-pressed')) === 'true', 'a prévia mostra o prazo original e o botão escolhido fica marcado');
await pg.fill('#n-prazo', '2026-10-10'); // sábado, e já vencido
ok((await pg.getAttribute('.modal .dias-btns button:has-text("30 dias")', 'aria-pressed')) === 'false' && /antecipado para sex, 09\/10\/2026/.test(await pg.textContent('.modal .prev-prazo')) && /10\/10 sábado/.test(await pg.textContent('.modal .prev-prazo')), 'data digitada num sábado: a prévia antecipa para a sexta e mostra o dia pulado; digitar desmarca o botão de dias');
ok(await primario() === 'Salvar demanda e continuar', 'com chegada e prazo preenchidos o botão passa a "Salvar demanda e continuar"');
// duplo clique: a demanda é criada uma só vez
await pg.dblclick('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 15000 });
ok(await avisoRe(/Demanda criada e salva em Cadastro/) && await passoAtual() === 3, 'passo 2: confirmar cria a demanda, avisa que ela já foi criada e abre o passo de tarefas');
ok((await pg.$$('.dcard')).length === 1 && /Cadastro/.test(await pg.textContent('.dcard .tags .chip')), 'duplo clique em salvar cria um único card, na etapa Cadastro');
// voltar edita o MESMO registro
await pg.click('.modal .btn:has-text("Voltar")'); await pg.waitForSelector('#n-chegou'); await pg.click('.modal .btn:has-text("Voltar")'); await pg.waitForSelector('#n-assunto');
ok((await pg.inputValue('#n-assunto')) === 'Resposta ao TCE sobre diárias' && (await pg.inputValue('#n-num')) === '1842/2026', 'voltar aos passos anteriores mostra o que foi digitado');
await pg.fill('#n-num', '1842/26'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
ok(await primario() === 'Salvar alterações e continuar', 'com a demanda já criada, o botão do passo 2 diz que salva as alterações dela');
await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
ok((await pg.$$('.dcard')).length === 1 && /1842\/26/.test(await pg.textContent('.dcard .tags')), 'voltar e salvar edita a mesma demanda (continua um só card, com o número novo)');
// fechar sem concluir, com tarefas digitadas: escolha clara, rascunho guardado, demanda em Cadastro
await pg.fill('#n-nt', 'Levantar diárias de 2025'); await pg.press('#n-nt', 'Enter'); await pg.fill('#n-nt', 'Conferir com a Contabilidade'); await pg.press('#n-nt', 'Enter');
ok(await primario() === 'Concluir cadastro' && await pg.isEnabled('.modal .m-f .btn.pri'), 'passo 3: com tarefas válidas o botão Concluir cadastro fica habilitado');
await pg.click('.modal [aria-label="Fechar"]'); await pg.waitForSelector('.confirma-fechar');
ok(/ainda sem salvar/.test(await pg.textContent('.confirma-fechar')) && (await pg.$$eval('.confirma-fechar .btn', (b) => b.map((x) => x.textContent))).join('|') === 'Continuar editando|Descartar e fechar|Guardar rascunho e fechar', 'fechar com tarefas não salvas apresenta uma escolha clara (continuar, descartar ou guardar como rascunho)');
await pg.click('.confirma-fechar .btn:has-text("Guardar rascunho")'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 5000 });
await pg.waitForTimeout(400);
ok(/Cadastro/.test(await pg.textContent('.dcard .tags .chip')) && (await pg.evaluate(() => localStorage.getItem('dmanda:rascunhos') ?? '')).includes('Levantar diárias de 2025'), 'fechar sem concluir mantém a demanda em Cadastro e guarda as tarefas como rascunho nela');
await pg.click('.dcard .assunto'); await pg.waitForSelector('.modal .ler');
ok(!!(await pg.$('.modal .rec')) && (await pg.$$eval('.modal .t-campo', (e) => e.map((x) => x.value))).join('|') === 'Levantar diárias de 2025|Conferir com a Contabilidade', 'ao abrir a demanda o rascunho de tarefas é recuperado na seção Tarefas, pronto para salvar');
await pg.click('.modal [data-salvar="tarefas"]'); ok(await avisoRe(/alterações salvas/), 'salvar o rascunho de tarefas grava e avisa só depois do banco');
await pg.waitForTimeout(500);
ok(/Vistos/.test(await pg.textContent('.dcard .tags .chip')), 'ao ganhar a primeira tarefa a demanda sai de Cadastro e vai para Vistos');
await pg.click('.modal .m-f .btn:has-text("Fechar")'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 5000 });
// pular as tarefas mantém em Cadastro; só o assunto é exigido
await criarRapido(pg, 'Revisão do contrato de limpeza', { tipo: 'Memorando' });
const cartaoContrato = pg.locator('.dcard:has-text("Revisão do contrato")');
ok((await cartaoContrato.count()) === 1 && /Cadastro/.test(await cartaoContrato.locator('.tags .chip').textContent()) && /Nenhuma tarefa|0\/0|—/.test(await cartaoContrato.textContent()), 'só o assunto basta: pular chegada, prazo e tarefas cria a demanda em Cadastro, sem número, origem, prazo ou chegada inventados');
ok(!/s\/n|Não informada/.test(await cartaoContrato.textContent()) && (await cartaoContrato.locator('.chips .pz').count()) === 0, 'o card sem número, origem e prazo não mostra "s/n", "Não informada" nem prazo');
// falha de rede na criação: nada de sucesso falso, nada duplicado, o texto fica; repetir cria uma só
falhaProposital = true;
await pg.click('button[aria-label="Nova demanda"]'); await pg.waitForSelector('#n-assunto'); await pg.fill('#n-assunto', 'Falha de rede TESTE'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
await pg.route('**/*', (r) => (r.request().method() === 'POST' && r.request().headers()['next-action'] ? r.abort('failed') : r.continue()));
await pg.click('.modal .btn.pri'); await pg.waitForSelector('#toast.on.erro', { timeout: 20000 }); await pg.waitForTimeout(500);
ok(!/criada e salva/.test(await pg.textContent('#toast')) && await passoAtual() === 2 && (await pg.$$('.dcard:has-text("Falha de rede")')).length === 0 && /Nada foi criado/.test(await pg.textContent('#n-erro')), 'falha de rede ao criar: sem aviso de sucesso, continua no passo 2, nenhum card novo e a mensagem diz que nada foi criado');
await pg.unroute('**/*'); falhaProposital = false;
await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 15000 });
ok((await pg.$$('.dcard:has-text("Falha de rede")')).length === 1, 'repetir depois da falha cria uma única demanda (sem duplicar)');
// falha de rede ao concluir as tarefas: não conclui, não avança a etapa e não mostra conclusão
await pg.fill('#n-nt', 'Tarefa da falha'); await pg.press('#n-nt', 'Enter');
falhaProposital = true;
await pg.route('**/*', (r) => (r.request().method() === 'POST' && r.request().headers()['next-action'] ? r.abort('failed') : r.continue()));
await pg.click('.modal .btn.pri'); await pg.waitForSelector('#toast.on.erro', { timeout: 20000 }); await pg.waitForTimeout(500);
ok(!/concluído/i.test(await pg.textContent('#toast')) && !!(await pg.$('.modal')) && /Cadastro/.test(await pg.locator('.dcard:has-text("Falha de rede") .tags .chip').textContent()) && (await pg.inputValue('.modal .t-campo')) === 'Tarefa da falha', 'falha de rede ao concluir as tarefas: sem mensagem de conclusão, a demanda continua em Cadastro e a tarefa digitada continua na janela');
await pg.unroute('**/*'); falhaProposital = false;
await pg.click('.modal .btn.pri'); ok(await avisoRe(/Cadastro concluído: 1 tarefa salva, a demanda foi para Vistos/), 'repetir depois da falha conclui: tarefa salva e a demanda vai para Vistos');
await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 8000 });
await pg.waitForTimeout(400);
ok(/Vistos/.test(await pg.locator('.dcard:has-text("Falha de rede") .tags .chip').textContent()), 'depois de concluir, o card mostra Vistos');
// limpeza: a demanda criada só para este teste sai (as verificações finais do banco esperam exatamente as duas de antes)
await pg.click('.dcard:has-text("Falha de rede") .girar >> nth=0'); await pg.waitForTimeout(600);
await pg.click('.dcard:has-text("Falha de rede") [aria-label="Arquivar"]'); await aviso(); await pg.waitForTimeout(400);
await ir('/arquivo'); await pg.click('.linha:has-text("Falha de rede") .btn:has-text("Excluir")'); await pg.click('.linha:has-text("Falha de rede") .btn:has-text("Confirmar exclusão")'); await pg.waitForTimeout(600);
await ir('/demandas');
ok((await assuntos()).join() === 'Resposta ao TCE sobre diárias,Revisão do contrato de limpeza' && /2 demandas, 1 atrasada/.test(await pg.textContent('.pagehead')), 'depois do cadastro as duas demandas aparecem em Cards e a contagem do cabeçalho conta a atrasada (vencimento ajustado de 10/10 para 09/10)');
ok((await assuntos()).length === 2, 'depois de recarregar a página as demandas continuam (vieram do banco)');
// a data de hoje chega junto das demandas: nenhum quadro da carga pode mostrar a data provisória (2000-01-01) como se fosse prazo real
await pg.addInitScript(() => { window.__amostras = []; setInterval(() => { window.__amostras.push(document.querySelector('.dcard') ? [...document.querySelectorAll('.dcard .pz, .tempo')].map((e) => e.textContent).join('|') : ''); }, 25); });
await pg.goto(BASE + '/demandas', { waitUntil: 'load' }); await pg.waitForSelector('.dcard'); await pg.waitForTimeout(1500);
const amostras = await pg.evaluate(() => window.__amostras);
ok(amostras.some((x) => x) && !amostras.some((x) => /faltam \d{4,}|há -\d/.test(x)), 'na carga, nenhum quadro mostra prazo calculado com a data provisória (faltam milhares de dias)');

// 2) consulta da demanda e edição pelo lápis, seção por seção
await pg.click('.dcard:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal .ler');
const ler = await pg.textContent('.modal');
ok(/Chegou em.*02\/01\/2020/.test(ler.replace(/\s+/g, ' ')) && /Na Secretaria há\s*\d+ dias/.test(ler) && /Vencimento.*sex, 09\/10\/2026/.test(ler) && /Prazo original.*sáb, 10\/10\/2026/.test(ler) && /Dias pulados: 10\/10 sábado/.test(ler) && /Tipo de prazo.*Legal/.test(ler.replace(/\s+/g, ' ')), 'a consulta mostra a chegada, a permanência desde a chegada, o vencimento ajustado, o prazo original e o motivo do ajuste');
ok((await pg.$$eval('.modal .sec-h h4', (e) => e.map((x) => x.textContent))).join('|') === 'Identificação|Descrição|Chegada e prazo|Andamento|Tarefas' && (await pg.$$('.modal [data-lapis]')).length === 5, 'a consulta tem cinco seções, cada uma com seu lápis, numa única janela');
ok(/Origem.*TCE-RS/.test(ler.replace(/\s+/g, ' ')) && /Texto da descrição da demanda de teste/.test(ler) && /1842\/26/.test(ler) && !(await pg.$('.modal input:not([type=checkbox])')), 'ao abrir, os dados aparecem para leitura (sem campos de edição) e nada reiniciou o questionário');
await pg.click('[data-lapis="tarefas"]');
ok((await pg.getAttribute('[data-lapis="identificacao"]', 'aria-disabled')) === 'true', 'com uma seção em edição, os lápis das outras ficam desativados');
await pg.fill('#m-nt', 'Redigir a resposta'); await pg.press('#m-nt', 'Enter');
await pg.click('.modal .t-item:nth-child(1) input[type=checkbox]');
await pg.fill('.modal .t-item:nth-child(3) .t-campo', 'Redigir a resposta final');
await pg.click('.modal [data-salvar="tarefas"]'); ok(await avisoRe(/alterações salvas/), 'salvar a seção confirma só depois de gravar');
await pg.waitForTimeout(500);
ok((await pg.$$eval('.modal .t-ler li span', (e) => e.map((x) => x.textContent))).join('|') === 'Levantar diárias de 2025|Conferir com a Contabilidade|Redigir a resposta final' && !(await pg.$('[data-secao="tarefas"] .add-t')), 'depois de salvar a seção volta ao modo de leitura, com as tarefas na ordem');
await pg.click('.modal .m-f .btn:has-text("Fechar")'); await pg.waitForTimeout(300);
let card = pg.locator('.dcard:has-text("Resposta ao TCE")');
ok(/1\/3 · 33%/.test(await card.locator('.prog b').textContent()) && /Vistos/.test(await card.locator('.tags .chip').textContent()), 'progresso 1/3 e a demanda segue em Vistos');
await ir('/demandas');
card = pg.locator('.dcard:has-text("Resposta ao TCE")');
ok(/1\/3 · 33%/.test(await card.locator('.prog b').textContent()) && /Vistos/.test(await card.locator('.tags .chip').textContent()) && /Conferir com a Contabilidade/.test(await card.locator('.prox-t').textContent()), 'após recarregar: tarefas, progresso, etapa e a próxima tarefa preservados');
// edição por seção: identificação, chegada e prazo
await pg.click('.dcard:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal .ler');
await pg.click('[data-lapis="identificacao"]'); await pg.fill('#d-origem', 'TCE-RS (Porto Alegre)'); await pg.click('.modal [data-salvar="identificacao"]'); ok(await avisoRe(/Identificação: alterações salvas/), 'editar a identificação pelo lápis grava só essa seção');
await pg.waitForTimeout(500);
ok(/TCE-RS \(Porto Alegre\)/.test(await pg.textContent('[data-secao="identificacao"]')), 'a seção volta à leitura com o valor novo');
await pg.click('[data-lapis="chegada"]');
ok((await pg.inputValue('#d-chegou')) === '2020-01-02' && (await pg.inputValue('#d-prazo')) === '2026-10-10', 'a edição do prazo abre com o prazo ORIGINAL (não com o vencimento ajustado)');
await pg.click('.modal [data-secao="chegada"] .btn:has-text("Sem data")'); await pg.click('.modal [data-secao="chegada"] .btn:has-text("Cancelar")');
ok(/02\/01\/2020/.test(await pg.textContent('[data-secao="chegada"]')), 'Cancelar na seção descarta a alteração (a chegada continua)');
await pg.click('.modal .m-f .btn:has-text("Fechar")'); await pg.waitForTimeout(300);

// 3) marcar e desmarcar pelo card (frente) e pelo verso
await card.locator('.prox-t input').click(); await pg.waitForTimeout(500);
ok(/2\/3 · 67%/.test(await card.locator('.prog b').textContent()), 'marcar a próxima tarefa no card atualiza contador e progresso');
await card.locator('.girar').first().click(); await pg.waitForTimeout(700);
await card.locator('.face.back .t-item:nth-child(1) input').click(); await pg.waitForTimeout(500);
ok(/1\/3 · 33%/.test(await card.locator('.prog b').textContent()), 'desmarcar no verso do card atualiza de novo');
// edição no lugar
await card.locator('.face.back .t-item:nth-child(2) .t-txt').click(); await pg.fill('.face.back .t-ed', 'Conferir com a Contabilidade e o Jurídico'); await pg.press('.face.back .t-ed', 'Enter'); await aviso();
ok(/Contabilidade e o Jurídico/.test(await card.locator('.face.back .tarefas').textContent()), 'editar a tarefa no próprio lugar grava o novo texto');

// 4) quatro visões sobre os mesmos dados
const nomesPorVisao = {};
for (const v of ['quadro', 'tabela', 'lista', 'cards']) {
  await pg.click(`.toolbar .tabs button[data-v="${v}"]`); await pg.waitForTimeout(400);
  nomesPorVisao[v] = await pg.textContent('#vista');
}
ok(['quadro', 'tabela', 'lista', 'cards'].every((v) => /Resposta ao TCE/.test(nomesPorVisao[v]) && /Revisão do contrato/.test(nomesPorVisao[v])), 'as quatro visões mostram as mesmas demandas');
// a cápsula de seleção fica exatamente sobre o item marcado (abas das visões e menu lateral) e se move quando a seleção muda
const sobre = (cont, sel) => pg.evaluate(([c, s]) => { const t = document.querySelector(c + ' > .thumb'), b = document.querySelector(c + ' ' + s); return !!t && !!b && parseFloat(t.style.width) > 0 && Math.abs(parseFloat(t.style.left) - b.offsetLeft) <= 1 && Math.abs(parseFloat(t.style.top) - b.offsetTop) <= 1 && Math.abs(parseFloat(t.style.width) - b.offsetWidth) <= 1; }, [cont, sel]);
ok(await sobre('.tabs', 'button[aria-pressed="true"]') && await sobre('.side', '.navi[aria-current="page"]'), 'a cápsula de seleção está sobre a aba da visão e sobre o item do menu');
await pg.click('.toolbar .tabs button[data-v="tabela"]'); await pg.waitForTimeout(150);
ok(await sobre('.tabs', 'button[aria-pressed="true"]'), 'ao trocar de visão a cápsula acompanha a nova aba');
await pg.click('.toolbar .tabs button[data-v="cards"]'); await pg.waitForTimeout(150);
await pg.click('.toolbar .tabs button[data-v="tabela"]');
ok(/Prazo vencido/.test(await pg.textContent('#vista')) && (await pg.$$('.tabela tr.atrasada')).length === 1, 'a Tabela marca a demanda atrasada');
await pg.click('.tabela th button >> text=Assunto'); await pg.waitForTimeout(200);
const ordem1 = await pg.$$eval('.tabela tbody tr td:nth-child(2)', (e) => e.map((x) => x.textContent.trim()));
await pg.click('.tabela th button >> text=Assunto'); await pg.waitForTimeout(200);
const ordem2 = await pg.$$eval('.tabela tbody tr td:nth-child(2)', (e) => e.map((x) => x.textContent.trim()));
ok(ordem1.length === 2 && ordem1[0] !== ordem2[0] && ordem1[0] === ordem2[1], 'ordenar a Tabela inverte o sentido pelo cabeçalho (' + ordem1[0].slice(0, 12) + ' / ' + ordem2[0].slice(0, 12) + ')');

// preferências do navegador (visão e tema) sobrevivem ao recarregar
await pg.click('.toolbar .tabs button[data-v="lista"]'); await pg.click('.icbtn[aria-label^="Alternar tema"]'); await pg.waitForTimeout(300);
await ir('/demandas');
await pg.waitForFunction(() => document.querySelector('.toolbar .tabs button[aria-pressed="true"]')?.getAttribute('data-v') === 'lista' && document.querySelector('.app')?.getAttribute('data-tema') === 'escuro', null, { timeout: 8000 }).catch(() => {});
ok((await pg.getAttribute('.toolbar .tabs button[aria-pressed="true"]', 'data-v')) === 'lista' && (await pg.getAttribute('.app', 'data-tema')) === 'escuro' && await sobre('.tabs', 'button[aria-pressed="true"]'), 'depois de recarregar a visão Lista e o tema escuro continuam, com a cápsula no lugar');
await pg.click('.toolbar .tabs button[data-v="cards"]'); await pg.click('.icbtn[aria-label^="Alternar tema"]'); await pg.waitForTimeout(300);

// 5) mover etapa pelo menu e pelo arraste (Quadro) com a mesma lógica
await pg.click('.toolbar .tabs button[data-v="quadro"]'); await pg.waitForTimeout(400);
await pg.click('.mini-card:has-text("Revisão do contrato") .mais'); await pg.waitForSelector('.mv-menu');
ok((await pg.$$eval('.mv-menu button', (b) => b.map((x) => x.textContent.trim()))).map((x) => x.replace(/atual$/, '')).join('|') === 'Cadastro|Vistos|Fazendo|Aguardando retorno|Finalizado', 'o menu Mover para mostra as cinco etapas');
await pg.click('.mv-menu button:has-text("Fazendo")'); await aviso(); await pg.waitForTimeout(400);
ok(await pg.locator('.coluna[aria-label="Fazendo"] .mini-card:has-text("Revisão do contrato")').count() === 1, 'mover pelo menu leva a demanda para a coluna Fazendo');
const alvo = pg.locator('.mini-card:has-text("Resposta ao TCE") .assunto'), origem = await alvo.boundingBox();
const col = await pg.locator('.coluna[aria-label="Aguardando retorno"] header').boundingBox();
await pg.mouse.move(origem.x + 20, origem.y + 8); await pg.mouse.down(); await pg.mouse.move(origem.x + 40, origem.y + 20, { steps: 3 }); await pg.mouse.move(col.x + col.width / 2, col.y + 80, { steps: 12 }); await pg.waitForTimeout(500); await pg.mouse.up(); await aviso(); await pg.waitForTimeout(400);
const ar = pg.locator('.coluna[aria-label="Aguardando retorno"] .mini-card:has-text("Resposta ao TCE")');
ok(await ar.count() === 1 && !(await ar.textContent()).includes('undefined'), 'arrastar para Aguardando retorno move a demanda, sem inventar setor nem data');
await ir('/demandas'); await pg.click('.toolbar .tabs button[data-v="quadro"]'); await pg.waitForTimeout(400);
ok(await pg.locator('.coluna[aria-label="Aguardando retorno"] .mini-card:has-text("Resposta ao TCE")').count() === 1 && await pg.locator('.coluna[aria-label="Fazendo"] .mini-card:has-text("Revisão do contrato")').count() === 1, 'as etapas continuam depois de recarregar');

// 6) concluir, reabrir pelo menu e pela janela
await pg.click('.mini-card:has-text("Revisão do contrato") .mais'); await pg.click('.mv-menu button:has-text("Finalizado")'); ok(await avisoRe(/finalizada/), 'concluir pelo menu avisa que a demanda foi finalizada');
await pg.waitForTimeout(400);
ok(await pg.locator('.coluna[aria-label="Finalizado"] .mini-card:has-text("Revisão do contrato")').count() === 1, 'a demanda concluída vai para Finalizado');
await pg.click('.mini-card:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal'); await pg.click('.modal .btn:has-text("Concluir demanda")'); await aviso(); await pg.waitForTimeout(500);
const fin = pg.locator('.coluna[aria-label="Finalizado"] .mini-card:has-text("Resposta ao TCE")');
ok(await fin.count() === 1 && /3\/3 · 100%/.test(await fin.locator('.prog b').textContent()), 'Concluir pela janela marca todas as tarefas (3/3 · 100%)');
await fin.locator('.btn:has-text("Reabrir demanda")').click(); await aviso(); await pg.waitForTimeout(500);
const reab = pg.locator('.coluna[aria-label="Fazendo"] .mini-card:has-text("Resposta ao TCE")');
ok(await reab.count() === 1 && /3\/3 · 100%/.test(await reab.locator('.prog b').textContent()), 'Reabrir volta para Fazendo mantendo as tarefas cumpridas');

// 7) cancelar, Esc (rascunho) e validações da edição por seção
await pg.click('.mini-card:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal .ler');
await pg.click('[data-lapis="identificacao"]'); await pg.fill('#d-assunto', 'ALTERAÇÃO CANCELADA'); await pg.click('.modal [data-secao="identificacao"] .btn:has-text("Cancelar")'); await pg.click('.modal .m-f .btn:has-text("Fechar")'); await pg.waitForTimeout(300);
ok(!(await pg.textContent('#vista')).includes('ALTERAÇÃO CANCELADA') && !(await pg.evaluate(() => localStorage.getItem('dmanda:rascunhos') ?? '')).includes('ALTERAÇÃO CANCELADA'), 'Cancelar descarta a alteração (nem rascunho fica)');
await pg.click('.mini-card:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal .ler'); await pg.click('[data-lapis="identificacao"]'); await pg.fill('#d-assunto', 'Rascunho guardado com Esc'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.click('.mini-card:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal .ler');
ok((await pg.inputValue('#d-assunto')) === 'Rascunho guardado com Esc' && !!(await pg.$('.modal .rec')), 'Esc guarda o rascunho e a próxima abertura o recupera, com a seção já aberta');
await pg.fill('#d-assunto', '   '); await pg.click('.modal [data-salvar="identificacao"]');
ok(/assunto não pode ficar vazio/i.test(await pg.textContent('[data-secao="identificacao"]')) && !!(await pg.$('.modal')), 'salvar com assunto vazio é recusado e a seção continua aberta');
await pg.click('.modal [data-secao="identificacao"] .btn:has-text("Cancelar")'); await pg.click('.modal .m-f .btn:has-text("Fechar")'); await pg.waitForTimeout(300);
// teclado: o Tab não sai da janela, o Esc devolve o foco a quem a abriu e "/" foca o filtro
await pg.focus('.mini-card:has-text("Resposta ao TCE") .assunto'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.modal');
let saiuDaJanela = false;
for (let i = 0; i < 60 && !saiuDaJanela; i++) { await pg.keyboard.press('Tab'); saiuDaJanela = !(await pg.evaluate(() => !!document.activeElement?.closest('.modal'))); }
for (let i = 0; i < 5 && !saiuDaJanela; i++) { await pg.keyboard.press('Shift+Tab'); saiuDaJanela = !(await pg.evaluate(() => !!document.activeElement?.closest('.modal'))); }
ok(!saiuDaJanela, 'o Tab e o Shift+Tab circulam dentro da janela aberta (o foco não vai para o fundo)');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
ok(await pg.evaluate(() => !!document.activeElement?.closest('.mini-card')), 'ao fechar a janela com Esc o foco volta ao card que a abriu');
await pg.keyboard.press('/'); await pg.waitForTimeout(150);
ok((await pg.evaluate(() => document.activeElement?.id)) === 'fq', 'a tecla "/" leva o foco ao filtro de demandas');
await pg.keyboard.press('/'); ok((await pg.inputValue('#fq')) === '/', 'com o foco no filtro, a barra é escrita normalmente (o atalho não atrapalha a digitação)'); await pg.fill('#fq', '');

// 8) falha de gravação: a interface não pode mostrar sucesso
falhaProposital = true;
await pg.route('**/*', (r) => (r.request().method() === 'POST' && r.request().headers()['next-action'] ? r.abort('failed') : r.continue()));
await pg.click('.mini-card:has-text("Revisão do contrato") .assunto'); await pg.waitForSelector('.modal .ler');
await pg.click('[data-lapis="identificacao"]'); await pg.fill('#d-assunto', 'Não deve gravar'); await pg.click('.modal [data-salvar="identificacao"]'); await pg.waitForTimeout(1500);
const t = await pg.textContent('#toast');
ok(!/salvas/.test(t) && !!(await pg.$('#toast.erro')) && !!(await pg.$('.modal')) && (await pg.inputValue('#d-assunto')) === 'Não deve gravar', 'falha de rede ao salvar: erro à vista, sem aviso de sucesso e a seção fica aberta com o texto');
await pg.unroute('**/*'); falhaProposital = false; await pg.click('.modal [data-secao="identificacao"] .btn:has-text("Cancelar")'); await pg.click('.modal .m-f .btn:has-text("Fechar")'); await pg.waitForTimeout(300);
await ir('/demandas'); await pg.click('.toolbar .tabs button[data-v="tabela"]');
ok(!(await pg.textContent('#vista')).includes('Não deve gravar'), 'depois da falha nada foi gravado no banco');

// 8b) prazos e calendário: o vencimento ajustado vale em todas as visões e é recalculado ao cadastrar, alterar e excluir dias indisponíveis
await ir('/demandas'); await pg.click('.toolbar .tabs button[data-v="cards"]');
await pg.click('button[aria-label="Nova demanda"]'); await pg.waitForSelector('#n-assunto'); await pg.fill('#n-assunto', 'Prazo TESTE'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-prazo');
await pg.fill('#n-prazo', '2027-03-06'); // sábado
ok(/sex, 05\/03\/2027/.test(await pg.textContent('.modal .prev-prazo')), 'prévia no cadastro: sábado 06/03 será antecipado para sexta 05/03');
await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt'); await pg.click('.modal .btn:has-text("Pular tarefas")'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 8000 });
const chipDe = () => pg.locator('.dcard:has-text("Prazo TESTE") .pz').first().textContent();
ok(/5 mar/.test(await chipDe()), 'o card mostra o vencimento ajustado (5 mar), não o prazo original');
await ir('/config');
ok(/Dias indisponíveis/.test(await pg.textContent('.main')) && /Nenhum dia cadastrado/.test(await pg.textContent('.main')), 'Configurações: o cadastro de dias indisponíveis começa vazio (nada de feriado presumido)');
await pg.click('#cfg-data'); await pg.click('.cfg-form .btn.pri'); await pg.waitForTimeout(200);
ok(/Informe a data/.test(await pg.textContent('.cfg-form')), 'dia indisponível: data é obrigatória');
await pg.fill('#cfg-data', '2027-03-05'); await pg.click('.cfg-form .btn.pri'); await pg.waitForTimeout(200);
ok(/Descreva o dia/.test(await pg.textContent('.cfg-form')), 'dia indisponível: descrição é obrigatória');
await pg.fill('#cfg-desc', 'Feriado de teste'); await pg.click('.cfg-form .btn.pri');
ok(await avisoRe(/Dia cadastrado\. 1 vencimento foi recalculado/), 'cadastrar um feriado avisa quantos vencimentos foram recalculados');
await pg.waitForTimeout(400);
ok(/sex, 05\/03\/2027/.test(await pg.textContent('.cfg-lista')) && /Feriado de teste/.test(await pg.textContent('.cfg-lista')), 'o dia aparece na lista, com data e dia da semana');
await ir('/config');
ok(/Feriado de teste/.test(await pg.textContent('.cfg-lista')), 'depois de recarregar o dia continua (está no banco)');
await ir('/demandas');
const emTodasAsVisoes = async (re) => { const r = {}; for (const v of ['cards', 'quadro', 'tabela', 'lista']) { await pg.click(`.toolbar .tabs button[data-v="${v}"]`); await pg.waitForTimeout(300); r[v] = re.test(await pg.textContent('#vista')); } await pg.click('.toolbar .tabs button[data-v="cards"]'); return Object.entries(r).filter(([, x]) => !x).map(([v]) => v); };
await pg.click('.toolbar .tabs button[data-v="cards"]'); await pg.waitForSelector('.dcard');
ok(/4 mar/.test(await chipDe()), 'com a sexta indisponível o vencimento recua para quinta (4 mar), recalculado no servidor');
const faltam = await emTodasAsVisoes(/4 mar/);
ok(faltam.length === 0, 'Cards, Quadro, Tabela e Lista mostram o mesmo vencimento ajustado' + (faltam.length ? ' (faltou em ' + faltam.join(', ') + ')' : ''));
await pg.click('.dcard:has-text("Prazo TESTE") .assunto'); await pg.waitForSelector('.modal .ler');
ok(/Dias pulados: 06\/03 sábado; 05\/03 feriado: Feriado de teste/.test(await pg.textContent('[data-secao="chegada"]')) && /qui, 04\/03\/2027/.test(await pg.textContent('[data-secao="chegada"]')) && /sáb, 06\/03\/2027/.test(await pg.textContent('[data-secao="chegada"]')), 'a consulta explica o ajuste: original sábado, vencimento quinta, dias pulados com o motivo');
await pg.click('.modal .m-f .btn:has-text("Fechar")');
// alterar a data do feriado devolve a sexta; evento externo no mesmo dia recua de novo; excluir devolve
await ir('/config'); await pg.click('[aria-label="Editar Feriado de teste"]'); await pg.fill('#cfg-data', '2027-03-12'); await pg.click('.cfg-form .btn.pri');
ok(await avisoRe(/Dia alterado\. 1 vencimento foi recalculado/), 'alterar a data do feriado recalcula os vencimentos');
await pg.waitForTimeout(400); await ir('/demandas');
ok(/5 mar/.test(await chipDe()), 'o feriado saiu da sexta: o vencimento volta para 5 mar');
await ir('/config'); await pg.fill('#cfg-data', '2027-03-05'); await pg.selectOption('#cfg-cat', 'Evento externo'); await pg.fill('#cfg-desc', 'Congresso'); await pg.click('.cfg-form .btn.pri');
ok(await avisoRe(/Dia cadastrado\. 1 vencimento foi recalculado/), 'evento externo de dia inteiro também recalcula');
await pg.waitForTimeout(400); await ir('/demandas');
ok(/4 mar/.test(await chipDe()), 'evento externo na sexta: vencimento em 4 mar');
await ir('/config'); await pg.click('[aria-label="Excluir Congresso"]'); await pg.click('.cfg-lista .btn:has-text("Confirmar exclusão")');
ok(await avisoRe(/Dia excluído\. 1 vencimento foi recalculado/), 'excluir o evento recalcula de volta');
await pg.waitForTimeout(400); await ir('/demandas');
ok(/5 mar/.test(await chipDe()), 'sem o evento, o vencimento volta para 5 mar');
await ir('/config'); await pg.click('[aria-label="Excluir Feriado de teste"]'); await pg.click('.cfg-lista .btn:has-text("Confirmar exclusão")');
ok(await avisoRe(/Dia excluído\. Nenhum vencimento precisou mudar/), 'excluir um dia que não afeta nenhum prazo diz que nada mudou');
await pg.waitForTimeout(400);
ok(/Nenhum dia cadastrado/.test(await pg.textContent('.main')), 'a lista fica vazia depois de excluir os dias');
// limpeza da demanda do teste
await ir('/demandas');
await pg.click('.dcard:has-text("Prazo TESTE") .girar >> nth=0'); await pg.waitForTimeout(600);
await pg.click('.dcard:has-text("Prazo TESTE") [aria-label="Arquivar"]'); await aviso(); await pg.waitForTimeout(400);
await ir('/arquivo'); await pg.click('.linha:has-text("Prazo TESTE") .btn:has-text("Excluir")'); await pg.click('.linha:has-text("Prazo TESTE") .btn:has-text("Confirmar exclusão")'); await pg.waitForTimeout(600);
await ir('/demandas');

// 9) filtros, arquivar, desarquivar e excluir
await pg.click('.toolbar .tabs button[data-v="cards"]'); await pg.fill('#fq', 'contrato'); await pg.waitForTimeout(300);
ok((await assuntos()).join() === 'Revisão do contrato de limpeza', 'o filtro por texto mostra só a demanda que combina');
await pg.fill('#fq', ''); await pg.click('.toolbar .btn[aria-label^="Só atrasadas"]'); await pg.waitForTimeout(300);
ok((await assuntos()).join() === 'Resposta ao TCE sobre diárias', '"Só atrasadas" mostra só a demanda de prazo vencido');
await pg.click('.toolbar .btn[aria-label^="Só atrasadas"]');
await pg.click('[data-filtros]'); await pg.selectOption('#f-tipo', 'Memorando'); await pg.waitForTimeout(300);
ok((await assuntos()).join() === 'Revisão do contrato de limpeza', 'o filtro por tipo funciona'); await pg.selectOption('#f-tipo', ''); await pg.keyboard.press('Escape');
await pg.click('.dcard:has-text("Revisão do contrato") .girar >> nth=0'); await pg.waitForTimeout(600);
await pg.click('.dcard:has-text("Revisão do contrato") [aria-label="Arquivar"]'); ok(await avisoRe(/arquivada/), 'arquivar avisa e tira a demanda da lista');
await pg.waitForTimeout(400); ok((await assuntos()).join() === 'Resposta ao TCE sobre diárias', 'a demanda arquivada some das visões');
await ir('/arquivo');
ok(/Revisão do contrato/.test(await pg.textContent('.main')), 'o Arquivo mostra a demanda arquivada (veio do banco)');
await pg.click('.linha .btn:has-text("Excluir")'); ok(/Excluir de vez/.test(await pg.textContent('.main')), 'excluir pede confirmação na própria linha');
await pg.click('.linha .btn:has-text("Cancelar")');
await pg.click('.linha .btn:has-text("Desarquivar")'); await aviso(); await pg.waitForTimeout(400);
await ir('/demandas'); ok((await assuntos()).length === 2, 'desarquivar devolve a demanda às visões');

// 10) Início: resumos ligados aos mesmos dados
await ir('/');
await pg.waitForFunction(() => [...document.querySelectorAll('.stat .n')].map((x) => x.textContent).join() === '1,0,0', null, { timeout: 8000 }).catch(() => {});
ok(/Atrasadas/.test(await pg.textContent('.stats')) && (await pg.$$eval('.stat .n', (e) => e.map((x) => x.textContent))).join() === '1,0,0' && /Resposta ao TCE/.test(await pg.textContent('.main')), 'o Início conta 1 atrasada e mostra a demanda no Foco do dia');

// 11) celular e iPad, claro e escuro (a mesma operação funciona e nada fica cortado)
for (const [w, h, rotulo] of [[390, 800, 'celular'], [820, 1000, 'iPad vertical'], [1180, 780, 'iPad horizontal'], [1000, 780, 'janela média']]) {
  await pg.setViewportSize({ width: w, height: h });
  for (const modo of ['claro', 'escuro']) {
    await ir('/demandas'); if ((await pg.getAttribute('.app', 'data-tema')) !== modo) { await pg.click('.icbtn[aria-label^="Alternar tema"]'); await pg.waitForTimeout(300); }
    await pg.click('.toolbar .tabs button[data-v="cards"]'); await pg.waitForTimeout(400);
    const larg = await pg.evaluate(() => ({ main: document.querySelector('.main').scrollWidth <= document.querySelector('.main').clientWidth + 1, cards: document.querySelectorAll('.dcard').length }));
    await pg.click('.dcard .assunto >> nth=0'); await pg.waitForSelector('.modal .ler');
    const jan = await pg.evaluate(() => { const m = document.querySelector('.modal'), f = document.querySelector('.m-f').getBoundingClientRect(), r = m.getBoundingClientRect(); return { lateral: m.scrollWidth > m.clientWidth + 1, rodape: f.bottom <= r.bottom + 1 && f.height > 0 }; });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
    ok(larg.main && larg.cards === 2 && !jan.lateral && jan.rodape, `${rotulo}, ${modo}: página sem rolagem lateral, 2 cards, janela de edição sem corte e com o rodapé à vista`);
  }
}
await pg.setViewportSize({ width: 1360, height: 780 });
// 11b2) dois aparelhos: o que outro aparelho grava aparece ao voltar para a tela (sem recarregar), mas não mexe numa janela aberta
{
  await ir('/demandas');
  const outro = await ctx.newPage();
  await outro.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 120000 });
  await outro.waitForSelector('.app .main'); await outro.waitForFunction(() => !document.body.innerText.includes('Carregando as demandas'), null, { timeout: 60000 });
  await criarRapido(outro, 'Criada no outro aparelho');
  await outro.close();
  const volta = () => pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pg.click('button[aria-label="Nova demanda"]'); await pg.waitForSelector('#n-assunto');
  await volta(); await pg.waitForTimeout(1500);
  const comJanela = (await pg.locator('.dcard, .mini-card, tr, .linha').filter({ hasText: 'Criada no outro aparelho' }).count()) > 0;
  await pg.click('.modal .btn:has-text("Cancelar")'); await pg.waitForTimeout(300);
  await volta();
  const apareceu = await pg.waitForFunction(() => document.body.innerText.includes('Criada no outro aparelho'), null, { timeout: 10000 }).then(() => true, () => false);
  ok(!comJanela && apareceu, 'dois aparelhos: com a janela aberta a lista não muda; ao voltar para a tela (sem janela) aparece o que outro aparelho gravou, sem recarregar');
  // limpeza: arquiva e exclui a demanda criada só para este teste (as verificações finais do banco esperam exatamente as duas de antes)
  await pg.click('.dcard:has-text("Criada no outro aparelho") .girar >> nth=0'); await pg.waitForTimeout(600);
  await pg.click('.dcard:has-text("Criada no outro aparelho") [aria-label="Arquivar"]'); await aviso(); await pg.waitForTimeout(400);
  await ir('/arquivo');
  await pg.click('.linha:has-text("Criada no outro aparelho") .btn:has-text("Excluir")'); await pg.click('.linha:has-text("Criada no outro aparelho") .btn:has-text("Confirmar exclusão")'); await pg.waitForTimeout(600);
  await ir('/demandas');
}
// 11b3) edição simultânea: a edição aberta num aparelho fica desatualizada quando outro aparelho grava. Salvar é recusado por inteiro, a edição local continua na tela
// com um aviso que não some, e a tarefa criada no outro aparelho permanece (antes, salvar a janela antiga a apagava sem aviso)
{
  await ir('/demandas');
  await criarRapido(pg, 'Conflito TESTE');
  // aparelho 1 abre a seção de tarefas e digita, sem salvar
  await pg.click('.dcard:has-text("Conflito TESTE") .assunto'); await pg.waitForSelector('.modal .ler');
  await pg.click('[data-lapis="tarefas"]'); await pg.fill('#m-nt', 'tarefa do aparelho 1'); await pg.press('#m-nt', 'Enter');
  ok(!(await pg.$('#m-conflito')), 'edição simultânea: com a demanda ainda na versão aberta não há aviso de conflito');
  // aparelho 2 abre a mesma demanda e grava uma tarefa (contexto próprio: outro aparelho não compartilha o armazenamento do navegador, nem os rascunhos do aparelho 1)
  const outroCtx = await nav.newContext({ viewport: { width: 1360, height: 780 } });
  const outro = await outroCtx.newPage();
  await outro.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 120000 });
  await outro.waitForSelector('.app .main'); await outro.waitForFunction(() => !document.body.innerText.includes('Carregando as demandas'), null, { timeout: 60000 });
  await outro.click('.dcard:has-text("Conflito TESTE") .assunto'); await outro.waitForSelector('.modal .ler');
  await outro.click('[data-lapis="tarefas"]'); await outro.fill('#m-nt', 'criada no outro aparelho'); await outro.press('#m-nt', 'Enter');
  await outro.click('.modal [data-salvar="tarefas"]'); await outro.waitForSelector('#toast.on');
  await outroCtx.close();
  // aparelho 1 tenta salvar a edição antiga
  await pg.click('.modal [data-salvar="tarefas"]');
  const recusado = await avisoRe(/alterada em outro aparelho/);
  const aviso1 = await pg.waitForSelector('#m-conflito', { timeout: 8000 }).then(() => true, () => false);
  const textoAviso = aviso1 ? await pg.textContent('#m-conflito') : '';
  const mantido = (await pg.$$eval('.t-campo', (e) => e.map((x) => x.value))).includes('tarefa do aparelho 1');
  const bloqueado = await pg.isDisabled('.modal [data-salvar="tarefas"]');
  ok(recusado && aviso1 && /Nada foi gravado/.test(textoAviso) && /Copie o que precisar/.test(textoAviso) && mantido && bloqueado, 'edição simultânea: salvar a edição antiga é recusado com aviso compreensível e fixo na janela, a edição local continua nos campos e Salvar fica bloqueado');
  await pg.waitForTimeout(700); // deixa o rascunho automático gravar
  // fechar pelo X guarda a edição como rascunho com a versão em que ela se baseia: ao reabrir a demanda o aviso já aparece e Salvar segue bloqueado
  await pg.click('.modal [aria-label="Fechar"]'); await pg.waitForTimeout(300);
  await pg.click('.dcard:has-text("Conflito TESTE") .assunto'); await pg.waitForSelector('.modal .ler');
  ok(!!(await pg.$('#m-conflito')) && /Rascunho recuperado/.test(await pg.textContent('.modal')) && (await pg.$$eval('.t-campo', (e) => e.map((x) => x.value))).includes('tarefa do aparelho 1') && await pg.isDisabled('.modal [data-salvar="tarefas"]'), 'edição simultânea: o rascunho guardado lembra a versão de origem, então ao reabrir o aviso aparece de novo, a edição recuperada está nos campos e Salvar continua bloqueado');
  // nada do aparelho 1 foi gravado e a tarefa do aparelho 2 permanece (lido do banco por uma página nova)
  await pg.click('.modal [data-secao="tarefas"] .btn:has-text("Cancelar")'); await pg.click('.modal .m-f .btn:has-text("Fechar")'); await ir('/demandas');
  await pg.click('.dcard:has-text("Conflito TESTE") .assunto'); await pg.waitForSelector('.modal .ler');
  const tarefas = await pg.$$eval('.t-ler li span', (e) => e.map((x) => x.textContent));
  ok(tarefas.join('|') === 'criada no outro aparelho' && !(await pg.$('#m-conflito')), 'edição simultânea: no banco ficou só o que o outro aparelho gravou (a tarefa dele permanece, nada do aparelho 1 foi gravado) e a demanda reaberta mostra a versão atual sem aviso');
  // limpeza: arquiva e exclui a demanda criada só para este teste (as verificações finais do banco esperam exatamente as duas de antes)
  await pg.click('.modal .m-f .btn:has-text("Fechar")'); await pg.waitForTimeout(300);
  await pg.click('.dcard:has-text("Conflito TESTE") .girar >> nth=0'); await pg.waitForTimeout(600);
  await pg.click('.dcard:has-text("Conflito TESTE") [aria-label="Arquivar"]'); await aviso(); await pg.waitForTimeout(400);
  await ir('/arquivo');
  await pg.click('.linha:has-text("Conflito TESTE") .btn:has-text("Excluir")'); await pg.click('.linha:has-text("Conflito TESTE") .btn:has-text("Confirmar exclusão")'); await pg.waitForTimeout(600);
  await ir('/demandas');
}
// 11c) cópia dos dados: a rota /api/exportar devolve o JSON versionado com demandas e tarefas (e arquivadas), como arquivo para baixar e sem cache
{
  const r = await pg.context().request.get(BASE + '/api/exportar');
  const j = await r.json().catch(() => null);
  ok(r.status() === 200 && /attachment; filename="dmanda-copia-\d{4}-\d{2}-\d{2}\.json"/.test(r.headers()['content-disposition'] ?? '') && r.headers()['cache-control'] === 'no-store', 'cópia dos dados: a rota entrega um arquivo JSON para baixar, sem cache');
  ok(j?.formato === 'dmanda-exportacao' && j.versao === 2 && Array.isArray(j.demandas) && Array.isArray(j.arquivadas) && Array.isArray(j.dias_indisponiveis) && j.demandas.length > 0 && j.demandas.every((d) => Array.isArray(d.tarefas) && d.id && !('user_id' in d)), 'cópia dos dados: formato versionado, demandas com tarefas, sem o identificador interno do usuário');
  // a cópia que a rota real entrega é aceita pelo SQL de restauração documentado (supabase/restaurar-copia.sql), num banco novo em memória
  {
    const dr = await abrirBancoTeste();
    await dr.query("insert into auth.users (id, email) values ('55555555-5555-4555-8555-555555555555', 'restaurar@teste')");
    let erroRestaurar = null;
    try { await dr.exec(readFileSync('supabase/restaurar-copia.sql', 'utf8').replace('__COLE_AQUI_O_JSON__', () => JSON.stringify(j))); } catch (e) { erroRestaurar = e.message; }
    const cont = (await dr.query('select (select count(*) from public.demandas)::int as d, (select count(*) from public.tarefas)::int as t')).rows[0];
    const esperadoT = [...j.demandas, ...j.arquivadas].reduce((n, d) => n + d.tarefas.length, 0);
    ok(erroRestaurar === null && cont.d === j.demandas.length + j.arquivadas.length && cont.t === esperadoT, 'cópia dos dados: o arquivo que a rota entrega é restaurado inteiro pelo SQL documentado' + (erroRestaurar ? ` [${erroRestaurar}]` : ` (${cont.d} demandas, ${cont.t} tarefas)`));
    await dr.close();
  }
  await ir('/demandas'); await pg.click('.top .perfil-b'); await pg.waitForSelector('.mv-menu[aria-label="Conta"]');
  const [baixado] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }).catch(() => null), pg.click('.mv-menu [role=menuitem]:has-text("Baixar cópia")')]);
  const textoAviso = await pg.waitForSelector('#toast.on', { timeout: 10000 }).then((e) => e.textContent()).catch(() => '');
  ok(!!baixado && /^dmanda-copia-\d{4}-\d{2}-\d{2}\.json$/.test(baixado.suggestedFilename()) && /Cópia baixada/.test(textoAviso ?? ''), 'cópia dos dados: o item do menu da conta baixa o arquivo e só então avisa que baixou');
}

// 11b) menu da conta (avatar do topo, computador e celular): abre, cabe na tela, "Sair" indisponível no banco de teste, fecha com Esc e ao clicar fora
for (const [w, h, rotulo] of [[1360, 780, 'computador'], [390, 800, 'celular']]) {
  await pg.setViewportSize({ width: w, height: h });
  await ir('/demandas');
  await pg.click('.top .perfil-b'); await pg.waitForSelector('.mv-menu[aria-label="Conta"]');
  const m = await pg.evaluate(() => { const r = document.querySelector('.mv-menu[aria-label="Conta"]').getBoundingClientRect(), b = document.querySelector('.top .perfil-b'); return { cabe: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, expandido: b.getAttribute('aria-expanded'), sair: document.querySelector('.mv-menu [role=menuitem]:last-of-type')?.textContent, bloqueado: document.querySelector('.mv-menu [role=menuitem]:last-of-type')?.getAttribute('aria-disabled') }; });
  await pg.click('.mv-menu [role=menuitem]:last-of-type', { force: true }); await pg.waitForTimeout(300);
  const ficou = pg.url().endsWith('/demandas') && !!(await pg.$('.mv-menu[aria-label="Conta"]'));
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.mv-menu[aria-label="Conta"]'), null, { timeout: 3000 }).catch(() => {});
  const fechouEsc = !(await pg.$('.mv-menu[aria-label="Conta"]'));
  await pg.click('.top .perfil-b'); await pg.waitForSelector('.mv-menu[aria-label="Conta"]'); await pg.click('.main h1, .main'); await pg.waitForTimeout(250);
  const fechouFora = !(await pg.$('.mv-menu[aria-label="Conta"]'));
  ok(m.cabe && m.expandido === 'true' && /^Sair/.test(m.sair ?? '') && m.bloqueado === 'true' && ficou && fechouEsc && fechouFora, `${rotulo}: menu da conta abre dentro da tela, "Sair" fica indisponível no banco de teste (sem navegar), fecha com Esc e ao clicar fora`);
}
await pg.setViewportSize({ width: 1360, height: 780 });

// 12) entradas ainda não construídas dizem a verdade
await ir('/agenda'); ok(/Em construção/.test(await pg.textContent('.main')) && !/Reunião|Audiência/.test(await pg.textContent('.main')), 'áreas ainda não construídas mostram "Em construção" e nenhum dado de exemplo');
// 12b) rotina diária: autenticação própria, repetível, sem cookie, sem dado pessoal, e o Início mostra o estado
const rota = BASE + '/api/cron/diaria';
const semAuth = await fetch(rota), errada = await fetch(rota, { headers: { authorization: 'Bearer segredo-errado-0123456789' } });
ok(semAuth.status === 401 && errada.status === 401, 'rotina diária: sem o segredo, ou com segredo errado, a resposta é 401');
const certa = await fetch(rota, { headers: { authorization: 'Bearer ' + SEGREDO } }), corpo = await certa.json();
ok(certa.status === 200 && corpo.ok === true && Object.keys(corpo).sort().join() === 'data_ref,ok,usuarios' && !certa.headers.get('set-cookie'), 'rotina diária: com o segredo certo responde 200, só com data e contagem, e não define cookie nem sessão');
const certa2 = await fetch(rota, { headers: { authorization: 'Bearer ' + SEGREDO } });
ok(certa2.status === 200 && !JSON.stringify(corpo).includes('Resposta ao TCE'), 'rotina diária: repetir a chamada é aceito e a resposta não traz texto das demandas');
await ir('/');
await pg.waitForFunction(() => /Rotina diária na nuvem: última execução/.test(document.querySelector('.rotina-estado')?.textContent || ''), null, { timeout: 15000 }).then(() => ok(true, 'o Início mostra a última execução da rotina diária'), () => ok(false, 'o Início mostra a última execução da rotina diária'));

ok(erros.length === 0, 'sem erros de JavaScript nem de console durante o fluxo' + (erros.length ? ': ' + [...new Set(erros)].slice(0, 1).join(' | ').replace(/\s+/g, ' ') : ''));
await nav.close(); parar();
await new Promise((r) => setTimeout(r, 2500));

// 13) leitura direta do que ficou gravado no banco
const db = await abrirBancoTeste({ pasta: PASTA });
const linhas = (await db.query("select assunto, numero, origem, chegou_em::text, prazo::text, prazo_original::text, prazo_ajuste, prazo_legado, etapa, arquivada_em is not null as arquivada, concluida_em, (select count(*) from public.tarefas t where t.demanda_id = d.id)::int as n_tarefas, (select count(*) filter (where concluida) from public.tarefas t where t.demanda_id = d.id)::int as n_feitas from public.demandas d order by criado_em")).rows;
console.log('Banco (leitura direta):', JSON.stringify(linhas));
const tcee = linhas.find((l) => /Resposta ao TCE/.test(l.assunto)), contrato = linhas.find((l) => /contrato/.test(l.assunto));
ok(linhas.length === 2 && tcee.etapa === 'Fazendo' && tcee.n_tarefas === 3 && tcee.n_feitas === 3 && tcee.concluida_em === null && !tcee.arquivada, 'banco: a demanda do TCE está em Fazendo com 3 tarefas, 3 feitas, sem data de conclusão (foi reaberta)');
ok(tcee.chegou_em === '2020-01-02' && tcee.prazo_original === '2026-10-10' && tcee.prazo === '2026-10-09' && tcee.prazo_ajuste === '10/10 sábado' && tcee.prazo_legado === false, 'banco: a demanda do TCE guarda a chegada de 2020, o prazo original (sábado 10/10), o vencimento ajustado (sexta 09/10) e o motivo');
ok(contrato.numero === '' && contrato.origem === '' && contrato.chegou_em === null && contrato.prazo === null && contrato.prazo_original === null, 'banco: a demanda criada só com o assunto não tem número, origem, chegada nem prazo inventados');
ok(contrato.etapa === 'Finalizado' && contrato.concluida_em !== null && !contrato.arquivada && !linhas.some((l) => /Não deve gravar|CANCELADA/.test(l.assunto)), 'banco: o contrato está Finalizado com data de conclusão, nada da falha nem do cancelado foi gravado');
const rotinaBanco = (await db.query("select (select count(*)::int from public.resumos_operacionais where data_ref = public.hoje()) as resumos, (select count(*)::int from public.execucoes_rotina where ok) as execs, (select dados from public.resumos_operacionais where data_ref = public.hoje() limit 1) as dados")).rows[0];
console.log('Banco (rotina):', JSON.stringify({ resumos: rotinaBanco.resumos, execs: rotinaBanco.execs, atrasadas: rotinaBanco.dados?.atrasadas, abertas: rotinaBanco.dados?.abertas }));
ok(rotinaBanco.resumos === 1 && rotinaBanco.execs === 2 && rotinaBanco.dados.abertas === 1 && rotinaBanco.dados.finalizadas === 1 && rotinaBanco.dados.atrasadas === 1, 'banco: um resumo de hoje (repetição não duplica), duas execuções registradas e contagens iguais às demandas');
await db.close();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
