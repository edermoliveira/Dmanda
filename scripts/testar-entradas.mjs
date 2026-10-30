// Entradas (decisões 37 a 39) no navegador (Edge) com o banco local de TESTE (PGlite, mesmas migrações do Supabase): criar, editar, recarregar, cor, tags, busca, fixar, arquivar e recuperar;
// salvamento automático, rascunho e falha de rede; sem duplicar; edição simultânea; Virar demanda (cancelar, concluir com tarefa, pular, recarregar, repetir); atalho N; cópia dos dados;
// computador, iPad e iPhone emulados, claro e escuro. Sobe o próprio servidor numa porta separada, com pasta de dados nova. NÃO valida o Supabase real. Uso: node scripts/testar-entradas.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste } from '../src/servidor/banco-teste-base.mjs';

const PORTA = process.env.PORTA_TESTE_ENTRADAS || '7105', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/entradas';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste-1234567890' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };

for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const novoContexto = async (opcoes, { tema = 'claro' } = {}) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.addInitScript((t) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, tema);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  return { ctx, pg };
};
const ir = async (pg, rota = '/entradas') => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando as (entradas|demandas)/.test(document.body.innerText), null, { timeout: 120000 });
  // espera a hidratação terminar (é aí que o aplicativo lê os rascunhos do navegador)
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  await pg.waitForTimeout(1200);
};
const rascunhos = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('dmanda:rascunhos') || '{}'); } catch { return {}; } });
const estado = (pg) => pg.getAttribute('.modal .estado-entrada', 'data-estado');
const esperaEstado = (pg, e, ms = 15000) => pg.waitForFunction((x) => document.querySelector('.modal .estado-entrada')?.getAttribute('data-estado') === x, e, { timeout: ms });
const janelaFechada = (pg) => pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
const notas = (pg) => pg.$$eval('.postits .postit', (ps) => ps.map((p) => ({ id: p.getAttribute('data-id'), txt: p.querySelector('.p-txt')?.textContent ?? '', tags: [...p.querySelectorAll('.p-tags span')].map((s) => s.textContent), fixada: p.classList.contains('fixado'), cor: p.style.getPropertyValue('--nota-i'), fundo: getComputedStyle(p).backgroundColor })));
// cria pela janela e espera o banco confirmar
const criar = async (pg, { titulo = '', texto, cor = null, fixar = false }) => {
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto');
  if (titulo) await pg.fill('#e-titulo', titulo);
  await pg.fill('#e-texto', texto);
  if (cor !== null) await pg.click(`.modal .cores .cor-b[aria-label="Cor ${cor + 1}"]`);
  if (fixar) await pg.click('.modal .acoes-entrada button[aria-pressed]');
  await esperaEstado(pg, 'salvo');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
};
const limparTudo = async (pg) => { await pg.evaluate(() => localStorage.removeItem('dmanda:rascunhos')); };

