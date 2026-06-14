// SEO Optimizer — public surface (a separate analyzer over saved HTML).
export { extractFacts, type PageFacts, type ImgFact, type LinkFact, type SizeLookup } from "./facts.ts";
export { RULES, auditPage, type AuditResult, type CategoryScore, type PageReport, type Category, type Status } from "./rules.ts";
