// Decisão 76, no navegador (Edge e, quando existe, o WebKit do Playwright) com o banco local de TESTE (PGlite, dados fictícios):
//   1) Configurações, Dias indisponíveis: cada controle (Data, Tipo, Descrição) com limite visível, rótulo associado, foco perceptível e a dica "Escolher a data" no campo vazio, nos dois temas;
//      o cadastro, a edição e o erro; o recálculo dos vencimentos.
//   2) (Pagamentos fica na `main` local até a migração ser aplicada no Supabase real.)
//   3) Agenda: o cabeçalho comum de Dia, Semana e Mês em 320, 390, 820 e 1360 px, claro e escuro, sem corte (inclusive o rótulo "Semana"), e a navegação de datas pelo "Ir para a data".
// A aceitação de um controle visível NÃO é "o elemento existe e o clique funciona": a suíte mede pixels. Cada controle é fotografado e a borda precisa aparecer na imagem com contraste de pelo menos 3:1 sobre o fundo;
// o campo de data vazio precisa mostrar tinta (a dica) e a data preenchida também. O WebKit do Playwright é o motor do Safari, NÃO o Safari do iPhone: o seletor nativo de data e o toque real ficam para o aparelho.
// NÃO valida o Supabase real. Sobe o próprio servidor (porta 7117, pasta de dados nova). Uso: node scripts/testar-campos.mjs
import { webkit } from 'playwright-core';
import { abrirEdge, criarVerificador, iniciarServidor } from './auxiliar-navegador.mjs';
import { rmSync, mkdirSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario, prepararTitularDeTeste, USUARIO_TESTE as USUARIO } from '../src/servidor/banco-teste-base.mjs';

const PORTA = process.env.PORTA_TESTE_CAMPOS || '7117', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/campos';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
// uma demanda com prazo numa quinta-feira (24/12/2026): cadastrar o Feriado nesse dia antecipa o vencimento
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  await prepararTitularDeTeste(db, USUARIO);
  await chamarComoUsuario(db, USUARIO, 'criar_demanda', { p: { assunto: 'Vencimento de prova', prazo_original: '2026-12-24' } });
  await db.close();
}
await iniciarServidor({ porta: PORTA, pasta: PASTA });
const { ok, resumo, aguardar } = criarVerificador();

const motores = [['Edge', await abrirEdge()]];
try { motores.push(['WebKit', await webkit.launch()]); } catch (e) { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); }
const erros = [];
// A camada desenhada do campo de data só vale onde `@supports (-webkit-touch-callout: none)` é verdadeiro (Safari do iPhone e do iPad); nenhum navegador deste computador atende essa condição.
// Para medir o layout dela, o teste reaplica as regras de dentro do bloco @supports (e a regra de cores forçadas que vem depois) sem a condição. É emulação: o aparelho confirma que o Safari atende a condição.
const camadaIOS = () => {
  const aplicar = () => {
    const css = [];
    for (const f of document.styleSheets) { let regras; try { regras = [...f.cssRules]; } catch { continue; } for (const r of regras) { if (r.constructor.name === 'CSSSupportsRule' && /touch-callout/.test(r.conditionText)) css.push(...[...r.cssRules].map((x) => x.cssText)); } for (const r of regras) if (r.constructor.name === 'CSSMediaRule' && /forced-colors/.test(r.conditionText) && /campo-data-dica/.test(r.cssText)) css.push(r.cssText); }
    if (!css.length) return; const st = document.createElement('style'); st.dataset.simulaIos = 'sim'; st.textContent = css.join(String.fromCharCode(10)); document.head.appendChild(st);
  };
  if (document.readyState === 'complete') aplicar(); else addEventListener('load', aplicar);
};
const novo = async (nav, { largura = 390, esquema = 'light', toque = true, ios = true } = {}) => {
  const ctx = await nav.newContext({ viewport: { width: largura, height: largura > 700 ? 1000 : 844 }, hasTouch: toque, isMobile: toque && nav === motores[0][1], deviceScaleFactor: 2, colorScheme: esquema });
  if (toque && ios) await ctx.addInitScript(camadaIOS);
  await ctx.addInitScript((t) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, esquema === 'dark' ? 'escuro' : 'claro');
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { if (!/api\/rascunhos due to access control checks/.test(e.message)) erros.push('pageerror: ' + e.message.slice(0, 300)); });   // o WebKit emulado relata assim um envio de rascunho interrompido por recarga ou navegação
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  return { ctx, pg };
};
const ir = async (pg, rota, esperar) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector(esperar, { timeout: 120000 });
  await pg.waitForFunction(() => !document.body.innerText.includes('Carregando'), null, { timeout: 60000 }).catch(() => {});
  // a janela "Completar os últimos dias" abre sozinha ao carregar (achado A2 da auditoria): fecha pelo X, como a pessoa faria
  const x = pg.locator('.modal-ov button[aria-label="Fechar"]');
  try { await x.first().waitFor({ state: 'visible', timeout: 4000 }); await x.first().click(); await pg.waitForSelector('.modal-ov', { state: 'detached', timeout: 5000 }); } catch { /* não abriu */ }
  await pg.waitForTimeout(300);
};

