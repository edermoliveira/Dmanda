// Correções da auditoria das decisões 76 e 77 (decisão 78), no navegador (Edge e, quando existe, o WebKit do Playwright) com banco local de TESTE (PGlite, dados fictícios), porta 7125:
//   1) baralho: o foco dos botões "Passar para o fim" e "Voltar ao anterior" não se perde (Enter, Espaço, repetição rápida, movimento reduzido), nem nos fluxos de confirmação e de menu do Para hoje,
//      e nunca vai parar nos cards de fundo;
//   2) Agenda: carregando, dados indisponíveis, recuperação e resultado vazio de verdade, nos painéis "Onde o período aperta" e "Pendências sem prazo" (e no painel de demandas do Dia).
// O WebKit do Playwright é o motor do Safari no Windows, NÃO o Safari do iPhone. Uso: node scripts/testar-auditoria.mjs (nunca toca o Supabase real)
import { chromium, webkit, devices } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';
import { somarDias } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_AUDITORIA || '7125', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/auditoria';
const USUARIO = '00000000-0000-4000-8000-000000000001';
rmSync(PASTA, { recursive: true, force: true });
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- dados: quatro vagas (Alfa em Cadastro, Charlie com pendências, Eco aguardando a Prefeita, Quarta em Fazendo) e duas urgências fora delas; nenhuma demanda sem data e nenhum dia cheio ----------
const ID = {};
{
  const db = await abrirBancoTeste({ pasta: PASTA });
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [USUARIO]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
  const HOJE = (await db.query('select public.hoje()::text as h')).rows[0].h;
  const c = (f, a) => chamarComoUsuario(db, USUARIO, f, a);
  const tarefas = async (id, textos, feitas = 0) => { for (let i = 0; i < textos.length; i++) { const r = await c('adicionar_tarefa', { p_demanda: id, p_texto: textos[i] }); if (i < feitas) await c('marcar_tarefa', { p_id: r.tarefas?.at(-1)?.id ?? r.id, p_concluida: true }).catch(() => {}); } };
  const mk = async (chave, assunto, o, textos) => { const d = await c('criar_demanda', { p: { assunto, tipo: 'Memorando', numero: '', ...o } }); await tarefas(d.id, textos); ID[chave] = d.id; return d; };
  const A = await mk('A', 'Alfa em Cadastro', { prazo_original: HOJE }, ['a1', 'a2']); await c('mover_etapa', { p_id: A.id, p_etapa: 'Cadastro' });
  await mk('C', 'Charlie em Fazendo com pendências', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -2) }, ['c1', 'c2', 'c3']);
  const E = await mk('E', 'Eco aguardando a Prefeita', { etapa: 'Aguardando Prefeita', prazo_original: somarDias(HOJE, 20) }, ['e1']);
  await db.query(`update public.demandas set etapa_desde = (($1::date + time '12:00') at time zone 'America/Sao_Paulo') - interval '12 days' where id = $2`, [HOJE, E.id]);
  await mk('Q', 'Quarta em Fazendo', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, 2) }, ['q1']);
  await mk('D', 'Delta em Fazendo sem pendências', { etapa: 'Fazendo', prazo_original: somarDias(HOJE, -3) }, ['d1']);
  await mk('F', 'Foxtrot aguardando retorno do setor', { etapa: 'Aguardando retorno', setor: 'Obras', acompanhar_em: somarDias(HOJE, -1) }, ['f1']);
  for (const [i, k] of ['A', 'C', 'E', 'Q'].entries()) await db.query('insert into public.para_hoje (user_id, posicao, demanda_id) values ($1, $2, $3)', [USUARIO, i + 1, ID[k]]);
  await c('criar_evento', { p: { titulo: 'Reunião de teste', tipo: 'Reunião', data: HOJE, inicio: '09:00', fim: '10:00', aviso_min: null } });
  await db.close();
}

let servidor = null;
const parar = () => { if (servidor) { try { spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ } servidor = null; } };
process.on('exit', parar);
servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', PORTA], { env: { ...process.env, DMANDA_BANCO: 'teste', DMANDA_SEM_LEMBRETES: 'sim', DMANDA_PASTA_TESTE: PASTA }, stdio: 'ignore' });
for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE + '/login'); if (r.status < 500) break; } catch { /* subindo */ } await esperar(2000); }

