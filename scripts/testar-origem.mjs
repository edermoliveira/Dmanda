// Para hoje, origem, documento associado e filtros (decisão 60) no navegador (Edge) com o banco local de TESTE (PGlite): as três vagas e a prioridade (Rápida, atrasadas, vencem hoje, sem prazo),
// reposição só da vaga liberada, arquivamento, nova urgência à parte, duas sessões, virada do dia, o dropdown Catalyst de origem e de tipo (mouse, teclado, Esc, foco, criação, duplicidade, erro),
// cadastro sem documento e o documento chegando depois, ano reconhecido ou confirmado e os filtros combinados sobre registros antigos. Computador e celular EMULADOS, claro e escuro.
// Todas as mudanças durante o teste passam pela interface (o banco de teste pertence ao servidor); as conferências no banco acontecem no fim, com o servidor parado.
// Sobe o próprio servidor na porta 7114. Nunca toca o Supabase real. Uso: node scripts/testar-origem.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';
import { escolherOpcao, valorDoSeletor } from './auxiliar-origem.mjs';

const PORTA = process.env.PORTA_TESTE_ORIGEM || '7114', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/origem', CAPTURAS = '.dados-teste/origem-capturas';
rmSync(PASTA, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });

// ---- semente fictícia (relativa ao dia de hoje do banco) ----
const USUARIO = '00000000-0000-4000-8000-000000000001';
let db = await abrirBancoTeste({ pasta: PASTA });
await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
const HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
if (Number((await db.query("select extract(epoch from date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day' - (now() at time zone 'America/Sao_Paulo'))::int as s")).rows[0].s) < 2400) throw new Error('Faltam menos de 40 minutos para a meia-noite em Brasília: o banco usa o relógio real e o dia viraria no meio do teste. Rode de novo depois da meia-noite.');
const dia = (n) => somarDias(HOJE, n);
const mk = (assunto, o = {}) => c('criar_demanda', { p: { assunto, ...o } });
// a origem desta demanda é neutra de propósito: "Prefeita" e "Gabinete" são prioridade máxima (decisão 61) e passariam à frente da regra Rápida que estas verificações medem; a prioridade tem a suíte própria testar:prioridade
await mk('Atrasada lenta', { prazo_original: dia(-5), tipo: 'Ofício', numero: '1/2026', origem: 'Iniciativa própria' });
await mk('Atrasada rapida', { prazo_original: dia(-2), rapida: true, numero: '2024/1250', origem: 'Reunião' });
await mk('Vence hoje', { prazo_original: HOJE });
await mk('Proxima em tres dias', { prazo_original: dia(3), tipo: 'Memorando', numero: '32/2026', origem: 'Pedido de colega' });
await mk('Sem prazo com acao');
const espera = await mk('Aguardando sem cobranca'); await c('mover_etapa', { p_id: espera.id, p_etapa: 'Aguardando retorno' });
await mk('Numero ambiguo', { tipo: 'Processo', numero: '2024/2025', origem: '  secretaria de obras ' });
await mk('Ano manual', { tipo: 'Ofício', numero: 'sem formato', documento_ano: 2023 });
await mk('Antiga sem nada', {});
await db.close();

