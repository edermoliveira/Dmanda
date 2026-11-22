// Motor dos rascunhos online (src/lib/fila-rascunhos.ts) contra as funções REAIS do banco de teste (PGlite, mesmas migrações): agrupamento, estados verdadeiros, queda de rede, resposta perdida, respostas fora de ordem,
// duas abas e dois aparelhos, conflito, lápide, isolamento da fila por usuário e ausência de descarte por idade. O relógio e os temporizadores são controlados. NÃO prova o navegador (localStorage real, Web Locks) nem a rede.
// Uso: node scripts/testar-fila-rascunhos.mjs
import { abrirBancoTeste, chamarComoUsuario, prepararAdminDeTeste, criarContaDeTeste } from '../src/servidor/banco-teste-base.mjs';
import { MotorRascunhos, CHAVE_FILA } from '../src/lib/fila-rascunhos.ts';
import { criarVerificador } from './auxiliar-navegador.mjs';
import { randomUUID } from 'node:crypto';

const v = criarVerificador(), ok = v.ok;
const A = 'a1a1a1a1-0000-4000-8000-00000000000a', B = 'b2b2b2b2-0000-4000-8000-00000000000b';
const db = await abrirBancoTeste({ pendentes: true });
await prepararAdminDeTeste(db); await criarContaDeTeste(db, A, 'a@exemplo.invalid'); await criarContaDeTeste(db, B, 'b@exemplo.invalid');
const sql = async (q, p = []) => (await db.query(q, p)).rows;

// relógio e temporizadores controlados
const relogio = { agora: 1_000_000, fila: [] };
const agendar = (f, ms) => { const t = { f, em: relogio.agora + ms, vivo: true }; relogio.fila.push(t); return t; };
const cancelar = (t) => { if (t) t.vivo = false; };
const avancar = async (ms) => { relogio.agora += ms; for (;;) { const t = relogio.fila.filter((x) => x.vivo && x.em <= relogio.agora).sort((a, b) => a.em - b.em)[0]; if (!t) break; t.vivo = false; t.f(); await esperarMicro(); } };
const esperarMicro = () => new Promise((r) => setTimeout(r, 15));
const armazemDe = () => { const m = new Map(); return { m, ler: (k) => m.get(k) ?? null, gravar: (k, x) => m.set(k, x) }; };

// a "rede": toda chamada passa por aqui, onde se injeta queda, resposta perdida e atraso
const rede = { chamadas: [], cai: false, perdeResposta: 0, segura: null, seguraListar: null, listarCai: false };
const apiDe = (usuario) => {
  const chamar = async (fn, args) => {
    rede.chamadas.push(fn);
    if (rede.cai) throw new Error('sem rede');
    if (fn === 'listar_rascunhos' && rede.listarCai) throw new Error('leitura falhou');
    if (fn === 'listar_rascunhos' && rede.seguraListar) await rede.seguraListar;
    if (rede.segura) await rede.segura;
    const r = await chamarComoUsuario(db, usuario, fn, args);
    if (rede.perdeResposta > 0) { rede.perdeResposta--; throw new Error('resposta perdida'); }
    return { ok: true, dados: r };
  };
  return {
    listar: () => chamar('listar_rascunhos', {}),
    salvar: (id, chave, dados, base, op) => chamar('salvar_rascunho', { p_id: id, p_chave: chave, p_dados: dados, p_base: base, p_op: op }),
    resolver: (id, dados, base, op) => chamar('resolver_rascunho', { p_id: id, p_dados: dados, p_base: base, p_op: op }),
    encerrar: (id, chave, estado) => chamar('encerrar_rascunho', { p_id: id, p_chave: chave, p_estado: estado }),
  };
};
const motor = (usuario, armazem = armazemDe(), extra = {}) => new MotorRascunhos({ usuarioId: usuario, api: apiDe(usuario), armazem, agendar, cancelar, agora: () => relogio.agora, online: () => true, ...extra });
const noBanco = async (u, chave) => (await sql("select * from public.rascunhos where user_id = $1 and chave = $2 and estado = 'aberto'", [u, chave]))[0];
const conta = (fn) => rede.chamadas.filter((x) => x === fn).length;
const limpar = async () => { rede.chamadas.length = 0; rede.cai = false; rede.perdeResposta = 0; rede.segura = null; rede.seguraListar = null; rede.listarCai = false; await db.query('delete from public.rascunhos'); };

