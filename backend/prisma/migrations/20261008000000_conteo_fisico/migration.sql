-- Conteo físico de inventario: cabecera y líneas por SKU.
-- Los ajustes aplicados quedan trazables en conteo_detalle (ajuste, antes,
-- después) y aparecen en Movimientos; NO se escriben en salida_* / compra_*
-- (un ajuste positivo no tiene proveedor ni precio, y las salidas solo restan).
CREATE TABLE "conteo_fisico" (
    "id_conteo" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "fecha_conteo" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "id_categoria" INTEGER,
    "id_colaborador" INTEGER NOT NULL,
    "id_colaborador_cierre" INTEGER,
    "fecha_cierre" TIMESTAMP(3),
    "fec_transac" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_conteo_fisico" PRIMARY KEY ("id_conteo"),
    CONSTRAINT "ck_conteo_estado" CHECK ("estado" IN ('borrador', 'cerrado', 'aplicado', 'cancelado'))
);

CREATE TABLE "conteo_detalle" (
    "id_detalle_conteo" INTEGER NOT NULL,
    "id_conteo" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "cantidad_sistema" INTEGER NOT NULL,
    "cantidad_contada" INTEGER NOT NULL,
    "fec_contado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ajuste" INTEGER,
    "cantidad_antes" INTEGER,
    "cantidad_despues" INTEGER,

    CONSTRAINT "pk_conteo_detalle" PRIMARY KEY ("id_detalle_conteo"),
    CONSTRAINT "ck_conteo_detalle_contada" CHECK ("cantidad_contada" >= 0)
);

CREATE UNIQUE INDEX "uq_conteo_detalle_sku" ON "conteo_detalle"("id_conteo", "sku");

ALTER TABLE "conteo_fisico" ADD CONSTRAINT "fk_conteo_categoria" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conteo_fisico" ADD CONSTRAINT "fk_conteo_colaborador" FOREIGN KEY ("id_colaborador") REFERENCES "colaborador"("id_colaborador") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conteo_fisico" ADD CONSTRAINT "fk_conteo_colaborador_cierre" FOREIGN KEY ("id_colaborador_cierre") REFERENCES "colaborador"("id_colaborador") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conteo_detalle" ADD CONSTRAINT "fk_conteodetalle_conteo" FOREIGN KEY ("id_conteo") REFERENCES "conteo_fisico"("id_conteo") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conteo_detalle" ADD CONSTRAINT "fk_conteodetalle_articulo" FOREIGN KEY ("sku") REFERENCES "articulo"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;
