/**
 * The agent-facing contract, as a Zod v4 schema. It becomes the MCP tool's
 * `inputSchema`: the MCP SDK serializes it to JSON Schema for the client, which
 * is how a tool-calling model learns the whole form DSL each session — no
 * separate "skill" needed. Field objects are `looseObject` so unknown/future
 * keys survive the round-trip rather than being silently stripped. The runtime
 * `validateSpec` is the real gate; this schema (plus the rich description)
 * guides the model.
 */
import { z } from "zod";
import { FIELD_TYPES } from "./fields";
import { DSL_VERSION } from "./version";

export const REQUEST_INPUT_TOOL = "request_user_input";

export const REQUEST_INPUT_DESCRIPTION = `Render an interactive form for the user and return their answers as structured data. Prefer this over asking for structured input in prose — you get back typed JSON keyed by field id.

A spec is { v: 1, title, fields } for a single page, or { v: 1, title, steps: [{ title?, fields }] } for a multi-step wizard (the user navigates steps locally; you get one combined result).

Each field: { id, type, label, required?, help?, placeholder?, default?, when? }.
Field types and their extra props:
- text | textarea | email | url | secret — optional min/max (length), pattern (regex)
- number | slider — optional min, max, step
- select | radio — require options: string[] or { value, label?, description? }[]
- multiselect — require options; optional min/max (selection count); result is string[]
- boolean — a switch; result is true/false
- date | time | datetime — result is an ISO string
- info — display-only markdown via text; collects no value

Conditional fields: add when to show a field only if a condition holds, e.g.
  when: { field: "plan", eq: "enterprise" }
Operators: { field, eq } | { field, ne } | { field, in: [...] } | { field, contains } (multiselect) | { field, truthy: true }; compose with { all: [...] }, { any: [...] }, { not: ... }.

The result is an object of { [fieldId]: value }; hidden (when=false) fields are omitted.`;

const option = z.union([
  z.string(),
  z.object({
    value: z.string(),
    label: z.string().optional(),
    description: z.string().optional(),
  }),
]);

// looseObject: the per-type extras (and any future props) pass through untouched.
const field = z.looseObject({
  id: z.string().describe("Result key. Unique across the whole form."),
  type: z.enum(FIELD_TYPES).describe("Field type."),
  label: z.string().optional().describe("Human-facing label (required except for `info`)."),
  required: z.boolean().optional(),
  help: z.string().optional().describe("Helper text under the field."),
  placeholder: z.string().optional(),
  options: z.array(option).optional().describe("For select/radio/multiselect."),
  default: z.unknown().optional().describe("Pre-filled value."),
  min: z.number().optional().describe("Min length / value / selections."),
  max: z.number().optional().describe("Max length / value / selections."),
  step: z.number().optional().describe("Step for number/slider."),
  pattern: z.string().optional().describe("Regex the value must match (text types)."),
  text: z.string().optional().describe("Markdown body for an `info` field."),
  when: z.unknown().optional().describe("Conditional visibility — see tool description."),
});

const step = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(field),
});

/** The Zod schema used as the `request_user_input` tool's `inputSchema`. */
export function requestInputSchema() {
  return z.object({
    v: z.literal(DSL_VERSION).describe("DSL version. Always 1."),
    title: z.string().describe("Form title shown to the user."),
    description: z.string().optional().describe("Optional intro text under the title."),
    submitLabel: z.string().optional().describe('Submit button label (default "Submit").'),
    fields: z.array(field).optional().describe("Single-step form fields. Use this OR steps."),
    steps: z.array(step).optional().describe("Multi-step wizard. Use this OR fields."),
  });
}
