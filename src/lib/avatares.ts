// lib/avatares.ts
//
// Avatar por defecto para el logo de una empresa NUEVA, según el sexo
// del emprendedor que se da de alta — reemplaza la letra inicial que
// se mostraba antes de que alguien suba su propio logo. El emprendedor
// puede cambiarlo en cualquier momento desde Configurações → Dados da
// Empresa → Logo; esto solo define el valor inicial.
//
// A propósito no se les asigna a las empresas que ya existían: son
// solo el punto de partida para las cuentas que se den de alta de acá
// en adelante.

const AVATAR_FEMENINO =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/Perfil%202%20mujer.png';

const AVATAR_MASCULINO =
  'https://dbmbyqsgyrbccxesqdfj.supabase.co/storage/v1/object/public/Logos/Perfil%201%20hombre.png';

export function avatarPorDefecto(sexo: string | null | undefined): string | null {
  if (sexo === 'F') return AVATAR_FEMENINO;
  if (sexo === 'M') return AVATAR_MASCULINO;
  return null;
}
