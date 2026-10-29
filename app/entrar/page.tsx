import { Suspense } from "react";
import AuthForm from "@/app/entrar/AuthForm";

export const metadata = { title: "Entrar" };

export default function EntrarPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
