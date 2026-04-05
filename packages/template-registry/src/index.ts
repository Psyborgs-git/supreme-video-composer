export {
  registerTemplate,
  getTemplate,
  getAllTemplates,
  getTemplateManifests,
  validateInputProps,
  deleteTemplate,
  updateTemplateManifest,
} from "./registry";
export type { RegisteredTemplate } from "./registry";

// Side-effect: registers all built-in templates
import "./templates";
