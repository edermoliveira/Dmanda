// Datas do calendário (AAAA-MM-DD), em UTC puro: sem fuso e sem relógio, então não há deslocamento de dia. Uma só definição para os prazos, a Agenda, os eventos e a validação do servidor.

export const MS_DIA = 86_400_000;
export const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Os milissegundos (UTC) do início de uma data AAAA-MM-DD (aceita um carimbo ISO: só a data conta). */
export const emMs = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(a, m - 1, d); };
export const paraISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Data no formato certo E que existe no calendário: o Date.parse do JavaScript aceita 30 de fevereiro (vira 2 de março) e o banco recusa, então a conferência refaz a data. */
export const dataExiste = (v: string) => {
  if (!DATA_ISO.test(v)) return false;
  const [a, m, d] = v.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
};
