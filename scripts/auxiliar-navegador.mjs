// Auxiliar das suítes de navegador: o que toda suíte precisa e que antes era copiado em cada arquivo (servidor de teste, Edge, contexto com observação de erros, contador de verificações).
// Mudar a forma de subir o servidor de teste (variáveis, espera, parada) ou de filtrar o ruído do console agora é uma mudança aqui, não em 20 arquivos. Nunca toca o Supabase real: o servidor
// sobe com DMANDA_BANCO=teste (PGlite) numa pasta de dados descartável.
import { chromium, webkit } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { abrirBancoTeste, chamarComoUsuario } from '../src/servidor/banco-teste-base.mjs';

export const USUARIO_TESTE = '00000000-0000-4000-8000-000000000001';
/** O segredo da rotina diária nos servidores de teste (só existe aqui; as suítes que chamam a rota importam esta constante). */
export const SEGREDO_CRON_TESTE = 'segredo-de-teste-1234567890';

/** Contador de verificações: `ok(condicao, mensagem)` imprime "ok" ou "FALHOU"; `resumo()` imprime o total e devolve o código de saída. `obtido` guarda o valor lido para aparecer na mensagem de uma falha. */
export function criarVerificador() {
  const v = { total: 0, falhas: 0, ultimo: '' };
  v.ok = (condicao, mensagem) => {
    v.total++;
    console.log((condicao ? 'ok     ' : 'FALHOU ') + mensagem + (condicao || !v.ultimo ? '' : `\n        obtido: ${String(v.ultimo).slice(0, 700)}`));
    if (!condicao) v.falhas++;
    v.ultimo = '';
  };
  v.obtido = (valor) => { v.ultimo = valor; return valor; };
  v.resumo = () => {
    console.log(v.falhas ? `\n${v.falhas} de ${v.total} verificações falharam.` : `\nTudo certo: ${v.total} verificações.`);
    return v.falhas ? 1 : 0;
  };
  return v;
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Prepara o titular de teste num banco já aberto (usuário e e-mail autorizado). */
export async function prepararTitularDeTeste(db, usuario = USUARIO_TESTE) {
  await db.query("insert into auth.users (id, email) values ($1, 'teste@dmanda.local') on conflict do nothing", [usuario]);
  await db.query("insert into dmanda_privado.acesso_autorizado (email) values ('teste@dmanda.local') on conflict do nothing");
}

/**
 * Abre o banco de teste da pasta, prepara o titular, entrega `chamar(funcao, args)` (o titular de teste chamando uma função SQL) e fecha o banco ao final de `semear(chamar, db)`.
 * Serve às sementes feitas ANTES de o servidor subir: o PGlite de uma pasta não é compartilhado entre dois processos.
 */
export async function semearBanco(pasta, semear, usuario = USUARIO_TESTE) {
  const db = await abrirBancoTeste({ pasta });
  try {
    await prepararTitularDeTeste(db, usuario);
    return await semear((funcao, args) => chamarComoUsuario(db, usuario, funcao, args), db);
  } finally { await db.close(); }
}

/** O instante de uma data de referência (AAAA-MM-DD) com a hora de agora em Brasília: o relógio do navegador de teste vive naquele dia sem parar de andar. */
export function instanteDaReferencia(referencia) {
  const hora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false });
  return new Date(`${referencia}T${hora}-03:00`);
}

