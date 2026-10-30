# Dmanda

Painel pessoal de demandas do Secretário de Administração da Prefeitura de Taquara/RS. Reúne Início, Entradas, Demandas, Agenda, Documentos, IA e Configurações, para não esquecer demandas, acompanhar o que está em outro setor e ver prazos (legal e próprio) com poucos campos. Usuário único. Funciona no celular, iPad e computador.

## Estado

- **Publicado:** https://dmanda-adm.vercel.app (Vercel Hobby, Supabase Free). Acesso restrito por e-mail e senha ao usuário único. A `main` é a única branch e a que publica.
- **Design:** Catalyst único (claro e escuro), aprovado no protótipo em `prototipo/`. A aplicação React ainda aguarda a avaliação visual do usuário.
- **Aplicação funcional** (Next.js 16, React 19, Supabase) em `src/`: demandas e tarefas com as quatro visões, cadastro guiado em três passos, consulta com lápis por seção, prazo original e ajustado, Início, dias indisponíveis em Configurações, cópia dos dados em JSON, PWA online e rotina diária na nuvem. As demais áreas (Entradas, Agenda, Documentos, IA, Configurações) ainda não foram construídas.
- **Supabase:** 8 migrações aplicadas (a 8, de 29/10/2026, traz o prazo original e ajustado e os dias indisponíveis), segurança validada, entrada por e-mail e senha, Google desligado. A sessão persiste (sem limite de inatividade). **Ainda não validado em produção:** cron registrado e primeira execução, a sessão persistente por horas reais no iPhone, instalação da PWA.
- **Resumo consolidado, validação e retomada em outro computador:** `CONTINUIDADE-DMANDA.md`.

## Como rodar

```
npm install        (só na primeira vez)
npm run dev:teste  (aplicação em http://localhost:7100 com banco local descartável, sem Supabase)
npm run dev        (aplicação em http://localhost:7100 com o Supabase real, exige .env.local)
```

Protótipo de referência (HTML puro, dados fictícios): dentro de `prototipo`, `python -m http.server 7200 --bind 127.0.0.1` e http://127.0.0.1:7200.

Variáveis: copiar `.env.example` para `.env.local` e preencher (nunca vai para o Git). Passos do Supabase e da Vercel em `supabase/LEIA-ME.md`.

## Testes

`npm run testar:banco`, `npm run testar:regras`, `npm run testar:app`, `npm run testar:sessao` (veja o `CLAUDE.md` para o que cada um cobre e as limitações).

## Documentos

Comece por `CONTINUIDADE-DMANDA.md` (estado, validação e retomada), depois `CLAUDE.md` (regras do projeto) e `DECISOES.md` (decisões mais recentes). O que aguarda o usuário está em `PENDENCIAS.md` e a retomada em `SINCRONIZA-PROJETINHO.md`.
