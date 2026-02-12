# Guía de Despliegue en Render.com

Esta guía te ayudará a subir tu aplicación y base de datos a Render.com de forma gratuita.

## Requisitos Previos
1.  Tener una cuenta en [GitHub](https://github.com/).
2.  Tener una cuenta en [Render](https://render.com/).

## Paso 0: Subir tu Código a GitHub

Como no tienes GitHub CLI instalado, debes crear el repositorio manualmente:

1.  Ve a https://github.com/new
2.  Ponle un nombre (ej. `eternal-lagoon-backend`).
3.  Déjalo en **Público** (o Privado si prefieres).
4.  Haz clic en **Create repository**.
5.  Copia la URL que te dan (ej. `https://github.com/TU_USUARIO/eternal-lagoon-backend.git`).
6.  En tu terminal (donde estoy yo), ejecuta:
    ```bash
    git remote add origin https://github.com/TU_USUARIO/eternal-lagoon-backend.git
    git push -u origin main
    ```
    *(Sustituye la URL por la tuya)*.

## Paso 1: Crear la Base de Datos (PostgreSQL)

1.  En el Dashboard de Render, haz clic en **New +** y selecciona **PostgreSQL**.
2.  **Name:** `eternal-lagoon-db` (o el que quieras).
3.  **Database:** `datosusuarios` (importante usar este nombre si tu código lo espera, aunque Render suele usar uno aleatorio, luego lo configuraremos).
4.  **User:** `render` (o el que te den).
5.  **Region:** `Oregon (US West)` o la más cercana.
6.  **PostgreSQL Version:** 16 (la por defecto está bien).
7.  **Instance Type:** **Free**.
8.  Haz clic en **Create Database**.

Una vez creada, copia la **Internal DB URL** (para uso interno si despliegas el servidor en Render) y la **External Database URL** (para conectar desde tu PC o importar datos).

## Paso 2: Importar tus Datos

Ahora vamos a subir los datos de tu archivo `database_schema.sql` a la nube. Necesitarás tener instalado `psql` o usar una herramienta como PgAdmin o DBeaver, pero la forma más rápida es conectar tu terminal (si tienes `psql` instalado):

```bash
psql "PEGAR_AQUI_EXTERNAL_DATABASE_URL" < database_schema.sql
```

*Si no tienes `psql` en la terminal, puedes usar un programa visual como DBeaver, crear una nueva conexión con los datos que te da Render y ejecutar el script SQL que generamos.*

## Paso 3: Crear el Web Service (Servidor Node.js)

1.  En el Dashboard de Render, haz clic en **New +** y selecciona **Web Service**.
2.  Conecta tu repositorio de GitHub.
3.  **Name:** `eternal-lagoon-web`.
4.  **Region:** La misma que la base de datos (ej. Oregon).
5.  **Branch:** `main` (o la rama donde esté tu código).
6.  **Root Directory:** Dejar en blanco (a menos que tu código esté en una subcarpeta).
7.  **Runtime:** **Node**.
8.  **Build Command:** `npm install`
9.  **Start Command:** `node server.js`
10. **Instance Type:** **Free**.

## Paso 4: Configurar Variables de Entorno

Antes de crear el servicio, baja a la sección **Environment Variables** y añade las siguientes:

| Key | Value |
| :--- | :--- |
| `DB_USER` | (Usuario de la BD de Render) |
| `DB_PASSWORD` | (Contraseña de la BD de Render) |
| `DB_HOST` | (Host interno de la BD de Render - suele terminar en `.render.internal`) |
| `DB_NAME` | (Nombre de la BD de Render) |
| `DB_PORT` | `5432` |
| `PORT` | `10000` (Render lo asigna automáticamente, pero es bueno tenerlo) |
| `GROQ_API_KEY` | `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` |

*Nota: Todos los datos de DB_... los sacas de la información de la base de datos que creaste en el Paso 1.*

11. Haz clic en **Create Web Service**.

## Paso 5: ¡Listo!

Render empezará a descargar tu código, instalar las dependencias y arrancar el servidor. Puedes ver el proceso en la pestaña **Logs**.

Cuando termine, te dará una URL (ej. `https://eternal-lagoon-web.onrender.com`) donde tu página estará accesible para todo el mundo.
