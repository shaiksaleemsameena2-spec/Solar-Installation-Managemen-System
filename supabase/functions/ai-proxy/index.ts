// ============================================================
// SolarOps AI — server-side OpenAI proxy (Supabase Edge Function)
// Deploy:  supabase functions deploy ai-proxy --no-verify-jwt=false
// Secret:  supabase secrets set OPENAI_API_KEY=sk-...
//
// Purpose: the OpenAI key NEVER reaches the browser. The web app
// calls this function with VITE_OPENAI_PROXY_URL; without that
// variable the app runs its clearly-labeled rule-based fallback
// (src/lib/ai.ts). AI NEVER computes money — financial totals are
// always produced by src/lib/calculations/finance.ts.
// ============================================================

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Keep the model cheap & text-only; assistants here do short text work.
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are the text assistant inside "SolarOps AI", a solar installation
management system for SunPower Solutions (Hyderabad, India). You only produce short business text:
quotation summaries, service-ticket triage notes, and business insights.
HARD RULES:
- Never calculate monetary amounts, taxes, subsidies, or margins. If asked, restate the numbers
  the caller already provided — do not invent or compute any figure.
- Reply in the requested format, at most ~120 words.
- Currency context is INR (₹).
`;

interface ProxyRequest {
  task: "quotation_summary" | "service_triage" | "insights" | "raw_chat";
  payload: unknown;
}

export async function handler(req: Request): Promise<Response> {
  // CORS (the web app calls this cross-origin in dev)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey",
      },
    });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    // Honest failure: the client will fall back to the rule-based assistant.
    return json({ error: "OPENAI_API_KEY not configured on the server" }, 503);
  }

  let body: ProxyRequest;
  try {
    body = (await req.json()) as ProxyRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body || !("task" in body)) {
    return json({ error: "Missing 'task' field" }, 400);
  }

  const userContent = buildUserContent(body.task, body.payload);

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `OpenAI error ${res.status}`, detail }, 502);
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    return json({ text });
  } catch (e) {
    return json({ error: `Proxy failure: ${String(e)}` }, 502);
  }
}

// ---- helpers ------------------------------------------------

function buildUserContent(task: ProxyRequest["task"], payload: unknown): string {
  const p = payload ?? {};
  switch (task) {
    case "quotation_summary":
      return `Write a 4–6 line customer-friendly summary for this solar quotation. Describe scope and value plainly; do NOT compute any monetary figures yourself — the totals below are already computed by the finance engine.\nData: ${JSON.stringify(p, null, 1)}`;
    case "service_triage":
      return `Triage this solar service ticket. Suggest likely root cause, severity rationale, and next step for the technician in 3 short bullet points. Do NOT estimate any cost.\nData: ${JSON.stringify(p, null, 1)}`;
    case "insights":
      return `Write 3–5 business insights for a solar company based on this dataset snapshot. Reference only facts present in the data; never invent numbers.\nData: ${JSON.stringify(p, null, 1)}`;
    case "raw_chat":
    default:
      return String((p as { message?: string }).message ?? "Say hello.");
  }
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
