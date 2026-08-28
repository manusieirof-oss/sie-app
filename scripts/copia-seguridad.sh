#!/usr/bin/env bash
#
# Copia de seguridad de la base de datos de SIE.
#
# La cadena de conexión NO se guarda aquí ni en el repositorio: se pasa por variable de
# entorno al lanzarlo. Un fichero con la contraseña de la base dentro de una carpeta que
# se sincroniza o se sube a GitHub es exactamente el accidente que esto quiere evitar.
#
#   SIE_DB_URL='postgresql://...' ./scripts/copia-seguridad.sh
#
# ESTO NO COPIA LOS FICHEROS. Las imágenes de ejercicios, las fotos de pacientes y los
# documentos viven en los buckets de Storage y hay que bajarlos aparte. Ver el final.

set -euo pipefail

DESTINO="${SIE_DESTINO:-$HOME/Desktop/copias-sie}"
FECHA="$(date +%Y-%m-%d-%H%M)"
FICHERO="$DESTINO/sie-$FECHA.sql"

if [ -z "${SIE_DB_URL:-}" ]; then
  echo "Falta SIE_DB_URL."
  echo
  echo "La sacas de Supabase → Project Settings → Database → Connection string → URI."
  echo "Lánzalo así, con la cadena entre comillas simples:"
  echo
  echo "  SIE_DB_URL='postgresql://...' ./scripts/copia-seguridad.sh"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "No tienes pg_dump instalado."
  echo "En un Mac con Homebrew:  brew install postgresql@16"
  exit 1
fi

mkdir -p "$DESTINO"

echo "Copiando la base de datos..."
# --no-owner y --no-privileges: la copia tiene que poder restaurarse en otro proyecto de
# Supabase, y los dueños y permisos de este no existen allí.
pg_dump "$SIE_DB_URL" --no-owner --no-privileges --file="$FICHERO"

# Una copia que existe pero está vacía es peor que no tenerla: da tranquilidad falsa.
BYTES=$(wc -c < "$FICHERO" | tr -d ' ')
TABLAS=$(grep -c '^CREATE TABLE' "$FICHERO" || true)

if [ "$BYTES" -lt 10000 ] || [ "$TABLAS" -lt 20 ]; then
  echo
  echo "AVISO: la copia parece incompleta — $BYTES bytes, $TABLAS tablas."
  echo "La app usa unas 47 tablas. Revísala antes de fiarte de ella."
  exit 1
fi

gzip -f "$FICHERO"
echo
echo "Hecho: $FICHERO.gz"
echo "$TABLAS tablas."
echo
echo "FALTAN LOS FICHEROS. Bájalos desde Supabase → Storage:"
echo "  fotos            imágenes de ejercicios, tests y objetivos"
echo "  pacientes-fotos  caras de pacientes  · DATOS PERSONALES"
echo "  documentos       informes de pacientes · DATOS DE SALUD"
echo
echo "Los dos últimos llevan datos de salud: guarda la copia cifrada, no en una carpeta"
echo "cualquiera ni en un disco compartido."
