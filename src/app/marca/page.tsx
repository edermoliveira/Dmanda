import type { Metadata } from "next";
import { Download } from "lucide-react";
import { BotaoTema } from "@/components/BotaoTema";
import { Icone } from "@/components/Icone";
import { Logo } from "@/components/Logo";
import { NavPaginas } from "@/components/NavPaginas";

export const metadata: Metadata = { title: "Marca | Dmanda" };

const cartao = "rounded-card border border-borda bg-superficie/80 p-grande shadow-card";

const fundos = [
  { nome: "fundo", fundo: "bg-fundo", simbolo: "fill-destaque", uso: "Símbolo em destaque" },
  { nome: "superficie", fundo: "bg-superficie", simbolo: "fill-texto", uso: "Símbolo em texto" },
  { nome: "destaque", fundo: "bg-destaque", simbolo: "fill-sobre-destaque", uso: "Símbolo em sobre-destaque" },
  { nome: "texto", fundo: "bg-texto", simbolo: "fill-fundo", uso: "Símbolo em fundo" },
];

const cores = [
  { nome: "destaque", classe: "bg-destaque", papel: "Cor da marca" },
  { nome: "sobre-destaque", classe: "bg-sobre-destaque", papel: "Escrita sobre a cor da marca" },
  { nome: "texto", classe: "bg-texto", papel: "Nome e versão de uma cor só" },
  { nome: "fundo", classe: "bg-fundo", papel: "Fundo de apoio" },
];

const arquivos = [
  { arquivo: "simbolo-destaque.svg", uso: "Símbolo na cor de destaque (versão principal)" },
  { arquivo: "simbolo-para-fundo-claro.svg", uso: "Símbolo escuro, de uma cor só, para fundos claros" },
  { arquivo: "simbolo-para-fundo-escuro.svg", uso: "Símbolo claro, de uma cor só, para fundos escuros" },
  { arquivo: "icone-app.svg", uso: "Ícone quadrado, para o aplicativo e para a aba do navegador" },
];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-normal">
      <h2 className="text-subtitulo">{titulo}</h2>
      {children}
    </section>
  );
}

