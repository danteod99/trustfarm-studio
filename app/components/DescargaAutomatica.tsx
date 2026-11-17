"use client";
// Anfitrión invisible: mantiene viva la descarga automática de entregas de bucles mientras haya una pestaña de Studio abierta.
import { useEffect } from "react";
import { iniciar } from "@/app/lib/descarga-controlador";

export default function DescargaAutomatica({ userId }: { userId: string }) {
  useEffect(() => iniciar(userId), [userId]);
  return null;
}