// ---------- 1) agrupamento e estados verdadeiros ----------
{
  await limpar(); const m = motor(A); await m.iniciar();
  ok(m.estado() === 'nenhum', 'estado: sem rascunho, "nenhum"');
  for (const t of ['O', 'Ol', 'Olá', 'Olá,', 'Olá, mundo']) { m.guardar('e:nova', { dados: { texto: t } }); await avancar(100); }
  ok(conta('salvar_rascunho') === 0 && m.estado() === 'salvando', 'agrupamento: cinco alterações em 500 ms não enviam nada ainda e o estado é "Salvando"');
  await avancar(2000);
  ok(conta('salvar_rascunho') === 1 && m.estado() === 'salvo' && (await noBanco(A, 'e:nova')).dados.dados.texto === 'Olá, mundo' && (await noBanco(A, 'e:nova')).versao === 1, 'agrupamento: depois da pausa vai UMA gravação com o texto final, e só então o estado é "Salvo online"');
  // digitação contínua: o limite máximo envia mesmo sem pausa
  rede.chamadas.length = 0;
  for (let i = 0; i < 12; i++) { m.guardar('e:nova', { dados: { texto: 'contínuo ' + i } }); await avancar(300); }
  ok(conta('salvar_rascunho') >= 1 && conta('salvar_rascunho') <= 3, `agrupamento: digitando sem parar, o envio acontece pelo limite máximo (${conta('salvar_rascunho')} gravações em 12 alterações)`);
  await avancar(1000);
  ok((await noBanco(A, 'e:nova')).dados.dados.texto === 'contínuo 11' && m.estado() === 'salvo', 'agrupamento: ao final o banco tem a última alteração');
  rede.chamadas.length = 0; m.guardar('e:nova', { dados: { texto: 'contínuo 11' } }); await avancar(3000);
  ok(conta('salvar_rascunho') === 0 && m.estado() === 'salvo', 'agrupamento: guardar o mesmo conteúdo de novo não agenda nem envia nada');
  m.parar();
}

// ---------- 2) queda de rede, recarga, reconexão, sem descarte por idade ----------
{
  await limpar(); const arm = armazemDe(); let m = motor(A, arm); await m.iniciar();
  rede.cai = true;
  m.guardar('nova', { dados: { assunto: 'sem rede' }, passo: 2 });
  await avancar(1000);
  ok(m.estado() === 'falha' && m.pendentes() === 1 && !(await noBanco(A, 'nova')), 'rede caída: o estado é "Falha na sincronização", a alteração fica pendente na fila e nada foi ao banco');
  ok(JSON.parse(arm.ler(CHAVE_FILA(A))).itens.nova.pendente === true && !arm.ler('dmanda:rascunhos'), 'fila: a alteração está na fila do usuário (chave por usuário) e a chave antiga, sem autor, não é usada');
  m.parar();
  await avancar(40 * 24 * 3600 * 1000);   // 40 dias depois
  m = motor(A, arm); rede.cai = true; await m.iniciar();
  ok(m.pendentes() === 1 && m.rascunhos().nova.dados.assunto === 'sem rede', 'recarga e idade: depois de recarregar e de 40 dias a alteração ainda está na fila (nenhum descarte por idade)');
  rede.cai = false; await m.tentarDeNovo();
  const b = await noBanco(A, 'nova');
  ok(m.estado() === 'salvo' && b.dados.dados.assunto === 'sem rede' && b.versao === 1 && m.pendentes() === 0, 'reconexão: a fila é reenviada, o banco confirma e só então a fila esvazia e o estado é "Salvo online"');
  m.parar();
}

