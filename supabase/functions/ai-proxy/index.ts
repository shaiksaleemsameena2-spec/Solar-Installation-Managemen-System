// ============================================================
// SolarOps AI — Server-Side OpenAI Proxy (Supabase Edge Function)
// Deploy:  supabase functions deploy ai-proxy --no-verify-jwt=false
// Secret:  supabase secrets set OPENAI_API_KEY=sk-...
//
// Security Rules:
// - The OpenAI API key NEVER reaches the client browser.
// - Server-side only: read via Deno.env.get("OPENAI_API_KEY").
// - Validates inputs, message length, and handles OpenAI errors.
// - AI NEVER calculates financial amounts; financial figures are
//   always produced by src/lib/calculations/finance.ts.
// ============================================================

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

const DEFAULT_SYSTEM_PROMPT = `You are "SolarBot", the intelligent AI solar assistant for SunPower Solutions and SolarOps AI (Hyderabad, Telangana, India).
Tone: Friendly, highly competent, professional, and concise.
Rules:
- Give accurate information regarding solar rooftop panels (1kW to 10kW), on-grid vs off-grid systems, inverters, and warranties.
- Currency is Indian Rupees (INR / ₹).
- Central Government Subsidy (PM Surya Ghar Muft Bijli Yojana): 1kW = ₹30,000, 2kW = ₹60,000, 3kW+ = ₹78,000 maximum. Official portal: pmsuryaghar.gov.in.
- For private customer data (orders, invoices, warranties), inform users they must log in.
- Safety first: never instruct users to touch live wiring or open inverter covers.
- Keep answers concise (max 3 short paragraphs or clean bullet points).`;

interface HistoryItem {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function handler(req: Request): Promise<Response> {
  // CORS Preflight
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
    return json({ error: "Method not allowed. Use POST." }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || apiKey.trim() === "") {
    return json(
      {
        error: "OPENAI_API_KEY is not configured on the server. Please set OPENAI_API_KEY in your Supabase secrets or server environment.",
      },
      503,
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Request body must be a valid JSON object" }, 400);
  }

  // Construct standard OpenAI messages array supporting all caller formats
  const messages: { role: string; content: string }[] = [];
  const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;

  // Format 1: Direct prompt & system (from src/lib/ai.ts)
  if (typeof body.prompt === "string" && body.prompt.trim()) {
    const sys = typeof body.system === "string" && body.system.trim() ? body.system.trim() : DEFAULT_SYSTEM_PROMPT;
    messages.push({ role: "system", content: sys });
    messages.push({ role: "user", content: body.prompt.trim() });
  }
  // Format 2: Task-based (from SolarOps legacy / raw_chat from SolarBot)
  else if (body.task) {
    const p = body.payload ?? {};
    if (body.task === "raw_chat") {
      const sys = typeof p.system === "string" && p.system.trim() ? p.system.trim() : DEFAULT_SYSTEM_PROMPT;
      messages.push({ role: "system", content: sys });

      // Add conversational history if present
      if (Array.isArray(p.history)) {
        p.history.slice(-6).forEach((h: HistoryItem) => {
          if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
            messages.push({ role: h.role, content: h.content.slice(0, 1000) });
          }
        });
      }

      const userMsg = typeof p.message === "string" ? p.message.trim() : "";
      if (!userMsg) return json({ error: "Missing message in payload" }, 400);
      messages.push({ role: "user", content: userMsg });
    } else {
      // Legacy tasks: quotation_summary, service_triage, insights
      messages.push({ role: "system", content: DEFAULT_SYSTEM_PROMPT });
      messages.push({ role: "user", content: buildLegacyTaskContent(body.task, p) });
    }
  }
  // Format 3: Direct messages array
  else if (Array.isArray(body.messages) && body.messages.length > 0) {
    body.messages.forEach((m: any) => {
      if (m && typeof m.content === "string") {
        messages.push({
          role: m.role === "system" || m.role === "assistant" ? m.role : "user",
          content: m.content.slice(0, 2000),
        });
      }
    });
  } else {
    return json(
      {
        error: "Invalid request format. Expected { prompt, system } or { task: 'raw_chat', payload: { message } } or { messages }.",
      },
      400,
    );
  }

  // Input length validation (prevent token abuse)
  const totalLength = messages.reduce((acc, m) => acc + m.content.length, 0);
  if (totalLength > 8000) {
    return json({ error: "Total input length exceeds safety threshold (8,000 characters)" }, 400);
  }

  // Call OpenAI Chat Completions API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 500,
        messages,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401) {
        return json({ error: "Invalid OpenAI API Key configured on server" }, 502);
      }
      if (res.status === 429) {
        return json({ error: "OpenAI rate limit or billing quota exceeded" }, 502);
      }
      const detail = await res.text();
      return json({ error: `OpenAI error (${res.status})`, detail }, 502);
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return json({ text });
  } catch (err: any) {
    if (err.name === "AbortError") {
      return json({ error: "OpenAI request timed out after 15 seconds" }, 504);
    }
    return json({ error: `Proxy failure: ${err.message || String(err)}` }, 502);
  }
}

function buildLegacyTaskContent(task: string, p: any): string {
  switch (task) {
    case "quotation_summary":
      return `Write a 4–6 line customer-friendly summary for this solar quotation. Describe scope and value plainly; do NOT compute any monetary figures yourself — the totals below are already computed by the finance engine.\nData: ${JSON.stringify(p, null, 1)}`;
    case "service_triage":
      return `Triage this solar service ticket. Suggest likely root cause, severity rationale, and next step for the technician in 3 short bullet points. Do NOT estimate any cost.\nData: ${JSON.stringify(p, null, 1)}`;
    case "insights":
      return `Write 3–5 business insights for a solar company based on this dataset snapshot. Reference only facts present in the data; never invent numbers.\nData: ${JSON.stringify(p, null, 1)}`;
    default:
      return String(p.message ?? "Say hello.");
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
