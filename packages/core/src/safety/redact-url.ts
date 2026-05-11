const SECRET_QUERY_KEYS = [
  "password",
  "pass",
  "pwd",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "secret",
  "client_secret",
  "auth"
];

function redactParsedUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    for (const key of [...parsed.searchParams.keys()]) {
      if (SECRET_QUERY_KEYS.includes(key.toLowerCase())) {
        parsed.searchParams.set(key, "***");
      }
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function redactDatabaseUrl(value: string | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (/^(postgres|postgresql):\/\//i.test(trimmed)) {
    const parsed = redactParsedUrl(trimmed);
    if (parsed) return parsed;
    return trimmed.replace(/\/\/([^/\s:@]+):([^@\s/]+)@/g, "//***:***@");
  }

  if (/^(file:|sqlite:)/i.test(trimmed)) {
    return trimmed;
  }

  return redactSecrets(trimmed);
}

export function redactSecrets(value: string): string {
  let output = value;
  output = output.replace(/\b(postgres(?:ql)?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi, "$1***:***@");
  output = output.replace(
    /([?&](?:password|pass|pwd|token|access_token|refresh_token|api_key|apikey|secret|client_secret|auth)=)[^&"',}\]\s]+/gi,
    "$1***"
  );
  output = output.replace(/\b(PGPASSWORD|PASSWORD|TOKEN|API_KEY|SECRET)=([^"',}\]\s]+)/gi, "$1=***");
  output = output.replace(
    /(["']?(?:password|pass|pwd|token|access_token|refresh_token|api_key|apikey|secret|client_secret|auth)["']?\s*:\s*["'])([^"',}\s]+)(["'])/gi,
    "$1***$3"
  );
  output = output.replace(/\b(password|token|secret|api[_-]?key)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=***");
  return output;
}
