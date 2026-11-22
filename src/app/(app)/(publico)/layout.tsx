import '@/estilos/acesso.css';

// Telas de acesso (entrar, recuperar, definir senha): fora da casca do painel, sem dado nenhum do painel.
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return <main className="acesso"><div className="acesso-cartao">{children}</div></main>;
}
