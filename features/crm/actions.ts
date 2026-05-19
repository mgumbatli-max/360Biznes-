// Backwards-compatible re-exports. New code should import directly from
// the modular files: leadler-actions, sablon-actions, broadcast-action, etc.

export {
  saveLead,
  changeLeadStage,
  loseLead,
  deleteLead,
  convertLeadToMusteri,
  convertLeadToSale,
  appendLeadNote,
  scheduleFollowup,
} from "./leadler-actions";

export { saveTemplate, deleteTemplate } from "./sablon-actions";
