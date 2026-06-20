/**
 * Renders one DSL field as a native input. This is the ONE place field types
 * turn into UI — adding a type to `@omni/forms-dsl` means adding a case here.
 * Native elements (not a component lib) keep the single-file sandbox bundle
 * small; theming comes from the host's CSS variables (see global.css).
 */
import type { Field, FormValue, Option } from "@omni/forms-dsl";
import { optionLabel, optionValue } from "@omni/forms-dsl";

interface Props {
  field: Field;
  value: FormValue;
  error?: string;
  onChange: (value: FormValue) => void;
}

export function FieldRenderer({ field, value, error, onChange }: Props) {
  if (field.type === "info") {
    return <p className="info" id={field.id}>{field.text}</p>;
  }

  const id = `f_${field.id}`;
  return (
    <div className={`field${error ? " field-error" : ""}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="req"> *</span>}
      </label>
      {field.help && <div className="help">{field.help}</div>}
      <Control field={field} id={id} value={value} onChange={onChange} />
      {error && <div className="err">{error}</div>}
    </div>
  );
}

function Control({
  field,
  id,
  value,
  onChange,
}: {
  field: Exclude<Field, { type: "info" }>;
  id: string;
  value: FormValue;
  onChange: (v: FormValue) => void;
}) {
  switch (field.type) {
    case "text":
    case "email":
    case "url":
    case "secret":
      return (
        <input
          id={id}
          type={field.type === "secret" ? "password" : field.type === "text" ? "text" : field.type}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          maxLength={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <textarea
          id={id}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          maxLength={field.max}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <input
          id={id}
          type="number"
          value={value === undefined || value === null ? "" : (value as number)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );

    case "slider": {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const v = typeof value === "number" ? value : min;
      return (
        <div className="slider">
          <input
            id={id}
            type="range"
            value={v}
            min={min}
            max={max}
            step={field.step ?? 1}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <output>{v}</output>
        </div>
      );
    }

    case "boolean":
      return (
        <label className="switch">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.placeholder ?? (value ? "Yes" : "No")}</span>
        </label>
      );

    case "select":
      return (
        <select
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {field.options.map((o) => (
            <option key={optionValue(o)} value={optionValue(o)}>
              {optionLabel(o)}
            </option>
          ))}
        </select>
      );

    case "radio":
      return (
        <div className="radio-group" role="radiogroup" aria-labelledby={id}>
          {field.options.map((o) => (
            <label key={optionValue(o)} className="radio">
              <input
                type="radio"
                name={id}
                value={optionValue(o)}
                checked={value === optionValue(o)}
                onChange={() => onChange(optionValue(o))}
              />
              <span>{optionLabel(o)}</span>
              {optionDesc(o) && <small>{optionDesc(o)}</small>}
            </label>
          ))}
        </div>
      );

    case "multiselect": {
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      const toggle = (val: string, on: boolean) => {
        const next = new Set(selected);
        if (on) next.add(val);
        else next.delete(val);
        onChange([...next]);
      };
      return (
        <div className="checkbox-group">
          {field.options.map((o) => (
            <label key={optionValue(o)} className="checkbox">
              <input
                type="checkbox"
                checked={selected.has(optionValue(o))}
                onChange={(e) => toggle(optionValue(o), e.target.checked)}
              />
              <span>{optionLabel(o)}</span>
              {optionDesc(o) && <small>{optionDesc(o)}</small>}
            </label>
          ))}
        </div>
      );
    }

    case "date":
    case "time":
    case "datetime":
      return (
        <input
          id={id}
          type={field.type === "datetime" ? "datetime-local" : field.type}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
  }
}

function optionDesc(o: Option): string | undefined {
  return typeof o === "string" ? undefined : o.description;
}
