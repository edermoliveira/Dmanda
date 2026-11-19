// Períodos de indisponibilidade no aplicativo (subbloco 1.4): cadastro de um dia e de um período (curso, semana, recesso, virada do ano), intervalo inválido corrigido pela pessoa, falha e resposta perdida sem
// perder o que foi digitado nem duplicar, edição e exclusão com o recálculo dos vencimentos, e a consistência do servidor com a Agenda, o Início, os Cards e a prévia do cadastro.
// O critério obrigatório: chegada em 14/12/2026 + 15 dias corridos = 29/12; indisponibilidade de 24/12 a 29/12 e 23/12 livre: vencimento efetivo 23/12, original preservado.
// Navegador (Edge) com banco de teste (PGlite) semeado aqui; porta 7143; dados fictícios. NÃO valida o Supabase real nem aparelho físico.
// Uso: node scripts/testar-periodos.mjs
import { rmSync, mkdirSync } from 'node:fs';
import { abrirEdge, criarVerificador, instanteDaReferencia, iniciarServidor, novoContexto, semearBanco } from './auxiliar-navegador.mjs';
import { ajustarPrazo, dataComSemana } from '../src/lib/prazos.ts';

const PORTA = process.env.PORTA_TESTE_PERIODOS || '7143', BASE = `http://localhost:${PORTA}`, PASTA = '.dados-teste/periodos';
rmSync(PASTA, { recursive: true, force: true }); mkdirSync('.dados-teste', { recursive: true });
const REFERENCIA = '2026-12-17';   // quinta-feira: 23/12 está a 6 dias (grupo "vencem em 7 dias") e 29/12 a 12
await semearBanco(PASTA, async (c) => {
  await c('criar_demanda', { p: { assunto: 'Exemplo 14/12', tipo: 'Memorando', chegou_em: '2026-12-14', prazo_dias: 15 } });
  const b = await c('criar_demanda', { p: { assunto: 'Retorno no recesso', tipo: 'Memorando', etapa: 'Aguardando retorno', setor: 'PGM' } });
  await c('atualizar_demanda', { p_id: b.id, p: { encaminhada_em: '2026-12-19' } });
  await c('criar_demanda', { p: { assunto: 'Vence no ano novo', tipo: 'Memorando', prazo_original: '2027-01-04' } });
});
const INSTANTE = instanteDaReferencia(REFERENCIA);
const { parar } = await iniciarServidor({ porta: PORTA, pasta: PASTA });
const { ok, resumo } = criarVerificador();

