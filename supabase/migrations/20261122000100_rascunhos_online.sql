-- Dmanda: rascunhos online (decisão 92, 22/11/2026). O banco passa a ser a fonte principal dos rascunhos; o navegador guarda só uma fila temporária de alterações ainda não confirmadas.
-- Migração ADITIVA: uma tabela e cinco funções novas. Nenhuma tabela existente é alterada.
--
-- Visibilidade: o registro confirmado é do PAINEL; o rascunho é INDIVIDUAL, do autor (user_id = auth.uid()), recuperável pela mesma conta em outro aparelho. Ninguém lê o rascunho de outra pessoa
-- pela API (RLS por user_id E conta autorizada), nem trocando o identificador: uma chamada com o id de um rascunho alheio recebe o mesmo erro genérico de um id que não pode ser usado.
--
-- Protocolo (cada rascunho é uma "chave" do aparelho: nova, tarefa, dia:nova, d:<id>, e:nova, e:<id>, ev:nova, ev:<id>; no máximo UM rascunho ABERTO por usuário e chave):
--   * identidade da instância: o aplicativo gera um uuid ao começar um rascunho novo naquela chave; ele identifica TODA a vida desse rascunho;
--   * versao: sobe a cada gravação aceita; o aplicativo informa em p_base a versão que ele conhecia;
--   * p_op: identidade da tentativa; repetir a MESMA operação (resposta perdida) devolve o estado atual sem reaplicar;
--   * conflito (p_base diferente da versão do banco, ou outra instância aberta na mesma chave): NADA se perde, a versão do banco permanece e a versão que perdeu entra em `conflitos`
--     (até 10, sem repetir a mesma operação); a pessoa resolve explicitamente (resolver_rascunho);
--   * lápide: consumir ou descartar mantém a LINHA (estado consumido ou descartado, sem conteúdo): uma fila antiga que ainda envia gravações dessa instância recebe 'encerrado' e não ressuscita o rascunho.
--     As lápides não expiram (cada uma é só um uuid, uma chave e dois carimbos): descartar por idade permitiria a ressurreição.
--   * senhas e credenciais não são rascunhos: só entram as chaves da lista acima.

create table public.rascunhos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chave text not null check (chave ~ '^(nova|tarefa|dia:nova|(d|e|ev):(nova|[0-9a-fA-F-]{36})|legado:[A-Za-z0-9:._-]{1,100})$'),
  estado text not null default 'aberto' check (estado in ('aberto', 'consumido', 'descartado')),
  dados jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) <= 262144),
  versao integer not null default 1,
  ultima_op uuid,
  conflitos jsonb not null default '[]'::jsonb check (jsonb_typeof(conflitos) = 'array' and jsonb_array_length(conflitos) <= 10),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  encerrado_em timestamptz
);
create unique index rascunhos_aberto_unico on public.rascunhos (user_id, chave) where estado = 'aberto';
create index rascunhos_usuario_estado on public.rascunhos (user_id, estado, atualizado_em);
alter table public.rascunhos enable row level security;
create policy rascunhos_do_autor on public.rascunhos for all to authenticated
  using ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()))
  with check ((select auth.uid()) = user_id and (select dmanda_privado.conta_autorizada()));
revoke all on public.rascunhos from public, anon, authenticated;
grant select, insert, update on public.rascunhos to authenticated;

create or replace function public.erro_rascunho(p_msg text) returns void language plpgsql set search_path = '' as $$ begin raise exception '%', p_msg using errcode = 'P0001'; end $$;
revoke all on function public.erro_rascunho(text) from public, anon, authenticated;
grant execute on function public.erro_rascunho(text) to authenticated;   -- as funções abaixo são SECURITY INVOKER e a chamam

create or replace function public.rascunho_json(r public.rascunhos) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'chave', r.chave, 'estado', r.estado, 'dados', r.dados, 'versao', r.versao, 'conflitos', r.conflitos, 'atualizado_em', r.atualizado_em)
$$;
revoke all on function public.rascunho_json(public.rascunhos) from public, anon, authenticated;
grant execute on function public.rascunho_json(public.rascunhos) to authenticated;

-- Os rascunhos ABERTOS de quem chama (só os dele), para recuperar em outro aparelho.
create or replace function public.listar_rascunhos() returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.rascunho_json(r) order by r.atualizado_em), '[]'::jsonb) from public.rascunhos r where r.estado = 'aberto'
$$;

