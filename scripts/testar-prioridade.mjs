// Prioridade da Prefeita e do Gabinete (decisão 61) no navegador (Edge) com o banco local de TESTE (PGlite), só com dados fictícios. Cobre:
//   fase A (as quatro visões de Demandas): as prioritárias (campo Origem) antes das comuns, inclusive vencidas, sem prazo ou com prazo futuro; nomes equivalentes reconhecidos e falsos positivos
//     rejeitados (assunto, descrição, etapa Aguardando Prefeita, outro gabinete); a fila de Aguardando Prefeita (espera mais antiga primeiro, contagem e alerta no 11º dia) com o selo ao lado da espera;
//     finalizada e arquivada fora da fila; filtros e contadores de vencimento preservados; Tabela com a coluna ordenando dentro de cada grupo; borda distinta e selo "Prioridade da Prefeita";
//     computador e celular EMULADOS, claro e escuro, sem barra de rolagem nos cards.
//   fase B (Para hoje e mudança de origem pela interface): as três vagas cheias de comuns; uma delas vira prioritária (aparece antes, mantém a vaga gravada); uma prioritária nova entra "fora das vagas"
//     acima das comuns; nenhuma vaga é substituída nem duplicada; trocar a origem ou a etapa atualiza a prioridade depois da gravação confirmada; recarregar mantém tudo.
// Sobe o próprio servidor na porta 7117. Nunca toca o Supabase real. Uso: node scripts/testar-prioridade.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';
import { escolherOpcao } from './auxiliar-origem.mjs';

const PORTA = process.env.PORTA_TESTE_PRIORIDADE || '7117', BASE = `http://localhost:${PORTA}`;
const PASTA_A = '.dados-teste/prioridade-a', PASTA_B = '.dados-teste/prioridade-b', CAPTURAS = '.dados-teste/prioridade-capturas';
rmSync(PASTA_A, { recursive: true, force: true }); rmSync(PASTA_B, { recursive: true, force: true }); rmSync(CAPTURAS, { recursive: true, force: true }); mkdirSync(CAPTURAS, { recursive: true });

const USUARIO = '00000000-0000-4000-8000-000000000001';
let HOJE = null;
// semente fictícia relativa ao dia de hoje do banco; o servidor só sobe depois que o banco é fechado
const semear = async (pasta, montar) => {
  const db = await abrirBancoTeste({ pasta });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
  if (Number((await db.query("select extract(epoch from date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day' - (now() at time zone 'America/Sao_Paulo'))::int as s")).rows[0].s) < 2400) throw new Error('Faltam menos de 40 minutos para a meia-noite em Brasília: rode o teste depois da virada do dia.');
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  await montar({ db, c, dia: (n) => somarDias(HOJE, n), mk: (assunto, o = {}) => c('criar_demanda', { p: { assunto, ...o } }) });
  await db.close();
};
const diasAtras = (db, id, n) => db.query(`update public.demandas set etapa_desde = now() - interval '${n} days' where id = $1`, [id]);

