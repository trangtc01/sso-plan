export function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const last = value[value.length - 1];
    return parseBoolean(last, fallback);
  }
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on", "co", "có"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "khong", "không"].includes(normalized)) return false;
  return fallback;
}
