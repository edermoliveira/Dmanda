// Autenticação de ponta a ponta (decisão 92): o aplicativo REAL em modo real (@supabase/ssr, cookies, proxy, ações do servidor) contra o Supabase FALSO local (scripts/auth-falso.mjs: Auth e API de funções
// sobre um banco de teste PGlite com as mesmas migrações). Contas e e-mails FICTÍCIOS; nenhum e-mail é enviado (a caixa de saída é uma lista em memória). Edge, contextos limpos.
// PROVA: login, sessão persistente (fechar e reabrir o navegador), renovação com rotação, falha transitória sem perder a sessão, sair só deste aparelho, convite de uso único e com validade, definição e
// recuperação de senha, cadastro fechado, administração só da administradora, revogação com token anterior, rascunhos retomados em outro contexto e isolados entre contas, páginas e API sem sessão recusadas.
// NÃO PROVA: o GoTrue real (assinatura real dos tokens, entrega de e-mail, modelos de e-mail, hook configurado no painel), o Safari físico nem o domínio final. Uso: node scripts/testar-auth-fluxo.mjs
import { rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBancoTeste, prepararAdminDeTeste, criarContaDeTeste } from '../src/servidor/banco-teste-base.mjs';
import { iniciarAuthFalso, CHAVE_PUBLICA, CHAVE_SERVICO } from './auth-falso.mjs';
import { abrirEdge, criarVerificador, iniciarServidor, observarErros, esperar } from './auxiliar-navegador.mjs';

const PORTA = Number(process.env.PORTA_TESTE_AUTH || 7143), PORTA_FALSO = PORTA + 1, BASE = `http://localhost:${PORTA}`;
const RAIZ = join(tmpdir(), 'dmanda-auth-fluxo'); rmSync(RAIZ, { recursive: true, force: true }); mkdirSync(RAIZ, { recursive: true });
const v = criarVerificador(), ok = v.ok;
const erros = [];

