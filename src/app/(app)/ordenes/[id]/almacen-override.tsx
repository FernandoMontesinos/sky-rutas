"use client";

import { useState } from "react";
import { Truck } from "lucide-react";

/**
 * Cuando la modalidad es Reparto, lo normal es que el repartidor complete
 * la orden desde su celular — por eso el formulario de completar no se
 * muestra de entrada a almacén (evita que lo marquen sin querer). Pero a
 * veces el repartidor no puede hacerlo (celular, señal, etc.), así que
 * almacén sí conserva la opción, un paso más allá para que sea intencional.
 */
export function AlmacenOverrideCompletar({
  repartidorNombre,
  children,
}: {
  repartidorNombre: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
        <Truck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
        <div>
          Es reparto por repartidor — {repartidorNombre} confirma la entrega/recojo desde
          su celular. Tu parte termina en asignar.
          {!show && (
            <button
              type="button"
              onClick={() => setShow(true)}
              className="mt-1.5 block font-semibold underline underline-offset-2 hover:text-blue-900"
            >
              ¿No puede completarla el repartidor? Complétala tú
            </button>
          )}
        </div>
      </div>
      {show && children}
    </div>
  );
}
