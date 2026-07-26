import { FileText, ExternalLink } from "lucide-react";

function esPdf(url: string) {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
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
function PdfEmbed({ url, label }: { url: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition hover:text-brand"
      >
        <FileText className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} />
        <span className="flex-1 truncate">{label}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={2} />
      </a>
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

/** Cuadrícula simple de imágenes/PDFs con enlace a tamaño completo en pestaña nueva. */
export function ImageGallery({ urls, alt }: { urls: string[]; alt: string }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return esPdf(urls[0]) ? (
      <PdfEmbed url={urls[0]} label={`${alt} (PDF)`} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urls[0]}
        alt={alt}
        className="w-full rounded-xl border border-gray-200 bg-white object-contain"
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url, i) =>
        esPdf(url) ? (
          <PdfCard key={url} url={url} label={`${alt} ${i + 1} (PDF)`} />
        ) : (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${alt} ${i + 1}`}
              className="h-32 w-full rounded-xl border border-gray-200 bg-white object-cover"
            />
          </a>
        )
      )}
    </div>
  );
}