const edge = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
let wk = null; try { wk = await webkit.launch(); } catch (e) { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); }
const erros = [];
const abrir = async (motor, { device = null, largura = 390, reduzido = false, rota = '/', esperarSel = '[data-painel="para-hoje"] .ph-pilha', agenda = null, intercept = null, rapido = false } = {}) => {
  const base = device ? { ...devices[device] } : { viewport: { width: largura, height: largura > 700 ? 900 : 844 }, hasTouch: largura < 1000, isMobile: largura < 1000 && motor === edge, deviceScaleFactor: 2 };
  const ctx = await motor.newContext({ ...base, reducedMotion: reduzido ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((ag) => { try { localStorage.setItem('dmanda-tema', '"claro"'); if (ag) localStorage.setItem('dmanda:agenda', JSON.stringify(ag)); } catch { /* sem armazenamento */ } }, agenda);
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|offline|Failed to fetch|Load failed/i.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
  if (intercept) await intercept(pg);
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 });
  await pg.waitForSelector(esperarSel, { timeout: 120000 });
  if (rapido) return { ctx, pg };
  await pg.locator('button:has-text("Agora não")').first().click({ timeout: 3000 }).catch(() => {});
  try { const x = pg.locator('.modal-ov button[aria-label="Fechar"]').first(); await x.waitFor({ state: 'visible', timeout: 2000 }); await x.click(); } catch { /* não abriu */ }
  await pg.waitForFunction(() => !document.querySelector('.modal-ov'), null, { timeout: 10000 }).catch(() => {});
  await esperar(600);
  return { ctx, pg };
};

const PH = '[data-painel="para-hoje"] > .ph-pilha', NU = '[data-nova-urgencia] .ph-pilha';
const quem = (pg) => pg.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; return a.hasAttribute('data-pilha-passar') ? 'passar' : a.hasAttribute('data-pilha-avancar') ? 'avancar' : a.closest('.ph-atras') ? 'FUNDO' : a.closest('.mv-menu') ? 'menu' : a.closest('[data-confirma-finalizar]') ? 'confirma' : a.tagName; });
const topo = (pg, sel) => pg.$eval(`${sel} .ph-arrasto .assunto`, (e) => e.textContent.trim());
const aoCentro = async (pg, sel) => { await pg.$eval(sel, (e) => e.scrollIntoView({ block: 'center' })); await esperar(350); };

