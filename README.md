# MONTTECH — sitio y plataforma administrativa

Sitio responsive de MONTTECH con portafolio, contacto por WhatsApp y una plataforma administrativa protegida por inicio de sesión. El servicio Node.js también recibe solicitudes y guarda clientes, proyectos y contactos en PostgreSQL.

## Funcionalidades

- Panel privado en `/admin`, con inicio y cierre de sesión.
- Resumen de clientes, proyectos y solicitudes nuevas.
- Creación, edición, búsqueda y eliminación de clientes y proyectos.
- Seguimiento del estado de las solicitudes recibidas desde el formulario público.
- Exportación de clientes, proyectos y solicitudes a CSV.
- Las solicitudes del formulario se guardan en PostgreSQL antes de ofrecer el enlace para continuar por WhatsApp.
- Sesiones almacenadas en PostgreSQL, cookies `HttpOnly`, protección CSRF, contraseñas con hash y límites de intentos.

## Ejecución local

Requisitos: Node.js 20 o posterior y una instancia de PostgreSQL.

1. Crea una base de datos PostgreSQL llamada `monttech`.
2. Instala las dependencias:

   ```powershell
   npm install
   ```

3. Copia `.env.example` a `.env` y configura `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Usa una contraseña inicial única de al menos 12 caracteres y una clave de sesión aleatoria de 32 caracteres o más.
4. Inicia el servicio:

   ```powershell
   npm start
   ```

5. Abre `http://localhost:3000` para el sitio y `http://localhost:3000/admin` para el panel.

Las tablas se crean al iniciar el servicio. El administrador inicial se crea una sola vez cuando la tabla de administradores está vacía; no se cambia su contraseña al reiniciar.

## Despliegue en Render

El proyecto ya no se debe publicar como **Static Site**. Render debe ejecutar el servidor Node.js para que las sesiones y las solicitudes funcionen.

1. Crea una base de datos PostgreSQL en Render.
2. Crea un **Web Service** conectado al repositorio:
   - Runtime: `Node`
   - Build Command: `npm install` (o `npm ci` si el repositorio ya incluye `package-lock.json`)
   - Start Command: `npm start`
3. Configura estas variables de entorno en el Web Service:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = cadena de conexión interna de la base PostgreSQL de Render
   - `SESSION_SECRET` = valor aleatorio de al menos 32 caracteres (Render puede generarlo)
   - `ADMIN_EMAIL` = correo para crear el primer administrador
   - `ADMIN_PASSWORD` = contraseña única de al menos 12 caracteres
4. Despliega y espera a que el servicio termine su inicialización. La primera ejecución crea las tablas y la cuenta administrativa.
5. Entra a `https://tu-servicio.onrender.com/admin`. Después de confirmar que puedes iniciar sesión, elimina `ADMIN_EMAIL` y `ADMIN_PASSWORD` de las variables del servicio. No guardes credenciales en el repositorio.
6. Si ya hay un Static Site publicado, crea y prueba el Web Service primero; luego conecta el dominio al servicio nuevo y retira el sitio estático anterior.

Render debe mantener la base PostgreSQL asociada al servicio. No uses el almacenamiento del navegador para los datos administrativos.

## Archivos principales

- `index.html`, `styles.css`, `script.js`: sitio público y formulario de contacto.
- `admin.html`, `admin.css`, `admin.js`: inicio de sesión y panel administrativo.
- `server.js`: servidor, API, autenticación e inicialización de la base de datos.
- `.env.example`: nombres de variables requeridas para desarrollo local.

El formulario registra la solicitud en el panel y luego abre WhatsApp para que el usuario revise y envíe el mensaje. El envío del mensaje por WhatsApp sigue dependiendo de la confirmación del usuario.
