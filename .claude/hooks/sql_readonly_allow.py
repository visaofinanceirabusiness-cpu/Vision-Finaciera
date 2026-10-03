#!/usr/bin/env python3
"""
PreToolUse hook para mcp__Supabase__execute_sql: aprueba sola la
consulta si es de lectura (empieza con SELECT/WITH/EXPLAIN/SHOW, una
vez saltados los comentarios --/*  */ y espacios al principio) — el
usuario pidió dejar de pedirle permiso para consultar, pero cualquier
UPDATE/INSERT/DELETE/etc. (que sí toca datos reales de clientes) sigue
preguntando como siempre, porque eso no se tocó.
"""
import json
import re
import sys

try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(0)

query = (payload.get("tool_input") or {}).get("query") or ""

# Saca comentarios de línea (--...) y de bloque (/* ... */) y espacios
# en blanco del principio, repetidas veces, hasta llegar a la primera
# palabra real.
sin_comentarios = query
while True:
    anterior = sin_comentarios
    sin_comentarios = re.sub(r"^\s+", "", sin_comentarios)
    sin_comentarios = re.sub(r"^--[^\n]*\n?", "", sin_comentarios)
    sin_comentarios = re.sub(r"^/\*.*?\*/", "", sin_comentarios, flags=re.DOTALL)
    if sin_comentarios == anterior:
        break

primera_palabra = re.match(r"^([A-Za-z]+)", sin_comentarios)
palabra = primera_palabra.group(1).lower() if primera_palabra else ""

if palabra in ("select", "with", "explain", "show"):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "permissionDecisionReason": "Consulta de lectura (SELECT/WITH/EXPLAIN/SHOW) auto-aprobada.",
        }
    }))

sys.exit(0)
