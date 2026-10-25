// Teste de ponta a ponta da aplicação funcional, no navegador (Edge), com o banco local de TESTE (PGlite, mesmas migrações do Supabase).
// Sobe o próprio servidor numa porta separada, com uma pasta de dados nova, e no fim lê direto do banco o que foi gravado.
// NÃO valida o Supabase real nem o login Google (ainda sem projeto e credenciais). Uso: node scripts/testar-app.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
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

// 1) estado vazio e cadastro
await ir('/demandas');
ok(/Nenhuma demanda cadastrada/.test(await pg.textContent('#vista')) && /0 demandas, 0 atrasadas/.test(await pg.textContent('.pagehead')), 'estado vazio honesto (sem dados de exemplo) e contagem zerada');
ok(!!(await pg.$('.faixa-teste')), 'o banner avisa que é o banco local de teste');
await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('.modal');
await pg.click('.modal .btn.pri'); await pg.waitForTimeout(300);
ok(/Informe o assunto/.test(await pg.textContent('.modal')), 'cadastrar sem assunto mostra a validação e não grava');
await pg.fill('#n-assunto', 'Resposta ao TCE sobre diárias'); await pg.fill('#n-num', '1842/2026'); await pg.fill('#n-origem', 'TCE-RS'); await pg.fill('#n-descricao', 'Texto da descrição da demanda de teste');
await pg.click('.modal .opcoes button:has-text("Legal")');
await pg.fill('#n-prazo', '2026-10-10'); // vencido: precisa aparecer como atrasada
await pg.click('.modal .btn.pri');
ok(await avisoRe(/Demanda cadastrada/), 'cadastro confirmado pelo banco (aviso só depois da gravação)');
await pg.waitForSelector('.dcard');
ok((await assuntos()).join() === 'Resposta ao TCE sobre diárias' && /1 demanda, 1 atrasada/.test(await pg.textContent('.pagehead')), 'a demanda aparece em Cards e a contagem do cabeçalho conta a atrasada');
await ir('/demandas');
ok((await assuntos()).join() === 'Resposta ao TCE sobre diárias', 'depois de recarregar a página a demanda continua (veio do banco)');

// 2) segunda demanda e tarefas pela janela de edição
await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('.modal');
await pg.fill('#n-assunto', 'Revisão do contrato de limpeza'); await pg.click('.modal .opcoes button:has-text("Memorando")'); await pg.click('.modal .btn.pri'); await aviso(); await pg.waitForTimeout(400);
ok((await assuntos()).length === 2, 'segunda demanda cadastrada');
await pg.click('.dcard:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal .m-cols');
for (const t of ['Levantar diárias de 2025', 'Conferir com a Contabilidade', 'Redigir a resposta']) { await pg.fill('#m-nt', t); await pg.press('#m-nt', 'Enter'); }
await pg.click('.modal .t-item:nth-child(1) input[type=checkbox]');
await pg.fill('.modal .t-item:nth-child(3) .t-campo', 'Redigir a resposta final');
await pg.click('.modal .btn.pri'); ok(await avisoRe(/Alterações salvas/), 'salvar a janela confirma só depois de gravar');
await pg.waitForTimeout(500);
let card = pg.locator('.dcard:has-text("Resposta ao TCE")');
ok(/1\/3 · 33%/.test(await card.locator('.prog b').textContent()) && /Vistos/.test(await card.locator('.tags .chip').textContent()), 'progresso 1/3 e a demanda foi de Cadastro para Vistos (primeira tarefa)');
await ir('/demandas');
card = pg.locator('.dcard:has-text("Resposta ao TCE")');
ok(/1\/3 · 33%/.test(await card.locator('.prog b').textContent()) && /Vistos/.test(await card.locator('.tags .chip').textContent()) && /Conferir com a Contabilidade/.test(await card.locator('.prox-t').textContent()), 'após recarregar: tarefas, progresso, etapa e a próxima tarefa preservados');

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

