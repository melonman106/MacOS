// Cloudflare Pages Function: /youtube
// Relays a small allow-list of YouTube Data API v3 endpoints so the API key stays on the server.
//
//   /youtube?endpoint=videos&part=snippet&id=VIDEO_ID
//   /youtube?q=cats&max=20            (legacy form: a plain video search)
//
// Set YOUTUBE_API_KEY in Cloudflare Pages -> Settings -> Environment variables.

const ALLOWED = new Set([
  "search",
  "videos",
  "channels",
  "playlists",
  "playlistItems",
  "commentThreads",
  "comments",
  "videoCategories"
]);

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const json = (obj, status = 200, headers = {}) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json", ...headers }
    });

  // Only answer requests that come from this same site (when the browser says where they came from).
  const origin = request.headers.get("Origin") || request.headers.get("Referer");
  if (origin) {
    try {
      if (new URL(origin).host !== url.host) {
        return json({ error: { message: "Forbidden" } }, 403);
      }
    } catch (e) {
      /* ignore malformed header */
    }
  }

  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // proxyError tells the page to fall back instead of showing an API error
    return json({ proxyError: true, error: { message: "YOUTUBE_API_KEY is not set" } }, 500);
  }

  const params = new URLSearchParams(url.searchParams);
  let endpoint = params.get("endpoint");
  params.delete("endpoint");
  params.delete("key");

  if (!endpoint) {
    // legacy: /youtube?q=...&max=...
    const q = params.get("q");
    if (!q) return json({ error: { message: "Missing query" } }, 400);
    endpoint = "search";
    params.set("part", "snippet");
    params.set("type", "video");
    params.set("maxResults", params.get("max") || "20");
    params.delete("max");
  }

  if (!ALLOWED.has(endpoint)) {
    return json({ error: { message: "Endpoint not allowed" } }, 400);
  }

  params.set("key", apiKey);
  const upstream = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${params.toString()}`);
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json",
      // cache successful answers for 5 minutes to save API quota
      "Cache-Control": upstream.ok ? "public, max-age=300" : "no-store"
    }
  });
}
