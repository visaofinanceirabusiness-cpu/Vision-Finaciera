# Recursos 3D de Visão 3D (modelo Familia)

Nada de esto es obligatorio: sin archivos, la casa se arma 100 % en código (procedural).

## Modelos (GLB)
1. Copiar el `.glb` a `public/visao3d/modelos/` (ideal: < 150 KB, comprimido con Draco o Meshopt; origen en el suelo y mirando a +z).
2. Declararlo en `catalogo.json`:
   `{ "objetos": [ { "id": "auto", "glb": "/visao3d/modelos/auto.glb", "glbLiviano": "/visao3d/modelos/auto_liviano.glb", "escala": 1, "draco": true } ] }`
   - `glbLiviano` es la versión para teléfonos (calidad baja); sin ella, en teléfonos se usa el procedural.
   - Ids disponibles hoy en la casa: `auto`, `armario` (el resto del catálogo está declarado en `components/visao3d/base/catalogo/catalogo.ts`).
3. Si el archivo falta o falla, se ve el objeto procedural. El estado de la cuenta (cero = gris, negativo = tinte rojo) se aplica también a los materiales del modelo.

## HDRI (Poly Haven, CC0)
Copiar el `.hdr` (1k o 2k) a `public/visao3d/hdri/` y declarar `"hdri": { "dia": "/visao3d/hdri/cielo.hdr", "atardecer": "...", "noche": "..." }`.
Sin HDRI se usa el estudio de luces generado en código.

## Calidad
`?calidad=bajo|medio|alto` en la URL fuerza el nivel para probar. Sombras suaves en tiempo real: solo equipos no táctiles de calidad alta.
