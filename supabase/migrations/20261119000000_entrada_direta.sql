-- Dmanda: entrada direta pelo servidor (decisão de 17/11/2026), PASSO 1 de 2 da retirada dos aparelhos. Migração ADITIVA: só cria duas funções; não remove nada e não muda nenhuma regra de acesso,
-- então o código atual em produção continua funcionando depois dela. O passo 2 (20261119000100_retirar_aparelhos) só deve ser aplicado depois que o código novo estiver no ar e conferido.
--
-- Como o servidor entra sem sessão do usuário: o aplicativo chama UMA função, public.executar_como_titular(função, argumentos), com a chave de serviço (só no servidor).
--   1. a função só aceita nomes da lista abaixo (as operações do aplicativo); qualquer outro nome, ou argumento que não seja parâmetro da função, é recusado;
--   2. o titular é sempre o usuário da lista protegida (nunca vem do pedido): public.assumir_titular() grava, só nesta transação, as claims desse usuário (sub, e-mail, provedor);
--   3. a execução passa para o papel authenticated, igual ao que o PostgREST fazia com a sessão do titular: a RLS e as verificações de conta_autorizada() continuam valendo em todas as operações;
--   4. o resultado e os erros da função (P0001, DM409) saem como antes.
-- Só o papel de serviço executa as duas funções. ATENÇÃO: as claims gravadas NÃO levam session_id; enquanto a exigência de aparelho (exigir_aparelho) estiver LIGADA, conta_autorizada() recusaria a
-- entrada direta. Nesta transição a exigência está desligada e deve continuar assim até o passo 2, que a elimina.

-- assumir_titular: grava, só na transação atual, as claims do titular único (a conta da lista protegida). Definer, porque o servidor (papel de serviço) não lê a lista protegida.
create or replace function public.assumir_titular() returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_email text;
begin
  select u.id, lower(btrim(u.email)) into v_id, v_email
    from auth.users u join dmanda_privado.acesso_autorizado a on a.email = lower(btrim(u.email)) order by u.id limit 1;
  if v_id is null then raise exception 'Nenhum usuário da lista protegida foi encontrado.' using errcode = 'P0001'; end if;
  perform set_config('request.jwt.claim.sub', v_id::text, true),
          set_config('request.jwt.claims', jsonb_build_object('sub', v_id, 'role', 'authenticated', 'email', v_email,
                                                              'app_metadata', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')))::text, true);
end $$;

-- executar_como_titular: SECURITY INVOKER de propósito (um definer não pode trocar de papel). Executa uma operação da lista, como o titular, sob a RLS do papel authenticated.
create or replace function public.executar_como_titular(p_funcao text, p_args jsonb default '{}'::jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  -- exatamente as operações que o aplicativo chama (src/nucleo/operacoes.ts e src/servidor/demandas.ts); atualizar esta lista é parte de criar uma operação nova
  v_permitidas constant text[] := array[
    'adicionar_tarefa', 'arquivar_demanda', 'arquivar_entrada', 'atualizar_para_hoje', 'buscar_demanda', 'buscar_entrada', 'buscar_evento', 'concluir_demanda', 'criar_demanda',
    'criar_demanda_de_entrada', 'criar_entrada', 'criar_evento', 'criar_opcao', 'desarquivar_demanda', 'desarquivar_entrada', 'editar_tarefa', 'estado_rotina', 'excluir_demanda',
    'excluir_dia_indisponivel', 'excluir_entrada', 'excluir_evento', 'excluir_tarefa', 'fixar_entrada', 'listar_demandas', 'listar_dias_indisponiveis', 'listar_entradas',
    'listar_eventos', 'listar_opcoes', 'listar_para_hoje', 'listar_registros_dia', 'marcar_tarefa', 'mover_etapa', 'reabrir_demanda', 'registrar_dias', 'salvar_demanda',
    'salvar_dia_indisponivel', 'salvar_entrada', 'salvar_evento'];
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
  v_oid oid; v_n int; v_parametros text; v_resultado jsonb;
begin
  if p_funcao is null or not (p_funcao = any (v_permitidas)) then raise exception 'Operação não permitida.' using errcode = 'P0001'; end if;
  if jsonb_typeof(v_args) <> 'object' then raise exception 'Argumentos inválidos.' using errcode = 'P0001'; end if;
  select count(*) into v_n from pg_catalog.pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_funcao;
  if v_n <> 1 then raise exception 'Operação indisponível.' using errcode = 'P0001'; end if;
  select p.oid into v_oid from pg_catalog.pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_funcao;
  -- os argumentos são parâmetros nomeados da função: o nome tem de existir na assinatura, o tipo vem do catálogo e o valor entra como literal (nunca como SQL)
  select string_agg(format('%I => %L::%s', a.nome, case when a.tipo::regtype in ('jsonb'::regtype, 'json'::regtype) then k.value::text else k.value #>> '{}' end, a.tipo::regtype::text), ', ' order by a.nome), count(*)
    into v_parametros, v_n
    from jsonb_each(v_args) k
    join (select x.nome, x.tipo from pg_catalog.pg_proc p, unnest(p.proargnames, string_to_array(p.proargtypes::text, ' ')::oid[]) as x(nome, tipo) where p.oid = v_oid) a on a.nome = k.key;
  if v_n <> (select count(*) from jsonb_object_keys(v_args)) then raise exception 'Argumento desconhecido para a operação.' using errcode = 'P0001'; end if;
  perform public.assumir_titular();
  set local role authenticated;
  execute format('select public.%I(%s)', p_funcao, coalesce(v_parametros, '')) into v_resultado;
  return v_resultado;
end $$;

revoke all on function public.assumir_titular(), public.executar_como_titular(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.assumir_titular(), public.executar_como_titular(text, jsonb) to service_role;
