-- Modelo de datos completo de SIRX (personal/acceso, ubicación
-- geográfica, catálogo y los flujos de compras/ventas).
--
-- Nota: Usuario incluye dos columnas adicionales (failed_attempts,
-- locked_until) respecto al modelo original, para soportar el bloqueo
-- temporal de cuenta de HU-01 (login por rol).

CREATE TABLE Colaborador
(
  id_colaborador   INTEGER      NOT NULL,
  Nombres          TEXT         NOT NULL,
  Primer_Apel      TEXT         NOT NULL,
  Segundo_Apel     TEXT,
  Correo           TEXT,
  Numero_Celular   TEXT,
  Fec_Transac      TIMESTAMP    NOT NULL DEFAULT now(),
  CONSTRAINT pk_colaborador PRIMARY KEY (id_colaborador)
);

CREATE TABLE Rol
(
  Id_Rol       INTEGER  NOT NULL,
  Descripcion  TEXT     NOT NULL,
  CONSTRAINT pk_rol PRIMARY KEY (Id_Rol)
);

CREATE TABLE Plaza
(
  Id_Plaza        INTEGER    NOT NULL,
  Fecha_Inicio    TIMESTAMP  NOT NULL,
  Fecha_Fin       TIMESTAMP,
  Fec_transac     TIMESTAMP  NOT NULL DEFAULT now(),
  Id_Rol          INTEGER    NOT NULL,
  id_colaborador  INTEGER    NOT NULL,
  CONSTRAINT pk_plaza PRIMARY KEY (Id_Plaza),
  CONSTRAINT fk_plaza_rol FOREIGN KEY (Id_Rol) REFERENCES Rol(Id_Rol),
  CONSTRAINT fk_plaza_colaborador FOREIGN KEY (id_colaborador) REFERENCES Colaborador(id_colaborador)
);

CREATE TABLE Departamento
(
  Id_departamento  INTEGER  NOT NULL,
  Nombre           TEXT     NOT NULL,
  CONSTRAINT pk_departamento PRIMARY KEY (Id_departamento)
);

CREATE TABLE Municipio
(
  Id_Municipio     INTEGER  NOT NULL,
  Nombre           TEXT     NOT NULL,
  Id_departamento  INTEGER  NOT NULL,
  CONSTRAINT pk_municipio PRIMARY KEY (Id_Municipio),
  CONSTRAINT fk_municipio_departamento FOREIGN KEY (Id_departamento) REFERENCES Departamento(Id_departamento)
);

CREATE TABLE Pais
(
  Id_Pais  INTEGER  NOT NULL,
  Nombre   TEXT     NOT NULL,
  CONSTRAINT pk_pais PRIMARY KEY (Id_Pais)
);

CREATE TABLE Proveedor
(
  Id_Proveedor     INTEGER        NOT NULL,
  Nombre           TEXT           NOT NULL,
  Direccion        TEXT,
  Vigente          BOOLEAN        NOT NULL DEFAULT TRUE,
  Contacto         TEXT,
  Id_Municipio     INTEGER,
  Id_departamento  INTEGER,
  Id_Pais          INTEGER        NOT NULL,
  CONSTRAINT pk_proveedor PRIMARY KEY (Id_Proveedor),
  CONSTRAINT fk_proveedor_municipio FOREIGN KEY (Id_Municipio) REFERENCES Municipio(Id_Municipio),
  CONSTRAINT fk_proveedor_departamento FOREIGN KEY (Id_departamento) REFERENCES Departamento(Id_departamento),
  CONSTRAINT fk_proveedor_pais FOREIGN KEY (Id_Pais) REFERENCES Pais(Id_Pais)
);

CREATE TABLE Categoria
(
  Id_categoria  INTEGER  NOT NULL,
  Descripcion   TEXT     NOT NULL,
  CONSTRAINT pk_categoria PRIMARY KEY (Id_categoria)
);