const nav = await abrirEdge();
const erros = [];
// falha.abortarAntes: o pedido nem chega ao servidor; falha.perderResposta: o servidor recebe e grava, mas a resposta não chega ao navegador (as duas deixam o resultado incerto para a tela)
const novo = async (viewport = { width: 1360, height: 900 }, tema = 'claro') => {
  const { ctx, pg } = await novoContexto(nav, { opcoes: { viewport }, instante: INSTANTE, tema, agenda: { modo: 'mes', cat: 'tudo' }, erros });
  const falha = { perderResposta: false, abortarAntes: false, reter: false, guardado: null };
  // `perderResposta`: o servidor recebe e grava, mas a resposta não chega ao navegador (a falha que mais pode duplicar)
  await pg.route('**/*', async (route) => {
    const q = route.request();
    // falha.reter: o pedido NÃO chega agora (a tela vê a falha), mas é guardado para o teste entregá-lo ao servidor DEPOIS, como um pedido atrasado na rede
    if (falha.reter && q.method() === 'POST' && q.headers()['next-action']) { falha.guardado = { url: q.url(), headers: await q.allHeaders(), body: q.postDataBuffer() }; await route.abort('failed'); return; }
    if ((falha.perderResposta || falha.abortarAntes) && q.method() === 'POST' && q.headers()['next-action']) { if (falha.perderResposta) await route.fetch(); falha.perdidas = (falha.perdidas ?? 0) + 1; await route.abort('failed'); return; }
    await route.continue();
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
const exportar = (pg) => pg.evaluate(async () => (await (await fetch('/api/exportar', { cache: 'no-store' })).json()));
const porAssunto = (c, a) => c.demandas.find((d) => d.assunto === a);
const aviso = (pg) => pg.waitForFunction(() => document.querySelector('#toast.on')?.textContent || '', null, { timeout: 20000 }).then((h) => h.jsonValue());
// espera o aviso anterior sumir: senão a leitura do aviso pegaria o do cadastro anterior
const avisoSumiu = (pg) => pg.waitForFunction(() => !document.querySelector('#toast.on'), null, { timeout: 8000 }).catch(() => {});
// espera um aviso com o texto esperado (a conferência que antecede a gravação mostra o próprio aviso antes do de "Período cadastrado")
const avisoComo = (pg, re) => pg.waitForFunction((s) => { const t = document.querySelector('#toast.on')?.textContent || ''; return new RegExp(s).test(t) ? t : ''; }, re.source, { timeout: 20000 }).then((h) => h.jsonValue());
const salvarCfg = async (pg) => { await avisoSumiu(pg); await pg.click('.cfg-form .btn.pri'); };
const consistente = (c) => c.demandas.filter((d) => d.etapa !== 'Finalizado' && d.prazo_original).every((d) => { const t = ajustarPrazo(d.prazo_original, c.dias_indisponiveis); return d.prazo === t.prazo && (d.prazo_ajuste ?? null) === (t.ajuste ?? null); });
const abrirSino = async (pg) => { if (!(await pg.locator('.avisos-painel').count())) { await pg.click('.sino'); await pg.waitForSelector('.avisos-painel', { timeout: 5000 }); } };
const fecharSino = async (pg) => { if (await pg.locator('.avisos-painel').count()) { await pg.keyboard.press('Escape'); await pg.waitForSelector('.avisos-painel', { state: 'detached', timeout: 5000 }); } };
const contar = async (pg, desc) => (await exportar(pg)).dias_indisponiveis.filter((x) => x.descricao === desc).length;
const incerta = (pg) => pg.locator('.erro-carga[data-aviso^="periodo-"]:visible');
const campos = (pg) => pg.evaluate(() => ({ d: document.querySelector('#cfg-data').value, f: document.querySelector('#cfg-fim').value, t: document.querySelector('#cfg-desc').value }));
const limpar = async (pg) => { await pg.fill('#cfg-data', ''); await pg.fill('#cfg-fim', ''); await pg.fill('#cfg-desc', ''); };
const esperarAlerta = (pg, re) => pg.waitForFunction((s) => new RegExp(s).test(document.querySelector('.cfg-form [role="alert"]')?.textContent ?? ''), re, { timeout: 20000 });
const cfgPeriodo = async (pg, ini, fim, desc, cat) => { await pg.fill('#cfg-data', ini); await pg.fill('#cfg-fim', fim); await pg.fill('#cfg-desc', desc); if (cat) await pg.selectOption('#cfg-cat', cat); };
const marcos = (pg, dia, marco) => pg.locator(`.agd-cel[data-data="${dia}"] .agd-it[data-k="demanda"][data-marco="${marco}"]`).count();

const { ctx, pg, falha } = await novo();
await ir(pg, '/');
const stat = () => texto(pg, '.stat.st-sete .n');
ok((await stat()) === '0', 'antes do período: nada vence nos próximos 7 dias no Início (o vencimento e o retorno do setor estão em 29/12, a 12 dias)');
let ex = await exportar(pg);
ok(porAssunto(ex, 'Exemplo 14/12').prazo_original === '2026-12-29' && porAssunto(ex, 'Exemplo 14/12').prazo === '2026-12-29', 'chegada em 14/12/2026 mais 15 dias corridos: o vencimento original e o efetivo são 29/12/2026');
await menu(pg, '.navi[data-nav="agenda"]'); await pg.waitForSelector('.agd-cel[data-data="2026-12-29"]'); await pg.waitForTimeout(800);
ok((await marcos(pg, '2026-12-29', 'vencimento')) === 1 && (await marcos(pg, '2026-12-29', 'retorno')) === 1, 'Agenda antes: 29/12 tem o vencimento do exemplo e o retorno do setor (19/12 + 10 dias)');

// ---------- 1) o período em Configurações: o critério obrigatório ----------
await menu(pg, '.navi[data-nav="config"]'); await pg.waitForSelector('#cfg-data'); await pg.waitForTimeout(500);
ok(/Data inicial/.test(await texto(pg, 'label[for="cfg-data"]')) && /Data final/.test(await texto(pg, 'label[for="cfg-fim"]')) && /opcional/.test(await texto(pg, 'label[for="cfg-fim"]')) && (await texto(pg, '.cfg-form .btn.pri')) === 'Cadastrar dia', 'o formulário tem Data inicial e Data final (opcional); sem data final o botão continua "Cadastrar dia"');
await cfgPeriodo(pg, '2026-12-24', '2026-12-29', 'Recesso de fim de ano');
await pg.waitForTimeout(200);
ok(/Período de qui, 24\/12\/2026 a ter, 29\/12\/2026: 6 dias/.test(await texto(pg, '[data-periodo-resumo]')) && (await texto(pg, '.cfg-form .btn.pri')) === 'Cadastrar período', 'ao preencher a data final, o formulário resume o período (6 dias, com os fins de semana) e o botão vira "Cadastrar período"');
await salvarCfg(pg);
const t1 = await aviso(pg);
ok(/Período cadastrado: 6 dias/.test(t1) && /recalculado/.test(t1), `o aviso só aparece depois da confirmação do banco e diz o que houve (${t1})`);
await pg.waitForFunction(() => document.querySelectorAll('.cfg-lista li[data-periodo="sim"]').length === 1, null, { timeout: 15000 });
const item = pg.locator('.cfg-lista li[data-periodo="sim"]').first();
ok(/qui, 24\/12\/2026 a ter, 29\/12\/2026/.test(await item.innerText()) && /Feriado, 6 dias/.test(await item.innerText()) && (await pg.locator('.cfg-lista li').count()) === 1, 'a lista mostra UM item para o período (início a fim, tipo e 6 dias), e não seis linhas');
ex = await exportar(pg);
const A = porAssunto(ex, 'Exemplo 14/12');
ok(A.prazo_original === '2026-12-29' && A.prazo === '2026-12-23' && /^29\/12 feriado: Recesso de fim de ano;/.test(A.prazo_ajuste) && ex.dias_indisponiveis.length === 6 && consistente(ex), `servidor: o vencimento efetivo recuou para 23/12 e o original (29/12) foi preservado, com o motivo de cada dia (${A.prazo_original} -> ${A.prazo})`);

// consistência: Agenda, Início, Cards e prévia do cadastro mostram o mesmo que o servidor
await menu(pg, '.navi[data-nav="agenda"]'); await pg.waitForSelector('.agd-cel[data-data="2026-12-23"]'); await pg.waitForTimeout(800);
ok((await marcos(pg, '2026-12-23', 'vencimento')) === 1 && (await marcos(pg, '2026-12-23', 'retorno')) === 1 && (await marcos(pg, '2026-12-29', 'vencimento')) === 0 && (await marcos(pg, '2026-12-29', 'retorno')) === 0, 'Agenda: o vencimento e o retorno do setor aparecem em 23/12 e saíram de 29/12');
ok((await pg.locator('.agd-cel[data-data="2026-12-27"]').getAttribute('data-feriado')) === 'true' && (await pg.locator('.agd-cel[data-data="2026-12-29"]').getAttribute('data-feriado')) === 'true', 'Agenda: os dias do período aparecem marcados como indisponíveis na grade');
await menu(pg, '.navi[data-nav="inicio"]'); await pg.waitForTimeout(900);
ok((await stat()) === '2', `Início: agora dois itens vencem nos próximos 7 dias (o exemplo e o retorno do setor), porque passaram para 23/12 (${await stat()})`);
await menu(pg, '.navi[data-nav="demandas"]'); await pg.waitForSelector('.dcard', { timeout: 15000 });
const cartao = pg.locator('.dcard', { hasText: 'Exemplo 14/12' }).first();
const textoCartao = (await cartao.innerText()).replace(/\s+/g, ' ');
ok(/23 dez · faltam 6 d/.test(textoCartao) && !/29 dez/.test(textoCartao.slice(0, 60)), `Cards: o card do exemplo mostra o vencimento 23/12 (${textoCartao.slice(0, 180)})`);
await pg.click('.toolbar .btn.escuro'); await pg.waitForSelector('#n-assunto');
await pg.fill('#n-assunto', 'Cópia do exemplo'); await pg.click('.modal .btn.pri'); await pg.waitForSelector('#n-chegou');
await pg.fill('#n-chegou', '2026-12-14'); await pg.click('.modal .dias-btns button:has-text("20 dias")'); await pg.click('.modal .dias-btns button:has-text("5 dias")'); await pg.waitForTimeout(300);
await pg.fill('#n-prazo', '2026-12-29'); await pg.waitForTimeout(300);
const previa = await texto(pg, '.modal .prev-prazo');
ok(previa.includes(`Vencimento antecipado para ${dataComSemana('2026-12-23')}`) && previa.includes(`Dias pulados: ${A.prazo_ajuste}.`) && !/a confirmar/.test(previa), 'prévia do cadastro: com a mesma data original (29/12), mostra o mesmo vencimento (23/12) e o mesmo texto de dias pulados que o servidor gravou');
await pg.click('.modal .btn:has-text("Cancelar")').catch(() => {}); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);

// ---------- 2) intervalo inválido, corrigido pela pessoa, sem perder o que foi digitado ----------
await menu(pg, '.navi[data-nav="config"]'); await pg.waitForSelector('#cfg-data'); await pg.waitForTimeout(400);
const antes = (await exportar(pg)).dias_indisponiveis.length;
await cfgPeriodo(pg, '2027-02-10', '2027-02-08', 'Curso de teste');
await pg.waitForTimeout(200);
ok(/A data final não pode ser anterior à data inicial/.test(await texto(pg, '[data-periodo-resumo]')) && (await pg.getAttribute('#cfg-fim', 'aria-invalid')) === 'true', 'intervalo invertido: o formulário já diz "A data final não pode ser anterior à data inicial" e marca a data final como inválida');
await salvarCfg(pg); await pg.waitForTimeout(500);
ok(/A data final não pode ser anterior à data inicial/.test(await texto(pg, '.cfg-form [role="alert"]')) && (await pg.inputValue('#cfg-data')) === '2027-02-10' && (await pg.inputValue('#cfg-fim')) === '2027-02-08' && (await pg.inputValue('#cfg-desc')) === 'Curso de teste' && (await exportar(pg)).dias_indisponiveis.length === antes, 'ao enviar, a mensagem aparece, os três campos continuam preenchidos e nada foi gravado');
ok(await pg.evaluate(() => document.activeElement?.id === 'cfg-fim'), 'o foco vai para a data final, o campo a corrigir');
await pg.fill('#cfg-fim', '2027-02-12'); await pg.waitForTimeout(200);
ok((await pg.locator('.cfg-form [role="alert"]').count()) === 0 && !/anterior/.test(await texto(pg, '[data-periodo-resumo]')) && /3 dias/.test(await texto(pg, '[data-periodo-resumo]')), 'corrigida a data final, a mensagem some e o resumo mostra 3 dias');
await salvarCfg(pg); await aviso(pg);
await pg.waitForFunction(() => /Curso de teste/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
ok((await exportar(pg)).dias_indisponiveis.length === antes + 3, 'depois da correção o curso de três dias é gravado (uma vez)');

// ---------- 3) um dia só continua funcionando ----------
await pg.fill('#cfg-data', '2027-03-10'); await pg.fill('#cfg-desc', 'Dia avulso de teste');
ok((await texto(pg, '.cfg-form .btn.pri')) === 'Cadastrar dia' && (await pg.locator('[data-periodo-resumo]').count()) === 0, 'um dia só: sem data final, o botão é "Cadastrar dia" e não há resumo de período');
await salvarCfg(pg); const t3 = await aviso(pg);
ok(/Dia cadastrado/.test(t3), `um dia só: cadastro de um único dia (${t3})`);
ex = await exportar(pg);
const avulso = ex.dias_indisponiveis.find((x) => x.descricao === 'Dia avulso de teste');
const itemDia = pg.locator('.cfg-lista li', { hasText: 'Dia avulso de teste' });
ok(!!avulso && typeof avulso.periodo_id === 'string' && ex.dias_indisponiveis.length === antes + 4 && (await itemDia.getAttribute('data-periodo')) === null && !/ a /.test(await itemDia.locator('.cfg-dia').innerText()) && !/dias?$/.test((await itemDia.locator('.cfg-tipo').innerText()).trim()), 'um dia cadastrado é um período de um dia (uma linha com periodo_id, a chave opcional da cópia v4) e a lista o mostra como um dia, não como período');

// ---------- 3b) um período sobre um dia avulso: o intervalo fica íntegro, cada registro é independente ----------
await pg.fill('#cfg-data', '2027-06-02'); await pg.fill('#cfg-desc', 'Dia avulso sobreposto'); await salvarCfg(pg); await aviso(pg);
await cfgPeriodo(pg, '2027-06-01', '2027-06-04', 'Curso sobreposto'); await salvarCfg(pg); const t3b = await aviso(pg);
await pg.waitForFunction(() => /Curso sobreposto/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
const itemSob = pg.locator('.cfg-lista li', { hasText: 'Curso sobreposto' });
ex = await exportar(pg);
const diasSob = ex.dias_indisponiveis.filter((x) => x.descricao === 'Curso sobreposto').map((x) => x.data).sort();
ok(/Período gravado|Período cadastrado: 4 dias/.test(t3b) && diasSob.join() === '2027-06-01,2027-06-02,2027-06-03,2027-06-04' && !/já estava/.test(t3b) && /ter, 01\/06\/2027 a sex, 04\/06\/2027/.test(await itemSob.innerText()) && /4 dias/.test(await itemSob.innerText()), `sobreposição: o período de 01/06 a 04/06 sobre o dia avulso de 02/06 é cadastrado por inteiro (4 dias) e continua 01/06 a 04/06 na lista (${t3b})`);
ok((await pg.locator('.cfg-lista li', { hasText: 'Dia avulso sobreposto' }).count()) === 1 && ex.dias_indisponiveis.filter((x) => x.data === '2027-06-02').length === 2, 'sobreposição: o dia avulso segue como item próprio na lista (dois registros em 02/06, um de cada origem)');
await itemSob.locator('button[aria-label^="Editar"]').click(); await pg.waitForTimeout(300);
ok((await pg.inputValue('#cfg-data')) === '2027-06-01' && (await pg.inputValue('#cfg-fim')) === '2027-06-04' && /Alterar período indisponível/.test(await texto(pg, '#cfg-novo-t')), 'sobreposição: editar o período carrega o intervalo inteiro, as datas inicial e final não desaparecem');
await pg.click('.cfg-form .btn:has-text("Cancelar")'); await pg.waitForTimeout(200);
await pg.locator('.cfg-lista li', { hasText: 'Dia avulso sobreposto' }).locator('button[aria-label^="Excluir"]').click(); await avisoSumiu(pg);
await pg.locator('.cfg-confirma button:has-text("Confirmar exclusão")').click(); await aviso(pg);
await pg.waitForFunction(() => !/Dia avulso sobreposto/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
ex = await exportar(pg);
ok(ex.dias_indisponiveis.filter((x) => x.data === '2027-06-02').length === 1 && (await contar(pg, 'Curso sobreposto')) === 4 && consistente(ex), 'sobreposição: excluir o dia avulso não elimina a indisponibilidade de 02/06, que o período ainda sustenta; o período segue com os 4 dias');

// ---------- 4) recesso que atravessa dezembro e janeiro ----------
await cfgPeriodo(pg, '2026-12-30', '2027-01-04', 'Recesso da virada');
await pg.waitForTimeout(200);
ok(/Período de .*30\/12\/2026 a .*04\/01\/2027: 6 dias/.test(await texto(pg, '[data-periodo-resumo]')), 'o resumo atravessa o ano (30/12/2026 a 04/01/2027, 6 dias)');
await salvarCfg(pg); await aviso(pg);
await pg.waitForFunction(() => /Recesso da virada/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
ex = await exportar(pg);
const C = porAssunto(ex, 'Vence no ano novo');
ok(C.prazo_original === '2027-01-04' && C.prazo === '2026-12-23' && consistente(ex), `recesso na virada do ano encadeado ao anterior: o vencimento de 04/01/2027 recua até 23/12/2026 e o servidor coincide com o cálculo da prévia para toda demanda aberta (${C.prazo})`);

// ---------- 5) resultado incerto: a identidade da OPERAÇÃO é uma e a do PERÍODO é outra ----------
// Falha antes da gravação, gravação com a resposta perdida, repetição da mesma tentativa, outro período depois de um resultado incerto e correção do preenchimento: nada é confirmado sem a resposta do banco,
// nada é sobrescrito nem duplicado em silêncio, o preenchimento fica, e há uma ação concreta (Conferir se foi gravado) na barra e no sininho.
const semSucesso = async (pg) => !/Período cadastrado/.test(await texto(pg, '#toast'));
{ // (a) falha ANTES da gravação: o pedido não chega; conferir diz que não foi gravado; salvar de novo grava uma vez
  await cfgPeriodo(pg, '2027-04-12', '2027-04-14', 'Curso A antes');
  falha.abortarAntes = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.abortarAntes = false;
  const c = await campos(pg);
  ok((await contar(pg, 'Curso A antes')) === 0 && (await incerta(pg).count()) === 1 && /Conferir se foi gravado/.test(await incerta(pg).innerText()) && await semSucesso(pg) && c.d === '2027-04-12' && c.f === '2027-04-14' && c.t === 'Curso A antes', 'incerto (a), falha antes da gravação: nada foi gravado, o resultado NÃO é confirmado, a barra oferece "Conferir se foi gravado" e o preenchimento fica');
  await abrirSino(pg);
  ok((await pg.locator('.avisos-painel [data-aviso^="periodo-"]').count()) === 1 && /1 problema novo/.test(await pg.getAttribute('.sino', 'aria-label')), 'incerto (a): o sininho mostra o mesmo problema (uma vez)'); await fecharSino(pg);
  await avisoSumiu(pg); await incerta(pg).locator('button').click(); const tc = await aviso(pg);
  ok(/Conferido: não foi gravado/.test(tc) && (await incerta(pg).count()) === 0 && (await contar(pg, 'Curso A antes')) === 0 && (await campos(pg)).t === 'Curso A antes', `incerto (a): conferir pela identidade da operação diz que NÃO foi gravado, a barra some e o preenchimento continua (${tc})`);
  await salvarCfg(pg); const ta = await aviso(pg);
  ok(/Período cadastrado: 3 dias/.test(ta) && (await contar(pg, 'Curso A antes')) === 3, 'incerto (a): salvar de novo grava o período uma vez e só então confirma "Período cadastrado"');
}
{ // (b) gravação CONCLUÍDA com a resposta perdida: conferir pela barra encontra a operação, sem duplicar
  await cfgPeriodo(pg, '2027-04-19', '2027-04-21', 'Curso B perdido');
  falha.perderResposta = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.perderResposta = false;
  ok((await contar(pg, 'Curso B perdido')) === 3 && (await incerta(pg).count()) === 1 && await semSucesso(pg) && (await campos(pg)).t === 'Curso B perdido', 'incerto (b), resposta perdida: o servidor gravou, a tela NÃO confirma, mostra o problema incerto e guarda o preenchimento');
  await avisoSumiu(pg); await incerta(pg).locator('button').click(); const tb = await aviso(pg);
  await pg.waitForFunction(() => /Curso B perdido/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
  ok(/Conferido: foi gravado/.test(tb) && (await incerta(pg).count()) === 0 && (await contar(pg, 'Curso B perdido')) === 3 && (await pg.locator('.cfg-lista li', { hasText: 'Curso B perdido' }).count()) === 1 && consistente(await exportar(pg)), `incerto (b): conferir encontra a operação, a lista mostra o período uma vez e os vencimentos foram relidos (${tb})`);
  await limpar(pg);
}
{ // (c) repetir a MESMA tentativa sem conferir: o Dmanda confere antes e não grava de novo
  await cfgPeriodo(pg, '2027-04-26', '2027-04-28', 'Curso C repetido');
  falha.perderResposta = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.perderResposta = false;
  await salvarCfg(pg); await esperarAlerta(pg, 'tinha sido gravado');
  const c = await campos(pg);
  ok((await contar(pg, 'Curso C repetido')) === 3 && (await incerta(pg).count()) === 0 && /Curso C repetido \(26\/04\/2027 a 28\/04\/2027\)/.test(await texto(pg, '.cfg-form [role="alert"]')) && await semSucesso(pg) && c.t === 'Curso C repetido', 'incerto (c), repetição: salvar de novo confere antes, descobre que o período foi gravado, NÃO grava um segundo, não confirma "cadastrado" e mantém o preenchimento');
  await limpar(pg);
}
{ // (d) OUTRO período (B) depois de um resultado incerto de A: B nunca herda a identidade de A nem o substitui
  await cfgPeriodo(pg, '2027-05-03', '2027-05-05', 'Curso D1');
  falha.perderResposta = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.perderResposta = false;
  await cfgPeriodo(pg, '2027-05-10', '2027-05-12', 'Curso D2');
  await salvarCfg(pg); await esperarAlerta(pg, 'tinha sido gravado');
  ok((await contar(pg, 'Curso D1')) === 3 && (await contar(pg, 'Curso D2')) === 0 && /Curso D1/.test(await texto(pg, '.cfg-form [role="alert"]')) && /ainda NÃO foi gravado/.test(await texto(pg, '.cfg-form [role="alert"]')) && (await campos(pg)).t === 'Curso D2', 'incerto (d): B depois de A incerto: o Dmanda confere A (gravado), avisa, NÃO grava B ainda e mantém o preenchimento de B; A fica intacto');
  await salvarCfg(pg); const td = await aviso(pg);
  await pg.waitForFunction(() => /Curso D2/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
  const e = await exportar(pg), idsD = (d) => [...new Set(e.dias_indisponiveis.filter((x) => x.descricao === d).map((x) => x.periodo_id))];
  const dd1 = e.dias_indisponiveis.filter((x) => x.descricao === 'Curso D1').map((x) => x.data).sort(), dd2 = e.dias_indisponiveis.filter((x) => x.descricao === 'Curso D2').map((x) => x.data).sort();
  ok(/Período cadastrado: 3 dias/.test(td) && idsD('Curso D1').length === 1 && idsD('Curso D2').length === 1 && idsD('Curso D1')[0] !== idsD('Curso D2')[0] && dd1.join() === '2027-05-03,2027-05-04,2027-05-05' && dd2.join() === '2027-05-10,2027-05-11,2027-05-12', 'incerto (d): ao salvar de novo, B é um período NOVO (identidade própria), e A segue exatamente 03/05 a 05/05: dois períodos, nenhum sobrescrito');
}
{ // (e) correção do preenchimento depois de uma falha antes da gravação: grava uma vez, com o preenchimento corrigido
  await cfgPeriodo(pg, '2027-05-17', '2027-05-19', 'Curso E');
  falha.abortarAntes = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.abortarAntes = false;
  await pg.fill('#cfg-fim', '2027-05-20'); await salvarCfg(pg); const te = await avisoComo(pg, /Período cadastrado/);
  await pg.waitForFunction(() => /Curso E/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
  const ex5 = await exportar(pg), de = ex5.dias_indisponiveis.filter((x) => x.descricao === 'Curso E').map((x) => x.data).sort();
  ok(/Período cadastrado: 4 dias/.test(te) && de.join() === '2027-05-17,2027-05-18,2027-05-19,2027-05-20' && (await incerta(pg).count()) === 0 && consistente(ex5), 'incerto (e), correção: depois de uma falha antes da gravação, corrigir a data final e salvar grava UMA vez o período corrigido (17/05 a 20/05), sem sobra do envio antigo e sem aviso pendente (' + te + '; ' + de.join() + '; avisos ' + (await incerta(pg).count()) + ')');
}

{ // (f) aplicação TARDIA: a conferência não encontra o pedido, o preenchimento é corrigido e gravado, e só então o pedido ORIGINAL chega ao servidor: é recusado, sem duplicar
  await cfgPeriodo(pg, '2027-05-24', '2027-05-26', 'Curso F tardio');
  falha.reter = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.reter = false;
  await avisoSumiu(pg); await incerta(pg).locator('button').click(); const tf = await aviso(pg);
  ok(/Conferido: não foi gravado e aquela tentativa foi cancelada/.test(tf) && (await contar(pg, 'Curso F tardio')) === 0 && !!falha.guardado, `tardia (UI): a conferência não encontra a operação e diz que a tentativa foi CANCELADA (${tf})`);
  await pg.fill('#cfg-fim', '2027-05-27'); await salvarCfg(pg); const tg = await aviso(pg);
  await pg.waitForFunction(() => /Curso F tardio/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
  ok(/Período cadastrado: 4 dias/.test(tg) && (await contar(pg, 'Curso F tardio')) === 4, 'tardia (UI): o preenchimento corrigido (24/05 a 27/05) é gravado uma vez');
  const g = falha.guardado, cab = { ...g.headers }; for (const h of ['host', 'content-length', 'connection', 'accept-encoding']) delete cab[h];
  const resp = await fetch(g.url, { method: 'POST', headers: cab, body: g.body }); const corpo = await resp.text();
  await pg.waitForTimeout(500);
  const ex6 = await exportar(pg), df = ex6.dias_indisponiveis.filter((x) => x.descricao === 'Curso F tardio').map((x) => x.data).sort();
  ok(/foi cancelada depois de uma conferência/.test(corpo) && df.join() === '2027-05-24,2027-05-25,2027-05-26,2027-05-27' && consistente(ex6), 'tardia (UI): o pedido ORIGINAL chega ao servidor depois da correção e é RECUSADO (a resposta diz que foi cancelada); continua um período só, 24/05 a 27/05, sem duplicar');
}

{ // (g) a página é recarregada com o resultado ainda incerto: o aviso continua e a conferência encontra a operação
  await cfgPeriodo(pg, '2027-06-14', '2027-06-16', 'Curso G recarga');
  falha.perderResposta = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.perderResposta = false;
  await ir(pg, '/config');
  ok((await incerta(pg).count()) === 1 && /Curso G recarga/.test(await incerta(pg).innerText()) && /1 problema novo/.test(await pg.getAttribute('.sino', 'aria-label')), 'incerto (g): depois de recarregar a página, o aviso "Conferir se foi gravado" continua (guardado no navegador) e o sininho conta o mesmo problema');
  await incerta(pg).locator('button').click(); const tr = await aviso(pg);
  ok(/Conferido: foi gravado/.test(tr) && (await incerta(pg).count()) === 0 && (await contar(pg, 'Curso G recarga')) === 3, `incerto (g): a conferência depois da recarga encontra a operação e o aviso some (${tr})`);
}

// ---------- 5b) DIA AVULSO: um dia só é um período de um dia, com a mesma identidade da operação (nenhum protocolo à parte) ----------
const semSucessoDia = async (pg) => !/Dia cadastrado/.test(await texto(pg, '#toast'));
const umDia = async (pg, data, desc) => { await pg.fill('#cfg-data', data); await pg.fill('#cfg-fim', ''); await pg.fill('#cfg-desc', desc); };
{ // (h) resposta PERDIDA: o servidor gravou; repetir sem conferir não grava um segundo dia
  await umDia(pg, '2027-07-05', 'Dia H perdido');
  falha.perderResposta = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.perderResposta = false;
  ok((await contar(pg, 'Dia H perdido')) === 1 && (await incerta(pg).count()) === 1 && await semSucessoDia(pg) && (await campos(pg)).t === 'Dia H perdido', 'dia avulso (h), resposta perdida: o servidor gravou, a tela NÃO confirma "Dia cadastrado", mostra o problema incerto e guarda o preenchimento');
  await salvarCfg(pg); await esperarAlerta(pg, 'tinha sido gravado');
  ok((await contar(pg, 'Dia H perdido')) === 1 && (await incerta(pg).count()) === 0 && await semSucessoDia(pg) && (await pg.locator('.cfg-lista li', { hasText: 'Dia H perdido' }).count()) === 1, 'dia avulso (h), repetição: salvar de novo confere antes, descobre que o dia foi gravado e NÃO grava um segundo (um registro, um item na lista)');
  await limpar(pg);
}
{ // (i) falha ANTES da gravação: a conferência cancela; salvar de novo grava um dia só
  await umDia(pg, '2027-07-12', 'Dia I antes');
  falha.abortarAntes = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.abortarAntes = false;
  ok((await contar(pg, 'Dia I antes')) === 0 && (await incerta(pg).count()) === 1 && await semSucessoDia(pg), 'dia avulso (i), falha antes da gravação: nada foi gravado, o resultado NÃO é confirmado e há a ação "Conferir se foi gravado"');
  await avisoSumiu(pg); await incerta(pg).locator('button').click(); const ti = await aviso(pg);
  ok(/Conferido: não foi gravado/.test(ti) && (await incerta(pg).count()) === 0 && (await contar(pg, 'Dia I antes')) === 0, 'dia avulso (i): conferir diz que NÃO foi gravado e cancela a tentativa');
  await salvarCfg(pg); const tj = await avisoComo(pg, /Dia cadastrado/);
  ok(/Dia cadastrado/.test(tj) && (await contar(pg, 'Dia I antes')) === 1 && consistente(await exportar(pg)), 'dia avulso (i): salvar de novo grava o dia UMA vez e só então confirma "Dia cadastrado"');
  await limpar(pg);
}
{ // (j) pedido ATRASADO: a conferência não encontra, o preenchimento é corrigido e gravado, e o pedido original que chega depois é recusado
  await umDia(pg, '2027-07-19', 'Dia J tardio');
  falha.reter = true; await salvarCfg(pg); await esperarAlerta(pg, 'Não foi possível confirmar'); falha.reter = false;
  await avisoSumiu(pg); await incerta(pg).locator('button').click(); await aviso(pg);
  await pg.fill('#cfg-data', '2027-07-20'); await salvarCfg(pg); await avisoComo(pg, /Dia cadastrado/);
  await pg.waitForFunction(() => /Dia J tardio/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
  const g = falha.guardado, cab = { ...g.headers }; for (const h of ['host', 'content-length', 'connection', 'accept-encoding']) delete cab[h];
  const corpo = await (await fetch(g.url, { method: 'POST', headers: cab, body: g.body })).text();
  await pg.waitForTimeout(500);
  const exJ = await exportar(pg), dj = exJ.dias_indisponiveis.filter((x) => x.descricao === 'Dia J tardio').map((x) => x.data);
  ok(/foi cancelada depois de uma conferência/.test(corpo) && dj.join() === '2027-07-20' && consistente(exJ), 'dia avulso (j), pedido atrasado: o original (19/07) chega depois da correção (20/07) e é RECUSADO; fica um dia só, 20/07, sem duplicar');
  await limpar(pg);
}
{ // (k) registros LEGÍTIMOS: a mesma data e a mesma descrição, de operações diferentes, não são fundidos
  await umDia(pg, '2027-08-02', 'Dia K igual'); await salvarCfg(pg); await avisoComo(pg, /Dia cadastrado/);
  await umDia(pg, '2027-08-02', 'Dia K igual'); await salvarCfg(pg); await avisoSumiu(pg); await pg.waitForFunction(() => document.querySelectorAll('.cfg-lista li').length > 0 && [...document.querySelectorAll('.cfg-lista li')].filter((x) => /Dia K igual/.test(x.textContent)).length === 2, null, { timeout: 15000 });
  ok((await contar(pg, 'Dia K igual')) === 2, 'dia avulso (k): dois cadastros deliberados da mesma data e descrição são dois registros (nada é fundido por coincidência)');
  await limpar(pg);
}

// ---------- 6) editar o período: recálculo nos dois sentidos ----------
await pg.locator('.cfg-lista li', { hasText: 'Recesso de fim de ano' }).locator('button[aria-label^="Editar"]').click();
await pg.waitForTimeout(300);
ok(/Alterar período indisponível/.test(await texto(pg, '#cfg-novo-t')) && (await pg.inputValue('#cfg-data')) === '2026-12-24' && (await pg.inputValue('#cfg-fim')) === '2026-12-29' && (await texto(pg, '.cfg-form .btn.pri')) === 'Salvar alteração', 'editar: o formulário carrega o período com as duas datas e o botão "Salvar alteração"');
await pg.fill('#cfg-fim', '2026-12-26'); await salvarCfg(pg); const t6 = await aviso(pg);
await pg.waitForFunction(() => /a sáb, 26\/12\/2026/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
ex = await exportar(pg);
ok(/Período alterado: 3 dias/.test(t6) && porAssunto(ex, 'Exemplo 14/12').prazo === '2026-12-29' && ex.dias_indisponiveis.filter((x) => x.descricao === 'Recesso de fim de ano').length === 3 && consistente(ex), `encurtar o período recalcula: 29/12 fica livre e o vencimento do exemplo volta ao original (${t6})`);
await pg.locator('.cfg-lista li', { hasText: 'Recesso de fim de ano' }).locator('button[aria-label^="Editar"]').click();
await pg.fill('#cfg-fim', '2026-12-29'); await salvarCfg(pg); await aviso(pg); await pg.waitForTimeout(800);
ok(porAssunto(await exportar(pg), 'Exemplo 14/12').prazo === '2026-12-23', 'ampliar de novo ao dia 29/12 devolve o vencimento a 23/12');

// ---------- 7) excluir o período ----------
await pg.locator('.cfg-lista li', { hasText: 'Recesso da virada' }).locator('button[aria-label^="Excluir"]').click();
ok(/Excluir este período \(6 dias\)\?/.test(await texto(pg, '.cfg-confirma')), 'excluir pede confirmação e diz que é o período inteiro (6 dias)');
await avisoSumiu(pg); await pg.locator('.cfg-confirma button:has-text("Confirmar exclusão")').click(); const t7 = await aviso(pg);
await pg.waitForFunction(() => !/Recesso da virada/.test(document.querySelector('.cfg-lista')?.textContent ?? ''), null, { timeout: 15000 });
ex = await exportar(pg);
ok(/Período excluído \(6 dias\)/.test(t7) && ex.dias_indisponiveis.every((x) => x.descricao !== 'Recesso da virada') && porAssunto(ex, 'Vence no ano novo').prazo === '2027-01-04' && consistente(ex), `excluir o período remove os seis dias de uma vez e recalcula: 04/01/2027 volta a ficar livre e o vencimento volta ao original (${t7})`);

// ---------- 8) a janela de cadastro da Agenda ----------
await menu(pg, '.navi[data-nav="agenda"]'); await pg.waitForSelector('.agd-cel[data-data="2026-12-17"]'); await pg.waitForTimeout(600);
await pg.click('.agd-cel[data-data="2026-12-17"]'); await pg.waitForSelector('[data-acao="dia-indisponivel"]', { timeout: 10000 });
await pg.click('[data-acao="dia-indisponivel"]'); await pg.waitForSelector('#di-data');
ok(/Cadastrar dia ou período indisponível/.test(await texto(pg, '.modal')) && (await pg.inputValue('#di-data')) === '2026-12-17', 'Agenda: a janela abre com a data do dia aberto e o título "Cadastrar dia ou período indisponível"');
await pg.fill('#di-fim', '2026-12-18'); await pg.fill('#di-desc', 'Curso pela Agenda'); await pg.waitForTimeout(200);
ok(/2 dias/.test(await texto(pg, '.modal [data-periodo-resumo]')) && (await texto(pg, '[data-salvar-dia]')) === 'Cadastrar período', 'Agenda: com a data final, a janela resume o período e o botão vira "Cadastrar período"');
await avisoSumiu(pg); await pg.click('[data-salvar-dia]'); const t8 = await aviso(pg);
await pg.waitForSelector('.modal', { state: 'detached', timeout: 15000 });
ok(/Período cadastrado de .* a .*: 2 dias/.test(t8) && (await exportar(pg)).dias_indisponiveis.filter((x) => x.descricao === 'Curso pela Agenda').length === 2, `Agenda: o período é gravado, a janela fecha e o aviso diz onde ficou (${t8})`);
ex = await exportar(pg);
ok(consistente(ex), 'consistência final: todo vencimento aberto do servidor é o que o cálculo dá sobre a lista completa de dias exportada');
await ctx.close();

// ---------- 9) renderizado: o formulário com período em Claro e Escuro, computador, iPhone e telas estreitas ----------
mkdirSync('.dados-teste/periodos-capturas', { recursive: true });
for (const [rotulo, viewport] of [['computador 1360', { width: 1360, height: 900 }], ['iPhone 390', { width: 390, height: 844 }], ['iPhone 320', { width: 320, height: 700 }]]) {
  for (const tema of ['claro', 'escuro']) {
    const { ctx: c2, pg: p2 } = await novo(viewport, tema);
    await ir(p2, '/config');
    await p2.locator('.cfg-dias').scrollIntoViewIfNeeded();
    for (const estado of ['periodo', 'invalido']) {
      await cfgPeriodo(p2, '2027-05-10', estado === 'periodo' ? '2027-05-14' : '2027-05-08', 'Semana de curso');
      await p2.waitForTimeout(250);
      if (estado === 'invalido') { await p2.click('.cfg-form .btn.pri'); await p2.waitForTimeout(300); }
      const m = await p2.evaluate(() => {
        const q = (s) => document.querySelector(s), r = (e) => e.getBoundingClientRect(), rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
        const lum = ([a, b, c]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(a) + 0.7152 * f(b) + 0.0722 * f(c); };
        const fundo = (e) => { let n = e; while (n) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c; n = n.parentElement; } return [255, 255, 255]; };
        const contraste = (e) => { const a = lum(rgb(getComputedStyle(e).color)), b = lum(fundo(e)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
        const fim = q('#cfg-fim'), resumo = q('[data-periodo-resumo]'), form = q('.cfg-form'), rf = r(fim), rr = r(resumo), rform = r(form);
        const campo = q('#cfg-fim').closest('.campo-data');
        return { rolagemH: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, campoAlto: Math.round(rf.height), resumoVisivel: rr.width > 0 && rr.height > 0 && rr.left >= rform.left - 1 && rr.right <= rform.right + 1, formDentro: rform.left >= -0.5 && rform.right <= innerWidth + 0.5, contrasteResumo: contraste(resumo), borda: getComputedStyle(fim).borderTopColor, invalido: fim.getAttribute('aria-invalid'), dica: !!campo };
      });
      ok(!m.rolagemH && m.formDentro && m.resumoVisivel && m.campoAlto >= 44, `${rotulo}, ${tema}, ${estado}: formulário e resumo inteiros na tela, sem rolagem horizontal, data final com ${m.campoAlto} px de altura`);
      ok(m.contrasteResumo >= 4.5, `${rotulo}, ${tema}, ${estado}: o resumo tem contraste ${m.contrasteResumo.toFixed(1)}:1 (mínimo 4,5:1)${estado === 'invalido' ? `; data final marcada inválida: ${m.invalido === 'true'}` : ''}`);
      if (estado === 'invalido') ok(m.invalido === 'true', `${rotulo}, ${tema}: o campo inválido se distingue também pela borda (${m.borda})`);
      await p2.screenshot({ path: `.dados-teste/periodos-capturas/form-${estado}-${rotulo.split(' ')[0]}${viewport.width === 320 ? '320' : ''}-${tema}.png`, fullPage: false });
    }
    await c2.close();
  }
}

ok(erros.length === 0, 'nenhum erro de página nem de console' + (erros.length ? ': ' + JSON.stringify(erros.slice(0, 4)) : ''));
await nav.close(); parar();
process.exit(resumo());
