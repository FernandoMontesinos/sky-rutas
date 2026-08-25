import { FileText, ExternalLink, X, Download } from "lucide-react";
import { eliminarAdjunto } from "@/app/(app)/ordenes/actions";
import { nombreArchivo, urlDescarga } from "@/lib/descarga";

function esPdf(url: string) {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

/**
 * Descarga directa del archivo tal cual (imagen o PDF), sin pasar por un ZIP:
 * cuando se mira UNA orden, lo que se necesita es el archivo listo para
 * adjuntar a un correo. El ZIP sigue en Reportes, para bajar muchas de golpe.
 */
function BotonDescargar({
  url,
  nombre,
  esquina = false,
}: {
  url: string;
  nombre: string;
  esquina?: boolean;
}) {
  return (
    <a
      // Sin target="_blank": con ?download el servidor responde como adjunto y
      // el navegador descarga sin salir de la página. Abrir pestaña nueva solo
      // dejaba la imagen a la vista, que es justo lo que se quería evitar.
      href={urlDescarga(url, nombre)}
      download={nombre}
      aria-label="Descargar este archivo"
      title="Descargar este archivo"
      className={
        esquina
          ? "absolute -left-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800/80 text-white shadow transition hover:bg-brand"
          : "shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-brand"
      }
    >
      <Download className={esquina ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.25} />
    </a>
  );
}

/** Botón "×" para quitar un adjunto — solo se muestra cuando la orden lo permite. */
function BotonEliminar({ orderId, url }: { orderId: string; url: string }) {
  return (
    <form action={eliminarAdjunto} className="absolute -right-1.5 -top-1.5 z-10">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="url" value={url} />
      <button
        type="submit"
        aria-label="Quitar este archivo"
        title="Quitar este archivo"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800/80 text-white shadow transition hover:bg-brand"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </form>
  );
}

/** Miniatura para el caso de varios archivos en cuadrícula (poco espacio, no vale la pena embeber). */
function PdfCard({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-medium text-gray-700 transition hover:border-brand/40 hover:text-brand"
    >
      <FileText className="h-5 w-5 shrink-0 text-gray-400" strokeWidth={1.75} />
      {label}
    </a>
  );
}

/**
 * Visor embebido para el caso de un solo PDF (el más común: una cotización
 * u orden de compra). Usa el visor nativo del navegador dentro de un
 * <iframe> — sin librerías nuevas. El link de arriba es respaldo para el
 * caso en que el navegador (algunos Safari/iOS viejos) descargue el
 * archivo en vez de mostrarlo inline.
 */
function PdfEmbed({
  url,
  label,
  nombre,
  eliminar,
}: {
  url: string;
  label: string;
  nombre: string;
  eliminar?: { orderId: string };
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center gap-2 truncate transition hover:text-brand"
        >
          <FileText className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} />
          <span className="flex-1 truncate">{label}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={2} />
        </a>
        <BotonDescargar url={url} nombre={nombre} />
        {eliminar && (
          <form action={eliminarAdjunto}>
            <input type="hidden" name="order_id" value={eliminar.orderId} />
            <input type="hidden" name="url" value={url} />
            <button
              type="submit"
              aria-label="Quitar este archivo"
              title="Quitar este archivo"
              className="shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-red-50 hover:text-brand"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </form>
        )}
      </div>
      {/* toolbar=0/navpanes=0: oculta la barra de herramientas y el panel
          de miniaturas del visor nativo (Chrome/Edge lo respetan) para que
          se vea solo el contenido de la página, sin perder ancho. */}
      <iframe
        src={`${url}#toolbar=0&navpanes=0&view=FitH`}
        title={label}
        className="h-[70vh] w-full"
      />
    </div>
  );
}

/**
 * Cuadrícula simple de imágenes/PDFs con enlace a tamaño completo en pestaña
 * nueva. Si se pasa `orderId`, cada archivo lleva un botón para quitarlo de
 * la orden (no borra la orden en sí, solo el adjunto).
 */
export function ImageGallery({
  urls,
  alt,
  orderId,
  descargaPrefijo,
}: {
  urls: string[];
  alt: string;
  orderId?: string;
  /** Con qué nombre se guardan los archivos al descargarlos (ej. "guia-S15341"). */
  descargaPrefijo?: string;
}) {
  if (urls.length === 0) return null;

  const prefijo = descargaPrefijo ?? alt;
  const nombreDe = (url: string, i: number) => nombreArchivo(prefijo, url, i, urls.length);

  if (urls.length === 1) {
    return esPdf(urls[0]) ? (
      <PdfEmbed
        url={urls[0]}
        label={`${alt} (PDF)`}
        nombre={nombreDe(urls[0], 0)}
        eliminar={orderId ? { orderId } : undefined}
      />
    ) : (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[0]}
          alt={alt}
          className="w-full rounded-xl border border-gray-200 bg-white object-contain"
        />
        <BotonDescargar url={urls[0]} nombre={nombreDe(urls[0], 0)} esquina />
        {orderId && <BotonEliminar orderId={orderId} url={urls[0]} />}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url, i) =>
        esPdf(url) ? (
          <div key={url} className="relative">
            <PdfCard url={url} label={`${alt} ${i + 1} (PDF)`} />
            <BotonDescargar url={url} nombre={nombreDe(url, i)} esquina />
            {orderId && <BotonEliminar orderId={orderId} url={url} />}
          </div>
        ) : (
          <div key={url} className="relative">
            <a href={url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${alt} ${i + 1}`}
                className="h-32 w-full rounded-xl border border-gray-200 bg-white object-cover"
              />
            </a>
            <BotonDescargar url={url} nombre={nombreDe(url, i)} esquina />
            {orderId && <BotonEliminar orderId={orderId} url={url} />}
          </div>
        )
      )}
    </div>
  );
}