const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (cond, m) => { total++; console.log((cond ? 'ok     ' : 'FALHOU ') + m); if (!cond) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const novo = async (opcoes = { viewport: { width: 1360, height: 900 } }, { tema = 'claro', instante = null } = {}) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.addInitScript((t) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, tema);
  if (instante) await ctx.clock.install({ time: instante });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  return { ctx, pg };
};
// esperas por condições observáveis (nada de pausa fixa): carga pronta, animações terminadas e geometria parada
const estavel = (pg, seletor = '.app') => pg.waitForFunction((sel) => {
  const andando = document.getAnimations().some((a) => (a.playState === 'running' || a.playState === 'pending') && a.effect?.getComputedTiming().iterations !== Infinity);
  const e = document.querySelector(sel);
  if (andando || !e) return false;
  const r = e.getBoundingClientRect(), k = sel + '|' + [r.left, r.top, r.width, r.height].map((x) => x.toFixed(1)).join();
  const ant = window.__estavelOrigem; window.__estavelOrigem = k; return ant === k;
}, seletor, { timeout: 20000, polling: 100 });
const ir = async (pg, rota) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando/.test(document.querySelector('.main')?.innerText ?? ''), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  await estavel(pg);
};
const vagas = (pg) => pg.$$eval('[data-painel="para-hoje"] [data-vaga]', (l) => l.map((e) => `${e.dataset.vaga}:${e.querySelector('.assunto')?.textContent.trim()}`));
const esperarVagas = (pg, n = 3) => pg.waitForFunction((k) => document.querySelectorAll('[data-painel="para-hoje"] [data-vaga]').length === k, n, { timeout: 30000, polling: 100 });
const toast = async (pg, re) => { await pg.waitForFunction((r) => { const t = document.querySelector('#toast'); return !!t && t.classList.contains('on') && (!r || new RegExp(r).test(t.textContent ?? '')); }, re ? re.source : null, { timeout: 15000 }); };
const assuntos = (pg) => pg.$$eval('.dcard .assunto', (e) => e.map((x) => x.textContent.trim()));
const lum = (css) => { const x = css.match(/[\d.]+/g).map(Number); return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]; };
const derrubarRede = (pg) => pg.route('**/*', (rota) => (rota.request().method() === 'POST' && rota.request().headers()['next-action'] ? rota.abort() : rota.continue()));
const abrirNova = async (pg) => { await pg.click('button[aria-label="Nova demanda"]'); await pg.waitForSelector('#n-assunto'); await estavel(pg, '.modal'); };
// vai do passo 1 ao fim do cadastro (passo 2 cria a demanda; o passo 3 pode ser pulado)
const concluirCadastro = async (pg) => {
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 20000 });
};

// ================= 1) duas sessões abrindo juntas, com as vagas vazias =================
const A = await novo(), B = await novo();
await Promise.all([ir(A.pg, '/'), ir(B.pg, '/')]);
await Promise.all([esperarVagas(A.pg), esperarVagas(B.pg)]);
const [vA, vB] = [await vagas(A.pg), await vagas(B.pg)];
ok(vA.join('|') === '1:Atrasada rapida|2:Atrasada lenta|3:Vence hoje', `Para hoje: três vagas, atrasadas primeiro e a Rápida à frente da mais atrasada (${vA.join(' | ')})`);
ok(vA.join() === vB.join(), 'duas sessões abrindo ao mesmo tempo mostram as mesmas três vagas (nenhuma demanda repetida)');
{
  const rapidas = await A.pg.$$eval('[data-painel="para-hoje"] [data-vaga]', (l) => l.map((e) => !!e.querySelector('[data-rapida]')));
  ok(rapidas.join() === 'true,false,false' && (await A.pg.$$('.dcard [data-rapida]')).length === 1, 'a marca Rápida aparece no card de Para hoje só nas demandas marcadas (vaga 1) e não nas outras');
  const stats = (await A.pg.textContent('.stats')) ?? '';
  ok(/Vencem hoje/.test(stats) && !/Para hoje/.test(stats) && /Para hoje/.test((await A.pg.textContent('[data-painel="para-hoje"] h3')) ?? ''), 'Para hoje é o painel de execução; o grupo de prazo chama-se Vencem hoje (os dois não se confundem)');
  ok(!vA.some((x) => /Aguardando sem cobranca/.test(x)), 'Para hoje: demanda que aguarda terceiros, sem cobrança devida, não entra');
  await A.pg.screenshot({ path: `${CAPTURAS}/1-para-hoje.png` });
}

