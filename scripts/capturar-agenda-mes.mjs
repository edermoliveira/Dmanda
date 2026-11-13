// Capturas de REVISÃO do Mês da Agenda (decisão 72), com dados fictícios e um cenário controlado: dia cheio, dia vazio, título longo, prazo ajustado (cai no sábado e vai para a sexta),
// evento de dia inteiro e a virada de dezembro para janeiro. Mesmo navegador, mesmas larguras, mesmos temas, mesma data de referência e mesmos dados para o "antes" e o "depois".
// Uso: node scripts/capturar-agenda-mes.mjs antes|depois   (grava em .dados-teste/comparacao-agenda-mes/<rótulo>/, fora do Git, e refaz o índice HTML)
// Só abre um banco de TESTE descartável (PGlite) em .dados-teste/agenda-mes-captura; nunca toca o Supabase real.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, existsSync, copyFileSync, writeFileSync, readdirSync } from 'node:fs';
import { semearAgenda, USUARIO_TESTE } from './semear-agenda.mjs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

const ROTULO = process.argv[2];
if (!['antes', 'depois'].includes(ROTULO)) { console.error('Informe antes ou depois.'); process.exit(2); }
const PORTA = process.env.PORTA_CAPTURA_MES || '7122', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/agenda-mes-captura', SAIDA = `.dados-teste/comparacao-agenda-mes/${ROTULO}`;
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
  // dia cheio (quarta, 18/11): três compromissos, um de título longo, e três vencimentos
  await ev({ titulo: 'Reunião de secretariado', data: '2026-11-18', inicio: '09:00', fim: '10:00', aviso_min: null });
  await ev({ titulo: 'Audiência pública para revisão do plano diretor e do zoneamento urbano do município', tipo: 'Compromisso', data: '2026-11-18', inicio: '14:00', fim: '16:00', aviso_min: null });
  await ev({ titulo: 'Visita à obra da escola', tipo: 'Compromisso', data: '2026-11-18', inicio: '16:30', aviso_min: null });
  for (const [a, n] of [['Parecer sobre o contrato de limpeza urbana e coleta seletiva do exercício', '201/2026'], ['Ofício ao Tribunal de Contas', '202/2026'], ['Memorando do RH sobre férias', '203/2026']]) await dem(a, { numero: n, prazo_original: '2026-11-18' });
  // prazo ajustado: sábado 21/11 vai para a sexta 20/11 (o vencimento efetivo é o que aparece)
  await dem('Resposta ao Ministério Público', { numero: '204/2026', prazo_original: '2026-11-21', prazo_tipo: 'Legal' });
  // dia inteiro
  await ev({ titulo: 'Semana do servidor público', tipo: 'Lembrete', data: '2026-11-25', dia_inteiro: true, aviso_min: null });
  // virada de ano
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
// a rolagem é a do miolo do aplicativo, não a da página: para a grade inteira, o navegador ganha altura (e volta ao tamanho no fim)
const foto = async (pg, nome, o = {}) => {
  const v = pg.viewportSize();
  if (o.pagina) { await pg.setViewportSize({ width: v.width, height: v.width < 500 ? 2300 : v.width < 1000 ? 2000 : 1500 }); await pg.waitForTimeout(500); }
  await pg.waitForTimeout(450); await pg.screenshot({ path: `${SAIDA}/${nome}.png` });
  if (o.pagina) { await pg.setViewportSize(v); await pg.waitForTimeout(300); }
  console.log('capturou', nome);
};
const dia = async (pg, d) => { await pg.click(`.agd-cel[data-data="${d}"]`); await pg.waitForTimeout(500); };
const alvos = [
  ['computador', { viewport: { width: 1360, height: 900 } }],
  ['ipad', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['iphone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];
for (const [nome, opc] of alvos) for (const tema of nome === 'computador' ? ['claro', 'escuro'] : ['claro']) {
  const { ctx, pg } = await novo(opc, tema);
  await foto(pg, `${nome}-${tema}-grade`, { pagina: true });
  await dia(pg, '2026-11-18'); await foto(pg, `${nome}-${tema}-dia-cheio`);
  if (ROTULO === 'depois') await pg.keyboard.press('Escape');
  await dia(pg, '2026-11-17'); await foto(pg, `${nome}-${tema}-dia-vazio`);
  if (ROTULO === 'depois') await pg.keyboard.press('Escape');
  if (nome === 'computador' && tema === 'claro') {
    await pg.click('[aria-label="Próximo mês"]'); await pg.click('[aria-label="Próximo mês"]'); await foto(pg, 'computador-claro-dezembro', { pagina: true });
    await pg.click('[aria-label="Próximo mês"]'); await foto(pg, 'computador-claro-janeiro', { pagina: true });
  }
  await ctx.close();
}
await nav.close(); parar();

// ---------- índice HTML lado a lado: referência, antes e depois ----------
const base = '.dados-teste/comparacao-agenda-mes';
mkdirSync(`${base}/referencia`, { recursive: true });
if (existsSync(PRINT)) copyFileSync(PRINT, `${base}/referencia/print.png`);
const tem = (r, f) => existsSync(`${base}/${r}/${f}`);
const nomes = existsSync(`${base}/depois`) ? readdirSync(`${base}/depois`).filter((f) => f.endsWith('.png')) : readdirSync(SAIDA).filter((f) => f.endsWith('.png'));
const linhas = nomes.map((f) => `<section><h2>${f.replace('.png', '')}</h2><div class="g"><figure><figcaption>Referência (print)</figcaption><img src="referencia/print.png" alt="print"></figure>${['antes', 'depois'].map((r) => `<figure><figcaption>${r === 'antes' ? 'Mês anterior' : 'Novo Mês'}</figcaption>${tem(r, f) ? `<img src="${r}/${f}" alt="${r} ${f}">` : '<p>sem captura</p>'}</figure>`).join('')}</div></section>`).join('\n');
writeFileSync(`${base}/index.html`, `<!doctype html><meta charset="utf-8"><title>Mês da Agenda: referência, antes e depois</title><style>body{font:14px system-ui;margin:16px;background:#f2f2f2}h2{font-size:16px}.g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}img{max-width:100%;border:1px solid #ccc;background:#fff}figcaption{font-weight:600;margin-bottom:4px}</style><h1>Mês da Agenda: referência, antes e depois</h1>${linhas}`);
console.log('pronto:', SAIDA);