// ---------- 3) resposta perdida ----------
{
  await limpar(); const m = motor(A); await m.iniciar();
  m.guardar('tarefa', { dados: { assunto: '' }, nt: 'uma tarefa' });
  rede.perdeResposta = 1;
  await m.enviarAgora();
  ok((await noBanco(A, 'tarefa')).versao === 1 && m.estado() === 'falha' && m.pendentes() === 1, 'resposta perdida: o banco gravou, o aparelho não soube: continua pendente e em falha (nunca mostra "salvo" sem confirmação)');
  await m.tentarDeNovo();
  const b = await noBanco(A, 'tarefa');
  ok(b.versao === 1 && b.conflitos.length === 0 && m.estado() === 'salvo' && m.pendentes() === 0, 'resposta perdida: o reenvio com a MESMA operação é reconhecido como repetido (versão 1, sem conflito, sem duplicar)');
  m.parar();
}

// ---------- 4) respostas fora de ordem: uma edição nova não é apagada pela resposta da anterior ----------
{
  await limpar(); const m = motor(A); await m.iniciar();
  m.guardar('ev:nova', { dados: { ev: { titulo: 'um' } } });
  let soltar; rede.segura = new Promise((r) => { soltar = r; });
  const envio = m.enviarAgora();
  await esperarMicro();
  m.guardar('ev:nova', { dados: { ev: { titulo: 'dois, digitado durante o envio' } } });   // enquanto a resposta da primeira ainda não chegou
  rede.segura = null; soltar();
  await envio; await avancar(2000);
  const b = await noBanco(A, 'ev:nova');
  ok(b.dados.dados.ev.titulo === 'dois, digitado durante o envio' && b.versao === 2 && m.estado() === 'salvo' && m.pendentes() === 0 && m.rascunhos()['ev:nova'].dados.ev.titulo === 'dois, digitado durante o envio', 'fora de ordem: a confirmação da gravação anterior NÃO apaga a edição mais recente: ela é enviada em seguida (versão 2) e o conteúdo local nunca regride');
  m.parar();
}

// ---------- 5) dois aparelhos da mesma conta: continuação e conflito ----------
{
  await limpar(); const m1 = motor(A), m2 = motor(A);   // armazéns separados = aparelhos diferentes
  await m1.iniciar(); await m2.iniciar();
  const chave = 'd:' + randomUUID(); m1.guardar(chave, { dados: { assunto: 'no aparelho 1' } }); await m1.enviarAgora();
  await m2.sincronizar(); m2.marcarVistos();   // o aparelho 2 abre a janela depois de o rascunho chegar (a janela o lê ao abrir)
  ok(m2.rascunhos()[chave]?.dados.assunto === 'no aparelho 1', 'outro aparelho: a mesma conta, em outro navegador, recupera o rascunho do banco');
  m2.guardar(chave, { dados: { assunto: 'continuado no aparelho 2' } }); await m2.enviarAgora();
  m1.guardar(chave, { dados: { assunto: 'editado no aparelho 1 sem saber do 2' } }); await m1.enviarAgora();
  const b = await noBanco(A, chave);
  ok(b.dados.dados.assunto === 'continuado no aparelho 2' && b.conflitos.length === 1 && b.conflitos[0].dados.dados.assunto === 'editado no aparelho 1 sem saber do 2', 'conflito: o banco mantém a versão do aparelho 2 e guarda a do aparelho 1 ao lado: as duas existem');
  ok(m1.conflitos().length === 1 && m1.rascunhos()[chave].dados.assunto === 'editado no aparelho 1 sem saber do 2' && m1.pendentes() === 0, 'conflito: o aparelho 1 mantém o texto dele, sabe que há conflito e para de enviar essa chave sozinho');
  rede.chamadas.length = 0; m1.guardar(chave, { dados: { assunto: 'mais uma digitação no conflito' } }); await m1.enviarAgora();
  ok(conta('salvar_rascunho') === 0 && (await noBanco(A, chave)).dados.dados.assunto === 'continuado no aparelho 2', 'conflito: enquanto não resolvido, novas digitações não sobrescrevem o banco');
  ok(await m1.resolver(chave, 'meu') && (await noBanco(A, chave)).dados.dados.assunto === 'mais uma digitação no conflito' && (await noBanco(A, chave)).conflitos.length === 0 && m1.conflitos().length === 0, 'resolver: a pessoa escolhe manter a dela e só então o conflito é limpo');
  m1.parar(); m2.parar();
}

