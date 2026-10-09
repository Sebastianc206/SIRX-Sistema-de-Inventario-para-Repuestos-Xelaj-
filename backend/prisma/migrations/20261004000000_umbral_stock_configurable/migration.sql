-- Umbral de stock bajo configurable por el Administrador.
-- 1) El mínimo por producto pasa a ser opcional: NULL = usar el umbral general.
--    Los valores ya existentes se conservan como umbral propio del producto
--    (no cambia el comportamiento actual de ningún repuesto).
ALTER TABLE "articulo" ALTER COLUMN "inventario_minimo" DROP NOT NULL;
ALTER TABLE "articulo" ALTER COLUMN "inventario_minimo" DROP DEFAULT;

-- 2) Configuración global clave/valor.
CREATE TABLE "configuracion" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "fec_transac" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_configuracion" PRIMARY KEY ("clave")
);

-- Umbral general por defecto: 5 unidades.
INSERT INTO "configuracion" ("clave", "valor") VALUES ('umbral_stock_bajo', '5');
