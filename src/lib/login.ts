// O Google fica oculto por padrão: o acesso é por e-mail e senha. O botão só aparece com DMANDA_LOGIN_GOOGLE=sim
// (e só funciona se o provedor Google também estiver ligado no painel do Supabase). Esta função só decide a apresentação:
// as regras de acesso (hook, RLS, conta autorizada) não dependem dela.
export const googleLigado = (valor?: string): boolean => (valor ?? '').trim().toLowerCase() === 'sim';