// ================= 2) concluir repõe só a vaga liberada; outro aparelho vê as mesmas vagas =================
await A.pg.click('[data-vaga="2"] button:has-text("Concluir demanda")');
await A.pg.waitForFunction(() => /Proxima em tres dias/.test(document.querySelector('[data-vaga="2"]')?.textContent ?? ''), null, { timeout: 20000 });
{
  const v = await vagas(A.pg);
  ok(v.join('|') === '1:Atrasada rapida|2:Proxima em tres dias|3:Vence hoje', `concluir repõe só a vaga liberada (2); as vagas 1 e 3 continuam (${v.join(' | ')})`);
  await ir(B.pg, '/'); await esperarVagas(B.pg);
  ok((await vagas(B.pg)).join() === v.join(), 'as vagas persistem no banco: o outro aparelho, ao recarregar, vê as mesmas demandas nas mesmas posições');
}

// ================= 3) arquivar em outro aparelho: ao recarregar, só a vaga 3 muda =================
await ir(B.pg, '/demandas');
await B.pg.click('.dcard:has-text("Vence hoje") .assunto'); await B.pg.waitForSelector('.modal .ler');
await B.pg.click('.modal .m-sec:has-text("Arquivar")'); await B.pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 15000 });
await ir(A.pg, '/'); await esperarVagas(A.pg);
{
  const v = await vagas(A.pg);
  ok(v.join('|') === '1:Atrasada rapida|2:Proxima em tres dias|3:Sem prazo com acao', `arquivar libera só a sua vaga (3), reposta por uma demanda sem prazo com ação possível (${v.join(' | ')})`);
}

// ================= 4) nova urgência: destacada à parte, sem trocar a seleção; cadastro sem documento =================
await ir(B.pg, '/demandas');
await abrirNova(B.pg);
{
  const { pg } = B;
  ok((await valorDoSeletor(pg, 'n', 'tipo')) === 'Sem documento' && (await valorDoSeletor(pg, 'n', 'origem')) === 'Sem origem' && (await pg.$$('.opcoes[aria-label="Área"]')).length === 0, 'cadastro novo: o documento é opcional e começa vazio (nenhum Processo pré-selecionado, sem área) e a origem também');
  await pg.fill('#n-assunto', 'Urgencia nova');
  await escolherOpcao(pg, 'n', 'origem', 'Reunião');
  ok((await valorDoSeletor(pg, 'n', 'origem')) === 'Reunião', 'origem escolhida pelo dropdown (uma demanda que nasce de uma reunião, sem documento)');
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  await pg.fill('#n-prazo', dia(-1));
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt');
  await pg.click('.modal .btn:has-text("Pular tarefas")'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 20000 });
}
await ir(A.pg, '/'); await esperarVagas(A.pg);
{
  const v = await vagas(A.pg), nova = (await A.pg.textContent('[data-nova-urgencia]').catch(() => '')) ?? '';
  ok(v.join('|') === '1:Atrasada rapida|2:Proxima em tres dias|3:Sem prazo com acao' && /Nova urgência/.test(nova) && /Urgencia nova/.test(nova), 'uma urgência nova é destacada à parte e a seleção das vagas é preservada');
}
await A.ctx.close();

// ================= 5) virada do dia: as vagas não são reescolhidas =================
const D = await novo({ viewport: { width: 1360, height: 900 } }, { instante: new Date(`${HOJE}T23:50:00-03:00`) });
await ir(D.pg, '/'); await esperarVagas(D.pg);
{
  const antes = await vagas(D.pg);
  await D.pg.clock.fastForward(25 * 60 * 1000);   // 00h15 do dia seguinte
  await ir(D.pg, '/'); await esperarVagas(D.pg);
  const depois = await vagas(D.pg);
  ok(antes.join() === depois.join() && antes.length === 3, `virada do dia: as mesmas demandas nas mesmas posições depois da meia-noite (${depois.join(' | ')})`);
}
await D.ctx.close();

