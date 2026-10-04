import { describe, it, expect } from 'vitest';
import {
  nombreCuentaCompromiso,
  esCuentaNombradaComo,
  siguienteSegmentoLibre,
  codigoDeGrupo,
  nombreYaExiste,
} from './cuentasCompromisoNombres';

describe('cuentasCompromisoNombres', () => {
  it('el "a pagar / a cobrar" va al final, después del nombre', () => {
    expect(nombreCuentaCompromiso('Alquiler Santihno', 'PAGAR')).toBe('Alquiler Santihno a pagar');
    expect(nombreCuentaCompromiso('  Casita 💚 ', 'COBRAR')).toBe('Casita 💚 a cobrar');
  });

  it('no duplica ni mezcla el sufijo', () => {
    expect(nombreCuentaCompromiso('Alquileres a pagar', 'PAGAR')).toBe('Alquileres a pagar');
    expect(nombreCuentaCompromiso('Alquileres A Cobrar', 'PAGAR')).toBe('Alquileres a pagar');
  });

  it('reconoce si una cuenta lleva el nombre automático de la plantilla', () => {
    expect(esCuentaNombradaComo('Netflix a pagar', 'Netflix', 'PAGAR')).toBe(true);
    expect(esCuentaNombradaComo('Suscripciones a pagar', 'Netflix', 'PAGAR')).toBe(false);
  });

  it('el próximo segmento libre mira todos los códigos del prefijo', () => {
    const codigos = ['2.1.0.0.3', '2.1.1.0.1', '2.1.1.0.2', '1.1.0.0.8'];
    expect(siguienteSegmentoLibre(codigos, '2.1')).toBe(2);
    expect(siguienteSegmentoLibre(codigos, '1.1')).toBe(1);
    expect(siguienteSegmentoLibre([], '2.1')).toBe(1);
  });

  it('arma el código de un grupo', () => {
    expect(codigoDeGrupo('2.1', 2)).toBe('2.1.2.0.0');
  });

  it('detecta nombres repetidos sin importar mayúsculas', () => {
    expect(nombreYaExiste('NETFLIX a pagar', ['Banco Nu', 'Netflix a pagar'])).toBe(true);
    expect(nombreYaExiste('Facultad a pagar', ['Banco Nu'])).toBe(false);
  });
});