// ---------- 6) duas abas do MESMO aparelho (mesmo armazenamento) ----------
{
  await limpar(); const arm = armazemDe(); const t1 = motor(A, arm), t2 = motor(A, arm);
  await t1.iniciar(); await t2.iniciar();
  t1.guardar('e:nova', { dados: { texto: 'aba 1' } }); await t1.enviarAgora();
  await t2.sincronizar(); t2.marcarVistos();   // a aba 2 volta ao primeiro plano, relê o banco e abre a janela já com a instância que a aba 1 confirmou
  t2.guardar('e:nova', { dados: { texto: 'aba 2 sobre a mesma fila' } }); await t2.enviarAgora();
  const b = await noBanco(A, 'e:nova');
  ok(b.dados.dados.texto === 'aba 2 sobre a mesma fila' && b.conflitos.length === 0 && (await sql("select count(*)::int n from public.rascunhos where user_id = $1 and chave = 'e:nova' and estado = 'aberto'", [A]))[0].n === 1, 'duas abas: compartilham a fila e a instância (mesmo id), a segunda grava em cima da primeira na versão certa, sem duplicar rascunho');
  t1.parar(); t2.parar();
}

// ---------- 7) outra instância na mesma chave ----------
{
  await limpar(); const m1 = motor(A), m2 = motor(A); await m1.iniciar(); await m2.iniciar();
  m1.guardar('ev:nova', { dados: { ev: { titulo: 'começou no 1' } } }); await m1.enviarAgora();
  m2.guardar('ev:nova', { dados: { ev: { titulo: 'começou no 2, sem saber' } } }); await m2.enviarAgora();
  const b = await noBanco(A, 'ev:nova');
  ok(b.dados.dados.ev.titulo.startsWith('começou no 1') && b.conflitos.length === 1 && b.conflitos[0].dados.dados.ev.titulo === 'começou no 2, sem saber' && m2.conflitos().length === 1, 'duas instâncias: o rascunho que já estava no banco permanece e o do outro aparelho fica guardado ao lado (nenhum se perde)');
  m1.parar(); m2.parar();
}

// ---------- 8) consumir, descartar e lápide ----------
{
  await limpar(); const arm = armazemDe(); const m = motor(A, arm); await m.iniciar();
  m.guardar('nova', { dados: { assunto: 'vai virar demanda' } }); await m.enviarAgora();
  const idInstancia = (await noBanco(A, 'nova')).id;
  ok(!(arm.ler(CHAVE_FILA(A)) ?? '').includes('vai virar demanda'), 'fila: o que o banco já confirmou NÃO fica no armazenamento do navegador (só o pendente)');
  const antigo = armazemDe(); antigo.gravar(CHAVE_FILA(A), JSON.stringify({ v: 1, lapides: [], itens: { nova: { id: idInstancia, chave: 'nova', valor: { dados: { assunto: 'fila antiga' } }, versao: 1, op: randomUUID(), pendente: true, conflito: null } } }));   // uma "fila antiga" (outra aba ou cópia que ficou para trás) que ainda reenvia o rascunho
  m.consumir('nova'); await m.enviarAgora();
  ok(!(await noBanco(A, 'nova')) && m.pendentes() === 0 && !m.rascunhos().nova && (await sql("select estado from public.rascunhos where user_id = $1 and chave = 'nova'", [A]))[0].estado === 'consumido', 'consumir: confirmado o registro, o rascunho vira lápide no banco e sai da fila');
  const velha = motor(A, antigo); await velha.iniciar(); await velha.enviarAgora();
  ok(!(await noBanco(A, 'nova')) && velha.pendentes() === 0 && !velha.rascunhos().nova, 'lápide: uma fila antiga que ainda reenvia o rascunho consumido recebe "encerrado" e NÃO o recria (e se limpa)');
  m.guardar('e:nova', { dados: { texto: 'a ser cancelado' } }); await m.enviarAgora();
  m.guardar('e:nova', null); await m.enviarAgora();
  ok(!(await noBanco(A, 'e:nova')) && (await sql("select estado from public.rascunhos where user_id = $1 and chave = 'e:nova' order by criado_em desc limit 1", [A]))[0].estado === 'descartado', 'descartar: Cancelar encerra o rascunho (lápide "descartado"), e ele não volta');
  m.guardar('e:nova', { dados: { texto: 'recomeço depois de cancelar' } }); await m.enviarAgora();
  ok((await noBanco(A, 'e:nova')).dados.dados.texto === 'recomeço depois de cancelar' && m.estado() === 'salvo', 'descartar: depois de cancelar, a mesma chave aceita um rascunho novo (outra instância)');
  // cancelar sem rede: a lápide fica na fila e vale depois
  rede.chamadas.length = 0; rede.cai = true; m.guardar('e:nova', null); await m.enviarAgora();
  ok(m.pendentes() === 1 && (await noBanco(A, 'e:nova')), 'descartar sem rede: a lápide fica na fila (pendente) enquanto o banco não confirma');
  rede.cai = false; await m.tentarDeNovo();
  ok(!(await noBanco(A, 'e:nova')) && m.pendentes() === 0, 'descartar sem rede: na reconexão a lápide é enviada e o rascunho some do banco');
  m.parar(); velha.parar();
}

