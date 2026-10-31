// ============================================================
// SolarOps AI — Serverless OpenAI Proxy (Vercel / Node.js)
// Endpoint: POST /api/ai-proxy
//
// Security:
// - OPENAI_API_KEY is read strictly from process.env (server-side).
// - NEVER exposed to browser clients or prefixed with VITE_.
// ============================================================

import type { IncomingMessage, ServerResponse } from "http";

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

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end("ok");
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error:
          "OPENAI_API_KEY is not configured on the server. Please set OPENAI_API_KEY in your environment variables.",
      }),
    );
    return;
  }

  // Parse body if not pre-parsed by framework
  let body: any = req.body;
  if (!body) {
    let rawBody = "";
    for await (const chunk of req) {
      rawBody += chunk;
      if (rawBody.length > 50000) {
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload too large" }));
        return;
      }
    }
    try {
      body = JSON.parse(rawBody);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }
  }

  const messages: { role: string; content: string }[] = [];

  if (typeof body.prompt === "string" && body.prompt.trim()) {
    const sys = typeof body.system === "string" && body.system.trim() ? body.system.trim() : DEFAULT_SYSTEM_PROMPT;
    messages.push({ role: "system", content: sys });
    messages.push({ role: "user", content: body.prompt.trim() });
  } else if (body.task) {
    const p = body.payload ?? {};
    if (body.task === "raw_chat") {
      const sys = typeof p.system === "string" && p.system.trim() ? p.system.trim() : DEFAULT_SYSTEM_PROMPT;
      messages.push({ role: "system", content: sys });
      if (Array.isArray(p.history)) {
        p.history.slice(-6).forEach((h: any) => {
          if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string") {
            messages.push({ role: h.role, content: h.content.slice(0, 1000) });
          }
        });
      }
      const userMsg = typeof p.message === "string" ? p.message.trim() : "";
      if (!userMsg) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Missing message in payload" }));
        return;
      }
      messages.push({ role: "user", content: userMsg });
    } else {
      messages.push({ role: "system", content: DEFAULT_SYSTEM_PROMPT });
      messages.push({ role: "user", content: JSON.stringify(p) });
    }
  } else if (Array.isArray(body.messages) && body.messages.length > 0) {
    body.messages.forEach((m: any) => {
      if (m && typeof m.content === "string") {
        messages.push({
          role: m.role === "system" || m.role === "assistant" ? m.role : "user",
          content: m.content.slice(0, 2000),
        });
      }
    });
  } else {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid request format" }));
    return;
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const openAiRes = await fetch(OPENAI_URL, {
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

    if (!openAiRes.ok) {
      const errDetail = await openAiRes.text();
      res.statusCode = openAiRes.status === 401 || openAiRes.status === 429 ? 502 : openAiRes.status;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error:
            openAiRes.status === 401
              ? "Invalid OpenAI API Key"
              : openAiRes.status === 429
              ? "OpenAI rate limit or credit quota exceeded"
              : `OpenAI error (${openAiRes.status})`,
          detail: errDetail,
        }),
      );
      return;
    }

    const data = (await openAiRes.json()) as any;
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ text }));
  } catch (err: any) {
    res.statusCode = err.name === "AbortError" ? 504 : 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: err.name === "AbortError" ? "OpenAI request timed out after 15s" : `Proxy error: ${err.message}`,
      }),
    );
  }
}
