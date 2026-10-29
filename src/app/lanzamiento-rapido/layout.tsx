import { GuardiaCaja } from '@/components/caja/GuardiaCaja';

export default function LanzamientoRapidoLayout({ children }: { children: React.ReactNode }) {
  return <GuardiaCaja clave="lanzamiento-rapido">{children}</GuardiaCaja>;
}
