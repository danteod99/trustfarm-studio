import LegalPage from "@/app/components/LegalPage";

export const metadata = { title: "Política de reembolsos" };

export default function Reembolsos() {
  return (
    <LegalPage title="Política de reembolsos" updated="29 de octubre de 2026">
      <h2>Generaciones fallidas</h2>
      <p>
        Si una generación no se completa por un error técnico, por tiempo de espera o por el filtro de seguridad del modelo,
        los créditos se devuelven automáticamente a tu saldo.
      </p>
      <h2>Paquetes de créditos</h2>
      <p>
        Puedes pedir el reembolso de un paquete dentro de los 14 días posteriores a la compra si no has usado ninguno de sus
        créditos. Una vez usados, los créditos no son reembolsables, ya que el costo de generación ya se pagó al proveedor del
        modelo.
      </p>
      <h2>Cómo solicitarlo</h2>
      <p>Escríbenos desde el email de tu cuenta indicando la fecha de compra. Respondemos en un máximo de 3 días hábiles.</p>
    </LegalPage>
  );
}
