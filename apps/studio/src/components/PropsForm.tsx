import { useMemo } from "react";
import type { z } from "zod";

interface PropsFormProps {
  schema: z.ZodType;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Schema-driven form that introspects a Zod schema and generates
 * appropriate form fields for each property.
 */
export const PropsForm: React.FC<PropsFormProps> = ({ schema, values, onChange }) => {
  const fields = useMemo(() => extractFields(schema), [schema]);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-zinc-500 italic">No configurable properties for this template.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            {formatLabel(field.key)}
          </label>
          {renderField(field, values[field.key], (val) => onChange(field.key, val))}
        </div>
      ))}
    </div>
  );
};

// ─── Field extraction from Zod schema ────────────────────────────

interface FieldInfo {
  key: string;
  type: "string" | "number" | "boolean" | "color" | "array" | "object" | "enum" | "unknown";
  enumValues?: string[];
  defaultValue?: unknown;
}

function extractFields(schema: z.ZodType): FieldInfo[] {
  const fields: FieldInfo[] = [];
  const shape = getShape(schema);
  if (!shape) return fields;

  for (const [key, fieldSchema] of Object.entries(shape)) {
    const unwrapped = unwrapSchema(fieldSchema as z.ZodType);
    const type = inferType(key, unwrapped);
    const enumValues = getEnumValues(unwrapped);
    fields.push({ key, type, enumValues });
  }

  return fields;
}

function getShape(schema: z.ZodType): Record<string, z.ZodType> | null {
  const def = (schema as any)?._def;
  if (!def) return null;

  // ZodObject
  if (def.shape) return typeof def.shape === "function" ? def.shape() : def.shape;
  // ZodEffects (e.g. .refine, .transform)
  if (def.schema) return getShape(def.schema);
  return null;
}

function unwrapSchema(schema: z.ZodType): z.ZodType {
  const def = (schema as any)?._def;
  if (!def) return schema;
  // ZodDefault
  if (def.innerType) return unwrapSchema(def.innerType);
  // ZodOptional
  if (def.typeName === "ZodOptional" && def.innerType) return unwrapSchema(def.innerType);
  return schema;
}

function inferType(key: string, schema: z.ZodType): FieldInfo["type"] {
  const def = (schema as any)?._def;
  if (!def) return "unknown";

  const typeName: string = def.typeName || "";

  if (typeName === "ZodEnum" || typeName === "ZodNativeEnum") return "enum";
  if (typeName === "ZodBoolean") return "boolean";
  if (typeName === "ZodNumber") return "number";
  if (typeName === "ZodString") {
    // Detect color fields by key name
    if (/color|bg|background|accent/i.test(key)) return "color";
    return "string";
  }
  if (typeName === "ZodArray") return "array";
  if (typeName === "ZodObject") return "object";

  return "unknown";
}

function getEnumValues(schema: z.ZodType): string[] | undefined {
  const def = (schema as any)?._def;
  if (def?.typeName === "ZodEnum" && def.values) return def.values;
  return undefined;
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ─── Field rendering ─────────────────────────────────────────────

function renderField(
  field: FieldInfo,
  value: unknown,
  onChange: (value: unknown) => void,
): React.ReactNode {
  const inputClasses =
    "w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent";

  switch (field.type) {
    case "string":
      return (
        <input
          type="text"
          className={inputClasses}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <input
          type="number"
          className={inputClasses}
          value={(value as number) ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-blue-600"
            checked={(value as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm text-zinc-300">{value ? "Enabled" : "Disabled"}</span>
        </label>
      );

    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="w-10 h-10 rounded border border-zinc-700 cursor-pointer bg-transparent"
            value={(value as string) ?? "#000000"}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            className={inputClasses}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "enum":
      return (
        <select
          className={inputClasses}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.enumValues?.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      );

    case "array":
    case "object":
      return (
        <textarea
          className={`${inputClasses} min-h-[80px] font-mono text-xs`}
          value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // invalid JSON, ignore
            }
          }}
        />
      );

    default:
      return (
        <input
          type="text"
          className={inputClasses}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
