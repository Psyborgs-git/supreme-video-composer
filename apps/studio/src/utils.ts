/** Generates a short unique ID: timestamp + random suffix */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
