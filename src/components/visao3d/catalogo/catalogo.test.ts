import { describe, expect, it } from 'vitest';
import { CATALOGO_BASE, fusionarCatalogo, rutaModelo } from './catalogo';

describe('catálogo 3D', () => {
  it('sin configuración todos los objetos usan el procedural', () => {
    const c = fusionarCatalogo(CATALOGO_BASE, null);
    expect(c.get('auto')?.glb).toBeUndefined();
    expect(rutaModelo(c.get('auto'), 'alto')).toBeNull();
  });

  it('el JSON agrega un GLB a un objeto existente y objetos nuevos', () => {
    const c = fusionarCatalogo(CATALOGO_BASE, { objetos: [{ id: 'auto', glb: '/visao3d/modelos/auto.glb', escala: 1.2 }, { id: 'heladera', tipo: 'mueble', nombre: 'Heladera', glb: '/x.glb' }] });
    expect(c.get('auto')?.glb).toBe('/visao3d/modelos/auto.glb');
    expect(c.get('auto')?.escala).toBe(1.2);
    expect(c.get('auto')?.tipo).toBe('vehiculo');
    expect(c.get('heladera')?.tipo).toBe('mueble');
  });

  it('una ruta vacía quita el modelo', () => {
    const c = fusionarCatalogo(CATALOGO_BASE, { objetos: [{ id: 'auto', glb: '/a.glb' }, { id: 'auto', glb: '' }] });
    expect(c.get('auto')?.glb).toBeUndefined();
  });

  it('en calidad baja solo se usa el modelo liviano', () => {
    const c = fusionarCatalogo(CATALOGO_BASE, { objetos: [{ id: 'sofa', glb: '/pesado.glb', glbLiviano: '/liviano.glb' }, { id: 'cama', glb: '/solo-pesado.glb' }] });
    expect(rutaModelo(c.get('sofa'), 'bajo')).toBe('/liviano.glb');
    expect(rutaModelo(c.get('sofa'), 'alto')).toBe('/pesado.glb');
    expect(rutaModelo(c.get('cama'), 'bajo')).toBeNull();
    expect(rutaModelo(c.get('cama'), 'medio')).toBe('/solo-pesado.glb');
  });
});