CREATE TABLE Marca
(
  Id_Marca  INTEGER  NOT NULL,
  Nombre    TEXT     NOT NULL,
  CONSTRAINT pk_marca PRIMARY KEY (Id_Marca)
);

CREATE TABLE Articulo
(
  SKU                TEXT      NOT NULL,
  Nombre             TEXT      NOT NULL,
  Inventario_Minimo  INTEGER   NOT NULL DEFAULT 0,
  Precio_Venta       NUMERIC   NOT NULL,
  Estado             BOOLEAN   NOT NULL DEFAULT TRUE,
  Id_categoria       INTEGER   NOT NULL,
  Id_Marca           INTEGER,
  CONSTRAINT pk_articulo PRIMARY KEY (SKU),
  CONSTRAINT fk_articulo_categoria FOREIGN KEY (Id_categoria) REFERENCES Categoria(Id_categoria),
  CONSTRAINT fk_articulo_marca FOREIGN KEY (Id_Marca) REFERENCES Marca(Id_Marca)
);

CREATE TABLE Inventario
(
  Cantidad     INTEGER    NOT NULL DEFAULT 0,
  Fec_Transac  TIMESTAMP  NOT NULL DEFAULT now(),
  SKU          TEXT       NOT NULL,
  CONSTRAINT pk_inventario PRIMARY KEY (SKU),
  CONSTRAINT fk_inventario_articulo FOREIGN KEY (SKU) REFERENCES Articulo(SKU)
);

CREATE TABLE Cliente
(
  Id_cliente       INTEGER  NOT NULL,
  Nombre           TEXT     NOT NULL,
  Direccion        TEXT,
  Contacto         TEXT,
  Id_departamento  INTEGER,
  Id_Municipio     INTEGER,
  Id_Pais          INTEGER  NOT NULL,
  CONSTRAINT pk_cliente PRIMARY KEY (Id_cliente),
  CONSTRAINT fk_cliente_departamento FOREIGN KEY (Id_departamento) REFERENCES Departamento(Id_departamento),
  CONSTRAINT fk_cliente_municipio FOREIGN KEY (Id_Municipio) REFERENCES Municipio(Id_Municipio),
  CONSTRAINT fk_cliente_pais FOREIGN KEY (Id_Pais) REFERENCES Pais(Id_Pais)
);

CREATE TABLE Tipo_Salida
(
  Id_tipo_salida  INTEGER  NOT NULL,
  Descripcion     TEXT     NOT NULL,
  CONSTRAINT pk_tipo_salida PRIMARY KEY (Id_tipo_salida)
);

CREATE TABLE Salida_Maestro
(
  Id_venta            INTEGER    NOT NULL,
  Fecha_Salida        TIMESTAMP  NOT NULL,
  Fecha_Pago          TIMESTAMP,
  Monto_Total_Venta   NUMERIC,
  id_colaborador      INTEGER    NOT NULL,
  Id_cliente          INTEGER,
  Id_tipo_salida      INTEGER    NOT NULL,
  CONSTRAINT pk_salida_maestro PRIMARY KEY (Id_venta),
  CONSTRAINT fk_salidamaestro_colaborador FOREIGN KEY (id_colaborador) REFERENCES Colaborador(id_colaborador),
  CONSTRAINT fk_salidamaestro_cliente FOREIGN KEY (Id_cliente) REFERENCES Cliente(Id_cliente),
  CONSTRAINT fk_salidamaestro_tiposalida FOREIGN KEY (Id_tipo_salida) REFERENCES Tipo_Salida(Id_tipo_salida)
);

