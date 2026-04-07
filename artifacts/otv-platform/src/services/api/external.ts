export function externalPost(url: string, body: unknown): void {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export async function externalGet(url: string): Promise<Response | null> {
  return fetch(url).catch(() => null);
}
