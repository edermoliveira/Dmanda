// Sobe a prévia (porta 7100) sobre o banco de EXEMPLOS (.dados-teste/exemplos), sem tocar no banco da prévia padrão (.dados-teste/pg). Cria os exemplos se ainda não existirem.
// Só dados fictícios, só desenvolvimento. Para refazer os exemplos do zero: npm run semear:exemplos
import { existsSync } from 'node:fs';
import { PASTA_EXEMPLOS, semearExemplos } from './semear-exemplos.mjs';

const pasta = process.env.DMANDA_PASTA_TESTE || PASTA_EXEMPLOS;
if (!existsSync(pasta)) { await semearExemplos(pasta); console.log(`Exemplos fictícios criados em ${pasta}.`); }
process.env.DMANDA_PASTA_TESTE = pasta;
await import('./dev-teste.mjs');