// ================= 1) criar, editar, recarregar =================
const t1 = await novoContexto({ viewport: { width: 1360, height: 800 } });
{
  const { pg } = t1;
  await ir(pg);
  ok(!!(await pg.$('.vazio')) && /Nenhuma entrada ainda/.test(await pg.textContent('.vazio')), 'banco novo: Entradas mostra o estado vazio com a chamada para criar a primeira');

  // vazio não salva
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto');
  ok(await estado(pg) === 'vazio' && /Escreva um título ou o texto/.test(await pg.textContent('.estado-entrada')), 'janela vazia: avisa que nada é salvo enquanto estiver vazia');
  await pg.waitForTimeout(1600);
  ok(await estado(pg) === 'vazio' && Object.keys(await rascunhos(pg)).length === 0, 'janela vazia: nada é salvo nem vira rascunho');
  await pg.fill('#e-texto', '   \n  ');
  await pg.waitForTimeout(1600);
  ok(await estado(pg) === 'vazio', 'só espaços também contam como vazio');
  await pg.fill('#e-titulo', 'Título sem texto');
  await esperaEstado(pg, 'salvo');
  ok(true, 'só o título já basta: a entrada é salva');
  await pg.fill('#e-titulo', ''); await pg.waitForTimeout(300);
  ok(await estado(pg) === 'vazia-existente', 'esvaziar uma entrada salva não a apaga: o estado explica que ela não pode ficar vazia e a última versão salva continua');
  await pg.fill('#e-titulo', 'Ligar para o RH'); await pg.fill('#e-texto', 'Sobre as escalas de fim de ano #rh #Escalas');
  ok(['pendente', 'salvando', 'salvo'].includes(await estado(pg)), 'ao digitar, o estado deixa de ser "salvo" até o banco confirmar');
  await esperaEstado(pg, 'salvo');
  await pg.waitForTimeout(700);
  const rd = await rascunhos(pg);
  ok(Object.keys(rd).length === 0, 'depois de "Salvo no Dmanda" não sobra rascunho neste aparelho' + (Object.keys(rd).length ? ' [' + Object.keys(rd).join() + ']' : ''));
  ok(/#rh #escalas/.test(await pg.textContent('.tags-detectadas')), 'as tags são reconhecidas em qualquer lugar do texto (minúsculas)');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  let lista = await notas(pg);
  ok(lista.length === 1 && lista[0].txt === 'Ligar para o RH' && lista[0].tags.join() === '#rh,#escalas', 'a entrada aparece como post-it com o título (o texto fica para a leitura) e as tags');

  // recarregar: tudo volta do banco
  await ir(pg);
  lista = await notas(pg);
  ok(lista.length === 1 && lista[0].txt === 'Ligar para o RH', 'depois de recarregar a entrada continua lá (veio do banco)');
  await pg.click('.postit .p-abrir'); await pg.waitForSelector('#e-texto');
  ok((await pg.inputValue('#e-titulo')) === 'Ligar para o RH' && (await pg.inputValue('#e-texto')) === 'Sobre as escalas de fim de ano #rh #Escalas' && await estado(pg) === 'salvo', 'abrir a entrada mostra título e texto exatos e o estado "salvo"');
  await pg.fill('#e-texto', 'Sobre as escalas de fim de ano #rh #Escalas\nSegunda linha editada');
  await esperaEstado(pg, 'salvo');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  await ir(pg);
  await pg.click('.postit .p-abrir'); await pg.waitForSelector('#e-texto');
  ok((await pg.inputValue('#e-texto')).endsWith('Segunda linha editada'), 'a edição foi salva no banco e sobrevive à recarga');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);

  // sem título: aparecem as primeiras frases do texto, sem as tags
  await criar(pg, { texto: 'Conferir se a PGM respondeu o ofício 311. Se não, cobrar por telefone #pgm #cobrar' });
  lista = await notas(pg);
  const semTitulo = lista.find((x) => /PGM/.test(x.txt));
  ok(!!semTitulo && !/#/.test(semTitulo.txt) && semTitulo.tags.join() === '#pgm,#cobrar', 'sem título, o post-it mostra as primeiras frases do texto, sem as tags, e as tags embaixo');
  const com = lista.find((x) => /Ligar/.test(x.txt));
  const fam = await pg.evaluate(() => { const g = (s) => getComputedStyle(document.querySelector(s)); return { t: g('.postit .p-txt').fontSize, tg: g('.postit .p-tags').fontSize }; });
  ok(fam.t === fam.tg, `título, texto e tags têm o mesmo tamanho de fonte (${fam.t})`);
  const pesos = await pg.$$eval('.postit .p-txt', (e) => e.map((x) => [x.classList.contains('com-titulo'), getComputedStyle(x).fontWeight]));
  ok(pesos.some(([ct, w]) => ct && Number(w) >= 700) && pesos.some(([ct, w]) => !ct && Number(w) <= 600), 'o título se distingue pelo negrito');
  ok(!!com, 'a entrada com título aparece na grade');
}

// 1b) sair de cena (trocar de app, encerrar a PWA) sem alteração não deixa rascunho falso
{
  const { pg } = t1;
  const esconder = () => pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const mostrar = () => pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.click('.postit .p-abrir'); await pg.waitForSelector('#e-texto');
  await esconder(); await pg.waitForTimeout(700);
  ok(Object.keys(await rascunhos(pg)).length === 0, 'sair de cena com uma entrada aberta e sem alteração não deixa rascunho nem marca "Só neste aparelho"');
  await mostrar();
  await pg.route('**/*', async (route) => { const q = route.request(); if (q.method() === 'POST' && q.headers()['next-action']) { await route.abort('failed'); return; } await route.continue(); });
  await pg.fill('#e-texto', (await pg.inputValue('#e-texto')) + ' extra');
  await esconder(); await pg.waitForTimeout(900);
  const rdSair = await rascunhos(pg);
  ok(Object.values(rdSair).some((x) => /extra$/.test(x.dados?.texto ?? '')), 'sair de cena com texto ainda não salvo grava o rascunho na hora (e tenta salvar no banco)');
  await pg.unroute('**/*'); await mostrar();
  await pg.click('.modal .estado-entrada .btn.mini'); await esperaEstado(pg, 'salvo');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto');
  await esconder(); await pg.waitForTimeout(700);
  ok(Object.keys(await rascunhos(pg)).length === 0, 'sair de cena com a janela de nova entrada vazia não deixa rascunho vazio');
  await mostrar(); await pg.keyboard.press('Escape'); await janelaFechada(pg);
  await pg.waitForTimeout(500);
  ok(Object.keys(await rascunhos(pg)).length === 0 && !(await pg.$('.aviso-rascunho')) && !(await pg.$('.p-local')), 'e a grade não mostra aviso de rascunho nem "Só neste aparelho"');
}

// ================= 2) cor, tags, busca, fixar =================
{
  const { pg } = t1;
  await ir(pg);
  // seis entradas sem escolha de cor + uma com escolha
  for (const t of ['Segunda reunião #reuniao', 'Painel por origem #ideia', 'Diárias #tce', 'Portaria horário de verão #portaria']) await criar(pg, { texto: t });
  const todas = await notas(pg);
  const cores = todas.map((n) => n.cor);
  ok(todas.length === 6 && new Set(cores).size === 6, 'sem escolha de cor, as seis primeiras entradas ganham seis cores diferentes (distribuição aprovada)');
  ok(new Set(todas.map((n) => n.fundo)).size === 6, 'os seis tons são realmente diferentes na tela (pastel derivado da paleta)');
  await criar(pg, { texto: 'Cor escolhida à mão', cor: 3 });
  ok((await notas(pg)).find((n) => /Cor escolhida/.test(n.txt)).cor === '3', 'a cor escolhida na janela é a que fica no post-it');

  // tags e busca
  const chips = await pg.$$eval('.tagbar .chip', (c) => c.map((x) => x.textContent));
  ok(chips[0] === 'Todas 7' && chips.includes('#rh 1') && chips.includes('#reuniao 1'), 'a barra de tags tem "Todas" e cada tag com a contagem');
  await pg.click('.tagbar .chip:has-text("#rh")');
  let l = await notas(pg);
  ok(l.length === 1 && /Ligar/.test(l[0].txt), 'filtrar por #rh mostra só as entradas com essa tag');
  await pg.click('.tagbar .chip:has-text("Todas")');
  await pg.fill('#eq', 'reuniao');
  l = await notas(pg);
  ok(l.length === 1 && /reuni/i.test(l[0].txt), 'a busca ignora acento ("reuniao" acha "reunião")');
  await pg.fill('#eq', 'escalas de fim de ano');
  l = await notas(pg);
  ok(l.length === 1 && /Ligar/.test(l[0].txt), 'a busca também olha o texto que não aparece no post-it');
  await pg.fill('#eq', 'inexistente zzz');
  ok(!!(await pg.$('.vazio')) && /Nenhuma entrada encontrada/.test(await pg.textContent('.vazio')), 'busca sem resultado mostra o estado vazio com saída');
  await pg.click('.vazio .btn.mini'); l = await notas(pg);
  ok(l.length === 7 && (await pg.inputValue('#eq')) === '', 'Limpar busca volta a todas as entradas');

  // fixar e desafixar: vai ao topo, persiste
  const alvo = '.postit:has(.p-txt:has-text("Portaria"))';
  await pg.hover(alvo); await pg.click(`${alvo} .pin-b:not(.virar)`);
  await pg.waitForFunction(() => document.querySelector('.postits .postit')?.classList.contains('fixado'));
  l = await notas(pg);
  ok(l[0].fixada && /Portaria/.test(l[0].txt), 'fixar leva a entrada para o topo');
  await ir(pg);
  ok((await notas(pg))[0].fixada, 'a fixação persiste depois de recarregar');
  await pg.click(`${alvo} .pin-b:not(.virar)`);
  await pg.waitForFunction(() => !document.querySelector('.postits .postit.fixado'));
  ok(!(await notas(pg)).some((n) => n.fixada), 'desafixar devolve a entrada à ordem normal');
}

// ================= 3) arquivar e recuperar =================
{
  const { pg } = t1;
  await ir(pg);
  await pg.click('.postit:has(.p-txt:has-text("Painel")) .p-abrir'); await pg.waitForSelector('#e-texto');
  await pg.click('.modal .acoes-entrada button:has-text("Arquivar")'); await janelaFechada(pg);
  ok(!(await notas(pg)).some((n) => /Painel/.test(n.txt)), 'arquivar tira a entrada de Entradas');
  await pg.click('.toolbar .btn[aria-label="Ver entradas arquivadas"]'); await pg.waitForSelector('.tabs [data-aba="entradas"][aria-pressed="true"]');
  await pg.waitForSelector('.lista .linha');
  ok(/Painel/.test(await pg.textContent('.lista')) && /Arquivada/.test(await pg.textContent('.lista')), 'o botão Arquivadas leva ao Arquivo, na aba Entradas, onde a entrada está');
  await pg.click('.linha:has-text("Painel") .btn:has-text("Recuperar")');
  await pg.waitForFunction(() => !/Painel/.test(document.querySelector('.lista, .vazio')?.textContent || ''));
  await ir(pg);
  ok((await notas(pg)).some((n) => /Painel/.test(n.txt)), 'recuperar devolve a entrada a Entradas, com o mesmo conteúdo');
  // exclusão definitiva só pelo Arquivo, com segunda confirmação
  await pg.click('.postit:has(.p-txt:has-text("Diárias")) .p-abrir'); await pg.waitForSelector('#e-texto');
  await pg.click('.modal .acoes-entrada button:has-text("Arquivar")'); await janelaFechada(pg);
  await ir(pg, '/arquivo'); await pg.click('.tabs [data-aba="entradas"]'); await pg.waitForSelector('.linha:has-text("Diárias")');
  await pg.click('.linha:has-text("Diárias") .btn:has-text("Excluir")');
  ok(/Excluir de vez/.test(await pg.textContent('.linha:has-text("Diárias")')), 'excluir pede a segunda confirmação');
  await pg.click('.linha:has-text("Diárias") .btn:has-text("Confirmar exclusão")');
  await pg.waitForFunction(() => !/Diárias/.test(document.querySelector('.main')?.textContent || ''), null, { timeout: 8000 });
  ok(!!(await pg.$('.vazio')), 'excluir de vez remove a entrada arquivada');
}

// ================= 4) atalho N =================
{
  const { pg } = t1;
  await ir(pg, '/demandas'); await pg.waitForSelector('.vazio, .cards, .coluna, .tabela, .lista');
  await pg.keyboard.press('n'); await pg.waitForSelector('#e-texto', { timeout: 5000 });
  ok(/Nova entrada/.test(await pg.textContent('.modal')), 'a tecla N abre a nova entrada em qualquer tela');
  await pg.fill('#e-texto', 'nnn'); ok((await pg.inputValue('#e-texto')) === 'nnn', 'digitar "n" dentro do campo não dispara o atalho nem se perde');
  await pg.keyboard.press('Escape'); await janelaFechada(pg).catch(() => {});
  await limparTudo(pg);
  await ir(pg, '/demandas');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.keyboard.press('n');
  ok(!(await pg.$('#e-texto')) && !!(await pg.$('#n-assunto')), 'com outra janela aberta, N não abre uma segunda janela');
  await pg.click('.modal [aria-label="Fechar"]'); await janelaFechada(pg).catch(() => {});
  await limparTudo(pg);
}

// ---------- apoio da segunda parte ----------
const nota = (txt) => `.postit:has(.p-txt:has-text("${txt}"))`;
const abrirNota = async (pg, txt) => { await pg.click(`${nota(txt)} .p-abrir`); await pg.waitForSelector('#e-texto'); };
// derruba as chamadas ao servidor (ações do Next); com entregar = true o servidor executa, mas a resposta nunca chega (resposta perdida)
const derrubar = async (pg, { entregar = false } = {}) => {
  const c = { n: 0 };
  await pg.route('**/*', async (route) => {
    const r = route.request();
    if (r.method() === 'POST' && r.headers()['next-action']) { c.n++; if (entregar) await route.fetch(); await route.abort('failed'); return; }
    await route.continue();
  });
  return c;
};
const salvarEsperando = async (pg) => { await pg.waitForFunction(() => document.querySelector('.modal .estado-entrada')?.getAttribute('data-estado') !== 'salvo', null, { timeout: 4000 }).catch(() => {}); await esperaEstado(pg, 'salvo'); };
const fixa = (pg, txt) => pg.evaluate((x) => [...document.querySelectorAll('.postits .postit')].find((p) => p.querySelector('.p-txt')?.textContent.includes(x))?.classList.contains('fixado'), txt);
const contar = async (pg, txt) => (await notas(pg)).filter((n) => n.txt.includes(txt)).length;
const colunas = async (pg) => { await pg.waitForSelector('.coluna, .vazio', { timeout: 15000 }); await pg.waitForTimeout(300); if (!(await pg.$('.coluna'))) return {}; return pg.$$eval('.coluna', (cs) => Object.fromEntries(cs.map((c) => [c.getAttribute('aria-label'), [...c.querySelectorAll('.assunto')].map((a) => a.textContent.trim())]))); };
const passoAtual = (pg) => pg.$$eval('.modal .passos li', (e) => e.findIndex((x) => x.getAttribute('aria-current') === 'step') + 1);

// ================= 5) rascunho e falha de rede =================
{
  const { pg, ctx } = t1;
  await ir(pg);
  // sem rede (as chamadas falham): o texto fica na tela e no rascunho, o estado diz a verdade
  let c = await derrubar(pg);
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto');
  await pg.fill('#e-texto', 'Escrita sem rede #offline');
  await esperaEstado(pg, 'erro', 20000);
  const txtEstado = await pg.textContent('.estado-entrada');
  let rd = (await rascunhos(pg))['e:nova'];
  ok(c.n >= 1 && /Não salvo no Dmanda/.test(txtEstado) && /continua neste aparelho/.test(txtEstado), 'falha de rede: o estado diz "Não salvo no Dmanda" e que o texto continua neste aparelho');
  ok((await pg.inputValue('#e-texto')) === 'Escrita sem rede #offline' && rd?.dados?.texto === 'Escrita sem rede #offline' && !!rd?.idNovo, 'falha de rede: o texto digitado continua na tela e no rascunho do aparelho, com o identificador já guardado');
  // fechar durante a falha: pergunta, e manter deixa o rascunho no aparelho
  await pg.click('.modal .btn.pri');
  await pg.waitForSelector('.modal [role="alertdialog"]');
  ok(/Fechar e manter neste aparelho/.test(await pg.textContent('.modal [role="alertdialog"]')), 'fechar com falha não perde o texto: oferece tentar de novo, continuar editando ou manter no aparelho');
  await pg.click('.modal [role="alertdialog"] .btn.pri'); await janelaFechada(pg);
  ok(!!(await rascunhos(pg))['e:nova'] && !(await pg.$$eval('.postit', (p) => p.some((x) => /sem rede/.test(x.textContent)))), 'o rascunho ficou no aparelho e a entrada ainda não aparece na lista (não foi salva)');
  ok(/só neste aparelho/.test(await pg.textContent('.aviso-rascunho')), 'a página avisa que há uma entrada só neste aparelho');
  await ir(pg); await pg.unroute('**/*');
  ok(!!(await pg.$('.aviso-rascunho')), 'o aviso sobrevive à recarga (o rascunho está no navegador)');
  await pg.click('.aviso-rascunho .btn'); await pg.waitForSelector('#e-texto');
  ok((await pg.inputValue('#e-texto')) === 'Escrita sem rede #offline' && /Rascunho recuperado/.test(await pg.textContent('.modal')), 'Continuar devolve o texto exato, com aviso de rascunho recuperado');
  await esperaEstado(pg, 'salvo');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  ok(await contar(pg, 'sem rede') === 1 && Object.keys(await rascunhos(pg)).length === 0, 'com a rede de volta a entrada é salva uma vez e o rascunho some');

  // conexão do navegador caída: o estado é "sem conexão" e salva sozinho quando volta
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto');
  await ctx.setOffline(true);
  await pg.fill('#e-texto', 'Escrita com o navegador offline');
  await esperaEstado(pg, 'offline', 8000); await pg.waitForTimeout(800);
  ok(/Sem conexão/.test(await pg.textContent('.estado-entrada')) && !!(await rascunhos(pg))['e:nova'], 'offline: o estado diz "Sem conexão" e o texto está no rascunho do aparelho');
  await ctx.setOffline(false);
  await esperaEstado(pg, 'salvo', 20000);
  ok(true, 'ao voltar a conexão a entrada é salva sozinha, sem precisar de clique');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);

  // edição de uma entrada existente sem rede: rascunho marcado na grade
  await abrirNota(pg, 'Escrita sem rede');
  c = await derrubar(pg);
  await pg.fill('#e-texto', 'Escrita sem rede #offline\nLinha nova só no aparelho');
  await esperaEstado(pg, 'erro', 20000);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('.modal [role="alertdialog"]');
  await pg.click('.modal [role="alertdialog"] .btn.pri'); await janelaFechada(pg);
  ok(/Só neste aparelho/.test(await pg.textContent(nota('sem rede'))), 'a grade marca a entrada que tem alterações só neste aparelho');
  await pg.unroute('**/*');
  await ir(pg);
  await pg.click(`${nota('sem rede')} .pin-b.virar`);
  await pg.waitForFunction(() => /alterações só neste aparelho/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 5000 });
  ok(!(await pg.$('.modal')), 'Virar demanda é recusado enquanto a entrada tem alterações só no aparelho (a conversão usaria o texto salvo, desatualizado)');
  await abrirNota(pg, 'sem rede');
  ok(/Linha nova só no aparelho/.test(await pg.inputValue('#e-texto')) && /recuperadas/.test(await pg.textContent('.modal')), 'reabrir a entrada recupera as alterações do aparelho');
  await esperaEstado(pg, 'salvo');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  await ir(pg); await abrirNota(pg, 'sem rede');
  ok(/Linha nova só no aparelho/.test(await pg.inputValue('#e-texto')), 'depois de salvar, a alteração está no banco (sobrevive à recarga)');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
}

