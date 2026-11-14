// Detalhe da demanda (consulta com lápis) distribuído pela largura e pelo conteúdo (decisão 73), no navegador (Edge) com o banco local de TESTE (PGlite, dados fictícios):
// janela larga com duas colunas quando a largura útil permite (800 px), uma coluna em janela intermediária e estreita, blocos largos (tarefas, seção em edição) na largura inteira, ordem de leitura e de foco
// preservada, descrição e tarefas longas, poucas tarefas e nenhuma, sem corte nem rolagem horizontal, e os fluxos de edição e de conclusão de tarefa intactos.
// Sobe o próprio servidor (porta 7125) com a pasta de dados semeada antes. NÃO valida o Supabase real. Uso: node scripts/testar-detalhe.mjs
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync } from 'node:fs';
import { semearAgenda, USUARIO_TESTE } from './semear-agenda.mjs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

const PORTA = process.env.PORTA_TESTE_DETALHE || '7125', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/detalhe';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const DESCRICAO = 'O Ministério Público encaminhou requisição para que a Secretaria preste informações detalhadas sobre os contratos de limpeza urbana, coleta seletiva e destinação final dos resíduos sólidos do município, abrangendo os exercícios de 2023, 2024 e 2025.\n\nÉ necessário reunir as planilhas de medição mensais, as notas fiscais correspondentes, os termos aditivos e as manifestações da fiscalização do contrato.\n\nA resposta deve ser assinada pelo Secretário e acompanhada de cópia integral do processo administrativo, com as folhas numeradas e rubricadas.';
const TAREFAS = ['Solicitar ao setor de Contratos a cópia integral do processo administrativo, com as folhas numeradas, rubricadas e acompanhadas do índice atualizado de todos os documentos', 'Reunir as planilhas de medição mensais dos exercícios de 2023, 2024 e 2025 e conferir cada valor com as notas fiscais emitidas pela empresa contratada', 'Pedir parecer da Procuradoria sobre os termos aditivos e sobre a regularidade da prorrogação do contrato de coleta seletiva', 'Elaborar o texto da resposta ao Ministério Público explicando as diferenças entre o quantitativo previsto e o efetivamente executado em cada período', 'Revisar o texto com a Controladoria', 'Providenciar a assinatura do Secretário', 'Protocolar a resposta em meio eletrônico e em papel', 'Registrar no Dmanda a data do protocolo', 'Arquivar a cópia da resposta e dos anexos na pasta do exercício correspondente'];
await semearAgenda(PASTA, '2026-11-03');
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  const c = (f, a) => chamarComoUsuario(db, USUARIO_TESTE, f, a);
  const dem = (assunto, o = {}) => c('criar_demanda', { p: { assunto, tipo: 'Memorando', numero: '', etapa: 'Fazendo', ...o } });
  const longa = await dem('Requisição do Ministério Público sobre os contratos de limpeza urbana', { numero: '310/2026', origem: 'Ministério Público', descricao: DESCRICAO, chegou_em: '2026-10-28', prazo_original: '2026-11-20', prazo_tipo: 'Legal', setor: 'Procuradoria' });
  for (const t of TAREFAS) await c('adicionar_tarefa', { p_demanda: longa.id, p_texto: t });
  const poucas = await dem('Ofício sobre a reforma da praça', { numero: '311/2026', descricao: 'Pedido de informação sobre o cronograma.', prazo_original: '2026-11-17' });
  await c('adicionar_tarefa', { p_demanda: poucas.id, p_texto: 'Responder o ofício' });
  await dem('Memorando sem tarefas', { numero: '312/2026', prazo_original: '2026-11-19' });
  await db.close();
}
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_SEM_CLIMA: 'sim', DMANDA_PASTA_TESTE: PASTA, CRON_SECRET: 'segredo-de-teste' }, stdio: 'ignore' });
const parar = () => { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } };
process.on('exit', parar);
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* ainda subindo */ } await new Promise((r) => setTimeout(r, 2000)); }

