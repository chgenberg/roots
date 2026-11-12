/**
 * En ny nyckel per försök att skapa något. Servern slår ihop anrop med samma
 * nyckel, så ett dubbelklick eller ett nytt försök efter nätfel blir en order,
 * medan nästa försäljning får en egen.
 */
export function newAttemptKey(): string {
  // randomUUID finns bara i säkra sammanhang (https, localhost).
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
