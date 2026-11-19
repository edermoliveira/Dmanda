// Referência visual do aplicativo inteiro, para provar que uma limpeza de CSS (ou de interface) não mudou o que aparece.
// Cada cenário (tela ou janela) é capturado em PNG e também resumido pelo estilo CALCULADO de todos os elementos (tag, classes e todas as propriedades de getComputedStyle): uma regra que mudasse
// um pixel ou um valor invisível apareceria no resumo, mesmo que a imagem parecesse igual. Os mesmos dados fictícios, o mesmo relógio (03/11/2026, 10:30), movimento reduzido, mesmas larguras e temas.
// Uso:
//   node scripts/capturar-referencia-visual.mjs gravar <rótulo> [porta]            grava .dados-teste/referencia-visual/<rótulo>/ (PNG, resumo.json)
//   node scripts/capturar-referencia-visual.mjs comparar <rótuloA> <rótuloB>  compara os dois, lista as diferenças e monta comparacao-<A>-<B>.html (lado a lado e diferença)
// Só abre um banco de TESTE descartável (PGlite) numa cópia da semente; nunca toca o Supabase real. Um `next dev` por vez.
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { abrirEdge, abrirWebkit, iniciarServidor, observarErros, semearBanco, USUARIO_TESTE } from './auxiliar-navegador.mjs';

const [modo, rotuloA, argB] = process.argv.slice(2);
const RAIZ = '.dados-teste/referencia-visual';
const REFERENCIA = '2026-11-03', RELOGIO = new Date(`${REFERENCIA}T10:30:00-03:00`);
const SEMENTE = `${RAIZ}/_semente`;

const dia = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
const d = (n) => dia(REFERENCIA, n);

