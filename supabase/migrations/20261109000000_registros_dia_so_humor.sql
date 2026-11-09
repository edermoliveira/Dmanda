-- Perfil (decisão 59): o indicador de energia foi retirado. O registro diário passa a guardar só o humor. Corrige as migrações 16 a 18 sem reescrevê-las.
--   * A coluna energia sai de public.registros_dia (os valores de energia gravados até aqui são descartados: nenhuma migração 16 a 18 foi aplicada no banco real;
--     só existiram em bancos de teste). Humor, dia, user_id, criado_em e atualizado_em não mudam, nem as linhas.
--   * Privilégios: a remoção da coluna leva junto o UPDATE de energia. Continuam SELECT e INSERT de authenticated e UPDATE somente em (humor); dia, user_id, criado_em e
--     atualizado_em seguem sem UPDATE (a data é imutável). Nenhuma política de RLS muda, e as 3 continuam (dono, janela de inserir e janela de atualizar).
--   * registrar_dias: mesmo nome, mesma assinatura (jsonb) e mesmos privilégios de execução. Cada item é {"dia": "AAAA-MM-DD", "humor": 1..5}; qualquer outro campo é ignorado.
--     Continua de 1 a 6 dias (hoje e os 5 anteriores), tudo ou nada, um registro por dia (o mesmo dia de novo substitui) e SECURITY INVOKER.
--   * listar_registros_dia: devolve só dia e humor. Mesma assinatura, mesmos privilégios, SECURITY INVOKER.
--   * Reaplicável: create or replace e drop column if exists.
alter table public.registros_dia drop column if exists energia;

create or replace function public.listar_registros_dia(p_dias integer default 62) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(r.dia, 'YYYY-MM-DD'), 'humor', r.humor) order by r.dia), '[]'::jsonb)
  from public.registros_dia r
  where r.dia >= public.hoje() - least(greatest(coalesce(p_dias, 62), 1), 366)
$$;

create or replace function public.registrar_dias(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare x jsonb; v_dia date; v_hoje date := public.hoje(); v_vistos date[] := '{}';
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) not between 1 and 6 then perform public.erro_dmanda('Informe de 1 a 6 dias para registrar.'); end if;
  for x in select e from jsonb_array_elements(p) e loop
    if jsonb_typeof(x) <> 'object' or coalesce(x ->> 'dia', '') !~ '^\d{4}-\d{2}-\d{2}$' then perform public.erro_dmanda('Dia inválido.'); end if;
    begin v_dia := (x ->> 'dia')::date; exception when others then perform public.erro_dmanda('Dia inválido.'); end;
    if v_dia > v_hoje then perform public.erro_dmanda('Não é possível registrar um dia que ainda não chegou.'); end if;
    if v_dia < v_hoje - 5 then perform public.erro_dmanda('Só é possível registrar ou corrigir hoje e os 5 dias anteriores.'); end if;
    if coalesce(x ->> 'humor', '') !~ '^[1-5]$' then perform public.erro_dmanda('O humor precisa ser escolhido, de 1 a 5.'); end if;
    if v_dia = any (v_vistos) then perform public.erro_dmanda('O mesmo dia aparece mais de uma vez.'); end if;
    v_vistos := v_vistos || v_dia;
    insert into public.registros_dia (dia, humor) values (v_dia, (x ->> 'humor')::smallint)
    on conflict (user_id, dia) do update set humor = excluded.humor;
  end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(r.dia, 'YYYY-MM-DD'), 'humor', r.humor) order by r.dia), '[]'::jsonb)
          from public.registros_dia r where r.dia = any (v_vistos));
end $$;
