-- Perfil: registros diários de humor e energia (decisões 56 e DECISOES.md seção 9).
-- Aditiva: nenhuma migração anterior foi reescrita e nenhum dado existente é alterado (só uma tabela nova e três funções novas).
--   * Um registro por dia civil (America/Sao_Paulo, a mesma referência de public.hoje()). Humor e energia são gravados JUNTOS, de 1 a 5 (Muito mal a Muito bem; Muito baixa a Muito alta).
--     Uma nova gravação do mesmo dia substitui a anterior: só o último registro de cada dia vale. A chave (usuário, dia) impede duas linhas para o mesmo dia, em qualquer cenário
--     (clique repetido, resposta perdida, duas abas).
--   * Janela de correção: hoje e os 5 dias anteriores. Dia futuro e dia mais antigo são recusados no banco (a tela nunca é a única defesa).
--   * Privacidade: RLS pela conta autorizada, como Entradas e Agenda. As mensagens de erro nunca repetem os valores informados (nada de humor ou energia em log).
--     Os valores não entram em nenhuma outra função (nem a rotina diária, nem os resumos) e a cópia dos dados (exportação) não os inclui.
--   * Produtividade NÃO tem tabela: é derivada das demandas finalizadas (demandas.concluida_em) na leitura.

create table public.registros_dia (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dia date not null,
  humor smallint not null check (humor between 1 and 5),
  energia smallint not null check (energia between 1 and 5),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, dia)
);
create trigger registros_dia_atualizado before update on public.registros_dia for each row execute function public.tocar_atualizado_em();

alter table public.registros_dia enable row level security;
create policy registros_dia_dono on public.registros_dia for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
revoke all on public.registros_dia from public, anon, authenticated;
grant select, insert, update on public.registros_dia to authenticated;

-- Os registros dos últimos p_dias dias (62 por padrão: cobre o mês do gráfico e o histórico), do mais antigo ao mais recente.
create or replace function public.listar_registros_dia(p_dias integer default 62) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(r.dia, 'YYYY-MM-DD'), 'humor', r.humor, 'energia', r.energia) order by r.dia), '[]'::jsonb)
  from public.registros_dia r
  where r.dia >= public.hoje() - least(greatest(coalesce(p_dias, 62), 1), 366)
$$;

-- Grava de 1 a 6 dias de uma vez (hoje e os 5 anteriores), todos ou nenhum. Cada item: {"dia": "AAAA-MM-DD", "humor": 1..5, "energia": 1..5}.
create or replace function public.registrar_dias(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare x jsonb; v_dia date; v_hoje date := public.hoje(); v_vistos date[] := '{}';
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) not between 1 and 6 then perform public.erro_dmanda('Informe de 1 a 6 dias para registrar.'); end if;
  for x in select e from jsonb_array_elements(p) e loop
    if jsonb_typeof(x) <> 'object' or coalesce(x ->> 'dia', '') !~ '^\d{4}-\d{2}-\d{2}$' then perform public.erro_dmanda('Dia inválido.'); end if;
    begin v_dia := (x ->> 'dia')::date; exception when others then perform public.erro_dmanda('Dia inválido.'); end;
    if v_dia > v_hoje then perform public.erro_dmanda('Não é possível registrar um dia que ainda não chegou.'); end if;
    if v_dia < v_hoje - 5 then perform public.erro_dmanda('Só é possível registrar ou corrigir hoje e os 5 dias anteriores.'); end if;
    if coalesce(x ->> 'humor', '') !~ '^[1-5]$' or coalesce(x ->> 'energia', '') !~ '^[1-5]$' then perform public.erro_dmanda('Humor e energia precisam ser escolhidos, de 1 a 5.'); end if;
    if v_dia = any (v_vistos) then perform public.erro_dmanda('O mesmo dia aparece mais de uma vez.'); end if;
    v_vistos := v_vistos || v_dia;
    insert into public.registros_dia (dia, humor, energia) values (v_dia, (x ->> 'humor')::smallint, (x ->> 'energia')::smallint)
    on conflict (user_id, dia) do update set humor = excluded.humor, energia = excluded.energia;
  end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('dia', to_char(r.dia, 'YYYY-MM-DD'), 'humor', r.humor, 'energia', r.energia) order by r.dia), '[]'::jsonb)
          from public.registros_dia r where r.dia = any (v_vistos));
end $$;

-- Funções novas nascem executáveis por qualquer papel: só o usuário logado executa. Lista explícita, nunca "all functions".
revoke all on function public.listar_registros_dia(integer), public.registrar_dias(jsonb) from public, anon, authenticated;
grant execute on function public.listar_registros_dia(integer), public.registrar_dias(jsonb) to authenticated;
