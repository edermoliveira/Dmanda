// Capturas e medidas de REVISÃO dos ajustes de layout de 13/11/2026 (decisão 73): Mês da Agenda (painéis laterais, heatmap do iPhone com o dia abaixo da grade, cabeçalho),
// Configurações e detalhe de Demandas. Dados fictícios, mesmo navegador, mesmas larguras, mesmos temas e mesma data de referência para o "antes" e o "depois".
// Uso: node scripts/capturar-ajustes-layout.mjs antes|depois [agenda|config|detalhe]   (grava em .dados-teste/comparacao-ajustes-layout/<rótulo>/, fora do Git, com medidas.json)
// Só abre um banco de TESTE descartável (PGlite) em .dados-teste/ajustes-layout-captura; nunca toca o Supabase real.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { semearAgenda, USUARIO_TESTE } from './semear-agenda.mjs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

const ROTULO = process.argv[2];
if (!['antes', 'depois'].includes(ROTULO)) { console.error('Informe antes ou depois.'); process.exit(2); }
const PARTES = process.argv[3] ? [process.argv[3]] : ['agenda', 'config', 'detalhe'];
const PORTA = process.env.PORTA_CAPTURA_LAYOUT || '7123', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/ajustes-layout-captura';
const RAIZ = '.dados-teste/comparacao-ajustes-layout', SAIDA = `${RAIZ}/${ROTULO}`;
const REFERENCIA = '2026-11-03';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync(SAIDA, { recursive: true });

const DESCRICAO_LONGA = [
  'O Ministério Público encaminhou requisição para que a Secretaria preste informações detalhadas sobre os contratos de limpeza urbana, coleta seletiva e destinação final dos resíduos sólidos do município, abrangendo os exercícios de 2023, 2024 e 2025.',
  'É necessário reunir as planilhas de medição mensais, as notas fiscais correspondentes, os termos aditivos e as manifestações da fiscalização do contrato, além de justificar eventuais diferenças entre o quantitativo previsto e o executado.',
  'A resposta deve ser assinada pelo Secretário e acompanhada de cópia integral do processo administrativo, com as folhas numeradas e rubricadas, e protocolada em meio eletrônico e em papel dentro do prazo fixado pelo órgão requisitante.',
].join('\n\n');
const TAREFAS_LONGAS = [
  'Solicitar ao setor de Contratos a cópia integral do processo administrativo, com as folhas numeradas, rubricadas e acompanhadas do índice atualizado de todos os documentos',
  'Reunir as planilhas de medição mensais dos exercícios de 2023, 2024 e 2025 e conferir cada valor com as notas fiscais emitidas pela empresa contratada',
  'Pedir parecer da Procuradoria sobre os termos aditivos e sobre a regularidade da prorrogação do contrato de coleta seletiva',
  'Elaborar o texto da resposta ao Ministério Público explicando as diferenças entre o quantitativo previsto e o efetivamente executado em cada período',
  'Revisar o texto com a Controladoria e incorporar as observações sobre a fiscalização do contrato',
  'Providenciar a assinatura do Secretário e do Prefeito, quando necessário, nas duas vias do ofício de encaminhamento',
  'Protocolar a resposta em meio eletrônico e em papel, guardando o comprovante de recebimento no processo',
  'Registrar no Dmanda a data do protocolo e programar o acompanhamento de uma eventual nova requisição',
  'Arquivar a cópia da resposta e dos anexos na pasta do exercício correspondente',
];

