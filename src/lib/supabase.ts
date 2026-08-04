// lib/supabase.ts
// Conexión central a la base de datos. Todas las pantallas de la app
// importan este archivo en vez de conectarse "a mano" cada vez.

import { createClient } from '@supabase/supabase-js';

// Estas dos claves las vas a copiar desde Supabase:
// Project Settings → API → "Project URL" y "anon public key"
// En Vercel se configuran como variables de entorno (te guío en ese paso).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