// ================= 6) dropdown de origem e de tipo: teclado, foco, Esc, criação, duplicidade e erro =================
const C = await novo();
await ir(C.pg, '/demandas');
{
  const { pg } = C;
  await abrirNova(pg);
  await pg.focus('#n-origem'); await pg.keyboard.press('ArrowDown');
  await pg.waitForSelector('.sel-pop[data-campo="origem"]');
  ok(await pg.evaluate(() => document.querySelector('#n-origem').getAttribute('aria-expanded') === 'true' && document.activeElement === document.querySelector('.sel-pop')), 'dropdown: seta para baixo abre o popover e leva o foco à lista');
  const itens = await pg.$$eval('.sel-pop li[role="option"]', (l) => l.map((e) => e.textContent.trim()));
  ok(itens[0] === 'Sem origem' && ['Prefeita', 'Reunião', 'Pedido de colega', 'Iniciativa própria'].every((n) => itens.includes(n)), `dropdown: a lista traz "Sem origem" e as origens (${itens.length}) com as padrão (${itens.join(', ')})`);
  await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => !document.querySelector('.sel-pop'));
  const escolhido = await valorDoSeletor(pg, 'n', 'origem');
  ok(escolhido === itens[1] && (await pg.evaluate(() => document.activeElement?.id)) === 'n-origem', `dropdown: setas e Enter escolhem a opção (${escolhido}) e o foco volta ao botão`);
  await pg.keyboard.press('Enter'); await pg.waitForSelector('.sel-pop');
  ok((await pg.textContent('.sel-pop li[aria-selected="true"]'))?.trim() === escolhido && (await pg.$$('.sel-pop li[aria-selected="true"] .sel-ck svg')).length === 1, 'dropdown: a opção escolhida aparece marcada (aria-selected e ícone) ao reabrir');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.sel-pop'));
  ok((await pg.evaluate(() => document.activeElement?.id)) === 'n-origem' && (await pg.$$('.modal-ov')).length === 1 && (await valorDoSeletor(pg, 'n', 'origem')) === escolhido, 'dropdown: Esc fecha só o popover, devolve o foco ao botão e mantém a janela e o valor');
  // criação: nome vazio, cancelar com Esc, criar, duplicidade
  await pg.click('#n-origem'); await pg.click('.sel-pop .sel-criar');
  await pg.click('.sel-novo .btn.pri');
  ok(/Digite o nome da origem/.test((await pg.textContent('.sel-erro')) ?? '') && (await pg.getAttribute('.sel-novo input', 'aria-invalid')) === 'true', 'criar origem: nome vazio mostra o erro e marca o campo, sem gravar');
  await pg.keyboard.press('Escape');
  ok((await pg.$$('.sel-novo')).length === 0 && (await pg.$$('.sel-pop')).length === 1, 'criar origem: Esc cancela só a criação (o popover continua aberto)');
  await pg.click('.sel-pop .sel-criar'); await pg.fill('.sel-novo input', 'Secretaria de Educação'); await pg.press('.sel-novo input', 'Enter');
  await pg.waitForFunction(() => !document.querySelector('.sel-pop'));
  ok((await valorDoSeletor(pg, 'n', 'origem')) === 'Secretaria de Educação', 'criar origem: o nome é digitado no próprio popover e a opção é escolhida depois que a gravação foi confirmada');
  await pg.click('#n-origem'); await pg.click('.sel-pop .sel-criar'); await pg.fill('.sel-novo input', '  secretaria   DE educação '); await pg.press('.sel-novo input', 'Enter');
  await pg.waitForFunction(() => !document.querySelector('.sel-pop'));
  await pg.click('#n-origem');
  const lista = await pg.$$eval('.sel-pop li[role="option"]', (l) => l.map((e) => e.textContent.trim().toLowerCase()));
  ok((await valorDoSeletor(pg, 'n', 'origem')) === 'Secretaria de Educação' && lista.filter((n) => n === 'secretaria de educação').length === 1, 'criar origem: o mesmo nome (outras letras e espaços) escolhe a opção que já existe, sem duplicar');
  await pg.keyboard.press('Escape');
  // uma origem antiga (digitada nas demandas antes das opções) é a mesma opção: digitar o nome em outras letras escolhe a antiga, sem duplicar
  await pg.click('#n-origem'); await pg.click('.sel-pop .sel-criar'); await pg.fill('.sel-novo input', 'Secretaria de Obras'); await pg.press('.sel-novo input', 'Enter');
  await pg.waitForFunction(() => !document.querySelector('.sel-pop'));
  ok((await valorDoSeletor(pg, 'n', 'origem')) === 'secretaria de obras', 'origem antiga digitada como "  secretaria de obras " é a mesma opção de "Secretaria de Obras": escolhe a que já existe, com o nome de antes');
  await pg.click('#n-origem'); await pg.click('.sel-pop li:has-text("Secretaria de Educação")');
  await pg.waitForFunction(() => !document.querySelector('.sel-pop'));
  // erro de gravação: nada é escolhido e o erro aparece
  await derrubarRede(pg);
  await pg.click('#n-origem'); await pg.click('.sel-pop .sel-criar'); await pg.fill('.sel-novo input', 'Origem sem rede'); await pg.press('.sel-novo input', 'Enter');
  await pg.waitForSelector('.sel-erro', { timeout: 20000 });
  ok((await valorDoSeletor(pg, 'n', 'origem')) === 'Secretaria de Educação' && (await pg.inputValue('.sel-novo input')) === 'Origem sem rede', 'criar origem: falha ao gravar mostra o erro, mantém o texto digitado e não escolhe nada');
  await pg.unroute('**/*'); await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape');
  await pg.waitForFunction(() => !document.querySelector('.sel-pop'));
  // tipo do documento
  await pg.click('#n-tipo'); await pg.waitForSelector('.sel-pop[data-campo="tipo"]');
  const tipos = await pg.$$eval('.sel-pop li[role="option"]', (l) => l.map((e) => e.textContent.trim()));
  ok(tipos[0] === 'Sem documento' && ['Processo', 'Memorando', 'Ofício'].every((n) => tipos.includes(n)) && (await pg.textContent('.sel-criar')) === '+ Criar tipo', 'tipo do documento: o mesmo padrão, com "Sem documento", os tipos de antes e "+ Criar tipo"');
  await pg.click('.sel-pop .sel-criar'); await pg.fill('.sel-novo input', 'Certidão'); await pg.press('.sel-novo input', 'Enter');
  await pg.waitForFunction(() => !document.querySelector('.sel-pop'));
  ok((await valorDoSeletor(pg, 'n', 'tipo')) === 'Certidão' && (await pg.$$('.opcoes[aria-label="Área"]')).length === 0, 'tipo do documento: tipo criado e escolhido (sem área, que só existe para Processo e Protocolo)');
  await escolherOpcao(pg, 'n', 'tipo', 'Processo');
  ok((await pg.$$('.opcoes[aria-label="Área"]')).length === 1, 'tipo do documento: Processo traz a escolha de área');
  await escolherOpcao(pg, 'n', 'tipo', 'Sem documento');
  ok((await valorDoSeletor(pg, 'n', 'tipo')) === 'Sem documento', 'tipo do documento: dá para voltar a "Sem documento"');
  // cadastro: uma demanda de reunião, sem documento; o memorando chega depois
  await pg.fill('#n-assunto', 'Pedido verbal da reuniao'); await escolherOpcao(pg, 'n', 'origem', 'Reunião');
  await pg.check('.modal .chk-l input');
  await concluirCadastro(pg);
  await ir(pg, '/demandas');
  ok((await assuntos(pg)).includes('Pedido verbal da reuniao'), 'cadastro sem tipo, sem número e com a marca Rápida cria a demanda');
  await pg.click('.dcard:has-text("Pedido verbal da reuniao") .assunto'); await pg.waitForSelector('.modal .ler');
  await pg.click('[data-lapis="identificacao"]'); await pg.waitForSelector('#d-assunto');
  ok((await valorDoSeletor(pg, 'd', 'tipo')) === 'Sem documento' && (await valorDoSeletor(pg, 'd', 'origem')) === 'Reunião', 'consulta: a demanda sem documento mostra a origem (Reunião) e "Sem documento"');
  await escolherOpcao(pg, 'd', 'tipo', 'Memorando'); await pg.fill('#d-num', '45/2026');
  ok(/Reconhecido pelo número: 2026/.test((await pg.textContent('.modal')) ?? ''), 'o memorando chega depois: o ano 2026 é reconhecido pelo número "45/2026", que fica como foi informado');
  await pg.click('.modal [data-salvar="identificacao"]'); await toast(pg, /alterações salvas|Identificação/);
  ok(/Memorando/.test((await pg.textContent('.modal .ler')) ?? '') && /45\/2026/.test((await pg.textContent('.modal .ler')) ?? '') && /Reunião/.test((await pg.textContent('.modal .ler')) ?? '') && /Rápida/.test((await pg.textContent('.modal .ler')) ?? ''), 'consulta: o tipo, o número, a origem e a marca Rápida aparecem depois de salvar');
  await pg.click('[data-lapis="identificacao"]'); await pg.fill('#d-ano', '2025');
  await pg.click('.modal [data-salvar="identificacao"]'); await pg.waitForFunction(() => /2025/.test(document.querySelector('.modal .ler')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => {});
  ok(/2025/.test((await pg.textContent('.modal .ler')) ?? '') && /45\/2026/.test((await pg.textContent('.modal .ler')) ?? '') && !/reconhecido pelo número/.test((await pg.textContent('.modal .ler')) ?? ''), 'o ano confirmado à mão (2025) vale no lugar do reconhecido, e o número continua "45/2026"');
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 15000 });
}

