const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

export interface PromptVersion {
  id: number;
  version_number: number;
  system_prompt: string;
  user_template: string;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface Prompt {
  id: number;
  name: string;
  description: string;
  version_count: number;
  latest_version: PromptVersion | null;
  created_at: string;
}

export interface PromptDetail extends Prompt {
  versions: PromptVersion[];
}

export const api = {
  prompts: {
    list: () => req<Prompt[]>('/prompts/'),
    get: (id: number) => req<PromptDetail>(`/prompts/${id}/`),
    create: (data: Partial<Prompt>) => req<Prompt>('/prompts/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Prompt>) =>
      req<Prompt>(`/prompts/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => req<void>(`/prompts/${id}/`, { method: 'DELETE' }),
    addVersion: (promptId: number, data: Partial<PromptVersion>) =>
      req<PromptVersion>(`/prompts/${promptId}/add_version/`, { method: 'POST', body: JSON.stringify(data) }),
    diff: (promptId: number, v1: number, v2: number) =>
      req<{ v1: PromptVersion; v2: PromptVersion }>(`/prompts/${promptId}/diff/${v1}/${v2}/`),
  },

  datasets: {
    list: () => req<Dataset[]>('/datasets/'),
    get: (id: number) => req<DatasetDetail>(`/datasets/${id}/`),
    create: (data: Partial<Dataset>) => req<Dataset>('/datasets/', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => req<void>(`/datasets/${id}/`, { method: 'DELETE' }),
    addTestCase: (datasetId: number, data: Partial<TestCase>) =>
      req<TestCase>(`/datasets/${datasetId}/test_cases/`, { method: 'POST', body: JSON.stringify(data) }),
    deleteTestCase: (id: number) => req<void>(`/datasets/test-cases/${id}/`, { method: 'DELETE' }),
  },

  evaluations: {
    list: () => req<Evaluation[]>('/evaluations/'),
    get: (id: number) => req<EvaluationDetail>(`/evaluations/${id}/`),
    create: (data: CreateEvaluationPayload) =>
      req<Evaluation>('/evaluations/', { method: 'POST', body: JSON.stringify(data) }),
    stats: () => req<Stats>('/evaluations/stats/'),
    results: (id: number) => req<EvaluationResult[]>(`/evaluations/${id}/results/`),
    autoImprove: (id: number) => req<AutoImproveResponse>(`/evaluations/${id}/auto_improve/`, { method: 'POST' }),
  },
};

// ─── Dataset types ────────────────────────────────────────────────────────────

export interface TestCase {
  id: number;
  input_variables: Record<string, string>;
  expected_output: string;
  tags: string;
  created_at: string;
}

export interface Dataset {
  id: number;
  name: string;
  description: string;
  test_case_count: number;
  created_at: string;
}

export interface DatasetDetail extends Dataset {
  test_cases: TestCase[];
}

// ─── Evaluation types ─────────────────────────────────────────────────────────

export interface Evaluation {
  id: number;
  name: string;
  prompt_version: number;
  prompt_version_label: string;
  dataset: number;
  dataset_name: string;
  model: string;
  judge_model: string;
  status: 'pending' | 'running' | 'done' | 'error';
  progress: number;
  total: number;
  summary: EvalSummary | null;
  avg_score: number | null;
  result_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface EvaluationDetail extends Evaluation {
  results: EvaluationResult[];
}

export interface ScoreDimension {
  score: number;
  reasoning: string;
}

export interface ScoreBreakdown {
  accuracy: ScoreDimension;
  helpfulness: ScoreDimension;
  logistics_expertise: ScoreDimension;
}

export interface AutoImproveSuggestion {
  analysis: string;
  improved_prompt: string;
  changes: string[];
}

export interface AutoImproveResponse {
  suggestion: AutoImproveSuggestion | null;
  message?: string;
  prompt_id?: number;
  user_template?: string;
  based_on?: { total_cases: number; failed_cases: number; avg_score: number };
}

export interface EvaluationResult {
  id: number;
  test_case: number;
  test_case_input: Record<string, string>;
  test_case_expected: string;
  actual_output: string;
  score: number | null;
  score_breakdown: ScoreBreakdown | null;
  judge_reasoning: string;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number;
  error: string;
  created_at: string;
}

export interface EvalSummary {
  avg_score: number | null;
  min_score: number | null;
  max_score: number | null;
  total_cases: number;
  scored_cases: number;
  errors: number;
  score_distribution: Record<string, number>;
  dimension_averages: Record<string, number>;
}

export interface Stats {
  total_prompts: number;
  total_datasets: number;
  total_evaluations: number;
  evaluations_done: number;
  evaluations_running: number;
  recent_evaluations: Evaluation[];
}

export interface CreateEvaluationPayload {
  name: string;
  prompt_version: number;
  dataset: number;
  model?: string;
  judge_model?: string;
}