CREATE TABLE Salida_Detalle
(
  Cantidad      INTEGER    NOT NULL,
  Precio_Venta  NUMERIC,
  Fec_Compra    TIMESTAMP  NOT NULL,
  Id_Salida     INTEGER    NOT NULL,
  SKU           TEXT       NOT NULL,
  CONSTRAINT pk_salida_detalle PRIMARY KEY (Id_Salida),
  CONSTRAINT fk_salidadetalle_salidamaestro FOREIGN KEY (Id_Salida) REFERENCES Salida_Maestro(Id_venta),
  CONSTRAINT fk_salidadetalle_articulo FOREIGN KEY (SKU) REFERENCES Articulo(SKU)
);

CREATE TABLE Compra_Maestro
(
  Id_compra            INTEGER    NOT NULL,
  Fecha_Compra         TIMESTAMP  NOT NULL,
  Fecha_Pago           TIMESTAMP,
  Monto_Total_Compra   NUMERIC    NOT NULL,
  id_colaborador       INTEGER    NOT NULL,
  Id_Proveedor         INTEGER    NOT NULL,
  CONSTRAINT pk_compra_maestro PRIMARY KEY (Id_compra),
  CONSTRAINT fk_compramaestro_colaborador FOREIGN KEY (id_colaborador) REFERENCES Colaborador(id_colaborador),
  CONSTRAINT fk_compramaestro_proveedor FOREIGN KEY (Id_Proveedor) REFERENCES Proveedor(Id_Proveedor)
);

CREATE TABLE Compra_Detalle
(
  Precio_Compra  NUMERIC    NOT NULL,
  Cantidad       INTEGER    NOT NULL,
  Fec_Compra     TIMESTAMP  NOT NULL,
  Id_compra      INTEGER    NOT NULL,
  SKU            TEXT       NOT NULL,
  CONSTRAINT pk_compra_detalle PRIMARY KEY (Id_compra),
  CONSTRAINT fk_compradetalle_compramaestro FOREIGN KEY (Id_compra) REFERENCES Compra_Maestro(Id_compra),
  CONSTRAINT fk_compradetalle_articulo FOREIGN KEY (SKU) REFERENCES Articulo(SKU)
);

CREATE TABLE Ingreso_Plataforma
(
  Fec_Ingreso     TIMESTAMP  NOT NULL,
  id_colaborador  INTEGER    NOT NULL,
  CONSTRAINT pk_ingreso_plataforma PRIMARY KEY (id_colaborador),
  CONSTRAINT fk_ingresoplataforma_colaborador FOREIGN KEY (id_colaborador) REFERENCES Colaborador(id_colaborador)
);

CREATE TABLE Usuario
(
  Usuario         TEXT       NOT NULL,
  Contraseña      TEXT       NOT NULL,
  Vigente         BOOLEAN    NOT NULL DEFAULT TRUE,
  Fec_Transac     TIMESTAMP  NOT NULL DEFAULT now(),
  id_colaborador  INTEGER    NOT NULL,
  failed_attempts INTEGER    NOT NULL DEFAULT 0,
  locked_until    TIMESTAMP,
  CONSTRAINT pk_usuario PRIMARY KEY (id_colaborador),
  CONSTRAINT uq_usuario_usuario UNIQUE (Usuario),
  CONSTRAINT fk_usuario_colaborador FOREIGN KEY (id_colaborador) REFERENCES Colaborador(id_colaborador)
);

CREATE TABLE Modelo
(
  Id_Modelo    INTEGER  NOT NULL,
  Descripcion  TEXT     NOT NULL,
  CONSTRAINT pk_modelo PRIMARY KEY (Id_Modelo)
);

CREATE TABLE Modelo_Compatible
(
  SKU        TEXT     NOT NULL,
  Id_Modelo  INTEGER  NOT NULL,
  CONSTRAINT pk_modelo_compatible PRIMARY KEY (SKU, Id_Modelo),
  CONSTRAINT fk_modelocompatible_articulo FOREIGN KEY (SKU) REFERENCES Articulo(SKU),
  CONSTRAINT fk_modelocompatible_modelo FOREIGN KEY (Id_Modelo) REFERENCES Modelo(Id_Modelo)
);
