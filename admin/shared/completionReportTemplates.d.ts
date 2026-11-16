export interface CompletionReportTemplate {
  id: string; label: string; tasks: string[]; aftercare: string; exclusions: string;
}
export const COMPLETION_REPORT_TEMPLATES: CompletionReportTemplate[];
export function getCompletionReportTemplate(id: string): CompletionReportTemplate | undefined;
