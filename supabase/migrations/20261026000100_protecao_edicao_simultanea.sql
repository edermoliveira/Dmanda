-- Proteção contra edição simultânea: uma janela de edição desatualizada não pode mais sobrescrever, em silêncio, o que foi gravado depois em outro aparelho.
-- Antes, salvar_demanda gravava a lista inteira de tarefas que a janela mostrava e apagava as que não estavam nela (uma tarefa criada no outro aparelho sumia).
-- Agora cada demanda tem um número de versão que sobe a cada alteração dela OU de qualquer uma de suas tarefas (por gatilho, então vale para toda operação, inclusive
-- futuras). salvar_demanda exige a versão em que a janela foi aberta e, com a demanda travada (for update), recusa tudo se ela já mudou: nada é gravado, nem campos
-- nem tarefas (a conferência vem antes de qualquer escrita, na mesma transação). A recusa usa o código DM409, que a aplicação reconhece para avisar sem apagar o que foi digitado.
-- Migrações anteriores não foram reescritas: aqui só se acrescenta a coluna e os gatilhos e se troca a assinatura de salvar_demanda (a antiga, de 3 argumentos,
-- é removida para não existir caminho de salvamento sem a conferência).

alter table public.demandas add column versao integer not null default 1;

-- sobe a versão em toda atualização da demanda (a atribuição do gatilho vale mesmo que a operação tente informar outro valor)
create or replace function public.subir_versao_demanda() returns trigger language plpgsql set search_path = '' as $$
begin new.versao := old.versao + 1; return new; end $$;
create trigger demandas_versao before update on public.demandas for each row execute function public.subir_versao_demanda();

-- mexer em uma tarefa (criar, alterar, marcar, excluir) conta como alterar a demanda: o "update" abaixo dispara o gatilho acima
create or replace function public.subir_versao_pela_tarefa() returns trigger language plpgsql set search_path = '' as $$
begin
  update public.demandas set versao = versao where id = coalesce(new.demanda_id, old.demanda_id);
  return null;
end $$;
create trigger tarefas_versao after insert or update or delete on public.tarefas for each row execute function public.subir_versao_pela_tarefa();

-- funções de gatilho: ninguém as chama (funções novas nascem executáveis por qualquer papel até serem revogadas); os gatilhos continuam disparando normalmente
revoke all on function public.subir_versao_demanda(), public.subir_versao_pela_tarefa() from public, anon, authenticated;

drop function public.salvar_demanda(uuid, jsonb, jsonb);
-- Salva a janela de edição inteira de forma atômica, SE a demanda ainda está na versão em que a janela foi aberta (p_versao, a "versao" que a leitura devolveu).
-- p_tarefas é a lista desejada, na ordem (null não mexe nas tarefas): [{ "id": opcional, "texto": "...", "concluida": true|false }].
-- Tarefas com id existente são atualizadas; sem id são criadas; as que não estão na lista são excluídas (por isso a conferência de versão é indispensável).
create or replace function public.salvar_demanda(p_id uuid, p jsonb, p_tarefas jsonb, p_versao integer) returns jsonb
language plpgsql set search_path = '' as $$
declare d public.demandas; t jsonb; n integer := 0; v_ant integer; v_tid uuid;
begin
  select * into d from public.demandas where id = p_id for update;
  if not found then perform public.erro_dmanda('Demanda não encontrada.'); end if;
  if p_versao is null then perform public.erro_dmanda('Versão da demanda não informada. Nada foi gravado.'); end if;
  if d.versao <> p_versao then
    raise exception 'Esta demanda foi alterada em outro aparelho ou janela depois que você abriu a edição. Nada foi gravado.' using errcode = 'DM409';
  end if;
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
revoke all on function public.salvar_demanda(uuid, jsonb, jsonb, integer) from public, anon;
grant execute on function public.salvar_demanda(uuid, jsonb, jsonb, integer) to authenticated;
