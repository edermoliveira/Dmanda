// Preferências do Perfil guardadas só neste aparelho (localStorage, chave `dmanda:perfil`): a fonte única do intervalo do balão e da cidade do clima.
// Regras puras, sem React nem navegador. O que está guardado pode estar corrompido ou ser de outra versão: `preferenciasGuardadas` devolve sempre um valor utilizável, campo a campo.
// Nada daqui é humor ou dado da conta: são ajustes de uso.
import { eObjeto } from './armazenamento.ts';
import { CIDADE_PADRAO, cidadeGuardada, type Cidade } from './clima.ts';

/** Intervalo do balão de humor, em horas de trabalho. O protótipo aprovado oferece 2, 3 e 4; o padrão é 3 (DECISOES.md, seção 9). */
export const BALAO_OPCOES = [2, 3, 4] as const;
export type BalaoHoras = (typeof BALAO_OPCOES)[number];
export const BALAO_PADRAO: BalaoHoras = 3;

export type PreferenciasPerfil = { balaoH: BalaoHoras; /** Cidade do clima do Início (Taquara/RS por padrão). */ cidade: Cidade };
export const PREFERENCIAS_PADRAO: PreferenciasPerfil = { balaoH: BALAO_PADRAO, cidade: CIDADE_PADRAO };
export const CHAVE_PREFERENCIAS = 'dmanda:perfil';

export const balaoValido = (v: unknown): v is BalaoHoras => (BALAO_OPCOES as readonly unknown[]).includes(v);

export function preferenciasGuardadas(bruto: unknown): PreferenciasPerfil {
  const o = eObjeto(bruto) ? bruto : {};
  return { balaoH: balaoValido(o.balaoH) ? o.balaoH : BALAO_PADRAO, cidade: cidadeGuardada(o.cidade) };
}
