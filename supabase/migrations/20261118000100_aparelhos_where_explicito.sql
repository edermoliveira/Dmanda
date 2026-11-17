-- Dmanda: hotfix da etapa 6 sobre a migração 20261118000000_aparelhos_autorizados (já aplicada, não é reescrita).
--
-- Problema: o Supabase hospedado carrega a extensão pg_safeupdate nas sessões da API (PostgREST), que recusa UPDATE e DELETE sem WHERE
-- ("DELETE requires a WHERE clause"). O PGlite dos testes não tem a extensão. Duas funções da migração anterior tinham comando sem WHERE e
-- falhavam em produção quando chamadas pela API com a chave de serviço:
--   * criar_convite_terminal: "delete from dmanda_privado.falhas_pareamento;"        (npm run aparelhos -- convite)
--   * exigir_aparelhos:       "update dmanda_privado.config_acesso set exigir_aparelho = ...;"  (npm run aparelhos -- exigir sim|nao)
--
-- Correção, só nestas duas funções (mesmas assinaturas, mesmo dono, security definer, search_path vazio e mesmos privilégios; nenhuma tabela, coluna,
-- política ou dado é alterado):
--   * A limpeza das falhas de pareamento continua GLOBAL, por desenho (decisão 82, item 4): a tabela não tem coluna de usuário e a trava de 10 falhas
--     é aberta a qualquer visitante da tela de acesso; quem gera o código com a chave de serviço é o titular e a trava não pode impedir a recuperação.
--     A condição agora é explícita ("where true"), com o mesmo efeito de antes.
--   * exigir_aparelhos atualiza a única linha de configuração (config_acesso tem "id boolean primary key check (id)", ou seja, só existe a linha id = true)
--     e, se por algum motivo essa linha não existir, recusa em vez de devolver "ligada" sem ter gravado nada.

create or replace function public.criar_convite_terminal(p_codigo text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_codigo text := upper(btrim(coalesce(p_codigo, ''))); v_user uuid; v_expira timestamptz := now() + interval '10 minutes';
begin
  if v_codigo !~ '^[A-Z0-9]{8}$' then perform public.erro_dmanda('Código de convite inválido.'); end if;
  select u.id into v_user from auth.users u join dmanda_privado.acesso_autorizado a on a.email = lower(btrim(u.email)) order by u.id limit 1;
  if v_user is null then perform public.erro_dmanda('Nenhum usuário da lista protegida foi encontrado.'); end if;
  delete from dmanda_privado.convites_aparelho where user_id = v_user and (usado_em is null or expira_em < now() - interval '1 day');
  -- quem tem a chave de serviço é o titular: a trava de tentativas, aberta a qualquer visitante da tela de acesso, não pode impedir a recuperação (limpeza global, de propósito)
  delete from dmanda_privado.falhas_pareamento where true;
  insert into dmanda_privado.convites_aparelho (user_id, codigo_hash, origem, expira_em) values (v_user, encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'), 'terminal', v_expira);
  return jsonb_build_object('expira_em', v_expira);
end $$;

create or replace function public.exigir_aparelhos(p_exigir boolean) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- ligar a exigência sem nenhum aparelho autorizado trancaria o titular para fora: antes, autorize ao menos um aparelho (convite do terminal)
  if coalesce(p_exigir, false) and not exists (select 1 from dmanda_privado.aparelhos where revogado_em is null and expira_em > now()) then
    perform public.erro_dmanda('Autorize ao menos um aparelho antes de ligar a exigência.');
  end if;
  update dmanda_privado.config_acesso set exigir_aparelho = coalesce(p_exigir, false) where id;
  if not found then perform public.erro_dmanda('A configuração de acesso não foi encontrada.'); end if;
  return coalesce(p_exigir, false);
end $$;

-- create or replace preserva os privilégios; repetidos aqui só para ficarem explícitos (lista nominal, nunca "all functions")
revoke all on function public.criar_convite_terminal(text), public.exigir_aparelhos(boolean) from public, anon, authenticated;
grant execute on function public.criar_convite_terminal(text), public.exigir_aparelhos(boolean) to service_role;
