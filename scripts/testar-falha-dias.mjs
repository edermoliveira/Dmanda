// Falhas de leitura e avisos do sistema (subbloco 1.4): carregamento, erro e resultado vazio são coisas diferentes, e o MESMO problema aparece na barra global, no aviso da tela e no sininho.
// Uma leitura dos dias indisponíveis que falha não é "nenhum dia cadastrado": a lista parcial não vira completa por causa de um cadastro isolado, a prévia do vencimento não se apresenta como definitiva
// e só uma leitura completa bem-sucedida resolve o problema. "Lido" no sininho não resolve nada. Aqui a falha é injetada só nas leituras (a resposta da ação do servidor é reescrita; o banco segue com os dados).
// Navegador (Edge) com banco de teste (PGlite) semeado por semear-agenda.mjs; porta 7141. NÃO valida o Supabase real nem aparelho físico.
// Uso: node scripts/testar-falha-dias.mjs
import { rmSync, mkdirSync } from 'node:fs';
import { semearAgenda } from './semear-agenda.mjs';
import { abrirEdge, criarVerificador, instanteDaReferencia, iniciarServidor, novoContexto, semearBanco } from './auxiliar-navegador.mjs';

const PORTA = process.env.PORTA_TESTE_FALHA_DIAS || '7141', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/falha-dias';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const REFERENCIA = '2026-11-03';   // terça-feira; o feriado semeado cai em hoje + 7 (10/11/2026)
const S = await semearAgenda(PASTA, REFERENCIA);
const FERIADO = S.dia.data;
// uma demanda em Aguardando retorno cujo retorno (10 dias de 31/10 = 10/11) cai EXATAMENTE no feriado semeado: o servidor a antecipa para 09/11 com o calendário completo
await semearBanco(PASTA, async (c) => {
  const x = await c('criar_demanda', { p: { assunto: 'Retorno sobre o feriado', tipo: 'Memorando', etapa: 'Aguardando retorno', setor: 'PGM' } });
  await c('atualizar_demanda', { p_id: x.id, p: { encaminhada_em: '2026-10-31' } });
});
const SEM_REDE = 'Sem conexão com o servidor. Nada foi gravado. Confira a internet e tente de novo; o que você digitou continua na tela.';   // o texto que o contexto usa para "sem conexão"
const INSTANTE = instanteDaReferencia(REFERENCIA);
const { parar } = await iniciarServidor({ porta: PORTA, pasta: PASTA });
const { ok, resumo, aguardar } = criarVerificador();

