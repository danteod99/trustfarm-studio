"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/app/lib/supabase/browser";
import { siguienteSeguro } from "@/app/lib/siguiente";
import { eventoStudio } from "@/app/lib/pixel";

export default function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "registro">(params.get("modo") === "registro" ? "registro" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null);

  const next = siguienteSeguro(params.get("next"));
  // La URL de vuelta va sin parámetros: Supabase solo acepta las que coinciden con su lista de
  // Redirect URLs; con "?next=…" no coincidía y mandaba a la Site URL (trustmind.online).
  // A dónde ir después del login viaja en una cookie corta que lee /auth/callback.
  const callback = () => {
    document.cookie = `tf_next=${encodeURIComponent(next)}; path=/; max-age=900; samesite=lax; secure`;
    return `${window.location.origin}/auth/callback`;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const supabase = createBrowserSupabase();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ type: "error", text: "Email o contraseña incorrectos." });
      } else {
        router.push(next);
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callback(), data: { signup_source: "studio" } },
      });
      if (!error && data.user && (data.user.identities?.length ?? 0) > 0) eventoStudio("CompleteRegistration", { content_name: "Cuenta TrustFarm Studio" });
      if (error) {
        setMsg({ type: "error", text: error.message.includes("registered") ? "Ese email ya tiene cuenta. Entra con tu contraseña." : error.message });
      } else if (data.session) {
        router.push(next);
        router.refresh();
      } else {
        setMsg({ type: "ok", text: "Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada." });
      }
    }
    setLoading(false);
  }

  // La ventana de la mini PC entra directo a Google. Un solo intento: si se cancela, aquí queda el formulario.
  const directo = params.get("google") === "1";

  async function google() {
    await createBrowserSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(), ...(directo ? { queryParams: { prompt: "select_account" } } : {}) },
    });
  }

  const lanzado = useRef(false);
  useEffect(() => {
    if (directo && !lanzado.current) {
      lanzado.current = true;
      void google();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card border-brand/30 bg-panel/90 p-7 resplandor backdrop-blur">
      <h1 className="text-2xl font-black">{mode === "login" ? "Entrar" : "Crear cuenta"}</h1>
      <p className="mt-1 text-sm text-mute">
        {mode === "login" ? "Accede a tu estudio de IA." : "Regístrate gratis y compra créditos cuando quieras generar."}
      </p>

      <button onClick={google} className="btn-ghost mt-6 w-full">
        Continuar con Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-mute">
        <span className="h-px flex-1 bg-line" /> o con tu email <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input className="input" type="email" required placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input"
          type="password"
          required
          minLength={6}
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {msg && <p className={`text-sm ${msg.type === "error" ? "text-error" : "text-ok"}`}>{msg.text}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-mute">
        {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
        <button onClick={() => setMode(mode === "login" ? "registro" : "login")} className="font-medium text-brand-2">
          {mode === "login" ? "Regístrate" : "Entra"}
        </button>
      </p>
    </div>
  );
}
