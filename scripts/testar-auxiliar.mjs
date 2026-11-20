// Caminhos NEGATIVOS do auxiliar das suítes de navegador (scripts/auxiliar-navegador.mjs): um teste que não sabe falhar não protege nada. Cada caso roda um script filho de verdade, com uma falha
// deliberada, e confere o que um executor veria: o código de saída, a mensagem, o tempo gasto e se sobrou algum processo. Servidores falsos (processos de Node de poucas linhas) no lugar do Next;
// nada abre banco, navegador nem o Supabase real. Uso: node scripts/testar-auxiliar.mjs
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const PASTA = resolve('.dados-teste/auxiliar'), AUX = pathToFileURL(resolve('scripts/auxiliar-navegador.mjs')).href;
rmSync(PASTA, { recursive: true, force: true }); mkdirSync(PASTA, { recursive: true });
let total = 0, falhas = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// servidor falso: registra cada partida (pid) no arquivo de contagem e age conforme o modo
writeFileSync(`${PASTA}/falso.mjs`, `
import http from 'node:http';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
const [porta, contagem, modo] = process.argv.slice(2);
appendFileSync(contagem, process.pid + '\\n');
const partida = readFileSync(contagem, 'utf8').trim().split('\\n').length;
if (modo === 'sai-na-hora') { console.error('boom: configuração inválida do servidor falso'); process.exit(3); }
if (modo === 'mudo') { setInterval(() => {}, 1000); }
else {
  const srv = http.createServer((q, r) => { r.writeHead(modo === 'erro500' ? 500 : 200); r.end('ok'); });
  srv.on('error', (e) => { console.error(String(e.code) + ' ' + e.message); process.exit(1); });
  srv.listen(Number(porta), () => {
    if (modo === 'cai-depois-de-responder' || (modo === 'cai-na-primeira' && partida === 1)) setTimeout(() => process.exit(0), 3000);
  });
}
`);