// ================= 6) sem duplicar =================
{
  const { pg } = t1;
  await ir(pg);
  // resposta perdida: o servidor criou, o aparelho não soube
  const c = await derrubar(pg, { entregar: true });
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto');
  await pg.fill('#e-texto', 'Resposta perdida da entrada');
  await esperaEstado(pg, 'erro', 20000);
  const id = (await rascunhos(pg))['e:nova']?.idNovo;
  ok(c.n >= 1 && !!id, 'resposta perdida: a tela diz que não salvou e o identificador estava no rascunho antes da chamada');
  await pg.unroute('**/*');
  await pg.click('.modal .estado-entrada .btn.mini'); // tentar de novo
  await esperaEstado(pg, 'salvo', 20000);
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  ok(await contar(pg, 'Resposta perdida da entrada') === 1, 'tentar de novo depois da resposta perdida não duplica: a entrada aparece uma vez');
  await ir(pg);
  ok(await contar(pg, 'Resposta perdida da entrada') === 1, 'e continua sendo uma só depois de recarregar');

  // recarga logo depois da resposta perdida
  const c2 = await derrubar(pg, { entregar: true });
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto');
  await pg.fill('#e-texto', 'Perdida e recarregada');
  await esperaEstado(pg, 'erro', 20000);
  await pg.unroute('**/*');
  await ir(pg);
  const dbg = [c2.n, await contar(pg, 'Perdida e recarregada'), !!(await pg.$('.aviso-rascunho')), Object.keys(await rascunhos(pg)).join()];
  ok(c2.n >= 1 && dbg[1] === 1 && dbg[2], 'resposta perdida e recarga: o banco tem a entrada (uma vez) e o rascunho continua oferecendo retomar [' + dbg.join(' | ') + ']');
  await pg.click('.aviso-rascunho .btn'); await pg.waitForSelector('#e-texto');
  await esperaEstado(pg, 'salvo', 20000);
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  ok(await contar(pg, 'Perdida e recarregada') === 1 && !(await pg.$('.aviso-rascunho')), 'retomar depois da recarga usa o mesmo identificador: continua uma só e o aviso some');

  // clique repetido no botão Guardar
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#e-texto');
  await pg.fill('#e-texto', 'Clique duplo no Guardar');
  await pg.dblclick('.modal .btn.pri'); await janelaFechada(pg).catch(() => {});
  await pg.waitForTimeout(800);
  await ir(pg);
  ok(await contar(pg, 'Clique duplo no Guardar') === 1, 'clique repetido em Guardar cria uma só entrada');
}

