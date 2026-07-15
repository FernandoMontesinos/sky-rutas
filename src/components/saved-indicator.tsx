import { Check, Loader2 } from "lucide-react";

/** Texto breve de estado para formularios con autoguardado. */
export function SavedIndicator({ pending, saved }: { pending: boolean; saved: boolean }) {
  return (
    <p className="flex h-4 items-center gap-1 text-xs text-gray-400">
      {pending ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
          Guardando...
        </>
      ) : saved ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" strokeWidth={3} />
          <span className="text-green-700">Guardado</span>
        </>
      ) : null}
    </p>
  );
}