const nav = await abrirEdge();
const erros = [];
// `falha` liga e desliga a falha simulada: `dias`, `eventos` e `demandas` reescrevem a parte correspondente da carga inicial; `dias` também reescreve a releitura só dos dias (a lista de dias que volta depois de um cadastro
// ou do botão do aviso); `rede` faz TODAS as partes falharem com o texto de "sem conexão". O banco continua com os dados.
const novo = async (viewport = { width: 1360, height: 900 }, tema = 'claro') => {
  const { ctx, pg } = await novoContexto(nav, { opcoes: { viewport }, instante: INSTANTE, tema, agenda: { modo: 'mes', cat: 'tudo' }, erros });
  const falha = { dias: false, eventos: false, rede: false, demandas: false, vezes: 0 };
  await pg.route('**/*', async (route) => {
    const q = route.request();
    if (!(q.method() === 'POST' && q.headers()['next-action'])) { await route.continue(); return; }
    const r = await route.fetch(); const texto = await r.text();
    const linhas = texto.split('\n');
    const responder = async () => { const corpo = linhas.join('\n'); await route.fulfill({ response: r, body: corpo, headers: { ...r.headers(), 'content-length': String(Buffer.byteLength(corpo)) } }); };
    const i = linhas.findIndex((l) => /^1:\{"ok":true,"dados":\{"demandas":/.test(l));
    if (i >= 0 && (falha.dias || falha.eventos || falha.rede)) {
      const j = JSON.parse(linhas[i].slice(2));
      if (falha.dias) j.dados.dias = { ok: false, erro: 'Falha simulada em dias.' };
      if (falha.eventos) j.dados.eventos = { ok: false, erro: 'Falha simulada em eventos.' };
      if (falha.rede) for (const k of ['demandas', 'dias', 'eventos', 'entradas']) j.dados[k] = { ok: false, erro: SEM_REDE };
      linhas[i] = '1:' + JSON.stringify(j); falha.vezes++; await responder(); return;
    }
    // a releitura só dos dias: uma lista cujos itens têm "categoria" e "descricao" e nenhuma "etapa" (as demandas têm etapa)
    const k = linhas.findIndex((l) => l.startsWith('1:{"ok":true,"dados":['));
    if (k >= 0 && falha.demandas) {   // a releitura só das demandas (depois de um cadastro de dia ou do botão do aviso): itens com assunto e etapa
      let lista = null; try { lista = JSON.parse(linhas[k].slice(2)).dados; } catch { /* outra resposta */ }
      if (Array.isArray(lista) && lista.length && lista.every((x) => x && 'assunto' in x && 'etapa' in x)) { linhas[k] = '1:' + JSON.stringify({ ok: false, erro: 'Falha simulada em demandas.' }); falha.vezes++; await responder(); return; }
    }
    if (k >= 0 && falha.dias) {
      let lista = null; try { lista = JSON.parse(linhas[k].slice(2)).dados; } catch { /* outra resposta */ }
      if (Array.isArray(lista) && lista.length && lista.every((x) => x && 'categoria' in x && 'descricao' in x && !('etapa' in x))) { linhas[k] = '1:' + JSON.stringify({ ok: false, erro: 'Falha simulada em dias.' }); falha.vezes++; await responder(); return; }
    }
    await route.fulfill({ response: r, body: texto });
  });
  return { ctx, pg, falha };
};
const ir = async (pg, rota) => {
  await pg.goto(BASE + rota, { waitUntil: 'load', timeout: 120000 }); await pg.waitForSelector('.app .main', { timeout: 120000 });
  await pg.waitForFunction(() => !/Carregando a agenda|Carregando as demandas/.test(document.body.innerText), null, { timeout: 120000 });
  await pg.waitForFunction(() => { const a = document.querySelector('.app'); return !!a && Object.keys(a).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')); }, null, { timeout: 120000 });
  await pg.waitForTimeout(900);
};
// navega pelo menu lateral e tira o mouse de cima dele (o menu expande com o mouse em cima ou com o foco dentro, e cobriria o conteúdo à esquerda)
const menu = async (pg, sel) => { await pg.click(sel); await pg.mouse.move(900, 700); await pg.evaluate(() => document.activeElement?.blur()); };
const texto = (pg, sel) => pg.textContent(sel).then((t) => t ?? '', () => '');
const barra = (pg, id) => pg.locator(`.erro-carga[data-aviso="${id}"]:visible`);
const globais = (pg) => pg.locator('.erro-carga[data-escopo="global"]:visible');
const rotuloSino = (pg) => pg.getAttribute('.sino', 'aria-label');
const abrirSino = async (pg) => { if (!(await pg.locator('.avisos-painel').count())) { await pg.click('.sino'); await pg.waitForSelector('.avisos-painel', { timeout: 5000 }); } };
const fecharSino = async (pg) => { if (await pg.locator('.avisos-painel').count()) { await pg.keyboard.press('Escape'); await pg.waitForSelector('.avisos-painel', { state: 'detached', timeout: 5000 }); } };
const itemSino = (pg, id) => pg.locator(`.avisos-painel [data-aviso="${id}"]`);
// a página anterior pode continuar montada (e escondida): só conta o que está visível
const esperarSem = (pg, sel) => pg.waitForFunction((s) => ![...document.querySelectorAll(s)].some((e) => e.getClientRects().length > 0), sel, { timeout: 15000 }).catch(() => {});
const marcosRetorno = (pg, dia) => pg.locator(`.agd-cel[data-data="${dia}"] .agd-it[data-k="demanda"][data-marco="retorno"]`).count();
const FERIADO_MARCADO = (pg) => pg.locator(`.agd-cel[data-data="${FERIADO}"]`).getAttribute('data-feriado');

// ---------- 0) controle: sem falha, nenhum aviso, o sininho diz "nenhum agora" e o dia aparece nos dois lugares ----------
{
  const { ctx, pg } = await novo();
  await ir(pg, '/agenda');
  ok((await pg.locator('.erro-carga[data-aviso]:visible').count()) === 0 && /nenhum agora/.test(await rotuloSino(pg)), 'controle, Agenda sem falha: nenhum aviso do sistema e o sininho diz "nenhum agora"');
  ok((await FERIADO_MARCADO(pg)) === 'true', `controle, Agenda: o feriado cadastrado (${FERIADO}) aparece marcado na grade`);
  ok((await marcosRetorno(pg, '2026-11-09')) >= 1 && (await marcosRetorno(pg, FERIADO)) === 0, 'controle, Agenda: o retorno do setor que cairia no feriado (10/11) está em 09/11, calculado pelo servidor');
  await abrirSino(pg);
  ok(/Nenhum aviso agora/.test(await texto(pg, '.avisos-painel')) && (await pg.locator('.avisos-painel [data-aviso]').count()) === 0, 'controle: o painel do sininho abre vazio, com "Nenhum aviso agora"');
  await fecharSino(pg);
  await ir(pg, '/config');
  ok((await pg.locator('.erro-carga[data-aviso]:visible').count()) === 0 && /Feriado de teste/.test(await texto(pg, '.cfg-dias')) && !/Nenhum dia cadastrado/.test(await texto(pg, '.cfg-dias')) && (await pg.locator('[data-lista-parcial]').count()) === 0, 'controle, Configurações sem falha: lista o dia cadastrado e não mostra aviso nem nota de lista incompleta');
  await ctx.close();
}

// ---------- 1) falha só nos dias: barra global, sininho, "lido" não resolve, só a leitura completa resolve ----------
{
  const { ctx, pg, falha } = await novo();
  falha.dias = true;
  await ir(pg, '/agenda');
  ok(falha.vezes >= 1 && (await barra(pg, 'dias').count()) === 1 && (await globais(pg).count()) === 1, 'falha só nos dias: UMA barra global "Os dias indisponíveis não carregaram" (problema que afeta várias telas e se resolve dentro do Dmanda)');
  const textoBarra = await texto(pg, '.erro-carga[data-aviso="dias"]');
  ok(/dias indisponíveis não carregaram/.test(textoBarra) && /a confirmar/.test(textoBarra) && /registro do servidor/.test(textoBarra) && /continuam os que o servidor calculou/.test(textoBarra) && !/Tent(ar|e) de novo/.test(textoBarra), 'a barra diz exatamente o que acontece (vencimentos e retornos continuam os do servidor; a prévia do cadastro fica "a confirmar"; a Agenda pode estar sem os feriados marcados), o que fazer (carregar de novo) e que o detalhe técnico fica no servidor, sem a fórmula genérica "Tentar de novo"');
  const botao = barra(pg, 'dias').locator('button');
  ok((await botao.count()) === 1 && (await botao.innerText()) === 'Carregar os dias de novo', 'a ação é direta e específica: "Carregar os dias de novo"');
  ok((await pg.locator('.agd-cel .agd-it[data-k="demanda"]').count()) > 0 && (await pg.locator('.agd-cel .agd-it[data-k="evento"]').count()) > 0 && (await pg.locator('.agd-aviso-carga').count()) === 0, 'os dados que carregaram (demandas e compromissos) continuam na grade, sem tratar a falha como falha das demandas');
  ok((await marcosRetorno(pg, '2026-11-09')) >= 1 && (await marcosRetorno(pg, FERIADO)) === 0, 'com a lista de dias falhando, o retorno do setor sobre o feriado continua em 09/11: é a data confirmada pelo servidor (a lista local, sem o feriado, o poria em 10/11)');
  ok(/1 problema novo/.test(await rotuloSino(pg)) && (await texto(pg, '.sino-n')) === '1', `o sininho conta o mesmo problema (${await rotuloSino(pg)})`);
  // o mesmo problema em outra tela (a barra é global) e nas outras visões da Agenda
  await pg.click('.agd-barra .opcoes button:has-text("Semana")'); await pg.waitForTimeout(350);
  ok((await barra(pg, 'dias').count()) === 1, 'a barra continua na visão Semana');
  await pg.click('.agd-barra .opcoes button:has-text("Dia")'); await pg.waitForTimeout(350);
  ok((await barra(pg, 'dias').count()) === 1, 'a barra continua na visão Dia');
  await menu(pg, '.navi[data-nav="inicio"]'); await pg.waitForTimeout(900);
  ok(new URL(pg.url()).pathname === '/' && (await barra(pg, 'dias').count()) === 1, 'a barra também aparece no Início (o problema afeta várias telas, então é global)');
  // o painel do sininho: mesmo problema, mesma ação, sem duplicar
  await abrirSino(pg);
  const item = itemSino(pg, 'dias');
  ok((await item.count()) === 1 && (await pg.locator('.avisos-painel [data-aviso]').count()) === 1 && /Os dias indisponíveis não carregaram/.test(await item.innerText()) && (await item.locator('button[data-acao="recarregar"]').innerText()) === 'Carregar os dias de novo' && /Novo/.test(await item.innerText()), 'o painel do sininho lista o mesmo problema uma vez, com a mesma ação e a marca "Novo"');
  // marcar como lido NÃO resolve: a contagem some, o problema e a barra ficam
  await item.locator('button[data-acao="lido"]').click(); await pg.waitForTimeout(250);
  ok(/Avisos: 1 problema em aberto/.test(await rotuloSino(pg)) && (await pg.locator('.sino-n').count()) === 0 && (await barra(pg, 'dias').count()) === 1 && /Lido\. O problema continua/.test(await item.innerText()) && (await item.locator('button[data-acao="lido"]').count()) === 0, 'marcar como lido tira só a contagem do sininho: o problema continua no painel ("Lido. O problema continua") e a barra global segue visível');
  await fecharSino(pg);
  // carregar de novo com a falha ainda ligada: continua um problema só (sem duplicar a cada tentativa)
  await botao.click(); await pg.waitForTimeout(1200);
  await botao.click(); await pg.waitForTimeout(1200);
  await abrirSino(pg);
  ok((await barra(pg, 'dias').count()) === 1 && (await pg.locator('.avisos-painel [data-aviso]').count()) === 1 && /Lido/.test(await itemSino(pg, 'dias').innerText()), 'tentar duas vezes com a falha ligada não duplica a barra nem o aviso do sininho, e o "lido" continua valendo para a mesma causa');
  await fecharSino(pg);
  // resolvido: leitura completa volta, os dois canais se atualizam juntos
  falha.dias = false;
  await botao.click();
  await esperarSem(pg, '.erro-carga[data-aviso="dias"]');
  ok((await pg.locator('.erro-carga[data-aviso]:visible').count()) === 0 && /nenhum agora/.test(await rotuloSino(pg)), 'leitura completa de volta: a barra some e o sininho volta a "nenhum agora" (os dois canais se atualizam juntos)');
  await abrirSino(pg);
  ok((await pg.locator('.avisos-painel [data-aviso]').count()) === 0 && /Nenhum aviso agora/.test(await texto(pg, '.avisos-painel')), 'o painel do sininho também fica sem o problema resolvido');
  await fecharSino(pg);
  // o que foi marcado como lido não sobra para o próximo: se o problema voltar, volta como novo
  // a leitura volta a falhar na mesma sessão (cadastrar um dia relê a lista inteira, e a releitura falha): é um problema novo
  falha.dias = true;
  await menu(pg, '.navi[data-nav="config"]'); await pg.waitForSelector('#cfg-data', { timeout: 60000 });
  await pg.fill('#cfg-data', '2027-06-01'); await pg.fill('#cfg-desc', 'Dia para reabrir o problema'); await pg.click('.cfg-form .btn.pri');
  await pg.waitForFunction(() => document.querySelector('.erro-carga[data-aviso="dias"]'), null, { timeout: 20000 }).catch(() => {});
  ok((await barra(pg, 'dias').count()) === 1 && /1 problema novo/.test(await rotuloSino(pg)), 'se o problema voltar depois de resolvido, volta como novo (a marca de lido do problema anterior não sobra)');
  falha.dias = false;
  await ctx.close();
}

// ---------- 2) falha só nos dias e um cadastro isolado: a lista parcial NÃO vira completa e o aviso fica ----------
{
  const { ctx, pg, falha } = await novo();
  falha.dias = true;
  await ir(pg, '/config');
  let cfg = await texto(pg, '.cfg-dias');
  ok(!/Nenhum dia cadastrado/.test(cfg) && !/Só os fins de semana ajustam/.test(cfg) && (await pg.locator('[data-lista-parcial]').count()) === 1 && /Não dá para dizer quais dias estão cadastrados/.test(await texto(pg, '[data-lista-parcial]')), 'falha nos dias: Configurações NÃO diz "Nenhum dia cadastrado" (seria falso: o dia existe) e explica que não dá para dizer quais estão cadastrados');
  ok((await barra(pg, 'dias').count()) === 1, 'Configurações mostra a mesma barra global (sem uma segunda cópia do aviso dentro da lista)');
  // cadastra UM dia (a gravação funciona; só a releitura da lista inteira continua falhando)
  await pg.fill('#cfg-data', '2026-11-30'); await pg.fill('#cfg-desc', 'Ponto facultativo de teste'); await pg.click('.cfg-form .btn.pri');
  await pg.waitForFunction(() => /Ponto facultativo de teste/.test(document.querySelector('.cfg-dias')?.textContent ?? ''), null, { timeout: 20000 });
  await pg.waitForTimeout(1500);
  cfg = await texto(pg, '.cfg-dias');
  ok(/Ponto facultativo de teste/.test(cfg) && (await barra(pg, 'dias').count()) === 1 && (await pg.locator('[data-lista-parcial]').count()) === 1 && /pode estar incompleta/.test(await texto(pg, '[data-lista-parcial]')), 'cadastrar um dia com a leitura completa ainda falhando: o dia aparece, mas a barra global e a nota de lista incompleta continuam (um cadastro isolado não prova que a lista inteira foi lida)');
  ok(!/Dias cadastrados\s*1\b/.test(await texto(pg, '.cfg-dias-lado h3')) && !/em ordem de data/.test(await texto(pg, '.cfg-dias-lado h3')), 'a quantidade parcial não é mostrada como se fosse o total ("Dias cadastrados 1" não aparece)');
  ok(/1 problema novo/.test(await rotuloSino(pg)), 'o sininho continua com o mesmo problema (não é resolvido por um cadastro isolado)');
  // leitura completa de volta: a lista inteira, sem aviso
  falha.dias = false;
  await barra(pg, 'dias').locator('button').click();
  await esperarSem(pg, '.erro-carga[data-aviso="dias"]');
  cfg = await texto(pg, '.cfg-dias');
  const cab = await texto(pg, '.cfg-dias-lado h3'), nb = await pg.locator('.erro-carga[data-aviso]:visible').count(), np = await pg.locator('[data-lista-parcial]').count();
  ok(nb === 0 && np === 0 && /Feriado de teste/.test(cfg) && /Ponto facultativo de teste/.test(cfg) && /^Dias cadastrados [3-9], em ordem de data/.test(cab.trim()), `leitura completa de volta: aparecem os dois dias (o da semente e o cadastrado), a nota e a barra saem e a contagem volta (3 dias: a semente, o cadastrado aqui e o da seção anterior; barras ${nb}, notas ${np}, cabeçalho "${cab.trim()}", lista "${cfg.replace(/\s+/g, ' ').slice(0, 120)}")`);
  await ctx.close();
}

// ---------- 2b) vencimentos que a tela não conseguiu reler depois de uma mudança no calendário: um problema visível, não só um aviso que some ----------
{
  const { ctx, pg, falha } = await novo();
  await ir(pg, '/config');
  falha.demandas = true;
  await pg.fill('#cfg-data', '2027-07-01'); await pg.fill('#cfg-desc', 'Dia para os vencimentos'); await pg.click('.cfg-form .btn.pri');
  await pg.waitForSelector('.erro-carga[data-aviso="vencimentos"]:visible', { timeout: 20000 }).catch(() => {});
  const v = barra(pg, 'vencimentos');
  ok((await v.count()) === 1 && /vencimentos na tela podem estar desatualizados/.test(await v.innerText()) && (await v.locator('button').innerText()) === 'Carregar as demandas de novo' && /1 problema novo/.test(await rotuloSino(pg)), 'o dia foi gravado, mas a releitura dos vencimentos falhou: a barra global e o sininho dizem que os vencimentos na tela podem estar desatualizados, com o botão para carregar as demandas');
  falha.demandas = false;
  await v.locator('button').click(); await esperarSem(pg, '.erro-carga[data-aviso="vencimentos"]');
  ok((await pg.locator('.erro-carga[data-aviso]:visible').count()) === 0 && /nenhum agora/.test(await rotuloSino(pg)), 'carregadas as demandas de novo, o problema some da barra e do sininho');
  await ctx.close();
}

// ---------- 3) prévia do vencimento no cadastro: com os dias completos mostra o ajuste; com os dias incompletos, "a confirmar" ----------
// A chegada em 31/10/2026 mais 10 dias dá 10/11/2026, o feriado semeado: o vencimento certo é 09/11. Sem a leitura completa dos dias a prévia não pode afirmar isso.
for (const comFalha of [false, true]) {
  const { ctx, pg, falha } = await novo();
  falha.dias = comFalha;
  await ir(pg, '/demandas');
  await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
  await pg.fill('#n-assunto', 'Prévia com ou sem os dias'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
  await pg.fill('#n-chegou', '2026-10-31'); await pg.click('.modal .dias-btns button:has-text("10 dias")'); await pg.waitForTimeout(400);
  const previa = await texto(pg, '.modal .prev-prazo');
  if (!comFalha) ok(!/a confirmar/.test(previa) && /Vencimento antecipado para/.test(previa) && /10\/11 feriado: Feriado de teste/.test(previa) && (await pg.locator('[data-prazo-a-confirmar]').count()) === 0, 'controle, com os dias completos: a prévia mostra o vencimento antecipado e o dia pulado (10/11, feriado)');
  else {
    ok(/Prazo original: /.test(previa) && /Vencimento a confirmar/.test(previa) && !/antecipado/.test(previa) && !/Dias pulados/.test(previa) && (await pg.locator('[data-prazo-a-confirmar]').count()) === 1, 'com os dias incompletos: a prévia mostra só o prazo original e diz "Vencimento a confirmar", sem data presumida (nem "antecipado" nem "dias pulados")');
    // salvar: o vencimento mostrado depois é o do servidor (autoritativo)
    await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-nt', { timeout: 20000 });
    const gravado = await pg.evaluate(async () => (await (await fetch('/api/exportar', { cache: 'no-store' })).json()).demandas.find((d) => d.assunto === 'Prévia com ou sem os dias'));
    ok(gravado && gravado.prazo_original === '2026-11-10' && gravado.prazo === '2026-11-09' && /10\/11 feriado: Feriado de teste/.test(gravado.prazo_ajuste), 'salvar com os dias incompletos: o servidor calcula e grava o vencimento certo (original 10/11, vencimento 09/11), que é o que vale (a prévia não decidia nada)');
  }
  await ctx.close();
}

// ---------- 4) problema localizado: os eventos, só na Agenda e no sininho (não na barra global) ----------
{
  const { ctx, pg, falha } = await novo();
  falha.eventos = true;
  await ir(pg, '/agenda');
  ok((await barra(pg, 'eventos').count()) === 1 && (await barra(pg, 'eventos').getAttribute('data-escopo')) === 'tela' && (await globais(pg).count()) === 0, 'falha só nos eventos: aviso na tela da Agenda (problema localizado) e nenhuma barra global');
  ok(/compromissos e os avisos de hoje ficam de fora da Agenda/.test(await texto(pg, '.erro-carga[data-aviso="eventos"]')) && (await barra(pg, 'eventos').locator('button').innerText()) === 'Carregar os eventos de novo', 'o aviso da Agenda diz o que fica de fora e oferece "Carregar os eventos de novo"');
  await abrirSino(pg);
  ok((await itemSino(pg, 'eventos').count()) === 1 && (await itemSino(pg, 'eventos').getAttribute('data-escopo')) === 'tela' && /1 problema novo/.test(await rotuloSino(pg)), 'o sininho também lista o problema localizado (uma vez)');
  await fecharSino(pg);
  await menu(pg, '.navi[data-nav="config"]'); await pg.waitForSelector('#cfg-data', { timeout: 60000 }); await pg.waitForTimeout(500);
  ok((await pg.locator('.erro-carga[data-aviso]:visible').count()) === 0 && /1 problema novo/.test(await rotuloSino(pg)), 'em outra tela o aviso localizado não aparece (só o sininho segue contando)');
  await menu(pg, '.navi[data-nav="agenda"]'); await pg.waitForSelector('.erro-carga[data-aviso="eventos"]', { timeout: 60000 }); await pg.waitForTimeout(500);
  falha.eventos = false;
  await barra(pg, 'eventos').locator('button').click();
  await esperarSem(pg, '.erro-carga[data-aviso="eventos"]');
  ok((await pg.locator('.erro-carga[data-aviso]:visible').count()) === 0 && /nenhum agora/.test(await rotuloSino(pg)), 'eventos de volta: o aviso da tela e o do sininho saem juntos');
  await ctx.close();
}

// ---------- 5) vários problemas independentes e a falta de conexão ----------
{
  const { ctx, pg, falha } = await novo();
  falha.dias = true; falha.eventos = true;
  await ir(pg, '/agenda');
  ok((await barra(pg, 'dias').count()) === 1 && (await barra(pg, 'eventos').count()) === 1 && /2 problemas novos/.test(await rotuloSino(pg)), 'dois problemas independentes aparecem separados (dias na barra global, eventos na tela) e o sininho conta os dois');
  await abrirSino(pg); await itemSino(pg, 'dias').locator('button[data-acao="lido"]').click(); await pg.waitForTimeout(200);
  ok(/Avisos: 1 problema novo/.test(await rotuloSino(pg)) && (await itemSino(pg, 'eventos').locator('button[data-acao="lido"]').count()) === 1, 'marcar um como lido preserva o outro, que segue não lido');
  falha.dias = false; await fecharSino(pg);
  await barra(pg, 'dias').locator('button').click(); await esperarSem(pg, '.erro-carga[data-aviso="dias"]');
  ok((await barra(pg, 'dias').count()) === 0 && (await barra(pg, 'eventos').count()) === 1 && /1 problema novo/.test(await rotuloSino(pg)), 'resolver um problema preserva o aviso do outro, independente');
  await ctx.close();
}
{
  const { ctx, pg, falha } = await novo();
  falha.rede = true;
  await ir(pg, '/agenda');
  ok((await barra(pg, 'conexao').count()) === 1 && (await pg.locator('.erro-carga[data-aviso]:visible').count()) === 1, 'sem conexão em todas as leituras: UM problema (conexão), e não um aviso por leitura');
  await abrirSino(pg);
  ok((await pg.locator('.avisos-painel [data-aviso]').count()) === 1 && /as demandas, os dias indisponíveis, os eventos da Agenda, as entradas/.test(await itemSino(pg, 'conexao').innerText()) && /1 problema novo/.test(await rotuloSino(pg)), 'o sininho tem o mesmo único problema, dizendo o que não carregou');
  await fecharSino(pg);
  falha.rede = false;
  await barra(pg, 'conexao').locator('button').click();
  await esperarSem(pg, '.erro-carga[data-aviso]');
  ok((await pg.locator('.erro-carga[data-aviso]:visible').count()) === 0 && (await FERIADO_MARCADO(pg)) === 'true' && /nenhum agora/.test(await rotuloSino(pg)), '"Carregar tudo de novo" recarrega todas as leituras: o problema some dos dois canais e o feriado volta à grade');
  await ctx.close();
}

// ---------- 6) a barra e o painel renderizados: visíveis, inteiros na tela, legíveis, nos dois temas, em computador e iPhone; teclado e foco ----------
mkdirSync('.dados-teste/falha-dias-capturas', { recursive: true });
const medir = (e) => {
  const r = e.getBoundingClientRect(), rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = ([r1, g, b1]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r1) + 0.7152 * f(g) + 0.0722 * f(b1); };
  const fundo = (() => { let n = e; while (n) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c; n = n.parentElement; } return [255, 255, 255]; })();
  const alvo = e.querySelector('span, b'), l1 = lum(rgb(getComputedStyle(alvo).color)), l2 = lum(fundo);
  const b = e.querySelector('button')?.getBoundingClientRect();
  return { visivel: r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden', dentro: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5, rolagemH: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, botao: b ? Math.round(b.height) : 0, contraste: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) };
};
for (const [rotuloTela, viewport] of [['computador 1360', { width: 1360, height: 900 }], ['iPhone 390', { width: 390, height: 844 }], ['iPhone 320', { width: 320, height: 700 }]]) {
  for (const tema of ['claro', 'escuro']) {
    const { ctx, pg, falha } = await novo(viewport, tema);
    falha.dias = true; falha.eventos = true;
    for (const rota of ['/agenda', '/config']) {
      await ir(pg, rota);
      const m = await barra(pg, 'dias').first().evaluate(medir);
      ok(m.visivel && !m.rolagemH && m.botao >= 28, `${rotuloTela}, ${tema}, ${rota}: a barra global está visível, sem rolagem horizontal (botão com ${m.botao} px de altura)`);
      ok(m.contraste >= 4.5, `${rotuloTela}, ${tema}, ${rota}: o texto da barra tem contraste ${m.contraste.toFixed(1)}:1 (mínimo 4,5:1)`);
      await pg.screenshot({ path: `.dados-teste/falha-dias-capturas/${rota.slice(1)}-barra-${rotuloTela.split(' ')[0]}${viewport.width === 320 ? '320' : ''}-${tema}.png`, fullPage: false });
      await abrirSino(pg);
      const p = await pg.locator('.avisos-painel').evaluate((e) => { const r = e.getBoundingClientRect(); return { dentro: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5, rolagemH: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, largura: Math.round(r.width) }; });
      const mi = await itemSino(pg, 'dias').evaluate(medir);
      ok(mi.visivel && p.dentro && !p.rolagemH, `${rotuloTela}, ${tema}, ${rota}: o painel do sininho cabe na tela (${p.largura} px de largura) e não cria rolagem horizontal`);
      ok(mi.contraste >= 4.5, `${rotuloTela}, ${tema}, ${rota}: o texto do aviso no sininho tem contraste ${mi.contraste.toFixed(1)}:1`);
      await pg.screenshot({ path: `.dados-teste/falha-dias-capturas/${rota.slice(1)}-sino-${rotuloTela.split(' ')[0]}${viewport.width === 320 ? '320' : ''}-${tema}.png`, fullPage: false });
      await fecharSino(pg);
    }
    await ctx.close();
  }
}
// teclado e foco: Enter abre, o foco entra no painel, o Tab circula dentro dele e o Esc fecha e devolve o foco ao sininho
{
  const { ctx, pg, falha } = await novo();
  falha.dias = true;
  await ir(pg, '/agenda');
  await pg.focus('.sino'); await pg.keyboard.press('Enter'); await pg.waitForSelector('.avisos-painel');
  const dentro = () => pg.evaluate(() => !!document.activeElement?.closest('.avisos-painel'));
  ok(await dentro(), 'teclado: Enter no sininho abre o painel e o foco entra nele');
  const passos = [];
  for (let i = 0; i < 6; i++) { await pg.keyboard.press('Tab'); passos.push(await dentro()); }
  ok(passos.every(Boolean), 'teclado: Tab circula só entre os botões do painel (não escapa para a página)');
  await pg.keyboard.press('Shift+Tab'); ok(await dentro(), 'teclado: Shift+Tab também circula dentro do painel');
  await pg.keyboard.press('Escape'); await pg.waitForSelector('.avisos-painel', { state: 'detached' }); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => document.activeElement?.classList.contains('sino')), 'teclado: Esc fecha o painel e devolve o foco ao sininho');
  await pg.click('.sino'); await pg.waitForSelector('.avisos-painel'); await pg.mouse.click(300, 600); await aguardar(pg.waitForSelector('.avisos-painel', { state: 'detached' }), 'clicar fora do painel fecha');
  await ctx.close();
}

ok(erros.length === 0, 'nenhum erro de página nem de console' + (erros.length ? ': ' + JSON.stringify(erros.slice(0, 4)) : ''));
await nav.close(); parar();
process.exit(resumo());
