/**
 * Minimal JSON Schema -> Zod converter.
 *
 * MCP tools declare their inputs as JSON Schema, but the OpenRouter agent SDK's
 * `tool()` wants a Zod schema (so it can serialize proper parameters back to the
 * model). This covers the subset MCP tools actually use: object/string/number/
 * integer/boolean/array/enum, required vs optional, and descriptions.
 */
import { z } from "zod";

type JSONSchema = {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  description?: string;
};

function withDesc<T extends z.ZodTypeAny>(zt: T, schema: JSONSchema): z.ZodTypeAny {
  return schema.description ? zt.describe(schema.description) : zt;
}

export function jsonSchemaToZod(schema: JSONSchema | undefined): z.ZodTypeAny {
  if (!schema || typeof schema !== "object") return z.any();

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const literals = schema.enum.map((v) => z.literal(v as string | number | boolean));
    const zt =
      literals.length === 1
        ? literals[0]
        : z.union(literals as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
    return withDesc(zt, schema);
  }

  const t = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (t) {
    case "string":
      return withDesc(z.string(), schema);
    case "number":
      return withDesc(z.number(), schema);
    case "integer":
      return withDesc(z.number().int(), schema);
    case "boolean":
      return withDesc(z.boolean(), schema);
    case "array":
      return withDesc(z.array(schema.items ? jsonSchemaToZod(schema.items) : z.any()), schema);
    case "object":
      return objectToZod(schema);
    default:
      return schema.properties ? objectToZod(schema) : z.any();
  }
}

/** Always returns a Zod object — the top-level shape `tool()` requires. */
export function objectToZod(schema: JSONSchema | undefined): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, value] of Object.entries(props)) {
    const zt = jsonSchemaToZod(value);
    shape[key] = required.has(key) ? zt : zt.optional();
  }
  return z.object(shape);
}
