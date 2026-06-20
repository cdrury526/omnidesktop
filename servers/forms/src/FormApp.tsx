/**
 * The generic form. Given a DSL spec (from the host via `ontoolinput`) it
 * renders the fields, evaluates `when` visibility live, walks multi-step
 * wizards locally, validates with the shared `@omni/forms-dsl` validator, and
 * on submit pushes the cleaned values to the host via `updateModelContext`.
 * The host treats that submit-marked update as the resolution of the paused
 * tool call.
 */
import type { App } from "@modelcontextprotocol/ext-apps";
import type { Field, FormSpec, FormValues, Issue } from "@omni/forms-dsl";
import { evalCondition, FORM_SUBMIT_KEY, toSteps, validateResult } from "@omni/forms-dsl";
import { useMemo, useState } from "react";
import { FieldRenderer } from "./FieldRenderer";

function visibleFields(fields: Field[], values: FormValues): Field[] {
  return fields.filter((f) => !f.when || evalCondition(f.when, values));
}

function defaults(spec: FormSpec): FormValues {
  const out: FormValues = {};
  for (const step of toSteps(spec)) {
    for (const f of step.fields) {
      if (f.type !== "info" && "default" in f && f.default !== undefined) {
        out[f.id] = f.default as FormValues[string];
      }
    }
  }
  return out;
}

export function FormApp({ app, spec }: { app: App; spec: FormSpec }) {
  const steps = useMemo(() => toSteps(spec), [spec]);
  const [values, setValues] = useState<FormValues>(() => defaults(spec));
  const [stepIdx, setStepIdx] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const shown = visibleFields(step.fields, values);

  const set = (id: string, v: FormValues[string]) =>
    setValues((prev) => ({ ...prev, [id]: v }));

  /** Required check for the currently-visible fields of this step. */
  function localIssues(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of shown) {
      if (f.type === "info" || !f.required) continue;
      const v = values[f.id];
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (empty) out[f.id] = `"${f.label}" is required.`;
    }
    return out;
  }

  function next() {
    const issues = localIssues();
    if (Object.keys(issues).length) return setErrors(issues);
    setErrors({});
    setStepIdx((i) => i + 1);
  }

  function back() {
    setErrors({});
    setStepIdx((i) => Math.max(0, i - 1));
  }

  async function submit() {
    const check = validateResult(spec, values);
    if (!check.ok) {
      setErrors(asMap(check.issues));
      // Jump to the first step containing an error so it's visible.
      const bad = check.issues[0]?.path;
      const idx = steps.findIndex((s) => s.fields.some((f) => f.id === bad));
      if (idx >= 0) setStepIdx(idx);
      return;
    }
    setErrors({});
    await app.updateModelContext({
      structuredContent: { [FORM_SUBMIT_KEY]: true, values: check.cleaned },
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="formapp">
        <div className="done">✓ Submitted. You can return to the conversation.</div>
      </main>
    );
  }

  return (
    <main className="formapp">
      <header>
        <h3>{spec.title}</h3>
        {spec.description && <p className="lede">{spec.description}</p>}
        {steps.length > 1 && (
          <div className="steps">
            Step {stepIdx + 1} of {steps.length}
            {step.title ? ` · ${step.title}` : ""}
          </div>
        )}
      </header>

      <div className="fields">
        {shown.map((f) => (
          <FieldRenderer
            key={f.id}
            field={f}
            value={values[f.id]}
            error={errors[f.id]}
            onChange={(v) => set(f.id, v)}
          />
        ))}
      </div>

      <footer>
        {stepIdx > 0 && (
          <button type="button" className="ghost" onClick={back}>
            Back
          </button>
        )}
        {isLast ? (
          <button type="button" className="primary" onClick={submit}>
            {spec.submitLabel ?? "Submit"}
          </button>
        ) : (
          <button type="button" className="primary" onClick={next}>
            Next
          </button>
        )}
      </footer>
    </main>
  );
}

function asMap(issues: Issue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) if (!out[i.path]) out[i.path] = i.message;
  return out;
}