// ================= 1) baralho: foco dos botões =================
for (const [nome, motor, device] of [['Edge', edge, null], ...(wk ? [['WebKit emulado', wk, 'iPhone 13']] : [])]) for (const reduzido of [false, true]) {
  const R = `${nome}, ${reduzido ? 'movimento reduzido' : 'movimento normal'}`;
  const { ctx, pg } = await abrir(motor, { device, reduzido });
  // Nova urgência: dois cards. Enter e Espaço sucessivos mantêm o foco no botão que foi acionado
  await aoCentro(pg, NU);
  for (const [botao, rotulo] of [['[data-pilha-passar]', 'Passar para o fim'], ['[data-pilha-avancar]', 'Voltar ao anterior']]) {
    await pg.focus(`${NU} ${botao}`);
    const seq = []; let mudou = 0, anterior = await topo(pg, NU);
    for (const tecla of ['Enter', ' ', 'Enter', ' ', 'Enter']) {
      await pg.keyboard.press(tecla); await esperar(reduzido ? 120 : 480);
      seq.push(await quem(pg)); const agora = await topo(pg, NU); if (agora !== anterior) mudou++; anterior = agora;
    }
    const esperado = botao.includes('passar') ? 'passar' : 'avancar';
    ok(seq.every((q) => q === esperado), `${R}, "${rotulo}": cinco acionamentos seguidos (Enter e Espaço) mantêm o foco no botão (${seq.join(',')})`);
    ok(mudou === 5, `${R}, "${rotulo}": cada acionamento trocou o card uma vez (${mudou} trocas)`);
  }
  // durante a animação o botão fica bloqueado por aria-disabled (sem `disabled`), e o foco continua nele
  if (!reduzido) {
    await pg.focus(`${NU} [data-pilha-passar]`); await pg.keyboard.press('Enter'); await esperar(60);
    const d = await pg.$eval(`${NU} [data-pilha-passar]`, (b) => ({ aria: b.getAttribute('aria-disabled'), disabled: b.hasAttribute('disabled'), foco: document.activeElement === b }));
    ok(d.aria === 'true' && !d.disabled && d.foco, `${R}: durante a saída o botão tem aria-disabled="true", não tem disabled e continua com o foco`);
    await esperar(500);
    const depois = await pg.$eval(`${NU} [data-pilha-passar]`, (b) => ({ aria: b.getAttribute('aria-disabled'), foco: document.activeElement === b }));
    ok(depois.aria === null && depois.foco, `${R}: ao fim da animação o bloqueio sai e o foco continua no botão`);
  }
  // Para hoje: quatro cards; dois Enter rápidos valem como uma só ação (bloqueio de verdade, sem dupla ação)
  await aoCentro(pg, PH);
  const t0 = await topo(pg, PH);
  await pg.focus(`${PH} [data-pilha-passar]`);
  await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter'); await pg.keyboard.press(' '); await esperar(reduzido ? 300 : 700);
  const t1 = await topo(pg, PH), q = await quem(pg);
  // com animação, o bloqueio de verdade faz as três teclas valerem uma só ação; com movimento reduzido não há animação a esperar e cada tecla é uma ação (três passes de quatro cards levam o último à frente)
  ok((reduzido ? t1 !== t0 && /Quarta/.test(t1) : t1 !== t0 && /Charlie/.test(t1)) && q === 'passar', `${R}: Enter, Enter e Espaço em sequência rápida ${reduzido ? 'passam três cards (o último vem à frente)' : 'viram uma só ação'} no Para hoje (${t0.slice(0, 12)} -> ${t1.slice(0, 12)}) e o foco fica no botão (${q})`);
  if (!reduzido) {
    // clique repetido também só vale uma vez
    await esperar(300); const a0 = await topo(pg, PH);
    await pg.$eval(`${PH} [data-pilha-passar]`, (b) => { b.click(); b.click(); b.click(); }); await esperar(700);
    const ordem = await pg.$$eval(`${PH}`, (l) => l[0].dataset.total);
    const a1 = await topo(pg, PH);
    log(`${R}: três cliques programáticos seguidos: ${a0.slice(0, 12)} -> ${a1.slice(0, 12)} (total ${ordem})`);
    ok(a1 !== a0, `${R}: cliques repetidos enquanto a animação roda não pulam mais de um card nem quebram a pilha`);
  }
  // nunca o foco nos cards de fundo
  const nosFundos = [];
  await pg.focus(`${NU} [data-pilha-passar]`);
  for (let i = 0; i < 30; i++) { await pg.keyboard.press('Tab'); if ((await quem(pg)) === 'FUNDO') nosFundos.push(i); }
  ok(nosFundos.length === 0, `${R}: 30 Tab seguidos nunca param dentro de um card de fundo`);
  await ctx.close();
}
function log(m) { console.log('       ' + m); }