// ---------- dados: a semente da Agenda, o cenário do Mês e as demandas do detalhe ----------
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
  await dem('Resposta ao Ministério Público', { numero: '204/2026', prazo_original: '2026-11-21', prazo_tipo: 'Legal' });
  await dem('Ofício em atraso ao Tribunal', { numero: '207/2026', prazo_original: '2026-11-02' });
  await ev({ titulo: 'Semana do servidor público', tipo: 'Lembrete', data: '2026-11-25', dia_inteiro: true, aviso_min: null });
  await ev({ titulo: 'Reunião com o Prefeito', tipo: 'Compromisso', data: '2026-11-24', inicio: '10:00', fim: '11:00', aviso_min: null }); // dia só com compromisso
  await dem('Prestação de contas anual', { numero: '205/2026', prazo_original: '2026-12-31', prazo_tipo: 'Legal' });
  // demandas do detalhe: descrição e tarefas longas, poucas tarefas e nenhuma
  const longa = await dem('Requisição do Ministério Público sobre os contratos de limpeza urbana', { numero: '310/2026', origem: 'Ministério Público', descricao: DESCRICAO_LONGA, chegou_em: '2026-10-28', prazo_original: '2026-11-20', prazo_tipo: 'Legal', setor: 'Procuradoria' });
  for (const t of TAREFAS_LONGAS) await c('adicionar_tarefa', { p_demanda: longa.id, p_texto: t });
  const poucas = await dem('Ofício sobre a reforma da praça', { numero: '311/2026', descricao: 'Pedido de informação sobre o cronograma.', prazo_original: '2026-11-17' });
  await c('adicionar_tarefa', { p_demanda: poucas.id, p_texto: 'Responder o ofício' });
  await dem('Memorando sem tarefas', { numero: '312/2026', prazo_original: '2026-11-19' });
  for (const [d, t, cat] of [['2026-11-15', 'Proclamação da República', 'Feriado'], ['2026-11-20', 'Consciência Negra', 'Feriado'], ['2026-12-25', 'Natal', 'Feriado'], ['2026-11-27', 'Congresso da AMVARS', 'Evento externo']]) await c('salvar_dia_indisponivel', { p: { data: d, descricao: t, categoria: cat } });
  await db.close();
}

const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_SEM_CLIMA: 'sim', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-captura' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const horaSP = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });
const INSTANTE = new Date(`${REFERENCIA}T${horaSP}-03:00`);
const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const novo = async (opcoes, tema, rota, prefs = null) => {
  const ctx = await nav.newContext(opcoes);
  await ctx.clock.install({ time: INSTANTE });
  await ctx.addInitScript(([t, p]) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); if (p) localStorage.setItem('dmanda:agenda', JSON.stringify(p)); } catch { /* sem armazenamento */ } }, [tema, prefs]);
  const pg = await ctx.newPage();
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando a agenda|Carregando as demandas/.test(document.body.innerText), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  await pg.waitForTimeout(1200);
  return { ctx, pg };
};
const medidas = existsSync(`${SAIDA}/medidas.json`) ? JSON.parse(readFileSync(`${SAIDA}/medidas.json`, 'utf8')) : {}; // uma parte por vez soma às medidas já guardadas
// a rolagem é a do miolo do aplicativo: para a página inteira, o navegador ganha altura (e volta ao tamanho no fim)
const foto = async (pg, nome, o = {}) => {
  const v = pg.viewportSize();
  if (o.pagina) { await pg.setViewportSize({ width: v.width, height: o.altura ?? (v.width < 500 ? 2600 : v.width < 1000 ? 2300 : 1700) }); await pg.waitForTimeout(500); }
  await pg.waitForTimeout(350); await pg.screenshot({ path: `${SAIDA}/${nome}.png` });
  if (o.pagina) { await pg.setViewportSize(v); await pg.waitForTimeout(300); }
  console.log('capturou', nome);
};
// o que importa para "uma só rolagem" e "sem corte": rolagem horizontal, elementos roláveis dentro do miolo e elementos que passam da borda
const medirPagina = (pg) => pg.evaluate(() => {
  const w = innerWidth, main = document.querySelector('.main');
  const roláveis = [...document.querySelectorAll('.main *')].filter((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 0; }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`).slice(0, 8);
  const passam = [...document.querySelectorAll('.main *, .modal *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1) && !e.closest('.sr-only'); }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`).slice(0, 8);
  return { largura: w, rolagemHorizontalDocumento: document.documentElement.scrollWidth > w + 1, rolagemHorizontalMain: main ? main.scrollWidth > main.clientWidth + 1 : null, rolaveisDentroDoMain: roláveis, elementosForaDaBorda: passam };
});

