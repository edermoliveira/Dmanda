import '@/estilos/acesso.css';
import { EsquecerUsuario } from '@/ui/acesso';

// Telas de acesso (entrar, recuperar, definir senha): fora da casca do painel, sem dado nenhum do painel.
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return <main className="acesso"><EsquecerUsuario /><div className="acesso-cartao">{children}</div></main>;
}