let servidor = null;
const parar = () => { try { if (servidor) spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; };
process.on('exit', parar);
const subir = async (pasta) => {
  parar();
  // só sobe o servidor da próxima fase depois que a porta ficou livre: com o computador sem memória o servidor antigo demora a morrer e responderia no lugar do novo (dados da fase anterior)
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/login', { signal: AbortSignal.timeout(1500) }); } catch { break; } await new Promise((r) => setTimeout(r, 1000)); }
  servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_SEM_CLIMA: 'sim', DMANDA_PASTA_TESTE: pasta }, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) return; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }
  throw new Error('o servidor de teste não subiu');
};
let falhas = 0, total = 0;
const ok = (cond, m) => { total++; console.log((cond ? 'ok     ' : 'FALHOU ') + m); if (!cond) falhas++; };

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const novo = async (opcoes = { viewport: { width: 1360, height: 900 } }, { tema = 'claro', visao = 'cards' } = {}) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.addInitScript(([t, v]) => { try { if (!localStorage.getItem('dmanda-tema')) localStorage.setItem('dmanda-tema', JSON.stringify(t)); if (!localStorage.getItem('dmanda:ui')) localStorage.setItem('dmanda:ui', JSON.stringify({ visao: v })); } catch { /* sem armazenamento */ } }, [tema, visao]);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  return { ctx, pg };
};
const estavel = (pg, seletor = '.app') => pg.waitForFunction((sel) => {
  const andando = document.getAnimations().some((a) => (a.playState === 'running' || a.playState === 'pending') && a.effect?.getComputedTiming().iterations !== Infinity);
  const e = document.querySelector(sel);
  if (andando || !e) return false;
  const r = e.getBoundingClientRect(), k = sel + '|' + [r.left, r.top, r.width, r.height].map((x) => x.toFixed(1)).join();
  const ant = window.__estavelPrio; window.__estavelPrio = k; return ant === k;
}, seletor, { timeout: 20000, polling: 100 });
const VISAO_SEL = { cards: '.cards .dcard', quadro: '.quadro .coluna', tabela: '.tabela tbody tr', lista: '.lista .linha' };
const ir = async (pg, rota = '/demandas') => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando/.test(document.querySelector('.main')?.innerText ?? ''), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  if (rota === '/demandas') await pg.waitForFunction(([sel]) => { let v = 'cards'; try { v = JSON.parse(localStorage.getItem('dmanda:ui') || '{}').visao || 'cards'; } catch { /* Cards */ } return !!document.querySelector(sel[v]); }, [VISAO_SEL], { timeout: 30000 });
  await estavel(pg);
};
const trocarVisao = async (pg, v) => { await pg.evaluate((x) => localStorage.setItem('dmanda:ui', JSON.stringify({ visao: x })), v); await ir(pg); };
const cardsOrdem = (pg) => pg.$$eval('.cards .dcard', (l) => l.map((x) => ({ a: x.querySelector('.assunto')?.textContent.trim(), p: x.dataset.prioridade ?? null, venc: x.classList.contains('atrasada'), selo: !!x.querySelector('[data-selo-prioridade]') })));
const SELO = 'Prioridade da Prefeita';

// ================================== fase A: as quatro visões de Demandas ==================================
await semear(PASTA_A, async ({ db, c, dia, mk }) => {
  await mk('Comum vencida', { prazo_original: dia(-4), origem: 'Reunião', numero: '10/2026' });
  await mk('Comum vence hoje', { prazo_original: HOJE, origem: 'Pedido de colega' });
  await mk('Prefeita sem prazo', { origem: 'Prefeita' });
  await mk('Gabinete futuro', { prazo_original: dia(20), origem: 'Pedido do Gabinete' });
  await mk('Solicitação vencida', { prazo_original: dia(-1), origem: '  solicitação  da PREFEITA ' });
  await mk('Menção no assunto', { origem: 'Reunião', descricao: 'Solicitação do Gabinete da Prefeita sobre o prédio', prazo_original: dia(-6) });
  await mk('Pedido da Prefeita no assunto', { origem: 'Iniciativa própria', prazo_original: dia(-7) });
  await mk('Gabinete do vice', { origem: 'Gabinete do Vice-Prefeito', prazo_original: dia(-3) });
  await mk('Prefeitura de outro lugar', { origem: 'Prefeitura de Gramado', prazo_original: dia(-2) });
  const f = await mk('Finalizada da Prefeita', { origem: 'Prefeita', prazo_original: dia(-8) }); await c('concluir_demanda', { p_id: f.id });
  const q = await mk('Arquivada da Prefeita', { origem: 'Prefeita' }); await c('arquivar_demanda', { p_id: q.id });
  // Aguardando Prefeita: a origem decide a prioridade, a etapa não; a fila segue a espera
  const ap = async (assunto, origem, dias) => { const d = await mk(assunto, { origem }); await c('mover_etapa', { p_id: d.id, p_etapa: 'Aguardando Prefeita' }); await diasAtras(db, d.id, dias); };
  await ap('AP comum antiga', 'Reunião', 15); await ap('AP gabinete antiga', 'Gabinete', 14); await ap('AP prefeita recente', 'Prefeita', 3); await ap('AP sem origem', '', 6);
});
await subir(PASTA_A);

