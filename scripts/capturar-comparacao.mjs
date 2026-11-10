// Comparação visual antes/depois (só dados FICTÍCIOS, banco local de TESTE; nunca toca o Supabase real nem o banco da prévia em .dados-teste/pg).
// Uso: node scripts/capturar-comparacao.mjs antes|depois [--sem-fraunces]
//   antes:  rode no código-base (checkout limpo). depois: rode no código novo. Cada execução apaga e refaz só a própria pasta de capturas e atualiza o índice.
// Saída (pasta ignorada pelo Git): .dados-teste/comparacao/{antes,depois}/*.png, meta.json de cada lado e .dados-teste/comparacao/indice.html (pares lado a lado e roteiro de conferência).
// Os dados ficam em .dados-teste/comparacao-dados (recriados a cada execução; podem ser usados como prévia povoada: ver o roteiro do índice).
// Cenários fictícios iguais nos dois lados: demanda prioritária (origem Prefeita), vencida, com várias tarefas, assunto longo, sem documento, prazo com acompanhamento, 250/2026 e 2026/250, humor de hoje.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';
import * as F from './clima-fixtures.mjs';

const LADO = process.argv[2];
if (LADO !== 'antes' && LADO !== 'depois') { console.error('Uso: node scripts/capturar-comparacao.mjs antes|depois'); process.exit(2); }
const COM_FRAUNCES = !process.argv.includes('--sem-fraunces');
const PORTA = process.env.PORTA_CAPTURA || '7119', BASE = `http://localhost:${PORTA}`;
// CAPTURA_FILTRO=<regex dos nomes> faz uma rodada parcial de rascunho (para olhar durante o desenvolvimento): grava em comparacao/rascunho e não mexe em antes, depois nem no índice
const FILTRO = process.env.CAPTURA_FILTRO ? new RegExp(process.env.CAPTURA_FILTRO) : null;
const RAIZ = '.dados-teste/comparacao', PASTA_LADO = FILTRO ? `${RAIZ}/rascunho` : `${RAIZ}/${LADO}`, DADOS = FILTRO ? '.dados-teste/comparacao-dados-rascunho' : '.dados-teste/comparacao-dados';
rmSync(PASTA_LADO, { recursive: true, force: true }); rmSync(DADOS, { recursive: true, force: true }); mkdirSync(PASTA_LADO, { recursive: true });

const USUARIO = '00000000-0000-4000-8000-000000000001';
const git = (...a) => spawnSync('git', a, { encoding: 'utf8' }).stdout.trim();