const nav = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
const erros = [];
const PERFIS = {
  1920: { viewport: { width: 1920, height: 1000 } }, 1440: { viewport: { width: 1440, height: 900 } }, 1024: { viewport: { width: 1024, height: 768 } },
  820: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 390: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 320: { viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const abrir = async (pg, texto) => {
  const card = pg.locator('.dcard', { hasText: texto }).first();
  await card.evaluate((e) => e.scrollIntoView({ block: 'center' })); await card.locator('.assunto').click();
  await pg.waitForSelector('.modal', { timeout: 15000 }); await pg.waitForTimeout(700);
};
const fechar = async (pg) => { await pg.keyboard.press('Escape'); await pg.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 8000 }); await pg.waitForTimeout(300); };
const medir = (pg) => pg.evaluate(() => {
  const m = document.querySelector('.modal'), mb = m.getBoundingClientRect(), det = document.querySelector('.det').getBoundingClientRect();
  const secs = Object.fromEntries([...document.querySelectorAll('.det-grade > .sec')].map((e) => { const b = e.getBoundingClientRect(); return [e.dataset.secao, { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom, ed: e.dataset.editando === 'true' }]; }));
  const fora = [...m.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > mb.right + 1 || b.left < mb.left - 1) && !e.closest('.sr-only'); }).length;
  const campos = [...document.querySelectorAll('.det-grade input:not([type=checkbox]), .det-grade select, .det-grade textarea')].map((e) => e.getBoundingClientRect().width);
  return { modal: { w: mb.width, x: mb.x }, det: { w: det.width }, secs, fora, semRolH: m.scrollWidth <= m.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1, ordemDom: [...document.querySelectorAll('.det-grade > .sec')].map((e) => e.dataset.secao), ordemLapis: [...document.querySelectorAll('.det-grade [data-lapis]')].map((e) => e.dataset.lapis), campos, vw: innerWidth };
});
const mesmaLinha = (a, b) => Math.abs(a.y - b.y) < 8;
const colunaUnica = (m) => Object.values(m.secs).every((s, i, l) => Math.abs(s.x - l[0].x) < 4 && (i === 0 || s.y >= l[i - 1].b - 2));
const ORDEM = ['identificacao', 'descricao', 'chegada', 'andamento', 'tarefas'];

