// Capturas e medidas de REVISÃO do Mês da Agenda (decisão 72 e ajuste de 13/11/2026), com dados fictícios e um cenário controlado: dia cheio (18/11: três compromissos e três vencimentos),
// dia vazio, título longo, prazo ajustado, dia inteiro, carga alta (12/11), item em atraso (02/11) e a virada de dezembro para janeiro. Mesmo navegador, mesmas larguras, mesmos temas,
// mesma data de referência e mesmos dados para o "antes" e o "depois".
// Uso: node scripts/capturar-agenda-mes.mjs antes|depois   (grava em .dados-teste/comparacao-agenda-mes-ajuste/<rótulo>/, fora do Git, com medidas.json, e refaz o índice HTML)
// Só abre um banco de TESTE descartável (PGlite) em .dados-teste/agenda-mes-captura; nunca toca o Supabase real.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, existsSync, copyFileSync, writeFileSync, readdirSync } from 'node:fs';
import { semearAgenda, USUARIO_TESTE } from './semear-agenda.mjs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

const ROTULO = process.argv[2];
if (!['antes', 'depois'].includes(ROTULO)) { console.error('Informe antes ou depois.'); process.exit(2); }
const PORTA = process.env.PORTA_CAPTURA_MES || '7122', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/agenda-mes-captura';
const RAIZ = '.dados-teste/comparacao-agenda-mes-ajuste', SAIDA = `${RAIZ}/${ROTULO}`;
const REFERENCIA = '2026-11-03';
const PRINT = process.env.REFERENCIA_PRINT || 'C:/Users/Éder/Downloads/print.png';
rmSync(PASTA, { recursive: true, force: true }); rmSync(SAIDA, { recursive: true, force: true }); mkdirSync(SAIDA, { recursive: true });

// ---------- dados: a semente da Agenda mais o cenário do Mês ----------
await semearAgenda(PASTA, REFERENCIA);
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  const c = (f, a) => chamarComoUsuario(db, USUARIO_TESTE, f, a);
  const dem = (assunto, o = {}) => c('criar_demanda', { p: { assunto, tipo: 'Memorando', numero: '', etapa: 'Fazendo', ...o } });
  const ev = (o) => c('criar_evento', { p: { tipo: 'Reunião', ...o } });
  await ev({ titulo: 'Reunião de secretariado', data: '2026-11-18', inicio: '09:00', fim: '10:00', aviso_min: null });
  await ev({ titulo: 'Audiência pública para revisão do plano diretor e do zoneamento urbano do município', tipo: 'Compromisso', data: '2026-11-18', inicio: '14:00', fim: '16:00', aviso_min: null });
  await ev({ titulo: 'Visita à obra da escola', tipo: 'Compromisso', data: '2026-11-18', inicio: '16:30', aviso_min: null });
  for (const [a, n] of [['Parecer sobre o contrato de limpeza urbana e coleta seletiva do exercício', '201/2026'], ['Ofício ao Tribunal de Contas', '202/2026'], ['Memorando do RH sobre férias', '203/2026']]) await dem(a, { numero: n, prazo_original: '2026-11-18' });
  await dem('Resposta ao Ministério Público', { numero: '204/2026', prazo_original: '2026-11-21', prazo_tipo: 'Legal' }); // sábado 21 vai para a sexta 20
  await dem('Ofício em atraso ao Tribunal', { numero: '207/2026', prazo_original: '2026-11-02' }); // segunda 02/11, antes de hoje (03/11): item em atraso
  await ev({ titulo: 'Semana do servidor público', tipo: 'Lembrete', data: '2026-11-25', dia_inteiro: true, aviso_min: null });
  await dem('Prestação de contas anual', { numero: '205/2026', prazo_original: '2026-12-31', prazo_tipo: 'Legal' });
  await ev({ titulo: 'Brinde de fim de ano da equipe', tipo: 'Compromisso', data: '2026-12-31', inicio: '17:00', aviso_min: null });
  await dem('Plano de trabalho 2027', { numero: '206/2027', prazo_original: '2027-01-04' });
  await ev({ titulo: 'Reunião de planejamento 2027', data: '2027-01-05', inicio: '09:00', fim: '10:30', aviso_min: null });
  await db.close();
}