// ---------------- semente fictícia ----------------
let HOJE = null;
{
  const db = await abrirBancoTeste({ pasta: DADOS });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const dia = (n) => somarDias(HOJE, n);
  const mk = (assunto, o = {}) => c('criar_demanda', { p: { assunto, ...o } });
  const tarefas = async (d, textos, feitas = 0) => { for (let i = 0; i < textos.length; i++) { const r = await c('adicionar_tarefa', { p_demanda: d.id, p_texto: textos[i] }); if (i < feitas) await c('marcar_tarefa', { p_id: r.tarefas[i].id, p_concluida: true }); } };

  // 1) prioritária + vencida + várias tarefas + prazo com acompanhamento (a demanda principal das capturas da Consulta)
  const rica = await mk('Parecer sobre o reajuste do contrato de limpeza urbana', { tipo: 'Processo', numero: '250/2026', origem: 'Prefeita', area: 'Geral', chegou_em: dia(-12), prazo_original: dia(-2), setor: 'Procuradoria', acompanhar_em: dia(3), descricao: 'Reunir a planilha de custos, conferir o índice de reajuste previsto no contrato e pedir manifestação da Procuradoria antes de responder ao gabinete. Conferir também a vigência do aditivo anterior e os empenhos do exercício.' });
  await c('mover_etapa', { p_id: rica.id, p_etapa: 'Fazendo' });
  await tarefas(rica, ['Reunir a planilha de custos do último ano', 'Conferir o índice de reajuste no contrato', 'Pedir manifestação da Procuradoria', 'Conferir a vigência do aditivo anterior', 'Levantar os empenhos do exercício', 'Redigir a resposta ao gabinete'], 2);
  // 2) vencida comum, número no formato inverso
  const venc = await mk('Resposta ao pedido de informação sobre horas extras', { tipo: 'Memorando', numero: '2026/250', origem: 'Reunião', chegou_em: dia(-20), prazo_original: dia(-6) });
  await c('mover_etapa', { p_id: venc.id, p_etapa: 'Vistos' }); await tarefas(venc, ['Levantar as horas do mês', 'Responder ao solicitante']);
  // 3) assunto longo e sem documento
  const longa = await mk('Levantamento completo das pendências de pagamento de diárias e adicionais dos servidores lotados nas escolas municipais durante o primeiro semestre, com conferência dos empenhos e da folha', { origem: 'Pedido de colega', chegou_em: dia(-3), prazo_original: dia(9) });
  await tarefas(longa, ['Pedir a relação às escolas']);
  // 4) demais para o Para hoje e os contadores
  await mk('Ofício sobre a reforma do telhado da escola', { tipo: 'Ofício', numero: '32/2026', origem: 'Secretaria de Educação', chegou_em: dia(-8), prazo_original: HOJE });
  await mk('Memorando de férias do setor de compras', { tipo: 'Memorando', numero: '14/2026', origem: 'Iniciativa própria', prazo_original: dia(5), rapida: true });
  await mk('Pedido do Gabinete sobre o calendário de reuniões', { origem: 'Gabinete', prazo_original: dia(4) });
  await mk('Atualizar o inventário de equipamentos', { origem: 'Iniciativa própria', prazo_original: dia(25) });
  await db.query('insert into public.registros_dia (user_id, dia, humor) values ($1, $2, 4) on conflict do nothing', [USUARIO, HOJE]);
  await db.close();
}

// ---------------- servidor ----------------
let servidor = null;
const parar = () => { try { if (servidor) spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; };
process.on('exit', parar);
for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/login', { signal: AbortSignal.timeout(1500) }); } catch { break; } await new Promise((r) => setTimeout(r, 1000)); }
servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: DADOS }, stdio: 'ignore' });
{
  let subiu = false;
  for (let i = 0; i < 120 && !subiu; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) subiu = true; } catch { /* ainda subindo */ } if (!subiu) await new Promise((r) => setTimeout(r, 2000)); }
  if (!subiu) { console.error('o servidor de captura não subiu'); process.exit(1); }
}

// ---------------- capturas ----------------
const VIEWPORTS = { largo: { width: 1600, height: 900 }, notebook: { width: 1280, height: 720 }, tablet: { width: 820, height: 1180 }, celular: { width: 390, height: 844 } };
const TELAS = ['inicio', 'configuracoes', 'nova-demanda', 'consulta', 'consulta-longa'];
const MAX_ALTURA = 3400;
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const feitas = [];
const falhas = [];

