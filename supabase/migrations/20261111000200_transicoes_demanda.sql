-- Dados para acompanhar a evolução (decisão 65). Migração 24, posterior à 23 (evento_externo_e_pagamentos).
-- Hoje o banco só guarda o ESTADO da demanda: reabrir apaga `concluida_em`, então uma demanda concluída e reaberta perde a data da conclusão. Esta migração passa a gravar, na mesma transação da mudança
-- de etapa, duas transições que ainda não tinham histórico: CONCLUSÃO (entrou em Finalizado) e REABERTURA (saiu de Finalizado). Todo o resto já é calculável das colunas existentes (criado_em,
-- chegou_em, concluida_em, etapa_desde) e não ganha tabela nova.
--   * demanda_transicoes: uma linha por transição. `ciclo` numera as conclusões da demanda (a 1ª conclusão gravada é o ciclo 1, a 2ª o ciclo 2...); a reabertura leva o ciclo da conclusão que ela
--     reabre. Uma demanda que já estava finalizada ANTES desta migração não tem linha de conclusão (não se reconstrói o que não foi registrado): se for reaberta, a reabertura leva ciclo 0 e
--     `concluida_em_anterior` guarda a data comprovada daquela conclusão antiga. Único por (demanda, tipo, ciclo): repetir a mesma transição nunca duplica.
--   * coleta_marcos: quando a coleta começou ("confiável desde"). Gravado uma vez, ao aplicar; repetir a migração não muda a data.
-- A gravação é um gatilho na própria tabela de demandas: vale para qualquer caminho que mude a etapa (mover, concluir, reabrir, salvar, rotina). Só dispara quando a etapa MUDA de verdade, então
-- repetir "concluir" numa demanda já finalizada não grava nada. O usuário só LÊ (pela função listar_transicoes_demanda); ninguém grava direto na tabela. Segura para repetir; nenhum dado existente é tocado.

create table if not exists public.demanda_transicoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  demanda_id uuid not null references public.demandas (id) on delete cascade,
  tipo text not null check (tipo in ('conclusao', 'reabertura')),
  ciclo integer not null check (ciclo >= 0),
  dia date not null,                         -- o dia em Brasília (America/Sao_Paulo) em que aconteceu
  ocorreu_em timestamptz not null default now(),
  etapa_anterior text not null,
  etapa_nova text not null,
  concluida_em_anterior date,                -- só na reabertura: a data da conclusão que foi desfeita (preserva o histórico)
  constraint demanda_transicoes_unica unique (demanda_id, tipo, ciclo),
  constraint demanda_transicoes_ciclo_conclusao check (tipo <> 'conclusao' or ciclo >= 1)
);
create index if not exists demanda_transicoes_usuario_dia on public.demanda_transicoes (user_id, dia);

create table if not exists public.coleta_marcos (
  chave text primary key,
  desde timestamptz not null default now(),
  dia date not null default public.hoje()
);
insert into public.coleta_marcos (chave) values ('transicoes') on conflict (chave) do nothing;

alter table public.demanda_transicoes enable row level security;
alter table public.coleta_marcos enable row level security;
drop policy if exists transicoes_leitura on public.demanda_transicoes;
create policy transicoes_leitura on public.demanda_transicoes for select to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
drop policy if exists coleta_marcos_leitura on public.coleta_marcos;
create policy coleta_marcos_leitura on public.coleta_marcos for select to authenticated using ((select dmanda_privado.conta_autorizada()));
revoke all on public.demanda_transicoes, public.coleta_marcos from public, anon, authenticated;
grant select on public.demanda_transicoes, public.coleta_marcos to authenticated;

-- O gatilho roda com os direitos de quem criou a função (security definer) para gravar mesmo sem permissão de escrita do usuário; só grava para o dono da própria demanda.
create or replace function public.registrar_transicao_demanda() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  -- a linha de demanda está travada por esta própria atualização, então duas mudanças ao mesmo tempo na mesma demanda são serializadas e a contagem não se perde
  select count(*) into v_n from public.demanda_transicoes where demanda_id = new.id and tipo = 'conclusao';
  if new.etapa = 'Finalizado' and old.etapa <> 'Finalizado' then
    insert into public.demanda_transicoes (user_id, demanda_id, tipo, ciclo, dia, etapa_anterior, etapa_nova)
      values (new.user_id, new.id, 'conclusao', v_n + 1, public.hoje(), old.etapa, new.etapa)
      on conflict (demanda_id, tipo, ciclo) do nothing;
  elsif old.etapa = 'Finalizado' and new.etapa <> 'Finalizado' then
    insert into public.demanda_transicoes (user_id, demanda_id, tipo, ciclo, dia, etapa_anterior, etapa_nova, concluida_em_anterior)
      values (new.user_id, new.id, 'reabertura', v_n, public.hoje(), old.etapa, new.etapa, old.concluida_em)
      on conflict (demanda_id, tipo, ciclo) do nothing;
  end if;
  return null;
end $$;
revoke all on function public.registrar_transicao_demanda() from public, anon, authenticated;
drop trigger if exists demanda_transicoes_registro on public.demandas;
create trigger demanda_transicoes_registro after update of etapa on public.demandas
  for each row when (old.etapa is distinct from new.etapa) execute function public.registrar_transicao_demanda();

-- Leitura: as transições do usuário (mais antigas primeiro) e a data em que a coleta começou.
create or replace function public.listar_transicoes_demanda() returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'desde', (select dia from public.coleta_marcos where chave = 'transicoes'),
    'desde_em', (select desde from public.coleta_marcos where chave = 'transicoes'),
    'transicoes', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'demanda_id', t.demanda_id, 'tipo', t.tipo, 'ciclo', t.ciclo, 'dia', t.dia, 'ocorreu_em', t.ocorreu_em,
        'etapa_anterior', t.etapa_anterior, 'etapa_nova', t.etapa_nova, 'concluida_em_anterior', t.concluida_em_anterior) order by t.ocorreu_em, t.id) from public.demanda_transicoes t), '[]'::jsonb))
$$;
revoke all on function public.listar_transicoes_demanda() from public, anon, authenticated;
grant execute on function public.listar_transicoes_demanda() to authenticated;