// 7) cancelar, Esc (rascunho) e validações da edição
await pg.click('.mini-card:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal');
await pg.fill('#d-assunto', 'ALTERAÇÃO CANCELADA'); await pg.click('.modal .btn:has-text("Cancelar")'); await pg.waitForTimeout(300);
ok(!(await pg.textContent('#vista')).includes('ALTERAÇÃO CANCELADA'), 'Cancelar descarta a alteração');
await pg.click('.mini-card:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal'); await pg.fill('#d-assunto', 'Rascunho guardado com Esc'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.click('.mini-card:has-text("Resposta ao TCE") .assunto'); await pg.waitForSelector('.modal');
ok((await pg.inputValue('#d-assunto')) === 'Rascunho guardado com Esc' && !!(await pg.$('.modal .rec')), 'Esc guarda o rascunho e a próxima abertura o recupera');
await pg.fill('#d-assunto', '   '); await pg.click('.modal .btn.pri');
ok(await avisoRe(/assunto não pode ficar vazio/) && !!(await pg.$('.modal')), 'salvar com assunto vazio é recusado e a janela continua aberta');
await pg.click('.modal .btn:has-text("Cancelar")'); await pg.waitForTimeout(300);

// 8) falha de gravação: a interface não pode mostrar sucesso
falhaProposital = true;
await pg.route('**/*', (r) => (r.request().method() === 'POST' && r.request().headers()['next-action'] ? r.abort('failed') : r.continue()));
await pg.click('.mini-card:has-text("Revisão do contrato") .assunto'); await pg.waitForSelector('.modal');
await pg.fill('#d-assunto', 'Não deve gravar'); await pg.click('.modal .btn.pri'); await pg.waitForTimeout(1500);
const t = await pg.textContent('#toast');
ok(!/salvas/.test(t) && !!(await pg.$('#toast.erro')) && !!(await pg.$('.modal')), 'falha de rede ao salvar: erro à vista, sem aviso de sucesso e a janela fica aberta com o texto');
await pg.unroute('**/*'); falhaProposital = false; await pg.click('.modal .btn:has-text("Cancelar")'); await pg.waitForTimeout(300);
await ir('/demandas'); await pg.click('.toolbar .tabs button[data-v="tabela"]');
ok(!(await pg.textContent('#vista')).includes('Não deve gravar'), 'depois da falha nada foi gravado no banco');

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
ok(/Atrasadas/.test(await pg.textContent('.stats')) && (await pg.$$eval('.stat .n', (e) => e.map((x) => x.textContent))).join() === '1,0,0' && /Resposta ao TCE/.test(await pg.textContent('.main')), 'o Início conta 1 atrasada e mostra a demanda no Foco do dia');

// 11) celular e iPad, claro e escuro (a mesma operação funciona e nada fica cortado)
for (const [w, h, rotulo] of [[390, 800, 'celular'], [820, 1000, 'iPad vertical'], [1180, 780, 'iPad horizontal'], [1000, 780, 'janela média']]) {
  await pg.setViewportSize({ width: w, height: h });
  for (const modo of ['claro', 'escuro']) {
    await ir('/demandas'); if ((await pg.getAttribute('.app', 'data-tema')) !== modo) { await pg.click('.icbtn[aria-label^="Alternar tema"]'); await pg.waitForTimeout(300); }
    await pg.click('.toolbar .tabs button[data-v="cards"]'); await pg.waitForTimeout(400);
    const larg = await pg.evaluate(() => ({ main: document.querySelector('.main').scrollWidth <= document.querySelector('.main').clientWidth + 1, cards: document.querySelectorAll('.dcard').length }));
    await pg.click('.dcard .assunto >> nth=0'); await pg.waitForSelector('.modal .m-cols');
    const jan = await pg.evaluate(() => { const m = document.querySelector('.modal'), f = document.querySelector('.m-f').getBoundingClientRect(), r = m.getBoundingClientRect(); return { lateral: m.scrollWidth > m.clientWidth + 1, rodape: f.bottom <= r.bottom + 1 && f.height > 0 }; });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
    ok(larg.main && larg.cards === 2 && !jan.lateral && jan.rodape, `${rotulo}, ${modo}: página sem rolagem lateral, 2 cards, janela de edição sem corte e com o rodapé à vista`);
  }
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
const linhas = (await db.query("select assunto, etapa, arquivada_em is not null as arquivada, concluida_em, (select count(*) from public.tarefas t where t.demanda_id = d.id)::int as n_tarefas, (select count(*) filter (where concluida) from public.tarefas t where t.demanda_id = d.id)::int as n_feitas from public.demandas d order by criado_em")).rows;
console.log('Banco (leitura direta):', JSON.stringify(linhas));
const tcee = linhas.find((l) => /Resposta ao TCE/.test(l.assunto)), contrato = linhas.find((l) => /contrato/.test(l.assunto));
ok(linhas.length === 2 && tcee.etapa === 'Fazendo' && tcee.n_tarefas === 3 && tcee.n_feitas === 3 && tcee.concluida_em === null && !tcee.arquivada, 'banco: a demanda do TCE está em Fazendo com 3 tarefas, 3 feitas, sem data de conclusão (foi reaberta)');
ok(contrato.etapa === 'Finalizado' && contrato.concluida_em !== null && !contrato.arquivada && !linhas.some((l) => /Não deve gravar|CANCELADA/.test(l.assunto)), 'banco: o contrato está Finalizado com data de conclusão, nada da falha nem do cancelado foi gravado');
const rotinaBanco = (await db.query("select (select count(*)::int from public.resumos_operacionais where data_ref = public.hoje()) as resumos, (select count(*)::int from public.execucoes_rotina where ok) as execs, (select dados from public.resumos_operacionais where data_ref = public.hoje() limit 1) as dados")).rows[0];
console.log('Banco (rotina):', JSON.stringify({ resumos: rotinaBanco.resumos, execs: rotinaBanco.execs, atrasadas: rotinaBanco.dados?.atrasadas, abertas: rotinaBanco.dados?.abertas }));
ok(rotinaBanco.resumos === 1 && rotinaBanco.execs === 2 && rotinaBanco.dados.abertas === 1 && rotinaBanco.dados.finalizadas === 1 && rotinaBanco.dados.atrasadas === 1, 'banco: um resumo de hoje (repetição não duplica), duas execuções registradas e contagens iguais às demandas');
await db.close();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
