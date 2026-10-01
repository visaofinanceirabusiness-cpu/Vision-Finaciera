import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // lib/supabase.ts crea el cliente al importarse (createClient
    // revienta sin estas dos env vars) — los módulos bajo test
    // (categorias.ts, motor.ts) lo importan aunque la función
    // puntual que se testea no haga ninguna llamada a la base.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
