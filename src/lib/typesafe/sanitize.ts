const sensitiveName = /^(?:authorization|x-typesafe-api-key|api[_-]?key|typesafe[_-]?api[_-]?key)$/i;

export function redactSecrets(value: unknown, knownSecrets: readonly string[] = []): unknown {
  if (typeof value === "string") {
    return knownSecrets.filter(Boolean).reduce((text, secret) => text.replaceAll(secret, "[REDACTED]"), value);
  }
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, knownSecrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
      key, sensitiveName.test(key) ? "[REDACTED]" : redactSecrets(nested, knownSecrets),
    ]));
  }
  return value;
}
