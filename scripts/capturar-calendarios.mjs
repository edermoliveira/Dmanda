// Capturas de COMPARAÇÃO dos calendários da Agenda (Mês, Semana e Dia), com dados fictícios e um cenário fixo, para comparar versões lado a lado:
// a referência da grade quadrada do iPhone (395e45a), a versão publicada antes deste bloco e a versão nova. Mesmo navegador (Edge), mesmas larguras, mesmos temas, mesma data de
// referência (03/11/2026) e os mesmos dados nas três.
// Cenário: dia útil vazio (17/11), sábado com carga (14/11, "Acompanhar em"), domingo com carga (22/11), feriado em dia útil (10/11 e 20/11), feriado no domingo (15/11),
// evento externo (26/11), data só com compromisso (19/11), carga alta (12/11), atraso (01/11) e um prazo sobre fim de semana e feriado (21/11, sábado, com 20/11 feriado).
// Uso: node scripts/capturar-calendarios.mjs <rótulo> [porta]   (grava em .dados-teste/comparacao-calendarios/<rótulo>/ com medidas.json e refaz o índice HTML)
// Pode rodar a partir de outra cópia de trabalho (por exemplo, a 395e45a): usa o Next e o banco de teste da pasta atual. Só abre um banco de TESTE descartável (PGlite); nunca toca o Supabase real.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROTULO = process.argv[2];
if (!ROTULO || !/^[\w.-]+$/.test(ROTULO)) { console.error('Informe o rótulo da captura (por exemplo: antes, depois, ref-395e45a).'); process.exit(2); }
const PORTA = process.argv[3] || process.env.PORTA_CAPTURA || '7124', BASE = `http://localhost:${PORTA}`;
const PASTA = `.dados-teste/calendarios-captura-${ROTULO}`;
// a saída é sempre a da cópia principal (a variável deixa outra cópia gravar no mesmo índice)
const RAIZ = process.env.SAIDA_COMPARACAO || '.dados-teste/comparacao-calendarios', SAIDA = `${RAIZ}/${ROTULO}`;
const REFERENCIA = '2026-11-03';
rmSync(PASTA, { recursive: true, force: true }); rmSync(SAIDA, { recursive: true, force: true }); mkdirSync(SAIDA, { recursive: true });

const { abrirBancoTeste, chamarComoUsuario } = await import(pathToFileURL(resolve('src/servidor/banco-teste-base.mjs')).href);
const USUARIO = '00000000-0000-4000-8000-000000000001';

// ---------- dados: só chamadas que existem nas três versões ----------
const demo = {};
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const dem = (assunto, o = {}) => c('criar_demanda', { p: { assunto, tipo: 'Memorando', numero: '', etapa: 'Fazendo', ...o } });
  const tarefas = async (id, n) => { for (let i = 0; i < n; i++) await c('adicionar_tarefa', { p_demanda: id, p_texto: `Tarefa ${i + 1}` }); };
  const ev = (o) => c('criar_evento', { p: { tipo: 'Reunião', aviso_min: null, ...o } });
  const dia = (data, descricao, categoria = 'Feriado') => c('salvar_dia_indisponivel', { p: { data, descricao, categoria } });
  await dia('2026-11-10', 'Feriado municipal fictício');
  await dia('2026-11-15', 'Proclamação da República');
  await dia('2026-11-20', 'Dia da Consciência Negra');
  await dia('2026-11-26', 'Congresso estadual de gestão', 'Evento externo');
  // o prazo sobre sábado (21/11) com a sexta (20/11) feriado: o vencimento ajustado vai para a quinta (19/11)
  const p = await dem('Resposta ao Ministério Público', { numero: '301/2026', prazo_original: '2026-11-21', prazo_tipo: 'Legal' });
  demo.prazo = { prazo_original: p.prazo_original, prazo: p.prazo };
  await ev({ titulo: 'Reunião de secretariado', data: '2026-11-03', inicio: '09:00', fim: '10:00' });
  await ev({ titulo: 'Visita técnica à escola', tipo: 'Compromisso', data: '2026-11-03', inicio: '14:00' });
  await ev({ titulo: 'Audiência pública do plano diretor', tipo: 'Compromisso', data: '2026-11-19', inicio: '15:00', fim: '17:00' });
  await ev({ titulo: 'Semana do servidor público', tipo: 'Lembrete', data: '2026-11-25', dia_inteiro: true });
  const alta = await dem('Pacote grande de tarefas', { numero: '302/2026', prazo_original: '2026-11-12' }); await tarefas(alta.id, 9);
  const media = await dem('Parecer sobre o contrato de limpeza urbana e coleta seletiva', { numero: '303/2026', prazo_original: '2026-11-05' }); await tarefas(media.id, 4);
  const baixa = await dem('Ofício ao Tribunal de Contas', { numero: '304/2026', prazo_original: '2026-11-09' }); await tarefas(baixa.id, 2);
  const sab = await dem('Aguarda a Contabilidade', { numero: '305/2026', etapa: 'Aguardando retorno', setor: 'Contabilidade', acompanhar_em: '2026-11-14' }); await tarefas(sab.id, 3);
  const dom = await dem('Aguarda o Jurídico', { numero: '306/2026', etapa: 'Aguardando retorno', setor: 'Jurídico', acompanhar_em: '2026-11-22' }); await tarefas(dom.id, 5);
  const atr = await dem('Relatório em atraso', { numero: '307/2026', prazo_original: '2026-10-30' }); await tarefas(atr.id, 1);
  await dem('Prestação de contas anual', { numero: '308/2026', prazo_original: '2026-12-31', prazo_tipo: 'Legal' });
  await dem('Sem nenhuma data', { numero: '309/2026' });
  await db.close();
}

