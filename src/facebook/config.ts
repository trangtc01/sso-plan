export interface FacebookConfig {
  pageAccessToken: string;
  pageId?: string;
  graphVersion: string;
}

export function loadFacebookConfig(env = process.env): FacebookConfig {
  return {
    pageAccessToken: required(env.FB_PAGE_ACCESS_TOKEN, "FB_PAGE_ACCESS_TOKEN"),
    pageId: env.FB_PAGE_ID?.trim() || undefined,
    graphVersion: normalizeGraphVersion(env.FB_GRAPH_VERSION ?? "v25.0"),
  };
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function normalizeGraphVersion(value: string): string {
  const normalized = value.trim();
  if (!/^v\d+\.\d+$/.test(normalized)) {
    throw new Error("FB_GRAPH_VERSION must look like v25.0");
  }
  return normalized;
}
