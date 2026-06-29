# SkyHigh Rutas 🚚

App web para armar la ruta del día de **SkyHigh SAC**: los vendedores suben las órdenes
(entrega o recojo), almacén las asigna a los repartidores, y los repartidores toman la
foto de la guía para marcarlas como completadas.

- **Tecnología:** Next.js 16 + Supabase (base de datos, login y almacenamiento de imágenes).
- **Diseño:** responsive (funciona en celular y PC), colores rojo y gris.

---

## Roles y flujo

| Rol | Qué puede hacer |
|-----|-----------------|
| **Vendedor** | Sube órdenes: pega la imagen, escribe el número de pedido y marca ENTREGA o RECOJO. |
| **Almacén** | Ve las órdenes pendientes y las asigna a un repartidor. |
| **Repartidor** | Ve su ruta del día. Al entrar a una orden asignada, toma la foto de la guía y confirma → se marca como Entregado/Recogido. |
| **Administrador** | Todo lo anterior + crea y gestiona usuarios. |

---

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto en Supabase (gratis)

1. Entra a <https://supabase.com> → **Start your project** → crea una cuenta.
2. **New project**. Ponle nombre (ej. `skyhigh-rutas`) y una contraseña de base de datos
   (guárdala). Región: la más cercana.
3. Espera 1–2 minutos a que el proyecto se cree.

### 2. Crear las tablas

1. En el panel de Supabase ve a **SQL Editor** → **New query**.
2. Abre el archivo [`supabase/schema.sql`](supabase/schema.sql) de este proyecto,
   copia **todo** su contenido, pégalo y presiona **Run**.
3. Debe decir *Success*. Esto crea las tablas, los permisos y los buckets de imágenes.

### 3. Conectar la app con Supabase

1. En Supabase ve a **Project Settings → Data API** y copia el **Project URL**.
2. Ve a **Project Settings → API Keys** y copia:
   - la clave **anon / publishable** (pública), y
   - la clave **service_role** (secreta).
3. En la carpeta del proyecto, copia el archivo `.env.local.example` y renómbralo a
   **`.env.local`**. Rellena los tres valores:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://TUPROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=la-clave-anon
   SUPABASE_SERVICE_ROLE_KEY=la-clave-service-role
   ```

### 4. Crear el primer administrador

1. En Supabase ve a **Authentication → Users → Add user**.
   Pon tu correo y contraseña, y marca **Auto Confirm User**. Crea.
2. Vuelve a **SQL Editor** y ejecuta (cambia el correo por el tuyo):

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
   ```

Ya puedes iniciar sesión como administrador y crear el resto de usuarios desde la
sección **Usuarios** de la app.

---

## Correr la app en tu computadora

```bash
npm install      # solo la primera vez
npm run dev      # inicia en http://localhost:3000
```

---

## Publicarla en internet (para usarla desde el celular)

La forma más sencilla y gratuita es **Vercel**:

1. Sube esta carpeta a un repositorio de GitHub.
2. Entra a <https://vercel.com>, **Add New → Project**, e importa el repositorio.
3. En **Environment Variables** agrega las mismas 3 variables del `.env.local`.
4. **Deploy**. Vercel te dará una URL (ej. `https://skyhigh-rutas.vercel.app`) que
   pueden abrir desde cualquier celular y guardar en la pantalla de inicio.

> En el celular, los repartidores pueden "Agregar a pantalla de inicio" para usarla
> como si fuera una app.

---

## Notas

- Las imágenes de las órdenes y las guías se guardan en Supabase Storage.
- La seguridad por rol está aplicada en el servidor (cada acción valida el rol) y en la
  base de datos (Row Level Security).
- La clave `service_role` es secreta: solo vive en el servidor, nunca en el navegador.
