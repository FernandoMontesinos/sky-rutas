"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de envío que se deshabilita y muestra un texto de espera mientras
 * la Server Action del formulario está en curso. Úsalo dentro de un <form action={...}>.
 */
export function SubmitButton({
  children,
  pendingText = "Guardando...",
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingText : children}
    </button>
  );
}
