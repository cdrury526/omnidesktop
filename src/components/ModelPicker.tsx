import { Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { listModels, supportsTools, type ORModel } from "../agent/models";

export interface ModelPickerProps {
  value: string;
  onChange: (id: string) => void;
  /** Only show models that can call tools (required for auto-summon). */
  toolsOnly?: boolean;
}

export function ModelPicker({ value, onChange, toolsOnly = true }: ModelPickerProps) {
  const [models, setModels] = useState<ORModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listModels()
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(
    () =>
      models
        .filter((m) => !toolsOnly || supportsTools(m))
        .map((m) => ({
          value: m.id,
          label: m.name,
          search: `${m.name} ${m.id}`.toLowerCase(),
        })),
    [models, toolsOnly],
  );

  return (
    <Select
      showSearch
      loading={loading}
      value={value || undefined}
      onChange={onChange}
      placeholder={loading ? "Loading models…" : "Search 300+ models…"}
      style={{ width: 320 }}
      options={options}
      optionFilterProp="search"
      filterOption={(input, opt) =>
        ((opt?.search as string) ?? "").includes(input.toLowerCase())
      }
      notFoundContent={loading ? "Loading…" : "No tool-capable model matches"}
    />
  );
}