// ================= 1b) Para hoje: confirmação de finalizar e menu das etapas de espera =================
// movimento reduzido primeiro e sem escolher etapa (a escolha muda a demanda no banco e só cabe uma vez); o normal fecha com a escolha
for (const reduzido of [true, false]) {
  const R = `Edge, ${reduzido ? 'movimento reduzido' : 'movimento normal'}`;
  const { ctx, pg } = await abrir(edge, { reduzido });
  await aoCentro(pg, PH);
  const passar = async () => { await pg.focus(`${PH} [data-pilha-passar]`); await pg.keyboard.press('Enter'); await esperar(reduzido ? 200 : 600); };
  await passar();                                                // Alfa vai para o fim: Charlie (Fazendo com pendências) na frente
  const frente = await topo(pg, PH);
  ok(/Charlie/.test(frente), `${R}: Charlie com tarefas pendentes na frente do Para hoje (${frente.slice(0, 20)})`);
  await pg.focus(`${PH} [data-pilha-avancar]`); await pg.keyboard.press('Enter'); await pg.waitForSelector(`${PH} [data-confirma-finalizar]`, { timeout: 5000 });
  ok((await quem(pg)) === 'confirma', `${R}: ao pedir para finalizar com pendências, o foco vai para a confirmação (${await quem(pg)})`);
  await pg.keyboard.press('Enter');   // Cancelar tem o foco
  await pg.waitForSelector(`${PH} [data-confirma-finalizar]`, { state: 'detached', timeout: 5000 }); await esperar(150);
  ok((await quem(pg)) === 'avancar' && /Charlie/.test(await topo(pg, PH)), `${R}: cancelar a confirmação devolve o foco ao botão "Finalizar" e o card continua o mesmo (${await quem(pg)})`);
  // etapa de espera: o menu abre, Esc devolve o foco ao botão e escolher uma etapa também
  await passar();                                                // Charlie vai para o fim: Eco (Aguardando Prefeita) na frente
  ok(/Eco/.test(await topo(pg, PH)), `${R}: Eco aguardando a Prefeita na frente (${(await topo(pg, PH)).slice(0, 14)})`);
  await pg.focus(`${PH} [data-pilha-avancar]`); await pg.keyboard.press('Enter'); await pg.waitForSelector('.mv-menu', { timeout: 5000 }); await esperar(100);
  ok((await quem(pg)) === 'menu', `${R}: o menu de etapas recebe o foco (${await quem(pg)})`);
  await pg.keyboard.press('Escape'); await pg.waitForSelector('.mv-menu', { state: 'detached', timeout: 5000 }); await esperar(150);
  ok((await quem(pg)) === 'avancar', `${R}: Esc fecha o menu e devolve o foco ao botão (${await quem(pg)})`);
  if (reduzido) { await ctx.close(); continue; }
  await pg.keyboard.press('Enter'); await pg.waitForSelector('.mv-menu', { timeout: 5000 }); await esperar(100);
  await pg.keyboard.press('Enter');   // o primeiro item que não é a etapa atual
  await pg.waitForSelector('.mv-menu', { state: 'detached', timeout: 5000 }); await esperar(reduzido ? 500 : 900);
  const depois = await quem(pg);
  ok(depois === 'avancar' || depois === 'passar', `${R}: escolher a etapa no menu não deixa o foco cair no BODY (${depois})`);
  await ctx.close();
}