const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_SEM_CLIMA: 'sim', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-captura' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const horaSP = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });
const INSTANTE = new Date(`${REFERENCIA}T${horaSP}-03:00`);
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const novo = async (opcoes, tema) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.clock.install({ time: INSTANTE });
  await ctx.addInitScript(([t]) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); localStorage.setItem('dmanda:agenda', JSON.stringify({ modo: 'mes' })); } catch { /* sem armazenamento */ } }, [tema]);
  const pg = await ctx.newPage();
  await pg.goto(BASE + '/agenda', { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando a agenda|Carregando as demandas/.test(document.body.innerText), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  await pg.waitForTimeout(1200);
  return { ctx, pg };
};
const medidas = {};
// a rolagem é a do miolo do aplicativo, não a da página: para a grade inteira, o navegador ganha altura (e volta ao tamanho no fim)
const foto = async (pg, nome, o = {}) => {
  const v = pg.viewportSize();
  if (o.pagina) { await pg.setViewportSize({ width: v.width, height: v.width < 500 ? 2300 : v.width < 1000 ? 2000 : 1500 }); await pg.waitForTimeout(500); }
  await pg.waitForTimeout(450); await pg.screenshot({ path: `${SAIDA}/${nome}.png` });
  if (o.pagina) { await pg.setViewportSize(v); await pg.waitForTimeout(300); }
  console.log('capturou', nome);
};
const abrir = async (pg, d) => { await pg.locator(`.agd-cel[data-data="${d}"]`).evaluate((e) => e.scrollIntoView({ block: 'center' })); await pg.click(`.agd-cel[data-data="${d}"]`); await pg.waitForSelector('.agd-detalhe'); await pg.waitForTimeout(500); };
const fechar = async (pg) => { await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.agd-detalhe'), null, { timeout: 8000 }); await pg.waitForTimeout(250); };
const periodo = async (pg) => ((await pg.textContent('.agd-periodo')) ?? '').replace(/\s+/g, ' ').trim();
const abaAtiva = (pg) => pg.getAttribute('.agd-mes-aba[aria-current="true"]', 'aria-label');

const contraste = (pg, sel) => pg.evaluate((s) => {
  const base = getComputedStyle(document.querySelector('.app')).getPropertyValue('--card').trim() || '#fff';
  const rgb = (cor) => { const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); c.fillStyle = base; c.fillRect(0, 0, 1, 1); c.fillStyle = cor; c.fillRect(0, 0, 1, 1); const [r, g, b] = c.getImageData(0, 0, 1, 1).data; return [r, g, b]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const el = document.querySelector(s); if (!el) return null;
  const cs = getComputedStyle(el), l1 = lum(rgb(cs.backgroundColor)), l2 = lum(rgb(cs.color));
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
}, sel);
const CONTRASTES = { 'selo alta (dia 12)': '.agd-cel[data-data="2026-11-12"] .agd-qtd', 'selo média/baixa (dia 3)': '.agd-cel[data-data="2026-11-03"] .agd-qtd', 'linha de atraso (dia 2)': '.agd-cel[data-data="2026-11-02"] .agd-it[data-atrasado]', 'compromisso': '.agd-it[data-k="evento"]:not([data-dia])', 'dia inteiro': '.agd-it[data-k="evento"][data-dia]', 'vencimento': '.agd-it[data-k="demanda"]:not([data-atrasado])', 'aba atual': '.agd-mes-aba[aria-current="true"]', 'aba': '.agd-mes-aba:not([aria-current])', 'hoje (número)': '.agd-cel[data-hoje] .agd-num' };

// medidas do iPhone: onde a grade começa, tamanho dos alvos de toque, área efetiva da aba (varredura horizontal), itens reconhecíveis e rolagem horizontal
const medirCelular = async (pg) => {
  await pg.evaluate(() => {
    window.__r = (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
    // área efetiva de toque: quantos pixels, em cada eixo pelo centro, respondem ao toque como o próprio controle (ou algo dentro dele), incluindo a extensão por pseudo-elemento
    window.__varrer = (el) => {
      const b = window.__r(el), cx = Math.round(b.x + b.w / 2), cy = Math.round(b.y + b.h / 2), dono = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const t = document.elementFromPoint(x, y); return !!t && el.contains(t); };
      let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
      if (!dono(cx, cy)) return 'coberto';
      while (dono(x0 - 1, cy) && cx - x0 < 80) x0--; while (dono(x1 + 1, cy) && x1 - cx < 80) x1++;
      while (dono(cx, y0 - 1) && cy - y0 < 80) y0--; while (dono(cx, y1 + 1) && y1 - cy < 80) y1++;
      return `${x1 - x0 + 1}x${y1 - y0 + 1}`;
    };
  });
  await pg.evaluate(() => document.querySelector('.main').scrollTo(0, 0)); await pg.waitForTimeout(300);
  const topo = await pg.evaluate(() => {
    const r = window.__r, faixa = document.querySelector('.faixa-teste'), grade = document.querySelector('.agd-grade');
    const ctl = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = r(e); return { visual: `${Math.round(b.w)}x${Math.round(b.h)}`, efetiva: window.__varrer(e) }; };
    return { viewport: { w: innerWidth, h: innerHeight }, gradeTopo: Math.round(r(grade).y), faixaBaixo: faixa ? Math.round(r(faixa).b) : null,
      controles: { Hoje: ctl('.agd-nav .btn.mini'), setaAnterior: ctl('[aria-label="Mês anterior"]'), setaSeguinte: ctl('[aria-label="Próximo mês"]'), data: ctl('.agd-data input'), novoEvento: ctl('.agd-novo'), filtros: ctl('.agd-filtros-bt'), visoes: ctl('.agd-barra .opcoes button') } };
  });
  // a rolagem é a do .main e instantânea (o scrollIntoView de um elemento em escrita vertical não rola no emulador)
  const centralizar = async (sel) => { await pg.evaluate((s) => { const m = document.querySelector('.main'), b = document.querySelector(s).getBoundingClientRect(); m.scrollTo({ top: m.scrollTop + b.y + b.height / 2 - innerHeight / 2, behavior: 'instant' }); }, sel); await pg.waitForTimeout(500); };
  await centralizar('.agd-cel[data-data="2026-11-11"]'); const celEf = await pg.evaluate(() => window.__varrer(document.querySelector('.agd-cel[data-data="2026-11-11"]')));
  await centralizar('.agd-mes-aba[data-mes="6"]');
  const grade = await pg.evaluate(() => {
    const r = window.__r, cels = [...document.querySelectorAll('.agd-cel')].map(r), aba = document.querySelector('.agd-mes-aba[data-mes="6"]'), ac = r(aba);
    const sobrepoe = (() => { const c = document.querySelector('.agd-cel[data-data="2026-11-08"]'); if (!c) return null; const rc = r(c), t = document.elementFromPoint(rc.r - 0.5, rc.y + rc.h / 2); return !!t && aba.contains(t); })();
    const itens = [...document.querySelectorAll('.agd-cel .agd-it')].map((e) => { const t = e.querySelector('.agd-it-t'); return { texto: e.textContent.replace(/\s+/g, ' ').trim(), cortado: t ? t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1 : null }; });
    return { celulaMin: { w: Math.round(Math.min(...cels.map((c) => c.w)) * 10) / 10, h: Math.round(Math.min(...cels.map((c) => c.h)) * 10) / 10 }, celulaEfetiva: 'CELEF',
      aba: { visual: `${Math.round(ac.w * 10) / 10}x${Math.round(ac.h * 10) / 10}`, efetiva: window.__varrer(aba), sobrepoeCelulaVizinha: sobrepoe }, rolagemHorizontal: document.documentElement.scrollWidth > innerWidth + 1, itens };
  });
  return { ...topo, ...grade, celulaEfetiva: celEf };
};
const medirUltimoCartao = (pg) => pg.evaluate(() => {
  for (const s of ['.agd-gv', '.agd-gv-corpo']) { const e = document.querySelector(s); if (e) e.scrollTop = e.scrollHeight; }
  const itens = [...document.querySelectorAll('.agd-detalhe .agd-item')], ult = itens[itens.length - 1].getBoundingClientRect(), rod = document.querySelector('.agd-gv-rod .btn').getBoundingClientRect();
  return { cartoes: itens.length, baseDoUltimo: Math.round(ult.bottom), topoDoBotao: Math.round(rod.top), folga: Math.round(rod.top - ult.bottom), inteiroAcimaDoRodape: ult.bottom <= rod.top + 0.5 && ult.top >= 0 };
});

const alvos = [
  ['computador', { viewport: { width: 1360, height: 900 } }],
  ['ipad', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['iphone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];
for (const [nome, opc] of alvos) for (const tema of ['claro', 'escuro']) {
  const { ctx, pg } = await novo(opc, tema);
  const chave = `${nome}-${tema}`; medidas[chave] = {};
  await foto(pg, `${chave}-grade`, { pagina: true });
  if (nome === 'iphone') medidas[chave].celular = await medirCelular(pg);
  await abrir(pg, '2026-11-18'); await foto(pg, `${chave}-dia-cheio`);
  if (nome === 'iphone') { medidas[chave].ultimoCartao = await medirUltimoCartao(pg); await pg.waitForTimeout(300); await foto(pg, `${chave}-dia-cheio-fim`); }
  await fechar(pg);
  await abrir(pg, '2026-11-17'); await foto(pg, `${chave}-dia-vazio`); await fechar(pg);
  medidas[chave].contrastes = {}; for (const [k, s] of Object.entries(CONTRASTES)) { const v = await contraste(pg, s); if (v !== null) medidas[chave].contrastes[k] = v; }
  if (nome === 'computador' && tema === 'claro') {
    // virada do ano: o título e a aba ativa são conferidos ANTES de salvar cada imagem
    const passos = [['Dezembro 2026', 'dezembro-2026', 'Dezembro de 2026', 'Próximo mês', 1], ['Janeiro 2027', 'janeiro-2027', 'Janeiro de 2027', 'Próximo mês', 1], ['Dezembro 2026', 'volta-dezembro-2026', 'Dezembro de 2026', 'Mês anterior', 1]];
    medidas[chave].virada = [];
    for (const [titulo, arq, aba, seta, vezes] of passos) {
      for (let i = 0; i < vezes; i++) { await pg.click(`[aria-label="${seta}"]`); await pg.waitForTimeout(350); }
      const t = await periodo(pg), a = await abaAtiva(pg), confere = t === titulo && a === aba;
      medidas[chave].virada.push({ arquivo: arq, titulo: t, abaAtiva: a, confere });
      if (!confere) { console.error(`CONFERÊNCIA FALHOU em ${arq}: título "${t}", aba "${a}"`); process.exitCode = 1; }
      await foto(pg, `${chave}-${arq}`, { pagina: true });
    }
  }
  await ctx.close();
}
// larguras de celular para medir o limite da composição (375 e 320): grade e medidas, claro
for (const w of [375, 320]) {
  const { ctx, pg } = await novo({ viewport: { width: w, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'claro');
  medidas[`iphone-${w}-claro`] = { celular: await medirCelular(pg) };
  await foto(pg, `iphone-${w}-claro-grade`, { pagina: true });
  await abrir(pg, '2026-11-18'); medidas[`iphone-${w}-claro`].ultimoCartao = await medirUltimoCartao(pg); await ctx.close();
}
await nav.close(); parar();
writeFileSync(`${SAIDA}/medidas.json`, JSON.stringify(medidas, null, 2));
console.log('medidas gravadas em', `${SAIDA}/medidas.json`);

// ---------- índice HTML lado a lado: referência, antes e depois ----------
mkdirSync(`${RAIZ}/referencia`, { recursive: true });
if (existsSync(PRINT)) copyFileSync(PRINT, `${RAIZ}/referencia/print.png`);
const tem = (r, f) => existsSync(`${RAIZ}/${r}/${f}`);
const nomes = [...new Set(['antes', 'depois'].flatMap((r) => (existsSync(`${RAIZ}/${r}`) ? readdirSync(`${RAIZ}/${r}`).filter((f) => f.endsWith('.png')) : [])))].sort();
const linhas = nomes.map((f) => `<section><h2>${f.replace('.png', '')}</h2><div class="g"><figure><figcaption>Referência (print)</figcaption><img src="referencia/print.png" alt="print"></figure>${['antes', 'depois'].map((r) => `<figure><figcaption>${r === 'antes' ? 'Antes do ajuste (4a91207)' : 'Depois do ajuste'}</figcaption>${tem(r, f) ? `<img src="${r}/${f}" alt="${r} ${f}">` : '<p>sem captura</p>'}</figure>`).join('')}</div></section>`).join('\n');
writeFileSync(`${RAIZ}/index.html`, `<!doctype html><meta charset="utf-8"><title>Mês da Agenda: ajuste de 13/11, antes e depois</title><style>body{font:14px system-ui;margin:16px;background:#f2f2f2}h2{font-size:16px}.g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}img{max-width:100%;border:1px solid #ccc;background:#fff}figcaption{font-weight:600;margin-bottom:4px}</style><h1>Mês da Agenda: ajuste de 13/11, antes e depois</h1>${linhas}`);
console.log('pronto:', SAIDA);
