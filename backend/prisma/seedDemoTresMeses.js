const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// DATOS DEMO "TRES MESES DE OPERACIÓN" — solo para desarrollo local.
//
// Simula que Repuestos Xelajú operó los últimos 90 días: ~140 repuestos
// nuevos, 6 proveedores más, compras periódicas, ventas diarias de mostrador
// (lunes a sábado fuerte, domingo casi nada, picos quincenales, reparto tipo
// Pareto, ~15% de productos sin ventas en 60+ días = "stock muerto") y
// algunos ajustes/mermas. Sirve para probar Dashboard, Ventas y Reportes.
//
// Uso (desde backend/; requiere `npm run prisma:seed` y `prisma:seed:demo`):
//   npm run prisma:seed:demo3m           -> carga (si ya está cargado, no hace nada)
//   npm run prisma:seed:demo3m:borrar    -> quita SOLO lo que creó este script
//   node prisma/seedDemoTresMeses.js --recargar   -> borra y vuelve a cargar
//                                                    (reancla las fechas a "hoy")
//
// CÓMO SE IDENTIFICA LO CREADO (para el borrado):
//  - Repuestos: SKUs generados de forma determinista por este archivo
//    (prefijo de categoría + número 3001 en adelante, p. ej. FRE-3001,
//    FIL-3020). No dependen de la fecha ni del azar; el borrado vuelve a
//    generar la misma lista. Los 11 repuestos originales (FRE-100, ...) NO
//    se tocan ni reciben movimientos.
//  - Compras y ventas/ajustes: cualquier línea (compra_detalle /
//    salida_detalle) cuyo SKU esté en esa lista; los maestros que queden sin
//    líneas se eliminan.
//  - Proveedores 101-106, y categorías/marcas/modelos nuevos (ids >= 101, por
//    nombre): se eliminan solo si ya nadie los referencia.
//  - Inventario de esos SKUs = SUMA de sus compras - ventas - ajustes (la
//    apertura de inventario se registra como una compra inicial el día -90),
//    así que el stock siempre cuadra con el movimiento.
// Pseudoaleatorio con semilla fija: mismos datos en cada corrida (salvo que
// las fechas se anclan a la fecha de hoy).

const DIAS = 90;
const OFFSET_LOCAL_H = 6; // Guatemala = UTC-6, sin horario de verano.
const ID_BASE = 101; // ids propios (categoría/marca/modelo/proveedor) desde aquí.
const ADMIN_ID = 1;
const OPERADOR_ID = 2;
const ID_TIPO = { venta: 1, merma: 2, usoInterno: 3, garantia: 4, ajuste: 5 };