const estavel = (pg) => pg.waitForFunction(() => {
  const andando = document.getAnimations().some((a) => (a.playState === 'running' || a.playState === 'pending') && a.effect?.getComputedTiming().iterations !== Infinity);
  const e = document.querySelector('.app .main');
  if (andando || !e) return false;
  const r = e.getBoundingClientRect(), k = [r.left, r.top, r.width, r.height].map((x) => x.toFixed(1)).join();
  const ant = window.__estavelCap; window.__estavelCap = k; return ant === k;
}, null, { timeout: 20000, polling: 120 });
const ir = async (pg, rota) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.addStyleTag({ content: 'nextjs-portal { display: none !important; }' }); // indicador do modo de desenvolvimento do Next, fora das capturas
  await pg.waitForFunction(() => !/Carregando/.test(document.querySelector('.main')?.innerText ?? ''), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  await estavel(pg);
};
/** Cresce a janela para caber o conteúdo que rola por dentro (página ou janela aberta), até um limite. */
const caberTudo = async (pg, vp) => {
  let altura = vp.height;
  // a janela aberta tem altura máxima ligada à da tela: cresce em passos até o conteúdo caber (no máximo 4 passos)
  for (let i = 0; i < 4; i++) {
    const extra = await pg.evaluate(() => {
      const cand = [...document.querySelectorAll(document.querySelector('.modal') ? '.modal, .modal *' : '.main')].filter((e) => e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      return cand.reduce((m, e) => Math.max(m, e.scrollHeight - e.clientHeight), 0);
    });
    if (extra <= 0 || altura >= MAX_ALTURA) break;
    altura = Math.min(MAX_ALTURA, altura + extra + 8);
    await pg.setViewportSize({ width: vp.width, height: altura }); await new Promise((r) => setTimeout(r, 400)); await estavel(pg);
  }
};

async function capturar({ tela, vpNome, tema, texto, fraunces }) {
  const vp = VIEWPORTS[vpNome];
  const nome = `${tela}-${vpNome}-${tema}-${texto}${fraunces ? '-fraunces' : ''}`;
  if (FILTRO && !FILTRO.test(nome)) return;
  const aparencia = { textoPct: texto === '125' ? 125 : 100, ...(fraunces ? { titulo: 'fraunces', texto: 'inter', mono: 'plex' } : {}) };
  const ctx = await nav.newContext({ viewport: vp, hasTouch: vpNome === 'tablet' || vpNome === 'celular', deviceScaleFactor: 1 });
  try {
    await ctx.addInitScript(([t, a]) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:aparencia', JSON.stringify(a)); localStorage.setItem('dmanda:ui', JSON.stringify({ visao: 'cards' })); } catch { /* sem armazenamento */ } }, [tema, aparencia]);
    await ctx.route(/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//, async (rota) => {
      const u = new URL(rota.request().url());
      const corpo = u.hostname.startsWith('geocoding') ? F.resultados(F.TAQUARA_RS) : F.previsao({ hora: `${HOJE}T07:45`, data: HOJE });
      await rota.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
    });
    const pg = await ctx.newPage();
    if (tela === 'inicio') { await ir(pg, '/'); await pg.waitForSelector('.wg-clima[data-clima="ok"], [data-quadro="humor"] .ini-reg-v', { timeout: 30000 }).catch(() => {}); await new Promise((r) => setTimeout(r, 800)); }
    else if (tela === 'configuracoes') { await ir(pg, '/config'); }
    else if (tela === 'nova-demanda') {
      await ir(pg, '/demandas');
      await pg.locator('.toolbar .btn.escuro').first().click(); await pg.waitForSelector('#n-assunto', { timeout: 15000 });
      await pg.fill('#n-assunto', 'Ofício sobre a manutenção do ginásio municipal'); await pg.fill('#n-num', '250/2026');
    } else {
      await ir(pg, '/demandas');
      const alvo = tela === 'consulta' ? 'Parecer sobre o reajuste do contrato de limpeza urbana' : 'Levantamento completo das pendências';
      await pg.locator('.dcard', { hasText: alvo }).first().locator('.assunto').click(); await pg.waitForSelector('.modal [data-secao]', { timeout: 15000 });
    }
    await estavel(pg); await caberTudo(pg, vp);
    await pg.evaluate(() => document.querySelectorAll('.modal, .main').forEach((e) => { e.scrollTop = 0; })); // o foco da janela pode ter rolado o conteúdo alguns pixels
    await new Promise((r) => setTimeout(r, 200));
    await pg.screenshot({ path: `${PASTA_LADO}/${nome}.png` });
    feitas.push({ nome, tela, vp: vpNome, tema, texto, fraunces });
  } catch (e) { falhas.push(`${nome}: ${String(e.message).split('\n')[0]}`); }
  finally { await ctx.close(); }
}

const plano = [];
for (const vpNome of Object.keys(VIEWPORTS)) for (const tela of TELAS) plano.push({ tela, vpNome, tema: 'claro', texto: '100', fraunces: false });
for (const vpNome of ['largo', 'celular']) for (const tela of TELAS.slice(0, 4)) {
  plano.push({ tela, vpNome, tema: 'escuro', texto: '100', fraunces: false });
  plano.push({ tela, vpNome, tema: 'claro', texto: '125', fraunces: false });
  if (COM_FRAUNCES) plano.push({ tela, vpNome, tema: 'claro', texto: '100', fraunces: true });
}
if (COM_FRAUNCES) for (const vpNome of ['largo', 'celular']) plano.push({ tela: 'consulta-longa', vpNome, tema: 'claro', texto: '100', fraunces: true });
for (const p of plano) await capturar(p);
await nav.close(); parar();

if (FILTRO) { console.log(`rascunho: ${feitas.length} capturas, falhas: ${falhas.length} em ${PASTA_LADO}`); for (const f of falhas) console.log('FALHA ' + f); process.exit(falhas.length ? 1 : 0); }
const sujo = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim().length > 0;
writeFileSync(`${PASTA_LADO}/meta.json`, JSON.stringify({ lado: LADO, commit: git('rev-parse', '--short', 'HEAD'), comAlteracoesLocais: sujo, geradoEm: new Date().toISOString(), hoje: HOJE, capturas: feitas, falhas }, null, 2));

// ---------------- índice ----------------
const lerMeta = (l) => { try { return JSON.parse(readFileSync(`${RAIZ}/${l}/meta.json`, 'utf8')); } catch { return null; } };
const mA = lerMeta('antes'), mD = lerMeta('depois');
const rotulo = (m, l) => (m ? `${l === 'antes' ? 'Antes' : 'Depois'} (${m.commit}${m.comAlteracoesLocais ? ' + alterações locais' : ''}, ${m.geradoEm.slice(0, 16).replace('T', ' ')})` : `${l === 'antes' ? 'Antes' : 'Depois'} (ainda não gerado)`);
const NOME_TELA = { inicio: 'Início', configuracoes: 'Configurações', 'nova-demanda': 'Nova demanda (passo 1)', consulta: 'Consulta da demanda (prioritária, vencida, 6 tarefas, prazo com acompanhamento)', 'consulta-longa': 'Consulta da demanda (assunto longo, sem documento)' };
const NOME_VP = { largo: 'Monitor largo 1600 px', notebook: 'Notebook 1280 px', tablet: 'Tablet 820 px', celular: 'Celular 390 px' };
const porNome = new Map(); for (const m of [mA, mD]) for (const i of m?.capturas ?? []) porNome.set(i.nome, { ...i, f: `${i.nome}.png` });
const itens = [...porNome.values()];
const ordemVp = Object.keys(VIEWPORTS);
const par = (f) => {
  const img = (l) => existsSync(`${RAIZ}/${l}/${f}`) ? `<a href="${l}/${f}" target="_blank"><img loading="lazy" src="${l}/${f}" alt="${l}: ${f}"></a>` : '<div class="nada">Não capturado neste lado</div>';
  return `<div class="par"><figure><figcaption>${rotulo(mA, 'antes')}</figcaption>${img('antes')}</figure><figure><figcaption>${rotulo(mD, 'depois')}</figcaption>${img('depois')}</figure></div>`;
};
const secoes = TELAS.map((tela) => {
  const lista = itens.filter((i) => i.tela === tela).sort((a, b) => ordemVp.indexOf(a.vp) - ordemVp.indexOf(b.vp) || Number(a.fraunces) - Number(b.fraunces) || a.tema.localeCompare(b.tema) || a.texto.localeCompare(b.texto));
  if (!lista.length) return '';
  return `<section id="${tela}"><h2>${NOME_TELA[tela]}</h2>${lista.map((i) => `<h3>${NOME_VP[i.vp]} · tema ${i.tema} · texto ${i.texto}%${i.fraunces ? ' · conjunto Fraunces, Inter e IBM Plex Mono' : ''}</h3>${par(i.f)}`).join('')}</section>`;
}).join('');
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dmanda: comparação antes e depois</title>
<style>:root{color-scheme:light dark;--fg:#1a1a1a;--bg:#f6f6f4;--mut:#555;--brd:#d4d4d0}@media(prefers-color-scheme:dark){:root{--fg:#ececec;--bg:#18181a;--mut:#a8a8a8;--brd:#3a3a3e}}
body{margin:0 auto;max-width:1500px;padding:16px 20px 80px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}h1{font-size:26px}h2{margin-top:44px;border-bottom:1px solid var(--brd);padding-bottom:6px}h3{margin:26px 0 8px;font-size:15px;color:var(--mut)}
nav a{margin-right:14px}.par{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{margin:0;min-width:0}figcaption{font-size:13px;color:var(--mut);margin-bottom:4px}img{width:100%;height:auto;border:1px solid var(--brd);border-radius:8px;display:block}.nada{padding:30px;border:1px dashed var(--brd);color:var(--mut);border-radius:8px}
@media(max-width:900px){.par{grid-template-columns:1fr}}code{background:color-mix(in srgb,var(--fg) 10%,transparent);padding:1px 5px;border-radius:4px}li{margin:4px 0}</style></head><body>
<h1>Dmanda: comparação visual antes e depois</h1>
<p>Dados fictícios, banco local de teste. Clique numa captura para abrir em tamanho real. <b>Antes</b> é o código aprovado funcionalmente por Éder; <b>Depois</b> é o código desta rodada. Os cenários são iguais nos dois lados.</p>
<nav>${TELAS.map((t) => `<a href="#${t}">${NOME_TELA[t].split(' (')[0]}${t === 'consulta-longa' ? ' (longa)' : ''}</a>`).join('')}<a href="#roteiro">Roteiro</a></nav>
${secoes}
<section id="roteiro"><h2>Roteiro curto de conferência na prévia (http://localhost:7100)</h2>
<ol>
<li><b>Navegar:</b> Início é <code>/</code>; Configurações é <code>/config</code> (menu lateral, último item); Nova demanda é o botão "Nova demanda" em Demandas (<code>/demandas</code>) ou o "+" do cabeçalho; Consulta é clicar num card de demanda.</li>
<li><b>Ativar o conjunto Fraunces, Inter e IBM Plex Mono:</b> Configurações, bloco Fontes, escolher o conjunto "Fraunces, Inter e IBM Plex Mono". Para voltar: "Restaurar padrão".</li>
<li><b>Busca por 2026:</b> com o filtro de ano em "Todos", digite <code>2026</code> na busca de Demandas e em Buscar (Ctrl K): devem aparecer "250/2026" e "2026/250". Depois ligue o filtro de ano (menu Filtros) e combine com tipo e origem.</li>
<li><b>Interações que a captura não mostra:</b> passar o mouse e usar a tecla Tab no menu lateral; clicar nos três contadores de prazo; marcar uma tarefa na Consulta; abrir o lápis de cada seção; Fechar e Concluir no rodapé e, no celular, a rolagem do rodapé; mudar o tema e o tamanho do texto.</li>
<li><b>Prévia com demandas de exemplo:</b> a prévia padrão usa o banco da prévia (pode estar vazio). Para ver estes mesmos dados fictícios, pare a prévia e rode no PowerShell, na pasta do projeto: <code>$env:DMANDA_PASTA_TESTE='.dados-teste/comparacao-dados'; npm run dev:teste</code> (depois feche essa janela e suba a prévia normal).</li>
</ol></section></body></html>`;
writeFileSync(`${RAIZ}/indice.html`, html);
console.log(`capturas: ${feitas.length}, falhas: ${falhas.length}`); for (const f of falhas) console.log('FALHA ' + f);
console.log('índice: ' + process.cwd().replace(/\\/g, '/') + '/' + RAIZ + '/indice.html');
process.exit(falhas.length ? 1 : 0);
