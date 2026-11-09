// Auxiliar dos testes de navegador: escolher ou criar a origem e o tipo do documento pelo dropdown (o campo não é mais um texto livre).
// `prefixo` é o da janela ('n' no cadastro, 'd' na consulta). Cria pela opção "+ Nova origem" / "+ Criar tipo" quando o nome ainda não existe.
const ID = { origem: 'origem', tipo: 'tipo' }, CRIAR = { origem: '+ Nova origem', tipo: '+ Criar tipo' };

export async function escolherOpcao(pg, prefixo, campo, nome) {
  const gatilho = `#${prefixo}-${ID[campo]}`;
  await pg.click(gatilho);
  const pop = pg.locator(`.sel-pop[data-campo="${campo}"]`);
  await pop.waitFor();
  const existente = pop.locator('li[role="option"]', { hasText: new RegExp(`^\\s*${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) });
  if (await existente.count()) { await existente.first().click(); }
  else {
    await pop.locator('.sel-criar').click();
    await pop.locator('.sel-novo input').fill(nome);
    await pop.locator('.sel-novo input').press('Enter');
  }
  await pg.waitForFunction((g) => !document.querySelector('.sel-pop') && document.querySelector(g)?.getAttribute('aria-expanded') === 'false', gatilho, { timeout: 10000 });
}

/** O texto que o botão mostra (o valor escolhido ou "Sem origem" / "Sem documento"). */
export const valorDoSeletor = (pg, prefixo, campo) => pg.textContent(`#${prefixo}-${ID[campo]} .sel-v`);
