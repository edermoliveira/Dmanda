// Início refinado (decisão 63) no navegador (Edge) com bancos locais de TESTE (PGlite), um por cenário (scripts/semear-inicio.mjs): quatro vagas em duas linhas de dois, três vagas em uma linha
// ou lista compacta, prioridade fora das vagas em linhas compactas, uma coluna no celular, apoio abaixo quando falta largura, alinhamento, sem barra de rolagem em card, prioridade e atraso
// juntos, ação de mover etapa e persistência após recarregar. Mede pelo DOM e pelo CSS. Sobe o próprio servidor na porta 7121. Nunca toca o Supabase real. Uso: node scripts/testar-inicio.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { abrirBancoTeste } from '../src/servidor/banco-teste-base.mjs';
import { semearCenario } from './semear-inicio.mjs';

const PORTA = process.env.PORTA_TESTE_INICIO || '7121', BASE = `http://localhost:${PORTA}`;
const DADOS = (c) => `.dados-teste/inicio/${c}`;
// o banco usa o relógio real (hoje em Brasília): perto da meia-noite o dia viraria no meio do teste
{
  const db = await abrirBancoTeste({ pasta: '.dados-teste/inicio/relogio' });
  const s = Number((await db.query("select extract(epoch from date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day' - (now() at time zone 'America/Sao_Paulo'))::int as s")).rows[0].s);
  await db.close();
  if (s < 2400) throw new Error('Faltam menos de 40 minutos para a meia-noite em Brasília: rode o teste depois da virada do dia.');
}
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
let servidor = null;
const parar = () => { if (servidor) { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; } };
process.on('exit', parar);
const subir = async (pasta) => {
  parar();
  servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_SEM_CLIMA: 'sim', DMANDA_PASTA_TESTE: pasta }, stdio: 'ignore' });
  for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) return; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 2000)); }
  throw new Error('o servidor de teste não subiu');
};
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const abrir = async (largura, esperadas, textoPct = 100) => {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  await ctx.addInitScript((a) => { try { localStorage.setItem('dmanda:aparencia', JSON.stringify(a)); } catch { /* sem armazenamento */ } }, { textoPct });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  await pg.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 });
  await pg.waitForFunction((n) => document.querySelectorAll('[data-painel="para-hoje"] [data-vaga]').length === n, esperadas, { timeout: 120000, polling: 100 });
  const agora = pg.locator('button:has-text("Agora não")'); if (await agora.count()) await agora.first().click();
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await pg.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity), null, { timeout: 15000 }).catch(() => {});
  return { ctx, pg };
};
const medir = (pg) => pg.evaluate(() => {
  const q = (s) => document.querySelector(s), r = (e) => (e ? e.getBoundingClientRect() : null);
  const grade = q('.ph-grade'), cards = [...document.querySelectorAll('.ph-grade .icard')], principal = r(q('.ini-principal')), apoio = r(q('.ini-apoio'));
  const tops = [...new Set(cards.map((c) => Math.round(r(c).top)))];
  const porLinha = tops.map((t) => cards.filter((c) => Math.round(r(c).top) === t).map((c) => Math.round(r(c).height)));
  const fora = [...document.querySelectorAll('.ph-fora .ilinha')];
  return {
    n: Number(grade?.dataset.n ?? 0), colunas: grade ? getComputedStyle(grade).gridTemplateColumns.split(' ').length : 0, linhas: tops.length,
    porLinha: tops.map((t) => cards.filter((c) => Math.round(r(c).top) === t).length), alturasIguais: porLinha.every((l) => Math.max(...l) - Math.min(...l) <= 1),
    painel: principal ? Math.round(principal.width) : 0, apoio: apoio ? Math.round(apoio.width) : 0, apoioAbaixo: !!(principal && apoio && apoio.top >= principal.bottom - 2),
    rolagemX: document.documentElement.scrollWidth - document.documentElement.clientWidth, comBarra: cards.filter((c) => c.scrollHeight > c.clientHeight + 1).length,
    esquerda: { titulo: Math.round(r(q('.pagehead h1')).left), contadores: Math.round(r(q('.ini-contadores')).left), paraHoje: Math.round(r(q('[data-painel="para-hoje"] h3')).left), grade: grade ? Math.round(r(grade).left) : null },
    descricaoVisivel: cards.length ? getComputedStyle(cards[0].querySelector('.desc') ?? cards[0]).display !== 'none' : false,
    fora: fora.length, foraAntesDaGrade: !!(fora[0] && grade && (fora[0].compareDocumentPosition(grade) & Node.DOCUMENT_POSITION_FOLLOWING)),
    vagas: [...document.querySelectorAll('[data-painel="para-hoje"] [data-vaga]')].map((e) => e.dataset.vaga).join(),
    assuntos: [...document.querySelectorAll('[data-painel="para-hoje"] .assunto')].map((e) => e.textContent.trim()),
    maisAcoes: document.querySelectorAll('.ph-grade .icard .mais[aria-haspopup="menu"]').length,
    noApoio: !!q('.ini-apoio'), apoioDepois: !!(q('.ini-principal') && q('.ini-apoio') && (q('.ini-principal').compareDocumentPosition(q('.ini-apoio')) & Node.DOCUMENT_POSITION_FOLLOWING)),
  };
});