const PRIORITARIAS = ['Prefeita sem prazo', 'Gabinete futuro', 'Solicitação vencida', 'AP gabinete antiga', 'AP prefeita recente'];
const COMUNS = ['Comum vencida', 'Comum vence hoje', 'Menção no assunto', 'Pedido da Prefeita no assunto', 'Gabinete do vice', 'Prefeitura de outro lugar', 'Finalizada da Prefeita', 'AP comum antiga', 'AP sem origem'];
{
  const { ctx, pg } = await novo(); await ir(pg);
  // ---- Cards
  const l = await cardsOrdem(pg), nomes = l.map((x) => x.a);
  const idx = (a) => nomes.indexOf(a);
  ok(PRIORITARIAS.every((a) => idx(a) >= 0) && COMUNS.every((a) => idx(a) >= 0), `Cards: as demandas ativas estão na lista (${l.length} cards; a arquivada não aparece: ${!nomes.includes('Arquivada da Prefeita')})`);
  ok(Math.max(...PRIORITARIAS.map(idx)) < Math.min(...COMUNS.map(idx)), `Cards: todas as prioritárias vêm antes das comuns, inclusive das vencidas (${nomes.slice(0, 6).join(' | ')})`);
  ok(l.filter((x) => x.p === 'prefeita').map((x) => x.a).sort().join() === [...PRIORITARIAS].sort().join() && l.filter((x) => x.selo).length === PRIORITARIAS.length, 'Cards: só as 5 demandas ativas de origem prioritária têm a marca e o selo (nomes equivalentes reconhecidos)');
  ok(COMUNS.every((a) => { const x = l.find((y) => y.a === a); return x.p === null && !x.selo; }), 'Cards: menção no assunto ou na descrição, outro gabinete, outra prefeitura, a etapa Aguardando Prefeita sozinha e a finalizada NÃO ganham a marca');
  const venc = l.filter((x) => x.venc).map((x) => x.a);
  ok(['Solicitação vencida', 'Comum vencida'].every((a) => venc.includes(a)) && idx('Solicitação vencida') < idx('Comum vencida'), 'Cards: o sinal de vencido continua nos cards (e a prioritária vencida vem antes da comum vencida)');
  ok((await pg.textContent('.dcard[data-prioridade="prefeita"] [data-selo-prioridade]')).trim() === SELO, `Cards: o selo textual diz "${SELO}"`);
  // relações de vencimento preservadas no card prioritário
  const futuro = await pg.textContent('.dcard:has-text("Gabinete futuro") .chips');
  ok(/faltam 20 d|\d{1,2} [a-z]{3} · faltam/.test(futuro), 'Cards: a prioritária com prazo futuro mostra o prazo como sempre');
  const apGab = await pg.$eval('.dcard:has-text("AP gabinete antiga") .chips', (e) => ({ t: e.textContent.replace(/\s+/g, ' '), selo: !!e.querySelector('[data-selo-prioridade]'), alerta: e.querySelector('[data-espera-prefeita]')?.getAttribute('data-alerta'), dias: e.querySelector('[data-espera-prefeita]')?.getAttribute('data-dias') }));
  ok(apGab.selo && apGab.alerta === 'sim' && apGab.dias === '14' && /Aguardando Prefeita há 14 dias/.test(apGab.t), 'Aguardando Prefeita: o selo fica ao lado da informação de espera, com a contagem (14 dias) e o alerta a partir do 11º dia');
  const apRec = await pg.$eval('.dcard:has-text("AP prefeita recente") .chips', (e) => ({ selo: !!e.querySelector('[data-selo-prioridade]'), alerta: e.querySelector('[data-espera-prefeita]')?.getAttribute('data-alerta') }));
  ok(apRec.selo && apRec.alerta === 'nao', 'Aguardando Prefeita: a espera de 3 dias não tem alerta e mantém o selo');
  ok(!(await pg.$('.dcard:has-text("AP comum antiga") [data-selo-prioridade]')) && (await pg.getAttribute('.dcard:has-text("AP comum antiga") [data-espera-prefeita]', 'data-alerta')) === 'sim', 'Aguardando Prefeita: a comum antiga continua com alerta e SEM selo (a etapa não confere prioridade)');
  // borda distinta (anel do acento) só nas prioritárias
  const anel = await pg.evaluate(() => { const g = (s) => getComputedStyle(document.querySelector(s)).boxShadow; return { prio: g('.dcard[data-prioridade="prefeita"] .face.front'), comum: g('.dcard:not([data-prioridade]) .face.front') }; });
  ok(/0px 0px 0px 2px/.test(anel.prio) && !/0px 0px 0px 2px/.test(anel.comum) && anel.prio !== anel.comum, `Cards: a prioritária tem borda distinta (anel de 2 px do acento); a comum não (${anel.prio.slice(0, 40)})`);
  // sem barra de rolagem nos cards
  const rolagem = await pg.$$eval('.dcard .face.front', (l) => l.filter((f) => f.scrollHeight > f.clientHeight + 1).length);
  ok(rolagem === 0, 'Cards: nenhum card prioritário ou comum tem barra de rolagem (o ajuste ao espaço continua valendo com o selo)');
  await pg.screenshot({ path: `${CAPTURAS}/a1-cards-claro-largo.png` });

  // ---- filtros preservados: soAtrasadas ("Atrasadas") e origem
  await pg.click('[data-filtros]'); await pg.waitForSelector('#f-prazo'); await pg.selectOption('#f-prazo', 'atrasadas'); await pg.keyboard.press('Escape');
  const fa = (await cardsOrdem(pg)).map((x) => x.a);
  ok(fa.length > 0 && fa.every((a) => ['Solicitação vencida', 'Comum vencida', 'Menção no assunto', 'Pedido da Prefeita no assunto', 'Gabinete do vice', 'Prefeitura de outro lugar', 'Finalizada da Prefeita'].includes(a) === (a !== 'Finalizada da Prefeita')) && fa[0] === 'Solicitação vencida' && !fa.includes('Prefeita sem prazo') && !fa.includes('Gabinete futuro'), `filtro Atrasadas: só as vencidas aparecem (a prioridade não traz de volta o que foi filtrado) e a prioritária vencida vem primeiro (${fa.join(' | ')})`);
  await pg.click('[data-filtros]'); await pg.selectOption('#f-prazo', ''); await pg.selectOption('#f-origem', 'Prefeita'); await pg.keyboard.press('Escape');
  const fo = (await cardsOrdem(pg)).map((x) => x.a);
  ok(fo.length >= 2 && fo.every((a) => ['Prefeita sem prazo', 'AP prefeita recente', 'Finalizada da Prefeita'].includes(a)) && fo.indexOf('Finalizada da Prefeita') === fo.length - 1, `filtro Origem = Prefeita: só essa origem, e a finalizada (comum) fica depois das ativas (${fo.join(' | ')})`);
  await pg.click('[data-filtros]'); await pg.click('button:has-text("Limpar filtros")'); await pg.keyboard.press('Escape');

  // ---- contadores de vencimento do Início: contam as mesmas demandas de antes (a prioridade não mexe)
  await ir(pg, '/demandas');
  await ctx.close();
}

