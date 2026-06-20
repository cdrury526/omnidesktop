/**
 * The DSL lets a single-step form use the `fields` shorthand; internally we
 * always work in terms of `steps`. Normalizing here means the renderer and the
 * validators never special-case the shorthand.
 */
import type { Field, FormSpec, FormStep } from "./fields";

/** A single-step form becomes one synthetic step. */
export function toSteps(spec: FormSpec): FormStep[] {
  if (spec.steps && spec.steps.length > 0) return spec.steps;
  return [{ fields: spec.fields ?? [] }];
}

/** Every field across every step, in order. */
export function allFields(spec: FormSpec): Field[] {
  return toSteps(spec).flatMap((s) => s.fields ?? []);
}