// ================= quatro vagas =================
await semearCenario('4-vagas', DADOS('4-vagas')); await subir(DADOS('4-vagas'));
let ordem4 = [];
{
  const { ctx, pg } = await abrir(1440, 4); const m = await medir(pg); ordem4 = m.assuntos;
  ok(m.n === 4 && m.colunas === 2 && m.linhas === 2 && m.porLinha.join() === '2,2', `quatro vagas no desktop: duas linhas de dois (colunas ${m.colunas}, por linha ${m.porLinha.join('+')})`);
  ok(m.alturasIguais && m.comBarra === 0 && m.rolagemX <= 1, `cards da mesma linha com a mesma altura, nenhum com barra de rolagem e sem rolagem lateral (${m.rolagemX}px)`);
  ok(!m.apoioAbaixo && m.apoio >= 240 && m.apoio <= 300 && m.painel > m.apoio * 2.5, `o apoio fica ao lado e é bem menor que Para hoje (apoio ${m.apoio}px, painel ${m.painel}px)`);
  ok(new Set(Object.values(m.esquerda)).size === 1, `título, contadores, Para hoje e grade começam no mesmo ponto (${JSON.stringify(m.esquerda)})`);
  ok(m.vagas === '1,2,3,4' && m.maisAcoes === 4, `as quatro posições gravadas aparecem (${m.vagas}) e cada card tem a ação de mover de etapa`);
  const sinais = await pg.$eval('.ph-grade .icard.prio-pref.atrasada', (e) => ({ selo: !!e.querySelector('[data-selo-prioridade]'), venc: /Prazo vencido/.test(e.querySelector('.pz.venc')?.textContent ?? ''), borda: getComputedStyle(e).boxShadow !== 'none', prioridade: e.dataset.prioridade }));
  ok(sinais.selo && sinais.venc && sinais.borda && sinais.prioridade === 'prefeita', 'prioritária vencida: o selo, o anel de prioridade e o chip "Prazo vencido" aparecem juntos');
  ok(await pg.$eval('.ph-grade .icard', (e) => !!e.querySelector('.assunto') && !!e.querySelector('.prog') && !!e.querySelector('.prox-t, .btn.pri')), 'o card traz assunto, próxima tarefa (ou concluir) e progresso');
  ok(m.assuntos[0] === 'Parecer sobre o reajuste do contrato de limpeza urbana', `a prioritária vem antes das comuns (${m.assuntos[0]})`);
  ok(await pg.$$eval('[data-nova-urgencia] .ilinha', (l) => l.length > 0 && l.every((e) => !!e.querySelector('.assunto'))), 'Nova urgência aparece em linhas compactas');
  await pg.reload({ waitUntil: 'load' }); await pg.waitForFunction(() => document.querySelectorAll('[data-painel="para-hoje"] [data-vaga]').length === 4, null, { timeout: 60000 });
  ok((await medir(pg)).assuntos.join('|') === ordem4.join('|'), 'recarregar mantém as mesmas quatro demandas na mesma ordem');
  await ctx.close();
}
for (const [w, cols, abaixo] of [[1280, 2, false], [1024, 2, true], [820, 2, true], [390, 1, true]]) {
  const { ctx, pg } = await abrir(w, 4); const m = await medir(pg);
  ok(m.colunas === cols && m.apoioAbaixo === abaixo && m.rolagemX <= 1 && m.comBarra === 0 && m.apoioDepois, `${w}px: ${cols} coluna(s), apoio ${abaixo ? 'abaixo' : 'ao lado'}, Para hoje primeiro, sem rolagem lateral (colunas ${m.colunas}, rolagem ${m.rolagemX}px)`);
  await ctx.close();
}
{
  const { ctx, pg } = await abrir(1440, 4, 125); const m = await medir(pg);
  ok(m.rolagemX <= 1 && m.comBarra === 0, `texto ampliado no desktop: sem rolagem lateral e sem barra em card (${m.rolagemX}px)`);
  await ctx.close();
}
// ================= três vagas =================
await semearCenario('3-vagas', DADOS('3-vagas')); await subir(DADOS('3-vagas'));
{
  const g = await abrir(1440, 3); const mg = await medir(g.pg);
  ok(mg.n === 3 && mg.colunas === 3 && mg.linhas === 1 && mg.vagas === '1,2,3', `três vagas com largura: três cards na mesma linha (colunas ${mg.colunas}, linhas ${mg.linhas}, painel ${mg.painel}px)`);
  await g.ctx.close();
  const c = await abrir(820, 3); const mc = await medir(c.pg);
  ok(mc.n === 3 && mc.colunas === 1 && mc.linhas === 3 && !mc.descricaoVisivel && mc.comBarra === 0, `três vagas sem largura (820 px): lista compacta, uma por linha e sem descrição (painel ${mc.painel}px)`);
  await c.ctx.close();
  const p = await abrir(390, 3); const mp = await medir(p.pg);
  ok(mp.colunas === 1 && mp.linhas === 3 && mp.rolagemX <= 1, 'três vagas no celular: uma coluna, sem rolagem lateral');
  await p.ctx.close();
}
// ================= prioridade fora das vagas =================
await semearCenario('fora-das-vagas', DADOS('fora-das-vagas')); await subir(DADOS('fora-das-vagas'));
{
  const { ctx, pg } = await abrir(1440, 4); const m = await medir(pg);
  ok(m.n === 4 && m.vagas === '1,2,3,4' && m.colunas === 2 && m.linhas === 2, `com as quatro vagas cheias de comuns nenhuma é desalojada (${m.vagas})`);
  ok(m.fora >= 1 && m.foraAntesDaGrade, `a prioridade elegível fora das vagas aparece em linhas compactas acima das comuns (${m.fora})`);
  ok(await pg.$$eval('.ph-fora .ilinha', (l) => l.every((e) => !!e.querySelector('[data-selo-prioridade]') && /Fora das 4 vagas/.test(e.textContent) && e.dataset.prioridade === 'prefeita')), 'cada linha fora das vagas traz o selo e a indicação "Fora das 4 vagas"');
  ok(new Set(m.assuntos).size === m.assuntos.length, 'nenhuma demanda aparece duas vezes (fora das vagas, vagas e nova urgência)');
  await ctx.close();
}
await nav.close(); parar();
ok(erros.length === 0, 'nenhum erro de console ou de página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