const ALVOS = [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['ipad', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['w390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['w375', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['w320', { viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];

// ---------- Agenda ----------
if (PARTES.includes('agenda')) {
  const DIAS = [['cheio', '2026-11-18'], ['so-compromisso', '2026-11-24'], ['vazio', '2026-11-17']];
  for (const [nome, opc] of ALVOS) for (const tema of ['claro', 'escuro']) {
    const { ctx, pg } = await novo(opc, tema, '/agenda', { modo: 'mes' });
    const chave = `agenda-${nome}-${tema}`; medidas[chave] = { pagina: await medirPagina(pg) };
    await foto(pg, `${chave}-mes`, { pagina: true });
    if (tema === 'claro' || nome === 'w390') {
      for (const [rot, d] of DIAS) {
        await pg.locator(`.agd-cel[data-data="${d}"]`).evaluate((e) => e.scrollIntoView({ block: 'center' }));
        await pg.click(`.agd-cel[data-data="${d}"]`); await pg.waitForTimeout(800);
        await foto(pg, `${chave}-dia-${rot}`);
        if (ROTULO === 'depois') await foto(pg, `${chave}-dia-${rot}-pagina`, { pagina: true });
        if (await pg.$('.agd-detalhe')) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(400); }
      }
      medidas[chave].aposSelecionar = await medirPagina(pg);
    }
    await ctx.close();
  }
  // larguras intermediárias do computador: onde a lateral passa para baixo
  for (const w of [1280, 1100, 1000, 900]) {
    const { ctx, pg } = await novo({ viewport: { width: w, height: 900 } }, 'claro', '/agenda', { modo: 'mes' });
    medidas[`agenda-desktop-${w}`] = { pagina: await medirPagina(pg) };
    await foto(pg, `agenda-desktop-${w}-claro-mes`, { pagina: true, altura: 1900 });
    await ctx.close();
  }
}

// ---------- Configurações ----------
if (PARTES.includes('config')) {
  for (const [nome, v] of [['larga-1920', 1920], ['larga-1440', 1440], ['intermediaria-1024', 1024], ['ipad-820', 820], ['estreita-390', 390]]) {
    const { ctx, pg } = await novo(v >= 820 && v < 1000 ? ALVOS[1][1] : v === 390 ? ALVOS[2][1] : { viewport: { width: v, height: 900 } }, 'claro', '/config');
    medidas[`config-${nome}`] = { pagina: await medirPagina(pg) };
    await foto(pg, `config-${nome}-claro`, { pagina: true, altura: v < 500 ? 5200 : 2600 });
    await ctx.close();
  }
  const { ctx, pg } = await novo({ viewport: { width: 1440, height: 900 } }, 'escuro', '/config');
  await foto(pg, 'config-larga-1440-escuro', { pagina: true, altura: 2600 }); await ctx.close();
}

// ---------- detalhe de Demandas ----------
if (PARTES.includes('detalhe')) {
  const ABRIR = [['longa', 'Requisição do Ministério Público'], ['poucas', 'Ofício sobre a reforma da praça'], ['nenhuma', 'Memorando sem tarefas']];
  for (const [nome, opc] of [['larga-1920', { viewport: { width: 1920, height: 1000 } }], ['larga-1440', ALVOS[0][1]], ['intermediaria-1024', { viewport: { width: 1024, height: 768 } }], ['ipad-820', ALVOS[1][1]], ['estreita-390', ALVOS[2][1]], ['estreita-320', ALVOS[4][1]]]) {
    const { ctx, pg } = await novo(opc, 'claro', '/demandas');
    for (const [rot, texto] of ABRIR) {
      const card = pg.locator('.dcard', { hasText: texto }).first();
      await card.evaluate((e) => e.scrollIntoView({ block: 'center' })); await card.locator('.assunto').click();
      await pg.waitForSelector('.modal', { timeout: 15000 }); await pg.waitForTimeout(900);
      const chave = `detalhe-${nome}-${rot}`; medidas[chave] = { pagina: await medirPagina(pg) };
      await foto(pg, chave, {});
      // a janela inteira, sem rolagem interna: altura grande
      const v = pg.viewportSize(); await pg.setViewportSize({ width: v.width, height: 2400 }); await pg.waitForTimeout(500);
      medidas[chave].janela = await pg.evaluate(() => { const m = document.querySelector('.modal'), b = m.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; });
      await pg.screenshot({ path: `${SAIDA}/${chave}-inteira.png` });
      if (rot === 'longa') {
        // edição aberta: descrição e depois tarefas (uma seção por vez)
        for (const s of ['descricao', 'tarefas']) {
          await pg.click(`[data-lapis="${s}"]`); await pg.waitForTimeout(500);
          await pg.screenshot({ path: `${SAIDA}/${chave}-editando-${s}.png` });
          medidas[chave][`editando-${s}`] = await medirPagina(pg);
          await pg.click('.sec-acoes .btn:not(.pri)'); await pg.waitForTimeout(400);
        }
      }
      await pg.setViewportSize(v); await pg.waitForTimeout(300);
      await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 8000 }); await pg.waitForTimeout(400);
    }
    await ctx.close();
  }
}

writeFileSync(`${SAIDA}/medidas.json`, JSON.stringify(medidas, null, 1));
await nav.close(); parar();
console.log('pronto:', SAIDA);