{
  // ---- Quadro: prioritárias primeiro dentro de cada etapa; Aguardando Prefeita mantém a fila da espera
  const { ctx, pg } = await novo({ viewport: { width: 1360, height: 900 } }, { visao: 'quadro' }); await ir(pg);
  const cols = await pg.$$eval('.coluna', (cs) => Object.fromEntries(cs.map((c) => [c.getAttribute('aria-label'), [...c.querySelectorAll('.mini-card')].map((m) => ({ a: m.querySelector('.assunto')?.textContent.trim(), p: m.dataset.prioridade ?? null }))])));
  const cad = cols['Cadastro'].map((x) => x.a);
  ok(cad.indexOf('Solicitação vencida') < cad.indexOf('Comum vencida') && cad.indexOf('Prefeita sem prazo') < cad.indexOf('Comum vencida') && cad.indexOf('Gabinete futuro') < cad.indexOf('Comum vence hoje'), `Quadro: dentro de Cadastro as prioritárias vêm antes das comuns, inclusive das vencidas (${cad.slice(0, 5).join(' | ')})`);
  ok(cols['Cadastro'].filter((x) => x.p).map((x) => x.a).sort().join() === ['Gabinete futuro', 'Prefeita sem prazo', 'Solicitação vencida'].sort().join(), 'Quadro: a marca aparece só nas prioritárias de Cadastro');
  ok(cols['Aguardando Prefeita'].map((x) => x.a).join() === 'AP comum antiga,AP gabinete antiga,AP sem origem,AP prefeita recente', `Quadro: Aguardando Prefeita mantém a fila da espera mais antiga para a mais recente, sem reordenar pela origem (${cols['Aguardando Prefeita'].map((x) => x.a).join(' | ')})`);
  ok(cols['Aguardando Prefeita'].filter((x) => x.p).map((x) => x.a).join() === 'AP gabinete antiga,AP prefeita recente', 'Quadro: em Aguardando Prefeita o selo aparece só nas de origem prioritária');
  const espera = await pg.$$eval('.coluna[aria-label="Aguardando Prefeita"] .mini-card', (l) => l.map((m) => m.querySelector('[data-espera-prefeita]')?.getAttribute('data-dias')).join());
  ok(espera === '15,14,6,3', `Quadro: a contagem de dias de espera continua (${espera}) e a coluna mostra ${cols['Aguardando Prefeita'].length} demandas`);
  const contagens = await pg.$$eval('.etapas-tabs button', (l) => l.map((b) => `${b.dataset.e}:${b.querySelector('.cnt')?.textContent}`).join());
  ok(/Cadastro:9/.test(contagens) && /Aguardando Prefeita:4/.test(contagens) && /Finalizado:1/.test(contagens), `Quadro: as contagens por etapa não mudam (${contagens})`);
  const anelM = await pg.evaluate(() => { const g = (s) => getComputedStyle(document.querySelector(s)).boxShadow; return { prio: g('.mini-card[data-prioridade="prefeita"]'), comum: g('.mini-card:not([data-prioridade])') }; });
  ok(/0px 0px 0px 2px/.test(anelM.prio) && !/0px 0px 0px 2px/.test(anelM.comum), 'Quadro: o card prioritário tem borda distinta');
  await pg.screenshot({ path: `${CAPTURAS}/a2-quadro-claro-largo.png` });
  await ctx.close();
}

