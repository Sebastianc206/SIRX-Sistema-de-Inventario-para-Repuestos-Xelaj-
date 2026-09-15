-- HU-14: reversión de ventas (Administrador). Baja lógica sobre
-- salida_maestro — nunca se borra el registro, solo se marca anulada.
-- Aditivo: default false para todas las filas existentes (ninguna venta
-- ya registrada queda anulada por accidente).

ALTER TABLE salida_maestro ADD COLUMN anulada BOOLEAN NOT NULL DEFAULT false;