for (const larg of [1920, 1440, 1024, 820, 390, 320]) {
  const ctx = await nav.newContext(PERFIS[larg]);
  await ctx.addInitScript(() => { try { localStorage.setItem('dmanda-tema', '"claro"'); localStorage.setItem('dmanda:ui', '{"visao":"cards"}'); } catch { /* sem armazenamento */ } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  await pg.goto(BASE + '/demandas', { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.dcard', { timeout: 120000 }); await pg.waitForTimeout(900);
  await abrir(pg, 'Requisição do Ministério Público');
  const m = await medir(pg), s = m.secs;
  ok(JSON.stringify(m.ordemDom) === JSON.stringify(ORDEM) && JSON.stringify(m.ordemLapis) === JSON.stringify(ORDEM), `${larg} px: a ordem de leitura e de foco segue identificação, descrição, chegada e prazo, andamento e tarefas`);
  ok(m.semRolH && m.fora === 0, `${larg} px: sem rolagem horizontal e nada fora da janela (janela de ${Math.round(m.modal.w)} px)`);
  if (larg >= 1160) ok(Math.round(m.modal.w) === 1120, `${larg} px: a janela larga usa 1120 px (${Math.round(m.modal.w)})`);
  if (m.det.w >= 800) {
    ok(mesmaLinha(s.identificacao, s.descricao) && s.descricao.x > s.identificacao.x + 200 && mesmaLinha(s.chegada, s.andamento) && s.andamento.x > s.chegada.x + 200 && s.chegada.y > s.identificacao.y + 100, `${larg} px (${Math.round(m.det.w)} px de largura útil): identificação ao lado da descrição, e chegada e prazo ao lado do andamento, nesta ordem`);
    ok(s.tarefas.y > s.chegada.b - 2 && Math.abs(s.tarefas.w - m.det.w) < 4, `${larg} px: as tarefas ocupam a largura inteira, abaixo dos blocos, sem ficar apertadas`);
    ok(s.identificacao.w >= 330 && s.descricao.w >= 330 && s.chegada.w >= 330 && s.andamento.w >= 330, `${larg} px: cada coluna tem pelo menos 330 px para a leitura (${Math.round(Math.min(s.identificacao.w, s.descricao.w, s.chegada.w, s.andamento.w))} px)`);
  } else ok(colunaUnica(m), `${larg} px (${Math.round(m.det.w)} px de largura útil, menos de 800): os blocos ficam numa coluna só, na largura inteira, na ordem de leitura`);
  // dl com rótulo ao lado quando há largura, e empilhado quando o bloco é estreito
  const ler = await pg.evaluate(() => { const dl = document.querySelector('[data-secao="identificacao"] .ler'), dt = dl.querySelector('dt').getBoundingClientRect(), dd = dl.querySelector('dd').getBoundingClientRect(); return { lado: dd.x > dt.right - 2 && Math.abs(dd.y - dt.y) < 12, larguraBloco: dl.getBoundingClientRect().width }; });
  ok(ler.larguraBloco > 420 ? ler.lado : !ler.lado || ler.larguraBloco > 330, `${larg} px: rótulos e valores de Identificação ${ler.lado ? 'lado a lado' : 'empilhados'} para ${Math.round(ler.larguraBloco)} px de bloco`);

  if (larg === 1440 || larg === 820 || larg === 390) {
    // seção em edição usa a largura inteira, os campos não ficam apertados e Cancelar devolve as duas colunas
    await pg.click('[data-lapis="descricao"]'); await pg.waitForTimeout(400);
    const e1 = await medir(pg), d = e1.secs.descricao;
    ok(d.ed && Math.abs(d.w - e1.det.w) < 4 && e1.campos.every((w) => w >= 200) && e1.semRolH && e1.fora === 0, `${larg} px: a descrição em edição ocupa a largura inteira (${Math.round(d.w)} px), o campo tem ${Math.round(Math.max(...e1.campos))} px e nada corta`);
    if (e1.det.w >= 800) ok(e1.secs.identificacao.w > e1.det.w - 4 && e1.secs.descricao.y > e1.secs.identificacao.b - 2, `${larg} px: o bloco que ficaria sozinho antes da edição também usa a largura inteira (sem buraco ao lado)`);
    await pg.click('.sec-acoes .btn:not(.pri)'); await pg.waitForTimeout(400);
    const e2 = await medir(pg);
    ok(!e2.secs.descricao.ed && (e1.det.w < 800 || mesmaLinha(e2.secs.identificacao, e2.secs.descricao)), `${larg} px: Cancelar fecha a edição e devolve a composição de antes`);
    await pg.click('[data-lapis="chegada"]'); await pg.waitForTimeout(400);
    const e3 = await medir(pg);
    ok(e3.secs.chegada.ed && Math.abs(e3.secs.chegada.w - e3.det.w) < 4 && e3.campos.every((w) => w >= 130) && e3.semRolH && e3.fora === 0, `${larg} px: Chegada e prazo em edição ocupa a largura inteira com campos legíveis (${Math.round(Math.min(...e3.campos))} px no menor) e sem corte`);
    await pg.click('.sec-acoes .btn:not(.pri)'); await pg.waitForTimeout(300);
    await pg.click('[data-lapis="tarefas"]'); await pg.waitForTimeout(500);
    const e4 = await medir(pg);
    ok(e4.secs.tarefas.ed && Math.abs(e4.secs.tarefas.w - e4.det.w) < 4 && e4.semRolH && e4.fora === 0 && (await pg.$$('.tarefas.ed .t-item')).length === TAREFAS.length, `${larg} px: as ${TAREFAS.length} tarefas longas em edição cabem na largura inteira, sem corte nem rolagem horizontal`);
    await pg.click('.sec-acoes .btn:not(.pri)'); await pg.waitForTimeout(300);
  }
  if (larg === 1440 || larg === 390) {
    // concluir tarefa continua funcionando no novo arranjo
    const antes = await pg.textContent('[data-secao="tarefas"] .m-prog');
    await pg.click('[data-secao="tarefas"] .t-ler li:first-child input'); await pg.waitForFunction((a) => document.querySelector('[data-secao="tarefas"] .m-prog')?.textContent !== a, antes, { timeout: 15000 }); await pg.waitForTimeout(300);
    ok(/1 de 9 concluídas/.test(await pg.textContent('[data-secao="tarefas"] .m-prog')), `${larg} px: marcar uma tarefa continua gravando e atualiza "1 de 9 concluídas"`);
    await pg.click('[data-secao="tarefas"] .t-ler li:first-child input'); await pg.waitForTimeout(500);
  }
  await fechar(pg);
  // poucas tarefas e nenhuma
  await abrir(pg, 'Ofício sobre a reforma da praça');
  const p = await medir(pg);
  ok(p.semRolH && p.fora === 0 && (await pg.$$('[data-secao="tarefas"] .t-ler li')).length === 1 && (p.det.w < 800 ? colunaUnica(p) : mesmaLinha(p.secs.identificacao, p.secs.descricao) && Math.abs(p.secs.tarefas.w - p.det.w) < 4), `${larg} px: com uma só tarefa a composição se mantém, sem corte`);
  await fechar(pg);
  await abrir(pg, 'Memorando sem tarefas');
  const n = await medir(pg);
  ok(n.semRolH && n.fora === 0 && /Nenhuma tarefa cadastrada/.test(await pg.textContent('[data-secao="tarefas"]')) && (n.det.w < 800 ? colunaUnica(n) : Math.abs(n.secs.tarefas.w - n.det.w) < 4), `${larg} px: sem tarefas, o bloco mostra "Nenhuma tarefa cadastrada" na largura inteira e nada corta`);
  await fechar(pg);
  await ctx.close();
}
ok(erros.length === 0, 'nenhum erro de página durante todos os fluxos' + (erros.length ? ': ' + [...new Set(erros)].slice(0, 5).join(' | ') : ''));
await nav.close();
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
parar();
process.exit(falhas ? 1 : 0);