-- Grava (ou cria) uma instância. Devolve { status: 'ok' | 'conflito' | 'encerrado', ... }; veja o protocolo acima.
create or replace function public.salvar_rascunho(p_id uuid, p_chave text, p_dados jsonb, p_base integer, p_op uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare r public.rascunhos; a public.rascunhos; v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_id is null or p_op is null then perform public.erro_rascunho('Rascunho indisponível.'); end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then perform public.erro_rascunho('Rascunho inválido.'); end if;
  if pg_column_size(p_dados) > 262144 then perform public.erro_rascunho('O rascunho passa do tamanho permitido.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('rascunho:' || v_uid::text || ':' || coalesce(p_chave, ''), 0));
  select * into r from public.rascunhos where id = p_id;
  if found then
    if r.chave <> p_chave then perform public.erro_rascunho('Rascunho indisponível.'); end if;
    if r.estado <> 'aberto' then return jsonb_build_object('status', 'encerrado', 'estado', r.estado, 'id', r.id); end if;
    if r.ultima_op = p_op then return jsonb_build_object('status', 'ok', 'versao', r.versao, 'repetida', true, 'id', r.id); end if;
    if coalesce(p_base, 0) = r.versao then
      update public.rascunhos set dados = p_dados, versao = versao + 1, ultima_op = p_op, atualizado_em = now() where id = p_id returning * into r;
      return jsonb_build_object('status', 'ok', 'versao', r.versao, 'id', r.id);
    end if;
    -- outro aparelho gravou antes: a versão do banco fica e a que chegou é guardada ao lado (nunca sobrescreve em silêncio)
    if not exists (select 1 from jsonb_array_elements(r.conflitos) c where c ->> 'op' = p_op::text) then
      update public.rascunhos set conflitos = (conflitos || jsonb_build_array(jsonb_build_object('op', p_op, 'base', p_base, 'dados', p_dados, 'em', now())))
        where id = p_id and jsonb_array_length(conflitos) < 10 returning * into r;
      if not found then perform public.erro_rascunho('Há versões demais em conflito neste rascunho. Resolva o conflito antes de continuar.'); end if;
    else select * into r from public.rascunhos where id = p_id; end if;
    return jsonb_build_object('status', 'conflito', 'id', r.id, 'versao', r.versao, 'dados', r.dados, 'conflitos', r.conflitos);
  end if;
  -- instância nova
  if (select count(*) from public.rascunhos x where x.estado = 'aberto') >= 200 then perform public.erro_rascunho('Há rascunhos abertos demais nesta conta. Descarte alguns antes de começar outro.'); end if;
  select * into a from public.rascunhos where chave = p_chave and estado = 'aberto';
  if found then
    -- outra instância aberta na mesma chave (outro aparelho começou o mesmo rascunho): mantém a do banco e guarda esta ao lado
    if not exists (select 1 from jsonb_array_elements(a.conflitos) c where c ->> 'op' = p_op::text) then
      update public.rascunhos set conflitos = (conflitos || jsonb_build_array(jsonb_build_object('op', p_op, 'base', 0, 'dados', p_dados, 'em', now(), 'instancia', p_id)))
        where id = a.id and jsonb_array_length(conflitos) < 10 returning * into a;
      if not found then perform public.erro_rascunho('Há versões demais em conflito neste rascunho. Resolva o conflito antes de continuar.'); end if;
    else select * into a from public.rascunhos where id = a.id; end if;
    return jsonb_build_object('status', 'conflito', 'id', a.id, 'versao', a.versao, 'dados', a.dados, 'conflitos', a.conflitos);
  end if;
  begin
    insert into public.rascunhos (id, chave, dados, versao, ultima_op) values (p_id, p_chave, p_dados, 1, p_op) returning * into r;
  exception when unique_violation then
    -- o identificador pertence a outro usuário (a RLS o esconde) ou houve corrida: a resposta é a mesma, sem dizer qual
    perform public.erro_rascunho('Rascunho indisponível.');
  end;
  return jsonb_build_object('status', 'ok', 'versao', r.versao, 'id', r.id);
end $$;

-- Resolve um conflito: grava o conteúdo escolhido pela pessoa, na versão atual, e limpa as versões em conflito.
create or replace function public.resolver_rascunho(p_id uuid, p_dados jsonb, p_base integer, p_op uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare r public.rascunhos;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or pg_column_size(p_dados) > 262144 then perform public.erro_rascunho('Rascunho inválido.'); end if;
  select * into r from public.rascunhos where id = p_id for update;
  if not found then perform public.erro_rascunho('Rascunho indisponível.'); end if;
  if r.estado <> 'aberto' then return jsonb_build_object('status', 'encerrado', 'estado', r.estado, 'id', r.id); end if;
  if r.ultima_op = p_op then return jsonb_build_object('status', 'ok', 'versao', r.versao, 'repetida', true, 'id', r.id); end if;
  if coalesce(p_base, 0) <> r.versao then return jsonb_build_object('status', 'conflito', 'id', r.id, 'versao', r.versao, 'dados', r.dados, 'conflitos', r.conflitos); end if;
  update public.rascunhos set dados = p_dados, versao = versao + 1, ultima_op = p_op, conflitos = '[]'::jsonb, atualizado_em = now() where id = p_id returning * into r;
  return jsonb_build_object('status', 'ok', 'versao', r.versao, 'id', r.id);
end $$;

-- Encerra a instância (consumida: o registro foi confirmado; descartada: a pessoa cancelou). Deixa a lápide. Idempotente. Se a instância nunca chegou ao banco, a lápide nasce já encerrada
-- (uma gravação atrasada dela não a cria depois).
create or replace function public.encerrar_rascunho(p_id uuid, p_chave text, p_estado text) returns jsonb
language plpgsql set search_path = '' as $$
declare r public.rascunhos; v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_id is null or p_estado not in ('consumido', 'descartado') then perform public.erro_rascunho('Rascunho indisponível.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('rascunho:' || v_uid::text || ':' || coalesce(p_chave, ''), 0));
  select * into r from public.rascunhos where id = p_id;
  if found then
    if r.chave <> p_chave then perform public.erro_rascunho('Rascunho indisponível.'); end if;
    if r.estado = 'aberto' then
      update public.rascunhos set estado = p_estado, dados = '{}'::jsonb, conflitos = '[]'::jsonb, encerrado_em = now(), atualizado_em = now() where id = p_id returning * into r;
    end if;
    return jsonb_build_object('status', 'ok', 'estado', r.estado, 'id', r.id);
  end if;
  begin
    insert into public.rascunhos (id, chave, estado, dados, encerrado_em) values (p_id, p_chave, p_estado, '{}'::jsonb, now()) returning * into r;
  exception when unique_violation then perform public.erro_rascunho('Rascunho indisponível.');
  end;
  return jsonb_build_object('status', 'ok', 'estado', r.estado, 'id', r.id);
end $$;

-- Recuperação controlada dos rascunhos que ficaram nos aparelhos ANTES da conta (a chave antiga do navegador não identifica o autor): só a conta administradora, por ação explícita na tela.
-- O identificador é estável (derivado do conteúdo pelo aplicativo), então repetir não duplica, e o aplicativo só remove a cópia local depois deste 'ok'/'repetido'.
create or replace function public.importar_rascunho_legado(p_id uuid, p_chave text, p_dados jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare r public.rascunhos; v_uid uuid := (select auth.uid());
begin
  if not dmanda_privado.e_admin() then perform public.erro_rascunho('Somente a conta administradora recupera rascunhos antigos.'); end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or pg_column_size(p_dados) > 262144 then perform public.erro_rascunho('Rascunho inválido.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('rascunho:' || v_uid::text || ':' || coalesce(p_chave, ''), 0));
  select * into r from public.rascunhos where id = p_id;
  if found then return jsonb_build_object('status', 'repetido', 'estado', r.estado, 'id', r.id, 'chave', r.chave); end if;
  if exists (select 1 from public.rascunhos where chave = p_chave and estado = 'aberto') then return jsonb_build_object('status', 'ocupado', 'chave', p_chave); end if;
  begin
    insert into public.rascunhos (id, chave, dados, versao, ultima_op) values (p_id, p_chave, p_dados, 1, p_id) returning * into r;
  exception when unique_violation then perform public.erro_rascunho('Rascunho indisponível.');
  end;
  return jsonb_build_object('status', 'ok', 'id', r.id, 'chave', r.chave);
end $$;

revoke all on function public.listar_rascunhos(), public.salvar_rascunho(uuid, text, jsonb, integer, uuid), public.resolver_rascunho(uuid, jsonb, integer, uuid),
  public.encerrar_rascunho(uuid, text, text), public.importar_rascunho_legado(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.listar_rascunhos(), public.salvar_rascunho(uuid, text, jsonb, integer, uuid), public.resolver_rascunho(uuid, jsonb, integer, uuid),
  public.encerrar_rascunho(uuid, text, text), public.importar_rascunho_legado(uuid, text, jsonb) to authenticated;
