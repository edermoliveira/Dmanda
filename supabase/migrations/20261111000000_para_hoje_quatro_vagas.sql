-- Para hoje com quatro vagas (decisão 63). Migração 22, posterior à 21 (prazo_base_do_atalho).
--   * a posição guardada em public.para_hoje passa a aceitar de 1 a 4 (antes, de 1 a 3). As linhas existentes (posições 1, 2 e 3) não mudam.
--   * atualizar_para_hoje passa a preencher até a posição 4, na ordem das posições livres. Nada mais muda: a mesma trava por usuário contra gravações concorrentes, a validação das candidatas,
--     a liberação só das vagas de demandas finalizadas ou arquivadas e a recusa de demanda repetida (unique por usuário e demanda).
-- Seguro para repetir: a restrição é recriada com o mesmo nome e a função é substituída; nenhum dado é apagado. Permissões inalteradas (create or replace mantém os grants da função).
alter table public.para_hoje drop constraint if exists para_hoje_posicao_check;
alter table public.para_hoje add constraint para_hoje_posicao_check check (posicao between 1 and 4);

create or replace function public.atualizar_para_hoje(p_candidatas jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid; v_pos smallint; x text;
begin
  if p_candidatas is not null and (jsonb_typeof(p_candidatas) <> 'array' or jsonb_array_length(p_candidatas) > 30) then perform public.erro_dmanda('Lista de candidatas inválida.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('para_hoje:' || coalesce(v_user::text, ''), 0));
  delete from public.para_hoje p using public.demandas d where d.id = p.demanda_id and (d.etapa = 'Finalizado' or d.arquivada_em is not null);
  for x in select e from jsonb_array_elements_text(coalesce(p_candidatas, '[]'::jsonb)) e loop
    select s into v_pos from generate_series(1, 4) s where not exists (select 1 from public.para_hoje p where p.posicao = s) order by s limit 1;
    exit when v_pos is null;
    if x !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then continue; end if;
    v_id := x::uuid;
    if exists (select 1 from public.demandas d where d.id = v_id and d.etapa <> 'Finalizado' and d.arquivada_em is null)
       and not exists (select 1 from public.para_hoje p where p.demanda_id = v_id) then
      insert into public.para_hoje (posicao, demanda_id) values (v_pos, v_id);
    end if;
  end loop;
  return public.listar_para_hoje();
end $$;
