// Verificação MÍNIMA e SÓ DE LEITURA da entrada direta no ambiente real (nada é gravado, nada é apagado). Nunca imprime chave, e-mail nem conteúdo: só estados HTTP e contagens.
// Rodar somente com autorização específica, nas fases do plano (docs/plano-retirada-aparelhos.md):
//   fase 1, depois de aplicar a migração 20261119000000, ANTES de publicar o código:
//     node --env-file=.env.local scripts/verificar-entrada-direta-real.mjs rest
//   depois da publicação (e de novo depois da fase 2):
//     node --env-file=.env.local scripts/verificar-entrada-direta-real.mjs dominio https://dmanda-adm.vercel.app
// O --env-file entrega as variáveis ao processo; este arquivo não as lê nem as mostra. Código de saída 0 só se tudo passar.
const [modo, dominio] = process.argv.slice(2);
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, ''), chave = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const local = process.env.VERIFICAR_LOCAL === 'sim';   // só o teste automático (testar:acesso-direto) liga: aceita http://localhost no lugar do https do projeto real
const enderecoOk = (u, real) => (local ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(u) : real.test(u));
let falhas = 0;
const ok = (c, m) => { if (!c) falhas++; console.log((c ? 'ok     ' : 'FALHOU ') + m); };

async function rpc(funcao, args = {}, cabecalhos = { apikey: chave, authorization: `Bearer ${chave}` }) {
  const r = await fetch(`${url}/rest/v1/rpc/executar_como_titular`, { method: 'POST', headers: { 'content-type': 'application/json', ...cabecalhos }, body: JSON.stringify({ p_funcao: funcao, p_args: args }) });
  let corpo = null; try { corpo = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, corpo };
}

async function rest() {
  ok(enderecoOk(url, /^https:\/\/[a-z0-9]+\.supabase\.co$/) && chave.length > 20, 'ambiente: endereço do projeto e chave de serviço presentes (valores não exibidos)');
  const lista = [['listar_opcoes', {}], ['listar_demandas', { p_arquivadas: false }], ['listar_demandas', { p_arquivadas: true }], ['listar_entradas', { p_arquivadas: false }], ['listar_eventos', {}], ['listar_dias_indisponiveis', {}]];
  const n = {};
  for (const [f, a] of lista) {
    const r = await rpc(f, a);
    const qtd = Array.isArray(r.corpo) ? r.corpo.length : null;
    n[f + JSON.stringify(a)] = qtd;
    ok(r.status === 200 && qtd !== null, `${f} ${JSON.stringify(a)}: HTTP ${r.status}, ${qtd === null ? 'resposta fora do formato' : qtd + ' registro(s)'}`);
  }
  const fora = await rpc('rotina_diaria');
  ok(fora.status >= 400 && /não permitida/i.test(JSON.stringify(fora.corpo)), `função fora da lista (rotina_diaria) é recusada: HTTP ${fora.status}`);
  const extra = await rpc('listar_opcoes', { p_x: 1 });
  ok(extra.status >= 400 && /desconhecido/i.test(JSON.stringify(extra.corpo)), `argumento que não existe na função é recusado: HTTP ${extra.status}`);
  const semChave = await rpc('listar_opcoes', {}, {});
  ok(semChave.status === 401 || semChave.status === 403, `sem chave nenhuma o endereço recusa: HTTP ${semChave.status}`);
  console.log('Contagens (conferir com o que o Éder conhece):', JSON.stringify(n));
}

async function app() {
  const base = (dominio || '').replace(/\/$/, '');
  ok(enderecoOk(base, /^https:\/\/[a-z0-9.-]+$/), `domínio informado: ${base || '(vazio)'}`);
  for (const rota of ['/', '/demandas', '/agenda', '/config', '/entradas']) {
    const r = await fetch(base + rota, { redirect: 'manual' }); const t = await r.text();
    ok(r.status === 200 && !r.headers.get('set-cookie') && !(chave && t.includes(chave)) && !/sb_secret_|acesso_autorizado|executar_como_titular/.test(t), `${rota}: HTTP ${r.status}, sem cookie, sem segredo nem objeto interno no HTML`);
    if (rota === '/config') ok(!/Aparelhos|código de uso único|Digite o código/i.test(t), '/config: sem a seção Aparelhos nem pedido de código');
  }
  for (const rota of ['/acesso', '/login']) { const r = await fetch(base + rota, { redirect: 'manual' }); ok(r.status === 307 && ((r.headers.get('location') || '').replace(base, '') || '/') === '/', `${rota}: HTTP ${r.status} para ${r.headers.get('location')}`); }
  const ex = await fetch(base + '/api/exportar'); let j = null; try { j = await ex.json(); } catch { /* */ }
  ok(ex.status === 200 && j?.formato === 'dmanda-exportacao' && j?.versao === 4, `/api/exportar: HTTP ${ex.status}, formato ${j?.formato}, versão ${j?.versao}`);
  if (j) {
    console.log('Exportação (contagens):', JSON.stringify({ demandas: j.demandas?.length, arquivadas: j.arquivadas?.length, entradas: j.entradas?.length, eventos: j.eventos?.length, dias_indisponiveis: j.dias_indisponiveis?.length }));
    if (url && chave) {
      const a = await rpc('listar_demandas', { p_arquivadas: false }), b = await rpc('listar_demandas', { p_arquivadas: true });
      ok(Array.isArray(a.corpo) && a.corpo.length === j.demandas.length && Array.isArray(b.corpo) && b.corpo.length === j.arquivadas.length, 'exportação do domínio e leitura direta do banco têm as mesmas contagens de demandas');
    }
  }
  const cron = await fetch(base + '/api/cron/diaria'); ok(cron.status === 401, `/api/cron/diaria sem credencial: HTTP ${cron.status}`);
  const sonda = await fetch(base + '/api/sonda'); ok(sonda.status === 204, `/api/sonda: HTTP ${sonda.status}`);
}

if (modo === 'rest') await rest(); else if (modo === 'dominio') await app(); else { console.log('Uso: rest | dominio <https://endereço>'); process.exit(2); }
console.log(falhas ? `${falhas} falha(s).` : 'Tudo certo.');
process.exit(falhas ? 1 : 0);
