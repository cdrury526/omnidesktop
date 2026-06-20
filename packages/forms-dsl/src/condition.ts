/**
 * Conditional visibility (`when`). A field renders only when its condition
 * evaluates truthy against the form's current values. The same evaluator is
 * used by the App renderer (to show/hide live) and by the host validator (to
 * decide which fields were actually required) — so it lives here, shared, and
 * the two can never disagree.
 *
 * Leaf conditions reference another field by id; `all` / `any` / `not` compose
 * them. Keep the grammar small: every operator added here is one the agent must
 * learn and the renderer must evaluate.
 */
export type Scalar = string | number | boolean;

export type Condition =
  | { field: string; eq: Scalar }
  | { field: string; ne: Scalar }
  | { field: string; in: Scalar[] }
  | { field: string; contains: Scalar } // for multiselect array values
  | { field: string; truthy: true }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

/** A single field's value. Arrays come from multiselect; scalars from the rest. */
export type FormValue = Scalar | string[] | null | undefined;
export type FormValues = Record<string, FormValue>;

export function evalCondition(cond: Condition, values: FormValues): boolean {
  if ("all" in cond) return cond.all.every((c) => evalCondition(c, values));
  if ("any" in cond) return cond.any.some((c) => evalCondition(c, values));
  if ("not" in cond) return !evalCondition(cond.not, values);

  const v = values[cond.field];
  if ("eq" in cond) return v === cond.eq;
  if ("ne" in cond) return v !== cond.ne;
  if ("in" in cond) return cond.in.includes(v as Scalar);
  if ("contains" in cond) return Array.isArray(v) && (v as string[]).includes(String(cond.contains));
  if ("truthy" in cond) return Array.isArray(v) ? v.length > 0 : Boolean(v);
  return true;
}

/** Every field id a condition reads — used to validate `when` references. */
export function conditionFields(cond: Condition): string[] {
  if ("all" in cond) return cond.all.flatMap(conditionFields);
  if ("any" in cond) return cond.any.flatMap(conditionFields);
  if ("not" in cond) return conditionFields(cond.not);
  return [cond.field];
}
