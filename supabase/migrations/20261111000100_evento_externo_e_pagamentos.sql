-- Mini calendário do Início (decisão 64). Migração 23, posterior à 22 (para_hoje_quatro_vagas).
--   * eventos: o tipo "Evento externo" passa a existir na Agenda (com horário ou de dia inteiro). Ele só aparece no calendário: NÃO muda vencimento nenhum. Quem antecipa prazos continua sendo
--     exclusivamente o cadastro de Dias indisponíveis (feriados e eventos externos de dia inteiro), que não muda. Lançamentos anteriores (Reunião, Compromisso, Lembrete) ficam como estão.
--   * pagamentos: a data do salário, cadastrada uma a uma (sem valor e sem recorrência automática), por usuário, para aparecer em todos os aparelhos. Só a conta autorizada lê e grava.
-- Seguro para repetir: a restrição é recriada com o mesmo nome, a tabela só nasce se não existe e as funções são substituídas. Nenhum dado existente é tocado.

-- ---------- 1) tipo de evento ----------
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in ('Reunião','Compromisso','Lembrete','Evento externo'));

create or replace function public.conferir_evento(p_titulo text, p_tipo text, p_dia_inteiro boolean, p_inicio text, p_fim text, p_descricao text, p_aviso integer) returns void language plpgsql stable set search_path = '' as $$
begin
  if length(btrim(coalesce(p_titulo, ''))) = 0 then perform public.erro_dmanda('Informe o título do evento.'); end if;
  if char_length(btrim(p_titulo)) > 200 then perform public.erro_dmanda('O título passa de 200 caracteres.'); end if;
  if p_tipo is null or p_tipo not in ('Reunião','Compromisso','Lembrete','Evento externo') then perform public.erro_dmanda('Escolha o tipo do evento.'); end if;
  if char_length(coalesce(p_descricao, '')) > 5000 then perform public.erro_dmanda('A descrição passa de 5000 caracteres.'); end if;
  if p_dia_inteiro then
    if nullif(p_inicio, '') is not null or nullif(p_fim, '') is not null then perform public.erro_dmanda('Evento de dia inteiro não tem horário.'); end if;
    if p_aviso is not null and p_aviso <> 0 then perform public.erro_dmanda('Aviso inválido.'); end if;
  else
    if nullif(p_inicio, '') is null or p_inicio !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then perform public.erro_dmanda('Informe o horário de início (por exemplo, 09:30).'); end if;
    if nullif(p_fim, '') is not null then
      if p_fim !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then perform public.erro_dmanda('Horário de término inválido.'); end if;
      if p_fim::time <= p_inicio::time then perform public.erro_dmanda('O término precisa ser depois do início.'); end if;
    end if;
    if p_aviso is not null and p_aviso not in (5, 10, 15, 30, 60, 120) then perform public.erro_dmanda('Aviso inválido.'); end if;
  end if;
end $$;

-- ---------- 2) pagamentos (data do salário) ----------
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint pagamentos_usuario_data unique (user_id, data)
);
drop trigger if exists pagamentos_atualizado on public.pagamentos;
create trigger pagamentos_atualizado before update on public.pagamentos for each row execute function public.tocar_atualizado_em();
alter table public.pagamentos enable row level security;
drop policy if exists pagamentos_dono on public.pagamentos;
create policy pagamentos_dono on public.pagamentos for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
revoke all on public.pagamentos from public, anon, authenticated;
grant select, insert, update, delete on public.pagamentos to authenticated;

create or replace function public.pagamento_json(p_id uuid) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'data', c.data, 'criado_em', c.criado_em) from public.pagamentos c where c.id = p_id
$$;

create or replace function public.listar_pagamentos() returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.pagamento_json(c.id) order by c.data, c.criado_em, c.id), '[]'::jsonb) from public.pagamentos c
$$;

-- Cria (sem "id") ou altera (com "id") uma data de pagamento. Criar uma data que já existe devolve a que existe (clique repetido ou resposta perdida não duplicam nem dão erro);
-- mudar uma data para outra que já está cadastrada é recusado. Sem valor, sem recorrência: só a data.
create or replace function public.salvar_pagamento(p jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; v_data date; v_outro uuid;
begin
  if coalesce(p ->> 'data', '') = '' then perform public.erro_dmanda('Informe a data do pagamento.'); end if;
  v_data := (p ->> 'data')::date;
  if v_id is null then
    select id into v_outro from public.pagamentos where data = v_data;
    if v_outro is not null then return public.pagamento_json(v_outro); end if;
    insert into public.pagamentos (data) values (v_data) returning id into v_id;
  else
    perform 1 from public.pagamentos where id = v_id for update;
    if not found then perform public.erro_dmanda('Pagamento não encontrado. Ele pode ter sido excluído em outro aparelho.'); end if;
    if exists (select 1 from public.pagamentos where data = v_data and id <> v_id) then perform public.erro_dmanda('Já existe um pagamento cadastrado nesta data.'); end if;
    update public.pagamentos set data = v_data where id = v_id;
  end if;
  return public.pagamento_json(v_id);
end $$;

-- Repetir depois de uma resposta perdida não é erro: o pagamento já não existe e o resultado é o mesmo.
create or replace function public.excluir_pagamento(p_id uuid) returns jsonb language plpgsql set search_path = '' as $$
begin
  delete from public.pagamentos where id = p_id;
  return jsonb_build_object('id', p_id, 'excluido', true);
end $$;

-- ---------- 3) privilégios ----------
revoke all on function public.pagamento_json(uuid), public.listar_pagamentos(), public.salvar_pagamento(jsonb), public.excluir_pagamento(uuid) from public, anon, authenticated;
grant execute on function public.pagamento_json(uuid), public.listar_pagamentos(), public.salvar_pagamento(jsonb), public.excluir_pagamento(uuid) to authenticated;
revoke all on function public.conferir_evento(text, text, boolean, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.conferir_evento(text, text, boolean, text, text, text, integer) to authenticated;