export default function Marca() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-gigante p-normal py-enorme sm:p-enorme">
      <header className="flex flex-wrap items-start justify-between gap-normal">
        <div>
          <h1 className="text-titulo">Marca do Dmanda</h1>
          <p className="mt-pequeno text-texto-suave">Logo, cores e como usar.</p>
        </div>
        <BotaoTema />
      </header>
      <NavPaginas />

      <Secao titulo="Logo">
        <div className={`${cartao} grid items-center gap-grande md:grid-cols-[2fr_1fr]`}>
          <div className="grid min-h-64 place-items-center rounded-medio border border-borda bg-superficie">
            <Logo className="size-maximo fill-destaque" nomeClassName="text-titulo" />
          </div>
          <div className="flex flex-col gap-medio">
            <h3 className="text-subtitulo">Um quadro dentro de um D</h3>
            <p>
              O D é a inicial do nome. Dentro dele estão três colunas, como um quadro de demandas: a
              entrada, o andamento e o fim. Cada coluna é mais curta que a anterior, como o trabalho
              que vai diminuindo.
            </p>
            <div className="flex items-end gap-normal">
              <Logo variante="simbolo" className="size-maximo fill-destaque" />
              <Logo variante="simbolo" className="size-gigante fill-destaque" />
              <Logo variante="simbolo" className="size-enorme fill-destaque" />
              <Logo variante="simbolo" className="size-grande fill-destaque" />
            </div>
          </div>
        </div>
      </Secao>

      <Secao titulo="Sobre cada fundo">
        <div className="grid gap-normal grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          {fundos.map((f) => (
            <div key={f.nome} className="flex flex-col gap-pequeno">
              <div className={`${f.fundo} grid place-items-center rounded-card border border-borda p-grande`}>
                <Logo variante="simbolo" className={`size-gigante ${f.simbolo}`} />
              </div>
              <span className="font-mono text-detalhe">fundo: {f.nome}</span>
              <span className="text-detalhe text-texto-suave">{f.uso}</span>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Cores da marca">
        <div className={`${cartao} flex flex-col gap-normal`}>
          <div className="grid gap-normal grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
            {cores.map((c) => (
              <div key={c.nome} className="flex items-center gap-medio">
                <span className={`${c.classe} size-gigante shrink-0 rounded-medio border border-borda`} />
                <div>
                  <div className="font-bold">{c.nome}</div>
                  <div className="text-detalhe text-texto-suave">{c.papel}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-detalhe text-texto-suave">
            Todas as cores, nos dois temas, estão em <a className="font-bold text-destaque-forte underline" href="/tokens">/tokens</a>.
          </p>
        </div>
      </Secao>

      <Secao titulo="Nome e fonte">
        <div className={`${cartao} flex flex-col gap-medio`}>
          <p className="text-titulo font-bold leading-none">Dmanda</p>
          <p className="font-mono text-detalhe text-texto-suave">Averia Serif Livre Bold, sempre com D maiúsculo e o resto em minúsculas.</p>
        </div>
      </Secao>

      <Secao titulo="Como usar">
        <div className="grid gap-normal md:grid-cols-2">
          <div className={`${cartao} flex flex-col gap-medio`}>
            <h3 className="font-bold text-destaque-forte">Faça</h3>
            <ul className="flex list-disc flex-col gap-pequeno pl-grande">
              <li>Use a versão em destaque sobre fundo, superfície ou texto.</li>
              <li>Use a versão de uma cor só quando houver só uma cor disponível.</li>
              <li>Deixe ao redor um espaço livre de pelo menos metade da largura do símbolo.</li>
              <li>Mostre o símbolo com 24 px ou mais. Abaixo disso, as colunas se perdem.</li>
              <li>Use o ícone quadrado para o aplicativo e para a aba do navegador.</li>
            </ul>
          </div>
          <div className={`${cartao} flex flex-col gap-medio`}>
            <h3 className="font-bold text-perigo">Não faça</h3>
            <ul className="flex list-disc flex-col gap-pequeno pl-grande">
              <li>Esticar, girar ou achatar o símbolo.</li>
              <li>Trocar a cor por uma que não esteja no design system.</li>
              <li>Colocar o símbolo em destaque sobre o próprio destaque (some).</li>
              <li>Usar a cor de perigo no logo. Ela é só para atrasado e crítico.</li>
              <li>Refazer o logo à mão. Para ajustar, mude o script e rode o comando abaixo.</li>
            </ul>
          </div>
        </div>
        <div className={`${cartao} flex flex-col gap-medio`}>
          <h3 className="font-bold">Espaço livre e tamanho mínimo</h3>
          <div className="flex flex-wrap items-center gap-grande">
            <div className="rounded-medio border border-dashed border-destaque-forte p-normal">
              <div className="rounded-pequeno border border-borda bg-superficie p-grande">
                <Logo variante="simbolo" className="size-gigante fill-destaque" />
              </div>
            </div>
            <div className="flex items-end gap-normal">
              <Logo variante="simbolo" className="size-grande fill-destaque" />
              <span className="font-mono text-detalhe text-texto-suave">24 px: tamanho mínimo</span>
            </div>
          </div>
        </div>
      </Secao>

      <Secao titulo="Arquivos do logo">
        <div className={`${cartao} flex flex-col gap-medio`}>
          {arquivos.map((a) => (
            <a
              key={a.arquivo}
              href={`/marca/${a.arquivo}`}
              download
              className="flex min-h-toque items-center gap-medio rounded-medio border border-borda bg-superficie px-normal hover:border-destaque"
            >
              <Icone icone={Download} />
              <span className="font-mono text-detalhe">{a.arquivo}</span>
              <span className="text-texto-suave">{a.uso}</span>
            </a>
          ))}
          <p className="text-detalhe text-texto-suave">
            Gerados por script a partir das cores do design system. Para gerar de novo, no terminal da pasta do
            projeto: <span className="font-mono">npm run gerar:logo</span>
          </p>
        </div>
      </Secao>
    </main>
  );
}
