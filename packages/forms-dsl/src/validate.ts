/**
 * Validation, both directions:
 *
 *  - `validateSpec`   (agent → form): is the spec the model emitted renderable?
 *    Runs in the host's `onToolCalled` BEFORE we pause/render. On failure the
 *    host returns the issues as the tool result so the model self-corrects on
 *    the same turn — the feedback loop. Includes "did you mean" hints for the
 *    typos models actually make.
 *
 *  - `validateResult` (form → agent): is what the user submitted well-formed?
 *    The App iframe is untrusted, so the host re-runs this before resolving the
 *    tool call. Honors `when`: hidden fields aren't required and are stripped
 *    from the cleaned result.
 */
import {
  CHOICE_TYPES,
  FIELD_TYPES,
  type Field,
  type FormSpec,
  optionValue,
} from "./fields";
import { allFields, toSteps } from "./normalize";
import { conditionFields, evalCondition, type FormValues } from "./condition";

export interface Issue {
  path: string;
  message: string;
  hint?: string;
}
export interface SpecCheck {
  ok: boolean;
  issues: Issue[];
}
export interface ResultCheck {
  ok: boolean;
  issues: Issue[];
  /** Visible fields only, unknown keys dropped. Safe to hand to the model. */
  cleaned: FormValues;
}

const TYPE_SET = new Set<string>(FIELD_TYPES);

/** Typos models actually emit → the field type they meant. */
const NEAR: Record<string, string> = {
  dropdown: "select",
  combobox: "select",
  choice: "select",
  checkbox: "boolean",
  toggle: "boolean",
  switch: "boolean",
  string: "text",
  longtext: "textarea",
  paragraph: "textarea",
  multi: "multiselect",
  tags: "multiselect",
  range: "slider",
};

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function validateSpec(spec: unknown): SpecCheck {
  const issues: Issue[] = [];
  const add = (path: string, message: string, hint?: string) =>
    issues.push(hint ? { path, message, hint } : { path, message });

  if (!isObject(spec)) {
    return { ok: false, issues: [{ path: "", message: "Form spec must be an object." }] };
  }
  const s = spec as unknown as FormSpec;

  if (s.v !== 1) add("v", `Unsupported spec version ${JSON.stringify(s.v)}; expected 1.`, "Set v: 1.");
  if (typeof s.title !== "string" || !s.title.trim())
    add("title", "`title` is required and must be a non-empty string.");

  const hasFields = Array.isArray(s.fields) && s.fields.length > 0;
  const hasSteps = Array.isArray(s.steps) && s.steps.length > 0;
  if (!hasFields && !hasSteps)
    add("fields", "Provide `fields` (single-step) or `steps` (multi-step).");
  if (hasFields && hasSteps) add("steps", "Provide `fields` or `steps`, not both.");

  const ids = new Set<string>();
  toSteps(s).forEach((step, si) => {
    const base = hasSteps ? `steps[${si}].fields` : "fields";
    if (!Array.isArray(step?.fields) || step.fields.length === 0) {
      add(base, "Each step needs at least one field.");
      return;
    }
    step.fields.forEach((f, fi) => validateField(f, `${base}[${fi}]`, ids, add));
  });

  // `when` references must resolve to a real field id.
  for (const f of allFields(s)) {
    if (isObject(f) && (f as Field).when) {
      for (const ref of conditionFields((f as Field).when!)) {
        if (!ids.has(ref))
          add(`${(f as Field).id ?? "?"}.when`, `Condition references unknown field id "${ref}".`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

function validateField(
  f: unknown,
  path: string,
  ids: Set<string>,
  add: (p: string, m: string, h?: string) => void,
): void {
  if (!isObject(f)) {
    add(path, "Field must be an object.");
    return;
  }
  const id = f.id;
  if (typeof id !== "string" || !id.trim())
    add(`${path}.id`, "`id` is required (it becomes the result key).");
  else if (ids.has(id)) add(`${path}.id`, `Duplicate field id "${id}".`);
  else ids.add(id);

  const type = f.type;
  if (typeof type !== "string" || !TYPE_SET.has(type)) {
    const t = String(type);
    add(
      `${path}.type`,
      `Unknown field type "${t}".`,
      NEAR[t] ? `Did you mean "${NEAR[t]}"?` : `Valid types: ${FIELD_TYPES.join(", ")}.`,
    );
    return;
  }

  if (type === "info") {
    if (typeof f.text !== "string") add(`${path}.text`, "An `info` field requires `text`.");
    return;
  }

  if (typeof f.label !== "string" || !f.label.trim())
    add(`${path}.label`, "`label` is required.");

  if (CHOICE_TYPES.has(type as Field["type"])) {
    const opts = f.options;
    if (!Array.isArray(opts) || opts.length === 0)
      add(`${path}.options`, `A "${type}" field requires a non-empty \`options\` array.`);
  }
}

/** Option values for a choice field (empty for non-choice). */
function optionValues(f: Field): Set<string> {
  return "options" in f && Array.isArray(f.options)
    ? new Set(f.options.map(optionValue))
    : new Set();
}

export function validateResult(spec: FormSpec, raw: unknown): ResultCheck {
  const issues: Issue[] = [];
  const values: FormValues = isObject(raw) ? (raw as FormValues) : {};

  // Resolve visibility first — a hidden field is neither required nor returned.
  const visible = new Set<string>();
  for (const f of allFields(spec)) {
    if (!f.when || evalCondition(f.when, values)) visible.add(f.id);
  }

  const cleaned: FormValues = {};
  for (const f of allFields(spec)) {
    if (f.type === "info" || !visible.has(f.id)) continue;

    const v = values[f.id];
    const empty =
      v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

    if (empty) {
      if (f.required) issues.push({ path: f.id, message: `"${f.label}" is required.` });
      continue;
    }

    switch (f.type) {
      case "number":
      case "slider": {
        const n = typeof v === "number" ? v : Number(v);
        if (Number.isNaN(n)) {
          issues.push({ path: f.id, message: `"${f.label}" must be a number.` });
          continue;
        }
        if (f.min !== undefined && n < f.min)
          issues.push({ path: f.id, message: `"${f.label}" must be ≥ ${f.min}.` });
        if (f.max !== undefined && n > f.max)
          issues.push({ path: f.id, message: `"${f.label}" must be ≤ ${f.max}.` });
        cleaned[f.id] = n;
        break;
      }
      case "boolean":
        cleaned[f.id] = Boolean(v);
        break;
      case "select":
      case "radio": {
        const allowed = optionValues(f);
        if (!allowed.has(String(v)))
          issues.push({ path: f.id, message: `"${String(v)}" is not an option for "${f.label}".` });
        else cleaned[f.id] = String(v);
        break;
      }
      case "multiselect": {
        const arr = Array.isArray(v) ? v.map(String) : [String(v)];
        const allowed = optionValues(f);
        const bad = arr.filter((x) => !allowed.has(x));
        if (bad.length)
          issues.push({ path: f.id, message: `Not valid options for "${f.label}": ${bad.join(", ")}.` });
        else if (f.min !== undefined && arr.length < f.min)
          issues.push({ path: f.id, message: `Select at least ${f.min} for "${f.label}".` });
        else if (f.max !== undefined && arr.length > f.max)
          issues.push({ path: f.id, message: `Select at most ${f.max} for "${f.label}".` });
        else cleaned[f.id] = arr;
        break;
      }
      default:
        cleaned[f.id] = String(v);
    }
  }

  return { ok: issues.length === 0, issues, cleaned };
}
