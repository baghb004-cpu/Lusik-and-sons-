// Tax Assistant — public surface (private, offline, legal self-filing).
export * from "./schemas.ts";
export { DOCUMENT_CHECKLIST, FORM_GUIDANCE, INTERVIEW, neededDocuments, likelyForms, type ChecklistItem, type FormGuidance, type InterviewQuestion } from "./checklist.ts";
export { rollupConfidence, sumCents, compareDeductions, standardDeductionCents, projectConfidence, type DeductionComparison } from "./engine.ts";
export { validateProject, type TaxWarning } from "./validate.ts";
export { buildPacket } from "./packet.ts";
export { encryptProject, decryptProject } from "./crypto.ts";
export { OFFICIAL_SOURCES, REQUIRED_FEDERAL_FIGURES, updateGuidanceFor, scaffoldRulePack, isPackReady, packReadiness, STATE_DIRECTORY_URL, COMMON_STATE_FIGURES, scaffoldStatePack, stateGuidanceFor, freeFileGuidance, printAndMailGuidance, type UpdateGuidance } from "./updater.ts";
