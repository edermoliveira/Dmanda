'use server';
// Carga do aplicativo em UMA chamada ao servidor (as ações do navegador esperam umas às outras na fila), com as leituras em paralelo: cada parte mantém o seu próprio resultado, então
// se uma falhar as outras continuam valendo e a tela mostra o erro só da parte que falhou.
// `completa` (padrão): inclui o estado da rotina e o ambiente, que só mudam ao abrir o aplicativo. Sem ela é a releitura leve de quando a pessoa volta à tela.
import { ambiente, estadoRotina, listarDemandas, listarDias, listarOpcoes, listarParaHoje } from './demandas';
import { listarEntradas } from './entradas';
import { listarEventos } from './agenda';
import { listarRegistros } from './perfil';

export async function cargaInicial(completa = true) {
  const [demandas, entradas, eventos, dias, registros, opcoes, paraHoje, rotina, amb] = await Promise.all([
    listarDemandas(false), listarEntradas(false), listarEventos(), listarDias(), listarRegistros(), listarOpcoes(), listarParaHoje(), completa ? estadoRotina() : null, completa ? ambiente() : null,
  ]);
  return { ok: true as const, dados: { demandas, entradas, eventos, dias, registros, opcoes, paraHoje, rotina, ambiente: amb } };
}
