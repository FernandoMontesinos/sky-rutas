"use client";

import { useActionState, useState, startTransition } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Camera,
  FileText,
  Truck,
  PackageX,
} from "lucide-react";
import {
  completeOrder,
  marcarEnTransito,
  marcarNoRecogido,
  type FormResult,
} from "../actions";
import { MultiImagePicker, type PickedImage } from "@/components/multi-image-picker";
import { TYPE_LABEL, type OrderType } from "@/lib/types";

function esPdf(url: string) {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

/**
 * La guía que ya se subió al recoger, en modo lectura. Quien cuenta la
 * mercadería necesita VERLA para comparar contra lo que tiene enfrente —
 * antes no la tenía a mano en este paso, solo un selector de fotos vacío que
 * parecía pedirle que la subiera de nuevo.
 */
function GuiaRegistrada({
  urls,
  numero,
  titulo = "Guía del recojo",
}: {
  urls: string[];
  numero?: string | null;
  titulo?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2.25} />
        <span className="font-medium text-gray-700">
          {titulo}{urls.length > 1 && ` (${urls.length} fotos)`}
        </span>
        {numero && <span className="font-semibold text-gray-900">N° {numero}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) =>
          esPdf(u) ? (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 text-[10px] text-gray-500 transition hover:border-brand hover:text-brand"
            >
              <FileText className="h-5 w-5" strokeWidth={1.75} />
              PDF
            </a>
          ) : (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u}
                alt={`Guía ${i + 1}`}
                className="h-16 w-16 rounded-lg border border-gray-200 bg-white object-cover transition hover:border-brand"
              />
            </a>
          )
        )}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Tócala para verla completa y comparar con lo que estás contando.
      </p>
    </div>
  );
}

/**
 * Paso 1 de un Pedido (Proveedor): el repartidor confirma que recogió el
 * material. A propósito NO cuenta ítems — recibe bultos sellados — pero SÍ
 * sabe, a nivel de bultos, si el proveedor le dio todo lo pedido o le avisó
 * que faltaba algo. Esa es la única pregunta que se le hace acá: "Completo"
 * es el camino de siempre (a En Tránsito, sin más preguntas); "Parcial"
 * dispara ahí mismo el mismo pedido-remanente que antes se creaba recién al
 * cerrar (ver completeOrder/marcarEnTransito) — el resto de esa lógica no
 * cambió, solo se disparó un paso antes. La orden sigue a "En Tránsito" con
 * lo que sí se recogió, y quien la cierre después ya no vuelve a preguntar
 * (ver CompletarForm, decidioAlRecoger).
 *
 * Acá NO se pide guía: la guía de remisión la emite SkyHigh y solo aplica a
 * clientes. La del proveedor nunca se registra. La constancia del recojo pasa
 * a ser la foto del material, que por eso es obligatoria en los tres casos.
 */
