// Ajuste de espaço em lote (cards de Demandas e post-its de Entradas). Cada peça é um gerador: faz suas ESCRITAS no DOM e entrega (yield) uma função de LEITURA
// do layout; o resultado volta pelo próximo next(). O executor roda todas as leituras de uma rodada juntas (o navegador calcula o layout uma só vez) e só depois
// deixa cada peça escrever de novo. Antes, cada peça lia e escrevia em sequência e o navegador recalculava o layout da página inteira a cada leitura (milhares de vezes com centenas de cards).
// O resultado final de cada peça é exatamente o mesmo: as peças são independentes e têm altura fixa (verificado por scripts/verificar-ajuste-cards.mjs).
/** Dentro do gerador: `const v = (yield () => leitura) as Tipo`. */
export type Pedido = Generator<() => unknown, void, unknown>;

const LIMITE_RODADAS = 200;
export function emLote(pecas: Pedido[]) {
  let pend: { g: Pedido; ler: () => unknown }[] = [];
  for (const g of pecas) { const r = g.next(); if (!r.done) pend.push({ g, ler: r.value }); }
  for (let rodada = 0; pend.length && rodada < LIMITE_RODADAS; rodada++) {
    const valores = pend.map((p) => p.ler()); // todas as leituras juntas
    const prox: typeof pend = [];
    pend.forEach((p, i) => { const r = p.g.next(valores[i]); if (!r.done) prox.push({ g: p.g, ler: r.value }); });
    pend = prox;
  }
}

/** Lembra, por peça, o que ela tinha (largura, altura, classes, texto e o "estado do aplicativo") quando foi ajustada: sem mudança, o ajuste anterior continua valendo. */
const ASSINATURAS = new WeakMap<Element, string>();
export type Pendentes<T extends HTMLElement> = T[] & { assinaturas: Map<Element, string> };
/** Grava as assinaturas das peças que acabaram de ser ajustadas. */
export const registrar = (...grupos: Pendentes<HTMLElement>[]) => grupos.forEach((g) => g.assinaturas.forEach((v, el) => ASSINATURAS.set(el, v)));
/** Tudo que muda o ajuste de todas as peças de uma vez (tema, escala, largura do quadro, zoom, fontes), lido uma vez por passada. */
export function epocaDoApp(app: Element, larguraQuadro: number) {
  const atributos = Array.from(app.attributes, (a) => `${a.name}=${a.value}`).join(';');
  return `${larguraQuadro}|${window.devicePixelRatio}|${document.fonts?.status ?? ''}|${atributos}`;
}
/** Devolve só as peças que precisam ser ajustadas de novo. `texto` é o conteúdo que o ajuste NÃO altera. A assinatura nova só é gravada por `emLote` depois que o ajuste termina. */
export function pendentes<T extends HTMLElement>(pecas: T[], epoca: string, forcar: boolean, texto: (p: T) => string): Pendentes<T> {
  const lidas = pecas.map((p) => `${epoca}|${p.clientWidth}x${p.clientHeight}|${p.className}|${texto(p)}`); // leituras juntas, antes de qualquer escrita
  const sai: Pendentes<T> = Object.assign([] as T[], { assinaturas: new Map<Element, string>() });
  pecas.forEach((p, i) => { if (forcar || ASSINATURAS.get(p) !== lidas[i]) { sai.push(p); sai.assinaturas.set(p, lidas[i]); } });
  return sai;
}