// ---------- medida de pixels: a imagem do controle, decodificada na própria página ----------
const PIXELS = `async ({ b64, margem, escala }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height).data, W = img.width, H = img.height;
  const px = (i, j) => { const k = (j * W + i) * 4; return [d[k], d[k + 1], d[k + 2]]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const taxa = (a, b) => { const p = lum(a), q = lum(b); return (Math.max(p, q) + .05) / (Math.min(p, q) + .05); };
  const fundo = px(1, 1); // a margem fotografada em volta do controle: o fundo do quadro
  const m = Math.round(margem * escala);
  // borda: na coluna central, do topo ao meio do controle, o ponto de maior contraste com o fundo do quadro
  let borda = 1; for (let j = 0; j < Math.round(H / 2); j++) borda = Math.max(borda, taxa(px(Math.round(W / 2), j), fundo));
  // interior: a cor do centro do campo e quanta "tinta" (pontos que contrastam 3:1 com ela) existe no miolo
  const miolo = px(m + 4, Math.round(H / 2)); let tinta = 0;
  for (let j = m + 4; j < H - m - 4; j += 2) for (let i = m + 8; i < W - m - 8; i += 2) if (taxa(px(i, j), miolo) >= 3) tinta++;
  // anel de foco: o ponto mais saturado e distinto na faixa externa (2 a 5 px fora da caixa)
  // centralização vertical da tinta: a folga acima e abaixo do que está escrito dentro do campo (em pixels da imagem)
  let topo = -1, base = -1; for (let j = m + 4; j < H - m - 4; j++) { let achou = false; for (let i = m + 26; i < W - m - 26 && !achou; i++) if (taxa(px(i, j), miolo) >= 3) achou = true; if (achou) { if (topo < 0) topo = j; base = j; } }
  const folgaTopo = topo < 0 ? -1 : topo - m, folgaBase = topo < 0 ? -1 : (H - m) - 1 - base;
  let anel = 1; for (let j = Math.max(0, m - 4); j < m; j++) anel = Math.max(anel, taxa(px(Math.round(W / 2), j), fundo));
  return { borda, tinta, anel, miolo, fundo, folgaTopo, folgaBase };
}`;
const foto = async (pg, seletor, margem = 8) => {
  const b = await pg.locator(seletor).first().boundingBox();
  const buf = await pg.screenshot({ clip: { x: Math.max(0, b.x - margem), y: Math.max(0, b.y - margem), width: b.width + 2 * margem, height: b.height + 2 * margem }, animations: 'disabled', caret: 'hide' });
  return pg.evaluate(`(${PIXELS})({ b64: ${JSON.stringify(buf.toString('base64'))}, margem: ${margem}, escala: 2 })`);
};
const CORES = `(() => {
  const parse = (s) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = s; const v = c.fillStyle; if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).concat(1); const m = v.match(/[\\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
  const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const mistura = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
  const taxa = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  return { parse, mistura, taxa };
})()`;
const contrasteCss = (pg, sel, prop, sobreSel, sobreProp = 'backgroundColor') => pg.evaluate(([s, p, so, sp, util]) => {
  const { parse, mistura, taxa } = eval(util);
  const fundo = parse(getComputedStyle(document.querySelector(so))[sp]), cor = parse(getComputedStyle(document.querySelector(s))[p]);
  return taxa(mistura(cor, fundo), fundo);
}, [sel, prop, sobreSel, sobreProp, CORES]);
const api = async (pg) => (await pg.request.get(BASE + '/api/exportar')).json();
const rotulo = (m, l, e) => `${m}, ${l} px, ${e === 'dark' ? 'escuro' : 'claro'}`;

