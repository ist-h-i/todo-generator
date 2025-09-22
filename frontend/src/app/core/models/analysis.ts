/**
 * Request payload captured from the analyze form.
 */
export interface AnalysisRequest extends Record<string, unknown> {
  readonly notes: string;
  readonly objective: string;
  readonly autoObjective: boolean;
}

/**
 * Proposed metadata generated from the AI analysis gateway.
 */
export interface AnalysisProposal {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly suggestedStatusId: string;
  readonly suggestedLabelIds: readonly string[];
  readonly subtasks: readonly string[];
  readonly confidence: number;
  readonly templateId?: string | null;
}

/**
 * Response returned from the analysis gateway.
 */
export interface AnalysisResult {
  readonly proposals: readonly AnalysisProposal[];
}
