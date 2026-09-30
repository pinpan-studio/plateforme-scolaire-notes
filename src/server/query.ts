import { ApiError } from "./errors";
import { uuidSchema } from "./schemas";

export function parseRouteId(params: Record<string, string>, name = "id"): string {
  const parsed = uuidSchema.safeParse(params[name]);
  if (!parsed.success) {
    throw new ApiError(422, "VALIDATION", "Identifiant invalide.", [{ path: name, message: "UUID attendu." }]);
  }
  return parsed.data;
}

export function searchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

export function pagination(params: URLSearchParams) {
  const pageRaw = params.get("page") ?? "1";
  const sizeRaw = params.get("pageSize") ?? "25";
  if (!/^\d+$/.test(pageRaw) || !/^\d+$/.test(sizeRaw)) {
    throw new ApiError(422, "VALIDATION", "Pagination invalide.");
  }
  const page = Number(pageRaw);
  const pageSize = Number(sizeRaw);
  if (page < 1 || pageSize < 1 || pageSize > 100) {
    throw new ApiError(422, "VALIDATION", "Pagination invalide.");
  }
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function optionalUuid(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name);
  if (!value) return undefined;
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(422, "VALIDATION", "Identifiant invalide.", [
      { path: name, message: "UUID attendu." },
    ]);
  }
  return parsed.data;
}

export function requireUuid(params: URLSearchParams, name: string): string {
  const value = optionalUuid(params, name);
  if (!value) {
    throw new ApiError(422, "VALIDATION", "Paramètre requis.", [{ path: name, message: "UUID attendu." }]);
  }
  return value;
}

export function searchQuery(params: URLSearchParams): string | undefined {
  const raw = params.get("q");
  if (raw === null) return undefined;
  const value = raw.trim();
  if (value.length === 0) return undefined;
  if (value.length > 80) {
    throw new ApiError(422, "VALIDATION", "La recherche est limitée à 80 caractères.", [
      { path: "q", message: "80 caractères maximum." },
    ]);
  }
  return value;
}

export function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function sortOrder(params: URLSearchParams, allowed: readonly string[], fallback: string) {
  const sort = params.get("sort") ?? fallback;
  if (!allowed.includes(sort)) {
    throw new ApiError(422, "VALIDATION", "Tri non autorisé.", [{ path: "sort", message: "Colonne inconnue." }]);
  }
  const order = params.get("order") ?? "asc";
  if (order !== "asc" && order !== "desc") {
    throw new ApiError(422, "VALIDATION", "Ordre de tri invalide.");
  }
  return { sort, order: order as "asc" | "desc" };
}

export function versionCorrespond(updatedAt: Date, version: string): boolean {
  const parsed = Date.parse(version);
  return !Number.isNaN(parsed) && parsed === updatedAt.getTime();
}

export function assertVersion(updatedAt: Date, version: string | undefined) {
  if (version === undefined) return;
  const parsed = Date.parse(version);
  if (Number.isNaN(parsed)) {
    throw new ApiError(422, "VALIDATION", "Version invalide.", [
      { path: "version", message: "Horodatage invalide." },
    ]);
  }
  if (!versionCorrespond(updatedAt, version)) {
    throw new ApiError(409, "CONFLIT", "La fiche a été modifiée. Rechargez avant d'enregistrer.");
  }
}

export function versionOf(date: Date): string {
  return date.toISOString();
}
