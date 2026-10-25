-- Salvar a janela de edição inteira de uma vez e de forma atômica: campos da demanda, lista de tarefas e (se pedida) a etapa.
-- Ou grava tudo, ou não grava nada (uma falha desfaz o conjunto). p_tarefas é a lista desejada, na ordem: [{ "id": opcional, "texto": "...", "concluida": true|false }].
-- Tarefas com id existente são atualizadas; sem id são criadas; as que não estão na lista são excluídas. A ordem da lista vira a ordem das tarefas.
create or replace function public.salvar_demanda(p_id uuid, p jsonb, p_tarefas jsonb default null) returns jsonb
language plpgsql set search_path = '' as $$
declare d public.demandas; t jsonb; n integer := 0; v_ant integer; v_tid uuid; v_novo integer;
begin
  select * into d from public.demandas where id = p_id for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  perform public.atualizar_demanda(p_id, coalesce(p, '{}'::jsonb) - 'etapa');
  if p_tarefas is not null then
    if jsonb_typeof(p_tarefas) <> 'array' then perform public.erro_dmanda('Lista de tarefas inválida.'); end if;
    select count(*) into v_ant from public.tarefas where demanda_id = p_id;
    -- remove as que saíram da lista
    delete from public.tarefas where demanda_id = p_id and id not in (select (x->>'id')::uuid from jsonb_array_elements(p_tarefas) x where x ? 'id' and (x->>'id') is not null);
    for t in select * from jsonb_array_elements(p_tarefas) loop
      n := n + 1;
      if length(btrim(coalesce(t->>'texto',''))) = 0 then perform public.erro_dmanda('A tarefa não pode ficar vazia.'); end if;
      v_tid := nullif(t->>'id','')::uuid;
      if v_tid is not null then
        update public.tarefas set texto = btrim(t->>'texto'), concluida = coalesce((t->>'concluida')::boolean, false), posicao = n where id = v_tid and demanda_id = p_id;
        if not found then perform public.erro_dmanda('Tarefa não encontrada.'); end if;
      else
        insert into public.tarefas (demanda_id, user_id, texto, concluida, posicao) values (p_id, d.user_id, btrim(t->>'texto'), coalesce((t->>'concluida')::boolean, false), n);
      end if;
    end loop;
    -- mesma regra de adicionar_tarefa: Cadastro vai para Vistos quando ganha a primeira tarefa (se a etapa não foi pedida)
    if v_ant = 0 and n > 0 and d.etapa = 'Cadastro' and d.arquivada_em is null and coalesce(p->>'etapa', d.etapa) = d.etapa then
      update public.demandas set etapa = 'Vistos', etapa_desde = now() where id = p_id;
    end if;
  end if;
  if p ? 'etapa' and p->>'etapa' is distinct from (select etapa from public.demandas where id = p_id) then
    perform public.mover_etapa(p_id, p->>'etapa');
  end if;
  return public.demanda_json(p_id);
end $$;
revoke all on function public.salvar_demanda(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_demanda(uuid, jsonb, jsonb) to authenticated;
