import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProveedorFormModal } from "@/components/ProveedorFormModal";
import { ProveedorApiError } from "@/services/proveedorService";
import type { Pais } from "@/types/catalogosAuxiliares";
import type { Proveedor } from "@/types/proveedor";

const { mockListarPaises, mockCrearProveedor, mockEditarProveedor } = vi.hoisted(() => ({
  mockListarPaises: vi.fn(),
  mockCrearProveedor: vi.fn(),
  mockEditarProveedor: vi.fn(),
}));

vi.mock("@/services/catalogosAuxiliaresService", () => ({
  listarPaises: mockListarPaises,
  listarDepartamentos: vi.fn().mockResolvedValue([]),
  listarMunicipios: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/proveedorService", async () => {
  const actual = await vi.importActual<typeof import("@/services/proveedorService")>(
    "@/services/proveedorService",
  );
  return { ...actual, crearProveedor: mockCrearProveedor, editarProveedor: mockEditarProveedor };
});

const paises: Pais[] = [
  { idPais: 1, nombre: "Guatemala" },
  { idPais: 2, nombre: "México" },
];

const PROVEEDOR_EXISTENTE: Proveedor = {
  idProveedor: 1,
  nombre: "Repuestos Guate S.A.",
  direccion: "Zona 1",
  contacto: "5555-5555",
  vigente: true,
  idPais: 1,
  idDepartamento: null,
  idMunicipio: null,
};

describe("ProveedorFormModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("T-038: crea el proveedor con los datos capturados", async () => {
    mockListarPaises.mockResolvedValueOnce(paises);
    mockCrearProveedor.mockResolvedValueOnce(PROVEEDOR_EXISTENTE);
    const onGuardado = vi.fn();

    render(<ProveedorFormModal proveedor={null} onClose={vi.fn()} onGuardado={onGuardado} />);

    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Repuestos Guate S.A.");
    await screen.findByRole("option", { name: "Guatemala" });
    await userEvent.selectOptions(screen.getByLabelText(/^país$/i), "1");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockCrearProveedor).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Repuestos Guate S.A.", idPais: 1 }),
    );
    expect(onGuardado).toHaveBeenCalledWith("Proveedor creado correctamente.");
  });

  it("no envía el formulario si no se eligió país", async () => {
    mockListarPaises.mockResolvedValueOnce(paises);

    render(<ProveedorFormModal proveedor={null} onClose={vi.fn()} onGuardado={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Repuestos Guate S.A.");
    await screen.findByRole("option", { name: "Guatemala" });

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/selecciona un país/i);
    expect(mockCrearProveedor).not.toHaveBeenCalled();
  });

  it("muestra el error del backend si falla la creación", async () => {
    mockListarPaises.mockResolvedValueOnce(paises);
    mockCrearProveedor.mockRejectedValueOnce(new ProveedorApiError("El país indicado no existe", 400));

    render(<ProveedorFormModal proveedor={null} onClose={vi.fn()} onGuardado={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/^nombre$/i), "X");
    await screen.findByRole("option", { name: "Guatemala" });
    await userEvent.selectOptions(screen.getByLabelText(/^país$/i), "1");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/el país indicado no existe/i);
  });

  it("cierra el modal al hacer click en Cancelar", async () => {
    mockListarPaises.mockResolvedValueOnce(paises);
    const onClose = vi.fn();

    render(<ProveedorFormModal proveedor={null} onClose={onClose} onGuardado={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("en modo edición precarga los campos y llama editarProveedor", async () => {
    mockListarPaises.mockResolvedValueOnce(paises);
    mockEditarProveedor.mockResolvedValueOnce(PROVEEDOR_EXISTENTE);

    render(<ProveedorFormModal proveedor={PROVEEDOR_EXISTENTE} onClose={vi.fn()} onGuardado={vi.fn()} />);

    expect(screen.getByDisplayValue("Repuestos Guate S.A.")).toBeInTheDocument();
    await screen.findByRole("option", { name: "Guatemala" });

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockEditarProveedor).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nombre: "Repuestos Guate S.A.", idPais: 1 }),
    );
  });
});
