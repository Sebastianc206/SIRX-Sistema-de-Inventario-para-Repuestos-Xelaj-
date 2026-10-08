-- Reversión de compras (Administrador). Baja lógica sobre compra_maestro —
-- nunca se borra el registro, solo se marca anulada. Aditivo: default false
-- para todas las filas existentes.

ALTER TABLE compra_maestro ADD COLUMN anulada BOOLEAN NOT NULL DEFAULT false;
