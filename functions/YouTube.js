export async function onRequestGet(context) {
  const apiKey = context.env.YOUTUBE_API_KEY;

  const url = new URL(context.request.url);
  const query = url.searchParams.get("q");

  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query parameter 'q'" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const apiUrl =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&maxResults=5` +
    `&q=${encodeURIComponent(query)}` +
    `&key=${apiKey}`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}
