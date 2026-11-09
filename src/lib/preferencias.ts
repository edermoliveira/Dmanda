// Preferências do Perfil guardadas só neste aparelho (localStorage, chave `dmanda:perfil`): a fonte única do intervalo do balão e, no bloco do Clima, da cidade.
// Regras puras, sem React nem navegador. O que está guardado pode estar corrompido ou ser de outra versão: `preferenciasGuardadas` devolve sempre um valor utilizável, campo a campo.
// Nada daqui é humor ou dado da conta: são ajustes de uso.
import { eObjeto } from './armazenamento.ts';

/** Intervalo do balão de humor, em horas de trabalho. O protótipo aprovado oferece 2, 3 e 4; o padrão é 3 (DECISOES.md, seção 9). */
export const BALAO_OPCOES = [2, 3, 4] as const;
export type BalaoHoras = (typeof BALAO_OPCOES)[number];
export const BALAO_PADRAO: BalaoHoras = 3;

export type PreferenciasPerfil = { balaoH: BalaoHoras };
export const PREFERENCIAS_PADRAO: PreferenciasPerfil = { balaoH: BALAO_PADRAO };
export const CHAVE_PREFERENCIAS = 'dmanda:perfil';

export const balaoValido = (v: unknown): v is BalaoHoras => (BALAO_OPCOES as readonly unknown[]).includes(v);

export function preferenciasGuardadas(bruto: unknown): PreferenciasPerfil {
  const o = eObjeto(bruto) ? bruto : {};
  return { balaoH: balaoValido(o.balaoH) ? o.balaoH : BALAO_PADRAO };
}