{
  // ---- Lista
  const { ctx, pg } = await novo({ viewport: { width: 1360, height: 900 } }, { visao: 'lista' }); await ir(pg);
  const grupos = await pg.$$eval('.lista .grupo', (gs) => Object.fromEntries(gs.map((g) => [g.querySelector('.grupo-h b')?.textContent, [...g.querySelectorAll('.linha')].map((l) => ({ a: l.querySelector('.ld-ass')?.textContent.trim(), p: l.dataset.prioridade ?? null, selo: !!l.querySelector('[data-selo-prioridade]') }))])));
  const cad = grupos['Cadastro'].map((x) => x.a);
  ok(cad.indexOf('Solicitação vencida') < cad.indexOf('Comum vencida') && cad.indexOf('Gabinete futuro') < cad.indexOf('Comum vence hoje') && cad.indexOf('Prefeita sem prazo') < cad.indexOf('Menção no assunto'), `Lista: dentro de Cadastro as prioritárias vêm primeiro (${cad.slice(0, 4).join(' | ')})`);
  ok(grupos['Aguardando Prefeita'].map((x) => x.a).join() === 'AP comum antiga,AP gabinete antiga,AP sem origem,AP prefeita recente', 'Lista: Aguardando Prefeita mantém a fila da espera mais antiga para a mais recente');
  ok(grupos['Cadastro'].filter((x) => x.p).every((x) => x.selo) && grupos['Aguardando Prefeita'].filter((x) => x.p).every((x) => x.selo) && grupos['Cadastro'].filter((x) => !x.p).every((x) => !x.selo), 'Lista: o selo está em todas as linhas marcadas e só nelas');
  const apLin = await pg.$eval('.linha:has-text("AP gabinete antiga") .ld-prazo', (e) => ({ selo: !!e.querySelector('[data-selo-prioridade]'), esp: !!e.querySelector('[data-espera-prefeita]') }));
  ok(apLin.selo && apLin.esp, 'Lista: em Aguardando Prefeita o selo fica ao lado da informação de espera');
  const marca = await pg.evaluate(() => { const g = (s) => getComputedStyle(document.querySelector(s)).boxShadow; return { prio: g('.linha[data-prioridade="prefeita"]'), comum: g('.linha:not([data-prioridade])') }; });
  ok(/inset/.test(marca.prio) && !/inset 5px/.test(marca.comum), 'Lista: a linha prioritária tem a faixa de prioridade');
  await pg.screenshot({ path: `${CAPTURAS}/a3-lista-claro-largo.png` });
  await ctx.close();
}

