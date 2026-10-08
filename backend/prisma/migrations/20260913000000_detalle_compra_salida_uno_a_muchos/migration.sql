-- HU-08/HU-13: compra_detalle y salida_detalle eran 1—1 con su maestro
-- (compartían PK con id_compra/id_salida), lo que impedía registrar varias
-- líneas de producto en una sola compra o venta. Les damos PK propia
-- (id_detalle_compra / id_detalle_salida) y dejamos id_compra/id_salida
-- como FK normal (ya no única) hacia el maestro.
--
-- Aditivo y no destructivo: ambas tablas están vacías hoy (ninguna historia
-- anterior las usaba — ver docs/DATABASE.md), pero el backfill de abajo es
-- seguro también si llegaran a tener filas, reutilizando el valor antiguo
-- de PK como valor inicial de la nueva.

ALTER TABLE compra_detalle ADD COLUMN id_detalle_compra INTEGER;
UPDATE compra_detalle SET id_detalle_compra = id_compra WHERE id_detalle_compra IS NULL;
ALTER TABLE compra_detalle ALTER COLUMN id_detalle_compra SET NOT NULL;
ALTER TABLE compra_detalle DROP CONSTRAINT pk_compra_detalle;
ALTER TABLE compra_detalle ADD CONSTRAINT pk_compra_detalle PRIMARY KEY (id_detalle_compra);

ALTER TABLE salida_detalle ADD COLUMN id_detalle_salida INTEGER;
UPDATE salida_detalle SET id_detalle_salida = id_salida WHERE id_detalle_salida IS NULL;
ALTER TABLE salida_detalle ALTER COLUMN id_detalle_salida SET NOT NULL;
ALTER TABLE salida_detalle DROP CONSTRAINT pk_salida_detalle;
ALTER TABLE salida_detalle ADD CONSTRAINT pk_salida_detalle PRIMARY KEY (id_detalle_salida);
