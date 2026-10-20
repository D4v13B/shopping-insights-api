# 0015 · Roles de base de datos con mínimo privilegio

**Estado:** Aceptada

## Contexto
La API es de solo lectura salvo el registro de solicitudes del ETL. Si se la comprometiera, no
debería poder alterar los datos.

## Opciones
1. **Tres roles**: dueño (migraciones), `etl_writer` y `api_reader`.
2. Un solo usuario para todo: más simple, pero una inyección en la API podría borrar los datos.

## Decisión
- `infra/postgres/init-roles.sh` crea los roles con contraseñas del entorno. Es un `.sh` porque los
  `.sql` de `docker-entrypoint-initdb.d` no expanden variables.
- La migración `0001` asigna los permisos: `etl_writer` puede truncar, escribir y `MAINTAIN` (refrescar)
  las vistas; `api_reader` solo `SELECT` en analytics y `INSERT` en `etl_runs`.
- Los cambios de estado de `etl_runs` los hace únicamente el ETL.

## Consecuencias
- Tests de integración verifican que `api_reader` no puede escribir en analytics y que `etl_writer`
  sí puede truncar y refrescar.
- El script de roles solo corre con el volumen vacío: tras cambiar contraseñas hay que recrearlo con
  `docker compose down -v`.
