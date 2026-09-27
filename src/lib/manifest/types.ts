export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type TemplateValue = JsonValue | { $input: string };

export type InputDefinition = {
  id: string;
  label: string;
  description?: string;
  component: "text" | "textarea" | "number" | "boolean" | "select" | "json";
  valueType: "string" | "number" | "boolean" | "json";
  required: boolean;
  placeholder?: string;
  defaultValue?: JsonValue;
  options?: { label: string; value: JsonValue }[];
  constraints?: { minLength?: number; maxLength?: number; minimum?: number; maximum?: number };
};

type QuestionBase = { instructions: JsonValue };
export type Question =
  | (QuestionBase & { type: "noul"; criteria?: { true?: JsonValue; false?: JsonValue } })
  | (QuestionBase & { type: "choice"; criteria: Record<string, JsonValue> })
  | (QuestionBase & { type: "score"; criteria: JsonValue[] });

export type WeightedSource = {
  questionId: string;
  weight: number;
  transform: "score_percent" | "noul_percent" | "inverse_noul_percent";
};
export type WeightedMetric = {
  id: string;
  label: string;
  scale: number;
  precision?: number;
  sources: WeightedSource[];
};
export type Postprocess =
  | { kind: "none" }
  | { kind: "weighted_score"; metrics: WeightedMetric[] }
  | { kind: "jsonlogic"; outputs: { id: string; label: string; expression: JsonValue }[] };

export type Manifest = {
  schemaVersion: "1.0";
  version?: number;
  metadata: {
    name: string; slug: string; description: string; category: string; tags: string[]; language: string;
  };
  runtime: { provider: "typesafe"; model: string; timeoutMs?: number; maxRetries?: number };
  inputs: InputDefinition[];
  stateTemplate: TemplateValue;
  questions: Record<string, Question>;
  postprocess?: Postprocess;
  resultView: { showRaw: boolean; showProbabilities: boolean; showConfidence: boolean; order: string[] };
  examples?: { name: string; inputs: Record<string, JsonValue>; notes?: string }[];
};
