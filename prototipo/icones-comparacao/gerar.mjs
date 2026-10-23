// Gera index.html (comparação de ícones do menu). Uso: node gerar.mjs (dentro desta pasta).
// Só comparação: não altera o aplicativo e não adiciona dependência. Origem e licenças em ORIGEM.md.
import { readFileSync, writeFileSync } from 'node:fs';
const ler = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
globalThis.window = {};
new Function('window', ler('../icones-iconoir.js'))(window);
new Function('window', ler('../icones.js'))(window);

const ITENS = [['Início', 'house'], ['Entradas', 'inbox'], ['Demandas', 'square-kanban'], ['Agenda', 'calendar'], ['Documentos', 'file-text'], ['IA', 'sparkles'], ['Configurações', 'settings']];
const SEL = 2; // item selecionado no exemplo: Demandas
const svgLinha = (corpo) => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + corpo + '</svg>';
const limpar = (s, cheio) => s.replace(/^(<svg[^>]*?) width="\d+" height="\d+"/, '$1').replace(/#000/g, 'currentColor').replace('<svg ', '<svg class="ic" aria-hidden="true" ' + (cheio ? 'fill="currentColor" ' : ''));
const lerSvg = (f, cheio) => limpar(ler(f), cheio);

const FAMILIAS = [
  { id: 'iconoir', nome: 'Iconoir (atual)', lic: 'MIT', nota: 'Linha fina e redonda. Só tem versão sólida para 2 dos 7 itens do menu (Entradas e IA); nos outros, o selecionado repete o desenho.',
    normal: (i) => svgLinha(window.ICONOIR[ITENS[i][1]]), sel: (i) => svgLinha(window.ICONOIR[ITENS[i][1]]), comPar: false },
  { id: 'lucide', nome: 'Lucide (alternativa já no protótipo)', lic: 'ISC', nota: 'Linha uniforme e neutra. Sem versão cheia: o selecionado depende só do ladrilho.',
    normal: (i) => svgLinha(window.ICONES[ITENS[i][1]]), sel: (i) => svgLinha(window.ICONES[ITENS[i][1]]), comPar: false },
  { id: 'phosphor', nome: 'Phosphor (recomendado)', lic: 'MIT', nota: 'Tem os pares linha e cheio (regular e fill) para todos os itens, como o par símbolo e símbolo.fill dos apps da Apple, mais a versão duotone para o Grafite.',
    arq: ['house', 'tray', 'kanban', 'calendar-blank', 'file-text', 'sparkle', 'gear'],
    normal(i) { return lerSvg('phosphor/' + this.arq[i] + '.svg', true); }, sel(i) { return lerSvg('phosphor/' + this.arq[i] + '-fill.svg', true); }, comPar: true },
  { id: 'ionicons', nome: 'Ionicons (traço estilo iOS)', lic: 'MIT', nota: 'Desenhado para iOS, traço mais grosso e cantos arredondados, com par linha e cheio. Conjunto menor e com menos símbolos de escritório.',
    arq: ['home', 'file-tray', 'albums', 'calendar', 'document-text', 'sparkles', 'settings'],
    normal(i) { return lerSvg('ionicons/' + this.arq[i] + '-outline.svg', true); }, sel(i) { return lerSvg('ionicons/' + this.arq[i] + '.svg', true); }, comPar: true },
];

const menu = (f, modo, rec) => '<div class="menu ' + modo + (rec ? ' rec' : '') + '">' + ITENS.map((it, i) =>
  '<div class="it' + (i === SEL ? ' sel' : '') + '"><span class="pe">' + (i === SEL ? f.sel(i) : f.normal(i)) + '</span>' + (rec ? '' : '<span class="tx">' + it[0] + '</span>') + '</div>').join('') + '</div>';
const linha = (f) => '<div class="linha24">' + ITENS.map((_, i) => '<span>' + f.normal(i) + '</span>').join('') + '<i></i>' + ITENS.map((_, i) => '<span>' + f.sel(i) + '</span>').join('') + '</div>';
const duo = () => '<div class="linha24">' + ['house', 'tray', 'kanban', 'calendar-blank', 'file-text', 'sparkle', 'gear'].map((a) => '<span>' + lerSvg('phosphor/' + a + '-duotone.svg', true) + '</span>').join('') + '</div>';

const css = `
:root { --fundo: #EDEDF0; --txt: #0A0A0A; --txt2: #4A4A52; --card: #FCFCFC; --brd: #D4D4DA; --acc: #4B3FD9; --ink: #FCFCFC; }
@media (prefers-color-scheme: dark) { :root { --fundo: #141416; --txt: #FCFCFC; --txt2: #B4B4BC; --card: #1C1C1E; --brd: #3A3A40; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 48px; background: var(--fundo); color: var(--txt); font: 15px/1.5 system-ui, "Segoe UI", sans-serif; }
main { max-width: 1100px; margin: 0 auto; }
h1 { font-size: 26px; margin: 0 0 4px; } h2 { font-size: 18px; margin: 0 0 4px; }
.sub { color: var(--txt2); margin: 0 0 20px; max-width: 70ch; }
section.fam, section.por { background: var(--card); border: 1px solid var(--brd); border-radius: 20px; padding: 20px; margin: 0 0 20px; }
section.fam.rec { border-color: var(--acc); box-shadow: 0 0 0 2px var(--acc); }
.lic { color: var(--txt2); font-size: 13px; } .nota { color: var(--txt2); margin: 6px 0 14px; max-width: 75ch; }
.cenas { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.menu { width: 220px; padding: 12px; border-radius: 28px; background: var(--m-bg); color: var(--m-tx); border: 1px solid var(--m-brd); display: grid; gap: 4px; }
.menu.rec { width: 72px; justify-items: center; }
.menu.claro { --m-bg: #F4F4F7; --m-tx: #0A0A0A; --m-brd: #D4D4DA; }
.menu.escuro { --m-bg: #1C1C1E; --m-tx: #FCFCFC; --m-brd: #3A3A40; }
.it { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 8px; border-radius: 16px; font-weight: 600; font-size: 14px; width: 100%; }
.menu.rec .it { width: 44px; padding: 0; justify-content: center; }
.it.sel { background: var(--acc); color: var(--ink); }
.pe { display: grid; place-items: center; width: 28px; height: 28px; }
.ic { width: 22px; height: 22px; }
.linha24 { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 14px; }
.linha24 .ic { width: 26px; height: 26px; } .linha24 i { width: 1px; height: 24px; background: var(--brd); }
.legenda { font-size: 12px; color: var(--txt2); margin-top: 6px; }
.por li { margin: 6px 0; }
`;

const corpo = FAMILIAS.map((f) => '<section class="fam' + (f.id === 'phosphor' ? ' rec' : '') + '"><h2>' + f.nome + '</h2><div class="lic">Licença ' + f.lic + (f.comPar ? ' · par linha e cheio para todos os itens' : '') + '</div><p class="nota">' + f.nota + '</p>' +
  '<div class="cenas">' + menu(f, 'claro', false) + menu(f, 'escuro', false) + menu(f, 'claro', true) + menu(f, 'escuro', true) + '</div>' +
  linha(f) + '<div class="legenda">Faixa de ícones: 7 normais, uma barra, 7 selecionados.</div>' +
  (f.id === 'phosphor' ? duo() + '<div class="legenda">Phosphor em duotone (ideia para o tema Grafite).</div>' : '') + '</section>').join('');

const html = '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Comparação de ícones do menu</title>\n<style>' + css + '</style></head><body><main>\n' +
  '<h1>Comparação de ícones do menu</h1>\n<p class="sub">Os 7 itens do menu do Dmanda, com <b>Demandas</b> selecionado, em claro e escuro, expandido e recolhido. Só comparação: o aplicativo não foi alterado.</p>\n' + corpo +
  '<section class="por"><h2>Por que Phosphor</h2><ul>' +
  '<li><b>Estado selecionado de verdade:</b> linha para normal e cheio para selecionado nos 7 itens, o mesmo gesto das barras da Apple no iPhone e no iPad. Hoje só 2 dos 7 itens do Iconoir têm versão sólida.</li>' +
  '<li><b>Legibilidade em 22 px:</b> o traço regular é firme sobre vidro e sobre o ladrilho colorido.</li>' +
  '<li><b>Consistência:</b> uma única grade e vários pesos (regular, cheio, duotone), o que atende a escolha de estilo de ícones por tema.</li>' +
  '<li><b>Licença e web:</b> MIT, SVG puro com currentColor, sem fonte e sem JavaScript, serve para a web e para o PWA. A SF Symbols da Apple não pode ser usada fora de apps Apple.</li>' +
  '<li><b>Custo:</b> a troca mexe só na função única de ícone, e os desenhos podem ser copiados como SVG, sem dependência de produção.</li></ul>' +
  '<p class="lic">Origem e licenças dos arquivos: ver ORIGEM.md.</p></section></main></body></html>';
writeFileSync(new URL('index.html', import.meta.url), html);
console.log('index.html gerado,', html.length, 'bytes');