const rodarFilho = (nome, corpo, { timeout = 120000 } = {}) => {
  const arquivo = `${PASTA}/${nome}.mjs`;
  writeFileSync(arquivo, `import * as A from '${AUX}';\nconst falso = ${JSON.stringify(`${PASTA}/falso.mjs`)};\n${corpo}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [arquivo], { encoding: 'utf8', timeout });
  return { codigo: r.status, saida: (r.stdout ?? '') + (r.stderr ?? ''), ms: Date.now() - t0 };
};
const partidas = (contagem) => (existsSync(contagem) ? readFileSync(contagem, 'utf8').trim().split('\n').filter(Boolean).map(Number) : []);
const comando = (porta, contagem, modo) => `[process.execPath, [falso, '${porta}', ${JSON.stringify(contagem)}, '${modo}']]`;

// =============================================================================================================================================
// 1) servidor que não consegue iniciar
// =============================================================================================================================================
{
  const c = `${PASTA}/c1.txt`;
  const r = rodarFilho('sai-na-hora', `try { await A.iniciarServidor({ porta: 7150, pasta: 'x', tentativas: 4, estabilizar: 500, comando: ${comando(7150, c, 'sai-na-hora')} }); console.log('SUBIU'); } catch (e) { console.log('ERRO: ' + e.message); process.exit(1); }`);
  ok(r.codigo === 1 && /ERRO: O servidor de teste saiu \(código 3\) antes de responder na porta 7150/.test(r.saida) && /boom: configuração inválida/.test(r.saida) && !/SUBIU/.test(r.saida), 'partida que sai antes de responder: erro claro com o código de saída e as últimas linhas, saída não zero');
  ok(partidas(c).length === 1 && r.ms < 20000, `essa falha não é repetida (a repetição não a resolve): 1 partida, ${Math.round(r.ms / 1000)} s`);
}
{
  const c = `${PASTA}/c2.txt`;
  const r = rodarFilho('mudo', `try { await A.iniciarServidor({ porta: 7151, pasta: 'x', tentativas: 4, estabilizar: 500, esperaMax: 3000, comando: ${comando(7151, c, 'mudo')} }); console.log('SUBIU'); } catch (e) { console.log('ERRO: ' + e.message); process.exit(1); }`);
  const [pid] = partidas(c);
  ok(r.codigo === 1 && /não respondeu em 3 s na porta 7151; foi encerrado/.test(r.saida), 'servidor que nunca responde: espera limitada (3 s no teste, 4 min por padrão), erro claro e saída não zero');
  ok(partidas(c).length === 1 && r.ms < 30000 && pid && !vivo(pid), `sem repetir a partida e sem processo sobrando (${Math.round(r.ms / 1000)} s, pid ${pid} encerrado)`);
}
{
  // porta ocupada por outro processo (que responde): o servidor novo morre com EADDRINUSE e o auxiliar diz isso
  const c = `${PASTA}/c3.txt`;
  // o ocupante é outro processo (o spawnSync do filho trava o laço de eventos deste)
  const srv = spawn(process.execPath, [`${PASTA}/falso.mjs`, '7152', `${PASTA}/ocupante.txt`, 'estavel'], { stdio: 'ignore' });
  await esperar(1500);
  try {
    const r = rodarFilho('porta-ocupada', `try { await A.iniciarServidor({ porta: 7152, pasta: 'x', tentativas: 4, estabilizar: 800, comando: ${comando(7152, c, 'estavel')} }); console.log('SUBIU'); } catch (e) { console.log('ERRO: ' + e.message); process.exit(1); }`);
    ok(r.codigo === 1 && /porta 7152 já está em uso/.test(r.saida) && !/SUBIU/.test(r.saida), 'porta ocupada por outro servidor: não confunde a resposta dele com a do servidor de teste; erro diz que a porta está em uso');
    ok(partidas(c).length === 1, 'porta ocupada não é repetida: 1 partida');
  } finally { srv.kill(); }
}
{
  // porta ocupada por outro processo que responde 500: o ramo "saiu antes de responder", com a causa dita
  const c = `${PASTA}/c3b.txt`;
  const srv = spawn(process.execPath, [`${PASTA}/falso.mjs`, '7157', `${PASTA}/ocupante2.txt`, 'erro500'], { stdio: 'ignore' });
  await esperar(1500);
  try {
    const r = rodarFilho('porta-ocupada-500', `try { await A.iniciarServidor({ porta: 7157, pasta: 'x', tentativas: 4, estabilizar: 800, comando: ${comando(7157, c, 'estavel')} }); console.log('SUBIU'); } catch (e) { console.log('ERRO: ' + e.message); process.exit(1); }`);
    ok(r.codigo === 1 && /saiu \(código 1\) antes de responder na porta 7157: a porta já está em uso/.test(r.saida) && !/SUBIU/.test(r.saida), 'porta ocupada por servidor que responde 500: erro "saiu antes de responder" com a causa (porta em uso), sem repetir');
    ok(partidas(c).length === 1, 'esse caso também faz uma partida só');
  } finally { srv.kill(); }
}

// =============================================================================================================================================
// 2) repetição de partida: limitada e só para quem respondeu e caiu
// =============================================================================================================================================
{
  const c = `${PASTA}/c4.txt`;
  const r = rodarFilho('cai-sempre', `try { await A.iniciarServidor({ porta: 7153, pasta: 'x', tentativas: 3, estabilizar: 4000, comando: ${comando(7153, c, 'cai-depois-de-responder')} }); console.log('SUBIU'); } catch (e) { console.log('ERRO: ' + e.message); process.exit(1); }`);
  const ps = partidas(c);
  ok(r.codigo === 1 && /respondeu e caiu logo em seguida em 3 tentativas seguidas/.test(r.saida) && ps.length === 3, `quem responde e cai é repetido até o limite (3 partidas) e depois falha com erro claro e saída não zero (${ps.length} partidas)`);
  ok(ps.every((p) => !vivo(p)) && r.ms < 60000, `nenhuma partida deixa processo (${Math.round(r.ms / 1000)} s)`);
}
{
  const c = `${PASTA}/c5.txt`;
  const r = rodarFilho('cai-uma-vez', `const s = await A.iniciarServidor({ porta: 7154, pasta: 'x', tentativas: 3, estabilizar: 4000, comando: ${comando(7154, c, 'cai-na-primeira')} });
const r = await fetch(s.base + '/'); console.log('SUBIU ' + r.status); s.parar(); s.parar(); console.log('PAROU');`);
  const ps = partidas(c);
  ok(r.codigo === 0 && /SUBIU 200/.test(r.saida) && /PAROU/.test(r.saida) && ps.length === 2, `uma queda logo depois de responder é resolvida pela segunda partida (${ps.length} partidas)`);
  ok(ps.every((p) => !vivo(p)), 'parar() é idempotente e encerra o servidor; nada sobra');
}

// =============================================================================================================================================
// 3) encerramento e limpeza dos processos criados pelo teste
// =============================================================================================================================================
for (const [nome, fim] of [['saida-com-erro', 'process.exit(1);'], ['excecao', "throw new Error('quebrou depois de subir');"], ['saida-com-exit-zero', 'process.exit(0);'], ['fim-natural', '']]) {
  const c = `${PASTA}/c6-${nome}.txt`;
  const r = rodarFilho(`limpeza-${nome}`, `const s = await A.iniciarServidor({ porta: 7155, pasta: 'x', estabilizar: 500, comando: ${comando(7155, c, 'estavel')} });\nconsole.log('SUBIU');\n${fim}`);
  await esperar(1500);
  const ps = partidas(c);
  ok(/SUBIU/.test(r.saida) && ps.length === 1 && !vivo(ps[0]), `script que termina sem chamar parar() (${nome}, código ${r.codigo}): o servidor de teste é encerrado junto`);
}

// =============================================================================================================================================
// 4) o verificador: falha vira falha, com resumo fiel e saída não zero
// =============================================================================================================================================
{
  const r = rodarFilho('verifica-ok', `const v = A.criarVerificador(); v.ok(true, 'a'); v.ok(true, 'b'); process.exit(v.resumo());`);
  ok(r.codigo === 0 && /Tudo certo: 2 verificações\./.test(r.saida), 'só aprovações: saída 0 e "Tudo certo: 2 verificações."');
}
{
  const r = rodarFilho('verifica-falha', `const v = A.criarVerificador(); v.ok(true, 'passa'); v.ok(v.obtido('valor lido 42') === 'outro', 'confere o valor'); v.ok(true, 'também passa'); process.exit(v.resumo());`);
  ok(r.codigo === 1 && /FALHOU confere o valor\s+obtido: valor lido 42/.test(r.saida) && /1 de 3 verificações falharam\./.test(r.saida) && !/Tudo certo/.test(r.saida), 'uma asserção que falha: aparece como FALHOU com o valor obtido, resumo "1 de 3" e saída 1');
}
{
  const r = rodarFilho('verifica-aguardar', `const v = A.criarVerificador();
await v.aguardar(Promise.resolve(), 'espera que cumpre');
await v.aguardar(Promise.reject(new Error('Timeout 8000ms exceeded.\\n  detalhe interno')), 'espera que estoura');
await v.aguardar(new Promise((_, rej) => setTimeout(() => rej(new Error('tardio')), 50)), 'espera que estoura depois');
process.exit(v.resumo());`);
  ok(r.codigo === 1 && /ok\s+espera que cumpre/.test(r.saida) && /FALHOU espera que estoura \(Timeout 8000ms exceeded\.\)/.test(r.saida) && /FALHOU espera que estoura depois \(tardio\)/.test(r.saida) && /2 de 3 verificações falharam\./.test(r.saida), 'aguardar: o tempo esgotado vira FALHOU com o motivo (só a primeira linha), conta no resumo e dá saída 1');
}
{
  const r = rodarFilho('verifica-excecao', `const v = A.criarVerificador(); v.ok(true, 'antes'); throw new Error('quebrou no meio');`);
  ok(r.codigo !== 0 && !/Tudo certo/.test(r.saida) && /quebrou no meio/.test(r.saida), 'exceção no meio da suíte: saída diferente de zero, sem resumo de aprovação e com a causa à vista');
}
{
  const r = rodarFilho('verifica-vazio', `const v = A.criarVerificador(); process.exit(v.resumo());`);
  ok(r.codigo === 1 && /Nenhuma verificação rodou\./.test(r.saida) && !/Tudo certo/.test(r.saida), 'uma suíte que não rodou nenhuma verificação não é aprovação: "Nenhuma verificação rodou." e saída 1');
}

console.log('\n' + (falhas ? `${falhas} de ${total} verificações falharam.` : `Tudo certo: ${total} verificações.`));
process.exit(falhas ? 1 : 0);
