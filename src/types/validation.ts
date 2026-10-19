export type ValidationStatus = "pass" | "fail" | "unchecked";

export interface ValidationRecord {
  check: string;
  path: string;
  status: ValidationStatus;
  detail: string;
}
