// Cópia dos dados do Dmanda, formato versionado (decisão 92). Versão 5 = versão 4 + autoria (só na cópia da administradora, mapeada por e-mail), situação dos acessos (informativa) e os rascunhos DA PRÓPRIA CONTA
// de quem gera a cópia. Compatibilidade: o restaurador (supabase/restaurar-copia.sql) lê as versões 1 a 5; as cópias 1 a 4 não têm autoria e voltam atribuídas à conta administradora do projeto de destino.
// Nunca entram senha, token, chave nem o conteúdo dos rascunhos de outras contas. Nada aqui concede acesso: as autorizações da cópia são só informação.
import type { Demanda } from '@/lib/demandas';
import type { Entrada } from '@/lib/entradas';
import type { Evento } from '@/lib/eventos';
import type { DiaIndisponivel } from '@/lib/prazos';

export const VERSAO_COPIA = 5;
export type Autoria = { demandas: Record<string, string>; tarefas: Record<string, string>; entradas: Record<string, string>; eventos: Record<string, string>; dias_indisponiveis: Record<string, string>; acessos: { email: string; admin: boolean; estado: string }[] };
export type RascunhoCopia = { id: string; chave: string; dados: Record<string, unknown>; versao: number };

export function montarCopia(o: { agora: Date; ativas: Demanda[]; arquivadas: Demanda[]; dias: DiaIndisponivel[]; entradas: Entrada[]; entradasArquivadas: Entrada[]; eventos: Evento[]; rascunhos?: RascunhoCopia[]; rascunhosDe?: string | null; autoria?: Autoria | null }) {
  return {
    formato: 'dmanda-exportacao', versao: VERSAO_COPIA, exportado_em: o.agora.toISOString(), fuso: 'America/Sao_Paulo',
    demandas: o.ativas, arquivadas: o.arquivadas, dias_indisponiveis: o.dias, entradas: o.entradas, entradas_arquivadas: o.entradasArquivadas, eventos: o.eventos,
    // só os rascunhos abertos da conta que gera a cópia, com o e-mail dela para o restaurador devolvê-los à mesma conta
    rascunhos: o.rascunhos ?? [], rascunhos_de: o.rascunhos?.length ? (o.rascunhosDe ?? null) : null,
    // só a administradora recebe a autoria e a situação dos acessos (os e-mails das outras contas não vão para uma cópia de quem não os conhece)
    ...(o.autoria ? { autoria: { demandas: o.autoria.demandas, tarefas: o.autoria.tarefas, entradas: o.autoria.entradas, eventos: o.autoria.eventos, dias_indisponiveis: o.autoria.dias_indisponiveis }, acessos_informativo: o.autoria.acessos.map((a) => ({ email: a.email, admin: a.admin, estado: a.estado })) } : {}),
  };
}
