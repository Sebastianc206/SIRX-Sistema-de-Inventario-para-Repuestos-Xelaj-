-- HU-09: el motivo de una salida (Venta/Merma/Uso interno/Garantía/Ajuste)
-- pasa de ser un campo de encabezado en salida_maestro a un campo por línea
-- en salida_detalle — un ajuste puede traer líneas con motivos distintos
-- (antes solo se podía elegir un motivo para todo el registro).
--
-- No destructivo: se agrega la columna, se rellena copiando el valor que
-- ya tenía el maestro de cada línea (así ninguna fila existente pierde su
-- motivo), y solo entonces se retira la columna vieja del maestro.

ALTER TABLE salida_detalle ADD COLUMN id_tipo_salida INTEGER;

UPDATE salida_detalle sd
SET id_tipo_salida = sm.id_tipo_salida
FROM salida_maestro sm
WHERE sd.id_salida = sm.id_venta
  AND sd.id_tipo_salida IS NULL;

ALTER TABLE salida_detalle ALTER COLUMN id_tipo_salida SET NOT NULL;

ALTER TABLE salida_detalle
  ADD CONSTRAINT fk_salidadetalle_tiposalida FOREIGN KEY (id_tipo_salida) REFERENCES tipo_salida(id_tipo_salida);

ALTER TABLE salida_maestro DROP CONSTRAINT fk_salidamaestro_tiposalida;
ALTER TABLE salida_maestro DROP COLUMN id_tipo_salida;
