// Teste dos fluxos principais do protótipo, como o usuário faria: IA registrando entrada e evento (com
// desfazer e ajustar), edição de tarefa, Cadastro indo para Vistos, "+" do dia na Agenda e Pomodoro.
// Uso (dentro da pasta prototipo): node testes/fluxos.mjs [tema]   (padrão: d, o Catalyst)
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const tema = process.argv[2] || 'd';
const srv = await servir();
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1480, height: 1000 } });
const erros = [], falhas = [];
p.on('pageerror', (e) => erros.push(e.message));
const conferir = (nome, ok, visto) => { console.log((ok ? 'ok    ' : 'FALHOU') + ' ' + nome + (ok ? '' : ' (veio: ' + JSON.stringify(visto) + ')')); if (!ok) falhas.push(nome); };
const ir = async (o) => { await p.evaluate((x) => window.DM.trocar(Object.assign({ modal: null }, x)), o); await p.waitForTimeout(250); };

await p.goto(srv.url + '#dir=' + tema + '&tema=claro&tela=ia&balao=nao&aviso=nao');
await p.waitForFunction(() => window.DM && document.querySelector('.app'));

// IA: leitura do texto livre
const frases = ['ligar pro RH amanhã sobre as escalas de fim de ano', 'reunião com a PGM sexta às 10h sobre o parecer do ofício 311', 'ideia: relatório mensal com as demandas por origem', 'audiência na câmara semana que vem'];
for (const f of frases) { await p.fill('.chat-f input', f); await p.press('.chat-f input', 'Enter'); await p.waitForTimeout(150); }
const props = await p.evaluate(() => window.DM.estado.chat.filter((m) => m.prop).map((m) => m.prop));
conferir('IA: ligação vira entrada com tag #rh', props[0].tipo === 'entrada' && props[0].titulo === 'Ligar para o RH' && props[0].tags.includes('rh'), props[0]);
conferir('IA: reunião vira evento na sexta 23/10 às 10:00', props[1].tipo === 'evento' && props[1].dia === 23 && props[1].ini === '10:00' && props[1].titulo === 'Reunião com a PGM', props[1]);
conferir('IA: ideia vira entrada da classe Ideia', props[2].tipo === 'entrada' && props[2].classe === 'Ideia', props[2]);
conferir('IA: sem dia, o evento não é inventado', props[3].tipo === 'evento' && props[3].dia === null, props[3]);

const nEv = await p.evaluate(() => window.DM.EVENTOS.length), nNo = await p.evaluate(() => window.DM.NOTAS_E.length);
await p.click('.prop >> nth=1 >> text=Registrar'); await p.waitForTimeout(150);
conferir('IA: registrar evento', (await p.evaluate(() => window.DM.EVENTOS.length)) === nEv + 1);
await p.click('.prop >> nth=1 >> text=Desfazer'); await p.waitForTimeout(150);
conferir('IA: desfazer evento', (await p.evaluate(() => window.DM.EVENTOS.length)) === nEv);
await p.click('.prop >> nth=0 >> text=Registrar'); await p.waitForTimeout(150);
conferir('IA: registrar entrada', (await p.evaluate(() => window.DM.NOTAS_E.length)) === nNo + 1);
conferir('IA: Registrar fica desligado quando falta o dia', await p.isDisabled('.prop >> nth=3 >> text=Registrar'));
await p.click('.prop >> nth=3 >> text=Ajustar'); await p.waitForTimeout(250);
await p.fill('#m-dia', '2026-10-27'); await p.fill('#m-ini', '10:00'); await p.click('text=Criar evento'); await p.waitForTimeout(250);
conferir('IA: ajustar e salvar marca como registrado', (await p.evaluate(() => window.DM.estado.chat.filter((m) => m.prop)[3].st)) === 'feito');

// tarefa editada no próprio texto
await ir({ tela: 'demandas', vis: 'lista', aberto: { 1: true } });
await p.click('.linha-d .t-txt >> nth=2'); await p.waitForTimeout(120);
await p.fill('.t-ed', 'Redigir a resposta ao TCE'); await p.press('.t-ed', 'Enter'); await p.waitForTimeout(150);
conferir('Tarefa: alterar o texto', (await p.evaluate(() => window.DM.DEMANDAS[0].tarefas[2].t)) === 'Redigir a resposta ao TCE');
await p.click('.linha-d .t-txt >> nth=2'); await p.fill('.t-ed', 'texto que não vale'); await p.press('.t-ed', 'Escape'); await p.waitForTimeout(150);
conferir('Tarefa: Esc desiste da alteração', (await p.evaluate(() => window.DM.DEMANDAS[0].tarefas[2].t)) === 'Redigir a resposta ao TCE');

// primeira tarefa leva de Cadastro para Vistos
await ir({ tela: 'demandas', vis: 'cards' });
await p.evaluate(() => { document.querySelector('.dcard[data-id="4"]').dataset.fix = 'verso'; }); await p.waitForTimeout(700);
await p.click('.dcard[data-id="4"] .face.back [data-act="add"]'); await p.waitForTimeout(150);
await p.keyboard.type('Publicar a portaria de nomeação'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
const d4 = await p.evaluate(() => window.DM.DEMANDAS.find((d) => d.id === 4));
conferir('Vistos: primeira tarefa move a demanda', d4.etapa === 'Vistos' && d4.tarefas[0].t === 'Publicar a portaria de nomeação', d4);

// "+" do dia preenche a data
await ir({ tela: 'agenda', ag: 'mes' });
await p.hover('.ag-cel:nth-child(35)'); await p.waitForTimeout(350);
await p.click('.ag-cel:nth-child(35) .dia-mais'); await p.waitForTimeout(250);
conferir('Agenda: "+" do dia 24 preenche a data', (await p.inputValue('#m-dia')) === '2026-10-24');
await p.fill('#m-titulo', 'Plantão'); await p.click('text=Criar evento'); await p.waitForTimeout(200);
await p.click('.ag-e:has-text("Plantão")'); await p.waitForTimeout(250);
await p.fill('#m-titulo', 'Plantão do RH'); await p.click('text=Salvar alterações'); await p.waitForTimeout(200);
conferir('Agenda: evento abre e é alterado', await p.evaluate(() => window.DM.EVENTOS.some((x) => x[2] === 'Plantão do RH')));

// Pomodoro com tempo escolhido
await ir({ tela: 'inicio' });
await p.fill('[data-pomo-min]', '1'); await p.dispatchEvent('[data-pomo-min]', 'change'); await p.click('[data-act="pomo-play"]'); await p.waitForTimeout(1500);
conferir('Pomodoro: conta a partir do tempo escolhido', /^00:5\d$/.test(await p.textContent('.pomo-t')), await p.textContent('.pomo-t'));
await p.evaluate(() => { window.DM.estado.pomo.fim = Date.now() + 200; }); await p.waitForTimeout(1000);
conferir('Pomodoro: ao terminar, passa para a pausa e avisa', (await p.evaluate(() => window.DM.estado.pomo.modo)) === 'pausa' && /Foco encerrado/.test(await p.textContent('#toast')));

conferir('Sem erros de JavaScript', !erros.length, erros);
await b.close(); srv.fechar();
console.log(falhas.length ? '\n' + falhas.length + ' falha(s).' : '\nTodos os fluxos passaram.');
process.exit(falhas.length ? 1 : 0);