// ================= 1) Configurações: Dias indisponíveis =================
for (const [nome, nav] of motores) for (const esquema of ['light', 'dark']) {
  const { ctx, pg } = await novo(nav, { largura: 390, esquema });
  await ir(pg, '/config', '#cfg-data');
  await pg.evaluate(() => document.querySelector('.cfg-dias-form').scrollIntoView({ block: 'start' }));
  const R = rotulo(nome, 390, esquema);
  ok((await pg.evaluate(() => document.querySelector('.app').dataset.tema)) === (esquema === 'dark' ? 'escuro' : 'claro'), `${R}: o tema do aplicativo é o pedido`);
  // rótulos associados: cada rótulo leva ao seu controle
  const campos = { 'Data inicial': '#cfg-data', 'Data final (opcional)': '#cfg-fim', Tipo: '#cfg-cat', Descrição: '#cfg-desc' };
  for (const [r, sel] of Object.entries(campos)) {
    const id = await pg.getByLabel(r, { exact: true }).first().evaluate((e) => '#' + e.id).catch(() => null);
    ok(id === sel, `${R}: o rótulo "${r}" está associado ao controle ${sel}`);
  }
  // cada controle tem limite visível NA IMAGEM (borda com 3:1 sobre o fundo do quadro) e a altura de toque
  for (const [r, sel] of Object.entries(campos)) {
    const alvo = r === 'Data inicial' ? '.cfg-dias-form .campo-data:has(#cfg-data)' : r === 'Data final (opcional)' ? '.cfg-dias-form .campo-data:has(#cfg-fim)' : sel;
    const m = await foto(pg, alvo);
    const caixa = await pg.locator(alvo).first().boundingBox();
    ok(m.borda >= 3 && caixa.height >= 44 && caixa.width >= 200, `${R}: ${r} tem limite visível (${m.borda.toFixed(1)}:1 contra o quadro) e ${Math.round(caixa.width)}x${Math.round(caixa.height)} px`);
  }
  // data vazia: a dica "Escolher a data" aparece (tinta no campo) e o campo nativo, transparente, cobre a superfície inteira
  const vazio = await foto(pg, '.cfg-dias-form .campo-data:has(#cfg-data)');
  const dica = await pg.locator('.cfg-dias-form .campo-data:has(#cfg-data) .campo-data-dica').first().boundingBox(), campo = await pg.locator('#cfg-data').boundingBox();
  ok(await pg.locator('.cfg-dias-form .campo-data:has(#cfg-data) .campo-data-dica').isVisible() && (await pg.locator('.cfg-dias-form .campo-data:has(#cfg-data) .campo-data-dica').innerText()).includes('Escolher a data') && vazio.tinta > 40, `${R}: o campo Data vazio mostra "Escolher a data" (${vazio.tinta} pontos de tinta na imagem)`);
  ok(Math.abs(vazio.folgaTopo - vazio.folgaBase) <= 8 && vazio.folgaTopo >= 8, `${R}: a indicação do campo vazio fica centralizada na altura (folga de ${vazio.folgaTopo} px em cima e ${vazio.folgaBase} px embaixo, na imagem)`);
  ok((await contrasteCss(pg, '.cfg-dias-form .campo-data:has(#cfg-data) .campo-data-dica', 'color', '.cfg-form')) >= 4.5, `${R}: a dica do campo vazio tem contraste de texto (4,5:1)`);
  const alvo = await pg.evaluate(() => { const c = document.querySelector('#cfg-data').getBoundingClientRect(); return document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2)?.id; });
  ok(alvo === 'cfg-data' && dica.width > 80 && campo.width >= dica.width, `${R}: o toque no meio do campo cai no próprio campo de data (um só controle; o seletor nativo abre no aparelho)`);
  // foco por teclado: o anel aparece (a imagem muda e o contorno ganha contraste)
  await pg.focus('#cfg-cat'); await pg.keyboard.press('Tab'); await pg.waitForTimeout(150);
  const comFoco = await foto(pg, '#cfg-desc'), semFoco = await foto(pg, '#cfg-cat');
  const foco = await pg.evaluate(() => { const e = document.querySelector('#cfg-desc'), c = getComputedStyle(e); return { ativo: document.activeElement === e, sombra: c.boxShadow, borda: c.borderTopColor }; });
  ok(foco.ativo && /\dpx/.test(foco.sombra) && comFoco.anel >= 3 && semFoco.anel < 1.3, `${R}: o foco do teclado mostra um anel de contorno (${comFoco.anel.toFixed(1)}:1 contra o quadro; sem foco ${semFoco.anel.toFixed(1)}:1)`);
  await pg.focus('#cfg-fim'); await pg.keyboard.press('Shift+Tab'); await pg.waitForTimeout(150);   // da data final, o Shift+Tab volta à data inicial
  const focoEm = await pg.evaluate(() => ({ id: document.activeElement?.id, vis: document.activeElement?.matches(':focus-visible'), sombra: getComputedStyle(document.activeElement).boxShadow }));
  const focoData = await foto(pg, '.cfg-dias-form .campo-data:has(#cfg-data)');
  ok(focoData.anel >= 3, `${R}: o foco no campo Data também mostra o anel (${focoData.anel.toFixed(1)}:1; foco em ${focoEm.id}, focus-visible ${focoEm.vis}, ${focoEm.sombra.slice(0, 50)})`);
  // erro: sem data, o aviso aparece em texto de alerta com contraste e o foco volta à data
  await pg.fill('#cfg-desc', 'Natal de prova'); await pg.click('.cfg-dias-form .btn.pri'); await pg.waitForSelector('.cfg-dias-form [role="alert"]');
  ok(/Informe a data/.test(await pg.textContent('.cfg-dias-form [role="alert"]')) && (await pg.evaluate(() => document.activeElement?.id)) === 'cfg-data' && (await contrasteCss(pg, '.cfg-dias-form [role="alert"]', 'color', '.cfg-form')) >= 4.5, `${R}: sem data o erro "Informe a data." aparece em alerta legível (4,5:1) e o foco volta ao campo`);
  // preenchido: seleção, exibição, gravação e o recálculo do vencimento
  await pg.selectOption('#cfg-cat', 'Feriado'); await pg.fill('#cfg-data', '2026-12-24');
  ok((await pg.inputValue('#cfg-data')) === '2026-12-24' && (await pg.locator('.cfg-dias-form .campo-data:has(#cfg-data) .campo-data-dica').innerText()).trim() === '24/12/2026' && (await pg.getAttribute('.cfg-dias-form .campo-data:has(#cfg-data)', 'data-vazio')) === null, `${R}: com a data escolhida a dica some e a data aparece no campo (24/12/2026)`);
  const cheio = await foto(pg, '.cfg-dias-form .campo-data:has(#cfg-data)');
  ok(Math.abs(cheio.folgaTopo - cheio.folgaBase) <= 8 && cheio.folgaTopo >= 8, `${R}: a data preenchida fica centralizada na altura do campo (folga de ${cheio.folgaTopo} px em cima e ${cheio.folgaBase} px embaixo, na imagem)`);
  ok(cheio.tinta > 40 && cheio.borda >= 3, `${R}: o campo preenchido mostra a data na imagem (${cheio.tinta} pontos de tinta) e mantém a borda`);
  await pg.click('.cfg-dias-form .btn.pri'); await pg.waitForSelector('.cfg-lista li', { timeout: 20000 });
  await pg.waitForFunction(() => document.querySelector('#cfg-desc').value === '' && document.querySelector('.cfg-dias-form .campo-data:has(#cfg-data)')?.dataset.vazio === 'sim', null, { timeout: 15000 }); // o formulário volta ao vazio depois da gravação
  ok((await pg.textContent('.cfg-lista li')).includes('Natal de prova') && (await pg.inputValue('#cfg-desc')) === '' && (await pg.getAttribute('.cfg-dias-form .campo-data:has(#cfg-data)', 'data-vazio')) === 'sim', `${R}: o dia aparece na lista e o formulário volta ao vazio com a dica`);
  if (esquema === 'light' && nome === motores[0][0]) {
    let j = await api(pg), d = j.demandas.find((x) => x.assunto === 'Vencimento de prova');
    ok(d.prazo === '2026-12-23' && /Natal de prova|feriado/i.test(d.prazo_ajuste || ''), `o Feriado cadastrado pelo novo campo antecipa o vencimento de 24/12 para 23/12 (${d.prazo}, ${d.prazo_ajuste})`);
  }
  // edição: o lápis leva a data e a descrição ao formulário; a alteração é gravada
  await pg.click('[aria-label="Editar Natal de prova"]'); await pg.waitForTimeout(200);
  ok((await pg.inputValue('#cfg-data')) === '2026-12-24' && (await pg.inputValue('#cfg-desc')) === 'Natal de prova' && /Alterar dia/.test(await pg.textContent('#cfg-novo-t')), `${R}: editar traz a data e a descrição ao formulário`);
  await pg.fill('#cfg-desc', 'Natal editado'); await pg.keyboard.press('Enter');
  await aguardar(pg.waitForFunction(() => document.querySelector('.cfg-lista')?.textContent.includes('Natal editado'), null, { timeout: 15000 }), `${R}: a edição é gravada (Enter na descrição envia)`);
  // Tipo e Descrição: o seletor muda e a digitação chega ao campo
  await pg.waitForFunction(() => document.querySelector('#cfg-desc').value === '' && document.querySelector('.cfg-dias-form .campo-data:has(#cfg-data)')?.dataset.vazio === 'sim', null, { timeout: 15000 }); // o formulário volta ao vazio depois da gravação
  await pg.selectOption('#cfg-cat', 'Evento externo').catch(() => {}); await pg.fill('#cfg-desc', 'Congresso de prova'); await pg.fill('#cfg-data', '2026-12-10');
  ok((await pg.inputValue('#cfg-cat')) === 'Evento externo' && (await pg.inputValue('#cfg-desc')) === 'Congresso de prova', `${R}: o seletor Tipo troca o valor e a descrição aceita a digitação`);
  await pg.click('.cfg-dias-form .btn.pri'); await pg.waitForFunction(() => document.querySelector('.cfg-lista')?.textContent.includes('Congresso de prova'), null, { timeout: 15000 });
  // limpeza: exclui os dois (o vencimento volta)
  for (const d of ['Natal editado', 'Congresso de prova']) { await pg.click(`[aria-label="Excluir ${d}"]`); await pg.click('.cfg-lista .btn:has-text("Confirmar exclusão")'); await pg.waitForFunction((x) => !document.querySelector('.cfg-dias')?.textContent.includes(x), d, { timeout: 15000 }); }
  if (esquema === 'light' && nome === motores[0][0]) {
    const d = (await api(pg)).demandas.find((x) => x.assunto === 'Vencimento de prova');
    ok(d.prazo === '2026-12-24' && !d.prazo_ajuste, `excluir o dia devolve o vencimento a 24/12 (${d.prazo})`);
  }
  await ctx.close();
}