const A = 'a1a1a1a1-0000-4000-8000-00000000000a', X = 'e5e5e5e5-0000-4000-8000-00000000000e';
const db = await abrirBancoTeste({ pasta: `${RAIZ}/pg`, pendentes: true });
await prepararAdminDeTeste(db);
const emailAdmin = (await db.query('select dmanda_privado.email_admin() as e')).rows[0].e;
await criarContaDeTeste(db, A, 'ana@exemplo.invalid'); await criarContaDeTeste(db, X, 'estranho@exemplo.invalid', { autorizar: false });
const falso = await iniciarAuthFalso({ db, porta: PORTA_FALSO });
falso.definirSenha(emailAdmin, 'senha-da-admin-123'); falso.definirSenha('ana@exemplo.invalid', 'senha-da-ana-123'); falso.definirSenha('estranho@exemplo.invalid', 'senha-do-estranho-123');
let deslocamento = 0; falso.estado.relogio = () => Date.now() + deslocamento;
const apiFalso = (caminho, init = {}) => fetch(`${falso.url}${caminho}`, { ...init, headers: { apikey: CHAVE_PUBLICA, 'content-type': 'application/json', ...(init.headers ?? {}) } });
const tokenDe = async (email, senha) => (await (await apiFalso('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password: senha }) })).json()).access_token;
const rpcComo = async (token, fn, args = {}) => { const r = await apiFalso(`/rest/v1/rpc/${fn}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(args) }); return { status: r.status, corpo: await r.json().catch(() => null) }; };

const servidor = await iniciarServidor({ porta: PORTA, pasta: `${RAIZ}/next-nao-usado`, cron: true, env: {
  DMANDA_BANCO: undefined, DMANDA_USUARIO_TESTE: undefined, NEXT_PUBLIC_SUPABASE_URL: falso.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: CHAVE_PUBLICA, SUPABASE_SERVICE_ROLE_KEY: CHAVE_SERVICO, DMANDA_URL_PUBLICA: BASE, DMANDA_SEGREDO_FLUXO: 'segredo-ficticio-do-fluxo-de-senha-0123456789',
} });
const edge = await abrirEdge();
const novoCtx = async (estado) => { const ctx = await edge.newContext(estado ? { storageState: estado } : {}); const pg = await ctx.newPage(); observarErros(pg, erros); return { ctx, pg }; };
const entrar = async (pg, email, senha, esperaUrl = '**/') => { await pg.goto(BASE + '/login', { waitUntil: 'load' }); await pg.fill('input[name="email"]', email); await pg.fill('input[name="senha"]', senha); await pg.click('form[data-form="entrar"] button[type="submit"]'); if (esperaUrl) await pg.waitForURL(esperaUrl, { timeout: 30000 }); };
const ir = async (pg, caminho) => { await pg.goto(BASE + caminho, { waitUntil: 'load' }); await pg.waitForSelector('.app', { timeout: 30000 }); };
const cookiesSessao = async (ctx) => (await ctx.cookies()).filter((c) => /^sb-.*-auth-token/.test(c.name));

// ---------- 1) visitante ----------
{
  const r = await fetch(BASE + '/', { redirect: 'manual' });
  ok([302, 303, 307, 308].includes(r.status) && /\/login/.test(r.headers.get('location') ?? '') && /no-store/.test(r.headers.get('cache-control') ?? ''), `visitante: a página inicial leva ao login e a resposta é privada, sem cache compartilhado (${r.status})`);
  const d = await fetch(BASE + '/demandas', { redirect: 'manual' });
  ok([302, 303, 307, 308].includes(d.status) && /\/login/.test(d.headers.get('location') ?? ''), 'visitante: Demandas também leva ao login');
  const e = await fetch(BASE + '/api/exportar');
  ok(e.status === 401 && !(await e.text()).includes('demandas'), 'visitante: a exportação responde 401, sem arquivo e sem dado');
  const rota = await fetch(BASE + '/login'); const html = await rota.text();
  ok(rota.status === 200 && /Entrar/.test(html) && !/data-secao|dcard|mini-card|Quadro/.test(html), 'visitante: a tela de entrar abre e não traz nada do painel');
  const semSessao = await fetch(BASE + '/api/rascunhos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao: 'listar' }) });
  const texto = await fetch(BASE + '/api/rascunhos', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ acao: 'listar' }) });
  const outroSite = await fetch(BASE + '/api/rascunhos', { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: JSON.stringify({ acao: 'listar' }) });
  ok(semSessao.status === 401 && texto.status === 403 && outroSite.status === 403, 'rascunhos: a rota recusa quem não tem sessão (401), corpo que não é JSON (403) e pedido de outro site (403)');
  ok(/<form(?=[^>]*data-form="entrar")(?=[^>]*method="post")[^>]*>/.test(html) && /<button type="submit" disabled=""/.test(html), 'login: no HTML do servidor o formulário é POST e o botão vem desativado até a página hidratar (um envio antes do JavaScript não põe e-mail e senha na URL)');
  const sonda = await fetch(BASE + '/api/sonda'); ok(sonda.status === 204, 'a sonda de conexão segue pública e sem dado (204)');
  const cron = await fetch(BASE + '/api/cron/diaria'); ok(cron.status === 401, 'a rotina diária continua protegida só pelo segredo dela: sem ele, 401');
}

// ---------- 2) cadastro fechado e Auth ----------
{
  const s = await apiFalso('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: 'novo@exemplo.invalid', password: 'qualquer-senha-123' }) });
  ok(s.status === 422 && !(await db.query("select 1 from auth.users where email = 'novo@exemplo.invalid'")).rows.length, 'cadastro fechado: o cadastro público é recusado e nenhuma conta é criada');
  const i = await fetch(`${falso.url}/auth/v1/invite`, { method: 'POST', headers: { apikey: CHAVE_SERVICO, authorization: `Bearer ${CHAVE_SERVICO}`, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'fora-da-lista@exemplo.invalid' }) });
  ok(i.status === 403 && !(await db.query("select 1 from auth.users where email = 'fora-da-lista@exemplo.invalid'")).rows.length, 'cadastro fechado: convite para e-mail fora da lista é recusado pelo hook mesmo com a chave de serviço, e nada é criado');
  const k = await fetch(`${falso.url}/auth/v1/invite`, { method: 'POST', headers: { apikey: CHAVE_PUBLICA, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'ana@exemplo.invalid' }) });
  ok(k.status === 401, 'convite: a chave pública não convida ninguém (a API administrativa exige a chave de serviço)');
}

// ---------- 3) login, sessão persistente e cookies ----------
let estadoAdmin;
{
  const { ctx, pg } = await novoCtx();
  await entrar(pg, emailAdmin, 'senha-errada-000', null); await pg.waitForSelector('.acesso-erro');
  ok(/E-mail ou senha incorretos/.test(await pg.textContent('.acesso-erro')) && (await cookiesSessao(ctx)).length === 0, 'login: senha errada mostra a mensagem e não deixa sessão');
  await pg.fill('input[name="email"]', 'estranho@exemplo.invalid'); await pg.fill('input[name="senha"]', 'senha-do-estranho-123'); await pg.click('form[data-form="entrar"] button[type="submit"]'); await pg.waitForSelector('.acesso-erro:has-text("não tem acesso")');
  ok((await cookiesSessao(ctx)).length === 0 && /\/login/.test(pg.url()), 'login: um e-mail de fora da lista, mesmo com senha válida no Auth, é recusado pelo banco e nenhuma sessão fica');
  await pg.fill('input[name="email"]', emailAdmin); await pg.fill('input[name="senha"]', 'senha-da-admin-123'); await pg.click('form[data-form="entrar"] button[type="submit"]'); await pg.waitForURL('**/', { timeout: 30000 }); await pg.waitForSelector('.app');
  const ck = await cookiesSessao(ctx);
  ok(ck.length >= 1 && ck.every((c) => c.httpOnly && c.sameSite === 'Lax' && c.path === '/') && ck.every((c) => c.expires > Date.now() / 1000 + 86400), 'sessão: cookies HTTP-only, SameSite Lax e persistentes (validade de dias, sem prazo curto)');
  ok(!(await pg.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).join('|') + document.cookie)).match(/sb-|access|refresh|senha-da-admin/i), 'sessão: nenhum token nem senha fica no armazenamento do navegador nem visível ao script da página');
  estadoAdmin = await ctx.storageState();
  await ctx.close();   // "fecha o navegador"
  const { ctx: c2, pg: p2 } = await novoCtx(estadoAdmin);   // "reabre": só o que um navegador guarda em disco (cookies persistentes)
  await p2.goto(BASE + '/', { waitUntil: 'load' }); await p2.waitForSelector('.app', { timeout: 30000 });
  ok(!/\/login/.test(p2.url()) && (await p2.textContent('body')).length > 100, 'sessão: fechar e reabrir o navegador preserva a sessão válida (sem novo login)');
  const exp = await p2.evaluate(async () => (await fetch('/api/exportar')).status);
  ok(exp === 200, 'sessão: depois de reabrir, a exportação funciona com a sessão');
  await c2.close();
}

// ---------- 4) renovação, falha transitória, sair só deste aparelho ----------
{
  falso.estado.validadeSegundos = 100;   // o cliente renova quando faltam menos de 90 s: com 100 s a renovação é devida depois de ~10 s, sem o token expirar no meio de uma página
  const { ctx, pg } = await novoCtx();
  await entrar(pg, 'ana@exemplo.invalid', 'senha-da-ana-123'); await pg.waitForSelector('.app');
  const antes = falso.estado.contadores.refresh, c0 = (await cookiesSessao(ctx)).map((c) => c.value).join();
  await esperar(12000);   // faltam menos de 90 s: a renovação é devida
  await pg.goto(BASE + '/demandas', { waitUntil: 'load' }); await pg.waitForSelector('.app', { timeout: 30000 });
  ok(falso.estado.contadores.refresh > antes && !/\/login/.test(pg.url()) && (await cookiesSessao(ctx)).map((c) => c.value).join() !== c0, 'renovação: com a renovação devida o servidor renova pelo refresh token (com rotação) e a pessoa não vê nada');
  // falha transitória de rede: o serviço de acesso cai na hora de renovar
  await esperar(12000);
  const cookiesAntes = (await cookiesSessao(ctx)).map((c) => `${c.name}=${c.value}`).join();
  falso.estado.falhas.set('refresh', 'cai'); falso.estado.falhas.set('user', 'cai');
  await pg.goto(BASE + '/demandas', { waitUntil: 'load' });
  ok(!/\/login/.test(pg.url()), 'falha transitória: o serviço de acesso fora do ar NÃO leva ao login');
  await esperar(1500);
  const cookiesDepois = (await cookiesSessao(ctx)).map((c) => `${c.name}=${c.value}`).join();
  const semDados = await pg.evaluate(() => document.querySelectorAll('.dcard, .mini-card').length);
  ok(cookiesDepois === cookiesAntes && cookiesDepois.length > 0 && semDados === 0, 'falha transitória: a sessão continua guardada (cookies iguais) e nenhum dado é mostrado enquanto não há identidade verificada');
  falso.estado.falhas.clear();
  await pg.goto(BASE + '/demandas', { waitUntil: 'load' }); await pg.waitForSelector('.app', { timeout: 30000 });
  ok(!/\/login/.test(pg.url()), 'falha transitória: a rede voltou e a mesma sessão continua valendo, sem novo login');
  falso.estado.validadeSegundos = 3600;

  // sair só deste aparelho
  const outra = await novoCtx(); await entrar(outra.pg, 'ana@exemplo.invalid', 'senha-da-ana-123'); await outra.pg.waitForSelector('.app');
  await ir(pg, '/config'); await pg.click('[data-sair]'); await pg.waitForURL('**/login', { timeout: 30000 });
  ok((await cookiesSessao(ctx)).length === 0, 'sair: "Sair deste aparelho" apaga a sessão daqui');
  await outra.pg.goto(BASE + '/demandas', { waitUntil: 'load' }); await outra.pg.waitForSelector('.app', { timeout: 30000 });
  ok(!/\/login/.test(outra.pg.url()) && (await rpcComo(await tokenDe('ana@exemplo.invalid', 'senha-da-ana-123'), 'estado_acesso')).corpo.autorizado === true, 'sair: o outro aparelho da mesma conta continua conectado (só esta sessão foi encerrada)');
  await ctx.close(); await outra.ctx.close();
}

// ---------- 5) administração: convite, definição de senha, uso único, validade ----------
{
  const adm = await novoCtx(estadoAdmin); await ir(adm.pg, '/config');
  ok(!!(await adm.pg.waitForSelector('[data-secao="usuarios"]', { timeout: 20000 }).catch(() => null)), 'administração: a administradora vê "Usuários e acesso"');
  const ana = await novoCtx(); await entrar(ana.pg, 'ana@exemplo.invalid', 'senha-da-ana-123'); await ir(ana.pg, '/config');
  await ana.pg.waitForSelector('[data-secao="conta"]', { timeout: 20000 }); await esperar(2000);
  ok(!(await ana.pg.$('[data-secao="usuarios"]')) && !!(await ana.pg.$('[data-secao="conta"]')), 'administração: uma conta autorizada comum NÃO vê "Usuários e acesso" (só "Conta")');
  const tokAna = await tokenDe('ana@exemplo.invalid', 'senha-da-ana-123');
  ok((await rpcComo(tokAna, 'listar_acessos')).status >= 400 && (await rpcComo(tokAna, 'autorizar_acesso', { p_email: 'invasor@exemplo.invalid' })).status >= 400 && !(await db.query("select 1 from dmanda_privado.acesso_autorizado where email = 'invasor@exemplo.invalid'")).rows.length, 'administração: chamadas diretas da conta comum à API de gestão são recusadas pelo banco e nada é autorizado');
  ok((await rpcComo(CHAVE_PUBLICA, 'listar_demandas')).status === 401 && (await rpcComo('lixo.lixo.lixo', 'listar_demandas')).status === 401, 'administração: sem JWT válido (ou só com a chave pública) a API de funções recusa');

  await adm.pg.fill('#usu-email', 'bia@exemplo.invalid'); await adm.pg.click('form[aria-label="Convidar"] button[type="submit"]');
  await adm.pg.waitForSelector('li[data-acesso="bia@exemplo.invalid"]', { timeout: 20000 });
  ok(/Convite pendente/.test(await adm.pg.textContent('li[data-acesso="bia@exemplo.invalid"] [data-chip-estado]')) && falso.estado.caixaDeSaida.filter((m) => m.para === 'bia@exemplo.invalid' && m.tipo === 'invite').length === 1, 'convite: a administradora informa o e-mail, o convite é enviado (caixa de saída falsa) e o estado é "Convite pendente"');
  ok(!!(await adm.pg.$('li[data-acesso="ana@exemplo.invalid"] [data-revogar]')) && !(await adm.pg.$(`li[data-acesso="${emailAdmin}"] [data-revogar]`)), 'administração: cada acesso tem Revogar, menos a conta administradora (não há botão para revogá-la)');
  const sessaoAdmin = (await adm.ctx.cookies()).length;
  const link = falso.estado.caixaDeSaida.find((m) => m.para === 'bia@exemplo.invalid').token_hash;
  const bia = await novoCtx();
  await bia.pg.goto(`${BASE}/auth/confirmar?token_hash=${link}&type=invite`, { waitUntil: 'load' });
  ok(falso.estado.links.get(link).usado === false && /Continuar/.test(await bia.pg.textContent('main')), 'convite: abrir o link só mostra "Continuar" e NÃO gasta o link (um leitor automático de e-mail não o consome)');
  await bia.pg.click('form[data-form="confirmar-link"] button'); await bia.pg.waitForURL('**/definir-senha', { timeout: 30000 });
  const etapaBia = (await bia.ctx.cookies()).find((c) => c.name === 'dmanda-etapa-senha');
  ok(!!etapaBia && etapaBia.httpOnly && etapaBia.sameSite === 'Strict' && etapaBia.expires - Date.now() / 1000 <= 15 * 60 + 5 && !/senha|token_hash|access_token/i.test(etapaBia.value), 'etapa: depois de o Auth validar o convite, o servidor emite a etapa assinada (HTTP-only, SameSite Strict, 15 minutos, sem senha nem link dentro)');
  await bia.pg.fill('input[name="nova"]', 'curta'); await bia.pg.fill('input[name="conf"]', 'curta'); await bia.pg.click('form[data-form="definir-senha"] button');
  ok(/definir-senha/.test(bia.pg.url()), 'senha: uma senha curta é recusada (a tela não avança)');
  await bia.pg.fill('input[name="nova"]', 'senha-da-bia-1234'); await bia.pg.fill('input[name="conf"]', 'outra-senha-1234'); await bia.pg.evaluate(() => document.querySelector('form[data-form="definir-senha"]').requestSubmit());
  await bia.pg.waitForSelector('.acesso-erro');
  ok(/não é igual/.test(await bia.pg.textContent('.acesso-erro')), 'senha: confirmação diferente é recusada com mensagem');
  await bia.pg.fill('input[name="nova"]', 'senha-da-bia-1234'); await bia.pg.fill('input[name="conf"]', 'senha-da-bia-1234'); await bia.pg.click('form[data-form="definir-senha"] button'); await bia.pg.waitForURL('**/', { timeout: 30000 }); await bia.pg.waitForSelector('.app');
  ok(falso.estado.senhas.get('bia@exemplo.invalid') === 'senha-da-bia-1234' && !(await bia.pg.evaluate(() => document.body.innerText)).includes('senha-da-bia'), 'senha: a convidada define a PRÓPRIA senha pelo fluxo do Auth e entra; a senha não aparece em lugar nenhum');
  ok((await adm.ctx.cookies()).length === sessaoAdmin, 'convite: enviar e usar o convite não trocou a sessão da administradora');
  ok(!(await bia.ctx.cookies()).some((c) => c.name === 'dmanda-etapa-senha'), 'etapa: ao concluir, a etapa é apagada');
  // reutilizar a MESMA etapa (cópia do cookie) na mesma sessão: o banco recusa o segundo uso
  await bia.ctx.addCookies([{ ...etapaBia }]);
  await bia.pg.goto(BASE + '/definir-senha', { waitUntil: 'load' }); await bia.pg.waitForSelector('form[data-form="definir-senha"] button:not([disabled])');
  await bia.pg.fill('input[name="nova"]', 'outra-senha-bia-99'); await bia.pg.fill('input[name="conf"]', 'outra-senha-bia-99'); await bia.pg.click('form[data-form="definir-senha"] button'); await bia.pg.waitForSelector('.acesso-erro');
  ok(/já foi usado/.test(await bia.pg.textContent('.acesso-erro')) && falso.estado.senhas.get('bia@exemplo.invalid') === 'senha-da-bia-1234', 'etapa: a mesma etapa não serve duas vezes (uso único no banco) e a senha não muda');
  // sessão COMUM (login com senha), sem etapa: a tela não oferece definir senha
  const comum = await novoCtx(); await entrar(comum.pg, 'ana@exemplo.invalid', 'senha-da-ana-123'); await comum.pg.waitForSelector('.app');
  await comum.pg.goto(BASE + '/definir-senha?type=recovery&finalidade=convite', { waitUntil: 'load' }); await comum.pg.waitForSelector('main h1');
  ok(!(await comum.pg.$('form[data-form="definir-senha"]')) && /use o link do convite ou o de recuperação/.test(await comum.pg.textContent('main')), 'etapa: com uma sessão comum, nem parâmetros na URL abrem a definição de senha (sem a etapa não há formulário)');
  await comum.ctx.addCookies([{ name: 'dmanda-etapa-senha', value: 'eyJmIjoicmVjb3ZlcnkifQ.assinatura-forjada', domain: 'localhost', path: '/' }]);
  await comum.pg.goto(BASE + '/definir-senha', { waitUntil: 'load' }); await comum.pg.waitForSelector('main h1');
  ok(!(await comum.pg.$('form[data-form="definir-senha"]')), 'etapa: um cookie forjado (assinatura errada) não abre a definição de senha');
  // a etapa VÁLIDA de outra pessoa colada na sessão da Ana: a assinatura confere, mas usuário e sessão não
  await comum.ctx.addCookies([{ ...etapaBia }]);
  await comum.pg.goto(BASE + '/definir-senha', { waitUntil: 'load' }); await comum.pg.waitForSelector('form[data-form="definir-senha"] button:not([disabled])');
  await comum.pg.fill('input[name="nova"]', 'tomada-de-conta-1'); await comum.pg.fill('input[name="conf"]', 'tomada-de-conta-1'); await comum.pg.click('form[data-form="definir-senha"] button'); await comum.pg.waitForSelector('.acesso-erro');
  ok(/não corresponde ao link/.test(await comum.pg.textContent('.acesso-erro')) && falso.estado.senhas.get('ana@exemplo.invalid') === 'senha-da-ana-123' && falso.estado.senhas.get('bia@exemplo.invalid') === 'senha-da-bia-1234', 'etapa: a etapa de outra conta não serve (usuário e sessão do JWT verificado precisam ser os mesmos) e nenhuma senha muda');
  await comum.ctx.close();
  const reuso = await novoCtx(); await reuso.pg.goto(`${BASE}/auth/confirmar?token_hash=${link}&type=invite`); await reuso.pg.click('form[data-form="confirmar-link"] button'); await reuso.pg.waitForSelector('.acesso-erro');
  ok(/expirou ou já foi usado/.test(await reuso.pg.textContent('.acesso-erro')) && (await cookiesSessao(reuso.ctx)).length === 0, 'convite: o link é de uso único: repetir não entra');
  await adm.pg.reload({ waitUntil: 'load' }); await adm.pg.waitForSelector('li[data-acesso="bia@exemplo.invalid"]');
  ok(/Ativo/.test(await adm.pg.textContent('li[data-acesso="bia@exemplo.invalid"] [data-chip-estado]')), 'estados: depois da primeira entrada a lista mostra "Ativo"');
  // validade
  await adm.pg.fill('#usu-email', 'caio@exemplo.invalid'); await adm.pg.click('form[aria-label="Convidar"] button[type="submit"]'); await adm.pg.waitForSelector('li[data-acesso="caio@exemplo.invalid"]', { timeout: 20000 });
  const linkCaio = falso.estado.caixaDeSaida.find((m) => m.para === 'caio@exemplo.invalid').token_hash;
  deslocamento = 25 * 3600 * 1000;   // passou das 24 h de validade do link
  const caio = await novoCtx(); await caio.pg.goto(`${BASE}/auth/confirmar?token_hash=${linkCaio}&type=invite`); await caio.pg.click('form[data-form="confirmar-link"] button'); await caio.pg.waitForSelector('.acesso-erro');
  ok(/expirou ou já foi usado/.test(await caio.pg.textContent('.acesso-erro')) && (await cookiesSessao(caio.ctx)).length === 0, 'convite: link vencido (mais de 24 h) não entra');
  deslocamento = 0;
  const tipoErrado = await novoCtx(); await tipoErrado.pg.goto(`${BASE}/auth/confirmar?token_hash=${linkCaio}&type=magiclink`);
  ok(/Link inválido/.test(await tipoErrado.pg.textContent('main')), 'convite: tipos de link que não são convite nem recuperação são recusados pela tela');
  // convite revogado antes de usar
  await adm.pg.fill('#usu-email', 'duda@exemplo.invalid'); await adm.pg.click('form[aria-label="Convidar"] button[type="submit"]'); await adm.pg.waitForSelector('li[data-acesso="duda@exemplo.invalid"]', { timeout: 20000 });
  const linkDuda = falso.estado.caixaDeSaida.find((m) => m.para === 'duda@exemplo.invalid').token_hash;
  await adm.pg.click('li[data-acesso="duda@exemplo.invalid"] [data-revogar]'); await adm.pg.click('li[data-acesso="duda@exemplo.invalid"] [data-confirmar-revogar]'); await adm.pg.waitForSelector('li[data-acesso="duda@exemplo.invalid"][data-estado="revogado"]', { timeout: 20000 });
  const duda = await novoCtx(); await duda.pg.goto(`${BASE}/auth/confirmar?token_hash=${linkDuda}&type=invite`); await duda.pg.click('form[data-form="confirmar-link"] button'); await duda.pg.waitForSelector('.acesso-erro');
  ok(/revogado|expirou|não está autorizado/.test(await duda.pg.textContent('.acesso-erro')) && (await cookiesSessao(duda.ctx)).length === 0, 'convite: convite revogado antes de usar não permite entrar');
  for (const c of [adm, ana, bia, reuso, caio, tipoErrado, duda]) await c.ctx.close();
}

// ---------- 6) painel compartilhado, rascunhos entre contextos e isolamento ----------
{
  const tokAna = await tokenDe('ana@exemplo.invalid', 'senha-da-ana-123'), tokBia = await tokenDe('bia@exemplo.invalid', 'senha-da-bia-1234');
  const criada = await rpcComo(tokAna, 'criar_demanda', { p: { assunto: 'Demanda criada pela Ana (compartilhada)' } });
  const biaVe = await rpcComo(tokBia, 'listar_demandas', { p_arquivadas: false });
  ok(criada.status === 200 && biaVe.corpo.some((d) => d.assunto === 'Demanda criada pela Ana (compartilhada)'), 'painel: a Bia (outra conta autorizada) vê a demanda criada pela Ana');
  const biaUI = await novoCtx(); await entrar(biaUI.pg, 'bia@exemplo.invalid', 'senha-da-bia-1234'); await ir(biaUI.pg, '/demandas');
  await biaUI.pg.waitForFunction(() => document.body.innerText.includes('Demanda criada pela Ana'), null, { timeout: 20000 });
  ok(true, 'painel: a interface da Bia mostra a demanda da Ana');
  // rascunho: a Ana começa o cadastro de uma demanda num contexto e retoma em outro (o cadastro guarda o rascunho sozinho, sem criar demanda)
  const TEXTO = 'rascunho online da Ana, ainda sem criar a demanda';
  const c1 = await novoCtx(); await entrar(c1.pg, 'ana@exemplo.invalid', 'senha-da-ana-123'); await ir(c1.pg, '/demandas');
  await c1.pg.click('.toolbar .btn.escuro'); await c1.pg.waitForSelector('#n-assunto'); await c1.pg.fill('#n-assunto', TEXTO);
  await c1.pg.waitForSelector('[data-estado-rascunhos="salvo"]', { timeout: 20000 });
  ok(/Salvo online/.test(await c1.pg.textContent('[data-estado-rascunhos]')) && (await db.query("select count(*)::int n from public.rascunhos where user_id = $1 and estado = 'aberto' and chave = 'nova'", [A])).rows[0].n === 1 && (await db.query("select count(*)::int n from public.demandas where assunto = $1", [TEXTO])).rows[0].n === 0, 'rascunhos: o estado "Salvo online" só aparece depois da confirmação do banco, que já tem o rascunho, e nenhuma demanda foi criada');
  ok(!(await c1.pg.evaluate(() => Object.values(localStorage).join('|'))).includes('rascunho online da Ana'), 'rascunhos: depois de confirmado, o texto NÃO fica no armazenamento do navegador (a fila local guarda só o pendente)');
  const c2 = await novoCtx(); await entrar(c2.pg, 'ana@exemplo.invalid', 'senha-da-ana-123'); await ir(c2.pg, '/demandas');
  await c2.pg.waitForTimeout(2500);
  await c2.pg.click('.toolbar .btn.escuro'); await c2.pg.waitForSelector('#n-assunto');
  ok((await c2.pg.inputValue('#n-assunto')) === TEXTO && /Rascunho recuperado/.test(await c2.pg.textContent('.modal')), 'rascunhos: em OUTRO contexto de navegador a mesma conta recupera o rascunho');
  await biaUI.pg.goto(BASE + '/demandas', { waitUntil: 'load' }); await biaUI.pg.waitForSelector('.app'); await esperar(2500);
  await biaUI.pg.click('.toolbar .btn.escuro'); await biaUI.pg.waitForSelector('#n-assunto');
  ok((await biaUI.pg.inputValue('#n-assunto')) === '' && !(await biaUI.pg.textContent('.modal')).includes('recuperado'), 'rascunhos: a Bia NÃO vê o rascunho da Ana (o cadastro dela abre vazio)');
  await biaUI.pg.keyboard.press('Escape');
  const tokBia2 = await tokenDe('bia@exemplo.invalid', 'senha-da-bia-1234');
  ok((await rpcComo(tokBia2, 'listar_rascunhos')).corpo.length === 0 && (await rpcComo(tokBia2, 'salvar_rascunho', { p_id: (await db.query("select id::text i from public.rascunhos where user_id = $1 limit 1", [A])).rows[0].i, p_chave: 'nova', p_dados: { dados: { assunto: 'invasão' } }, p_base: 1, p_op: '99999999-0000-4000-8000-000000000001' })).status >= 400, 'rascunhos: nem pela API, trocando o identificador, a Bia lê ou grava o rascunho da Ana');
  // cópia: a conta comum não leva autoria; a administradora leva
  const exportaAna = await c1.pg.evaluate(async () => (await (await fetch('/api/exportar')).json()));
  ok(exportaAna.versao === 5 && !('autoria' in exportaAna) && exportaAna.rascunhos.length >= 1 && !JSON.stringify(exportaAna).includes('bia@'), 'cópia: a conta comum exporta só os próprios rascunhos e nenhuma autoria nem e-mail alheio');
  const admCtx = await novoCtx(estadoAdmin); await admCtx.pg.goto(BASE + '/', { waitUntil: 'load' });
  const exportaAdm = await admCtx.pg.evaluate(async () => (await (await fetch('/api/exportar')).json()));
  ok(exportaAdm.autoria?.demandas && Object.values(exportaAdm.autoria.demandas).includes('ana@exemplo.invalid') && exportaAdm.rascunhos.every((r) => r.chave !== 'e:nova' || true) && !JSON.stringify(exportaAdm).includes('rascunho online da Ana'), 'cópia: a administradora leva a autoria por e-mail, e o conteúdo do rascunho da Ana NÃO vai na cópia dela');
  for (const c of [biaUI, c1, c2, admCtx]) await c.ctx.close();
}

// ---------- 7) revogação com a página aberta, falha transitória e a fila de rascunhos ----------
{
  const bia = await novoCtx(); await entrar(bia.pg, 'bia@exemplo.invalid', 'senha-da-bia-1234'); await ir(bia.pg, '/demandas');
  const tokBia = await tokenDe('bia@exemplo.invalid', 'senha-da-bia-1234');   // o JWT de antes da revogação
  // falha TRANSITÓRIA (a rota dos rascunhos cai): erro de sincronização, a fila fica, nada de "acesso revogado"
  await bia.pg.route('**/api/rascunhos', (r) => r.abort('failed'));
  const TEXTO_BIA = 'rascunho da Bia digitado antes da revogação';
  await bia.pg.click('.toolbar .btn.escuro'); await bia.pg.waitForSelector('#n-assunto'); await bia.pg.fill('#n-assunto', TEXTO_BIA);
  await bia.pg.waitForSelector('[data-estado-rascunhos="falha"]', { timeout: 20000 });
  const filaDaBia = async () => JSON.parse(await bia.pg.evaluate(() => Object.entries(localStorage).find(([k]) => k.startsWith('dmanda:fila:'))?.[1] ?? 'null'));
  const f0 = await filaDaBia();
  ok(/Erro de sincronização/.test(await bia.pg.textContent('[data-estado-rascunhos]')) && !(await bia.pg.$('[data-acesso-revogado]')) && JSON.stringify(f0).includes(TEXTO_BIA) && f0.dono?.email === 'bia@exemplo.invalid', 'falha transitória: o indicador mostra erro de sincronização, a alteração fica pendente neste aparelho identificada pela dona, e nada de tela de revogação');
  // a administradora revoga enquanto a página da Bia está aberta
  const adm = await novoCtx(estadoAdmin); await ir(adm.pg, '/config'); await adm.pg.waitForSelector('li[data-acesso="bia@exemplo.invalid"]');
  await adm.pg.click('li[data-acesso="bia@exemplo.invalid"] [data-revogar]'); await adm.pg.click('li[data-acesso="bia@exemplo.invalid"] [data-confirmar-revogar]');
  await adm.pg.waitForSelector('li[data-acesso="bia@exemplo.invalid"][data-estado="revogado"]', { timeout: 20000 });
  const antes = await rpcComo(tokBia, 'listar_demandas', { p_arquivadas: false });
  ok(antes.status >= 400 && /revogado|DM403/.test(JSON.stringify(antes.corpo)) && (await rpcComo(tokBia, 'criar_demanda', { p: { assunto: 'depois de revogada' } })).status >= 400, 'revogação: com o JWT de antes ainda válido, a API recusa ler (DM403, não uma lista vazia) e recusa gravar');
  // a rede volta: o próximo envio da fila encontra a revogação e o painel aberto dá lugar à tela de acesso revogado
  await bia.pg.unroute('**/api/rascunhos');
  await bia.pg.click('[data-tentar-de-novo]').catch(() => {});
  await bia.pg.waitForSelector('[data-acesso-revogado]', { timeout: 20000 });
  const telaRev = await bia.pg.textContent('[data-acesso-revogado]');
  ok(/Acesso revogado/.test(telaRev) && /bia@exemplo\.invalid/.test(telaRev) && /não serão enviadas por outra conta/.test(telaRev) && (await bia.pg.$$('.dcard, .mini-card, .side, .bar')).length === 0, 'revogação com a página aberta: a tela de acesso revogado substitui o painel (sem cards, menu nem barras), diz de quem é o acesso e explica a alteração pendente');
  const f1 = await filaDaBia();
  ok(JSON.stringify(f1).includes(TEXTO_BIA) && !(await db.query('select 1 from public.rascunhos where dados::text like $1', [`%${TEXTO_BIA}%`])).rows.length, 'revogação: a alteração ainda não enviada continua guardada neste navegador (com a dona) e nada dela chegou ao banco');
  let reenvios = 0; bia.pg.on('request', (q) => { if (q.url().includes('/api/rascunhos')) reenvios++; });
  await esperar(7000);   // mais que a primeira e a segunda retentativa (2 s e 5 s) que uma falha comum teria
  ok(reenvios === 0, 'revogação: o motor para de tentar (nenhum reenvio automático depois da recusa, diferente de uma falha de rede)');
  // a outra aba (mesma conta) com o painel aberto: na próxima conversa com o servidor a tela também muda
  const aba2 = await bia.ctx.newPage(); await aba2.goto(BASE + '/demandas', { waitUntil: 'load' });
  await aba2.waitForURL('**/login**', { timeout: 30000 }); await aba2.waitForSelector('.acesso-aviso', { timeout: 20000 });
  ok(/motivo=sem-acesso/.test(aba2.url()) && /revogado/.test(await aba2.textContent('.acesso-aviso')), 'revogação: abrir o painel numa nova aba leva ao login com a mensagem explícita de acesso revogado');
  await aba2.close();
  // a Bia sai e a Ana entra NO MESMO navegador: a fila da Bia não vai em nome da Ana
  await bia.pg.click('[data-sair-revogado]'); await bia.pg.waitForURL('**/login**', { timeout: 30000 });
  await entrar(bia.pg, 'ana@exemplo.invalid', 'senha-da-ana-123'); await bia.pg.waitForSelector('.app'); await ir(bia.pg, '/demandas'); await esperar(2500);
  const fBia = await bia.pg.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('dmanda:fila:')).map(([k, v]) => [k, v]));
  ok(fBia.some(([, v]) => v.includes(TEXTO_BIA) && v.includes('bia@exemplo.invalid')) && !(await db.query('select 1 from public.rascunhos where dados::text like $1', [`%${TEXTO_BIA}%`])).rows.length && !/rascunho da Bia/.test(await bia.pg.textContent('body')), 'outra conta: com a Ana neste navegador, a fila da Bia continua guardada em nome da Bia, não aparece para a Ana e nada dela foi enviado');
  // troca de conta POR BAIXO de uma página aberta: a fila da Ana não vai com a sessão de outra pessoa
  const pAna = await bia.ctx.newPage(); await pAna.goto(BASE + '/demandas', { waitUntil: 'load' }); await pAna.waitForSelector('.app');
  await pAna.route('**/api/rascunhos', (r) => r.abort('failed'));
  await pAna.click('.toolbar .btn.escuro'); await pAna.waitForSelector('#n-assunto'); await pAna.fill('#n-assunto', 'rascunho da Ana pendente'); await pAna.waitForSelector('[data-estado-rascunhos="falha"]', { timeout: 20000 });
  await bia.ctx.clearCookies(); const outra = await bia.ctx.newPage(); await entrar(outra, emailAdmin, 'senha-da-admin-123'); await outra.close();   // outra pessoa entra neste navegador, noutra aba
  await pAna.unroute('**/api/rascunhos');   // a retentativa automática da fila chega sozinha (2 s, 5 s...)
  await pAna.waitForSelector('[data-estado-rascunhos="bloqueado"]', { timeout: 20000 });
  ok(/outra conta/.test(await pAna.textContent('[data-estado-rascunhos]')), 'outra conta: o indicador explica que o envio parou porque o navegador está com outra conta');
  ok(!(await db.query('select 1 from public.rascunhos where dados::text like $1', ['%rascunho da Ana pendente%'])).rows.length && (await pAna.evaluate(() => Object.values(localStorage).join('|'))).includes('rascunho da Ana pendente'), 'outra conta: se a sessão do navegador passa a ser de outra pessoa com a página aberta, o servidor recusa a fila (dona diferente) e ela continua guardada, sem ir em nome de ninguém');
  await pAna.close();
  ok((await db.query("select count(*)::int n from public.demandas where assunto like 'Demanda criada pela Ana%'")).rows[0].n === 1, 'revogação: os registros do painel seguem intactos');
  await adm.pg.click('li[data-acesso="bia@exemplo.invalid"] [data-restabelecer]'); await adm.pg.waitForSelector('li[data-acesso="bia@exemplo.invalid"][data-estado="ativo"]', { timeout: 20000 });
  const volta = await novoCtx(); await entrar(volta.pg, 'bia@exemplo.invalid', 'senha-da-bia-1234'); await volta.pg.waitForSelector('.app');
  ok(true, 'revogação: restabelecida pela administradora, ela volta a entrar');
  ok((await db.query('select count(*)::int n from public.rascunhos where user_id = (select id from auth.users where email = $1) and estado = $2', ['bia@exemplo.invalid', 'aberto'])).rows[0].n === 0, 'pré-condição: a Bia não tem rascunho aberto (a lista dela volta vazia)');
  // a rede de segurança do servidor: revogação SÓ no banco (sem o bloqueio no Auth) e uma lista que volta vazia (a política nem chega a ser avaliada): a resposta tem de ser "revogado", não "nada"
  const semBan = await novoCtx(); await entrar(semBan.pg, 'bia@exemplo.invalid', 'senha-da-bia-1234'); await semBan.pg.waitForSelector('.app');
  await db.query("update dmanda_privado.acesso_autorizado set revogado_em = now() where email = 'bia@exemplo.invalid'");
  const vazia = await semBan.pg.evaluate(async () => { const r = await fetch('/api/rascunhos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao: 'listar' }) }); return { s: r.status, j: await r.json() }; });
  await db.query("update dmanda_privado.acesso_autorizado set revogado_em = null where email = 'bia@exemplo.invalid'");
  ok(vazia.s === 403 && vazia.j.revogado === true && /revogado/.test(vazia.j.erro), 'revogação só no banco: uma lista vazia não é entregue como resultado; o servidor confere o acesso e responde "revogado" (403)');
  await semBan.ctx.close();
  const tokAdm = await tokenDe(emailAdmin, 'senha-da-admin-123');
  ok((await rpcComo(tokAdm, 'revogar_acesso', { p_email: emailAdmin })).status >= 400 && (await db.query('select revogado_em from dmanda_privado.acesso_autorizado where email = $1', [emailAdmin])).rows[0].revogado_em === null, 'administradora: nem chamando a API direto ela é revogada');
  for (const c of [bia, adm, volta]) await c.ctx.close();
}

// ---------- 8) recuperação de senha ----------
{
  const ctx = await novoCtx(); await ctx.pg.goto(BASE + '/recuperar', { waitUntil: 'load' });
  const antes = falso.estado.caixaDeSaida.length;
  await ctx.pg.fill('input[name="email"]', 'ana@exemplo.invalid'); await ctx.pg.click('form[data-form="recuperar"] button'); await ctx.pg.waitForSelector('.acesso-aviso'); const msgConhecido = await ctx.pg.textContent('.acesso-aviso');
  await ctx.pg.fill('input[name="email"]', 'nao-existe@exemplo.invalid'); await ctx.pg.click('form[data-form="recuperar"] button'); await ctx.pg.waitForFunction(() => document.querySelector('.acesso-aviso')?.textContent?.length > 10); const msgDesconhecido = await ctx.pg.textContent('.acesso-aviso');
  ok(msgConhecido === msgDesconhecido && falso.estado.caixaDeSaida.length === antes + 1 && falso.estado.caixaDeSaida.at(-1).tipo === 'recovery', 'recuperação: a resposta é igual para e-mail conhecido e desconhecido (sem enumeração) e só o conhecido recebe o link');
  const link = falso.estado.caixaDeSaida.at(-1).token_hash;
  const trocado = await novoCtx(); await trocado.pg.goto(`${BASE}/auth/confirmar?token_hash=${link}&type=invite`); await trocado.pg.click('form[data-form="confirmar-link"] button'); await trocado.pg.waitForSelector('.acesso-erro');
  ok(/expirou ou já foi usado/.test(await trocado.pg.textContent('.acesso-erro')) && !(await trocado.ctx.cookies()).some((c) => c.name === 'dmanda-etapa-senha') && falso.estado.links.get(link).usado === false, 'recuperação: o link de recuperação apresentado como convite (finalidade trocada na URL) é recusado pelo Auth, sem etapa e sem gastar o link');
  await trocado.ctx.close();
  await ctx.pg.goto(`${BASE}/auth/confirmar?token_hash=${link}&type=recovery`); await ctx.pg.click('form[data-form="confirmar-link"] button'); await ctx.pg.waitForURL('**/definir-senha', { timeout: 30000 });
  await ctx.pg.fill('input[name="nova"]', 'nova-senha-da-ana-1'); await ctx.pg.fill('input[name="conf"]', 'nova-senha-da-ana-1'); await ctx.pg.click('form[data-form="definir-senha"] button'); await ctx.pg.waitForURL('**/', { timeout: 30000 });
  const velha = await apiFalso('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: 'ana@exemplo.invalid', password: 'senha-da-ana-123' }) });
  const nova = await apiFalso('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: 'ana@exemplo.invalid', password: 'nova-senha-da-ana-1' }) });
  ok(velha.status === 400 && nova.status === 200, 'recuperação: a senha antiga deixa de valer e a nova entra');
  const reuso = await novoCtx(); await reuso.pg.goto(`${BASE}/auth/confirmar?token_hash=${link}&type=recovery`); await reuso.pg.click('form[data-form="confirmar-link"] button'); await reuso.pg.waitForSelector('.acesso-erro');
  ok(/expirou ou já foi usado/.test(await reuso.pg.textContent('.acesso-erro')), 'recuperação: o link também é de uso único');
  // alterar a própria senha pela conta (a sessão deste aparelho passa a ter mais de 24 h: a proteção do Auth exigiria reautenticação numa chamada direta)
  for (const x of falso.estado.sessoes.values()) x.criadaEm -= 26 * 3600 * 1000;   // envelhece as sessões abertas (o token continua válido; só a idade da sessão muda)
  await ir(ctx.pg, '/config'); await ctx.pg.fill('#sn-atual', 'errada-errada-1'); await ctx.pg.fill('#sn-nova', 'terceira-senha-ana-1'); await ctx.pg.fill('#sn-conf', 'terceira-senha-ana-1'); await ctx.pg.click('form[data-form="alterar-senha"] button[type="submit"]');
  await ctx.pg.waitForSelector('form[data-form="alterar-senha"] [role="alert"]');
  ok(/atual não confere/.test(await ctx.pg.textContent('form[data-form="alterar-senha"] [role="alert"]')) && falso.estado.senhas.get('ana@exemplo.invalid') === 'nova-senha-da-ana-1', 'conta: alterar a senha exige a senha atual (errada, nada muda)');
  await ctx.pg.fill('#sn-atual', 'nova-senha-da-ana-1'); await ctx.pg.click('form[data-form="alterar-senha"] button[type="submit"]'); await ctx.pg.waitForSelector('form[data-form="alterar-senha"] [role="status"]', { timeout: 20000 });
  ok(falso.estado.senhas.get('ana@exemplo.invalid') === 'terceira-senha-ana-1', 'conta: com a senha atual certa a própria senha é alterada, mesmo com a sessão deste aparelho criada há mais de 24 h (a troca usa uma sessão recém-provada, sem API administrativa)');
  // uma sessão antiga (mais de 24 h) chamando o PROVEDOR diretamente, sem nonce de reautenticação: recusada pelo próprio Auth (Secure password change)
  const sessoes = [...falso.estado.sessoes.values()]; for (const x of sessoes) x.criadaEm -= 26 * 3600 * 1000;
  const tokAntigo = await (async () => { const r = await apiFalso('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: 'ana@exemplo.invalid', password: 'terceira-senha-ana-1' }) }); const j = await r.json(); falso.estado.sessoes.get(JSON.parse(Buffer.from(j.access_token.split('.')[1], 'base64url').toString()).session_id).criadaEm -= 26 * 3600 * 1000; return j.access_token; })();
  const semProva = await fetch(`${falso.url}/auth/v1/user`, { method: 'PUT', headers: { apikey: CHAVE_PUBLICA, 'content-type': 'application/json', authorization: `Bearer ${tokAntigo}` }, body: JSON.stringify({ password: 'senha-sem-prova-1' }) });
  ok(semProva.status === 401 && (await semProva.json()).error_code === 'reauthentication_needed' && falso.estado.senhas.get('ana@exemplo.invalid') === 'terceira-senha-ana-1', 'provedor: uma sessão antiga que chama o Auth direto para trocar a senha, sem reautenticação, é recusada (Secure password change simulado)');
  deslocamento = 0;
  await ctx.ctx.close(); await reuso.ctx.close();
}

// ---------- 9) a rotina diária não depende de sessão e roda uma vez ----------
{
  const r1 = await fetch(BASE + '/api/cron/diaria', { headers: { authorization: 'Bearer segredo-de-teste-1234567890' } }), c1 = await r1.json();
  const r2 = await fetch(BASE + '/api/cron/diaria', { headers: { authorization: 'Bearer segredo-de-teste-1234567890' } });
  ok(r1.status === 200 && c1.ok === true && c1.usuarios === 1 && (await r2.json()).usuarios === 1 && (await db.query('select count(*)::int n from public.resumos_operacionais where data_ref = public.hoje()')).rows[0].n === 1, 'rotina diária: o segredo basta (sem sessão), com várias contas calcula UM resumo do painel e repetir não duplica');
}

ok(erros.filter((e) => !/Failed to load resource|net::ERR|status of 4|status of 5|due to access control/i.test(e)).length === 0, 'sem erros de página nem de console inesperados' + (erros.length ? ': ' + JSON.stringify(erros.slice(0, 3)) : ''));
await edge.close(); servidor.parar(); falso.parar(); await esperar(1500); await db.close();
process.exit(v.resumo());