{
  // ---- Tabela: a coluna ordena dentro de cada grupo; inverter o sentido não tira as prioritárias do topo
  const { ctx, pg } = await novo({ viewport: { width: 1360, height: 900 } }, { visao: 'tabela' }); await ir(pg);
  const linhas = () => pg.$$eval('.tabela tbody tr', (l) => l.map((r) => ({ a: r.querySelector('td:nth-child(2) b')?.textContent.trim(), p: r.dataset.prioridade ?? null, venc: r.classList.contains('atrasada') })));
  const grupoOk = (l) => { const n = l.filter((x) => x.p).length; return l.slice(0, n).every((x) => x.p) && l.slice(n).every((x) => !x.p); };
  let l = await linhas();
  ok(grupoOk(l) && l.filter((x) => x.p).length === 5, `Tabela: ordem padrão por prazo com as 5 prioritárias no topo (${l.slice(0, 6).map((x) => x.a).join(' | ')})`);
  await pg.click('.tabela th:nth-child(2) button'); l = await linhas();
  const asc = l.map((x) => x.a);
  await pg.click('.tabela th:nth-child(2) button'); l = await linhas();
  const desc = l.map((x) => x.a);
  ok(grupoOk(await linhas()), 'Tabela: ordenar por Assunto, nos dois sentidos, mantém as prioritárias no topo');
  const topAsc = asc.slice(0, 5), topDesc = desc.slice(0, 5);
  ok([...topAsc].sort((a, b) => a.localeCompare(b, 'pt')).join() === topAsc.join() || topAsc.join() === [...topDesc].reverse().join(), `Tabela: a coluna escolhida ordena dentro do grupo e o sentido inverte só dentro dele (${topAsc.join(' | ')} / ${topDesc.join(' | ')})`);
  const marcaT = await pg.evaluate(() => { const g = (s) => getComputedStyle(document.querySelector(s + ' td:first-child')).boxShadow; return { prio: g('tr[data-prioridade="prefeita"]:not(.atrasada)') , comum: g('tr:not([data-prioridade]):not(.atrasada)') }; }).catch(() => null);
  ok(marcaT && /inset/.test(marcaT.prio) && !/inset/.test(marcaT.comum.replace(/rgba?\(0, 0, 0, 0\)/g, '')), 'Tabela: a linha prioritária tem a faixa de prioridade e a comum não');
  ok((await pg.$$('.tabela [data-selo-prioridade]')).length === 5, 'Tabela: o selo aparece nas 5 linhas prioritárias');
  await pg.screenshot({ path: `${CAPTURAS}/a4-tabela-claro-largo.png` });
  await ctx.close();
}