// ---------- 9) isolamento entre contas ----------
{
  await limpar(); const arm = armazemDe();   // o MESMO armazenamento do navegador usado por duas contas, uma depois da outra
  const ma = motor(A, arm); await ma.iniciar(); ma.guardar('nova', { dados: { assunto: 'segredo da A' } }); await ma.enviarAgora(); ma.parar();
  const mb = motor(B, arm); await mb.iniciar();
  ok(Object.keys(mb.rascunhos()).length === 0 && mb.pendentes() === 0 && !(arm.ler(CHAVE_FILA(B)) ?? '').includes('segredo da A'), 'isolamento: ao trocar de conta no mesmo navegador a fila e os rascunhos da outra conta NÃO aparecem');
  mb.guardar('nova', { dados: { assunto: 'da B' } }); await mb.enviarAgora();
  ok(!(arm.ler(CHAVE_FILA(A)) ?? '').includes('segredo da A') && !(arm.ler(CHAVE_FILA(B)) ?? '').includes('da B') && mb.rascunhos().nova.dados.assunto === 'da B' && (await noBanco(A, 'nova')).dados.dados.assunto === 'segredo da A' && (await noBanco(B, 'nova')).dados.dados.assunto === 'da B', 'isolamento: cada conta tem a sua fila (chave por usuário) e o seu rascunho no banco, sem mistura de conteúdo');
  mb.parar();
}

// ---------- 10) recusa do banco não descarta ----------
{
  await limpar(); const m = motor(A); await m.iniciar();
  m.guardar('tarefa', { dados: { x: 'y'.repeat(300_000) } }); await m.enviarAgora();
  ok(m.pendentes() === 1 && m.estado() === 'falha' && m.rascunhos().tarefa, 'recusa: se o banco recusa (tamanho), o conteúdo continua na fila e a falha é mostrada; nada é descartado');
  m.parar();
}