// ---------- semente: dados fictícios que exercitam cada família de estilos ----------
async function semear() {
  rmSync(SEMENTE, { recursive: true, force: true }); mkdirSync(SEMENTE, { recursive: true });
  await semearBanco(SEMENTE, async (c, db) => {
    const mk = async (assunto, { prazo = null, ...o } = {}) => {
      const x = await c('criar_demanda', { p: { assunto, numero: '', etapa: 'Fazendo', ...o } });
      if (prazo !== null) await db.query('update public.demandas set prazo = $1, prazo_original = $1 where id = $2', [d(prazo), x.id]);
      return x;
    };
    const tarefas = async (x, textos, feitas = 0) => {
      let r = x;
      for (const t of textos) r = await c('adicionar_tarefa', { p_demanda: x.id, p_texto: t });
      for (const t of r.tarefas.slice(0, feitas)) await c('marcar_tarefa', { p_id: t.id, p_concluida: true });
    };
    await c('salvar_dia_indisponivel', { p: { data: d(7), descricao: 'Feriado municipal fictício', categoria: 'Feriado' } });
    await c('salvar_dia_indisponivel', { p: { data: d(23), descricao: 'Congresso estadual de gestão', categoria: 'Evento externo' } });
    await c('salvar_periodo_indisponivel', { p: { operacao_id: '00000000-0000-4000-8000-000000000001', data_inicio: '2026-12-24', data_fim: '2027-01-03', descricao: 'Recesso da virada', categoria: 'Feriado' } });
    const a = await mk('Resposta ao Ministério Público sobre o contrato de limpeza urbana', { tipo: 'Ofício', numero: '301/2026', origem: 'Prefeita', prazo: -2, chegou_em: d(-20), descricao: 'Texto fictício da descrição, com mais de uma linha para medir o corte do card. '.repeat(3) });
    await tarefas(a, ['Reunir os documentos', 'Escrever a minuta', 'Enviar para assinatura'], 1);
    const b = await mk('Parecer jurídico do processo de compras', { tipo: 'Processo', area: 'Compras', numero: '302/2026', prazo: 0, chegou_em: d(-10), setor: 'Jurídico' });
    await tarefas(b, ['Conferir a minuta', 'Anexar a justificativa'], 2);
    await mk('Memorando do Gabinete sobre o recesso', { tipo: 'Memorando', origem: 'Gabinete', prazo: 3, chegou_em: d(-1), etapa: 'Cadastro' });
    await mk('Protocolo de pessoal sem prazo', { tipo: 'Protocolo', area: 'Pessoal', chegou_em: d(-5), etapa: 'Vistos' });
    const e = await mk('Aguarda a Contabilidade', { tipo: 'Memorando', etapa: 'Aguardando retorno', setor: 'Contabilidade', acompanhar_em: d(4), prazo: 12, chegou_em: d(-8) });
    await tarefas(e, ['Cobrar a resposta']);
    await mk('Aguarda a Prefeita', { tipo: 'Ofício', etapa: 'Aguardando Prefeita', prazo: 9, chegou_em: d(-4), encaminhada_em: d(-3) });
    await mk('Demanda longe do prazo', { tipo: 'Memorando', prazo: 40, chegou_em: d(-30) });
    // vencimento antecipado antes da chegada (aviso do sininho): chegada 28/12 + 3 dias com o recesso cadastrado
    await mk('Chegada no recesso', { tipo: 'Ofício', chegou_em: '2026-12-28', prazo_original: '2026-12-31' });
    const f = await mk('Concluída e guardada', { tipo: 'Memorando', prazo: -6, chegou_em: d(-25) }); await c('concluir_demanda', { p_id: f.id });
    const g = await mk('Arquivada fictícia', { tipo: 'Memorando', prazo: 5 }); await c('arquivar_demanda', { p_id: g.id });
    for (let i = 0; i < 8; i++) await c('criar_entrada', { p: { titulo: i % 3 ? `Entrada ${i + 1}` : '', texto: `Texto fictício da entrada ${i + 1} com #tag${i % 4} e #geral.\n`.repeat(1 + (i % 3)), cor: i % 5, fixada: i === 0 || i === 5 } });
    const ar = await c('criar_entrada', { p: { texto: 'Entrada arquivada fictícia #velha', cor: 2 } }); await c('arquivar_entrada', { p_id: ar.id });
    const ev = (o) => c('criar_evento', { p: { tipo: 'Reunião', aviso_min: null, ...o } });
    await ev({ titulo: 'Reunião de secretariado', data: d(0), inicio: '09:00', fim: '10:00' });
    await ev({ titulo: 'Visita técnica à escola', tipo: 'Compromisso', data: d(0), inicio: '14:00', fim: '15:30' });
    await ev({ titulo: 'Sobreposta à visita', tipo: 'Compromisso', data: d(0), inicio: '15:00', fim: '16:00' });
    await ev({ titulo: 'Audiência pública do plano diretor', tipo: 'Compromisso', data: d(5), inicio: '15:00', fim: '17:00' });
    await ev({ titulo: 'Semana do servidor público', tipo: 'Lembrete', data: d(9), dia_inteiro: true });
    // o humor entra direto na tabela: a função registrar_dias vale só para hoje e os 5 dias anteriores do relógio do banco, que não é o do cenário
    for (const [i, n] of [-4, -3, -2, -1, 0].entries()) await db.query('insert into public.registros_dia (user_id, dia, humor) values ($1, $2, $3)', [USUARIO_TESTE, d(n), 1 + ((i * 2) % 5)]);
  });
}

