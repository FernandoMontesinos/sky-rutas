/**
 * Formato de fechas para pantalla, siempre anclado al reloj de Lima.
 *
 * El servidor de Vercel corre en UTC y `toLocaleString` sin `timeZone` usa el
 * reloj de quien renderiza: una orden creada a las 08:50 a. m. se mostraba
 * como "01:50 p. m." en las páginas de servidor, cinco horas adelantada.
 *
 * Todo lo que se muestre al usuario tiene que pasar por aquí: en el servidor
 * porque si no sale en UTC, y en el cliente para que el HTML que manda el
 * servidor coincida con el de la hidratación aunque el celular tenga mal
 * configurada su zona horaria.
 *
 * Este archivo no importa nada del servidor a propósito, para que lo puedan
 * usar también los componentes `"use client"`.
 */

/** Perú no usa horario de verano, así que el offset es fijo en -05:00. */
export const TZ_LIMA = "America/Lima";

/** Fecha y hora sin año — "13/8, 08:50 a. m." */
export function fechaHoraCorta(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: TZ_LIMA,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo día y mes — "13/8". Para las listas de actividad y notificaciones. */
export function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    timeZone: TZ_LIMA,
    day: "2-digit",
    month: "2-digit",
  });
}
