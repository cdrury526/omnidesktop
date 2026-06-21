/**
 * Renders one DSL field with Ant Design inputs. This is the ONE place field
 * types turn into UI — adding a type to `@omni/forms-dsl` means adding a case
 * here. The `.field` label/help/error wrapper is kept (the debug bridge's
 * layout probe and the multi-step validation in FormApp rely on it); only the
 * controls are antd. Theme comes from the host via ConfigProvider (mcp-app.tsx).
 *
 * Date/time fields keep the DSL contract of an ISO-ish string (validateResult
 * stringifies them): antd's dayjs values are converted to/from those strings.
 */
import {
  Input,
  InputNumber,
  Select,
  Radio,
  Checkbox,
  Switch,
  Slider,
  DatePicker,
  TimePicker,
} from "antd";
import dayjs from "dayjs";
import type { Field, FormValue, Option } from "@omni/forms-dsl";
import { optionLabel, optionValue } from "@omni/forms-dsl";

const DATE_FMT = "YYYY-MM-DD";
const TIME_FMT = "HH:mm";
const DATETIME_FMT = "YYYY-MM-DDTHH:mm";

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
      return (
        <Input
          id={id}
          type={field.type === "text" ? "text" : field.type}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          maxLength={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "secret":
      return (
        <Input.Password
          id={id}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          maxLength={field.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <Input.TextArea
          id={id}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          maxLength={field.max}
          autoSize={{ minRows: 3, maxRows: 8 }}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <InputNumber
          id={id}
          style={{ width: "100%" }}
          value={value === undefined || value === null ? null : (value as number)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(v) => onChange(v == null ? undefined : Number(v))}
        />
      );

    case "slider": {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const v = typeof value === "number" ? value : min;
      return (
        <Slider
          id={id}
          min={min}
          max={max}
          step={field.step ?? 1}
          value={v}
          onChange={(n) => onChange(Number(n))}
        />
      );
    }

    case "boolean":
      return (
        <Switch
          id={id}
          checked={Boolean(value)}
          checkedChildren={field.placeholder ?? "Yes"}
          unCheckedChildren="No"
          onChange={(checked) => onChange(checked)}
        />
      );

    case "select":
      return (
        <Select
          id={id}
          style={{ width: "100%" }}
          allowClear
          value={(value as string) || undefined}
          placeholder={field.placeholder ?? "Select…"}
          onChange={(v) => onChange(v || undefined)}
          options={field.options.map((o) => ({ value: optionValue(o), label: optionLabel(o) }))}
        />
      );

    case "radio":
      return (
        <Radio.Group
          id={id}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
        >
          <div className="radio-group">
            {field.options.map((o) => (
              <Radio key={optionValue(o)} value={optionValue(o)}>
                {optionLabel(o)}
                {optionDesc(o) && <small>{optionDesc(o)}</small>}
              </Radio>
            ))}
          </div>
        </Radio.Group>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Checkbox.Group
          value={selected}
          onChange={(vals) => onChange(vals as string[])}
        >
          <div className="checkbox-group">
            {field.options.map((o) => (
              <Checkbox key={optionValue(o)} value={optionValue(o)}>
                {optionLabel(o)}
                {optionDesc(o) && <small>{optionDesc(o)}</small>}
              </Checkbox>
            ))}
          </div>
        </Checkbox.Group>
      );
    }

    case "date": {
      const v = typeof value === "string" && value ? dayjs(value, DATE_FMT) : undefined;
      return (
        <DatePicker
          id={id}
          style={{ width: "100%" }}
          value={v && v.isValid() ? v : undefined}
          onChange={(d) => onChange(d ? d.format(DATE_FMT) : undefined)}
        />
      );
    }

    case "time": {
      const v = typeof value === "string" && value ? dayjs(value, TIME_FMT) : undefined;
      return (
        <TimePicker
          id={id}
          style={{ width: "100%" }}
          format={TIME_FMT}
          value={v && v.isValid() ? v : undefined}
          onChange={(d) => onChange(d ? d.format(TIME_FMT) : undefined)}
        />
      );
    }

    case "datetime": {
      const v = typeof value === "string" && value ? dayjs(value, DATETIME_FMT) : undefined;
      return (
        <DatePicker
          id={id}
          style={{ width: "100%" }}
          showTime={{ format: TIME_FMT }}
          format={DATETIME_FMT}
          value={v && v.isValid() ? v : undefined}
          onChange={(d) => onChange(d ? d.format(DATETIME_FMT) : undefined)}
        />
      );
    }
  }
}

function optionDesc(o: Option): string | undefined {
  return typeof o === "string" ? undefined : o.description;
}