const ativos = new Set();
let ganchoDeSaida = false;
const encerrar = (processo) => {
  if (!ativos.delete(processo)) return;
  try { spawnSync('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* já parou */ }
};

/**
 * Sobe o `next dev` com o banco de teste na `pasta` e na `porta`, espera ele responder e devolve `{ base, processo, parar }`. `parar()` é idempotente e encerra a árvore de processos; os que sobrarem
 * são encerrados ao sair do script. Dá para subir outro servidor (outra pasta, outra rodada) depois de `parar()`; depois de parar, um `await esperar(2500)` deixa o Windows soltar a pasta do PGlite.
 * O Next às vezes sai logo depois de responder, ao mostrar um aviso de atualização, e repetir a partida resolve: por isso a resposta só vale se o processo continuar de pé depois de `estabilizar` ms
 * (6 s), e a partida é repetida até `tentativas` vezes. Se nenhuma funcionar, lança um erro (em vez de deixar o navegador falhar sem explicação).
 * `lembretes: true` mantém os lembretes do Perfil ligados (as outras suítes os desligam). `cron: true` define o segredo da rotina diária (sem ele a rota responde 503; só quem a chama precisa).
 * `env` acrescenta ou troca variáveis (um valor `undefined` remove a variável).
 */
export async function iniciarServidor({ porta, pasta, lembretes = false, cron = false, env = {}, tentativas = 4, estabilizar = 6000 }) {
  const completo = { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: pasta, ...(cron ? { CRON_SECRET: SEGREDO_CRON_TESTE } : {}), ...(lembretes ? {} : { DMANDA_SEM_LEMBRETES: 'sim' }), ...env };
  for (const k of Object.keys(completo)) if (completo[k] === undefined) delete completo[k];
  if (!ganchoDeSaida) { ganchoDeSaida = true; process.on('exit', () => { for (const p of [...ativos]) encerrar(p); }); }
  const base = `http://localhost:${porta}`;
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    const processo = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(porta)], { env: completo, stdio: 'ignore' });
    ativos.add(processo);
    for (let i = 0; i < 120 && processo.exitCode === null; i++) {
      let respondeu = false;
      try { respondeu = (await fetch(base + '/')).status < 500; } catch { /* ainda subindo */ }
      if (respondeu) {
        await esperar(estabilizar);
        if (processo.exitCode === null) return { base, processo, parar: () => encerrar(processo) };
        break;
      }
      await esperar(2000);
    }
    encerrar(processo);
  }
  throw new Error(`O servidor de teste não ficou de pé na porta ${porta} em ${tentativas} tentativas.`);
}

/** Encerra todos os servidores de teste que este script subiu (as suítes que reiniciam o servidor entre rodadas chamam como `parar()`). */
export const pararServidores = () => { for (const p of [...ativos]) encerrar(p); };

export const ARGUMENTOS_EDGE = ['--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'];
export const abrirEdge = () => chromium.launch({ channel: 'msedge', headless: true, args: ARGUMENTOS_EDGE });
/** O WebKit do Playwright (motor do Safari no Windows, NÃO o Safari do aparelho); nulo quando não existe neste computador. */
export async function abrirWebkit() {
  return webkit.launch().catch((e) => { console.log('WebKit indisponível neste computador: ' + String(e.message).split('\n')[0]); return null; });
}

/** Ruído de rede esperado nos testes de falha: não conta como erro de console. */
export const RUIDO_ESPERADO = /Failed to load resource|net::ERR|offline|Failed to fetch/i;
/** Junta em `erros` os erros de página e de console (menos o ruído esperado) de uma página. */
export function observarErros(pg, erros, ruido = RUIDO_ESPERADO) {
  pg.on('pageerror', (e) => erros.push('pageerror: ' + e.message.slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido.test(m.text())) erros.push('console: ' + m.text().slice(0, 300)); });
}

/**
 * Um contexto de navegador na data de referência: relógio instalado (`instante`), tema e preferências da Agenda guardados antes de qualquer script da página, erros observados.
 * `opcoes` são as opções do contexto do Playwright (viewport, hasTouch...). `agenda` (opcional) é o valor de "dmanda:agenda".
 */
export async function novoContexto(navegador, { opcoes = {}, instante = null, tema = 'claro', agenda = null, erros }) {
  const ctx = await navegador.newContext(opcoes);
  if (instante) await ctx.clock.install({ time: instante });
  await ctx.addInitScript(([t, a]) => {
    try { localStorage.setItem('dmanda-tema', JSON.stringify(t)); if (a) localStorage.setItem('dmanda:agenda', JSON.stringify(a)); } catch { /* sem armazenamento */ }
  }, [tema, agenda]);
  const pg = await ctx.newPage();
  observarErros(pg, erros);
  return { ctx, pg };
}
