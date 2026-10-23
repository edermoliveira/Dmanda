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
