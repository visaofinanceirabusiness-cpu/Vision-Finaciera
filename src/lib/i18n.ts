// lib/i18n.ts
//
// Mecánica genérica de traducción para el sistema. Cada pantalla define
// su propio diccionario (ver src/app/configuracoes/i18n.ts como
// ejemplo) con las claves de sus textos en 'ES' y 'PT'; este archivo
// solo da la función que resuelve una clave contra el idioma de la
// empresa (empresas.idioma — que ya quedó separado del país/moneda que
// define el Plano de Contas, ver lib/perfiles.ts).
//
// No es una librería de i18n con rutas por idioma ni carga asíncrona
// de mensajes: el sistema es todo 'use client' con una sola empresa
// por sesión, así que alcanza con un objeto en memoria y una función
// de lookup — cero costo real de performance.

export type Idioma = 'ES' | 'PT';

// Diccionario de una pantalla: cada clave tiene su texto en cada
// idioma soportado. `Claves` queda inferido en cada pantalla para que
// t('clave-que-no-existe') tire error de tipos en vez de romper en
// producción.
export type Diccionario<Claves extends string> = Record<Idioma, Record<Claves, string>>;

export function crearTraductor<Claves extends string>(
  diccionario: Diccionario<Claves>,
  idioma: string | null | undefined
) {
  const tabla = diccionario[idioma === 'PT' ? 'PT' : 'ES'];

  return function t(clave: Claves): string {
    return tabla[clave];
  };
}
