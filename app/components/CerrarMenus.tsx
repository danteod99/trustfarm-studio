"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Los menús del encabezado son <details data-menu>: el navegador no los cierra solos. Se cierran al
 * cambiar de página, al elegir una opción, al hacer clic fuera y con Escape.
 */
export default function CerrarMenus() {
  const pathname = usePathname();

  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]").forEach((d) => (d.open = false));
  }, [pathname]);

  useEffect(() => {
    const cerrar = (salvo?: Element | null) =>
      document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]").forEach((d) => {
        if (d !== salvo) d.open = false;
      });
    const clic = (e: MouseEvent) => {
      const t = e.target as Element;
      const menu = t.closest("details[data-menu]");
      // Una opción elegida (link o botón dentro del panel) también cierra su menú.
      cerrar(menu && !t.closest("a, button") ? menu : null);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("click", clic);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("click", clic);
      document.removeEventListener("keydown", tecla);
    };
  }, []);

  return null;
}