// ================= 7) filtros combinados sobre registros antigos =================
{
  const { pg } = C;
  await ir(pg, '/demandas');
  const filtrar = async (o) => {
    await pg.click('[data-filtros]'); await pg.waitForSelector('.painel-filtros');
    await pg.selectOption('#f-origem', o.origem ?? ''); await pg.selectOption('#f-tipo', o.tipo ?? ''); await pg.selectOption('#f-ano', o.ano ?? '');
    await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.painel-filtros'));
    await estavel(pg, '.main');
    return assuntos(pg);
  };
  const todos = await filtrar({});
  ok(['Antiga sem nada', 'Numero ambiguo', 'Ano manual', 'Atrasada rapida'].every((a) => todos.includes(a)), 'Todos: demandas sem origem, sem documento, sem ano ou de número ambíguo continuam na lista');
  const a2024 = await filtrar({ ano: '2024' });
  ok(a2024.includes('Atrasada rapida') && !a2024.includes('Numero ambiguo') && !a2024.includes('Antiga sem nada'), 'ano 2024: reconhece "2024/1250" nos registros antigos; "2024/2025" (ambíguo) fica sem ano');
  const a2026 = await filtrar({ ano: '2026' });
  ok(a2026.includes('Atrasada lenta') && a2026.includes('Proxima em tres dias'), 'ano 2026: reconhece "1/2026" e "32/2026"');
  ok((await filtrar({ ano: '2023' })).join() === 'Ano manual', 'ano 2023: o ano confirmado à mão vale mesmo com o número fora de formato');
  const ofMemo = await filtrar({ tipo: 'Memorando', ano: '2026' });
  ok(ofMemo.includes('Proxima em tres dias') && !ofMemo.includes('Atrasada lenta'), 'tipo e ano combinados: Memorando de 2026');
  const reuniao = await filtrar({ origem: 'Reunião' });
  ok(reuniao.includes('Atrasada rapida') && reuniao.includes('Urgencia nova') && !reuniao.includes('Atrasada lenta'), 'origem: Reunião');
  const combo = await filtrar({ origem: 'Reunião', ano: '2024', tipo: '' });
  ok(combo.join() === 'Atrasada rapida', 'origem e ano combinados: Reunião em 2024');
  const obras = await filtrar({ origem: 'secretaria de obras' });
  ok(obras.includes('Numero ambiguo'), 'origem antiga digitada "  secretaria de obras " aparece sob a opção "Secretaria de Obras", sem duplicar');
  await filtrar({});
  ok((await assuntos(pg)).length === todos.length, 'limpar os filtros volta a todas as demandas');
}
await C.ctx.close();