// ================= 7) edição simultânea =================
{
  const A = t1.pg;
  const tb = await novoContexto({ viewport: { width: 1360, height: 800 } });
  const B = tb.pg;
  await ir(A); await ir(B);
  await criar(A, { titulo: 'Concorrente', texto: 'Texto base' });
  await ir(B);
  const idConc = (await notas(B)).find((n) => n.txt === 'Concorrente').id;
  const abrirConc = async (pg) => { await pg.click(`.postit[data-id="${idConc}"] .p-abrir`); await pg.waitForSelector('#e-texto'); };
  await abrirConc(A);
  await abrirConc(B);
  // B grava o texto; A (janela já aberta, versão antiga) só fixa: campos diferentes, os dois cabem juntos
  await B.fill('#e-texto', 'Texto do aparelho B'); await salvarEsperando(B); await B.click('.modal .btn.pri'); await janelaFechada(B);
  await A.click('.modal .acoes-entrada button[aria-pressed]'); await salvarEsperando(A);
  ok(!(await A.$('.aviso-conflito')) && (await A.inputValue('#e-texto')) === 'Texto do aparelho B', 'campos diferentes: o outro aparelho mudou o texto e este só fixou: sem pergunta, e a janela passa a mostrar o texto novo');
  await ir(B);
  const lb = await notas(B);
  ok(lb[0].fixada && /Concorrente/.test(lb[0].txt), 'a fixação feita com a versão antiga foi gravada sem apagar nada do outro aparelho');
  await abrirConc(B);

  // mesmo campo: pergunta, sem perder o que foi digitado
  await B.fill('#e-texto', 'B primeiro'); await salvarEsperando(B); await B.click('.modal .btn.pri'); await janelaFechada(B);
  await A.fill('#e-texto', 'A depois');
  await A.waitForSelector('.modal .aviso-conflito', { timeout: 15000 });
  ok(await estado(A) === 'conflito' && (await A.inputValue('#e-texto')) === 'A depois' && /o texto/.test(await A.textContent('.aviso-conflito')), 'mesmo campo: aparece o aviso de conflito e o que foi digitado continua na tela');
  await ir(B);
  await abrirConc(B);
  ok((await B.inputValue('#e-texto')) === 'B primeiro', 'nada foi gravado pelo lado em conflito: o banco continua com a versão do outro aparelho');
  await B.click('.modal .btn.pri'); await janelaFechada(B);
  await A.click('.aviso-conflito .btn:has-text("Guardar a minha como nova")');
  await A.waitForFunction(() => !document.querySelector('.aviso-conflito'), null, { timeout: 15000 });
  ok((await A.inputValue('#e-texto')) === 'B primeiro', 'guardar a minha como nova: a janela passa a mostrar a versão do outro aparelho');
  await ir(B);
  ok(await contar(B, 'Concorrente') === 2, 'a versão que estava em conflito virou uma entrada nova (com o título e o texto digitados), sem perda: agora são duas');

  await abrirConc(B); await B.fill('#e-texto', 'B segundo'); await salvarEsperando(B); await B.click('.modal .btn.pri'); await janelaFechada(B);
  await A.fill('#e-texto', 'A manda');
  await A.waitForSelector('.modal .aviso-conflito', { timeout: 15000 });
  await A.click('.aviso-conflito .btn:has-text("Manter a minha")'); await esperaEstado(A, 'salvo', 15000);
  await ir(B);
  ok(await contar(B, 'Concorrente') === 2, 'manter a minha: grava por cima, de forma consciente, sem criar outra entrada');
  await abrirConc(B);
  ok((await B.inputValue('#e-texto')) === 'A manda', 'manter a minha: o banco passa a ter o texto desta janela');
  await B.fill('#e-texto', 'B terceiro'); await salvarEsperando(B); await B.click('.modal .btn.pri'); await janelaFechada(B);
  await A.fill('#e-texto', 'A perde');
  await A.waitForSelector('.modal .aviso-conflito', { timeout: 15000 });
  await A.click('.aviso-conflito .btn:has-text("Usar a do outro")');
  await A.waitForFunction(() => !document.querySelector('.aviso-conflito'), null, { timeout: 15000 });
  ok((await A.inputValue('#e-texto')) === 'B terceiro' && await estado(A) === 'salvo', 'usar a do outro aparelho: a janela mostra a versão salva e fica em "Salvo no Dmanda"');
  await A.click('.modal .btn.pri'); await janelaFechada(A);
  await tb.ctx.close();
}

