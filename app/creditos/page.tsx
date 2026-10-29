import { Suspense } from "react";
import Credits from "@/app/creditos/Credits";

export const metadata = { title: "Créditos" };

export default function CreditosPage() {
  return (
    <Suspense>
      <Credits />
    </Suspense>
  );
}
