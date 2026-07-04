// Cloudflare Pages Function — /api/chat
// Proxies chat requests to OpenRouter so the API key never reaches the browser.
//
// SETUP REQUIRED (do this before deploying):
// 1. Revoke the old exposed key at https://openrouter.ai/keys immediately.
// 2. Generate a NEW OpenRouter API key.
// 3. In the Cloudflare Pages dashboard: Settings → Environment variables →
//    add a secret named OPENROUTER_API_KEY with the new key value.
//    (Do this for both Production and Preview environments.)
// 4. Redeploy. Never put the key back in any .html/.js file that ships to the browser.

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: { message: 'Server is not configured: OPENROUTER_API_KEY is missing.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid JSON body.' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Only forward the fields we expect — don't let the client set arbitrary headers/models it shouldn't.
  const allowedModel = body.model || 'nvidia/nemotron-3-nano-30b-a3b:free';
  const payload = {
    model: allowedModel,
    messages: body.messages || [],
    max_tokens: Math.min(body.max_tokens || 4096, 8192),
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.7
  };

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: 'Upstream request failed: ' + err.message } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
