// Corre en el navegador (Tesseract.js usa un worker + wasm) — nunca en el
// servidor. Se importa dinámicamente adentro de la función para no meter
// ~2-10MB de wasm/traineddata en el bundle principal de todo el que abre
// la app, solo de quien realmente llega a subir una foto de guía.

/**
 * Formato SUNAT de guía de remisión: serie (1-4 letras, a veces con dígitos
 * pegados) + guion + correlativo (hasta 8 dígitos). Ej. "T002-0001",
 * "EEEE-00012345". Se normaliza el texto reconocido a mayúsculas antes de
 * buscar el patrón porque el OCR es inconsistente con la capitalización.
 */
const PATRON_GUIA = /\b([A-Z]{1,4}\d{0,3})-(\d{1,8})\b/;

/**
 * Intenta leer el número de guía de la foto vía OCR. Es SOLO una ayuda para
 * pre-llenar el campo manual — nunca la fuente de verdad: si la foto sale
 * movida, borrosa, o el documento tiene otro formato, esto devuelve null y
 * el campo sigue siendo editable y obligatorio igual. Nunca lanza: un fallo
 * de OCR (sin red para bajar el modelo la primera vez, imagen rara, etc.)
 * no debe interrumpir el flujo de subir la guía.
 */
export async function reconocerNumeroGuia(file: File): Promise<string | null> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const {
        data: { text },
      } = await worker.recognize(file);
      const match = PATRON_GUIA.exec(text.toUpperCase());
      return match ? `${match[1]}-${match[2]}` : null;
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    console.error("[ocr-guia] no se pudo leer la foto", err);
    return null;
  }
}
