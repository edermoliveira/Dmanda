-- adicionar_tarefa com a identidade da tentativa: se a tarefa foi gravada mas a resposta não chegou à tela, repetir a inclusão com o MESMO identificador devolve a tarefa que já existe
-- em vez de criar outra. O aplicativo gera o identificador ao começar a tentativa (como já faz com demandas e entradas) e o reaproveita enquanto o texto digitado for o mesmo.
-- Sem identificador (chamada antiga ou de outra origem) o comportamento é o de sempre, e o banco nunca deduplica pelo conteúdo: tarefas diferentes podem ter o mesmo texto.
-- Trocar a assinatura exige remover a antiga (duas assinaturas com parâmetro opcional deixariam a chamada ambígua para a API); nenhuma tarefa nem dado é tocado.
drop function public.adicionar_tarefa(uuid, text);
create function public.adicionar_tarefa(p_demanda uuid, p_texto text, p_id uuid default null) returns jsonb language plpgsql set search_path = '' as $$
declare d public.demandas; n integer;
begin
  if length(btrim(coalesce(p_texto,''))) = 0 then perform public.erro_dmanda('Escreva a tarefa.'); end if;
  select * into d from public.demandas where id = p_demanda for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  -- repetição da mesma tentativa (a demanda está travada acima, então duas repetições simultâneas também se enfileiram)
  if p_id is not null then
    if exists (select 1 from public.tarefas where id = p_id and demanda_id = p_demanda) then return public.demanda_json(p_demanda); end if;
    if exists (select 1 from public.tarefas where id = p_id) then perform public.erro_dmanda('Este identificador de tarefa já pertence a outra demanda.'); end if;
  end if;
  select count(*) into n from public.tarefas where demanda_id = p_demanda;
  insert into public.tarefas (id, demanda_id, user_id, texto, posicao)
  values (coalesce(p_id, gen_random_uuid()), p_demanda, d.user_id, btrim(p_texto), coalesce((select max(posicao) from public.tarefas where demanda_id = p_demanda), 0) + 1);
  -- Cadastro vai para Vistos quando ganha a primeira tarefa (não inventa nada além disso)
  if n = 0 and d.etapa = 'Cadastro' and d.arquivada_em is null then
    update public.demandas set etapa = 'Vistos', etapa_desde = now() where id = p_demanda;
  end if;
  return public.demanda_json(p_demanda);
end $$;
revoke all on function public.adicionar_tarefa(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.adicionar_tarefa(uuid, text, uuid) to authenticated;
