// Limites de tamanho dos campos de texto de uma demanda e de um dia indisponível: a tela (maxLength), a validação do servidor (nucleo/validacao.ts) e as regras puras usam estes valores.
// O banco repete cada um em constraints (supabase/migrations): mudar um valor aqui exige uma migração nova. Entradas e eventos têm os seus em lib/entradas.ts e lib/eventos.ts.
export const LIMITES = {
  assunto: 300,
  numero: 80,
  tipo: 80,
  origem: 160,
  setor: 160,
  descricao: 20_000,
  /** O nome de uma origem ou de um tipo de documento cadastrável. */
  opcao: 80,
  diaDescricao: 160,
} as const;
