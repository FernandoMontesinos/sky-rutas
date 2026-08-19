# Handoff — arranque de la prueba piloto

**Fecha:** 2026-08-09 (actualizado 2026-08-19, ver §0)
**Para:** Fernando Montesinos
**Estado de `master`:** `37bc3ea`, desplegado y verificado en producción
**Producción:** https://sky-rutas.vercel.app

---

## 0. Actualización — 19 de agosto

Diez días de trabajo desde el handoff original (§1 en adelante). Resumen de
qué está en producción, qué está esperando tu revisión, y qué sigue abierto
de la lista de aquel entonces.

### 0.1 Ya en `master` (mergeado, desplegado)

**PR #6 — tarjetas, rol Facturación, motivos de no-recojo, recojo parcial**
([#6](https://github.com/FernandoMontesinos/sky-rutas/pull/6), mergeado)

- Kanban: la hora de cada tarjeta refleja cuándo entró al estado actual
  (creada/asignada/en tránsito/completada), no siempre la de creación.
  Formato fecha primero, hora después. Se agrega la inicial de quien creó la
  orden junto a la del repartidor.
- Nuevo rol **Facturación**: solo consulta — ve Órdenes, Mapa, Reportes, y
  descarga guías (ZIP + Excel/CSV). No asigna, edita, completa ni elimina
  nada.
- "No se pudo recoger" pasa de texto libre a tres botones (Proveedor
  cerrado / Proveedor no tiene material listo / Otro).
- Se limpiaron dos cuentas "Albert" duplicadas sin uso.
- Migración `35_facturacion_role.sql`: agrega `facturacion` al enum
  `user_role` (columna `role` de `profiles`).

**Fix directo a `master` — confirmación antes de eliminar usuario**
(`37bc3ea`)

Un clic en "Eliminar" en `/admin/usuarios` borraba la cuenta al toque, sin
preguntar. Ahora abre una ventana de confirmación con el nombre de la
persona antes de tocar la base.

### 0.2 Esperando tu revisión — PR #7 (todavía NO mergeado)

**[PR #7 — Cotizaciones ganan Tránsito, el cierre vuelve a ser de Almacén](https://github.com/FernandoMontesinos/sky-rutas/pull/7)**

Este revierte una parte de la PR #6: el recojo parcial (que el repartidor
decidiera completo/parcial al recoger) se sacó. Bryan pidió el cambio
después de ver la PR #6 funcionando en producción — quedó así:

- El repartidor vuelve a tener un solo trabajo, en Pedidos **y**
  Cotizaciones: sube evidencia (foto de material; en Cotizaciones también
  guía, con el número ahora opcional) y confirma. No decide nada.
- Cotizaciones (modalidad Reparto) ganan el estado **En Tránsito**, igual
  que ya tenían los Pedidos — antes cerraban directo.
- Completo/Parcial y el cierre quedan exclusivos de Almacén y Admin, para
  los dos tipos.
- "No se pudo entregar": mismo mecanismo que "No se pudo recoger", para
  Cotizaciones (Cliente cerrado / Cliente no estaba / Otro).
- Oficina/Courier y el atajo de Almacén (cerrar sin esperar al repartidor):
  sin cambios.

Verificado de punta a punta con usuarios y órdenes de prueba (creados y
borrados en la misma sesión, nunca tocó datos reales). Falta tu revisión
visual antes de mergear — el link del preview te lo paso por donde
hablamos.

### 0.3 De la lista original (§7) — qué sigue pendiente

- **§1.1 (`SUPABASE_SERVICE_ROLE_KEY`)**: parece resuelta — durante esta
  sesión se creó un usuario nuevo desde `/admin/usuarios` directo en
  producción sin error, y esa ruta depende de esa variable.
- **§1.2 (fotos huérfanas + bucket `zz_prueba_rls`)**: el bucket
  `zz_prueba_rls` **sigue existiendo**, vacío. Sigue pendiente borrarlo a
  mano desde el panel de Supabase (Storage bloquea el borrado por SQL).
- **§5.3 (reemplazo de usuarios de prueba)**: `katy@gmail.com` y
  `albert@gmail.com` ya no están — quedan con correos `@skyrutas.pe`.
  `admin.prueba@skyrutas.pe` sigue activo (parece que se está usando a
  propósito como cuenta de prueba general, no urgente).
- El resto de §5 (buckets privados, policy de borrado de storage, avisos
  del linter) no se tocó en estos diez días — sigue tal cual estaba.

---

## 1. Lo que necesito de ti antes del arranque

### 1.1 Confirmar `SUPABASE_SERVICE_ROLE_KEY` en Vercel ⚠️

Es el único punto que puede romper la operación en pleno piloto y no pude
verificarlo yo: el proyecto de Vercel está en tu cuenta
(`fmontesinosestrada-gmailcoms-projects`) y no tengo acceso.

En el `.env.local` de Bryan esa variable está **vacía**. Si tampoco está
puesta en Vercel, **crear usuarios desde `/admin/usuarios` falla en
producción**: `createAdminClient()` (en `src/lib/supabase/admin.ts`) lanza
si la clave no está, y esa ruta la usa `src/app/(app)/admin/usuarios/actions.ts`.

Revísalo en **Vercel → proyecto `sky-rutas` → Settings → Environment
Variables**. Si falta, sácala de **Supabase → Settings → API → service_role**.

> `src/lib/notify.ts` no se ve afectado: ahí la llamada a `createAdminClient()`
> está dentro de un `try/catch` a propósito, justamente para que una variable
> mal puesta no tumbe la acción que disparó la notificación.

### 1.2 Borrar las fotos huérfanas de storage

Quedaron **119 archivos (~10 MB)** de las órdenes de prueba que ya se
borraron de la base. No se pueden eliminar por SQL: Supabase lo bloquea con
el trigger `storage.protect_delete` y exige la API de Storage o el panel.

En **Supabase → Storage**: entra a `guias`, selecciona todas las carpetas,
borra; repite en `ordenes`.

Aprovecha y borra también el bucket vacío **`zz_prueba_rls`**. Lo creé yo
para verificar que el cambio de RLS no rompía las fotos (ver §3.1); quedó
sin objetos pero no pude eliminarlo porque hace falta `service_role`.

---

## 2. Qué cambió en `master`

Tres commits desde tu merge `324412a`. Ninguno toca `src/lib/auth.ts`, así
que tu arreglo de sesión móvil quedó intacto — lo revisé y está correcto: la
distinción entre error transitorio de consulta y perfil inexistente es la
que había que hacer.

| Commit | Qué hace |
|---|---|
| `a9eaa6c` | Tablero: las tarjetas se agrupan por empresa en orden alfabético en vez de por fecha |
| `fa9a2cd` | Logo nuevo (isotipo oficial), recortado y con fondo transparente |
| `4ce8d34` | Íconos PNG para Android + cierre del listado anónimo de storage |

### 2.1 Agrupación por empresa (`a9eaa6c`)

Pedido de Bryan: almacén y ventas buscan por empresa, no por fecha. El
cambio está en el componente `Column` de `src/app/(app)/ordenes/page.tsx`,
que es el mismo que usan el tablero de gestión y el panel propio del
repartidor — o sea, aplica a todos los roles.

El `.sort` es sobre el nombre solamente. Al ser estable (garantizado desde
ES2019), dentro de una misma empresa las órdenes conservan el orden por
fecha que ya traía la consulta; no hace falta criterio de desempate.
Reportes **no** se tocó.

### 2.2 Íconos PNG (`4ce8d34`)

El manifest y `public/sw.js` apuntaban a un SVG. Android no renderiza SVG ni
en las notificaciones push ni al "Agregar a pantalla de inicio": salía el
ícono genérico de Chrome. Como el piloto depende de que los repartidores
reciban avisos en el celular, esto había que arreglarlo sí o sí.

Se generaron desde el logo nuevo: `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png` (con más aire, porque el launcher recorta hasta un
20% por lado) y `badge-96.png`, que es una **silueta monocroma** aparte —
Android pinta el ícono chico de la barra de estado plano usando solo el
canal alfa, así que un logo a color ahí sale como una mancha.

Se eliminaron `src/app/icon.svg` y `public/logo.svg`; no los referenciaba nadie.

---

## 3. Cambios en la base de datos (ya aplicados en producción)

### 3.1 Migración 34 — cerrar el listado anónimo de storage 🔴

**Ya está aplicada en producción.** El archivo
`supabase/34_storage_lectura_autenticada.sql` queda en el repo como
registro; volver a correrlo es inofensivo (`drop policy if exists` +
`create policy`).

**El problema.** Tu migración `23_rls_to_authenticated.sql` cerró las
policies que habían quedado abiertas a `PUBLIC` en las tablas de `public`,
pero se saltó `storage.objects`. La policy `lectura publica ordenes` se
quedó sin `to authenticated`, así que Postgres la aplicaba a `PUBLIC` —
incluido el rol `anon`.

Lo comprobé contra el proyecto real **sin iniciar sesión**: se podían
enumerar las carpetas de ambos buckets, obtener los nombres de archivo y
descargar cada imagen (`HTTP 200`). La `anon key` necesaria es pública por
diseño: viaja dentro del JavaScript que sirve la app. En la práctica,
cualquiera podía bajarse todas las guías de remisión y fotos de órdenes —
razón social, RUC, direcciones, cantidades.

**El arreglo.** Agregar `to authenticated`: sin `anon` en la lista, Postgres
deniega sin evaluar la condición.

**Por qué no rompe nada.** Los buckets siguen siendo públicos y las URLs
guardadas en `orders` (`imagenes_urls`, `guias_urls`, `material_urls`)
apuntan a `/object/public/...`, que en un bucket público se sirve sin pasar
por RLS. Antes de aplicarlo lo verifiqué en un bucket desechable: con el
SELECT restringido, el listado anónimo devolvía `[]` y la descarga por URL
pública seguía dando `HTTP 200` con el contenido. Después de aplicarlo
repetí la comprobación sobre los buckets reales: enumeración `[]` en
`guias` y `ordenes`, y una foto real abriendo normal.

### 3.2 Base operativa en cero

A pedido de Bryan, para que el piloto arranque limpio:

| Tabla | Filas borradas |
|---|---|
| `orders` | 17 |
| `order_events` | 48 |
| `notifications` | 13 |
| `repartidor_locations` | 3 |

**Los usuarios no se tocaron:** siguen los 13 perfiles y sus 13 filas en
`auth.users`, con sus roles y contraseñas. Confirmado después del borrado.

---

## 4. Verificación hecha

- `npx tsc --noEmit`, `npx eslint src` y `npm run build`: limpios.
- **App con la base vacía** — condición que nunca se había probado. Entré con
  una cuenta temporal (creada y borrada dentro de la misma sesión) y recorrí
  Inicio, Tablero, Reportes, Mapa y Usuarios: todo muestra ceros y los
  mensajes de estado vacío correctos, nada revienta. Revisé además que no
  hubiera `reduce` sin valor inicial ni accesos `[0]` sin guarda; los dos
  candidatos (`mapa/page.tsx:57` y `export-guias/route.ts:99`) ya estaban
  protegidos.
- **Móvil a 375px** en el tablero: `scrollWidth === clientWidth`, sin desborde
  horizontal.
- **Producción tras el deploy**: los cuatro PNG responden `HTTP 200`, el
  manifest lista los tres íconos con sus `purpose`, y `sw.js` apunta a los PNG.
- El índice único `orders_numero_pedido_lower_idx` existe y bloquea números
  repetidos (lo verifiqué porque no aparece en `pg_constraint` — está como
  índice único, no como constraint).

---

## 5. Pendientes — post-piloto

### 5.1 Buckets privados + URLs firmadas

Lo de §3.1 cortó la enumeración masiva, pero **quien tenga la URL completa
de una foto sigue pudiendo abrirla sin sesión**. Cerrarlo del todo implica
pasar los buckets a privados y firmar las URLs, lo que obliga a:

1. migrar las URLs ya guardadas en las tres columnas de `orders`, y
2. generarlas al vuelo en cada pantalla que muestre imágenes, más
   `src/app/api/export-guias/route.ts`.

Es un cambio grande; lo dejé fuera a propósito por ser la víspera del piloto.

### 5.2 Policy de borrado de storage demasiado abierta

`borrado autenticado` permite a **cualquier usuario con sesión** borrar
archivos de **cualquier** orden en ambos buckets vía API. La app no expone
eso, pero la policy sí. Valdría acotarla a admin/almacén o al dueño de la orden.

### 5.3 Reemplazo de usuarios

Al cerrar el piloto entran los correos corporativos validados. Estos tres son
de prueba y no deberían sobrevivir:

- `admin.prueba@skyrutas.pe` (Admin Prueba, admin) — activo
- `katy@gmail.com` (Katy, vendedor)
- `albert@gmail.com` (Albert Montesinos, repartidor)

### 5.4 Avisos abiertos del linter de Supabase

- `public.app_role()` es `SECURITY DEFINER` y es ejecutable por
  `authenticated` vía `/rest/v1/rpc/app_role`. Devuelve el rol de quien
  llama, que ya conoce, así que el riesgo es bajo — pero conviene revisar si
  la exposición vía RPC es intencional.
- **Protección de contraseñas filtradas desactivada** (Supabase → Auth →
  Settings). Vale la pena activarla antes de crear los correos corporativos.
- Nueve avisos de rendimiento `auth_rls_initplan`: policies que reevalúan
  `auth.uid()` por fila en vez de `(select auth.uid())`. Irrelevante con este
  volumen, pero es deuda barata de pagar.

---

## 6. Cómo se trabaja este repo

`AGENTS.md` avisa que esta versión de Next.js (16.2.9, Turbopack) trae
cambios de API respecto a lo conocido, y que hay que leer
`node_modules/next/dist/docs/` antes de escribir código.

Dato práctico: si el dev server empieza a devolver 404 en **todas** las rutas
después de editar, no es el código — es la caché de Turbopack. `rm -rf .next`
y reiniciar. Lo confirmé viendo que rutas que no había tocado (`/reportes`)
también daban 404 mientras `npm run build` pasaba limpio.

---

## 7. Resumen para arrancar

- [ ] Confirmar `SUPABASE_SERVICE_ROLE_KEY` en Vercel (§1.1) — **bloqueante**
- [ ] Borrar las 119 fotos huérfanas y el bucket `zz_prueba_rls` (§1.2)
- [ ] Activar la protección de contraseñas filtradas (§5.4) — opcional pero rápido

Todo lo demás está desplegado y verificado.