// ================= 2) Campo de data centralizado (Configurações e janela pela Agenda; toque e computador, claro e escuro) =================
for (const [nome, nav] of motores) for (const largura of [390, 820, 1360]) for (const esquema of ['light', 'dark']) {
  const toque = largura < 1000;
  const { ctx, pg } = await novo(nav, { largura, esquema, toque });
  const R = rotulo(nome, largura, esquema);
  const centrado = (m) => m.folgaTopo >= 8 && Math.abs(m.folgaTopo - m.folgaBase) <= 8;
  const medir = async (sel, onde) => {
    await pg.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); }, sel); await pg.waitForTimeout(150);
    // o WebKit do Playwright no computador não desenha nada no campo vazio (o Safari do Mac mostra o espaço reservado dele): só se confere o vazio em toque ou no Edge
    const v = await foto(pg, sel); if (toque || nome === 'Edge') ok(v.tinta > 40 && centrado(v), `${R}, ${onde}, vazio: a indicação fica no meio da altura (folgas ${v.folgaTopo} e ${v.folgaBase} px na imagem)`);
    await pg.fill(`${sel} input`, '2026-12-24'); await pg.waitForTimeout(150);
    const c = await foto(pg, sel); ok(c.tinta > 40 && c.borda >= 3 && centrado(c), `${R}, ${onde}, preenchido: a data fica no meio da altura (folgas ${c.folgaTopo} e ${c.folgaBase} px na imagem) e a borda continua`);
    const a = await pg.evaluate((s) => { const i = document.querySelector(s + ' input').getBoundingClientRect(), t = document.querySelector(s + ' .campo-data-dica').getBoundingClientRect(), tx = document.querySelector(s + ' input'); const cs = getComputedStyle(tx); return { esq: Math.round(i.left), dica: Math.round(t.left), padE: cs.paddingLeft, ali: cs.textAlign, alto: i.height, util: document.elementFromPoint(i.left + i.width / 2, i.top + i.height / 2) === tx }; }, sel);
    const semDobra = await pg.evaluate((s) => getComputedStyle(document.querySelector(s + ' input')).color, sel);
    if (toque) ok(/rgba\(0, 0, 0, 0\)|transparent/.test(semDobra), `${R}, ${onde}: o valor nativo fica transparente em toque (não aparece duas vezes: ${semDobra})`);
    ok(a.ali === 'left' && a.alto >= 44 && a.util, `${R}, ${onde}: alinhado à esquerda (recuo ${a.padE}), 44 px de altura e o campo inteiro recebe o toque`);
  };
  await ir(pg, '/config', '#cfg-data'); await medir('.cfg-dias-form .campo-data:has(#cfg-data)', 'Configurações');
  await ir(pg, '/agenda', '.agd');
  await pg.locator('.agd-barra .opcoes button', { hasText: /^Dia$/ }).click(); await pg.waitForSelector('.agd[data-modo="hoje"]');
  await pg.click('button[aria-label="Cadastrar dia indisponível"]'); await pg.waitForSelector('.di-form .campo-data');
  await pg.waitForTimeout(900); // a janela termina a animação de entrada antes de fotografar
  await medir('.di-form .campo-data', 'janela da Agenda');
  await ctx.close();
}

