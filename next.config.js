/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 inyecta solo un bloque "agent rules" en CLAUDE.md en cada
  // `next dev` (ver node_modules/next/dist/server/lib/generate-agent-files.js).
  // Este repo ya tiene su propio CLAUDE.md curado a mano — se desactiva
  // para que Next no lo toque.
  agentRules: false,
};

module.exports = nextConfig;
