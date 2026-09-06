-- HU-04: gestión del catálogo de repuestos.
-- Agrega a Articulo los campos que pide la historia y que no estaban en el
-- modelo original (precio_costo, ubicacion, proveedor preferido). La tabla
-- articulo está vacía hasta ahora (ninguna historia anterior la usaba), así
-- que agregar precio_costo NOT NULL es seguro.

ALTER TABLE articulo
  ADD COLUMN precio_costo NUMERIC NOT NULL,
  ADD COLUMN ubicacion TEXT,
  ADD COLUMN id_proveedor INTEGER;

ALTER TABLE articulo
  ADD CONSTRAINT fk_articulo_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor(id_proveedor);