// ---------------------------------------------------------------- azar
function mulberry32(a) {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEMILLA = 20261008;
let rnd = mulberry32(SEMILLA);
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const redondear2 = (n) => Math.round(n * 100) / 100;
function barajar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function ponderado(opciones) {
  // opciones: [[valor, peso], ...]
  const total = opciones.reduce((s, o) => s + o[1], 0);
  let r = rnd() * total;
  for (const [v, p] of opciones) {
    r -= p;
    if (r <= 0) return v;
  }
  return opciones[opciones.length - 1][0];
}

// ------------------------------------------------------------ catálogo
const MODELOS = {
  "Toyota Hilux": "Toyota Hilux 2015-2020",
  "Toyota Corolla": "Toyota Corolla 2018-2022",
  "Honda Civic": "Honda Civic 2016-2021",
  "Nissan Sentra": "Nissan Sentra 2013-2019",
  "Hyundai Accent": "Hyundai Accent 2012-2018",
  "Kia Rio": "Kia Rio 2012-2017",
  "Toyota RAV4": "Toyota RAV4 2013-2018",
  "Ford Ranger": "Ford Ranger 2012-2018",
  "Mitsubishi L200": "Mitsubishi L200 2010-2018",
};

// Proveedores: 101-106 son nuevos (geografía del seed base: país 1 Guatemala,
// deptos 1 Quetzaltenango / 2 Guatemala / 3 San Marcos; país 5 EE. UU.).
const PROVEEDORES_NUEVOS = [
  { idProveedor: 101, nombre: "Distribuidora Automotriz del Occidente, S.A.", direccion: "4a. calle 12-30 zona 3, Quetzaltenango", contacto: "7761-2040", idPais: 1, idDepartamento: 1, idMunicipio: 1 },
  { idProveedor: 102, nombre: "Lubricantes y Filtros Centroamericana", direccion: "Calzada Aguilar Batres 25-10 zona 11, Guatemala", contacto: "2477-8800", idPais: 1, idDepartamento: 2, idMunicipio: 2 },
  { idProveedor: 103, nombre: "Llantas y Baterías del Altiplano", direccion: "Calzada Independencia 8-15 zona 2, Quetzaltenango", contacto: "7765-1122", idPais: 1, idDepartamento: 1, idMunicipio: 1 },
  { idProveedor: 104, nombre: "Autopartes Eléctricas Pacífico", direccion: "Av. Petapa 40-22 zona 12, Guatemala", contacto: "2366-4455", idPais: 1, idDepartamento: 2, idMunicipio: 2 },
  { idProveedor: 105, nombre: "Importadora Tecún Umán", direccion: "5a. avenida 3-18 zona 1, San Marcos", contacto: "7760-3377", idPais: 1, idDepartamento: 3, idMunicipio: 3 },
  { idProveedor: 106, nombre: "Auto Parts Import Miami, LLC", direccion: "NW 25th St, Doral, FL", contacto: "+1 305-555-0142", idPais: 5, idDepartamento: null, idMunicipio: null },
];
// Cada cuántos días (aprox.) se le hace pedido a cada proveedor.
const CICLO_PROVEEDOR = { 1: 14, 2: 14, 101: 10, 102: 7, 103: 21, 104: 14, 105: 14, 106: 28 };
const PROVEEDORES_POR_CATEGORIA = {
  Frenos: [101, 106, 1],
  Filtros: [102, 1],
  Lubricantes: [102, 2],
  "Suspensión": [101, 2],
  "Eléctrico": [104, 106],
  Encendido: [104, 106],
  "Transmisión": [105, 106, 1],
  "Carrocería": [105, 1],
  Llantas: [103],
  "Baterías": [103, 2],
  "Refrigeración": [105, 2],
};
const PREFIJO_CATEGORIA = {
  Frenos: "FRE",
  Filtros: "FIL",
  Lubricantes: "LUB",
  "Suspensión": "SUS",
  "Eléctrico": "ELE",
  Encendido: "ENC",
  "Transmisión": "TRA",
  "Carrocería": "CAR",
  Llantas: "LLA",
  "Baterías": "BAT",
  "Refrigeración": "REF",
};
const MARCAS_NUEVAS = [
  "Brembo", "TRW", "Akebono", "Mann", "Castrol", "Mobil", "Valvoline", "Prestone", "Lucas", "KYB", "Sachs", "Moog",
  "Denso", "NGK", "Hella", "ACDelco", "Dayco", "Valeo", "Aisin", "Goodyear", "Michelin", "Bridgestone", "Yokohama",
  "LTH", "Monarca", "Koyo",
];
const SKU_INICIAL = 3001;

const M6 = ["Toyota Hilux", "Toyota Corolla", "Honda Civic", "Nissan Sentra", "Hyundai Accent", "Kia Rio"];
const M5 = M6.slice(0, 5);
const M4 = M6.slice(0, 4);
const M3 = M6.slice(0, 3);

// F(categoría, plantilla, [costoMin, costoMax], marcas, variantes, pesoDemanda, tipoCantidad)
// plantilla: {v} variante, {m} marca. Si variantes es null se crea un producto
// por marca; si la variante es un modelo conocido el producto es compatible
// con él; una variante [etiqueta, marca] fija la marca.
const FAMILIAS = [
  ["Frenos", "Pastillas de freno delanteras {v}", [110, 190], ["Bosch", "Brembo", "TRW", "Akebono"], M5, 2.5, "u"],
  ["Frenos", "Pastillas de freno traseras {v}", [90, 150], ["Bosch", "TRW", "Akebono"], M3, 1.5, "u"],
  ["Frenos", "Disco de freno delantero {v}", [180, 320], ["Brembo", "Bosch", "TRW"], M4, 1, "par"],
  ["Frenos", "Zapatas de freno traseras {v}", [85, 140], ["Bosch", "TRW"], ["Toyota Corolla", "Hyundai Accent", "Kia Rio"], 1, "u"],
  ["Frenos", "Líquido de frenos DOT 4 {v}", [35, 60], ["Bosch", "TRW"], ["355 ml", "1 litro"], 2, "u"],
  ["Frenos", "Bomba de freno (cilindro maestro) {v}", [280, 480], ["TRW", "ACDelco"], ["Toyota Hilux", "Toyota Corolla"], 0.3, "u"],
  ["Filtros", "Filtro de aceite {v}", [28, 65], ["Fram", "Bosch", "Mann"], M5, 4, "u"],
  ["Filtros", "Filtro de aire {v}", [55, 120], ["Fram", "Bosch", "Mann"], M5, 3, "u"],
  ["Filtros", "Filtro de combustible {v}", [45, 110], ["Bosch", "Fram"], ["Toyota Hilux", "Ford Ranger", "Mitsubishi L200"], 1.5, "u"],
  ["Filtros", "Filtro de cabina (A/C) {v}", [50, 95], ["Fram", "Bosch"], ["Toyota Corolla", "Honda Civic", "Nissan Sentra", "Toyota RAV4"], 1.5, "u"],
  ["Lubricantes", "Aceite {m} 10W-30 mineral (cuarto)", [38, 52], ["Castrol", "Mobil"], null, 4, "aceite"],
  ["Lubricantes", "Aceite {m} 20W-50 mineral (cuarto)", [34, 48], ["Valvoline", "Mobil"], null, 3.5, "aceite"],
  ["Lubricantes", "Aceite {m} 5W-30 sintético (cuarto)", [62, 85], ["Castrol", "Mobil"], null, 3, "aceite"],
  ["Lubricantes", "Aceite {m} 5W-30 sintético (galón)", [230, 290], ["Mobil", "Castrol"], null, 1, "u"],
  ["Lubricantes", "Aceite {m} 15W-40 diésel (galón)", [160, 210], ["Valvoline", "Mobil"], null, 1.2, "u"],
  ["Lubricantes", "Aceite {m} ATF Dexron III (cuarto)", [48, 70], ["Castrol"], null, 1, "aceite"],
  ["Lubricantes", "Aceite {m} 80W-90 para caja (cuarto)", [55, 80], ["Valvoline"], null, 0.8, "u"],
  ["Lubricantes", "Grasa de chasis {m} 400 g", [28, 45], ["Valvoline"], null, 0.8, "u"],
  ["Lubricantes", "Refrigerante {m} 50/50 (galón)", [75, 110], ["Prestone"], null, 1.5, "u"],
  ["Lubricantes", "Limpiador de inyectores {m} 354 ml", [38, 65], ["Lucas"], null, 0.8, "u"],
  ["Suspensión", "Amortiguador delantero {v}", [320, 560], ["Monroe", "KYB", "Sachs"], M4, 0.8, "par"],
  ["Suspensión", "Amortiguador trasero {v}", [240, 420], ["Monroe", "KYB"], ["Toyota Hilux", "Toyota Corolla", "Honda Civic"], 0.8, "par"],
  ["Suspensión", "Rótula inferior {v}", [85, 180], ["Moog", "TRW"], M4, 1, "u"],
  ["Suspensión", "Terminal de dirección {v}", [70, 150], ["Moog", "TRW"], ["Toyota Hilux", "Toyota Corolla", "Honda Civic", "Hyundai Accent"], 1, "u"],
  ["Suspensión", "Buje de barra estabilizadora {v}", [25, 60], ["Moog"], M3, 1.2, "par"],
  ["Eléctrico", "Alternador {v}", [650, 1100], ["Bosch", "Denso", "ACDelco"], M3, 0.15, "u"],
  ["Eléctrico", "Motor de arranque {v}", [550, 950], ["Bosch", "Denso"], ["Toyota Hilux", "Toyota Corolla"], 0.15, "u"],
  ["Eléctrico", "Bombillo {v} 12V", [25, 45], ["Hella", "Bosch"], ["H4", "H7", "H11"], 2.5, "par"],
  ["Eléctrico", "Kit de fusibles {v}", [20, 35], ["Bosch"], ["surtido 100 pzas"], 1.5, "u"],
  ["Eléctrico", "Sensor de oxígeno {v}", [280, 520], ["Bosch", "Denso"], M3, 0.4, "u"],
  ["Eléctrico", "Bocina universal 12V {v}", [60, 110], ["Hella"], ["doble tono"], 0.6, "u"],
  ["Encendido", "Bujía {v}", [20, 45], ["NGK", "Denso", "Bosch"], M5, 3, "bujia"],
  ["Encendido", "Cables de bujía (juego) {v}", [140, 260], ["NGK", "Bosch"], M3, 0.6, "u"],
  ["Encendido", "Bobina de encendido {v}", [180, 340], ["Denso", "Bosch"], M3, 0.5, "u"],
  ["Transmisión", "Kit de embrague {v}", [650, 1200], ["Sachs", "Valeo"], ["Toyota Hilux", "Toyota Corolla", "Honda Civic"], 0.25, "u"],
  ["Transmisión", "Banda serpentina {v}", [75, 150], ["Gates", "Dayco"], M4, 1, "u"],
  ["Transmisión", "Correa de distribución {v}", [120, 260], ["Gates", "Dayco"], ["Toyota Corolla", "Honda Civic", "Hyundai Accent"], 0.6, "u"],
  ["Transmisión", "Cable de clutch {v}", [70, 130], [null], ["Toyota Hilux", "Toyota Corolla"], 0.3, "u"],
  ["Carrocería", "Espejo retrovisor exterior izquierdo {v}", [140, 260], [null], ["Toyota Corolla", "Honda Civic", "Nissan Sentra"], 0.3, "u"],
  ["Carrocería", "Faro delantero derecho {v}", [350, 650], ["Hella"], ["Toyota Hilux", "Toyota Corolla"], 0.2, "u"],
  ["Carrocería", "Calavera trasera {v}", [220, 400], [null], ["Honda Civic", "Nissan Sentra"], 0.2, "u"],
  ["Carrocería", "Plumilla limpiaparabrisas {v}", [45, 90], ["Bosch"], ['18"', '20"', '22"', '24"'], 2, "par"],
  ["Llantas", "Llanta {m} {v}", [450, 1100], null, [["185/65R15", "Yokohama"], ["185/65R15", "LTH"], ["195/65R15", "Goodyear"], ["195/65R15", "Bridgestone"], ["205/55R16", "Michelin"], ["205/55R16", "Bridgestone"], ["215/70R16", "Yokohama"], ["265/70R16", "Bridgestone"], ["265/70R16", "LTH"]], 0.5, "llanta"],
  ["Baterías", "Batería {m} 12V {v}", [480, 1100], null, [["55 Ah", "Monarca"], ["55 Ah", "LTH"], ["65 Ah", "Bosch"], ["65 Ah", "LTH"], ["75 Ah", "Monarca"], ["100 Ah", "Bosch"], ["100 Ah", "LTH"]], 0.5, "u"],
  ["Refrigeración", "Bomba de agua {v}", [160, 320], ["Gates", "Aisin"], M4, 0.5, "u"],
  ["Refrigeración", "Radiador {v}", [650, 1100], ["Denso", "Koyo"], M3, 0.2, "u"],
  ["Refrigeración", "Termostato {v}", [55, 120], ["Gates"], M3, 0.6, "u"],
  ["Refrigeración", "Manguera superior de radiador {v}", [45, 95], ["Gates"], ["Toyota Corolla", "Hyundai Accent"], 0.4, "u"],
];

function generarCatalogo() {
  const contadores = {};
  const productos = [];
  for (const [categoria, tpl, [cmin, cmax], marcas, variantes, peso, tipoQty] of FAMILIAS) {
    const prefijo = PREFIJO_CATEGORIA[categoria];
    const lista = variantes
      ? variantes.map((v) => (Array.isArray(v) ? { v: v[0], marca: v[1] } : { v, marca: marcas ? elegir(marcas) : null }))
      : marcas.map((m) => ({ v: "", marca: m }));
    for (const it of lista) {
      contadores[prefijo] = (contadores[prefijo] ?? SKU_INICIAL - 1) + 1;
      const costo = redondear2(cmin + rnd() * (cmax - cmin));
      const margen = 0.2 + rnd() * 0.4; // 20%-60% sobre costo
      let venta = costo * (1 + margen);
      venta = venta > 100 ? Math.ceil(venta / 5) * 5 : Math.ceil(venta);
      while (venta < costo * 1.2) venta += venta > 100 ? 5 : 1;
      const compat = MODELOS[it.v] ? [it.v] : [];
      productos.push({
        sku: `${prefijo}-${contadores[prefijo]}`,
        nombre: tpl.replace("{m}", it.marca ?? "").replace("{v}", it.v).replace(/\s+/g, " ").trim(),
        categoria,
        marca: it.marca,
        idProveedor: elegir(PROVEEDORES_POR_CATEGORIA[categoria]),
        costo,
        venta,
        ubicacion:
          categoria === "Llantas"
            ? "Patio de llantas"
            : categoria === "Baterías"
              ? "Estante Baterías"
              : `Estante ${String.fromCharCode(65 + (productos.length % 8))}${1 + (productos.length % 12)}`,
        modelos: compat,
        tipoQty,
        peso,
      });
    }
  }
  return productos;
}

// ------------------------------------------------------------- fechas
const AHORA = new Date();
const hoyLocal = new Date(AHORA.getTime() - OFFSET_LOCAL_H * 3600 * 1000);
const [AA, MM, DD] = [hoyLocal.getUTCFullYear(), hoyLocal.getUTCMonth(), hoyLocal.getUTCDate()];
// d = 0 hoy, -1 ayer ... (día calendario de Guatemala)
const medianocheLocal = (d) => Date.UTC(AA, MM, DD + d, OFFSET_LOCAL_H, 0, 0);
const diaSemana = (d) => new Date(Date.UTC(AA, MM, DD + d)).getUTCDay();
const diaMes = (d) => new Date(Date.UTC(AA, MM, DD + d)).getUTCDate();
const minutosAhoraHoy = Math.floor((AHORA.getTime() - medianocheLocal(0)) / 60000);
const aFecha = (d, minutos) => new Date(medianocheLocal(d) + minutos * 60000);

function cantidadLinea(tipo) {
  switch (tipo) {
    case "aceite": return ponderado([[1, 50], [2, 25], [3, 15], [4, 10]]);
    case "bujia": return ponderado([[4, 60], [1, 20], [6, 10], [8, 10]]);
    case "llanta": return ponderado([[1, 30], [2, 30], [4, 40]]);
    case "par": return ponderado([[1, 45], [2, 55]]);
    default: return ponderado([[1, 80], [2, 15], [3, 5]]);
  }
}

// -------------------------------------------------------------- simulación
function simular(productos) {
  // Peso de demanda tipo Pareto: familia x factor lognormal, penaliza lo caro.
  for (const p of productos) {
    p.w = Math.pow(p.peso * Math.exp(0.8 * gauss()) / Math.pow(p.costo / 100 + 0.5, 0.3), 1.1);
  }
  // Stock muerto: ~15% de productos de menor demanda. Mitad sin ventas en
  // absoluto, mitad con ventas solo en los días -90..-61.
  const porPeso = [...productos].sort((a, b) => a.w - b.w);
  const candidatos = barajar(porPeso.slice(0, Math.floor(productos.length * 0.6)));
  const nMuertos = Math.round(productos.length * 0.15);
  candidatos.slice(0, nMuertos).forEach((p, i) => { p.muerto = i % 2 === 0 ? "nunca" : "temprano"; });

  const todos = productos.filter((p) => p.muerto !== "nunca");
  const vivos = productos.filter((p) => !p.muerto);
  const cumul = (lista) => {
    let s = 0;
    return lista.map((p) => { s += p.w * (p.muerto === "temprano" ? 0.6 : 1); return s; });
  };
  const cumTodos = cumul(todos);
  const cumVivos = cumul(vivos);
  const muestrear = (lista, cum) => {
    const r = rnd() * cum[cum.length - 1];
    let lo = 0; let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    return lista[lo];
  };

  const tickets = [];
  const eventos = new Map(productos.map((p) => [p.sku, []])); // {dia, cant}
  for (let d = -DIAS; d <= 0; d += 1) {
    const dow = diaSemana(d);
    let n;
    if (dow === 0) n = rnd() < 0.35 ? entre(1, 2) : 0;
    else if (dow === 6) n = Math.max(0, Math.round(24 + 5 * gauss()));
    else n = Math.max(0, Math.round(15 + 4 * gauss()));
    if ([1, 2, 14, 15, 16, 29, 30, 31].includes(diaMes(d))) n = Math.round(n * 1.45);
    let maxMin = 18 * 60 - 1;
    if (d === 0) {
      maxMin = Math.min(maxMin, minutosAhoraHoy);
      n = maxMin < 8 * 60 + 5 ? 0 : Math.round((n * (maxMin - 480)) / 600);
    }
    const lista = d >= -60 ? vivos : todos;
    const cum = d >= -60 ? cumVivos : cumTodos;
    const minutos = [];
    for (let i = 0; i < n; i += 1) minutos.push(entre(8 * 60, maxMin));
    minutos.sort((a, b) => a - b);
    for (const min of minutos) {
      const nLineas = ponderado([[1, 35], [2, 28], [3, 18], [4, 10], [5, 6], [6, 3]]);
      const usados = new Set();
      const lineas = [];
      for (let intento = 0; lineas.length < nLineas && intento < 40; intento += 1) {
        const p = muestrear(lista, cum);
        if (usados.has(p.sku)) continue;
        usados.add(p.sku);
        const cantidad = cantidadLinea(p.tipoQty);
        lineas.push({ sku: p.sku, cantidad, precio: p.venta });
        eventos.get(p.sku).push({ dia: d, cant: cantidad });
      }
      tickets.push({ dia: d, min, colab: rnd() < 0.7 ? OPERADOR_ID : ADMIN_ID, lineas });
    }
  }

  // Ajustes / mermas repartidos en el tiempo (~40).
  const ajustes = [];
  const MOTIVOS = [[ID_TIPO.merma, 45], [ID_TIPO.ajuste, 25], [ID_TIPO.usoInterno, 15], [ID_TIPO.garantia, 15]];
  for (let i = 0; i < 40; i += 1) {
    const d = -entre(0, DIAS - 1);
    const dow = diaSemana(d);
    if (dow === 0) { i -= 1; continue; }
    const maxMin = d === 0 ? Math.min(18 * 60 - 1, minutosAhoraHoy) : 18 * 60 - 1;
    if (maxMin < 8 * 60 + 5) { i -= 1; continue; }
    const nLineas = ponderado([[1, 60], [2, 30], [3, 10]]);
    const usados = new Set();
    const lineas = [];
    while (lineas.length < nLineas) {
      const p = elegir(productos);
      if (usados.has(p.sku)) continue;
      usados.add(p.sku);
      const cantidad = entre(1, p.tipoQty === "aceite" ? 4 : 3);
      lineas.push({ sku: p.sku, cantidad, idTipo: ponderado(MOTIVOS) });
      eventos.get(p.sku).push({ dia: d, cant: cantidad });
    }
    ajustes.push({ dia: d, min: entre(8 * 60, maxMin), colab: rnd() < 0.5 ? OPERADOR_ID : ADMIN_ID, lineas });
  }

  // Perfil de stock final según demanda observada.
  const unidades = (p) => eventos.get(p.sku).reduce((s, e) => s + e.cant, 0);
  const unidades60 = (p) => eventos.get(p.sku).filter((e) => e.dia >= -60).reduce((s, e) => s + e.cant, 0);
  const rank = [...vivos].sort((a, b) => unidades(b) - unidades(a));
  const asignados = new Set();
  const tomar = (desde, hasta, n, perfil) => {
    const pool = barajar(rank.slice(desde, hasta).filter((p) => !asignados.has(p.sku) && unidades60(p) >= 6));
    pool.slice(0, n).forEach((p) => { p.perfil = perfil; asignados.add(p.sku); });
  };
  tomar(5, 55, 9, "agotado");
  tomar(10, 90, 17, "bajo");
  tomar(40, rank.length, 7, "sobrestock");
  for (const p of productos) {
    if (!p.perfil) p.perfil = p.muerto ? "muerto" : "normal";
  }
  return { tickets, ajustes, eventos };
}

// Fechas de pedido de cada proveedor: arranca el día -90 (apertura de
// inventario) y sigue con el ciclo del proveedor; el último pedido cae antes
// de hace 2 días.
function diasPedido() {
  const res = {};
  for (const [idProv, ciclo] of Object.entries(CICLO_PROVEEDOR)) {
    const dias = [-DIAS];
    let d = -DIAS;
    for (;;) {
      d += ciclo + entre(-2, 2);
      if (d > -3) break;
      dias.push(d);
    }
    res[idProv] = dias;
  }
  return res;
}

function planificarCompras(productos, eventos, ordenes) {
  const compras = []; // {dia, idProveedor, lineas:[{sku,cantidad,precio}]}
  const porClave = new Map();
  const agregar = (idProveedor, dia, linea) => {
    const clave = `${idProveedor}|${dia}`;
    if (!porClave.has(clave)) {
      const c = { dia, idProveedor, lineas: [] };
      porClave.set(clave, c);
      compras.push(c);
    }
    porClave.get(clave).lineas.push(linea);
  };

  for (const p of productos) {
    const ev = eventos.get(p.sku);
    const dias = ordenes[p.idProveedor];
    const umbral = p.minimo ?? 5;
    const total = ev.reduce((s, e) => s + e.cant, 0);
    const diaria = total / DIAS;
    const demandaDesde = (desde, hasta) => ev.filter((e) => e.dia >= desde && e.dia < hasta).reduce((s, e) => s + e.cant, 0);

    // Stock final objetivo y orden en la que se detiene el reabasto.
    let objetivo;
    let detener = null; // índice de pedido desde el cual se cubre todo hasta hoy
    if (p.perfil === "agotado") {
      objetivo = 0;
      const validos = dias.map((d, i) => [d, i]).filter(([d]) => d <= -18);
      detener = validos.length ? validos[validos.length - 1][1] : 0;
    } else if (p.perfil === "bajo") {
      objetivo = entre(1, Math.max(1, umbral));
      detener = dias.length - 1;
    } else if (p.perfil === "muerto") {
      objetivo = entre(4, 25);
      detener = 0;
    } else if (p.perfil === "sobrestock") {
      objetivo = Math.max(40, Math.ceil(diaria * 30 * entre(5, 9)) + 20);
    } else {
      objetivo = umbral + 2 + entre(0, 2 * umbral + 5);
    }
    p.objetivo = objetivo;
    const exacto = p.perfil === "agotado" || p.perfil === "bajo" || p.perfil === "muerto";

    let saldo = 0;
    for (let i = 0; i < dias.length; i += 1) {
      const ultimo = i === dias.length - 1;
      const sigue = ultimo ? 1 : dias[i + 1];
      const hasta = ultimo ? 1 : sigue;
      let cantidad;
      if (detener !== null && i === detener) {
        cantidad = Math.max(0, demandaDesde(dias[i], 1) + objetivo - saldo);
        saldo += cantidad - demandaDesde(dias[i], 1);
        if (cantidad > 0) agregar(p.idProveedor, dias[i], { sku: p.sku, cantidad, precio: p.costo });
        break;
      }
      const ventana = demandaDesde(dias[i], hasta);
      let seguridad = 0;
      if (!exacto) {
        seguridad = ultimo
          ? objetivo
          : Math.max(umbral + 1, Math.ceil(diaria * (i === 0 ? 14 : entre(3, 10))));
      }
      cantidad = Math.max(0, ventana + seguridad - saldo);
      if (!exacto && !ultimo && cantidad > 0 && cantidad >= 12) cantidad = Math.ceil(cantidad / 6) * 6;
      saldo += cantidad - ventana;
      if (cantidad > 0) agregar(p.idProveedor, dias[i], { sku: p.sku, cantidad, precio: p.costo });
    }
  }
  return compras;
}

// ----------------------------------------------------------------- carga
function construirTodo() {
  rnd = mulberry32(SEMILLA); // misma secuencia en cada corrida
  const productos = generarCatalogo();
  // Umbral propio: ~35% de los productos (según demanda esperada); el resto null.
  for (const p of productos) {
    p.minimo = rnd() < 0.35 ? (p.peso >= 2.5 ? entre(8, 15) : p.peso >= 1 ? entre(4, 8) : entre(1, 3)) : null;
  }
  const { tickets, ajustes, eventos } = simular(productos);
  const ordenes = diasPedido();
  const compras = planificarCompras(productos, eventos, ordenes);
  return { productos, tickets, ajustes, eventos, compras };
}

async function idsLibres(tx, modelo, campo, cuantos) {
  const r = await tx[modelo].aggregate({ _max: { [campo]: true } });
  const base = (r._max[campo] ?? 0) + 1;
  return Array.from({ length: cuantos }, (_, i) => base + i);
}

async function crear() {
  const yaCargado = await prisma.articulo.count({ where: { sku: { in: generarCatalogo().map((p) => p.sku) } } });
  if (yaCargado > 0) {
    console.log(`Los datos demo de 3 meses ya están cargados (${yaCargado} repuestos). Usa --recargar para rehacerlos o :borrar para quitarlos.`);
    return;
  }
  const { productos, tickets, ajustes, compras } = construirTodo();

  // Orden cronológico para que los ids sigan el tiempo.
  compras.sort((a, b) => a.dia - b.dia || a.idProveedor - b.idProveedor);
  const salidas = [
    ...tickets.map((t) => ({ ...t, esVenta: true })),
    ...ajustes.map((a) => ({ ...a, esVenta: false })),
  ].sort((a, b) => a.dia - b.dia || a.min - b.min);

  const existentes = {
    categorias: await prisma.categoria.findMany(),
    marcas: await prisma.marca.findMany(),
    modelos: await prisma.modelo.findMany(),
  };

  await prisma.$transaction(
    async (tx) => {
      // Catálogos auxiliares: reutiliza por nombre, crea con ids >= ID_BASE.
      const catId = new Map(existentes.categorias.map((c) => [c.descripcion, c.idCategoria]));
      let proxCat = Math.max(ID_BASE - 1, ...existentes.categorias.map((c) => c.idCategoria)) + 1;
      const nuevasCat = [];
      for (const nombre of Object.keys(PREFIJO_CATEGORIA)) {
        if (!catId.has(nombre)) { catId.set(nombre, proxCat); nuevasCat.push({ idCategoria: proxCat, descripcion: nombre }); proxCat += 1; }
      }
      await tx.categoria.createMany({ data: nuevasCat });

      const marcaId = new Map(existentes.marcas.map((m) => [m.nombre, m.idMarca]));
      let proxMarca = Math.max(ID_BASE - 1, ...existentes.marcas.map((m) => m.idMarca)) + 1;
      const nuevasMarcas = [];
      for (const nombre of MARCAS_NUEVAS) {
        if (!marcaId.has(nombre)) { marcaId.set(nombre, proxMarca); nuevasMarcas.push({ idMarca: proxMarca, nombre }); proxMarca += 1; }
      }
      await tx.marca.createMany({ data: nuevasMarcas });

      const modeloId = new Map(existentes.modelos.map((m) => [m.descripcion, m.idModelo]));
      let proxModelo = Math.max(ID_BASE - 1, ...existentes.modelos.map((m) => m.idModelo)) + 1;
      const nuevosModelos = [];
      for (const desc of Object.values(MODELOS)) {
        if (!modeloId.has(desc)) { modeloId.set(desc, proxModelo); nuevosModelos.push({ idModelo: proxModelo, descripcion: desc }); proxModelo += 1; }
      }
      await tx.modelo.createMany({ data: nuevosModelos });

      await tx.proveedor.createMany({ data: PROVEEDORES_NUEVOS, skipDuplicates: true });

      // Catálogo + inventario (cantidad final = compras - salidas).
      const saldo = new Map(productos.map((p) => [p.sku, 0]));
      for (const c of compras) for (const l of c.lineas) saldo.set(l.sku, saldo.get(l.sku) + l.cantidad);
      for (const s of salidas) for (const l of s.lineas) saldo.set(l.sku, saldo.get(l.sku) - l.cantidad);
      for (const [sku, q] of saldo) if (q < 0) throw new Error(`Stock negativo simulado para ${sku}: ${q}`);

      await tx.articulo.createMany({
        data: productos.map((p) => ({
          sku: p.sku,
          nombre: p.nombre,
          inventarioMinimo: p.minimo,
          precioVenta: p.venta,
          precioCosto: p.costo,
          ubicacion: p.ubicacion,
          idCategoria: catId.get(p.categoria),
          idMarca: p.marca ? marcaId.get(p.marca) : null,
          idProveedor: p.idProveedor,
        })),
      });
      await tx.inventario.createMany({
        data: productos.map((p) => ({ sku: p.sku, cantidad: saldo.get(p.sku), fecTransac: AHORA })),
      });
      await tx.modeloCompatible.createMany({
        data: productos.flatMap((p) => p.modelos.map((m) => ({ sku: p.sku, idModelo: modeloId.get(MODELOS[m]) }))),
      });

      // Compras.
      const idsCompra = await idsLibres(tx, "compraMaestro", "idCompra", compras.length);
      const nDetCompra = compras.reduce((s, c) => s + c.lineas.length, 0);
      const idsDetCompra = await idsLibres(tx, "compraDetalle", "idDetalleCompra", nDetCompra);
      const maestrosC = [];
      const detallesC = [];
      let k = 0;
      compras.forEach((c, i) => {
        const fecha = aFecha(c.dia, 7 * 60 + 15 + entre(0, 30));
        let monto = 0;
        for (const l of c.lineas) {
          const precio = redondear2(l.precio * (0.97 + rnd() * 0.06));
          monto += precio * l.cantidad;
          detallesC.push({ idDetalleCompra: idsDetCompra[k], idCompra: idsCompra[i], sku: l.sku, cantidad: l.cantidad, precioCompra: precio, fecCompra: fecha });
          k += 1;
        }
        const pago = new Date(fecha.getTime() + entre(7, 30) * 86400000);
        maestrosC.push({
          idCompra: idsCompra[i],
          fechaCompra: fecha,
          fechaPago: pago <= AHORA ? pago : null,
          montoTotalCompra: redondear2(monto),
          idColaborador: ADMIN_ID,
          idProveedor: c.idProveedor,
        });
      });
      await tx.compraMaestro.createMany({ data: maestrosC });
      for (let i = 0; i < detallesC.length; i += 1000) await tx.compraDetalle.createMany({ data: detallesC.slice(i, i + 1000) });

      // Ventas y ajustes (comparten SalidaMaestro).
      const idsSalida = await idsLibres(tx, "salidaMaestro", "idVenta", salidas.length);
      const nDetSalida = salidas.reduce((s, x) => s + x.lineas.length, 0);
      const idsDetSalida = await idsLibres(tx, "salidaDetalle", "idDetalleSalida", nDetSalida);
      const maestrosS = [];
      const detallesS = [];
      k = 0;
      salidas.forEach((s, i) => {
        const fecha = aFecha(s.dia, s.min);
        let monto = 0;
        for (const l of s.lineas) {
          if (s.esVenta) monto += l.cantidad * l.precio;
          detallesS.push({
            idDetalleSalida: idsDetSalida[k],
            idSalida: idsSalida[i],
            sku: l.sku,
            cantidad: l.cantidad,
            precioVenta: s.esVenta ? l.precio : null,
            idTipoSalida: s.esVenta ? ID_TIPO.venta : l.idTipo,
            fecCompra: fecha,
          });
          k += 1;
        }
        maestrosS.push({
          idVenta: idsSalida[i],
          fechaSalida: fecha,
          montoTotalVenta: s.esVenta ? redondear2(monto) : null,
          idColaborador: s.colab,
          idCliente: null,
        });
      });
      for (let i = 0; i < maestrosS.length; i += 1000) await tx.salidaMaestro.createMany({ data: maestrosS.slice(i, i + 1000) });
      for (let i = 0; i < detallesS.length; i += 1000) await tx.salidaDetalle.createMany({ data: detallesS.slice(i, i + 1000) });

      console.log(
        `Demo 3 meses cargada: ${productos.length} repuestos, ${compras.length} compras (${detallesC.length} líneas), ` +
          `${tickets.length} ventas, ${ajustes.length} ajustes (${detallesS.length} líneas de salida).`,
      );
    },
    { timeout: 300000, maxWait: 30000 },
  );
}

async function borrar() {
  const skus = generarCatalogo().map((p) => p.sku);
  const enLista = { sku: { in: skus } };
  await prisma.$transaction(
    async (tx) => {
      const ventas = await tx.salidaDetalle.findMany({ where: enLista, select: { idSalida: true } });
      const compras = await tx.compraDetalle.findMany({ where: enLista, select: { idCompra: true } });
      const idsVentas = [...new Set(ventas.map((v) => v.idSalida))];
      const idsCompras = [...new Set(compras.map((c) => c.idCompra))];

      const d1 = await tx.salidaDetalle.deleteMany({ where: enLista });
      const d2 = await tx.compraDetalle.deleteMany({ where: enLista });
      const vacV = await tx.salidaMaestro.deleteMany({ where: { idVenta: { in: idsVentas }, detalles: { none: {} } } });
      const vacC = await tx.compraMaestro.deleteMany({ where: { idCompra: { in: idsCompras }, detalles: { none: {} } } });
      await tx.modeloCompatible.deleteMany({ where: enLista });
      const inv = await tx.inventario.deleteMany({ where: enLista });
      const art = await tx.articulo.deleteMany({ where: enLista });

      // Catálogos propios: solo los creados por este script y ya sin uso.
      const provs = await tx.proveedor.deleteMany({
        where: { idProveedor: { in: PROVEEDORES_NUEVOS.map((p) => p.idProveedor) }, articulos: { none: {} }, compras: { none: {} } },
      });
      const cats = await tx.categoria.deleteMany({
        where: { idCategoria: { gte: ID_BASE }, descripcion: { in: Object.keys(PREFIJO_CATEGORIA) }, articulos: { none: {} } },
      });
      const marcas = await tx.marca.deleteMany({
        where: { idMarca: { gte: ID_BASE }, nombre: { in: MARCAS_NUEVAS }, articulos: { none: {} } },
      });
      const modelos = await tx.modelo.deleteMany({
        where: { idModelo: { gte: ID_BASE }, descripcion: { in: Object.values(MODELOS) }, compatibles: { none: {} } },
      });
      console.log(
        `Borrado: ${art.count} repuestos, ${inv.count} inventarios, ${d1.count} líneas de salida, ${d2.count} de compra, ` +
          `${vacV.count} ventas/ajustes y ${vacC.count} compras vacías, ${provs.count} proveedores, ` +
          `${cats.count} categorías, ${marcas.count} marcas, ${modelos.count} modelos.`,
      );
    },
    { timeout: 300000, maxWait: 30000 },
  );
}

async function main() {
  if (process.argv.includes("--borrar")) return borrar();
  if (process.argv.includes("--recargar")) await borrar();
  return crear();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
