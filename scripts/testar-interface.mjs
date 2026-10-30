// Regressões de interface do bloco de 29/10/2026 (decisões 34 e 35), no navegador (Edge) com o banco local de TESTE (PGlite, mesmas migrações do Supabase):
//   1) toda demanda nova nasce em Cadastro, também pelos botões do Quadro;
//   2) o cadastro guiado sobrevive à recarga (passo das tarefas, tarefa em edição, demanda já criada) e nunca duplica a demanda, nem com a resposta perdida;
//   3) cards: o título tem prioridade sobre a descrição em vários tamanhos de janela, zooms e aparelhos emulados, nunca fica cortado ao meio e a descrição volta quando há espaço;
//   4) tipografia: escala única de 85% (--esc) aplicada uma só vez, sem zoom nem transform, com as exceções documentadas (piso de 10 px e campos de 16 px no toque).
// Sobe o próprio servidor numa porta separada, com pasta de dados nova. NÃO valida o Supabase real. Uso: node scripts/testar-interface.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { abrirBancoTeste } from '../src/servidor/banco-teste-base.mjs';

const PORTA = process.env.PORTA_TESTE_INTERFACE || '7104', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/interface';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste-1234567890' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };

for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const novoContexto = async (opcoes, { visao = 'cards', tema = 'claro' } = {}) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.addInitScript(([v, t]) => { try { if (!localStorage.getItem('dmanda:ui')) localStorage.setItem('dmanda:ui', JSON.stringify({ visao: v })); if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, [visao, tema]);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  return { ctx, pg };
};
// Depois de carregar, a tela ainda precisa aplicar a visão guardada no navegador (Cards, Quadro, Tabela ou Lista): o aplicativo lê essa preferência depois da hidratação e as ações do servidor
// do início (demandas, ambiente, dias, rotina, entradas) rodam uma de cada vez, então a visão guardada aparece de 0,1 a 0,5 s DEPOIS de os dados chegarem (medido, e igual na versão anterior ao
// bloco de Entradas). Por isso o "ir" espera explicitamente a visão pedida (ou o estado vazio, ou o erro de carga), com limite, e falha com o retrato da tela.
const VISAO_SEL = { cards: '.cards .dcard', quadro: '.quadro .coluna', tabela: '.tabela tbody tr', lista: '.lista .linha' };
const ir = async (pg, rota = '/demandas') => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !document.body.innerText.includes('Carregando as demandas'), null, { timeout: 120000 });
  if (rota === '/demandas') {
    await pg.waitForFunction(([sel]) => {
      let v = 'cards'; try { v = JSON.parse(localStorage.getItem('dmanda:ui') || '{}').visao || 'cards'; } catch { /* preferência ilegível: Cards */ }
      return !!document.querySelector(sel[v]) || !!document.querySelector('.vazio, .erro-carga');
    }, [VISAO_SEL], { timeout: 30000 }).catch(async () => {
      const retrato = await pg.evaluate(() => ({ visao: localStorage.getItem('dmanda:ui'), colunas: document.querySelectorAll('.coluna').length, cards: document.querySelectorAll('.dcard').length, vazio: !!document.querySelector('.vazio'), erroCarga: document.querySelector('.erro-carga')?.textContent?.slice(0, 120) ?? null, texto: document.querySelector('.main')?.innerText.slice(0, 160) }));
      throw new Error('a visão guardada não apareceu em 30 s: ' + JSON.stringify(retrato));
    });
  }
  await pg.waitForTimeout(300);
};
const fecharJanela = async (pg) => { await pg.click('.modal [aria-label="Fechar"]'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 8000 }); };
const passoAtual = (pg) => pg.$$eval('.modal .passos li', (e) => e.findIndex((x) => x.getAttribute('aria-current') === 'step') + 1);
const rascunhos = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('dmanda:rascunhos') || '{}'); } catch { return {}; } });
const colunas = async (pg) => { await pg.waitForSelector('.coluna', { timeout: 15000 }); await pg.waitForTimeout(250); return pg.$$eval('.coluna', (cs) => Object.fromEntries(cs.map((c) => [c.getAttribute('aria-label'), [...c.querySelectorAll('.assunto')].map((x) => x.textContent.trim())]))) };
// cria pelo botão da barra de ferramentas (Cards, Tabela, Lista) ou pelo "+" do menu, sempre pelo caminho curto
const cadastrar = async (pg, c, { botao = '.toolbar .btn.escuro' } = {}) => {
  await pg.click(botao); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', c.assunto); if (c.numero) await pg.fill('#n-num', c.numero); if (c.origem) await pg.fill('#n-origem', c.origem); if (c.descricao) await pg.fill('#n-descricao', c.descricao);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  if (c.dias) await pg.click(`.modal .dias-btns button:has-text("${c.dias} dias")`);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 20000 });
};

