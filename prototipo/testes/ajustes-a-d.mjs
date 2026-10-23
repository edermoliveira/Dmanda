// Verificação dos ajustes A a D de 23/10/2026 (descrição, vidro, cores dos processos, ícones). Uso: node testes/ajustes-a-d.mjs [tema] [claro|escuro]
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const temas = process.argv[2] ? [process.argv[2]] : ['a', 'b', 'c', 'd'];
const modos = process.argv[3] ? [process.argv[3]] : ['claro', 'escuro'];
const srv = await servir();
const b = await chromium.launch({ channel: 'msedge' });
const erros = [], falhas = [];
const conferir = (nome, ok, visto) => { console.log((ok ? 'ok    ' : 'FALHOU') + ' ' + nome + (ok ? '' : ' (veio: ' + JSON.stringify(visto) + ')')); if (!ok) falhas.push(nome); };

for (const tema of temas) for (const modo of modos) {
  const p = await b.newPage({ viewport: { width: 1480, height: 1000 } });
  p.on('pageerror', (e) => erros.push(e.message));
  const ir = async (o) => { await p.evaluate((x) => window.DM.trocar(Object.assign({ modal: null }, x)), o); await p.waitForTimeout(250); };
  const rot = '[' + tema + ' ' + modo + '] ';
  await p.goto(srv.url + '#dir=' + tema + '&tema=' + modo + '&tela=demandas&vis=cards&balao=nao&aviso=nao');
  await p.waitForFunction(() => window.DM && document.querySelector('.app'));
  await p.waitForTimeout(400);

  // ---- A: descrição ----
  const info = await p.evaluate(() => {
    const ls = [...document.querySelectorAll('.dcard')].map((c) => {
      const f = c.querySelector('.face.front'), d = f.querySelector('.desc'), a = f.querySelector('.assunto');
      const kids = [...f.children].map((x) => x.className.split(' ')[0]);
      return { id: c.dataset.id, tem: !!d, h: d ? d.getBoundingClientRect().height : 0, lh: d ? parseFloat(getComputedStyle(d).lineHeight) : 0, fam: d ? getComputedStyle(d).fontFamily : '', famMono: getComputedStyle(document.querySelector('.dcard .num')).fontFamily,
        ordem: kids.indexOf('desc') > kids.indexOf('assunto') && (kids.indexOf('chips') < 0 || kids.indexOf('desc') < kids.indexOf('chips')), corta: f.scrollHeight > f.clientHeight + 1 };
    });
    return ls;
  });
  const c1 = info.find((x) => x.id === '1'), c2 = info.find((x) => x.id === '2'), c3 = info.find((x) => x.id === '3');
  conferir(rot + 'A: descrição longa limitada a 3 linhas', c1.tem && c1.h <= c1.lh * 3 + 1, c1);
  conferir(rot + 'A: descrição curta ocupa só o necessário', c2.tem && c2.h <= c2.lh * 2 + 1, c2);
  conferir(rot + 'A: sem descrição, nada é reservado', !c3.tem);
  conferir(rot + 'A: ordem título, descrição, prazo', c1.ordem && c2.ordem, [c1.ordem, c2.ordem]);
  conferir(rot + 'A: descrição na fonte mono do tema', c1.fam === c1.famMono, [c1.fam, c1.famMono]);
  conferir(rot + 'A: nenhum card corta conteúdo', info.every((x) => !x.corta), info.filter((x) => x.corta));

  // edição, rascunho e salvamento
  await p.click('.dcard[data-id="2"] .face.front .assunto'); await p.waitForTimeout(250);
  const area = '#d-descricao';
  conferir(rot + 'A: abrir mostra a descrição inteira', (await p.inputValue(area)) === 'Verificar reajuste e prazo de vigência.');
  await p.fill(area, 'Verificar reajuste, prazo de vigência e a multa por rescisão antecipada. Pedir a planilha à Contabilidade.');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await p.click('.dcard[data-id="2"] .face.front .assunto'); await p.waitForTimeout(250);
  conferir(rot + 'A: Esc guarda rascunho da descrição', (await p.inputValue(area)).includes('multa por rescisão'));
  await p.click('text=Salvar alterações'); await p.waitForTimeout(300);
  conferir(rot + 'A: salvar atualiza o card', (await p.textContent('.dcard[data-id="2"] .desc')).includes('multa por rescisão'));
  // apagar a descrição remove o espaço
  await p.click('.dcard[data-id="2"] .face.front .assunto'); await p.waitForTimeout(250);
  await p.fill(area, ''); await p.click('text=Salvar alterações'); await p.waitForTimeout(300);
  conferir(rot + 'A: descrição apagada some do card', (await p.locator('.dcard[data-id="2"] .desc').count()) === 0);
  // nova demanda com descrição
  await p.evaluate(() => window.DM.acoes.msg && 0);
  await p.click('text=Nova demanda >> nth=0'); await p.waitForTimeout(300);
  await p.fill('#m-assunto', 'Teste de descrição'); await p.fill('#m-descricao', 'Texto de apoio da nova demanda.');
  await p.click('.modal >> text=Cadastrar'); await p.waitForTimeout(300);
  conferir(rot + 'A: cadastro com descrição aparece no card', (await p.locator('.dcard .desc', { hasText: 'Texto de apoio da nova demanda.' }).count()) === 1);

  // quadro, início e lista
  await ir({ vis: 'quadro', etapaSel: 'Fazendo' });
  conferir(rot + 'A: Quadro mostra a descrição', (await p.locator('.mini-card .desc').count()) >= 2);
  await ir({ vis: 'lista', aberto: { 1: true, 5: true } });
  conferir(rot + 'A: Lista aberta mostra a descrição inteira', (await p.locator('.linha-d .desc.cheia').count()) === 2);
  await ir({ tela: 'inicio' });
  conferir(rot + 'A: Início usa o mesmo card com descrição', (await p.locator('.dcard .desc').count()) >= 1);
  // ---- B: vidro mais transparente, legível, cards sólidos ----
  await ir({ tela: 'demandas', vis: 'cards', menuAb: true, pal: tema === 'b' ? 7 : tema === 'a' ? 4 : null });
  const vid = await p.evaluate(() => {
    const app = document.querySelector('.app'), cs = getComputedStyle(app);
    const alfa = (c) => { const m = c.match(/[\d.]+/g); return m && m.length > 3 ? +m[3] : 1; };
    const face = getComputedStyle(document.querySelector('.dcard .face.front'));
    return { fator: cs.getPropertyValue('--vidro').trim(), card: alfa(face.backgroundColor), cardImg: face.backgroundImage };
  });
  conferir(rot + 'B: fator do vidro em 0,7 (cerca de 30% mais transparente)', vid.fator === '.7' || vid.fator === '0.7', vid.fator);
  conferir(rot + 'B: cards continuam sólidos', vid.card >= 0.9, vid.card);
  // contraste real: esconde o item, fotografa o fundo atrás dele e mede o pior pixel
  const medirMenu = async (sel, aberto) => {
    await ir({ menuAb: aberto }); await p.hover('.main', { position: { x: 600, y: 300 } }); await p.waitForTimeout(500);
    const itens = await p.evaluate((sel) => [...document.querySelectorAll('.side .navi')].map((n) => { const a = n.querySelector(sel); if (!a || getComputedStyle(a).display === 'none') return null; const r = a.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cor: getComputedStyle(a).color }; }).filter(Boolean), sel);
    await p.addStyleTag({ content: '.side .navi ' + sel + ', .side .navi ' + sel + ' * { color: transparent !important; stroke: transparent !important; fill: transparent !important; }' });
    await p.waitForTimeout(200);
    const png = (await p.screenshot()).toString('base64');
    const pior = await p.evaluate(async ([b64, itens]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
      const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      let min = 99;
      for (const it of itens) {
        const t = it.cor.match(/[\d.]+/g).map(Number), lt = lum(t[0], t[1], t[2]);
        const d = cx.getImageData(Math.max(0, Math.floor(it.x)), Math.max(0, Math.floor(it.y)), Math.max(1, Math.ceil(it.w)), Math.max(1, Math.ceil(it.h))).data;
        for (let k = 0; k < d.length; k += 4) { const lb = lum(d[k], d[k + 1], d[k + 2]); const c = (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05); if (c < min) min = c; }
      }
      return min;
    }, [png, itens]);
    await p.reload(); await p.waitForFunction(() => window.DM && document.querySelector('.app')); await ir({ tela: 'demandas', vis: 'cards', menuAb: false });
    return pior;
  };
  const pRot = await medirMenu('.tx', true);
  conferir(rot + 'B: rótulos do menu aberto legíveis sobre o vidro (pior caso ' + pRot.toFixed(1) + ':1, mínimo 4,5)', pRot >= 4.5, pRot);
  // ---- C: cores dos processos ----
  const cores = async (vis) => {
    await ir({ tela: 'demandas', vis, etapaSel: 'Vistos', menuAb: false });
    return p.evaluate((vis) => {
      const sonda = (v) => { const d = document.createElement('div'); d.style.cssText = 'background-color:' + v; document.querySelector('.app').appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
      const T = { azul: sonda('var(--cat-azul)'), verde: sonda('var(--cat-verde)'), amar: sonda('var(--cat-amar)'), venc: sonda('var(--cat-venc)'), card: sonda('var(--card)'), bAzul: sonda('var(--cat-azul-barra)') };
      const face = (id) => { const c = document.querySelector((vis === 'cards' ? '.dcard' : '.mini-card') + '[data-id="' + id + '"]'); return c && (vis === 'cards' ? c.querySelector('.face.front') : c); };
      const bg = (id) => { const f = face(id); return f ? getComputedStyle(f).backgroundColor : null; };
      if (vis === 'quadro') { /* o quadro mostra uma etapa por vez no celular; no computador mostra todas */ }
      return { T, verde: bg(4), amar: bg(7), azul: bg(9), neutro: bg(2), venc: bg(1), sombra: face(1) ? getComputedStyle(face(1)).boxShadow : '' };
    }, vis);
  };
  for (const vis of ['cards', 'quadro']) {
    const r = await cores(vis);
    conferir(rot + 'C [' + vis + ']: Protocolo de pessoal em verde pastel', r.verde === r.T.verde, [r.verde, r.T.verde]);
    conferir(rot + 'C [' + vis + ']: Processo de compras em amarelo pastel', r.amar === r.T.amar, [r.amar, r.T.amar]);
    conferir(rot + 'C [' + vis + ']: Processo geral em azul pastel', r.azul === r.T.azul, [r.azul, r.T.azul]);
    conferir(rot + 'C [' + vis + ']: memorando segue neutro', r.neutro === r.T.card, [r.neutro, r.T.card]);
    conferir(rot + 'C [' + vis + ']: atrasado mantém o vermelho pastel e a faixa do tipo', r.venc === r.T.venc && r.sombra.includes(r.T.bAzul), [r.venc, r.sombra]);
  }
  // o verso continua neutro
  await ir({ tela: 'demandas', vis: 'cards' });
  const verso = await p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'background-color:var(--card)'; document.querySelector('.app').appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return [getComputedStyle(document.querySelector('.dcard[data-id="4"] .face.back')).backgroundColor, c]; });
  conferir(rot + 'C: verso do card neutro', verso[0] === verso[1], verso);
  // a cor decorre da classificação: editar muda o card
  await p.click('.dcard[data-id="9"] .face.front .assunto'); await p.waitForTimeout(250);
  await p.click('.modal [data-k="areaDem"][data-val="Compras"]'); await p.click('.modal >> text=Salvar alterações'); await p.waitForTimeout(300);
  conferir(rot + 'C: trocar a área para Compras deixa o card amarelo', (await p.getAttribute('.dcard[data-id="9"] .face.front', 'class')).includes('cat-amar'));
  await p.click('.dcard[data-id="9"] .face.front .assunto'); await p.waitForTimeout(250);
  await p.click('.modal [data-k="tipoDem"][data-val="Memorando"]'); await p.click('.modal >> text=Salvar alterações'); await p.waitForTimeout(300);
  conferir(rot + 'C: trocar o tipo para Memorando deixa o card neutro', !(await p.getAttribute('.dcard[data-id="9"] .face.front', 'class')).includes('cat-'));
  // título não influencia: assunto com a palavra "compras" no memorando 2 continua neutro
  await p.click('.dcard[data-id="2"] .face.front .assunto'); await p.waitForTimeout(250);
  await p.fill('#d-assunto', 'Processo de compras de papel'); await p.click('.modal >> text=Salvar alterações'); await p.waitForTimeout(300);
  conferir(rot + 'C: a cor não depende de palavras do título', !(await p.getAttribute('.dcard[data-id="2"] .face.front', 'class')).includes('cat-'));
  // Início usa o mesmo card
  await ir({ tela: 'inicio' });
  conferir(rot + 'C: Início mostra o card atrasado com a cor do tipo', (await p.getAttribute('.dcard[data-id="1"] .face.front', 'class')).includes('cat-azul'));
  // celular: largura estreita
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  await ir({ tela: 'demandas', vis: 'cards' });
  const cel = await p.evaluate(() => [...document.querySelectorAll('.dcard')].filter((c) => { const f = c.querySelector('.face.front'); return f.scrollHeight > f.clientHeight + 1; }).length);
  conferir(rot + 'A: celular sem corte nos cards', cel === 0, cel);
  await p.close();
}
await b.close(); srv.fechar();
conferir('Sem erros de JavaScript', erros.length === 0, erros);
console.log(falhas.length ? '\n' + falhas.length + ' falha(s).' : '\nTudo certo.');
process.exit(falhas.length ? 1 : 0);