const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_SEM_CLIMA: 'sim', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-captura' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const horaSP = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });
const INSTANTE = new Date(`${REFERENCIA}T${horaSP}-03:00`);
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const novo = async (opcoes, tema, modo, falhaDemandas = false) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.clock.install({ time: INSTANTE });
  await ctx.addInitScript(([t, m]) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:agenda', JSON.stringify({ modo: m })); } catch { /* sem armazenamento */ } }, [tema, modo]);
  const pg = await ctx.newPage();
  if (falhaDemandas) {
    await pg.route('**/*', async (route) => {
      const q = route.request();
      if (!(q.method() === 'POST' && q.headers()['next-action'])) { await route.continue(); return; }
      const r = await route.fetch(); const texto = await r.text();
      const linhas = texto.split('\n'), i = linhas.findIndex((l) => /^1:\{"ok":true,"dados":\{"demandas":/.test(l));
      if (i >= 0) { const j = JSON.parse(linhas[i].slice(2)); j.dados.demandas = { ok: false, erro: 'Falha simulada em demandas.' }; linhas[i] = '1:' + JSON.stringify(j); const corpo = linhas.join('\n'); await route.fulfill({ response: r, body: corpo, headers: { ...r.headers(), 'content-length': String(Buffer.byteLength(corpo)) } }); return; }
      await route.fulfill({ response: r, body: texto });
    });
  }
  await pg.goto(BASE + '/agenda', { waitUntil: 'load', timeout: 180000 }); await pg.waitForSelector('.app .main', { timeout: 180000 });
  await pg.waitForFunction(() => !/Carregando a agenda|Carregando as demandas/.test(document.body.innerText), null, { timeout: 180000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 180000 });
  await pg.waitForTimeout(1200);
  return { ctx, pg };
};
const foto = async (pg, nome, pagina = true) => {
  const v = pg.viewportSize();
  if (pagina) { await pg.setViewportSize({ width: v.width, height: v.width < 500 ? 2400 : v.width < 1000 ? 2100 : 1600 }); await pg.waitForTimeout(500); }
  await pg.waitForTimeout(400); await pg.screenshot({ path: `${SAIDA}/${nome}.png` });
  if (pagina) { await pg.setViewportSize(v); await pg.waitForTimeout(300); }
  console.log('capturou', nome);
};
const irPara = async (pg, data) => { await pg.fill('.agd-data input', data); await pg.waitForTimeout(500); };
const medir = (pg) => pg.evaluate(() => {
  const cels = [...document.querySelectorAll('.agd-cel')].map((e) => e.getBoundingClientRect());
  const cab = [...document.querySelectorAll('.agd-cabsem')].map((e) => e.textContent.trim());
  return { cabecalho: cab, celulas: cels.length, celula: cels.length ? { w: Math.round(cels[10].width * 10) / 10, h: Math.round(cels[10].height * 10) / 10 } : null, rolagemHorizontal: document.documentElement.scrollWidth > innerWidth + 1,
    primeiraCelula: document.querySelector('.agd-cel')?.getAttribute('data-data') ?? null };
});

const medidas = { prazoDemonstrado: demo.prazo };
const alvos = [
  ['computador', { viewport: { width: 1360, height: 900 } }, true],
  ['ipad', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true],
  ['iphone390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true],
  ['iphone375', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, false],
  ['iphone320', { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, false],
];
const DIAS = [['10', '2026-11-10', 'feriado-util'], ['12', '2026-11-12', 'carga-alta'], ['14', '2026-11-14', 'sabado-carga'], ['17', '2026-11-17', 'util-vazio'], ['19', '2026-11-19', 'so-compromisso']];
// ALVOS=iphone390,computador e TEMAS=claro restringem a captura (para conferir um ajuste sem refazer tudo)
const SO_ALVOS = process.env.ALVOS?.split(','), SO_TEMAS = process.env.TEMAS?.split(',') ?? ['claro', 'escuro'];
for (const [nome, opc, completo] of alvos.filter(([n]) => !SO_ALVOS || SO_ALVOS.includes(n))) for (const tema of SO_TEMAS) {
  const chave = `${nome}-${tema}`;
  // Mês: a grade inteira e o dia de carga alta escolhido (gaveta, painel ou detalhe, conforme a versão)
  { const { ctx, pg } = await novo(opc, tema, 'mes'); medidas[chave] = { mes: await medir(pg) };
    await foto(pg, `${chave}-mes`);
    const cel = pg.locator('.agd-cel[data-data="2026-11-12"]');
    if (await cel.count()) { await cel.evaluate((e) => e.scrollIntoView({ block: 'center' })); await cel.click(); await pg.waitForTimeout(700); await foto(pg, `${chave}-mes-dia12`, nome.startsWith('iphone')); await pg.keyboard.press('Escape'); }
    await ctx.close(); }
  // Semana de 08 a 14/11 (feriado na terça, carga alta na quinta, sábado com carga)
  { const { ctx, pg } = await novo(opc, tema, 'semana'); await irPara(pg, '2026-11-12'); await foto(pg, `${chave}-semana`); await ctx.close(); }
  // Dia: os casos do cenário (só o feriado em dia útil nas larguras menores)
  { const { ctx, pg } = await novo(opc, tema, 'hoje');
    for (const [, d, rot] of completo ? DIAS : DIAS.slice(0, 1)) { await irPara(pg, d); await foto(pg, `${chave}-dia-${rot}`); }
    await ctx.close(); }
}
// falha parcial (só as demandas) no iPhone e no computador, claro
for (const [nome, opc] of [alvos[0], alvos[2]].filter(([n]) => !SO_ALVOS || SO_ALVOS.includes(n))) { const { ctx, pg } = await novo(opc, 'claro', 'mes', true); await foto(pg, `${nome}-claro-mes-falha-demandas`); await ctx.close(); }
await nav.close(); parar();
writeFileSync(`${SAIDA}/medidas.json`, JSON.stringify(medidas, null, 2));
console.log('medidas gravadas em', `${SAIDA}/medidas.json`);

// ---------- índice HTML lado a lado ----------
const rotulos = readdirSync(RAIZ, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort((a, b) => (a.startsWith('ref') ? -1 : b.startsWith('ref') ? 1 : a === 'antes' ? -1 : b === 'antes' ? 1 : a.localeCompare(b)));
const nomes = [...new Set(rotulos.flatMap((r) => readdirSync(`${RAIZ}/${r}`).filter((f) => f.endsWith('.png'))))].sort();
const linhas = nomes.map((f) => `<section><h2>${f.replace('.png', '')}</h2><div class="g" style="grid-template-columns:repeat(${rotulos.length},minmax(0,1fr))">${rotulos.map((r) => `<figure><figcaption>${r}</figcaption>${existsSync(`${RAIZ}/${r}/${f}`) ? `<a href="${r}/${f}"><img loading="lazy" src="${r}/${f}" alt="${r} ${f}"></a>` : '<p>sem captura</p>'}</figure>`).join('')}</div></section>`).join('\n');
writeFileSync(`${RAIZ}/index.html`, `<!doctype html><meta charset="utf-8"><title>Calendários da Agenda: comparação</title><style>body{font:14px system-ui;margin:16px;background:#f2f2f2}h2{font-size:15px}.g{display:grid;gap:12px;align-items:start}img{max-width:100%;border:1px solid #ccc;background:#fff}figcaption{font-weight:600;margin-bottom:4px}</style><h1>Calendários da Agenda: ${rotulos.join(', ')}</h1>${linhas}`);
console.log('pronto:', SAIDA);