// ================= 1) e 2) cadastro guiado =================
{
  const { ctx, pg } = await novoContexto({ viewport: { width: 1360, height: 800 } }, { visao: 'quadro' });
  await ir(pg);
  ok(!!(await pg.$('.vazio')), 'banco novo: Quadro mostra o estado vazio (sem colunas) até existir a primeira demanda');
  await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'cards' }))); await ir(pg);
  await cadastrar(pg, { assunto: 'Primeira demanda' });
  await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'quadro' }))); await ir(pg);

  // 1) botões do Quadro
  const botoes = await pg.$$eval('.coluna', (cs) => Object.fromEntries(cs.map((c) => [c.getAttribute('aria-label'), [...c.querySelectorAll('header button, button.nova')].map((b) => b.getAttribute('aria-label') || b.textContent.trim())])));
  ok(botoes['Cadastro'].length === 2 && ['Vistos', 'Fazendo', 'Aguardando retorno', 'Finalizado'].every((e) => botoes[e].length === 0), 'Quadro: só a coluna Cadastro oferece "Nova demanda" (nenhuma outra coluna sugere criar direto em outra etapa)');
  await pg.click('.coluna[aria-label="Cadastro"] button.nova'); await pg.waitForSelector('#n-assunto');
  const tituloJanela = await pg.textContent('.modal');
  ok(/Nova demanda/.test(tituloJanela) && !/Nova demanda em /.test(tituloJanela), 'o título da janela é sempre "Nova demanda", sem etapa de destino');
  await pg.fill('#n-assunto', 'Criada pelo botão da coluna'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  let col = await colunas(pg);
  ok(col['Cadastro'].includes('Criada pelo botão da coluna') && !col['Vistos'].includes('Criada pelo botão da coluna'), 'a demanda criada pelo botão do Quadro nasce em Cadastro');
  await pg.fill('#n-nt', 'Tarefa A'); await pg.press('#n-nt', 'Enter'); await pg.click('.modal .btn.pri'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
  col = await colunas(pg);
  ok(col['Vistos'].includes('Criada pelo botão da coluna') && !col['Cadastro'].includes('Criada pelo botão da coluna'), 'concluir o cadastro com tarefa leva a demanda de Cadastro para Vistos (transição aprovada)');

  // 2) recarga no passo das tarefas
  await pg.click('.coluna[aria-label="Cadastro"] button.nova'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'Cadastro interrompido'); await pg.fill('#n-descricao', 'texto da descrição');
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.fill('#n-nt', 'Tarefa já adicionada'); await pg.press('#n-nt', 'Enter'); await pg.fill('#n-nt', 'Tarefa ainda digitando');
  await pg.waitForTimeout(900);
  const rasc = (await rascunhos(pg))['nova'];
  ok(!!rasc && rasc.passo === 3 && !!rasc.demandaId && !!rasc.idNovo && rasc.tarefas?.length === 1 && rasc.nt === 'Tarefa ainda digitando', 'o rascunho do cadastro guarda o passo 3, a demanda já criada, o identificador, a tarefa adicionada e a que está sendo digitada');
  await ir(pg); // recarga (equivale a encerrar e reabrir a PWA: o estado que sobra é o do navegador)
  await pg.click('.coluna[aria-label="Cadastro"] button.nova'); await pg.waitForSelector('#n-nt', { timeout: 8000 });
  ok(await passoAtual(pg) === 3 && /Cadastro retomado/.test(await pg.textContent('.modal .rec')), 'depois da recarga o cadastro é retomado no passo das tarefas, com aviso');
  ok(JSON.stringify(await pg.$$eval('.t-campo', (e) => e.map((x) => x.value))) === '["Tarefa já adicionada"]' && (await pg.inputValue('#n-nt')) === 'Tarefa ainda digitando', 'a tarefa adicionada e o texto da tarefa em digitação foram recuperados');
  col = await colunas(pg);
  ok(col['Cadastro'].filter((a) => a === 'Cadastro interrompido').length === 1, 'a demanda continua sendo uma só, em Cadastro, até o cadastro ser concluído');
  await pg.click('.modal .btn.pri'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
  col = await colunas(pg);
  ok(col['Vistos'].filter((a) => a === 'Cadastro interrompido').length === 1 && !col['Cadastro'].includes('Cadastro interrompido'), 'concluir depois da recarga leva a mesma demanda (sem duplicar) para Vistos');
  ok(Object.keys(await rascunhos(pg)).length === 0, 'terminado o cadastro, não sobra rascunho');
  await pg.click('.coluna[aria-label="Vistos"] .assunto:has-text("Cadastro interrompido")'); await pg.waitForSelector('.modal');
  const consulta = await pg.textContent('.modal');
  ok(/Tarefa já adicionada/.test(consulta) && /Tarefa ainda digitando/.test(consulta), 'a consulta mostra as duas tarefas (a adicionada e a que estava em digitação)');
  await fecharJanela(pg);

  // 2b) resposta perdida: o servidor criou a demanda, mas o aparelho não recebeu a resposta; recarregar e tentar de novo não duplica
  let derrubou = false;
  await pg.route('**/*', async (route) => {
    const r = route.request();
    if (!derrubou && r.method() === 'POST' && r.headers()['next-action']) { derrubou = true; await route.fetch(); await route.abort('failed'); return; }
    await route.continue();
  });
  await pg.click('.coluna[aria-label="Cadastro"] button.nova'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'Resposta perdida'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou'); await pg.click('.modal .btn.pri');
  await pg.waitForFunction(() => /Não foi possível salvar a demanda/.test(document.querySelector('.modal')?.textContent || ''), null, { timeout: 15000 });
  ok(derrubou && await passoAtual(pg) === 2, 'resposta perdida: a tela diz que não foi possível salvar e continua no passo 2, com o que foi digitado');
  const antesRecarga = (await rascunhos(pg))['nova'];
  ok(!!antesRecarga?.idNovo && !antesRecarga.demandaId && antesRecarga.passo === 2, 'o identificador já estava no rascunho antes da chamada (é ele que impede a duplicação depois da recarga)');
  await pg.unroute('**/*');
  await ir(pg);
  col = await colunas(pg);
  ok(col['Cadastro'].filter((a) => a === 'Resposta perdida').length === 1, 'o servidor tinha criado a demanda mesmo sem a resposta chegar: depois da recarga ela aparece uma vez');
  await pg.click('.coluna[aria-label="Cadastro"] button.nova'); await pg.waitForSelector('#n-chegou', { timeout: 8000 });
  ok(await passoAtual(pg) === 2 && (await pg.inputValue('#n-chegou')) === '', 'a recarga devolve o cadastro ao passo 2');
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 15000 });
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
  col = await colunas(pg);
  ok(col['Cadastro'].filter((a) => a === 'Resposta perdida').length === 1, 'tentar de novo com o mesmo identificador devolve a demanda que já existia: continua uma só');

  // 2c) a lista não carregou (rede ruim ao reabrir a PWA) com o cadastro parado no passo 3: o aplicativo não enxerga a demanda que já existe, mas não pode criar uma cópia
  await pg.click('.coluna[aria-label="Cadastro"] button.nova'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'Carga falhou'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.fill('#n-nt', 'Tarefa guardada'); await pg.press('#n-nt', 'Enter'); await pg.waitForTimeout(900);
  const semLista = async (route) => { const r = route.request(); if (r.method() === 'POST' && r.headers()['next-action']) await route.abort('failed'); else await route.continue(); };
  await pg.route('**/*', semLista);
  await pg.goto(BASE + '/demandas', { waitUntil: 'load' }); await pg.waitForSelector('.erro-carga', { timeout: 20000 });
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-chegou', { timeout: 8000 });
  const noPasso2 = await passoAtual(pg) === 2;
  await pg.click('.modal .btn:has-text("Voltar")'); await pg.waitForSelector('#n-assunto');
  ok(noPasso2 && (await pg.inputValue('#n-assunto')) === 'Carga falhou', 'lista não carregada: o cadastro volta ao passo 2 com o que foi digitado (a demanda não é encontrada na lista)');
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  await pg.unroute('**/*', semLista);
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 15000 });
  ok(JSON.stringify(await pg.$$eval('.t-campo', (e) => e.map((x) => x.value))) === '["Tarefa guardada"]', 'a tarefa guardada continua no passo 3 depois de salvar o passo 2 de novo');
  await pg.click('.modal .btn.pri'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
  await ir(pg);
  col = await colunas(pg);
  ok(Object.values(col).flat().filter((a) => a === 'Carga falhou').length === 1 && col['Vistos'].includes('Carga falhou'), 'mesmo sem ver a demanda, o aplicativo reutilizou o identificador: continua uma só, agora em Vistos');

  // 2d) a demanda foi alterada em outro aparelho enquanto o cadastro estava parado: concluir é recusado, nada é sobrescrito e o conteúdo digitado segue disponível
  await pg.click('.coluna[aria-label="Cadastro"] button.nova'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'Versão mudou'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.fill('#n-nt', 'Tarefa do aparelho 1'); await pg.press('#n-nt', 'Enter'); await pg.waitForTimeout(900);
  const outro = await ctx.newPage();
  await ir(outro); await outro.click('.coluna[aria-label="Cadastro"] .assunto:has-text("Versão mudou")'); await outro.waitForSelector('.modal .ler');
  await outro.click('[data-lapis="identificacao"]'); await outro.fill('#d-assunto', 'Versão mudou (editada no aparelho 2)'); await outro.click('.modal [data-salvar="identificacao"]');
  await outro.waitForFunction(() => /alterações salvas/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 15000 }); await outro.close();
  await ir(pg);
  await pg.click('.coluna[aria-label="Cadastro"] button.nova'); await pg.waitForSelector('#n-nt', { timeout: 8000 });
  await pg.click('.modal .btn.pri');
  await pg.waitForFunction(() => /alterada em outro aparelho/.test(document.querySelector('#n-erro')?.textContent || ''), null, { timeout: 15000 });
  ok(await passoAtual(pg) === 3 && JSON.stringify(await pg.$$eval('.t-campo', (e) => e.map((x) => x.value))) === '["Tarefa do aparelho 1"]', 'versão mudada: concluir é recusado com aviso claro, continua no passo 3 e a tarefa digitada continua na tela');
  col = await colunas(pg);
  ok(col['Cadastro'].includes('Versão mudou (editada no aparelho 2)') && !col['Vistos'].includes('Versão mudou (editada no aparelho 2)'), 'nada foi gravado pela recusa: a demanda segue em Cadastro com a edição do outro aparelho');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
  const guardado = Object.entries(await rascunhos(pg)).filter(([k]) => k.startsWith('d:'));
  ok(guardado.length === 1 && guardado[0][1].tarefas?.[0]?.texto === 'Tarefa do aparelho 1' && guardado[0][1].versao === 1, 'pular tarefas guarda a tarefa no rascunho da própria demanda, amarrada à versão de origem (a consulta mostrará o aviso de conflito)');
  await ctx.close();
}

// ================= 3) cards =================
const LONGO = 'Resposta ao ofício do Tribunal de Contas do Estado sobre a prestação de contas das diárias e adiantamentos pagos a servidores em viagem durante o exercício anterior';
const DESC = 'Texto de descrição bastante comprido para exercitar o limite de linhas do card: o ofício pede esclarecimentos sobre três empenhos, a conciliação com o portal da transparência e a manifestação do controle interno antes do prazo final.';
const CASOS = [
  { assunto: LONGO, descricao: DESC, numero: '1842/2026', origem: 'TCE-RS', dias: 10 },
  { assunto: 'Assunto curto', descricao: DESC, numero: '77/2026', origem: 'Câmara', dias: 5 },
  { assunto: 'Revisão do contrato de manutenção dos elevadores do prédio da prefeitura central', descricao: '', numero: '12/2026', origem: 'Secretaria de Obras', dias: 30 },
  { assunto: 'Interdisciplinaridadeconstitucionalissimamentedesproporcional palavra gigante sem espaço', descricao: DESC, numero: '3/2026', origem: 'Jurídico', dias: 20 },
  { assunto: 'Portaria que designa a comissão especial de sindicância investigativa para apuração dos fatos', descricao: 'Curta.', numero: '', origem: '', dias: 0 },
];
const medirCards = () => {
  const out = [];
  for (const art of document.querySelectorAll('.dcard')) {
    const f = art.querySelector('.face.front'), t = f.querySelector('.assunto'), ds = f.querySelector('.desc');
    const cs = getComputedStyle(t), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    const clone = t.cloneNode(true); clone.style.cssText = 'position:absolute;visibility:hidden;-webkit-line-clamp:none;display:block;overflow:visible;height:auto;width:' + t.clientWidth + 'px'; t.parentElement.appendChild(clone);
    const naturais = Math.max(1, Math.round(clone.scrollHeight / lh)); clone.remove();
    const vis = Math.round(t.clientHeight / lh), fr = f.getBoundingClientRect();
    // o texto realmente pintado: o retângulo do primeiro e do último trecho do título tem de estar dentro do cartão
    const rg = document.createRange(); rg.selectNodeContents(t); const rs = [...rg.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    const dentro = rs.length > 0 && rs.every((r) => r.top >= fr.top - 0.5 && r.bottom <= fr.bottom + 0.5);
    const visivel = (el) => !!el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).display !== 'none' && !el.classList.contains('oculto');
    out.push({
      titulo: t.textContent.trim().slice(0, 24), naturais, vis, alt: t.clientHeight, lh,
      exato: Math.abs(t.clientHeight - vis * lh) < 1.5, dentro, sobra: f.scrollHeight > f.clientHeight + 1,
      descVisivel: !!ds && visivel(ds), temDesc: !!ds,
      essenciais: !!f.querySelector('.cab .girar') && !!f.querySelector('.tags .tag') && ['.prox-t', 'button.bloco'].some((q) => visivel(f.querySelector(q))),
    });
  }
  return out;
};
{
  const { ctx, pg } = await novoContexto({ viewport: { width: 1360, height: 800 } });
  await ir(pg);
  for (const c of CASOS) await cadastrar(pg, c);
  await ctx.close();
}
const TAMANHOS = [
  ['janela de computador 1360', { viewport: { width: 1360, height: 800 } }],
  ['janela estreita 1024 (só o viewport mudou)', { viewport: { width: 1024, height: 768 } }],
  ['janela de iPad 820 (viewport, sem toque)', { viewport: { width: 820, height: 1100 } }],
  ['zoom do navegador 150% (907 px CSS, densidade 1,5)', { viewport: { width: 907, height: 600 }, deviceScaleFactor: 1.5 }],
  ['zoom do navegador 200% (680 px CSS, densidade 2)', { viewport: { width: 680, height: 600 }, deviceScaleFactor: 2 }],
  ['zoom do navegador 300% (453 px CSS, densidade 3)', { viewport: { width: 453, height: 600 }, deviceScaleFactor: 3 }],
  ['iPad emulado (toque, densidade 2)', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['iPhone emulado (toque, densidade 3)', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
];
for (const tema of ['claro', 'escuro']) {
  for (const [nome, opcoes] of TAMANHOS) {
    const { ctx, pg } = await novoContexto(opcoes, { tema });
    await ir(pg);
    await pg.waitForFunction((n) => document.querySelectorAll('.dcard').length >= n, CASOS.length, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(400);
    const r = await pg.evaluate(medirCards);
    const longos = r.filter((x) => x.naturais >= 3);
    ok(r.length === CASOS.length + 6, `${nome}, ${tema}: ${r.length} cards renderizados (esperados ${CASOS.length + 6})`);
    ok(r.every((x) => x.vis >= Math.min(x.naturais, 2)), `${nome}, ${tema}: nenhum título fica com menos de 2 linhas (ou o que o texto tiver)` + (r.filter((x) => x.vis < Math.min(x.naturais, 2)).length ? ': ' + JSON.stringify(r.filter((x) => x.vis < Math.min(x.naturais, 2)).map((x) => [x.titulo, x.vis, x.naturais])) : ''));
    ok(r.every((x) => x.exato && x.dentro && !x.sobra), `${nome}, ${tema}: título com linhas inteiras (nenhuma cortada ao meio), texto pintado dentro do cartão e sem estouro vertical`);
    ok(r.every((x) => !x.descVisivel || x.vis >= Math.min(x.naturais, 4)), `${nome}, ${tema}: a descrição só aparece quando o título já tem todas as linhas que cabem (até 4)`);
    ok(longos.length >= 1 && longos.every((x) => x.vis >= Math.min(x.naturais, 3)), `${nome}, ${tema}: títulos de 3 linhas ou mais mostram pelo menos 3, não uma faixa` + (longos.some((x) => x.vis < Math.min(x.naturais, 3)) ? ' ' + JSON.stringify(longos.map((x) => [x.titulo, x.vis, x.naturais])) : ''));
    ok(r.every((x) => x.essenciais), `${nome}, ${tema}: botão de virar, etiquetas e ação do card continuam visíveis em todos os cards`);
    await ctx.close();
  }
}
{
  // descrição some quando falta altura e volta quando há espaço; frente e verso seguem funcionando
  const { ctx, pg } = await novoContexto({ viewport: { width: 1360, height: 800 } });
  await ir(pg); await pg.waitForSelector('.dcard', { timeout: 15000 }); await pg.waitForTimeout(400);
  const cartaoA = '.dcard:has(.assunto[title^="Resposta ao ofício"])';
  const estadoA = () => pg.evaluate((sel) => { const f = document.querySelector(sel + ' .face.front'), d = f.querySelector('.desc'), t = f.querySelector('.assunto'); const lh = parseFloat(getComputedStyle(t).lineHeight); return { desc: !!d && !d.classList.contains('oculto') && d.getBoundingClientRect().height > 0, linhas: Math.round(t.clientHeight / lh), sobra: f.scrollHeight > f.clientHeight + 1 }; }, cartaoA);
  const antes = await estadoA();
  await pg.evaluate(() => { document.querySelector('.app').style.setProperty('--cardh', '230px'); window.dispatchEvent(new Event('resize')); }); await pg.waitForTimeout(500);
  const apertado = await estadoA();
  await pg.evaluate(() => { document.querySelector('.app').style.setProperty('--cardh', '340px'); window.dispatchEvent(new Event('resize')); }); await pg.waitForTimeout(500);
  const folgado = await estadoA();
  ok(antes.desc && apertado.desc === false && apertado.linhas >= 2 && !apertado.sobra, `card apertado (230 px de altura): a descrição sai, o título mantém ${apertado.linhas} linhas e nada estoura`);
  ok(folgado.desc && folgado.linhas === antes.linhas && !folgado.sobra, 'voltando a haver espaço, a descrição reaparece sozinha e o título volta ao que era');
  // redimensionar a janela inteira (zoom e viewport) também recalcula
  await pg.setViewportSize({ width: 453, height: 800 }); await pg.waitForTimeout(500);
  const estreito = await estadoA();
  await pg.setViewportSize({ width: 1360, height: 800 }); await pg.waitForTimeout(500);
  const largo = await estadoA();
  ok(!estreito.sobra && largo.desc === antes.desc && largo.linhas === antes.linhas, 'estreitar e alargar a janela recalcula o card e volta exatamente ao desenho anterior');
  await pg.click(cartaoA + ' .girar'); await pg.waitForTimeout(700);
  ok(await pg.$eval(cartaoA, (a) => a.dataset.fix === 'verso') && await pg.isVisible(cartaoA + ' .face.back .meta'), 'o verso do card continua abrindo pelo botão de virar');
  await pg.click(cartaoA + ' .face.back .girar'); await pg.waitForTimeout(700);
  ok(await pg.$eval(cartaoA, (a) => a.dataset.fix === 'frente'), 'e a frente volta pelo botão do verso');
  // os demais lugares que reutilizam as peças do card
  await pg.evaluate(() => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'quadro' }))); await ir(pg);
  await pg.waitForSelector('.mini-card', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(400);
  const mini = await pg.$$eval('.mini-card', (ms) => ms.map((m) => { const t = m.querySelector('.assunto'); return { cortado: t.scrollHeight > t.clientHeight + 1, alt: t.clientHeight, sobra: m.scrollHeight > m.clientHeight + 1 }; }));
  ok(mini.length >= CASOS.length && mini.every((m) => !m.cortado && m.alt > 0 && !m.sobra), 'Quadro (cartões menores): nenhum título cortado ou zerado, nenhum cartão com estouro' + (mini.length < CASOS.length ? ' ' + JSON.stringify(mini) : ''));
  for (const v of ['tabela', 'lista']) {
    await pg.evaluate((x) => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: x })), v); await ir(pg);
    await pg.waitForSelector(v === 'tabela' ? '.tabela tbody tr' : '.linha', { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(400);
    const itens = await pg.$$eval(v === 'tabela' ? '.tabela tbody tr' : '.linha', (ls) => ls.map((l) => { const t = l.querySelector('.assunto, td:first-child, .l-assunto') ?? l; return { txt: t.textContent.trim().length, alt: l.getBoundingClientRect().height }; }));
    ok(itens.length >= CASOS.length && itens.every((i) => i.txt > 0 && i.alt > 20), `${v === 'tabela' ? 'Tabela' : 'Lista'}: todas as demandas aparecem com altura normal e texto` + (itens.length < CASOS.length ? ' ' + JSON.stringify(itens) + ' url=' + pg.url() : ''));
  }
  await ctx.close();
}

// ================= 3b) marcar tarefa na leitura não pode bloquear a seção que está aberta =================
{
  const { ctx, pg } = await novoContexto({ viewport: { width: 1360, height: 800 } }, { visao: 'lista' });
  await ir(pg);
  const linha = '.lista-dem .linha:has(.ld-ass:has-text("Cadastro interrompido"))';
  await pg.click(`${linha} .ld-abrir`); await pg.waitForSelector('.modal .t-ler input');
  await pg.click('.modal [aria-label="Editar descrição"]'); await pg.waitForSelector('.modal textarea'); await pg.fill('.modal textarea', 'texto digitado na seção aberta');
  const travados = await pg.$$eval('.modal .t-ler input[type="checkbox"]', (c) => c.map((x) => x.disabled));
  ok(travados.length === 2 && travados.every(Boolean), 'consulta: com uma seção aberta para editar, as caixas de tarefa da leitura ficam desativadas (marcar uma subiria a versão e travaria o Salvar com um falso aviso de outro aparelho)');
  await pg.click('.modal .btn:has-text("Salvar")'); await pg.waitForFunction(() => !document.querySelector('.modal textarea'), null, { timeout: 10000 });
  ok(!(await pg.$('#m-conflito')) && (await pg.$$eval('.modal .t-ler input[type="checkbox"]', (c) => c.every((x) => !x.disabled))), 'consulta: salva a seção e as caixas de tarefa voltam a funcionar, sem aviso de conflito');
  await fecharJanela(pg); await ctx.close();
}

// ================= 3c) resposta perdida ao adicionar tarefa: resultado incerto, sem duplicar, sem apagar o texto =================
{
  const { ctx, pg } = await novoContexto({ viewport: { width: 1360, height: 800 } }, { visao: 'lista' });
  await ir(pg);
  await cadastrar(pg, { assunto: 'Tarefa perdida' }); await pg.waitForSelector('.lista-dem .linha:has(.ld-ass:has-text("Tarefa perdida"))');
  const linha = '.lista-dem .linha:has(.ld-ass:has-text("Tarefa perdida"))';
  const tarefas = () => pg.$$eval(`${linha} .linha-d .tarefas li`, (l) => l.map((x) => x.textContent.trim())).catch(() => []);
  await pg.click(`${linha} .ld-m`); await pg.waitForSelector(`${linha} .linha-d .proxima.vazia button`);
  await pg.click(`${linha} .linha-d .proxima.vazia button`); await pg.fill(`${linha} .linha-d input.t-ed`, 'Tarefa de resposta perdida');
  // o servidor grava, mas a resposta nunca chega à tela
  let perdidas = 0;
  await pg.route('**/*', async (route) => { const r = route.request(); if (r.method() === 'POST' && r.headers()['next-action'] && perdidas === 0) { perdidas++; await route.fetch(); await route.abort('failed'); return; } await route.continue(); });
  await pg.press(`${linha} .linha-d input.t-ed`, 'Enter');
  await pg.waitForFunction(() => (document.querySelector('#toast.erro')?.textContent ?? '').trim().length > 0, null, { timeout: 15000 });
  const aviso = await pg.textContent('#toast');
  ok(perdidas === 1 && !/Nada foi gravado/.test(aviso) && /não dá para saber|Sem confirmação/i.test(aviso) && /Confira/i.test(aviso), 'resposta perdida: a mensagem diz que o resultado é incerto e pede para conferir, sem afirmar que nada foi gravado ("' + aviso.slice(0, 60) + '...")');
  ok((await pg.inputValue(`${linha} .linha-d input.t-ed`)) === 'Tarefa de resposta perdida', 'resposta perdida: o texto digitado continua no campo');
  await pg.unroute('**/*');
  await pg.press(`${linha} .linha-d input.t-ed`, 'Enter');
  await pg.waitForFunction(() => [...document.querySelectorAll('.lista-dem .linha')].some((l) => l.textContent.includes('Tarefa perdida') && l.querySelectorAll('.linha-d .tarefas li').length >= 1), null, { timeout: 15000 }); await pg.waitForTimeout(600);
  ok((await tarefas()).filter((x) => /Tarefa de resposta perdida/.test(x)).length === 1, 'resposta perdida: repetir a mesma tentativa mostra uma só tarefa (a gravada antes), sem duplicar');
  const campoNovo = await pg.$(`${linha} .linha-d .proxima.vazia button`);
  ok(campoNovo === null, 'a lista agora mostra as tarefas (a demanda deixou de estar sem tarefas)');
  await ctx.close();
}

// ================= 4) tipografia =================
{
  const { ctx, pg } = await novoContexto({ viewport: { width: 1360, height: 900 } });
  await ir(pg);
  const e = await pg.evaluate(() => {
    const px = (sel) => { const el = document.querySelector(sel); return el ? parseFloat(getComputedStyle(el).fontSize) : null; };
    const app = document.querySelector('.app'), cs = getComputedStyle(app);
    return { esc: getComputedStyle(document.documentElement).getPropertyValue('--esc').trim(), base: px('.app'), h1: px('.pagehead h1'), assunto: px('.dcard .assunto'), chip: px('.dcard .chip'), btn: px('.toolbar .btn.escuro'), desc: px('.dcard .desc'), zoom: cs.zoom, transform: cs.transform, bodyZoom: getComputedStyle(document.body).zoom, campo: px('.toolbar .filtro input') };
  });
  ok(e.esc === '.85' || e.esc === '0.85', 'a escala compartilhada --esc vale 0,85');
  ok(Math.abs(e.base - 13.6) < 0.05 && Math.abs(e.assunto - 14.45) < 0.05 && Math.abs(e.btn - 11.9) < 0.05 && Math.abs(e.h1 - 28.9) < 0.05 && Math.abs(e.desc - 11.05) < 0.05, `tamanhos de texto em 85% do desenho anterior (base ${e.base}, título ${e.assunto}, botão ${e.btn}, h1 ${e.h1}, descrição ${e.desc})`);
  ok(e.chip >= 10 && e.chip < 10.5, `texto miúdo respeita o piso de 10 px (chip ${e.chip})`);
  ok(e.zoom === '1' && e.bodyZoom === '1' && (e.transform === 'none' || e.transform === ''), 'a redução não usa zoom nem transform');
  ok(Math.abs(e.campo - 13.6) < 0.05, `no computador o campo de filtro segue a escala (${e.campo})`);
  const estilos = readdirSync('src/estilos').filter((f) => f.endsWith('.css'));
  const brutos = [];
  for (const f of estilos) {
    const t = readFileSync('src/estilos/' + f, 'utf8');
    for (const m of t.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) { const antes = t.slice(Math.max(0, m.index - 6), m.index); brutos.push(f + ': ' + m[0] + ' ' + antes.trim()); }
  }
  ok(brutos.length === 1 && /app\.css: font-size: 16px/.test(brutos[0]), 'nenhum tamanho de texto fixo escapa da escala (única exceção em CSS: os campos de 16 px no toque)' + (brutos.length !== 1 ? ' ' + JSON.stringify(brutos.slice(0, 5)) : ''));
  await ctx.close();
  // toque: campos em 16 px (o Safari do iPhone e do iPad dá zoom em campos menores)
  const t = await novoContexto({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ir(t.pg);
  await t.pg.click('button[aria-label="Nova demanda"]').catch(() => t.pg.click('.toolbar .btn.escuro')); await t.pg.waitForSelector('#n-assunto');
  const campos = await t.pg.$$eval('.modal input:not([type=checkbox]):not([type=radio]), .modal textarea, .modal select', (l) => l.map((x) => parseFloat(getComputedStyle(x).fontSize)));
  const filtro = await t.pg.$eval('.toolbar .filtro input', (x) => parseFloat(getComputedStyle(x).fontSize));
  const texto = await t.pg.$eval('.modal .data', (x) => parseFloat(getComputedStyle(x).fontSize));
  ok(campos.length >= 4 && campos.every((s) => s === 16) && filtro === 16, `iPhone emulado: todos os campos de digitação têm 16 px (${campos.length} no cadastro, mais o filtro), então não há zoom ao focar`);
  ok(texto < 13, `iPhone emulado: o texto comum segue a escala (${texto} px)`);
  const horizontal = await t.pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(horizontal <= 0, 'iPhone emulado: sem rolagem horizontal');
  await t.ctx.close();
}

ok(erros.length === 0, 'sem erros de JavaScript durante os fluxos' + (erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''));
await nav.close(); parar();
await new Promise((r) => setTimeout(r, 2500));

// leitura direta do que ficou gravado
const db = await abrirBancoTeste({ pasta: PASTA });
const linhas = (await db.query("select assunto, etapa, (select count(*)::int from public.tarefas t where t.demanda_id = d.id) as n_tarefas from public.demandas d order by criado_em")).rows;
const conta = (a) => linhas.filter((l) => l.assunto === a);
ok(conta('Cadastro interrompido').length === 1 && conta('Cadastro interrompido')[0].etapa === 'Vistos' && conta('Cadastro interrompido')[0].n_tarefas === 2, 'banco: "Cadastro interrompido" existe uma vez, em Vistos, com as 2 tarefas');
ok(conta('Tarefa perdida').length === 1 && conta('Tarefa perdida')[0].n_tarefas === 1, 'banco: a tarefa de resposta perdida existe uma só vez (repetir a tentativa não duplicou)');
ok(conta('Resposta perdida').length === 1 && conta('Resposta perdida')[0].etapa === 'Cadastro', 'banco: "Resposta perdida" existe uma só vez, em Cadastro');
ok(conta('Criada pelo botão da coluna').length === 1 && conta('Criada pelo botão da coluna')[0].etapa === 'Vistos', 'banco: a demanda do botão da coluna foi criada uma vez e foi para Vistos só pela conclusão do cadastro');
await db.close();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
