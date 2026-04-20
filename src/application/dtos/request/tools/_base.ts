export type ValidationTuple<T> = [string?, T?];

export class RequestValidator {
  public static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  public static requiredString(obj: Record<string, unknown>, key: string): string | null {
    const value = obj[key];
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  public static optionalString(obj: Record<string, unknown>, key: string): string | null | undefined {
    if (!(key in obj) || obj[key] === undefined) {
      return undefined;
    }
    if (obj[key] === null) {
      return null;
    }
    if (typeof obj[key] !== "string") {
      return undefined;
    }
    return obj[key] as string;
  }
}
