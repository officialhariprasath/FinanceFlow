/** Prefer business display code; fall back to numeric id. */
export function entityCode(
  entity: { display_code?: string | null; id?: number | null } | null | undefined,
  fallbackId?: number | null
): string {
  if (entity?.display_code) return entity.display_code;
  const id = entity?.id ?? fallbackId;
  return id != null ? `#${id}` : "—";
}

export function loanLabel(
  loan: { display_code?: string | null; id?: number | null } | null | undefined
): string {
  const code = entityCode(loan);
  return code.startsWith("#") ? `Loan ${code}` : code;
}
