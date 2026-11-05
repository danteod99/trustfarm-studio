"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicGeneration } from "@/app/components/GenerationCard";
import { EVENTO_SALDO } from "@/app/components/SaldoCreditos";

const POLL_MS = 8000;

/** Lista de generaciones del usuario con polling automático de las que siguen en curso. */
export function useGenerations(query = "") {
  const [items, setItems] = useState<PublicGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalanceLocal] = useState<number | null>(null);
  // Además de guardarlo aquí, avisa al contador del menú para que cambie al instante.
  const setBalance = useCallback((n: number) => {
    setBalanceLocal(n);
    window.dispatchEvent(new CustomEvent(EVENTO_SALDO, { detail: n }));
  }, []);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/generations${query}`);
    if (r.ok) setItems((await r.json()).generations);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(async () => {
      const running = itemsRef.current.filter((g) => g.status === "running");
      if (!running.length) return;
      const updates = await Promise.all(
        running.map(async (g) => {
          const r = await fetch(`/api/generations/${g.id}`);
          if (!r.ok) return null;
          const d = await r.json();
          setBalance(d.balance);
          return d.generation as PublicGeneration;
        })
      );
      setItems((prev) => prev.map((g) => updates.find((u) => u?.id === g.id) ?? g));
    }, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const prepend = (g: PublicGeneration) => setItems((prev) => [g, ...prev.filter((x) => x.id !== g.id)]);

  return { items, loading, balance, setBalance, prepend, reload: load };
}
