function stripJsonFence(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function tryParseJson(value: string): unknown | undefined {
  const candidate = stripJsonFence(value);
  if (!candidate.startsWith("{") && !candidate.startsWith("[")) return undefined;
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

function extractJsonStringField(value: string): { key: string; value: string } | undefined {
  const candidate = stripJsonFence(value);
  for (const key of ["reply", "message", "result", "body"]) {
    const match = new RegExp(`"${key}"\\s*:\\s*"`).exec(candidate);
    if (!match) continue;

    const quoteStart = match.index + match[0].length - 1;
    let escaped = false;
    for (let index = quoteStart + 1; index < candidate.length; index += 1) {
      const character = candidate[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character !== '"') continue;

      try {
        return { key, value: JSON.parse(candidate.slice(quoteStart, index + 1)) };
      } catch {
        break;
      }
    }
  }
  return undefined;
}

/** Unwraps JSON that an AI model has returned inside a reply/message/body field. */
export function unwrapAiResponseEnvelope(input: unknown): unknown {
  let current = input;

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current === "string") {
      const parsed = tryParseJson(current);
      if (parsed === undefined) {
        const recovered = extractJsonStringField(current);
        return recovered ? { [recovered.key]: recovered.value } : current;
      }
      current = parsed;
      continue;
    }

    if (!current || typeof current !== "object" || Array.isArray(current)) return current;
    const record = current as Record<string, unknown>;
    const nestedKey = ["reply", "message", "result", "body"].find(
      (key) => typeof record[key] === "string" && tryParseJson(record[key] as string) !== undefined,
    );
    if (!nestedKey) return current;

    const parsed = tryParseJson(record[nestedKey] as string);
    current =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? { ...record, ...(parsed as Record<string, unknown>) }
        : parsed;
  }

  return current;
}

export function extractAiResponseText(input: unknown, fallback: string) {
  const unwrapped = unwrapAiResponseEnvelope(input);
  if (typeof unwrapped === "string") return unwrapped;
  if (!unwrapped || typeof unwrapped !== "object" || Array.isArray(unwrapped)) return fallback;
  const record = unwrapped as Record<string, unknown>;
  const value = record.reply ?? record.message ?? record.result ?? record.body;
  return typeof value === "string" && value.trim() ? value : fallback;
}
