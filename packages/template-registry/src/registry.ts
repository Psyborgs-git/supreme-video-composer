import type { CalculateMetadataFunction } from "remotion";
import type { TemplateManifest } from "@studio/shared-types";

export interface RegisteredTemplate {
  manifest: TemplateManifest;
  component: React.FC<any>;
  calculateMetadata?: CalculateMetadataFunction<any>;
}

const registry = new Map<string, RegisteredTemplate>();

export function registerTemplate(template: RegisteredTemplate): void {
  if (registry.has(template.manifest.id)) {
    throw new Error(`Template "${template.manifest.id}" is already registered`);
  }
  registry.set(template.manifest.id, template);
}

export function getTemplate(id: string): RegisteredTemplate | undefined {
  return registry.get(id);
}

export function getAllTemplates(): RegisteredTemplate[] {
  return Array.from(registry.values());
}

export function getTemplateManifests(): TemplateManifest[] {
  return getAllTemplates().map((t) => t.manifest);
}

export function validateInputProps(
  templateId: string,
  props: Record<string, unknown>,
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  const template = registry.get(templateId);
  if (!template) {
    return { success: false, error: `Template "${templateId}" not found` };
  }
  const result = template.manifest.propsSchema.safeParse(props);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.data as Record<string, unknown> };
}

export function deleteTemplate(id: string): boolean {
  return registry.delete(id);
}

export function updateTemplateManifest(
  id: string,
  updates: Partial<Pick<TemplateManifest, "name" | "description" | "category" | "tags">>,
): boolean {
  const template = registry.get(id);
  if (!template) return false;
  registry.set(id, {
    ...template,
    manifest: { ...template.manifest, ...updates },
  });
  return true;
}

