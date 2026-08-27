/**
 * Arma un PDF con una página por foto, a partir de imágenes JPEG.
 *
 * Sin dependencias nuevas a propósito: un JPEG se puede incrustar en un PDF
 * TAL CUAL, sin recomprimir, declarándolo con el filtro `DCTDecode` — que es
 * justamente JPEG. Así que el "convertir a PDF" es en realidad envolver los
 * bytes originales en la estructura de un PDF, sin pérdida de calidad y sin
 * traer una librería de generación de PDFs.
 *
 * Solo acepta JPEG: es lo único que sube la app (compress-image.ts convierte
 * toda imagen a image/jpeg antes de subirla).
 */

/** Ancho/alto y componentes de color leídos de la cabecera del JPEG. */
type InfoJpeg = { ancho: number; alto: number; componentes: number };

/**
 * Lee las dimensiones del JPEG recorriendo sus marcadores hasta el SOF (Start
 * Of Frame), que es el que las declara. No sirve mirar solo el inicio del
 * archivo: antes del SOF vienen EXIF, miniaturas y tablas de cuantización de
 * largo variable.
 */
export function leerInfoJpeg(bytes: Uint8Array): InfoJpeg | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let i = 2;
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marcador = bytes[i + 1];

    // Marcadores sin carga útil: se saltan sin leer longitud.
    if (marcador === 0xd8 || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      i += 2;
      continue;
    }
    // Inicio de los datos comprimidos: ya no hay más cabeceras que leer.
    if (marcador === 0xda || marcador === 0xd9) return null;

    const longitud = (bytes[i + 2] << 8) | bytes[i + 3];

    // SOF0..SOF15 declaran el tamaño. Se excluyen 0xC4 (tablas Huffman),
    // 0xC8 (reservado) y 0xCC (definición aritmética), que no son SOF.
    const esSof =
      marcador >= 0xc0 &&
      marcador <= 0xcf &&
      marcador !== 0xc4 &&
      marcador !== 0xc8 &&
      marcador !== 0xcc;

    if (esSof) {
      return {
        alto: (bytes[i + 5] << 8) | bytes[i + 6],
        ancho: (bytes[i + 7] << 8) | bytes[i + 8],
        componentes: bytes[i + 9],
      };
    }

    i += 2 + longitud;
  }
  return null;
}

/** Página A4 en puntos PDF (72 por pulgada). */
const A4_ANCHO = 595.28;
const A4_ALTO = 841.89;
const MARGEN = 28;

/**
 * Devuelve los bytes de un PDF con una página por imagen. Cada foto se centra
 * en una A4 conservando su proporción; una guía apaisada sale apaisada, sin
 * deformarse. Las imágenes que no sean JPEG válido se omiten.
 */
export function jpegsAPdf(imagenes: Uint8Array[]): Uint8Array {
  const utiles = imagenes
    .map((bytes) => ({ bytes, info: leerInfoJpeg(bytes) }))
    .filter((x): x is { bytes: Uint8Array; info: InfoJpeg } => x.info !== null);

  if (utiles.length === 0) throw new Error("Ninguna imagen es un JPEG válido.");

  // Un PDF es una lista de objetos numerados más una tabla (xref) que dice en
  // qué byte empieza cada uno. Se va armando en trozos y anotando posiciones.
  const trozos: Uint8Array[] = [];
  const posiciones: number[] = [];
  let cursor = 0;
  const enc = new TextEncoder();

  const escribir = (dato: string | Uint8Array) => {
    const buf = typeof dato === "string" ? enc.encode(dato) : dato;
    trozos.push(buf);
    cursor += buf.length;
  };
  const abrirObjeto = (num: number) => {
    posiciones[num] = cursor;
    escribir(`${num} 0 obj\n`);
  };

  // Numeración: 1 = catálogo, 2 = páginas, y luego 3 objetos por imagen
  // (página, contenido y la imagen en sí).
  const total = utiles.length;
  const idsPagina = utiles.map((_, i) => 3 + i * 3);

  escribir("%PDF-1.4\n");

  abrirObjeto(1);
  escribir("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  abrirObjeto(2);
  escribir(
    `<< /Type /Pages /Count ${total} /Kids [${idsPagina.map((id) => `${id} 0 R`).join(" ")}] >>\nendobj\n`
  );

  utiles.forEach(({ bytes, info }, i) => {
    const idPagina = idsPagina[i];
    const idContenido = idPagina + 1;
    const idImagen = idPagina + 2;

    // Escala para que entre completa en la página, sin recortar ni estirar.
    const dispAncho = A4_ANCHO - MARGEN * 2;
    const dispAlto = A4_ALTO - MARGEN * 2;
    const escala = Math.min(dispAncho / info.ancho, dispAlto / info.alto);
    const w = info.ancho * escala;
    const h = info.alto * escala;
    const x = (A4_ANCHO - w) / 2;
    const y = (A4_ALTO - h) / 2;

    abrirObjeto(idPagina);
    escribir(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_ANCHO} ${A4_ALTO}] ` +
        `/Resources << /XObject << /Im0 ${idImagen} 0 R >> >> /Contents ${idContenido} 0 R >>\nendobj\n`
    );

    // "cm" fija posición y tamaño; "Do" dibuja la imagen ya declarada.
    const flujo = `q\n${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
    abrirObjeto(idContenido);
    escribir(`<< /Length ${flujo.length} >>\nstream\n${flujo}endstream\nendobj\n`);

    abrirObjeto(idImagen);
    escribir(
      `<< /Type /XObject /Subtype /Image /Width ${info.ancho} /Height ${info.alto} ` +
        `/ColorSpace ${info.componentes === 1 ? "/DeviceGray" : "/DeviceRGB"} ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`
    );
    escribir(bytes);
    escribir("\nendstream\nendobj\n");
  });

  const totalObjetos = 2 + total * 3;
  const inicioXref = cursor;
  escribir(`xref\n0 ${totalObjetos + 1}\n0000000000 65535 f \n`);
  for (let num = 1; num <= totalObjetos; num++) {
    escribir(`${String(posiciones[num]).padStart(10, "0")} 00000 n \n`);
  }
  escribir(
    `trailer\n<< /Size ${totalObjetos + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`
  );

  const largo = trozos.reduce((n, t) => n + t.length, 0);
  const salida = new Uint8Array(largo);
  let offset = 0;
  for (const t of trozos) {
    salida.set(t, offset);
    offset += t.length;
  }
  return salida;
}
