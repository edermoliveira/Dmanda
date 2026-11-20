// Auxiliar das suítes de navegador: o que toda suíte precisa (servidor de teste, Edge, contexto com observação de erros, contador de verificações). Nunca toca o Supabase real: o servidor
// sobe com DMANDA_BANCO=teste (PGlite) numa pasta de dados descartável.
import { chromium, webkit } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { abrirBancoTeste, chamarComoUsuario, prepararTitularDeTeste, USUARIO_TESTE } from '../src/servidor/banco-teste-base.mjs';

export { prepararTitularDeTeste, USUARIO_TESTE };

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
  /** Uma verificação por espera: se `promessa` (um waitFor...) se cumpre, é um "ok"; se estoura o tempo, é um "FALHOU" com o motivo, em vez de derrubar o script sem o resumo. */
  v.aguardar = async (promessa, mensagem) => {
    try { await promessa; v.ok(true, mensagem); } catch (e) { v.ok(false, `${mensagem} (${String(e.message).split('\n')[0]})`); }
  };
  v.resumo = () => {
    // uma suíte que não rodou nenhuma verificação não está aprovada: algo a impediu de chegar nelas
    if (v.total === 0) { console.log('\nNenhuma verificação rodou.'); return 1; }
    console.log(v.falhas ? `\n${v.falhas} de ${v.total} verificações falharam.` : `\nTudo certo: ${v.total} verificações.`);
    return v.falhas ? 1 : 0;
  };
  return v;
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

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
 * Falhas de partida dão erro claro (nunca um navegador falhando sem explicação), cada uma com a sua regra:
 *  - o processo SAIU antes de responder (porta ocupada, erro de configuração...): erro na hora, com as últimas linhas da saída; repetir não resolve, e a porta ocupada é dita como tal;
 *  - NUNCA respondeu em `esperaMax` ms (4 min; até 5 s a mais, o tempo do último pedido): erro, e o processo é encerrado;
 *  - respondeu e CAIU em seguida: é o caso conhecido do Next (sai logo depois de responder, ao mostrar um aviso de atualização) e repetir resolve. Por isso a resposta só vale se o processo continuar
 *    de pé depois de `estabilizar` ms (6 s), e só essa situação repete a partida, até `tentativas` vezes.
 * `lembretes: true` mantém os lembretes do Perfil ligados (as outras suítes os desligam). `cron: true` define o segredo da rotina diária (sem ele a rota responde 503; só quem a chama precisa).
 * `env` acrescenta ou troca variáveis (um valor `undefined` remove a variável). `comando` ([executável, argumentos]) troca o servidor: só o teste do próprio auxiliar o usa.
 */
export async function iniciarServidor({ porta, pasta, lembretes = false, cron = false, env = {}, tentativas = 4, estabilizar = 6000, esperaMax = 240_000, comando = null }) {
  const completo = { ...process.env, DMANDA_BANCO: 'teste', DMANDA_PASTA_TESTE: pasta, ...(cron ? { CRON_SECRET: SEGREDO_CRON_TESTE } : {}), ...(lembretes ? {} : { DMANDA_SEM_LEMBRETES: 'sim' }), ...env };
  for (const k of Object.keys(completo)) if (completo[k] === undefined) delete completo[k];
  if (!ganchoDeSaida) {
    ganchoDeSaida = true;
    process.on('exit', () => { for (const p of [...ativos]) encerrar(p); });
    // Ctrl+C e término pelo sistema não emitem 'exit': sem estes dois, o servidor ficava órfão segurando a porta (o gancho acima só cobre saída normal, erro e exceção)
    for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => { for (const p of [...ativos]) encerrar(p); process.exit(130); });
  }
  const base = `http://localhost:${porta}`;
  const [exe, args] = comando ?? [process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(porta)]];
  const portaOcupada = (saida) => /EADDRINUSE|address already in use/i.test(saida);
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const processo = spawn(exe, args, { env: completo, stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = ''; const guardar = (b) => { saida = (saida + b).slice(-1500); };
    processo.stdout.on('data', guardar); processo.stderr.on('data', guardar);
    // sem isto, um script que termina sem process.exit ficaria preso esperando o servidor que ele mesmo criou, e o gancho de saída nunca rodaria
    processo.unref(); processo.stdout.unref(); processo.stderr.unref();
    ativos.add(processo);
    const limite = Date.now() + esperaMax;
    let respondeu = false;
    while (processo.exitCode === null && Date.now() < limite) {
      try { respondeu = (await fetch(base + '/', { signal: AbortSignal.timeout(5000) })).status < 500; } catch { /* ainda subindo */ }
      if (respondeu) break;
      await esperar(Math.min(2000, Math.max(0, limite - Date.now())));
    }
    if (!respondeu) {
      await esperar(200); // deixa a saída final chegar
      const codigo = processo.exitCode;
      encerrar(processo);
      throw new Error(codigo === null
        ? `O servidor de teste não respondeu em ${Math.round(esperaMax / 1000)} s na porta ${porta}; foi encerrado.`
        : `O servidor de teste saiu (código ${codigo}) antes de responder na porta ${porta}${portaOcupada(saida) ? ': a porta já está em uso' : ''}. Últimas linhas: ${saida.trim().slice(-600) || '(sem saída)'}`);
    }
    await esperar(estabilizar);
    if (processo.exitCode === null) return { base, processo, parar: () => encerrar(processo) };
    await esperar(200);
    encerrar(processo);
    if (portaOcupada(saida)) throw new Error(`O servidor de teste não subiu: a porta ${porta} já está em uso por outro processo (quem respondeu não foi este servidor).`);
  }
  throw new Error(`O servidor de teste respondeu e caiu logo em seguida em ${tentativas} tentativas seguidas na porta ${porta}.`);
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