// ---------- 11) primeira leitura atrasada além do limite: a janela abre sem o rascunho online, e ele não pode ser descartado nem sobrescrito ----------
{
  await limpar(); const outro = motor(A); await outro.iniciar();
  outro.guardar('nova', { dados: { assunto: 'rascunho online que já existia' } }); await outro.enviarAgora(); outro.parar();
  let soltar; rede.seguraListar = new Promise((r) => { soltar = r; });
  const m = motor(A); const partida = m.iniciar();
  await esperarMicro(); m.forcarPronto();   // o limite de 4 s estourou (a interface libera as janelas)
  ok(m.pronto && m.leituraPendente && !m.rascunhos().nova && m.estado() !== 'salvo', 'leitura atrasada: estourado o limite, as janelas abrem, a leitura fica marcada como NÃO confirmada (não é "não existe rascunho") e nada aparece como "Salvo online"');
  m.guardar('nova', null);   // a janela aberta sem o rascunho é cancelada antes de a leitura chegar
  rede.seguraListar = null; soltar(); await partida; await m.enviarAgora();
  ok(m.naoVistos().includes('nova') && !m.leituraPendente && (await noBanco(A, 'nova'))?.dados.dados.assunto === 'rascunho online que já existia', 'leitura atrasada: quando a resposta chega, o rascunho online entra marcado como "não visto" e continua no banco (o cancelamento anterior não o tocou)');
  m.guardar('nova', null); await m.enviarAgora();   // fechar a janela depois de a leitura chegar
  ok((await noBanco(A, 'nova'))?.dados.dados.assunto === 'rascunho online que já existia' && conta('encerrar_rascunho') === 0, 'leitura atrasada: fechar ou cancelar a janela que não carregou o rascunho NÃO o descarta');
  m.guardar('nova', { dados: { assunto: 'digitado na janela que abriu sem o rascunho' } }); await m.enviarAgora();
  const b = await noBanco(A, 'nova');
  ok(b.dados.dados.assunto === 'rascunho online que já existia' && b.conflitos.some((c) => c.dados.dados.assunto === 'digitado na janela que abriu sem o rascunho') && m.conflitos().length === 1 && m.estado() !== 'salvo', 'leitura atrasada: digitar nessa janela NÃO sobrescreve o rascunho online: o banco guarda o novo ao lado (conflito, as duas versões) e o estado não diz "Salvo online"');
  m.parar();
}

// ---------- 12) primeira leitura que FALHA, e resposta que só chega depois do erro ----------
{
  await limpar(); const outro = motor(A); await outro.iniciar();
  outro.guardar('tarefa', { dados: { assunto: '' }, nt: 'tarefa online que já existia' }); await outro.enviarAgora(); outro.parar();
  rede.listarCai = true;
  const m = motor(A); await m.iniciar();
  ok(m.pronto && m.leituraPendente && !m.rascunhos().tarefa, 'leitura que falha: a falha não vira "não existe rascunho": a leitura fica pendente e a tela avisa (com Tentar de novo)');
  m.guardar('tarefa', { dados: { assunto: '' }, nt: 'digitado enquanto a leitura falhava' });
  rede.listarCai = false; await m.tentarDeNovo();   // Tentar de novo refaz a leitura e então envia
  const b = await noBanco(A, 'tarefa');
  ok(b.nt === undefined && b.dados.nt === 'tarefa online que já existia' && b.conflitos.some((c) => c.dados.nt === 'digitado enquanto a leitura falhava') && !m.leituraPendente && m.rascunhos().tarefa.nt === 'digitado enquanto a leitura falhava', 'leitura que falha: depois de voltar, o online é preservado e o que foi digitado também (guardado ao lado como conflito), nada sobrescrito');
  m.parar();
  // a resposta chega depois de a tela já mostrar o erro: uma sincronização posterior traz o rascunho, e ele fica protegido
  await limpar(); const o2 = motor(A); await o2.iniciar(); o2.guardar('e:nova', { dados: { texto: 'entrada online existente' } }); await o2.enviarAgora(); o2.parar();
  rede.listarCai = true; const m2 = motor(A); await m2.iniciar(); rede.listarCai = false;
  await m2.sincronizar();   // por exemplo, a aba voltou ao primeiro plano
  m2.guardar('e:nova', null); await m2.enviarAgora();
  ok(m2.naoVistos().includes('e:nova') && (await noBanco(A, 'e:nova'))?.dados.dados.texto === 'entrada online existente', 'resposta depois do erro: o rascunho que chega numa sincronização posterior fica como "não visto" e o descarte da janela já aberta não o apaga');
  m2.marcarVistos();
  ok(m2.naoVistos().length === 0 && m2.rascunhos()['e:nova'].dados.texto === 'entrada online existente', 'resposta depois do erro: ao abrir a janela de novo (marcarVistos), ela recebe o rascunho online');
  m2.parar();
}

await db.close();
process.exit(v.resumo());