// ---------- perfis, temas e cenários ----------
const PERFIS = [
  { nome: 'computador', motor: 'edge', opcoes: { viewport: { width: 1360, height: 800 } } },
  { nome: 'ipad', motor: 'edge', opcoes: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
  { nome: 'iphone', motor: 'edge', opcoes: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { nome: 'iphone-webkit', motor: 'webkit', opcoes: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
];
const TEMAS = ['claro', 'escuro'];

const pronto = async (pg, seletor = '.app .main') => {
  await pg.waitForSelector(seletor, { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(700);
};
const ir = async (pg, base, rota) => { await pg.goto(base + rota, { waitUntil: 'load', timeout: 120000 }); await pronto(pg); };
const clicar = (pg, nome, opcoes = {}) => pg.getByRole('button', { name: nome, ...opcoes }).first().click({ timeout: 8000 });
const abrirNova = async (pg, rotulo) => {
  const fab = pg.locator('.fab:visible');
  if (await fab.count()) { await fab.first().click(); } else { await pg.locator('.plusbtn:visible, [aria-label="Criar novo"]:visible, .icbtn[aria-haspopup="menu"]:visible').first().click(); }
  await pg.waitForTimeout(300);
  await pg.getByRole('menuitem', { name: rotulo }).or(pg.getByRole('button', { name: rotulo })).first().click({ timeout: 8000 });
  await pg.waitForSelector('.modal', { timeout: 8000 }); await pg.waitForTimeout(500);
};

const abrirCard = async (pg, texto) => {
  await pg.fill('#fq', texto); await pg.waitForTimeout(500); // as filas de Cards repetem a demanda: o filtro deixa só a procurada
  const card = pg.locator('.dcard', { hasText: texto }).first();
  await card.evaluate((e) => e.scrollIntoView({ block: 'center' })); await card.locator('.assunto').click();
  await pg.waitForSelector('.modal', { timeout: 15000 }); await pg.waitForTimeout(700);
};

const CENARIOS = [
  ['inicio', async (pg, b) => ir(pg, b, '/')],
  ['demandas-cards', async (pg, b) => { await ir(pg, b, '/demandas'); await clicar(pg, 'Cards'); await pg.waitForTimeout(500); }],
  ['demandas-quadro', async (pg, b) => { await ir(pg, b, '/demandas'); await clicar(pg, 'Quadro'); await pg.waitForTimeout(500); }],
  ['demandas-tabela', async (pg, b) => { await ir(pg, b, '/demandas'); await clicar(pg, 'Tabela'); await pg.waitForTimeout(500); }],
  ['demandas-lista', async (pg, b) => { await ir(pg, b, '/demandas'); await clicar(pg, 'Lista'); await pg.waitForTimeout(500); }],
  ['demandas-filtros', async (pg, b) => { await ir(pg, b, '/demandas'); await clicar(pg, /^Filtros/); await pg.waitForTimeout(500); }],
  ['demandas-detalhe', async (pg, b) => { await ir(pg, b, '/demandas'); await abrirCard(pg, 'Parecer jurídico'); }],
  ['demandas-detalhe-aviso', async (pg, b) => { await ir(pg, b, '/demandas'); await abrirCard(pg, 'Chegada no recesso'); }],
  ['entradas', async (pg, b) => ir(pg, b, '/entradas')],
  ['entrada-aberta', async (pg, b) => { await ir(pg, b, '/entradas'); await pg.locator('.postits > *').first().click(); await pg.waitForSelector('.modal', { timeout: 8000 }); await pg.waitForTimeout(500); }],
  ['entrada-nova', async (pg, b) => { await ir(pg, b, '/entradas'); await abrirNova(pg, 'Nova entrada'); }],
  ['agenda-dia', async (pg, b) => { await ir(pg, b, '/agenda'); await clicar(pg, 'Dia', { exact: true }); await pg.waitForTimeout(600); }],
  ['agenda-semana', async (pg, b) => { await ir(pg, b, '/agenda'); await clicar(pg, 'Semana', { exact: true }); await pg.waitForTimeout(600); }],
  ['agenda-mes', async (pg, b) => { await ir(pg, b, '/agenda'); await clicar(pg, 'Mês', { exact: true }); await pg.waitForTimeout(600); }],
  ['agenda-mes-gaveta', async (pg, b) => { await ir(pg, b, '/agenda'); await clicar(pg, 'Mês', { exact: true }); await pg.waitForTimeout(500); await pg.locator('[data-dia], .agd-cel, .dia-cel').nth(8).click({ force: true }); await pg.waitForTimeout(700); }],
  ['evento-novo', async (pg, b) => { await ir(pg, b, '/agenda'); await abrirNova(pg, 'Novo evento'); }],
  ['tarefa-nova', async (pg, b) => { await ir(pg, b, '/'); await abrirNova(pg, 'Nova tarefa'); }],
  ['cadastro-passo1', async (pg, b) => { await ir(pg, b, '/demandas'); await abrirNova(pg, 'Nova demanda'); }],
  ['cadastro-erro', async (pg, b) => { await ir(pg, b, '/demandas'); await abrirNova(pg, 'Nova demanda'); await pg.locator('.modal .m-f .btn.pri').click(); await pg.waitForTimeout(500); }],
  ['cadastro-passo2', async (pg, b) => { await ir(pg, b, '/demandas'); await abrirNova(pg, 'Nova demanda'); await pg.locator('.modal input').first().fill('Demanda fictícia da captura'); await pg.locator('.modal .m-f .btn.pri').click(); await pg.waitForTimeout(1500); }],
  ['config', async (pg, b) => ir(pg, b, '/config')],
  ['config-dias-erro', async (pg, b) => { await ir(pg, b, '/config'); await pg.getByRole('button', { name: /^Cadastrar (dia|período)/ }).first().click(); await pg.waitForTimeout(500); }],
  ['arquivo', async (pg, b) => ir(pg, b, '/arquivo')],
  ['documentos', async (pg, b) => ir(pg, b, '/documentos')],
  ['ia', async (pg, b) => ir(pg, b, '/ia')],
  ['mais', async (pg, b) => ir(pg, b, '/mais')],
  ['busca', async (pg, b) => { await ir(pg, b, '/'); await clicar(pg, 'Buscar em tudo'); await pg.waitForSelector('.busca-ov', { timeout: 8000 }); await pg.keyboard.type('Parecer'); await pg.waitForTimeout(700); }],
  ['sino', async (pg, b) => { await ir(pg, b, '/'); await pg.locator('[aria-label^="Avisos:"]').first().click(); await pg.waitForSelector('.avisos-painel', { timeout: 8000 }); await pg.waitForTimeout(500); }],
  ['menu-conta', async (pg, b) => { await ir(pg, b, '/'); await pg.locator('[aria-label*="conta" i], .avatar, [data-conta]').first().click(); await pg.waitForTimeout(500); }],
  ['perfil', async (pg, b) => { await ir(pg, b, '/'); await pg.locator('[aria-label*="conta" i], .avatar, [data-conta]').first().click(); await pg.waitForTimeout(400); await pg.locator('[data-item="perfil"]').click(); await pg.waitForTimeout(900); }],
  ['foco-teclado', async (pg, b) => { await ir(pg, b, '/'); for (let i = 0; i < 6; i++) await pg.keyboard.press('Tab'); await pg.waitForTimeout(300); }],
  ['cadastro-passo3-grava', async (pg, b) => {
    await ir(pg, b, '/demandas'); await abrirNova(pg, 'Nova demanda'); await pg.locator('.modal input').first().fill('Demanda fictícia da captura');
    await pg.locator('.modal .m-f .btn.pri').click(); await pg.waitForTimeout(1500); await pg.locator('.modal .m-f .btn.pri').click(); await pg.waitForTimeout(1500);
  }],
  ['pagina-inexistente', async (pg, b) => { await pg.goto(b + '/marca', { waitUntil: 'load', timeout: 60000 }); await pg.waitForTimeout(500); }],
];

// resumo do estilo calculado de todos os elementos da página (tag.classes + todas as propriedades), com um hash por elemento
const RESUMIR = () => {
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const nomes = []; const hashes = [];
  const personalizadas = {}; // as propriedades personalizadas (--x) do contêiner do aplicativo: nome e valor, para ver exatamente quais saíram
  for (const el of document.querySelectorAll('body, body *')) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
    const cs = getComputedStyle(el); let s = '';
    for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (p.startsWith('--')) { if (el.classList.contains('app') && el.parentElement?.classList.contains('frame')) personalizadas[p] = cs.getPropertyValue(p); } else s += p + ':' + cs.getPropertyValue(p) + ';'; }
    const r = el.getBoundingClientRect();
    s += `@${Math.round(r.width * 10)}x${Math.round(r.height * 10)}`;
    nomes.push((el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().replace(/\s+/g, '.') : '')).slice(0, 70));
    hashes.push(fnv(s));
  }
  return { nomes, hashes, personalizadas };
};

async function gravar(rotulo, porta) {
  if (!existsSync(SEMENTE)) await semear();
  const pastaDados = `${RAIZ}/_dados-${rotulo}`;
  rmSync(pastaDados, { recursive: true, force: true }); cpSync(SEMENTE, pastaDados, { recursive: true });
  const saida = `${RAIZ}/${rotulo}`; rmSync(saida, { recursive: true, force: true }); mkdirSync(saida, { recursive: true });
  const { base, parar } = await iniciarServidor({ porta, pasta: pastaDados });
  const edge = await abrirEdge(); const wk = await abrirWebkit();
  const resumo = {}; const falhas = [];
  try {
    for (const perfil of PERFIS) {
      const nav = perfil.motor === 'edge' ? edge : wk;
      if (!nav) { console.log(`pulado: ${perfil.nome} (motor indisponível)`); continue; }
      for (const tema of TEMAS) {
        for (const [nome, preparar] of CENARIOS) {
          const chave = `${perfil.nome}-${tema}-${nome}`;
          if (process.env.SO && !new RegExp(process.env.SO).test(chave)) continue;
          // um contexto novo por cenário: nenhum rascunho, armazenamento ou estado de um vaza para o outro
          const ctx = await nav.newContext({ ...perfil.opcoes, reducedMotion: 'reduce', colorScheme: tema === 'escuro' ? 'dark' : 'light' });
          await ctx.clock.setFixedTime(RELOGIO);
          await ctx.addInitScript((t) => { try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); } catch { /* sem armazenamento */ } }, tema);
          const pg = await ctx.newPage(); const erros = []; observarErros(pg, erros);
          let erro = null;
          try { await preparar(pg, base); } catch (e) { erro = String(e.message).split('\n')[0].slice(0, 160); }
          await pg.waitForTimeout(300);
          const png = await pg.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }).catch(() => null);
          if (png) writeFileSync(`${saida}/${chave}.png`, png);
          const est = await pg.evaluate(RESUMIR).catch(() => ({ nomes: [], hashes: [] }));
          resumo[chave] = { png: png ? createHash('sha256').update(png).digest('hex') : null, geral: createHash('sha256').update(est.hashes.join()).digest('hex'), n: est.hashes.length, personalizadas: est.personalizadas, nomes: est.nomes, hashes: est.hashes, erro, errosDePagina: erros.splice(0).slice(0, 3) };
          if (erro) falhas.push(`${chave}: ${erro}`);
          console.log(`${erro ? 'passo falhou' : 'ok         '} ${chave} (${est.hashes.length} elementos)${erro ? ': ' + erro : ''}`);
          await ctx.close();
        }
      }
    }
  } finally { await edge.close(); await wk?.close(); parar(); }
  writeFileSync(`${saida}/resumo.json`, JSON.stringify(resumo));
  console.log(`\n${Object.keys(resumo).length} capturas em ${saida}; ${falhas.length} passo(s) que não chegaram ao estado esperado.`);
  if (falhas.length) console.log(falhas.join('\n'));
  rmSync(pastaDados, { recursive: true, force: true });
}

