// Preferências visuais (src/lib/aparencia.ts): contraste, limites do tamanho do texto e variáveis das cores personalizadas. Uso: node scripts/testar-aparencia.mjs
import { contraste, problemaDeContraste, variaveisDoModo, limitarEscala, lerCores, hexValido, PADRAO, ESCALA_MIN, ESCALA_MAX } from '../src/lib/aparencia.ts';
import { readFileSync } from 'node:fs';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log((c ? 'ok     ' : 'FALHOU ') + m); if (!c) falhas++; };
ok(Math.abs(contraste('#FFFFFF', '#000000') - 21) < 0.01, 'contraste branco/preto = 21:1');
for (const modo of ['claro', 'escuro']) ok(problemaDeContraste(modo, {}) === null, `padrão Órbita (${modo}) passa no contraste`);
ok(contraste('#080A0C', '#6F8096') >= 4.5, 'tinta escura sobre o acento padrão tem 4,5:1 ou mais');
ok(contraste('#6F8096', '#080A0C') >= 3 && contraste(PADRAO.claro.texto, PADRAO.claro.fundo) >= 4.5, 'acento sobre o fundo escuro ≥ 3:1; texto claro sobre fundo claro ≥ 4,5:1');
ok(/difícil de ler/.test(problemaDeContraste('escuro', { texto: '#333333' })), 'texto escuro sobre fundo escuro é recusado');
ok(/quase some/.test(problemaDeContraste('escuro', { acento: '#101418' })), 'acento que some no fundo é recusado');
ok(Object.keys(variaveisDoModo('escuro', { fundo: '#111111', texto: '#222222' })).length === 0, 'combinação reprovada não gera variável alguma (cai no padrão)');
const v = variaveisDoModo('escuro', { acento: '#4A6A90' });
ok(v['--u-acento'] === '#4A6A90' && contraste(v['--u-acento-texto'], PADRAO.escuro.fundo) >= 4.5, 'acento escolhido ganha um texto de acento derivado com 4,5:1');
ok(Object.keys(variaveisDoModo('claro', undefined)).length === 0 && Object.keys(variaveisDoModo('claro', {})).length === 0, 'sem escolha do usuário nada é sobrescrito');
ok(limitarEscala(5) === ESCALA_MAX && Math.abs(limitarEscala(0.1) - ESCALA_MIN) < 1e-9 && limitarEscala('x') === 1 && limitarEscala(NaN) === 1, 'tamanho do texto limitado a 85% e 130%, valor estranho volta a 100%');
ok(Math.abs(limitarEscala(1.12) - 1.1) < 1e-9, 'tamanho do texto vai de 5 em 5%');
const c = lerCores({ escuro: { fundo: '#0a0b0c', texto: 'vermelho', acento: '#6f8096' }, claro: 'x', outro: {} });
ok(c.escuro.fundo === '#0A0B0C' && c.escuro.acento === '#6F8096' && !('texto' in c.escuro) && !c.claro && hexValido('#abcdef') && !hexValido('#abc'), 'leitura das cores guardadas ignora o que não é cor válida');
const css = readFileSync('src/estilos/orbita.css', 'utf8');
for (const modo of ['claro', 'escuro']) {
  const ini = css.indexOf(`[data-tema="${modo}"] {`), bloco = css.slice(ini, css.indexOf('\n}', ini));
  const pega = (v) => new RegExp(String.raw`--${v}:\s*var\(--u-[a-z-]+,\s*(#[0-9A-Fa-f]{6})\)`).exec(bloco)?.[1].toUpperCase();
  ok(pega('bgbase') === PADRAO[modo].fundo && pega('o-texto') === PADRAO[modo].texto && pega('o-acento') === PADRAO[modo].acento, `padrões de ${modo} em aparencia.ts são os mesmos do orbita.css`);
}
console.log('\n' + (falhas ? falhas + ' de ' + total + ' verificações falharam.' : 'Tudo certo: ' + total + ' verificações.'));
process.exit(falhas ? 1 : 0);
