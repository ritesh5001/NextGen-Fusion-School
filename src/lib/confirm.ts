/**
 * Consistent, explicit confirmation prompts for destructive actions.
 *
 * A bare `confirm("Delete?")` gives the user nothing to verify against — they
 * can't tell *which* record they're about to lose. These helpers always name
 * the record and state that the action is permanent.
 */

/**
 * Confirm deleting a named record.
 *
 *   confirmDelete("student", "Reyansh Singh", "ADM0076")
 *   → 'Delete student "Reyansh Singh" (ADM0076)?  This cannot be undone.'
 */
export function confirmDelete(
  entity: string,
  name?: string | null,
  ref?: string | null,
): boolean {
  const label = [name?.trim(), ref ? `(${ref})` : null].filter(Boolean).join(" ");
  const what = label ? `${entity} "${label}"` : `this ${entity}`;
  return window.confirm(`Delete ${what}?\n\nThis cannot be undone.`);
}

/** Confirm a non-delete destructive action (cancel, revoke, reset…). */
export function confirmAction(message: string, detail = "This cannot be undone."): boolean {
  return window.confirm(`${message}\n\n${detail}`);
}