async function comparar(a, b) {
  const A = JSON.parse(readFileSync(`${RAIZ}/${a}/resumo.json`, 'utf8')), B = JSON.parse(readFileSync(`${RAIZ}/${b}/resumo.json`, 'utf8'));
  const chaves = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  const difs = [];
  let iguaisPng = 0, iguaisEstilo = 0;
  for (const k of chaves) {
    const x = A[k], y = B[k];
    if (!x || !y) { difs.push({ k, motivo: 'só existe em ' + (x ? a : b) }); continue; }
    const png = x.png === y.png, est = x.geral === y.geral;
    if (png) iguaisPng++; if (est) iguaisEstilo++;
    if (!png || !est || !!x.erro !== !!y.erro) {
      const idx = []; for (let i = 0; i < Math.max(x.hashes.length, y.hashes.length); i++) if (x.hashes[i] !== y.hashes[i]) idx.push(i);
      difs.push({ k, motivo: `${png ? 'imagem igual' : 'imagem diferente'}, ${est ? 'estilos iguais' : 'estilos diferentes'}${!!x.erro !== !!y.erro ? ', passo diferente' : ''}`, elementos: idx.slice(0, 8).map((i) => `${i}:${x.nomes[i] ?? '(falta)'} | ${y.nomes[i] ?? '(falta)'}`), total: idx.length });
    }
  }
  const pers = { removidas: new Map(), mudadas: new Map(), novas: new Map() };
  for (const k of chaves) { const pa = A[k]?.personalizadas ?? {}, pb = B[k]?.personalizadas ?? {}; for (const n of new Set([...Object.keys(pa), ...Object.keys(pb)])) { if (!(n in pb)) pers.removidas.set(n, (pers.removidas.get(n) ?? 0) + 1); else if (!(n in pa)) pers.novas.set(n, (pers.novas.get(n) ?? 0) + 1); else if (pa[n] !== pb[n]) pers.mudadas.set(n, (pers.mudadas.get(n) ?? 0) + 1); } }
  console.log(`propriedades personalizadas: ${pers.removidas.size} saíram [${[...pers.removidas.keys()].join(' ')}], ${pers.novas.size} entraram, ${pers.mudadas.size} mudaram de valor [${[...pers.mudadas.keys()].join(' ')}]`);
  console.log(`${chaves.length} cenários: imagens idênticas ${iguaisPng}, estilos calculados idênticos ${iguaisEstilo}; diferentes: ${difs.length}`);
  for (const x of difs) console.log(`DIFERE ${x.k}: ${x.motivo}` + (x.total ? ` (${x.total} elementos)\n   ${x.elementos.join('\n   ')}` : ''));
  // onde e quanto as imagens diferentes diferem (pixels, caixa envolvente, maior diferença de cor), medido no navegador
  const comImagemDiferente = difs.filter((x) => A[x.k] && B[x.k] && A[x.k].png !== B[x.k].png).map((x) => x.k);
  if (comImagemDiferente.length) {
    const edge = await abrirEdge(); const pg = await edge.newPage();
    for (const k of comImagemDiferente) {
      const [pa, pb] = [readFileSync(`${RAIZ}/${a}/${k}.png`).toString('base64'), readFileSync(`${RAIZ}/${b}/${k}.png`).toString('base64')];
      const r = await pg.evaluate(async ([ia64, ib64]) => {
        const carregar = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
        const [ia, ib] = await Promise.all([carregar(ia64), carregar(ib64)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { tamanhos: `${ia.width}x${ia.height} contra ${ib.width}x${ib.height}` };
        const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
        x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
        let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, maior = 0;
        for (let i = 0; i < da.length; i += 4) {
          const dif = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
          if (dif > 0) { n++; const p = i / 4, px = p % c.width, py = (p - px) / c.width; if (px < x0) x0 = px; if (py < y0) y0 = py; if (px > x1) x1 = px; if (py > y1) y1 = py; if (dif > maior) maior = dif; }
        }
        return { pixels: n, de: c.width * c.height, caixa: [x0, y0, x1, y1], maior };
      }, [pa, pb]);
      console.log(`PIXELS ${k}: ${JSON.stringify(r)}`);
    }
    await edge.close();
  }
  // folha de comparação (lado a lado + diferença) só dos cenários com imagem diferente, ou uma amostra de iguais para a inspeção
  const mostrar = [...difs.map((x) => x.k).filter((k) => A[k] && B[k]), ...chaves.filter((k) => A[k]?.png && A[k]?.png === B[k]?.png).filter((_, i) => i % 9 === 0)];
  const url = (r, k) => pathToFileURL(resolve(`${RAIZ}/${r}/${k}.png`)).href;
  const html = `<!doctype html><meta charset="utf-8"><style>body{font:12px sans-serif;background:#888;margin:8px}.l{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px;background:#fff;padding:6px}.l img{width:100%;display:block}.d{position:relative;background:#000}.d img{position:absolute;top:0;left:0;width:100%}.d img+img{mix-blend-mode:difference}.d{aspect-ratio:var(--r)}h3{margin:6px 0;grid-column:1/-1}</style>` +
    mostrar.map((k) => `<div class="l"><h3>${k}${difs.some((x) => x.k === k) ? ' (DIFERE)' : ' (igual)'}</h3><img src="${url(a, k)}"><img src="${url(b, k)}"><div class="d" style="--r:1/1"><img src="${url(a, k)}"><img src="${url(b, k)}"></div></div>`).join('');
  // FORA do projeto: um .html dentro da árvore do Next faz o servidor de desenvolvimento recarregar a página em laço (observado em 19/11/2026 no testar:acesso-direto)
  const folha = `${tmpdir()}/dmanda-comparacao-${a}-${b}.html`;
  writeFileSync(folha, html);
  console.log(`folha: ${folha} (${mostrar.length} cenários)`);
  process.exitCode = difs.length ? 1 : 0;
}

// Capturas de uma mesma versão variam um pouco (desfoque, caret, relógio, animações que o movimento reduzido não pega): duas rodadas de cada lado dizem o que é ruído.
// Um cenário é CONSISTENTE se alguma imagem do grupo antigo é idêntica (byte a byte) a alguma do grupo novo; só os que não têm nenhuma em comum são suspeitos e vão para a medição de pixels.
async function compararGrupos(antigos, novos) {
  const ler = (r) => JSON.parse(readFileSync(`${RAIZ}/${r}/resumo.json`, 'utf8'));
  const GA = antigos.map((r) => [r, ler(r)]), GN = novos.map((r) => [r, ler(r)]);
  const chaves = [...new Set([...GA, ...GN].flatMap(([, x]) => Object.keys(x)))].sort();
  const suspeitos = [], consistentes = [];
  for (const k of chaves) {
    const ha = new Set(GA.map(([, x]) => x[k]?.png).filter(Boolean)), hn = new Set(GN.map(([, x]) => x[k]?.png).filter(Boolean));
    if ([...ha].some((h) => hn.has(h))) consistentes.push(k); else suspeitos.push(k);
  }
  console.log(`${chaves.length} cenários; consistentes (alguma imagem antiga idêntica a alguma nova): ${consistentes.length}; sem nenhuma em comum: ${suspeitos.length}`);
  const edge = await abrirEdge(); const pg = await edge.newPage();
  for (const k of suspeitos) {
    let melhor = null;
    for (const [ra] of GA) for (const [rn] of GN) {
      const pa = `${RAIZ}/${ra}/${k}.png`, pb = `${RAIZ}/${rn}/${k}.png`;
      if (!existsSync(pa) || !existsSync(pb)) continue;
      const r = await pg.evaluate(async ([ia64, ib64]) => {
        const carregar = (t) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + t; });
        const [ia, ib] = await Promise.all([carregar(ia64), carregar(ib64)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { pixels: 1e9, tamanhos: `${ia.width}x${ia.height} contra ${ib.width}x${ib.height}` };
        const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
        x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
        let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, maior = 0;
        for (let i = 0; i < da.length; i += 4) { const dif = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); if (dif > 0) { n++; const p = i / 4, px = p % c.width, py = (p - px) / c.width; if (px < x0) x0 = px; if (py < y0) y0 = py; if (px > x1) x1 = px; if (py > y1) y1 = py; if (dif > maior) maior = dif; } }
        return { pixels: n, caixa: [x0, y0, x1, y1], maior };
      }, [readFileSync(pa).toString('base64'), readFileSync(pb).toString('base64')]);
      if (!melhor || r.pixels < melhor.r.pixels) melhor = { par: `${ra} x ${rn}`, r };
    }
    console.log(`SUSPEITO ${k}: par mais próximo ${melhor?.par}: ${JSON.stringify(melhor?.r)}`);
  }
  await edge.close();
  // estilo calculado (propriedades padrão): só as rodadas com o resumo novo (campo personalizadas)
  const comEstilo = (G) => G.filter(([, x]) => Object.values(x).some((v) => v.personalizadas));
  const EA = comEstilo(GA), EN = comEstilo(GN);
  let diferentes = 0;
  for (const k of chaves) {
    const ha = new Set(EA.map(([, x]) => x[k]?.geral).filter(Boolean)), hn = new Set(EN.map(([, x]) => x[k]?.geral).filter(Boolean));
    if (ha.size && hn.size && ![...ha].some((h) => hn.has(h))) { diferentes++; console.log(`ESTILO ${k}: nenhum resumo de estilo padrão em comum`); }
  }
  console.log(`estilo calculado (propriedades padrão, rodadas: ${EA.map(([r]) => r)} x ${EN.map(([r]) => r)}): ${chaves.length - diferentes} cenários com resumo em comum, ${diferentes} sem`);
  process.exitCode = suspeitos.length ? 1 : 0;
}

if (modo === 'comparar-grupos' && rotuloA && argB) await compararGrupos(rotuloA.split(','), argB.split(','));
else if (modo === 'gravar' && rotuloA) await gravar(rotuloA, argB || '7140');
else if (modo === 'comparar' && rotuloA && argB) await comparar(rotuloA, argB);
else { console.error('Uso: gravar <rótulo> [porta] | comparar <A> <B> | comparar-grupos <A1,A2> <B1,B2>'); process.exit(2); }
process.exit(process.exitCode ?? 0);
