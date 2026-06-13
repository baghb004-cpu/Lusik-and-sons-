// Payroll / self-employment tax calculator — public surface (§27).
export {
  PAYROLL_SCENARIOS, payrollScenario, payrollFilingStatus, payInterval,
  ratePack, payrollInput,
  type PayrollScenario, type PayrollFilingStatus, type PayInterval,
  type RatePack, type PayrollInput, type PayrollResult, type PayrollLine,
} from "./schemas.ts";
export { computePayroll, ESTIMATED_TAX_DUE_DATES } from "./engine.ts";
export { PAYROLL_SOURCES, payrollUpdateGuidance, scaffoldRatePack, ratePackReadiness, type PayrollUpdateGuidance } from "./updater.ts";