// ================= 8) Virar demanda =================
const virarCard = async (pg, txt) => { await pg.click(`${nota(txt)} .pin-b.virar`); await pg.waitForSelector('#n-assunto', { timeout: 15000 }); };
const proximoPasso = async (pg, esperar) => { await pg.click('.modal .btn.pri'); await pg.waitForSelector(esperar, { timeout: 20000 }); };
const verQuadro = async (pg) => { await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'quadro' }))); await ir(pg, '/demandas'); return colunas(pg); };
const aviso = (pg) => pg.waitForFunction(() => document.querySelector('#toast')?.classList.contains('on'), null, { timeout: 5000 }).then(() => pg.textContent('#toast'));
{
  const { pg } = t1;
  await ir(pg);
  await criar(pg, { texto: 'Linha útil da conversão\nSegunda linha com detalhe #conv\nTerceira linha' });
  await criar(pg, { titulo: 'Título explícito da conversão', texto: 'Texto completo da nota\ncom duas linhas #conv2' });
  await criar(pg, { texto: '#soetiqueta\nPrimeira linha com conteúdo útil' });
  const dem0 = await verQuadro(pg).then((c) => Object.values(c).flat().length).catch(() => 0);
  await ir(pg);

  // preenchimento do cadastro: sem título, com título, com a primeira linha só de tags
  await virarCard(pg, 'Linha útil da conversão');
  ok((await pg.inputValue('#n-assunto')) === 'Linha útil da conversão' && (await pg.inputValue('#n-descricao')) === 'Segunda linha com detalhe #conv\nTerceira linha', 'sem título: a primeira linha útil vira o assunto e o resto (com as tags) vai para a descrição');
  ok((await pg.inputValue('#n-num')) === '' && (await pg.inputValue('#n-origem')) === '' && /Nova demanda/.test(await pg.textContent('.modal')) && /vieram da entrada/.test(await pg.textContent('.modal')), 'não inventa número nem origem e o cadastro avisa que os dados vieram da entrada');
  await pg.click('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  ok(await contar(pg, 'Linha útil da conversão') === 1 && !(await rascunhos(pg))['nova'], 'cancelar antes de criar a demanda: a entrada continua ativa em Entradas e não sobra rascunho');
  await virarCard(pg, 'Título explícito da conversão');
  ok((await pg.inputValue('#n-assunto')) === 'Título explícito da conversão' && (await pg.inputValue('#n-descricao')) === 'Texto completo da nota\ncom duas linhas #conv2', 'com título explícito: ele é o assunto e o texto inteiro vai para a descrição');
  await pg.click('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  await virarCard(pg, 'Primeira linha com conteúdo útil');
  ok((await pg.inputValue('#n-assunto')) === 'Primeira linha com conteúdo útil' && (await pg.inputValue('#n-descricao')) === '#soetiqueta', 'primeira linha só com tags: a linha útil seguinte é o assunto e a linha de tags fica na descrição, sem perder nada');
  await pg.click('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  const semDemanda = await verQuadro(pg);
  ok(Object.values(semDemanda).flat().length === dem0, 'nenhum cancelamento criou demanda');

  // pular tarefas: a demanda fica em Cadastro e a entrada sai de Entradas
  await ir(pg);
  await virarCard(pg, 'Linha útil da conversão');
  await proximoPasso(pg, '#n-chegou');
  ok((await pg.inputValue('#n-chegou')) === '' && await contar(pg, 'Linha útil da conversão') === 1, 'passo 2: chegada e prazo vazios (nada inventado) e a entrada ainda está em Entradas, porque a demanda ainda não foi criada');
  await proximoPasso(pg, '#n-nt');
  await pg.waitForFunction(() => ![...document.querySelectorAll('.postits .postit .p-txt')].some((p) => p.textContent.includes('Linha útil da conversão')), null, { timeout: 15000 });
  ok(await contar(pg, 'Linha útil da conversão') === 0, 'criada a demanda no passo 2, a entrada sai da lista de Entradas');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await janelaFechada(pg);
  let q = await verQuadro(pg);
  ok((q['Cadastro'] ?? []).filter((a) => a === 'Linha útil da conversão').length === 1, 'pular tarefas: a demanda fica em Cadastro, uma vez');

  // concluir com tarefa: Vistos
  await ir(pg);
  await virarCard(pg, 'Título explícito da conversão');
  await proximoPasso(pg, '#n-chegou'); await proximoPasso(pg, '#n-nt');
  await pg.fill('#n-nt', 'Tarefa da conversão'); await pg.press('#n-nt', 'Enter');
  await pg.click('.modal .btn.pri'); await janelaFechada(pg);
  q = await verQuadro(pg);
  ok(q['Vistos'].filter((a) => a === 'Título explícito da conversão').length === 1, 'concluir com tarefa leva a demanda a Vistos');

  // recarregar no passo 3
  await ir(pg);
  await virarCard(pg, 'Primeira linha com conteúdo útil');
  await proximoPasso(pg, '#n-chegou'); await proximoPasso(pg, '#n-nt');
  await pg.waitForTimeout(800);
  const rn = (await rascunhos(pg))['nova'];
  ok(!!rn?.entradaId && !!rn?.demandaId && rn.passo === 3, 'o rascunho do cadastro guarda o vínculo com a entrada, a demanda criada e o passo');
  await ir(pg);
  ok(await contar(pg, 'Primeira linha com conteúdo útil') === 0, 'depois da recarga a entrada continua fora de Entradas (a conversão já estava no banco)');
  await ir(pg, '/demandas');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-nt', { timeout: 15000 });
  ok(await passoAtual(pg) === 3 && /Cadastro retomado/.test(await pg.textContent('.modal')), 'a recarga retoma o cadastro no passo das tarefas');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await janelaFechada(pg);
  q = await verQuadro(pg);
  ok(q['Cadastro'].filter((a) => a === 'Primeira linha com conteúdo útil').length === 1, 'retomar e pular: a mesma demanda, sem duplicar');

  // resposta perdida na criação: o banco criou e ligou, o aparelho não soube
  await ir(pg);
  await criar(pg, { texto: 'Conversão com resposta perdida' });
  await ir(pg);
  let c = await derrubar(pg, { entregar: true });
  await virarCard(pg, 'Conversão com resposta perdida');
  await proximoPasso(pg, '#n-chegou');
  await pg.click('.modal .btn.pri');
  await pg.waitForFunction(() => /Não foi possível salvar a demanda/.test(document.querySelector('.modal')?.textContent || ''), null, { timeout: 20000 });
  ok(c.n >= 1 && await passoAtual(pg) === 2, 'resposta perdida na conversão: a tela diz que não salvou e continua no passo 2');
  await pg.unroute('**/*');
  await ir(pg);
  ok(await contar(pg, 'Conversão com resposta perdida') === 0, 'o banco tinha criado a demanda e ligado a entrada: depois da recarga ela já saiu de Entradas');
  await ir(pg, '/demandas');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-chegou', { timeout: 15000 });
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 20000 });
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await janelaFechada(pg);
  q = await verQuadro(pg);
  ok(q['Cadastro'].filter((a) => a === 'Conversão com resposta perdida').length === 1, 'repetir a conversão depois da resposta perdida não gera segunda demanda');

  // falha pura: nada é criado e a entrada não some
  await ir(pg);
  await criar(pg, { texto: 'Conversão que falha' });
  await ir(pg);
  c = await derrubar(pg);
  await virarCard(pg, 'Conversão que falha');
  await proximoPasso(pg, '#n-chegou');
  await pg.click('.modal .btn.pri');
  await pg.waitForFunction(() => /Não foi possível salvar a demanda/.test(document.querySelector('.modal')?.textContent || ''), null, { timeout: 20000 });
  ok(await contar(pg, 'Conversão que falha') === 1, 'falha na criação: a entrada continua em Entradas (não desaparece sem a demanda)');
  await pg.unroute('**/*');
  await pg.click('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  await ir(pg);
  q = await verQuadro(pg);
  ok(!Object.values(q).flat().includes('Conversão que falha'), 'depois da falha e do cancelamento, nenhuma demanda foi criada');
  await ir(pg);
  ok(await contar(pg, 'Conversão que falha') === 1, 'e a entrada segue ativa depois de recarregar');

  // outro cadastro em andamento bloqueia a conversão
  await criar(pg, { texto: 'Bloqueio A' }); await criar(pg, { texto: 'Bloqueio B' });
  await virarCard(pg, 'Bloqueio A'); await pg.keyboard.press('Escape'); await janelaFechada(pg);
  ok(!!(await rascunhos(pg))['nova']?.entradaId, 'Esc no cadastro guarda o rascunho com o vínculo à entrada (ela segue em Entradas)');
  await pg.click(`${nota('Bloqueio B')} .pin-b.virar`);
  const av = await aviso(pg);
  ok(/cadastro de demanda em andamento/.test(av) && !(await pg.$('.modal')), 'com um cadastro em andamento, transformar outra entrada é recusado com aviso (nada se perde)');
  await virarCard(pg, 'Bloqueio A');
  ok((await pg.inputValue('#n-assunto')) === 'Bloqueio A' && /Rascunho recuperado/.test(await pg.textContent('.modal')), 'a mesma entrada retoma o cadastro em andamento');
  await pg.click('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  ok(!(await rascunhos(pg))['nova'], 'cancelar descarta o rascunho do cadastro');
  await limparTudo(pg);

  // Virar demanda pela janela da própria entrada, com alteração ainda não salva: salva primeiro e converte o texto novo
  await ir(pg);
  await criar(pg, { texto: 'Virar pela janela' });
  await abrirNota(pg, 'Virar pela janela');
  await pg.fill('#e-texto', 'Virar pela janela com alteração recente');
  await pg.click('.modal .acoes-entrada button:has-text("Virar demanda")');
  await pg.waitForSelector('#n-assunto', { timeout: 20000 });
  ok((await pg.inputValue('#n-assunto')) === 'Virar pela janela com alteração recente' && !(await pg.$('#toast.on.erro')), 'Virar demanda pela janela da entrada, com texto ainda pendente: salva antes e o cadastro abre com o texto novo (sem recusar por rascunho que já foi salvo)');
  await pg.click('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  await ir(pg);
  ok(await contar(pg, 'Virar pela janela com alteração recente') === 1 && Object.keys(await rascunhos(pg)).length === 0, 'cancelar o cadastro deixa a entrada em Entradas, com o texto novo já salvo e sem rascunho');

  // a tag de uma entrada convertida sai da barra
  await ir(pg);
  const chips2 = await pg.$$eval('.tagbar .chip', (x) => x.map((y) => y.textContent));
  ok(!chips2.some((x) => /#conv2?\b|#soetiqueta/.test(x)), 'as tags das entradas convertidas saem da barra de tags de Entradas');

  // rastreabilidade: a demanda mostra a anotação original; o Arquivo guarda a anotação, imutável
  q = await verQuadro(pg);
  await pg.click('.coluna[aria-label="Vistos"] .assunto:has-text("Título explícito da conversão")'); await pg.waitForSelector('.modal');
  await pg.waitForFunction(() => /Texto completo da nota/.test(document.querySelector('.modal .origem-entrada')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  ok(/Entrada de origem/.test(await pg.textContent('.modal')) && /Texto completo da nota/.test((await pg.textContent('.modal .origem-entrada')) || ''), 'a consulta da demanda mostra a entrada de origem, com o texto original');
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
  await ir(pg, '/arquivo'); await pg.click('.tabs [data-aba="entradas"]'); await pg.waitForSelector('.linha:has-text("Título explícito")');
  ok(/Virou demanda/.test(await pg.textContent('.linha:has-text("Título explícito")')) && !(await pg.$('.linha:has-text("Título explícito") .btn:has-text("Recuperar")')) && !(await pg.$('.linha:has-text("Título explícito") .btn:has-text("Excluir")')), 'no Arquivo a entrada convertida aparece como "Virou demanda", sem recuperar nem excluir');
  await pg.click('.linha:has-text("Título explícito") .btn:has-text("Abrir")'); await pg.waitForSelector('#e-texto');
  ok(await pg.$eval('#e-texto', (e) => e.readOnly) && await pg.$eval('#e-titulo', (e) => e.readOnly) && /virou a demanda/.test(await pg.textContent('.modal')) && !!(await pg.$('.modal .btn:has-text("Abrir a demanda")')), 'a entrada convertida abre só para leitura, ligada à demanda');
  await pg.click('.modal .btn:has-text("Abrir a demanda")'); await pg.waitForFunction(() => !!document.querySelector('.modal .resumo-chips'), null, { timeout: 10000 });
  ok(/Título explícito da conversão/.test(await pg.textContent('.modal')), 'e leva à demanda');
  await pg.keyboard.press('Escape'); await janelaFechada(pg);
}

// ================= 9) cópia dos dados com entradas =================
{
  const { pg } = t1;
  const j = await pg.evaluate(async () => (await fetch('/api/exportar')).json());
  const conv = j.entradas_arquivadas.filter((e) => e.demanda_id);
  const todasDem = [...j.demandas, ...j.arquivadas];
  ok(j.formato === 'dmanda-exportacao' && j.versao === 3 && Array.isArray(j.entradas) && Array.isArray(j.entradas_arquivadas), 'a cópia dos dados é a versão 3 e traz as entradas ativas e as arquivadas');
  ok(j.entradas.length > 5 && j.entradas.every((e) => !e.demanda_id && !e.arquivada_em) && conv.length >= 4 && conv.every((e) => todasDem.some((d) => d.id === e.demanda_id && d.entrada_id === e.id)), 'a cópia leva as entradas convertidas com o vínculo, e cada demanda de origem aponta de volta para a sua entrada');
  ok(j.entradas.every((e) => e.titulo !== undefined && e.texto !== undefined && Number.isInteger(e.cor) && typeof e.fixada === 'boolean' && Number.isInteger(e.versao) && !('user_id' in e)), 'cada entrada da cópia traz título, texto, cor, fixação e versão, sem identificador de usuário');
}

// ================= 10) computador escuro, iPad e iPhone (emulação do Edge), claro e escuro =================
const contraste = () => {
  const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const mistura = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a));
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  return [...document.querySelectorAll('.postits .postit')].map((p) => {
    const bg = rgb(getComputedStyle(p).backgroundColor);
    const pior = [...p.querySelectorAll('.p-txt, .p-tags span')].map((e) => { const cs = getComputedStyle(e); const op = parseFloat(getComputedStyle(e.closest('.p-tags') || e).opacity); return razao(mistura(rgb(cs.color), bg, Number.isNaN(op) ? 1 : op), bg); });
    return { bgLum: lum(bg), pior: pior.length ? Math.min(...pior) : 99 };
  });
};
const aparelhos = [
  ['computador escuro', { viewport: { width: 1360, height: 800 } }, 'escuro', false],
  ['iPad vertical (emulado)', { viewport: { width: 820, height: 1100 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, 'claro', true],
  ['iPad horizontal escuro (emulado)', { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, 'escuro', true],
  ['iPhone (emulado)', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 'claro', true],
  ['iPhone escuro (emulado)', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 'escuro', true],
];
for (const [nome, opcoes, tema, toque] of aparelhos) {
  const t = await novoContexto(opcoes, { tema });
  const { pg } = t;
  await ir(pg);
  const n = (await notas(pg)).length;
  ok(n >= 5, `${nome}: a grade mostra as entradas (${n})`);
  const horiz = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(horiz <= 0, `${nome}: sem rolagem horizontal`);
  const corte = await pg.$$eval('.postit .p-txt', (e) => e.filter((x) => x.scrollHeight > x.clientHeight + 1 && !x.style.webkitLineClamp).length);
  const rolagem = await pg.$$eval('.postit', (e) => e.filter((x) => getComputedStyle(x).overflowY === 'auto' || getComputedStyle(x).overflowY === 'scroll').length);
  ok(corte === 0 && rolagem === 0, `${nome}: o post-it nunca tem barra de rolagem nem texto estourando`);
  const cs = await pg.evaluate(contraste);
  ok(cs.every((c) => c.pior >= 4.5), `${nome}: texto e tags dos post-its com contraste mínimo de 4,5 (pior ${Math.min(...cs.map((c) => c.pior)).toFixed(2)})`);
  ok(tema === 'escuro' ? cs.every((c) => c.bgLum < 0.12) : cs.every((c) => c.bgLum > 0.55), `${nome}: os tons seguem o tema (${tema}): ${tema === 'escuro' ? 'escuros' : 'pastel claros'}`);
  const tam = await pg.$$eval('.postit .p-txt, .postit .p-tags, .tagbar .chip', (e) => Math.min(...e.map((x) => parseFloat(getComputedStyle(x).fontSize))));
  ok(tam >= 10, `${nome}: nenhum texto abaixo do piso de 10 px (menor ${tam.toFixed(1)} px)`);
  if (toque) {
    const vis = await pg.$$eval('.postit .pin-b', (e) => e.map((b) => { b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { op: getComputedStyle(b).opacity, no: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b || b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)), l: r.width }; }));
    ok(vis.every((v) => v.op === '1' && v.no), `${nome}: fixar e virar demanda estão visíveis e tocáveis sem hover (nenhum coberto pela nota)`);
    const alvo = await pg.$$eval('.postit .pin-b', (e) => Math.min(...e.map((b) => { const a = getComputedStyle(b, '::after'); return b.getBoundingClientRect().width + 2 * Math.abs(parseFloat(a.top) || 8); })));
    ok(alvo >= 44, `${nome}: a área de toque dos botões da nota é de pelo menos 44 px (${alvo.toFixed(0)})`);
    await pg.tap(`${nota('Portaria horário')} .pin-b:not(.virar)`);
    await pg.waitForFunction(() => [...document.querySelectorAll('.postits .postit')].find((p) => p.querySelector('.p-txt')?.textContent.includes('Portaria horário'))?.classList.contains('fixado'), null, { timeout: 10000 });
    ok(await fixa(pg, 'Portaria horário'), `${nome}: tocar em fixar funciona`);
    await pg.tap(`${nota('Portaria horário')} .pin-b:not(.virar)`);
    await pg.waitForFunction(() => ![...document.querySelectorAll('.postits .postit')].find((p) => p.querySelector('.p-txt')?.textContent.includes('Portaria horário'))?.classList.contains('fixado'), null, { timeout: 10000 });
    await pg.tap(`${nota('Cor escolhida')} .p-abrir`); await pg.waitForSelector('#e-texto');
    const campos = await pg.$$eval('.modal input:not([type=checkbox]), .modal textarea', (e) => e.map((x) => parseFloat(getComputedStyle(x).fontSize)));
    ok(campos.length >= 2 && campos.every((s) => s === 16), `${nome}: os campos da janela têm 16 px no toque (sem zoom ao focar)`);
    await pg.waitForTimeout(1100); // a janela termina a animação de abertura
    const geo = await pg.evaluate(() => { const m = document.querySelector('.modal').getBoundingClientRect(); return { l: m.left, r: m.right, b: m.bottom, w: innerWidth, h: innerHeight }; });
    const dentro = geo.l >= -1 && geo.r <= geo.w + 1 && geo.b <= geo.h + 1;
    const tocaveis = await pg.$$eval('.modal .cor-b', (e) => Math.min(...e.map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))));
    ok(dentro && tocaveis >= 44, `${nome}: a janela cabe na tela e as cores têm 44 px de toque [${JSON.stringify(geo)} cor=${tocaveis}]`);
    await pg.tap('.modal .acoes-entrada button:has-text("Arquivar")'); await janelaFechada(pg);
    ok(await contar(pg, 'Cor escolhida') === 0, `${nome}: arquivar por toque funciona (sem depender do hover)`);
    await ir(pg, '/arquivo'); await pg.tap('.tabs [data-aba="entradas"]'); await pg.waitForSelector('.linha:has-text("Cor escolhida")');
    await pg.tap('.linha:has-text("Cor escolhida") .btn:has-text("Recuperar")');
    await pg.waitForFunction(() => !/Cor escolhida/.test(document.querySelector('.main')?.textContent || ''), null, { timeout: 10000 });
    ok(true, `${nome}: recuperar por toque funciona`);
    await ir(pg);
    await pg.tap(`${nota('Cor escolhida')} .pin-b.virar`); await pg.waitForSelector('#n-assunto');
    const camposCad = await pg.$$eval('.modal input:not([type=checkbox]), .modal textarea', (e) => e.map((x) => parseFloat(getComputedStyle(x).fontSize)));
    ok(camposCad.every((s) => s === 16), `${nome}: Virar demanda por toque abre o cadastro com campos de 16 px`);
    await pg.tap('.modal .btn:has-text("Cancelar")'); await janelaFechada(pg);
  } else {
    await pg.hover(`${nota('Portaria horário')}`); await pg.waitForTimeout(400);
    const op = await pg.$eval(`${nota('Portaria horário')} .pin-b`, (b) => getComputedStyle(b).opacity);
    ok(op === '1', `${nome}: no computador os botões aparecem ao passar o mouse`);
    await pg.click('.fab'); await pg.waitForSelector('.menuplus.aberto');
    ok(/Nova entrada/.test(await pg.textContent('.menuplus')) && !(await pg.$eval('.menuplus button:has-text("Nova entrada")', (b) => b.getAttribute('aria-disabled'))), `${nome}: o botão "+" tem "Nova entrada" ativa`);
    await pg.click('.menuplus button:has-text("Nova entrada")'); await pg.waitForSelector('#e-texto');
    ok(/Nova entrada/.test(await pg.textContent('.modal')), `${nome}: "Nova entrada" do botão "+" abre a janela`);
    await pg.keyboard.press('Escape'); await janelaFechada(pg);
  }
  await t.ctx.close();
}

ok(erros.length === 0, 'sem erros de JavaScript durante os fluxos' + (erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''));
await nav.close(); parar();
await new Promise((r) => setTimeout(r, 2500));

// leitura direta do que ficou gravado
const db = await abrirBancoTeste({ pasta: PASTA });
const linhas = (await db.query('select titulo, texto, cor, fixada, arquivada_em is not null as arq, demanda_id from public.entradas order by criado_em')).rows;
const tx = (v) => linhas.filter((x) => x.texto === v).length;
ok(linhas.filter((x) => x.arq).length === 0 && tx('nnn') === 1 && !linhas.some((x) => /Diárias/.test(x.texto)), 'banco: nenhuma arquivada pendente (a excluída saiu, a recuperada voltou) e o que foi digitado antes do Esc foi salvo');
ok(tx('Resposta perdida da entrada') === 1 && tx('Perdida e recarregada') === 1 && tx('Clique duplo no Guardar') === 1 && tx('Escrita com o navegador offline') === 1, 'banco: resposta perdida, recarga e clique duplo geraram uma única entrada cada');
ok(tx('A depois') === 1 && tx('B terceiro') === 1 && tx('A manda') === 0 && tx('A perde') === 0 && tx('B primeiro') === 0 && tx('B segundo') === 0, 'banco: edição simultânea: a versão em conflito virou entrada nova e "usar a do outro" descartou a versão local (o texto final é o do outro aparelho)');
await db.close();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
