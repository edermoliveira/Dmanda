import { useId, type InputHTMLAttributes } from "react";
import { CircleAlert, LoaderCircle, type LucideIcon } from "lucide-react";
import { Icone } from "./Icone";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  rotulo: string;
  ajuda?: string;
  erro?: string;
  carregando?: boolean;
  icone?: LucideIcon;
};

export function Campo({ rotulo, ajuda, erro, carregando = false, icone, id, className = "", ...resto }: Props) {
  const automatico = useId();
  const campoId = id ?? automatico;
  const mensagemId = `${campoId}-mensagem`;
  const mensagem = erro ?? ajuda;

  return (
    <div className={`flex flex-col gap-pequeno ${className}`}>
      <label htmlFor={campoId} className="font-bold">
        {rotulo}
      </label>
      <div className="relative">
        {icone && (
          <span className="pointer-events-none absolute inset-y-0 left-normal flex items-center text-texto-suave">
            <Icone icone={icone} />
          </span>
        )}
        <input
          id={campoId}
          aria-invalid={erro ? true : undefined}
          aria-describedby={mensagem ? mensagemId : undefined}
          aria-busy={carregando || undefined}
          className={`min-h-toque w-full rounded-medio border bg-superficie pr-gigante text-texto placeholder:text-texto-suave disabled:cursor-not-allowed disabled:opacity-50 ${
            icone ? "pl-gigante" : "pl-normal"
          } ${erro ? "border-perigo" : "border-borda"}`}
          {...resto}
        />
        {(carregando || erro) && (
          <span
            className={`pointer-events-none absolute inset-y-0 right-normal flex items-center ${
              erro ? "text-perigo" : "text-texto-suave"
            }`}
          >
            <Icone icone={erro ? CircleAlert : LoaderCircle} girar={!erro} />
          </span>
        )}
      </div>
      {mensagem && (
        <p
          id={mensagemId}
          role={erro ? "alert" : undefined}
          className={`text-detalhe ${erro ? "text-perigo" : "text-texto-suave"}`}
        >
          {mensagem}
        </p>
      )}
    </div>
  );
}