// ================= 2) Agenda: carregando, indisponível, recuperação e vazio verdadeiro =================
const OK_VAZIO_CARGA = 'Nenhum dia com carga média ou alta', OK_VAZIO_SEM = 'Toda demanda aberta tem alguma data.', INDISP = 'Indisponível: as demandas não carregaram.';
/** Troca (ou atrasa) só o bloco `demandas` da carga conjunta, como a suíte da Agenda. `estado.modo`: 'ok', 'falha' ou 'lento'. */
const controlar = (estado) => async (pg) => {
  await pg.route('**/*', async (route) => {
    const q = route.request();
    if (!(q.method() === 'POST' && q.headers()['next-action']) || estado.modo === 'ok') { await route.continue(); return; }
    const r = await route.fetch(); const texto = await r.text();
    if (estado.modo === 'lento') await esperar(1800);
    const linhas = texto.split('\n'), i = linhas.findIndex((l) => /^1:\{"ok":true,"dados":\{"demandas":/.test(l));
    if (estado.modo === 'falha' && i >= 0) { const j = JSON.parse(linhas[i].slice(2)); j.dados.demandas = { ok: false, erro: 'Falha simulada em demandas.' }; linhas[i] = '1:' + JSON.stringify(j); const corpo = linhas.join('\n'); await route.fulfill({ response: r, body: corpo, headers: { ...r.headers(), 'content-length': String(Buffer.byteLength(corpo)) } }); return; }
    await route.fulfill({ response: r, body: texto });
  });
};
const textosPaineis = (pg) => pg.evaluate(() => ({ aux: [...document.querySelectorAll('.agd-aux')].map((p) => ({ titulo: p.querySelector('h3')?.textContent, texto: p.querySelector('.agd-vazio')?.textContent ?? null, selo: !!p.querySelector('.agd-qtd'), indisp: p.dataset.indisponivel ?? null })), dia: document.querySelector('.agd-hoje .agd-painel:nth-child(2) .agd-vazio')?.textContent ?? null, tudo: document.querySelector('.agd')?.innerText ?? '', carregando: [...document.querySelectorAll('.vazio-c')].some((e) => /Carregando a agenda/.test(e.textContent)), compromissos: document.querySelectorAll('.agd-evento, .agd-it-ev, [data-tipo="Reunião"]').length }));
for (const [largura, tema] of [[390, 'celular'], [1360, 'computador']]) for (const modo of ['hoje', 'semana', 'mes']) {
  const R = `Agenda ${modo} (${tema})`;
  const estado = { modo: 'falha' };
  const { ctx, pg } = await abrir(edge, { largura, rota: '/agenda', esperarSel: '.agd', agenda: { modo }, intercept: controlar(estado) });
  await pg.waitForSelector('.erro-carga, .agd-aux', { timeout: 20000 }); await esperar(500);
  const f = await textosPaineis(pg);
  const painelDemandas = modo === 'hoje' ? f.dia : INDISP;
  ok(f.aux.length >= (modo === 'hoje' ? 1 : 2) && f.aux.every((p) => p.texto === INDISP && p.indisp === 'sim' && !p.selo), `${R}, falha: os painéis dizem "${INDISP}" (${f.aux.map((p) => p.titulo + ': ' + p.texto).join(' | ')})`);
  ok(painelDemandas === INDISP, `${R}, falha: ${modo === 'hoje' ? 'o painel de demandas do Dia também não diz "Nada vence"' : 'sem painel de demandas separado'} (${painelDemandas})`);
  ok(!/Toda demanda aberta|Nenhum dia com carga|Nada vence hoje|Nada vence neste dia/.test(f.tudo), `${R}, falha: nenhuma frase afirma que não há pendência nem dia cheio`);
  const botao = pg.locator('.erro-carga button, .agd-aviso-carga button').first();
  ok((await botao.count()) >= 1 && /Tentar de novo/.test(await botao.innerText()), `${R}, falha: o botão Tentar de novo continua à mão`);
  ok(f.compromissos >= 1 || /Reunião de teste/.test(f.tudo) || modo === 'mes', `${R}, falha: o compromisso que carregou continua aparecendo${modo === 'mes' ? ' (no Mês ele está na grade)' : ''}`);
  // recuperação: a falha acaba, o botão recarrega e os painéis mostram o vazio de verdade
  estado.modo = 'ok'; await botao.click(); await pg.waitForFunction(() => !document.querySelector('.agd-aux[data-indisponivel]'), null, { timeout: 20000 }); await esperar(300);
  const r = await textosPaineis(pg);
  const vazios = r.aux.map((p) => p.texto ?? '');
  ok(r.aux.length >= (modo === 'hoje' ? 1 : 2) && vazios.some((t) => t === OK_VAZIO_SEM) && (modo === 'hoje' || vazios.some((t) => t.startsWith(OK_VAZIO_CARGA)) || r.aux.some((p) => /aperta/.test(p.titulo ?? '') && p.selo)) && !r.tudo.includes(INDISP), `${R}, recuperação: depois de Tentar de novo os painéis voltam a mostrar o resultado de verdade, vazio ou com os dias de carga (${vazios.join(' | ')})`);
  // no Mês o painel lista também os dias PASSADOS de carga média ou alta (commit 7e709b5), e a semente é relativa ao dia real: o resultado de verdade pode ser a lista, com o selo da quantidade, e não o texto de vazio
  await ctx.close();
}
{
  // carregando: enquanto a carga não responde, só aparece "Carregando a agenda..." (nada de vazio nem de indisponível)
  const estado = { modo: 'lento' };
  const { ctx, pg } = await abrir(edge, { largura: 390, rota: '/agenda', esperarSel: 'body', agenda: { modo: 'semana' }, intercept: controlar(estado), rapido: true });
  await esperar(400);
  const l = await textosPaineis(pg);
  ok(l.carregando && l.aux.length === 0 && !/Indisponível|Toda demanda aberta|Nenhum dia com carga/.test(l.tudo), 'Agenda, carregando: só o aviso de carregamento aparece, sem painéis, sem "vazio" e sem "indisponível"');
  estado.modo = 'ok'; await pg.waitForSelector('.agd-aux', { timeout: 30000 });
  ok(!(await textosPaineis(pg)).carregando, 'Agenda, carregando: terminada a carga os painéis aparecem');
  await ctx.close();
}

// ================= 3) arrasto: as variáveis ficam só em quem as lê (@property sem herança) e continuam corretas sem o suporte =================
/** Segura o arrasto a `dx` px, lê o estado e solta (curto: o card volta). `semRegistro`: remove as regras @property antes, para imitar um navegador sem suporte. */
const arrastoMedido = (pg, dx, semRegistro) => pg.evaluate(async ({ sel, dx, semRegistro }) => {
  if (semRegistro) for (const f of document.styleSheets) { let r; try { r = f.cssRules; } catch { continue; } for (let i = r.length - 1; i >= 0; i--) if (r[i].constructor.name === 'CSSPropertyRule') f.deleteRule(i); }
  const p = document.querySelector(sel), el = p.querySelector('.ph-arrasto'), r0 = el.getBoundingClientRect(), y = r0.top + r0.height * 0.45, x = r0.left + r0.width / 2; el.setPointerCapture = () => {};
  const ev = (t, px) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: px, clientY: y }));
  ev('pointerdown', x); for (let i = 1; i <= 8; i++) { ev('pointermove', x + (dx * i) / 8); await new Promise((r2) => setTimeout(r2, 16)); }
  await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2)));
  const face = p.querySelector('.ph-atras[data-face]'), nivel2 = p.querySelector('.ph-atras:not([data-face])'), card = el.querySelector('.dcard');
  const durante = { progNaPilha: p.style.getPropertyValue('--prog'), progFace: parseFloat(face.style.getPropertyValue('--prog') || '0'), progVaga: parseFloat(face.querySelector('.vaga').style.getPropertyValue('--prog') || '0'), opVaga: parseFloat(getComputedStyle(face.querySelector('.vaga')).opacity), frenteX: Math.round(el.getBoundingClientRect().left - r0.left), dxNoCard: getComputedStyle(card).getPropertyValue('--ph-dx').trim(), dxNoCardFundo: getComputedStyle(face.querySelector('.dcard')).getPropertyValue('--prog').trim(), revela: p.dataset.revela ?? null, nivel2: nivel2 ? getComputedStyle(nivel2).transform : null };
  ev('pointerup', x + dx); await new Promise((r2) => setTimeout(r2, 500));
  const depois = { frenteX: Math.round(el.getBoundingClientRect().left - r0.left), progFace: parseFloat(face.style.getPropertyValue('--prog') || '0'), revela: p.dataset.revela ?? null, total: p.dataset.total };
  return { durante, depois };
}, { sel: NU, dx, semRegistro });
for (const [nome, motor, device] of [['Edge', edge, null], ...(wk ? [['WebKit emulado', wk, 'iPhone 13']] : [])]) for (const semRegistro of [false, true]) {
  const R = `${nome}, ${semRegistro ? 'sem @property (fallback)' : 'com @property'}`;
  const { ctx, pg } = await abrir(motor, { device });
  await aoCentro(pg, NU);
  const total0 = await pg.$eval(NU, (e) => e.dataset.total), ordem0 = await topo(pg, NU);
  const a = await arrastoMedido(pg, -50, semRegistro);
  ok(a.durante.progNaPilha === '' && a.durante.progFace > 0.4 && a.durante.progVaga > 0.4, `${R}: --prog é escrito nos cards de fundo (${a.durante.progFace}) e na camada revelada (${a.durante.progVaga}), e não na pilha`);
  ok(a.durante.opVaga > 0.9 && a.durante.frenteX < -40 && a.durante.revela === 'esq', `${R}: o próximo card aparece (opacidade ${a.durante.opVaga}) enquanto o da frente acompanha o dedo (${a.durante.frenteX} px)`);
  if (!semRegistro) ok(a.durante.dxNoCard === '0px' && a.durante.dxNoCardFundo === '0', `${R}: o valor do arrasto não herda para dentro dos cards (--ph-dx no card: ${a.durante.dxNoCard}; --prog no card de fundo: ${a.durante.dxNoCardFundo})`);
  ok(a.depois.frenteX === 0 && a.depois.progFace === 0 && a.depois.revela === null && a.depois.total === total0 && (await topo(pg, NU)) === ordem0, `${R}: soltar um gesto curto devolve o card (x ${a.depois.frenteX}), zera --prog (${a.depois.progFace}) e não muda a ordem`);
  // cancelar (o navegador tomou o gesto para rolar) devolve tudo
  const c = await pg.evaluate(async (sel) => { const p = document.querySelector(sel), el = p.querySelector('.ph-arrasto'), r0 = el.getBoundingClientRect(), y = r0.top + r0.height * .45, x = r0.left + r0.width / 2; el.setPointerCapture = () => {}; const ev = (t, px) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 11, pointerType: 'touch', isPrimary: true, clientX: px, clientY: y })); ev('pointerdown', x); for (let i = 1; i <= 6; i++) { ev('pointermove', x - 8 * i); await new Promise((r2) => setTimeout(r2, 16)); } ev('pointercancel', x - 48); await new Promise((r2) => setTimeout(r2, 650)); return { x: Math.round(el.getBoundingClientRect().left - r0.left), prog: parseFloat(p.querySelector('.ph-atras').style.getPropertyValue('--prog') || '0'), revela: p.dataset.revela ?? null }; }, NU);
  ok(Math.abs(c.x) <= 2 && c.prog === 0 && c.revela === null, `${R}: o gesto cancelado pelo navegador devolve o card e zera o que foi revelado (${JSON.stringify(c)})`);
  // gesto completo: assume a frente o card revelado
  const t0 = await topo(pg, NU);
  const full = await pg.evaluate(async (sel) => { const p = document.querySelector(sel), el = p.querySelector('.ph-arrasto'), r0 = el.getBoundingClientRect(), y = r0.top + r0.height * .45, x = r0.left + r0.width / 2; el.setPointerCapture = () => {}; const ev = (t, px) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 12, pointerType: 'touch', isPrimary: true, clientX: px, clientY: y })); ev('pointerdown', x); for (let i = 1; i <= 10; i++) { ev('pointermove', x - 19 * i); await new Promise((r2) => setTimeout(r2, 16)); } const rev = p.querySelector('.ph-atras[data-face] .assunto')?.textContent.trim(); ev('pointerup', x - 190); await new Promise((r2) => setTimeout(r2, 700)); return { rev, frente: p.querySelector('.ph-arrasto .assunto').textContent.trim() }; }, NU);
  ok(full.rev === full.frente && full.frente !== t0, `${R}: o gesto completo leva à frente exatamente o card revelado ("${full.frente.slice(0, 18)}")`);
  await pg.$eval('.main', (m) => { m.scrollTop = 0; }); await esperar(100); await pg.$eval('.main', (m) => { m.scrollTop += 120; }); await esperar(150);
  ok((await pg.evaluate(() => document.querySelector('.main').scrollTop)) > 60, `${R}: a rolagem vertical continua livre depois dos gestos`);
  await ctx.close();
}

ok(erros.length === 0, 'nenhum erro de console ou de página' + (erros.length ? `: ${erros.slice(0, 3).join(' | ')}` : ''));
await edge.close(); if (wk) await wk.close(); parar();
console.log(falhas ? `\n${falhas} verificação(ões) falharam de ${total}.` : `\nTudo certo: ${total} verificações.`);
process.exit(falhas ? 1 : 0);