export function RecojoForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(marcarEnTransito, {});
  const [materialImages, setMaterialImages] = useState<PickedImage[]>([]);
  const [parcial, setParcial] = useState(false);
  const [faltante, setFaltante] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function confirmar() {
    if (materialImages.length === 0) {
      setLocalError("Toma al menos una foto del material que estás recogiendo.");
      return;
    }
    if (parcial && faltante.trim().length === 0) {
      setLocalError("Cuéntanos qué falta — se usa para crear el pedido pendiente restante.");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("observaciones", observaciones.trim());
    fd.set("entrega_parcial", String(parcial));
    fd.set("nota_faltante", faltante.trim());
    materialImages.forEach((img) => fd.append("material", img.file));
    startTransition(() => action(fd));
  }

  const errorMsg = localError ?? state.error;

  return (
    <div className="space-y-4 rounded-2xl border border-sky-300 bg-sky-50 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-gray-900">
        <Camera className="h-5 w-5 text-sky-700" />
        Foto(s) del material recogido
      </h2>

      <MultiImagePicker
        label=""
        images={materialImages}
        onChange={setMaterialImages}
        soloCamara
        tituloBoton="Foto Material"
      />

      <div>
        <span className="mb-1 block text-sm font-medium text-gray-700">
          ¿El proveedor te dio todo lo pedido?
        </span>
        <p className="mb-2 text-xs text-gray-500">
          No hace falta contar ítems — solo si te dio menos bultos de los que esperabas o
          te avisó que faltaba algo.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setParcial(false)}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition ${
              !parcial
                ? "border-green-600 bg-green-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-green-600"
            }`}
          >
            <CheckCircle2 className="h-5 w-5" />
            Completo
          </button>
          <button
            type="button"
            onClick={() => setParcial(true)}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition ${
              parcial
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-orange-500"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
            Parcial
          </button>
        </div>
        {parcial && (
          <div className="mt-2 space-y-1.5 rounded-lg border border-orange-200 bg-orange-50 p-3">
            <label htmlFor="faltante_recojo" className="block text-xs font-medium text-orange-900">
              ¿Qué falta? Con esto se crea el pedido pendiente con lo que queda.
            </label>
            <textarea
              id="faltante_recojo"
              value={faltante}
              onChange={(e) => setFaltante(e.target.value)}
              rows={2}
              placeholder="Ej. Faltaron 2 de 5 cajas, el proveedor dijo que el jueves"
              className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="obs_recojo" className="mb-1 block text-xs font-medium text-gray-700">
          Observaciones (opcional)
        </label>
        <textarea
          id="obs_recojo"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={2}
          placeholder="Ej. Me entregaron 3 bultos, uno venía abierto"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30"
        />
      </div>

      {errorMsg && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
      )}

      <button
        type="button"
        onClick={confirmar}
        disabled={pending || materialImages.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-700 py-3 font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
      >
        <Truck className="h-5 w-5" />
        {pending ? "Confirmando..." : `Confirmar recojo${parcial ? " (parcial)" : ""}`}
      </button>
      <p className="text-center text-xs text-gray-600">
        {parcial ? (
          <>
            Lo que recogiste sigue a <strong>En Tránsito</strong>. Aparte se crea un pedido
            con lo que falta, para que almacén lo coordine con el proveedor.
          </>
        ) : (
          <>
            La orden queda <strong>En Tránsito</strong> hasta que se verifique la cantidad.
          </>
        )}
      </p>

      <NoRecogidoForm orderId={orderId} />
    </div>
  );
}

/** Motivos fijos: cubren la gran mayoría de los casos sin tener que escribir
 *  nada. "Otro" es el escape para lo que no calza en ninguno de los dos. */
const MOTIVOS_FIJOS = ["Proveedor cerrado", "Proveedor no tiene material listo"] as const;

/**
 * El otro desenlace posible del viaje al proveedor: fue y no había material.
 * Va detrás de un paso extra (`<details>`) para que no compita visualmente con
 * "Confirmar recojo", que es lo que pasa casi siempre.
 *
 * Botones en vez de un textarea libre: en la calle, con el celular en una
 * mano, elegir una opción es más rápido y confiable que escribir. "Otro"
 * revela un campo de texto solo cuando hace falta.
 */
function NoRecogidoForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<FormResult, FormData>(marcarNoRecogido, {});
  const [motivo, setMotivo] = useState<string | null>(null);
  const [otro, setOtro] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const esOtro = motivo === "otro";

  function confirmar() {
    if (!motivo) {
      setLocalError("Elige por qué no se pudo recoger.");
      return;
    }
    if (esOtro && otro.trim().length === 0) {
      setLocalError("Cuéntanos qué pasó.");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("motivo", esOtro ? otro.trim() : motivo);
    startTransition(() => action(fd));
  }

  const errorMsg = localError ?? state.error;

  return (
    <details className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-red-700">
        <PackageX className="h-4 w-4 shrink-0 text-red-500" strokeWidth={2.25} />
        No se pudo recoger
      </summary>

      <div className="mt-3 space-y-2">
        <p className="text-xs font-medium text-gray-700">
          ¿Por qué? Almacén lo va a ver para coordinar con el proveedor.
        </p>

        {/* Columna siempre, en vez de fila: tres botones lado a lado quedan
            demasiado angostos para tocarlos bien con el pulgar en celular. */}
        <div className="flex flex-col gap-2">
          {MOTIVOS_FIJOS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMotivo(m)}
              className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm font-medium transition ${
                motivo === m
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-gray-300 bg-white text-gray-700 hover:border-red-300"
              }`}
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMotivo("otro")}
            className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm font-medium transition ${
              esOtro
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-gray-300 bg-white text-gray-700 hover:border-red-300"
            }`}
          >
            Otro
          </button>
        </div>

        {esOtro && (
          <textarea
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            rows={2}
            placeholder="Cuéntanos qué pasó"
            aria-label="Detalle del motivo"
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
        )}

        {errorMsg && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
        )}

        <button
          type="button"
          onClick={confirmar}
          disabled={pending}
          className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Registrando..." : "Registrar que no se recogió"}
        </button>
        <p className="text-center text-xs text-gray-500">
          La orden vuelve a Pendientes para que almacén la reprograme.
        </p>
      </div>
    </details>
  );
}

/**
 * Cierre de la orden: lo hace quien CONTÓ la mercadería. En una entrega a
 * cliente es el repartidor (el cliente cuenta y firma delante suyo); en un
 * pedido que llega al depósito es almacén; en un pedido que va directo del
 * proveedor al cliente vuelve a ser el repartidor.
 */
export default function CompletarForm({
  orderId,
  tipo,
  verificando = false,
  numeroGuiaActual,
  guiasActuales = [],
  materialActual = [],
  entregaParcialPrevia = false,
}: {
  orderId: string;
  tipo: OrderType;
  /** La orden ya venía "En Tránsito": ya se subió material al recoger, así
   *  que acá la foto es opcional y el texto habla de verificar, no de entregar. */
  verificando?: boolean;
  /** Si ya se escribió el número de guía, acá es editable por si hay que
   *  corregirlo, pero no obligatorio de nuevo. Solo aplica a clientes. */
  numeroGuiaActual?: string | null;
  /** Guías ya subidas: se muestran para consultarlas al contar. */
  guiasActuales?: string[];
  /** Fotos de material ya subidas (típicamente en el recojo). */
  materialActual?: string[];
  /** Si el repartidor ya marcó "Parcial" al recoger (ver RecojoForm). Solo
   *  informativo acá — la decisión ya está tomada, no se vuelve a preguntar. */
  entregaParcialPrevia?: boolean;
}) {
  const [state, action, pending] = useActionState<FormResult, FormData>(
    completeOrder,
    {}
  );
  const [images, setImages] = useState<PickedImage[]>([]);
  const [materialImages, setMaterialImages] = useState<PickedImage[]>([]);
  const [numeroGuia, setNumeroGuia] = useState(numeroGuiaActual ?? "");
  const [parcial, setParcial] = useState(false);
  const [faltante, setFaltante] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // La guía de remisión la emite SkyHigh y solo aplica a clientes; la del
  // proveedor no se registra nunca. En un Pedido, entonces, la constancia es
  // la foto del material.
  const esRecojo = tipo === "recojo";
  const pideGuia = !esRecojo;

  // Un Pedido que llegó hasta acá vía "En Tránsito" ya pasó por el recojo del
  // repartidor, y ahí ya se decidió completo/parcial (ver RecojoForm). No se
  // vuelve a preguntar: los otros caminos a este formulario (oficina/courier,
  // el override de almacén, o una entrega a cliente) nunca pasan por un
  // recojo, así que en esos sí sigue preguntando, igual que siempre.
  const decidioAlRecoger = esRecojo && verificando;

  function confirmar() {
    if (pideGuia) {
      if (!verificando && images.length === 0) {
        setLocalError("Primero toma la foto de la guía.");
        return;
      }
      if (!numeroGuiaActual && numeroGuia.trim().length === 0) {
        setLocalError("Escribe el número de guía (está impreso en el documento).");
        return;
      }
    } else if (materialImages.length === 0 && materialActual.length === 0) {
      setLocalError("Toma al menos una foto del material antes de cerrar.");
      return;
    }
    if (!decidioAlRecoger && parcial && faltante.trim().length === 0) {
      setLocalError("Cuéntanos qué falta — se usa para crear el pedido pendiente restante.");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("order_id", orderId);
    if (!decidioAlRecoger) {
      fd.set("entrega_parcial", String(parcial));
      fd.set("nota_faltante", faltante.trim());
    }
    fd.set("observaciones", observaciones.trim());
    if (pideGuia) fd.set("numero_guia", numeroGuia.trim());
    images.forEach((img) => fd.append("guias", img.file));
    materialImages.forEach((img) => fd.append("material", img.file));
    startTransition(() => action(fd));
  }

  const accion = tipo === "entrega" ? "entrega" : "recojo";
  const articulo = tipo === "entrega" ? "la" : "el";
  const accionParticipio = tipo === "entrega" ? "entregado" : "recogido";
  const errorMsg = localError ?? state.error;

  // Lo que ya vino del paso anterior: este paso es CONTAR y cerrar, no volver
  // a subir lo mismo. Se muestra para consultarlo, y los selectores pasan a un
  // paso extra plegado — el caso excepcional (una foto borrosa, una segunda
  // guía) no debe ocupar el mismo espacio que lo habitual.
  const yaHayGuia = pideGuia && verificando && guiasActuales.length > 0;
  const yaHayMaterial = esRecojo && verificando && materialActual.length > 0;
  const plegado = yaHayGuia || yaHayMaterial;

  const selectorMaterial = (
    <div>
      <span className="mb-1 block text-xs font-medium text-gray-700">
        Foto(s) del material{pideGuia ? " (opcional)" : ""}
      </span>
      <MultiImagePicker
        label=""
        images={materialImages}
        onChange={setMaterialImages}
        soloCamara
        tituloBoton="Foto Material"
      />
    </div>
  );

  const camposFoto = pideGuia ? (
    <>
      {/* Guía y material lado a lado: son dos fotos del mismo momento, y con
          el N° de guía en medio el material parecía de otra sección. En
          celular van apilados pero pegados, porque partir cada selector a la
          mitad deja los botones de cámara demasiado chicos para el pulgar. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-700">Foto(s) de la guía</span>
          <MultiImagePicker
            label=""
            images={images}
            onChange={setImages}
            soloCamara
            tituloBoton="Foto Guía"
          />
        </div>
        {selectorMaterial}
      </div>

      <div>
        <label htmlFor="numero_guia_completar" className="mb-1 block text-xs font-medium text-gray-700">
          N° de guía (el que emitimos nosotros)
          {numeroGuiaActual && " — ya registrado, corrígelo si hace falta"}
        </label>
        <input
          id="numero_guia_completar"
          value={numeroGuia}
          onChange={(e) => setNumeroGuia(e.target.value)}
          placeholder="Ej. T002-0001"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>
    </>
  ) : (
    selectorMaterial
  );

  return (
    <div className="space-y-4 rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-gray-900">
        <Camera className="h-5 w-5 text-brand" />
        {plegado
          ? decidioAlRecoger
            ? "Cerrar la orden"
            : "Contar y cerrar la orden"
          : pideGuia
            ? "Foto(s) de la guía"
            : "Foto(s) del material"}
      </h2>

      {plegado ? (
        <>
          {yaHayGuia && <GuiaRegistrada urls={guiasActuales} numero={numeroGuiaActual} />}
          {yaHayMaterial && (
            <GuiaRegistrada urls={materialActual} titulo="Material del recojo" />
          )}
          <details className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-600">
              <Camera className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={2.25} />
              {pideGuia ? "Agregar otra guía, fotos del material o corregir el N°" : "Agregar más fotos del material"}
            </summary>
            <div className="mt-3 space-y-3">{camposFoto}</div>
          </details>
        </>
      ) : (
        camposFoto
      )}

      {decidioAlRecoger ? (
        entregaParcialPrevia && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            Se marcó como parcial al recoger — ya se creó el pedido con lo que faltaba.
          </div>
        )
      ) : (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            {verificando
              ? "Después de contar los ítems, ¿cómo llegó?"
              : `¿Cómo quedó ${articulo} ${accion}?`}
          </span>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setParcial(false)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition ${
                !parcial
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-green-600"
              }`}
            >
              <CheckCircle2 className="h-5 w-5" />
              Completa
            </button>
            <button
              type="button"
              onClick={() => setParcial(true)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition ${
                parcial
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-orange-500"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              Parcial
            </button>
          </div>
          {parcial && (
            <div className="mt-2 space-y-1.5 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <label htmlFor="nota_faltante" className="block text-xs font-medium text-orange-900">
                ¿Qué falta completar? Con esto se crea el pedido pendiente restante.
              </label>
              <textarea
                id="nota_faltante"
                value={faltante}
                onChange={(e) => setFaltante(e.target.value)}
                rows={2}
                placeholder="Ej. Faltaron 3 cajas, quedaron en almacén del cliente"
                className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
            </div>
          )}
        </div>
      )}

      {/* Aparte de "qué falta" (que alimenta el remanente): esto es un
          comentario libre para cualquier eventualidad, salga completa o no.
          Antes solo existía el de arriba, y no había dónde anotar algo como
          "el cliente recibió con la tienda cerrada" en una entrega normal. */}
      <div>
        <label htmlFor="obs_completar" className="mb-1 block text-xs font-medium text-gray-700">
          Observaciones (opcional)
        </label>
        <textarea
          id="obs_completar"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={2}
          placeholder="Cualquier eventualidad que quieras dejar registrada"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      {errorMsg && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-dark">{errorMsg}</p>
      )}

      <button
        type="button"
        onClick={confirmar}
        disabled={
          pending ||
          (pideGuia
            ? !verificando && images.length === 0
            : materialImages.length === 0 && materialActual.length === 0)
        }
        className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending
          ? "Confirmando..."
          : decidioAlRecoger
            ? "Cerrar orden"
            : verificando
              ? `Cerrar orden (llegó ${parcial ? "parcial" : "completa"})`
              : `Confirmar ${accion} (marcar como ${accionParticipio}${parcial ? " parcialmente" : ""})`}
      </button>
      <p className="text-center text-xs text-gray-500">
        {TYPE_LABEL[tipo]} · Al confirmar, la orden se marca como completada.
      </p>
    </div>
  );
}
