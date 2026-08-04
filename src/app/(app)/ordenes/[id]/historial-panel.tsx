"use client";

import { useState } from "react";
import { History, X } from "lucide-react";
import { CAMPO_LABEL, EVENTO_LABEL, type OrderEvent } from "@/lib/historial";

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Linea({ e }: { e: OrderEvent }) {
  const titulo = EVENTO_LABEL[e.tipo] ?? e.tipo;
  const campo = e.campo ? (CAMPO_LABEL[e.campo] ?? e.campo) : null;

  return (
    <li className="border-l-2 border-gray-200 pl-3">
      <div className="text-sm font-medium text-gray-900">
        {titulo}
        {campo && <span className="text-gray-500"> · {campo}</span>}
      </div>

      {e.campo && (
        <div className="mt-0.5 space-y-0.5 text-xs">
          <div className="text-gray-400 line-through">{e.valor_antes || "(vacío)"}</div>
          <div className="font-medium text-gray-700">{e.valor_despues || "(vacío)"}</div>
        </div>
      )}
      {!e.campo && e.nota && <div className="mt-0.5 text-xs text-gray-600">{e.nota}</div>}

      <div className="mt-0.5 text-xs text-gray-400">
        {e.autor?.full_name ?? "—"} · {fecha(e.created_at)}
      </div>
    </li>
  );
}

/**
 * Historial de la orden en un panel que entra desde la derecha. Visible para
 * todos los roles: la idea es que cualquiera pueda ver quién cambió qué sin
 * tener que preguntar.
 */
export function HistorialPanel({ eventos }: { eventos: OrderEvent[] }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-brand hover:text-brand"
      >
        <History className="h-4 w-4" strokeWidth={2.25} />
        Historial
        {eventos.length > 0 && (
          <span className="rounded-full bg-gray-100 px-1.5 text-xs font-bold text-gray-500">
            {eventos.length}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setAbierto(false)}
            aria-hidden
          />
          <aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-xl"
            role="dialog"
            aria-label="Historial de la orden"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <History className="h-4 w-4 text-gray-400" strokeWidth={2.25} />
                Historial
              </h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar historial"
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {eventos.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Todavía no hay movimientos registrados en esta orden.
                </p>
              ) : (
                <ul className="space-y-3">
                  {eventos.map((e) => (
                    <Linea key={e.id} e={e} />
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