// ================= 3) Agenda: cabeçalho comum de Dia, Semana e Mês =================
for (const [nome, nav] of motores) for (const largura of [320, 390, 820, 1360]) for (const esquema of ['light', 'dark']) {
  const { ctx, pg } = await novo(nav, { largura, esquema, toque: largura < 1000 });
  await ir(pg, '/agenda', '.agd');
  const R = rotulo(nome, largura, esquema);
  const medidas = {};
  for (const [k, n] of [['hoje', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']]) {
    await pg.locator('.agd-barra .opcoes button', { hasText: new RegExp('^' + n + '$') }).click(); await pg.waitForSelector(`.agd[data-modo="${k}"]`); await pg.waitForTimeout(250);
    medidas[k] = await pg.evaluate(() => {
      const raiz = document.querySelector('.agd'), rl = raiz.getBoundingClientRect(), main = document.querySelector('.main');
      const R = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const botoes = [...document.querySelectorAll('.agd-barra .opcoes button')];
      const visiveis = [...raiz.querySelectorAll('.agd-cab-pag *, .agd-barra *, .agd-resumo *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
      const cab = R(document.querySelector('.agd-cab-pag')), bar = R(document.querySelector('.agd-barra')), per = R(document.querySelector('.agd-periodo')), nv = R(document.querySelector('.agd-nav')), ir = R(document.querySelector('.agd-ir-rot'));
      return {
        n: botoes.length, larguras: botoes.map((b) => b.getBoundingClientRect().width), alturas: botoes.map((b) => b.getBoundingClientRect().height), cortado: botoes.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
        semanaCentrada: (() => { const b = botoes[1], r = document.createRange(); r.selectNodeContents(b); const t = r.getBoundingClientRect(), c = b.getBoundingClientRect(); return { dentro: t.left >= c.left - 0.5 && t.right <= c.right + 0.5, desvio: Math.abs((t.left + t.right) / 2 - (c.left + c.right) / 2) }; })(),
        fora: visiveis.filter((e) => e.getBoundingClientRect().right > rl.right + 1 || e.getBoundingClientRect().left < rl.left - 1).map((e) => String(e.className || e.tagName)).slice(0, 4),
        rolagemH: main.scrollWidth - main.clientWidth, docH: document.documentElement.scrollWidth - innerWidth,
        titulo: document.querySelector('.agd-periodo').innerText.replace(/\s+/g, ' '), novoNaFaixa: !!bar && !!document.querySelector('.agd-barra .agd-novo'),
        superior: { agenda: document.querySelector('.agd-cab-pag h1')?.innerText, filtros: !!document.querySelector('.agd-filtros-bt, .agd-filtros'), filtrosDir: (() => { const f = document.querySelector('.agd-filtros-bt'); return f && getComputedStyle(f).display !== 'none' ? R(f).x > rl.x + rl.width / 2 : null; })() },
        linhaVisoes: { sozinha: bar.y >= cab.b - 1 && (bar.w >= rl.width - 4 || bar.x + bar.w <= rl.right), semOutroNaLinha: ![...document.querySelectorAll('.agd-barra > *')].some((e) => !e.classList.contains('opcoes')) },
        nav: { esquerda: nv.x <= ir.x, direita: ir.r >= rl.right - 2 || ir.r >= nv.r, tituloAcima: per.b <= Math.max(nv.y + 2, ir.y + 2) || per.y < nv.y },
        ir: { w: ir.w, h: ir.h, texto: document.querySelector('.agd-ir-rot').innerText.trim() },
        resumoTemPendencias: /pend[êe]ncia/.test(document.querySelector('.agd-resumo').innerText), seletorMes: !!document.querySelector('.agd-mes-sel') && getComputedStyle(document.querySelector('.agd-mes-sel')).display !== 'none',
      };
    });
    const m = medidas[k];
    ok(m.n === 3 && m.cortado.length === 0 && m.semanaCentrada.dentro && m.semanaCentrada.desvio < 2, `${R}, ${n}: Dia, Semana e Mês cabem inteiros e "Semana" fica centralizado (desvio ${m.semanaCentrada.desvio.toFixed(1)} px)`);
    ok(m.fora.length === 0 && m.rolagemH <= 1 && m.docH <= 1, `${R}, ${n}: nada passa da margem nem rola para o lado${m.fora.length ? ` (fora: ${m.fora.join(' | ')})` : ''}`);
    ok(!m.novoNaFaixa && m.linhaVisoes.semOutroNaLinha && m.ir.texto === 'Ir para a data' && m.resumoTemPendencias, `${R}, ${n}: a faixa das visões traz só as três visões, "Ir para a data" tem ícone e texto e o resumo de pendências segue junto do período`);
    if (largura <= 560) ok(m.larguras.every((w) => Math.abs(w - m.larguras[0]) < 1) && m.alturas.every((h) => h >= 40) && m.larguras[0] * 3 >= largura - 60, `${R}, ${n}: no celular os três botões têm a mesma largura (${m.larguras.map(Math.round).join(', ')} px)`);
  }
  ok(medidas.hoje.titulo.length > 10 && /\d{4}/.test(medidas.hoje.titulo) && /\d.*a.*\d{1,2} de \S+ de \d{4}|\d{1,2} a \d{1,2}|\d{1,2} de \S+ a/.test(medidas.semana.titulo) && /^\S+ \d{4}$/.test(medidas.mes.titulo), `${R}: títulos em português (Dia "${medidas.hoje.titulo}", Semana "${medidas.semana.titulo}", Mês "${medidas.mes.titulo}")`);
  if (largura <= 560) ok(medidas.hoje.seletorMes === false && medidas.mes.seletorMes === true, `${R}: o atalho de troca de mês aparece só no Mês`);
  // navegação: setas e Hoje, e "Ir para a data" em cada visão (a data vira o título/seleção sem trocar a visão)
  for (const [k, n, alvo] of [['hoje', 'Dia', '2027-03-17'], ['semana', 'Semana', '2027-03-17'], ['mes', 'Mês', '2027-03-17']]) {
    await pg.locator('.agd-barra .opcoes button', { hasText: new RegExp('^' + n + '$') }).click(); await pg.waitForSelector(`.agd[data-modo="${k}"]`);
    const antes = await pg.innerText('.agd-periodo');
    await pg.click(`.agd-nav [aria-label="${k === 'mes' ? 'Próximo mês' : k === 'semana' ? 'Próxima semana' : 'Próximo dia'}"]`); await pg.waitForTimeout(250);
    const depois = await pg.innerText('.agd-periodo');
    await pg.click('.agd-nav .btn.mini:has-text("Hoje")'); await pg.waitForTimeout(250);
    const volta = await pg.innerText('.agd-periodo');
    await pg.fill('.agd-data input', alvo); await pg.waitForFunction((a) => document.querySelector('.agd-periodo').innerText !== a, antes, { timeout: 10000 });
    const t = (await pg.innerText('.agd-periodo')).replace(/\s+/g, ' '), modoAtual = await pg.getAttribute('.agd', 'data-modo');
    const sel = k === 'mes' ? await pg.$eval('.agd-cel[data-sel]', (e) => e.dataset.data).catch(() => null) : null;
    ok(antes !== depois && volta === antes && modoAtual === k && /2027/.test(t + (k === 'hoje' ? '' : '')) && (k !== 'mes' || (/Março/.test(t) && sel === alvo)), `${R}, ${n}: anterior/próximo e Hoje navegam, e "Ir para a data" vai a ${alvo} (${t}${sel ? `, selecionado ${sel}` : ''}) sem trocar a visão`);
    await pg.click('.agd-nav .btn.mini:has-text("Hoje")'); await pg.waitForTimeout(150);
  }
  // o campo nativo cobre a superfície do botão (um só controle) e o foco aparece nela
  const cob = await pg.evaluate(() => { const i = document.querySelector('.agd-data input').getBoundingClientRect(), s = document.querySelector('.agd-ir-rot').getBoundingClientRect(); return { cobre: i.left <= s.left + 0.5 && i.right >= s.right - 0.5 && i.top <= s.top + 0.5 && i.bottom >= s.bottom - 0.5, alvo: document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2) === document.querySelector('.agd-data input'), h: i.height }; });
  ok(cob.cobre && cob.alvo && cob.h >= 44, `${R}: o campo de data transparente cobre o botão "Ir para a data" e recebe o toque (${Math.round(cob.h)} px de altura)`);
  await pg.focus('.agd-nav .icbtn-s:not(.agd-ant)'); await pg.keyboard.press('Tab'); await pg.waitForTimeout(150);
  const fotoBt = await foto(pg, '.agd-ir-rot', 8);
  ok(fotoBt.anel >= 2 || (await pg.evaluate(() => getComputedStyle(document.querySelector('.agd-ir-rot')).outlineStyle)) === 'dashed', `${R}: o foco aparece na superfície "Ir para a data"`);
  await ctx.close();
}

// ================= 4) Mês: o corpo aprovado continua como era =================
{
  const [nome, nav] = motores[0];
  const { ctx, pg } = await novo(nav, { largura: 390, esquema: 'light' });
  await ir(pg, '/agenda', '.agd');
  await pg.locator('.agd-barra .opcoes button', { hasText: /^Mês$/ }).click(); await pg.waitForSelector('.agd[data-modo="mes"] .agd-grade');
  const mes = await pg.evaluate(() => ({ celulas: document.querySelectorAll('.agd-cel').length, cabecas: [...document.querySelectorAll('.agd-cabsem')].map((e) => e.textContent.trim()), legenda: !!document.querySelector('.agd-leg'), seletor: !!document.querySelector('.agd-mes-sel select') }));
  ok(mes.celulas >= 28 && mes.cabecas.length === 7 && /^D/i.test(mes.cabecas[0]) && /^S/i.test(mes.cabecas[6]) && mes.legenda && mes.seletor, `${nome}: o corpo do Mês segue com a grade de domingo a sábado, a legenda e o atalho de mês (${mes.celulas} células)`);
  await ctx.close();
}

// ================= 6) CampoData fora do iOS (decisão 78): o campo nativo continua visível e editável; cores forçadas sem texto duplicado =================
// A auditoria mostrou, no Edge com toque, que digitar o dia sem completar a data deixava os dígitos invisíveis e sobrepostos à dica. A camada desenhada agora é só do iOS (-webkit-touch-callout).
for (const [nome, nav] of motores) {
  const R = `${nome}, fora do iOS`;
  const { ctx, pg } = await novo(nav, { largura: 390, esquema: 'light', toque: true, ios: false });
  await ir(pg, '/config', '#cfg-data');
  const base = await pg.evaluate(() => { const i = document.querySelector('#cfg-data'); return { dica: getComputedStyle(document.querySelector('.cfg-dias-form .campo-data:has(#cfg-data) .campo-data-dica')).display, cor: getComputedStyle(i).color, coarse: matchMedia('(pointer: coarse)').matches, alt: i.getBoundingClientRect().height }; });
  ok(base.dica === 'none' && !/rgba\(0, 0, 0, 0\)|transparent/.test(base.cor) && base.alt >= 44, `${R}: com toque (pointer: coarse = ${base.coarse}) mas sem iOS, a dica não é desenhada, o valor nativo tem cor própria (${base.cor}) e o campo mede ${base.alt} px`);
  if (nome === 'Edge') {
    await pg.focus('#cfg-data'); await pg.keyboard.type('25'); await pg.waitForTimeout(200);
    const parcial = await foto(pg, '.cfg-dias-form .campo-data:has(#cfg-data)');
    ok(parcial.tinta > 40, `${R}: digitar só o dia deixa a digitação visível no campo (tinta ${parcial.tinta})`);
    await pg.keyboard.type('122026'); await pg.waitForTimeout(150);
    ok((await pg.inputValue('#cfg-data')) === '2026-12-25', `${R}: digitar a data pelo teclado completa o campo (${await pg.inputValue('#cfg-data')})`);
  }
  await ctx.close();
}
{
  // a condição da camada é de plataforma, não de toque: nenhuma regra de pointer: coarse mexe na dica, e o bloco @supports de iOS existe com as regras da camada
  const { ctx, pg } = await novo(motores[0][1], { largura: 390, toque: true, ios: false });
  await ir(pg, '/config', '#cfg-data');
  const css = await pg.evaluate(() => { let sup = '', coarse = false; const ver = (regras) => { for (const r of regras) { if (r.constructor.name === 'CSSSupportsRule') { if (/touch-callout/.test(r.conditionText)) sup += r.cssText; else ver([...r.cssRules]); } else if (r.constructor.name === 'CSSMediaRule') { if (/coarse/.test(r.conditionText) && /campo-data/.test(r.cssText)) coarse = true; ver([...r.cssRules]); } } }; for (const f of document.styleSheets) { try { ver([...f.cssRules]); } catch { /* folha de outra origem */ } } return { sup, coarse }; });
  ok(/campo-data-dica/.test(css.sup) && /color:\s*(transparent|#0000|rgba\(0,\s*0,\s*0,\s*0\))/.test(css.sup), 'o valor nativo só fica transparente e a dica só aparece dentro de @supports (-webkit-touch-callout: none)');
  ok(!css.coarse, 'nenhuma regra de @media (pointer: coarse) mexe no campo de data (coarse não identifica o Safari)');
  await ctx.close();
}
{
  // cores forçadas com a camada do iOS simulada: a dica some e o valor nativo (cor imposta pelo navegador) é o único texto
  const { ctx, pg } = await novo(motores[0][1], { largura: 390, toque: true, ios: true });
  await ir(pg, '/config', '#cfg-data');
  const sem = await pg.evaluate(() => getComputedStyle(document.querySelector('.cfg-dias-form .campo-data:has(#cfg-data) .campo-data-dica')).display);
  await pg.emulateMedia({ forcedColors: 'active' }); await pg.fill('#cfg-data', '2026-12-25'); await pg.waitForTimeout(200);
  const f = await pg.evaluate(() => ({ dica: getComputedStyle(document.querySelector('.cfg-dias-form .campo-data:has(#cfg-data) .campo-data-dica')).display, forcado: matchMedia('(forced-colors: active)').matches, cor: getComputedStyle(document.querySelector('#cfg-data')).color }));
  ok(sem === 'flex' && f.forcado && f.dica === 'none' && !/rgba\(0, 0, 0, 0\)/.test(f.cor), `cores forçadas: com a camada ativa a dica fica ${sem}; em alto contraste vira ${f.dica} e o valor nativo (${f.cor}) é o único texto`);
  await ctx.close();
}

ok(erros.length === 0, 'nenhum erro de página nem de console durante os fluxos' + (erros.length ? `: ${erros.slice(0, 4).join(' | ')}` : ''));
for (const [, n] of motores) await n.close();
process.exit(resumo());
