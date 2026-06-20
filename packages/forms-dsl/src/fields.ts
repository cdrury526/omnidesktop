/**
 * The form DSL — the single source of truth for the language.
 *
 * Everything else derives from this file: the agent-facing tool schema
 * (`schema.ts`), the validators (`validate.ts`), and the App's renderer
 * (`FieldRenderer` in the forms server) all switch over `FieldType`. To add a
 * field type you touch exactly two places: the union here, and one case in the
 * renderer. The schema and validators pick it up automatically.
 */
import type { Condition } from "./condition";
import type { DslVersion } from "./version";

export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "url",
  "secret",
  "number",
  "slider",
  "select",
  "radio",
  "multiselect",
  "boolean",
  "date",
  "time",
  "datetime",
  "info",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** A choice. Bare string = value is its own label; object form adds a label/description. */
export type Option = string | { value: string; label?: string; description?: string };

interface FieldBase {
  /** Result key. Required, unique across the whole form. */
  id: string;
  /** Human-facing label. */
  label: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
  /** Show this field only when the condition holds. */
  when?: Condition;
}

export interface TextField extends FieldBase {
  type: "text" | "textarea" | "email" | "url" | "secret";
  default?: string;
  /** Min / max length. */
  min?: number;
  max?: number;
  /** Regex the value must match. */
  pattern?: string;
}

export interface NumberField extends FieldBase {
  type: "number" | "slider";
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface ChoiceField extends FieldBase {
  type: "select" | "radio";
  options: Option[];
  default?: string;
}

export interface MultiChoiceField extends FieldBase {
  type: "multiselect";
  options: Option[];
  default?: string[];
  /** Min / max number of selections. */
  min?: number;
  max?: number;
}

export interface BooleanField extends FieldBase {
  type: "boolean";
  default?: boolean;
}

export interface DateField extends FieldBase {
  type: "date" | "time" | "datetime";
  default?: string;
}

/** Display-only. Collects no value; renders markdown text. May be conditional. */
export interface InfoField {
  type: "info";
  id: string;
  text: string;
  when?: Condition;
}

export type Field =
  | TextField
  | NumberField
  | ChoiceField
  | MultiChoiceField
  | BooleanField
  | DateField
  | InfoField;

export interface FormStep {
  title?: string;
  description?: string;
  fields: Field[];
}

export interface FormSpec {
  v: DslVersion;
  title: string;
  description?: string;
  submitLabel?: string;
  /** Single-step form. Provide this OR `steps`, not both. */
  fields?: Field[];
  /** Multi-step wizard. The App handles step navigation locally. */
  steps?: FormStep[];
}

/** The values a submitted form yields, keyed by field id. */
export type { FormValues } from "./condition";

export function optionValue(o: Option): string {
  return typeof o === "string" ? o : o.value;
}
export function optionLabel(o: Option): string {
  return typeof o === "string" ? o : o.label ?? o.value;
}

/** Choice-bearing field types (have `options`). */
export const CHOICE_TYPES = new Set<FieldType>(["select", "radio", "multiselect"]);

/** `info` fields are display-only; every other field contributes a result value. */
export function isInputField(f: Field): f is Exclude<Field, InfoField> {
  return f.type !== "info";
}
