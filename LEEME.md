# Visão Financeira — cómo publicar esta app (paso a paso)

No hace falta que entiendas el código. Seguí estos pasos en orden.

## Paso 1 — Subir el proyecto a GitHub

1. Andá a github.com, iniciá sesión con tu cuenta.
2. Arriba a la derecha, botón verde "New" (o el signo "+") → "New repository".
3. Nombre del repositorio: `visao-financeira` → Create repository.
4. En tu computadora, dentro de la carpeta de este proyecto, subí todos los
   archivos usando la opción "uploading an existing file" que aparece en
   la página del repositorio recién creado (arrastrás la carpeta completa).
5. Confirmá el commit (el botón verde "Commit changes").

## Paso 2 — Conectar con Vercel

1. Andá a vercel.com, iniciá sesión con la misma cuenta de GitHub.
2. Botón "Add New..." → "Project".
3. Elegí el repositorio `visao-financeira` que acabás de crear → "Import".
4. Antes de tocar "Deploy", abrí la sección "Environment Variables" y
   agregá estas dos (los valores los sacás de Supabase → Project Settings → API):

   - `NEXT_PUBLIC_SUPABASE_URL` → pegar el "Project URL"
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → pegar la "anon public key"

5. Ahora sí, tocá "Deploy".
6. En 1-2 minutos vas a tener un link público (algo como
   `visao-financeira.vercel.app`) — esa es tu app funcionando en internet.

## Paso 3 — Crear tu primer usuario de prueba

1. En Supabase, andá a "Authentication" → "Users" → "Add user".
2. Cargá un email y contraseña (puede ser el tuyo, para probar).
3. Entrá a tu link de Vercel y probá iniciar sesión con ese usuario.

Si en cualquier paso algo no se ve como acá descripto, mandame una
captura de pantalla y seguimos desde ahí.
