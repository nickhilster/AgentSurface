export interface ExperienceHandoffRequest {
  entityId: string;
  canonicalUrl: string;
  preferredPresentation: "current-agent-app";
  context: Record<string, string>;
}

export type ExperienceHandoffStatus =
  | "opened-in-current-app"
  | "opened-in-companion-app"
  | "opened-externally"
  | "unsupported"
  | "denied"
  | "failed";

export interface ExperienceHandoffResult {
  status: ExperienceHandoffStatus;
  openedUrl?: string;
  fallbackUrl?: string;
  message?: string;
}

export interface HostAdapter {
  openExperience(request: ExperienceHandoffRequest): Promise<ExperienceHandoffResult>;
}

export interface PendingHandoffRequest {
  status: "pending";
  request: ExperienceHandoffRequest;
}