// ================= 8) celular (390 px), claro e escuro: o dropdown cabe e tem alvos de 44 px =================
for (const [nome, tema] of [['celular claro', 'claro'], ['celular escuro', 'escuro']]) {
  const M = await novo({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, { tema });
  await ir(M.pg, '/demandas'); await abrirNova(M.pg);
  await M.pg.tap('#n-origem'); await M.pg.waitForSelector('.sel-pop'); await estavel(M.pg, '.sel-pop');
  const m = await M.pg.evaluate(() => { const p = document.querySelector('.sel-pop'), r = p.getBoundingClientRect(), li = [...p.querySelectorAll('li')], cs = getComputedStyle(p), ct = getComputedStyle(p.querySelector('li')); return { dentro: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, minAlt: Math.min(...li.map((e) => e.getBoundingClientRect().height)), rolaX: document.documentElement.scrollWidth > innerWidth + 1, fundo: cs.backgroundColor, texto: ct.color }; });
  ok(m.dentro && m.minAlt >= 44 && !m.rolaX, `${nome}: o popover cabe na tela, sem rolagem lateral, com linhas de ${Math.round(m.minAlt)} px`);
  ok(tema === 'escuro' ? lum(m.fundo) < 110 && lum(m.texto) > 120 : lum(m.fundo) > 150 && lum(m.texto) < 120, `${nome}: o popover tem fundo e letra de lados opostos`);
  await M.pg.screenshot({ path: `${CAPTURAS}/8-${nome.replace(/ /g, '-')}.png` });
  await M.pg.keyboard.press('Escape');
  await M.ctx.close();
}
await B.ctx.close();

// ================= 9) fechamento: o banco guarda o que a interface mostrou =================
parar(); await new Promise((r) => setTimeout(r, 2500));
db = await abrirBancoTeste({ pasta: PASTA });
{
  const q = async (sql, p = []) => (await db.query(sql, p)).rows;
  const vg = await q('select p.posicao, d.assunto from public.para_hoje p join public.demandas d on d.id = p.demanda_id order by p.posicao');
  ok(vg.length === 3 && vg.map((v) => v.posicao).join() === '1,2,3', `banco: exatamente três vagas, uma por posição (${vg.map((v) => v.assunto).join(' | ')})`);
  const [pv] = await q("select tipo, origem, numero, rapida, documento_ano from public.demandas where assunto = 'Pedido verbal da reuniao'");
  ok(pv.tipo === 'Memorando' && pv.origem === 'Reunião' && pv.numero === '45/2026' && pv.rapida === true && pv.documento_ano === 2025, 'banco: a demanda de reunião ficou com o memorando, o número como informado, a marca Rápida e o ano confirmado');
  const [un] = await q("select tipo, origem from public.demandas where assunto = 'Urgencia nova'");
  ok(un.tipo === null && un.origem === 'Reunião', 'banco: a demanda criada sem documento tem tipo nulo (nada inventado)');
  const ops = await q("select campo, nome from public.opcoes where chave in ('secretaria de obras', 'secretaria de educação', 'certidão', 'origem sem rede') order by nome");
  ok(ops.length === 3 && ops.some((o) => o.nome === 'secretaria de obras') && ops.some((o) => o.nome === 'Secretaria de Educação') && ops.some((o) => o.nome === 'Certidão'), 'banco: as opções criadas existem uma vez só (sem duplicar, com a origem antiga mantida e sem a tentativa que falhou)');
  const antigas = await q("select assunto, tipo, numero, origem from public.demandas where assunto in ('Atrasada lenta', 'Antiga sem nada', 'Numero ambiguo') order by assunto");
  ok(antigas.find((x) => x.assunto === 'Atrasada lenta').tipo === 'Ofício' && antigas.find((x) => x.assunto === 'Antiga sem nada').tipo === null && antigas.find((x) => x.assunto === 'Numero ambiguo').numero === '2024/2025', 'banco: os valores antigos (tipo, número e origem) seguem como estavam');
}
await db.close();
await nav.close();

ok(erros.length === 0, 'nenhum erro de console ou de página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
console.log(`\n${total - falhas}/${total} verificações passaram. Capturas para olhar: ${CAPTURAS}`);
process.exit(falhas ? 1 : 0);
