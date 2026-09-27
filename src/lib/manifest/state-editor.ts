import type { InputDefinition, TemplateValue } from "./types";

export function automaticStateTemplate(inputs: InputDefinition[], singleTextAsObject = false): TemplateValue {
  if (inputs.length === 0) return "";
  if (inputs.length === 1 && inputs[0].valueType === "string" && !singleTextAsObject) return { $input: inputs[0].id };
  return Object.fromEntries(inputs.map((input) => [input.id, { $input: input.id }]));
}

export function automaticArrayStateTemplate(inputs: InputDefinition[]): TemplateValue {
  return inputs.map((input) => ({ $input: input.id }));
}

export function isAutomaticStateTemplate(template: TemplateValue, inputs: InputDefinition[]): boolean {
  if (inputs.length === 0) return template === "" || (typeof template === "object" && template !== null && Object.keys(template).length === 0);
  if (Array.isArray(template)) return template.length === inputs.length && inputs.every((input, index) => {
    const value = template[index];
    return typeof value === "object" && value !== null && !Array.isArray(value)
      && Object.keys(value).length === 1 && value.$input === input.id;
  });
  if (inputs.length === 1 && typeof template === "object" && template !== null && !Array.isArray(template)) {
    if (Object.keys(template).length === 1 && template.$input === inputs[0].id) return true;
  }
  if (typeof template !== "object" || template === null || Array.isArray(template)) return false;
  const fields = template as Record<string, TemplateValue>;
  return Object.keys(fields).length === inputs.length && inputs.every((input) => {
    const value = fields[input.id];
    return typeof value === "object" && value !== null && !Array.isArray(value)
      && Object.keys(value).length === 1 && value.$input === input.id;
  });
}

export function formatStateEditor(value: TemplateValue): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function readStateEditor(text: string, template: TemplateValue): TemplateValue {
  return typeof template === "string" ? text : JSON.parse(text) as TemplateValue;
}