{
  // ---- tema escuro e celular: as quatro visões, selo legível, sem rolagem lateral, nenhum card com barra de rolagem
  const contraste = async (pg) => pg.evaluate(() => {
    const lum = (r, g, b) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    // o navegador devolve cores em vários formatos (rgb, color(srgb ...)): o canvas as normaliza para sRGB 0 a 255
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
    const el = document.querySelector('[data-selo-prioridade]'); if (!el) return null;
    let bg = { r: 255, g: 255, b: 255 };
    const pilha = []; for (let e = el; e; e = e.parentElement) pilha.push(getComputedStyle(e).backgroundColor);
    for (const css of pilha.reverse()) { const c = rgba(css); if (c.a > 0) bg = { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) }; }
    const fg = rgba(getComputedStyle(el).color), a = lum(fg.r, fg.g, fg.b), b = lum(bg.r, bg.g, bg.b);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  for (const [rotulo, opcoes, tema] of [['computador escuro', { viewport: { width: 1360, height: 900 } }, 'escuro'], ['celular claro', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'claro'], ['celular escuro', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'escuro']]) {
    for (const visao of ['cards', 'quadro', 'tabela', 'lista']) {
      const { ctx, pg } = await novo(opcoes, { tema, visao }); await ir(pg);
      if (visao === 'quadro') { await pg.click('.etapas-tabs button[data-e="Cadastro"]').catch(() => {}); await estavel(pg); }
      const n = await pg.$$eval('[data-selo-prioridade]', (l) => l.filter((e) => e.getClientRects().length).length);
      const larg = await pg.evaluate(() => ({ rolagem: document.documentElement.scrollWidth - innerWidth, cards: [...document.querySelectorAll('.face.front')].filter((f) => f.scrollHeight > f.clientHeight + 1).length }));
      const cr = await contraste(pg);
      ok(n >= 1 && larg.cards === 0 && larg.rolagem <= 1 && cr !== null && cr >= 4.5, `${rotulo}, ${visao}: selo visível (${n}), contraste ${cr?.toFixed(1)}:1, sem rolagem lateral (${larg.rolagem}px) e sem card com barra de rolagem`);
      if (visao === 'cards' || visao === 'quadro') await pg.screenshot({ path: `${CAPTURAS}/b-${rotulo.replace(' ', '-')}-${visao}.png` });
      await ctx.close();
    }
  }
}

// ================================== fase B: Para hoje e mudança de origem pela interface ==================================
await semear(PASTA_B, async ({ mk, dia }) => {
  await mk('Vaga um comum', { prazo_original: dia(-3), origem: 'Reunião' });
  await mk('Vaga dois comum', { prazo_original: dia(-2), origem: 'Pedido de colega' });
  await mk('Vaga tres comum', { prazo_original: dia(-1), origem: 'Iniciativa própria' });
  await mk('Vaga quatro comum', { prazo_original: HOJE, origem: 'Reunião' });
  await mk('Comum que sobra', { prazo_original: HOJE, origem: 'Reunião' });
});
await subir(PASTA_B);
{
  const { ctx, pg } = await novo(); await ir(pg, '/');
  const vagas = () => pg.$$eval('[data-painel="para-hoje"] .vaga', (l) => l.map((e) => `${e.dataset.vaga ?? 'fora'}:${e.querySelector('.assunto')?.textContent.trim()}`));
  const urgencias = () => pg.$$eval('[data-nova-urgencia] .assunto', (l) => l.map((e) => e.textContent.trim()));
  await pg.waitForFunction(() => document.querySelectorAll('[data-painel="para-hoje"] [data-vaga]').length === 4, null, { timeout: 30000 });
  const inicial = await vagas();
  ok(inicial.join() === '1:Vaga um comum,2:Vaga dois comum,3:Vaga tres comum,4:Vaga quatro comum' && (await urgencias()).join() === 'Comum que sobra', `Para hoje: as 4 vagas começam com as comuns mais antigas (${inicial.join(' | ')}) e a outra vencida fica na nova urgência`);

  // uma das demandas das vagas (a da vaga 3) passa a ser pedido do Gabinete: pela interface, depois da gravação confirmada
  await ir(pg, '/demandas');
  await pg.click('.dcard:has-text("Vaga tres comum") .assunto'); await pg.waitForSelector('[data-lapis="identificacao"]');
  await pg.click('[data-lapis="identificacao"]'); await escolherOpcao(pg, 'd', 'origem', 'Gabinete'); await pg.click('[data-salvar="identificacao"]');
  await pg.waitForFunction(() => !document.querySelector('[data-salvar="identificacao"]'), null, { timeout: 15000 });
  await pg.click('.modal [aria-label="Fechar"]'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 8000 });
  ok(await pg.$eval('.dcard:has-text("Vaga tres comum")', (e) => e.dataset.prioridade === 'prefeita' && !!e.querySelector('[data-selo-prioridade]')), 'mudar a origem para Gabinete: o card ganha a prioridade só depois de a gravação ser confirmada');
  const primeiroCard = (await cardsOrdem(pg))[0].a;
  ok(primeiroCard === 'Vaga tres comum', `mudar a origem: em Cards a demanda sobe ao topo (${primeiroCard})`);
  await ir(pg, '/');
  await pg.waitForSelector('[data-painel="para-hoje"] [data-vaga]');
  const depois = await vagas();
  ok(depois.join() === '3:Vaga tres comum,1:Vaga um comum,2:Vaga dois comum,4:Vaga quatro comum', `Para hoje: a prioritária que estava na vaga 3 é exibida antes das comuns, mas continua na vaga gravada 3 (${depois.join(' | ')})`);
  const ids = await pg.$$eval('[data-painel="para-hoje"] .assunto', (l) => l.map((e) => e.textContent.trim()));
  ok(new Set(ids).size === ids.length, 'Para hoje: nenhum card aparece duas vezes');

  // um pedido novo da Prefeita chega com as 4 vagas cheias: aparece fora das vagas, acima das comuns, sem tirar ninguém
  await ir(pg, '/demandas');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'Pedido novo da Prefeita'); await escolherOpcao(pg, 'n', 'origem', 'Prefeita');
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  await pg.click('.modal .dias-btns button:has-text("5 dias")');
  await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt'); await pg.click('.modal [aria-label="Fechar"]'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 15000 });
  await ir(pg, '/');
  await pg.waitForSelector('[data-painel="para-hoje"] [data-fora-vaga]', { timeout: 20000 });
  const com4 = await vagas();
  ok(com4[0] === '3:Vaga tres comum' && com4[1] === 'fora:Pedido novo da Prefeita' && com4.slice(2).join() === '1:Vaga um comum,2:Vaga dois comum,4:Vaga quatro comum', `Para hoje: com as 4 vagas cheias a nova prioritária aparece fora das vagas, acima das comuns, sem substituir nenhuma (${com4.join(' | ')})`);
  ok((await pg.$$('[data-painel="para-hoje"] [data-vaga]')).length === 3 && (await urgencias()).join() === 'Comum que sobra', 'Para hoje: continuam 4 vagas, e a nova urgência só mostra a comum (a prioritária já está acima)');
  ok(await pg.$eval('[data-fora-vaga]', (e) => !!e.querySelector('[data-selo-prioridade]') && /Fora das 4 vagas/.test(e.textContent)), 'Para hoje: o card fora das vagas traz o selo e a indicação "Fora das 4 vagas"');
  await pg.screenshot({ path: `${CAPTURAS}/c1-para-hoje-claro.png` });

  // recarregar mantém tudo (vagas guardadas no banco) e não duplica
  await ir(pg, '/'); await pg.waitForFunction(() => document.querySelectorAll('[data-painel="para-hoje"] [data-vaga]').length === 4, null, { timeout: 20000 });
  const recarregado = await vagas();
  ok(recarregado.join() === com4.join(), `Para hoje: depois de recarregar a ordem e as vagas são as mesmas (${recarregado.join(' | ')})`);

  // trocar a origem de volta tira a prioridade; trocar a ETAPA não dá nem tira prioridade
  await ir(pg, '/demandas');
  await pg.click('.dcard:has-text("Vaga tres comum") .assunto'); await pg.waitForSelector('[data-lapis="identificacao"]');
  await pg.click('[data-lapis="identificacao"]'); await escolherOpcao(pg, 'd', 'origem', 'Reunião'); await pg.click('[data-salvar="identificacao"]');
  await pg.waitForFunction(() => !document.querySelector('[data-salvar="identificacao"]'), null, { timeout: 15000 });
  await pg.click('.modal [aria-label="Fechar"]'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 8000 });
  ok(await pg.$eval('.dcard:has-text("Vaga tres comum")', (e) => e.dataset.prioridade === undefined && !e.querySelector('[data-selo-prioridade]')), 'mudar a origem de volta para Reunião: a prioridade some');
  await trocarVisao(pg, 'quadro');
  await pg.click('.mini-card:has-text("Comum que sobra") .mais'); await pg.waitForSelector('.mv-menu'); await pg.click('.mv-menu button:has-text("Aguardando Prefeita")');
  await pg.waitForFunction(() => !!document.querySelector('.coluna[aria-label="Aguardando Prefeita"] .mini-card'), null, { timeout: 15000 });
  const apCom = await pg.$eval('.coluna[aria-label="Aguardando Prefeita"] .mini-card', (e) => ({ a: e.querySelector('.assunto')?.textContent.trim(), p: e.dataset.prioridade ?? null, selo: !!e.querySelector('[data-selo-prioridade]') }));
  ok(apCom.a === 'Comum que sobra' && apCom.p === null && !apCom.selo, 'mudar a etapa para Aguardando Prefeita não dá prioridade (a origem é Reunião)');
  await pg.click('.mini-card:has-text("Pedido novo da Prefeita") .mais'); await pg.waitForSelector('.mv-menu'); await pg.click('.mv-menu button:has-text("Aguardando Prefeita")');
  await pg.waitForFunction(() => document.querySelectorAll('.coluna[aria-label="Aguardando Prefeita"] .mini-card').length === 2, null, { timeout: 15000 });
  const apPref = await pg.$eval('.coluna[aria-label="Aguardando Prefeita"] .mini-card:has-text("Pedido novo da Prefeita")', (e) => ({ p: e.dataset.prioridade ?? null, selo: !!e.querySelector('[data-selo-prioridade]'), espera: !!e.querySelector('[data-espera-prefeita]') }));
  ok(apPref.p === 'prefeita' && apPref.selo && apPref.espera, 'mudar a etapa para Aguardando Prefeita mantém a prioridade da origem Prefeita, com o selo ao lado da espera');
  await ctx.close();
}

// ================================== fechamento ==================================
parar();
await nav.close();
ok(erros.length === 0, 'nenhum erro de console ou de página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
console.log(`\n${total - falhas}/${total} verificações passaram. Capturas para olhar: ${CAPTURAS}`);
process.exit(falhas ? 1 : 0);
