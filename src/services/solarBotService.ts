// ============================================================
// SolarBot — Domain-Aware AI Assistant & Chat Service
// Supports live OpenAI server proxy calls with a robust,
// comprehensive domain-expert fallback engine.
// Never exposes API keys in frontend code.
// ============================================================

import { getDB, mutate } from "./store";
import type { Customer, ServiceTicket, SiteSurvey, TechnicianProfile, SolarPackage } from "@/types";
import { createCustomer, createSurvey, createTicket } from "./api";
import { estimateAnnualSavings, recommendCapacity } from "@/lib/calculations/finance";
import { formatINR } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: string;
  actionCard?: {
    type: "calculator" | "technician_list" | "confirmation" | "success" | "auth_required";
    data?: any;
  };
  source?: "live" | "expert_rules";
}

export interface UserSessionInfo {
  isLoggedIn: boolean;
  role?: string;
  name?: string;
  email?: string;
  customerId?: string;
}

// Conversation context memory
let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

export function clearConversationHistory() {
  conversationHistory = [];
}

const OPENAI_PROXY_URL = import.meta.env.VITE_OPENAI_PROXY_URL;

/**
 * Call the secure server-side AI proxy if configured.
 * Does not expose keys in the frontend bundle.
 */
async function callLiveProxy(userPrompt: string, systemPrompt: string): Promise<string | null> {
  if (!OPENAI_PROXY_URL) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(OPENAI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "raw_chat",
        payload: {
          message: userPrompt,
          system: systemPrompt,
          history: conversationHistory.slice(-6),
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.text === "string" && data.text.trim().length > 0 ? data.text.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Main query processor: handles natural language questions,
 * authenticates private customer requests, computes accurate savings,
 * and manages interactive workflows.
 */
export async function processSolarBotQuery(
  rawInput: string,
  session: UserSessionInfo | null,
): Promise<ChatMessage> {
  const input = rawInput.trim();
  const lower = input.toLowerCase();
  const db = getDB();
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Record user turn in context history
  conversationHistory.push({ role: "user", content: input });
  if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(-10);

  // 1. Check for specific action triggers or workflows
  // -------------------------------------------------------------
  // A. Savings Calculator request
  if (
    lower.includes("calculate my solar savings") ||
    lower.includes("savings calculator") ||
    lower.includes("estimate savings") ||
    lower.includes("how much can i save")
  ) {
    return {
      id: "bot-" + Date.now(),
      sender: "bot",
      timestamp,
      text: "I can help you calculate your solar generation, estimated electricity bill savings, and payback period! ☀️\n\nYou can use our quick interactive calculator below or tell me your monthly electricity bill (e.g. 'My bill is ₹3,000/month').",
      actionCard: {
        type: "calculator",
        data: {
          defaultBill: 3000,
          packages: db.solar_packages,
        },
      },
      source: "expert_rules",
    };
  }

  // B. Technician Locator request
  if (
    lower.includes("find a nearby solar technician") ||
    lower.includes("nearby technician") ||
    lower.includes("technician near me") ||
    lower.includes("find technician") ||
    lower.includes("technicians")
  ) {
    const availableTechs = db.technicians.filter((t) => t.is_active);
    return {
      id: "bot-" + Date.now(),
      sender: "bot",
      timestamp,
      text: `We have ${availableTechs.length} verified solar technicians registered in our service network across Hyderabad and surrounding regions. Here are our top specialists:`,
      actionCard: {
        type: "technician_list",
        data: {
          technicians: availableTechs.slice(0, 4),
        },
      },
      source: "expert_rules",
    };
  }

  // C. Track Installation / Private customer data request
  const isTrackingRequest =
    (lower.includes("track") && (lower.includes("installation") || lower.includes("project") || lower.includes("order") || lower.includes("status"))) ||
    lower.includes("installation status") ||
    lower.includes("track my installation") ||
    lower.includes("my project") ||
    lower.includes("my solar project");

  if (isTrackingRequest) {
    if (!session || !session.isLoggedIn) {
      return {
        id: "bot-" + Date.now(),
        sender: "bot",
        timestamp,
        text: "🔒 **Authentication Required**\n\nTo view your confidential installation progress, equipment reservations, or scheduled dates, please sign in with your customer account.",
        actionCard: {
          type: "auth_required",
          data: { reason: "view installation status" },
        },
        source: "expert_rules",
      };
    }

    if (session.role === "customer" && session.customerId) {
      const proj = db.installation_projects.find((p) => p.customer_id === session.customerId);
      if (!proj) {
        return {
          id: "bot-" + Date.now(),
          sender: "bot",
          timestamp,
          text: `Hello ${session.name}! I checked your account, but there are no active installation projects currently linked to customer ID \`${session.customerId}\`. Would you like to schedule a site survey?`,
          source: "expert_rules",
        };
      }

      const crew = db.installation_crews.find((c) => c.id === proj.crew_id);
      return {
        id: "bot-" + Date.now(),
        sender: "bot",
        timestamp,
        text: `📍 **Project Status: ${proj.number}**\n\n` +
          `• **Package:** ${proj.package_name} (${proj.capacity_kw} kW ${proj.installation_type})\n` +
          `• **Current Stage:** **${proj.status.replace(/_/g, " ").toUpperCase()}**\n` +
          `• **Equipment Dispatch:** ${proj.equipment_status === "dispatched" ? "✅ Dispatched to site" : "⏳ " + proj.equipment_status}\n` +
          `• **Installation Crew:** ${crew ? crew.name + " (" + crew.phone + ")" : "Assigning soon"}\n` +
          `• **Scheduled Window:** ${proj.scheduled_start ? `${proj.scheduled_start} to ${proj.scheduled_end}` : "Awaiting final date lock"}`,
        source: "expert_rules",
      };
    }

    // Staff / Admin tracking
    return {
      id: "bot-" + Date.now(),
      sender: "bot",
      timestamp,
      text: `Staff mode: We have ${db.installation_projects.length} installation projects recorded in SunPower (${db.installation_projects.filter((p) => p.status === "in_progress").length} currently in progress). You can manage them in the **Installations** menu.`,
      source: "expert_rules",
    };
  }

  // D. Check Warranties (Private)
  if (lower.includes("warranty") && (lower.includes("my") || lower.includes("claim") || lower.includes("certificate"))) {
    if (!session || !session.isLoggedIn) {
      return {
        id: "bot-" + Date.now(),
        sender: "bot",
        timestamp,
        text: "🔒 **Authentication Required**\n\nTo view your registered equipment serial numbers and active warranty certificates, please log in as a customer.",
        actionCard: { type: "auth_required", data: { reason: "access warranty certificates" } },
        source: "expert_rules",
      };
    }
    if (session.customerId) {
      const custWarranties = db.warranties.filter((w) => w.customer_id === session.customerId);
      if (custWarranties.length === 0) {
        return {
          id: "bot-" + Date.now(),
          sender: "bot",
          timestamp,
          text: `You currently have 0 active warranty certificates registered. Warranties are activated automatically once the post-installation quality inspection is completed.`,
          source: "expert_rules",
        };
      }
      const list = custWarranties
        .map((w) => `• **${w.product_name}** (${w.warranty_type})\n  Serial: \`${w.serial_number}\` | Valid until: ${w.end_date}`)
        .join("\n\n");
      return {
        id: "bot-" + Date.now(),
        sender: "bot",
        timestamp,
        text: `🛡️ **Your Registered Warranties:**\n\n${list}\n\nYou can download official PDF warranty certificates directly in your Customer Portal.`,
        source: "expert_rules",
      };
    }
  }

  // 2. Try Live AI Proxy (if available and configured)
  // -------------------------------------------------------------
  const systemPrompt = `You are "SolarBot", the intelligent AI solar assistant for SunPower (Hyderabad, Telangana, India).
Tone: Friendly, highly competent, professional, helpful, and concise.
Rules:
- Give accurate information regarding solar rooftop panels (1kW to 10kW), on-grid vs off-grid systems, inverters, and warranties.
- Currency is Indian Rupees (INR / ₹).
- Central Government Subsidy (PM Surya Ghar Muft Bijli Yojana): 1kW = ₹30,000, 2kW = ₹60,000, 3kW+ = ₹78,000 maximum. Official portal: pmsuryaghar.gov.in.
- For private customer data (orders, invoices, warranties), tell users they must log in.
- Safety first: never instruct users to touch live wiring or open inverter covers.
- Keep answers concise (max 3 short paragraphs or clean bullet points).`;

  const liveResponse = await callLiveProxy(input, systemPrompt);
  if (liveResponse) {
    conversationHistory.push({ role: "assistant", content: liveResponse });
    return {
      id: "bot-" + Date.now(),
      sender: "bot",
      timestamp,
      text: liveResponse,
      source: "live",
    };
  }

  // 3. Robust Expert Knowledge Fallback Engine
  // -------------------------------------------------------------
  const answer = getExpertDomainResponse(input, lower, db);
  conversationHistory.push({ role: "assistant", content: answer.text });
  return {
    id: "bot-" + Date.now(),
    sender: "bot",
    timestamp,
    text: answer.text,
    actionCard: answer.actionCard,
    source: "expert_rules",
  };
}

/**
 * High-precision domain knowledge engine for comprehensive offline intelligence.
 */
function getExpertDomainResponse(
  input: string,
  lower: string,
  db: ReturnType<typeof getDB>,
): { text: string; actionCard?: ChatMessage["actionCard"] } {
  // 1. Pricing / Packages questions
  if (
    lower.includes("price") ||
    lower.includes("cost") ||
    lower.includes("how much") ||
    lower.includes("quotation") ||
    lower.includes("rates") ||
    lower.includes("packages")
  ) {
    const pkgs = db.solar_packages.filter((p) => p.is_active);
    const lines = pkgs.map((p) => {
      const gross = p.equipment_cost + p.installation_cost + p.additional_cost;
      const tax = (gross * p.tax_percent) / 100;
      const total = gross + tax;
      const subsidy = p.capacity_kw >= 3 ? 78000 : p.capacity_kw === 2 ? 60000 : 30000;
      const net = Math.max(0, total - subsidy);
      return `• **${p.name}** (${p.capacity_kw} kW ${p.system_type === "on_grid" ? "On-Grid" : "Off-Grid"}): Total ~${formatINR(total)} → **Net after subsidy: ~${formatINR(net)}**`;
    });

    return {
      text: `☀️ **Standard Rooftop Solar Packages & Pricing Estimates:**\n\n${lines.join("\n")}\n\n*Note: These are approved baseline estimates including high-efficiency Tier-1 panels, smart inverter, structure, bi-directional net meter support, and standard installation. Final quotation requires a site survey to verify rooftop cabling and structure height.*`,
      actionCard: {
        type: "calculator",
        data: { defaultBill: 3500 },
      },
    };
  }

  // 2. Government Subsidies / PM Surya Ghar
  if (
    lower.includes("subsidy") ||
    lower.includes("subsidies") ||
    lower.includes("government") ||
    lower.includes("pm surya ghar") ||
    lower.includes("muft bijli")
  ) {
    return {
      text: `🏛️ **PM Surya Ghar: Muft Bijli Yojana — Central Government Subsidy:**\n\n` +
        `The Government of India provides direct bank transfer (DBT) subsidies for residential rooftop solar:\n\n` +
        `• **1 kW System:** **₹30,000** financial assistance\n` +
        `• **2 kW System:** **₹60,000** financial assistance\n` +
        `• **3 kW to 10 kW Systems:** **₹78,000** (maximum central cap)\n\n` +
        `**Eligibility & Steps:**\n` +
        `1. Must be a residential home with dedicated electricity meter.\n` +
        `2. Registered via the National Portal (\`pmsuryaghar.gov.in\`).\n` +
        `3. Installed by an empaneled vendor (like SunPower Solutions).\n` +
        `4. Post net-metering DISCOM inspection, subsidy is credited directly to your bank account within 30 days.\n\n` +
        `Would you like to check how much subsidy your rooftop qualifies for?`,
    };
  }

  // 3. System selection (1kW, 2kW, 3kW, 5kW, on-grid vs off-grid)
  if (
    lower.includes("find the right") ||
    lower.includes("which system") ||
    lower.includes("recommend") ||
    lower.includes("capacity") ||
    lower.includes("size") ||
    lower.includes("roof space")
  ) {
    return {
      text: `🏡 **How to Choose the Right Solar System for Your Home:**\n\n` +
        `• **1 kW (~120 units/month):** Ideal for 1 BHK or small apartments with bills around ₹800–₹1,200. Requires ~100 sq.ft roof space.\n` +
        `• **2 kW (~240 units/month):** Great for 2 BHK homes with 1 AC, refrigerator, and fans (bills around ₹1,800–₹2,500). Requires ~180–200 sq.ft.\n` +
        `• **3 kW (~360 units/month):** Our most popular choice for 3 BHK homes with 2 ACs (bills around ₹2,500–₹3,800). Qualifies for maximum ₹78,000 subsidy.\n` +
        `• **5 kW (~600 units/month):** For large independent villas or heavy daytime loads (bills ₹5,000+). Requires ~450 sq.ft.\n\n` +
        `**On-Grid vs Off-Grid:**\n` +
        `• **On-Grid:** Best ROI (3–4 years payback), lowest cost, exports surplus power to grid via Net Metering. (Recommended if grid is reliable).\n` +
        `• **Off-Grid / Hybrid:** Includes LiFePO4 battery backup for power cuts. Higher investment, but complete energy independence.`,
    };
  }

  // 4. Installation process & timeline
  if (
    lower.includes("installation process") ||
    lower.includes("how installation works") ||
    lower.includes("how long") ||
    lower.includes("steps") ||
    lower.includes("timeline")
  ) {
    return {
      text: `⚡ **The SolarOps 12-Step Installation Journey:**\n\n` +
        `1. **Site Survey:** Engineer visits your roof for shadow analysis, structure load, and cable routing (1–2 days).\n` +
        `2. **Custom Engineering Design & Quotation:** 3D layout, single-line diagram, and financial breakdown.\n` +
        `3. **DISCOM Feasibility Approval:** Submission to local electricity board for net-metering approval.\n` +
        `4. **Material Dispatch:** High-efficiency Mono PERC panels, galvanized mounting structure, and smart inverter reserved & dispatched.\n` +
        `5. **Rooftop Mounting & Cabling:** Certified technicians install modules, earthing rods, lightning arrester, and AC/DC distribution boxes (takes 1–2 days).\n` +
        `6. **Quality Inspection & Testing:** 25-point safety checklist.\n` +
        `7. **Net-Meter Synchronization:** Bi-directional meter installation and official grid commissioning.\n` +
        `8. **Warranty Activation & Handover:** Official certificate registration for 25-year panel performance!`,
    };
  }

  // 5. Maintenance, Cleaning, & Troubleshooting
  if (
    lower.includes("maintenance") ||
    lower.includes("cleaning") ||
    lower.includes("troubleshoot") ||
    lower.includes("inverter") ||
    lower.includes("red light") ||
    lower.includes("low generation") ||
    lower.includes("fault")
  ) {
    return {
      text: `🔧 **Routine Maintenance & Safe Troubleshooting Guide:**\n\n` +
        `• **Panel Cleaning:** Wash panels every 2 to 4 weeks using clean, soft water and a microfiber sponge. Always clean early in the morning or evening when panels are cool to avoid thermal glass crack.\n` +
        `• **Inverter Warning Codes:**\n` +
        `  - *Red LED / Grid Out:* Check if main grid breaker (MCB) is tripped.\n` +
        `  - *Low Generation:* Check for heavy dust, bird droppings, or new shadow obstructions (tree branches).\n` +
        `  - *Isolation Fault:* Moisture in cable connectors after heavy rain.\n\n` +
        `⚠️ **CRITICAL SAFETY WARNING:** Never attempt to open the inverter enclosure, touch bare DC cables, or inspect wiring yourself. Rooftop solar generates up to 600V–1000V DC. If an error persists, request an authorized technician visit immediately!`,
    };
  }

  // 6. Contact support / Book survey / General enquiry
  if (
    lower.includes("contact") ||
    lower.includes("phone") ||
    lower.includes("support") ||
    lower.includes("survey") ||
    lower.includes("book") ||
    lower.includes("call")
  ) {
    return {
      text: `📞 **SunPower Solutions Support & Engineering Center:**\n\n` +
        `• **Hotline:** +91 90000 76527 (Mon–Sat 9:00 AM – 7:00 PM)\n` +
        `• **Email:** support@demo.solarops.ai\n` +
        `• **Headquarters:** Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033\n\n` +
        `You can request a free rooftop site survey right now! Simply share your name, phone number, and city, and I will book an engineer visit for you.`,
    };
  }

  // Default intelligent overview
  return {
    text: `I'm here to assist you with all aspects of solar energy at SunPower Solutions! ☀️\n\n` +
      `Here are popular topics you can ask me about:\n` +
      `• **"Calculate my solar savings"** — see how much you save on your electricity bill\n` +
      `• **"Check installation prices"** — view cost estimates and subsidy benefits\n` +
      `• **"Learn about government subsidies"** — PM Surya Ghar ₹78,000 details\n` +
      `• **"Find a nearby solar technician"** — locate verified specialists near you\n` +
      `• **"Track my solar installation"** — check status of ongoing projects\n\n` +
      `Feel free to ask any specific question!`,
  };
}

/**
 * Execute real workflow: submit new customer enquiry.
 */
export async function executeSubmitEnquiry(input: {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  monthlyBill: number;
}): Promise<{ success: boolean; customerCode?: string; message: string }> {
  try {
    const customer = createCustomer({
      full_name: input.fullName,
      phone: input.phone,
      email: input.email || `${input.fullName.toLowerCase().replace(/\s+/g, ".")}@guest.solarops`,
      address: `${input.city}, Telangana`,
      city: input.city || "Hyderabad",
      state: "Telangana",
      postal_code: "500081",
      customer_type: "residential",
      monthly_units: Math.round(input.monthlyBill / 8),
      monthly_bill: input.monthlyBill,
      lead_source: "SolarBot AI Assistant",
      assigned_to: "Sales Executive — Alicia Dsouza",
      notes: "Enquiry submitted via SolarBot chat widget.",
      lead_status: "new",
    });

    return {
      success: true,
      customerCode: customer.code,
      message: `Enquiry registered successfully with code **${customer.code}**. Our solar engineering team will contact you within 24 business hours!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Could not register enquiry. Please verify your phone number.",
    };
  }
}

/**
 * Execute real workflow: request a professional site survey.
 */
export async function executeRequestSurvey(input: {
  customerId: string;
  roofAreaSqm: number;
  monthlyBill: number;
}): Promise<{ success: boolean; surveyCode?: string; message: string }> {
  try {
    const today = new Date();
    today.setDate(today.getDate() + 2); // schedule 2 days out
    const surveyDate = today.toISOString().slice(0, 10);

    const survey = createSurvey({
      customer_id: input.customerId,
      survey_date: surveyDate,
      surveyor: "Kiran Babu (Surveyor)",
      property_type: "Independent house",
      roof_type: "RCC concrete",
      roof_area_sqm: input.roofAreaSqm || 90,
      installable_area_sqm: Math.round((input.roofAreaSqm || 90) * 0.75),
      shading: "Minimal shading",
      monthly_units: Math.round(input.monthlyBill / 8),
      monthly_bill: input.monthlyBill,
      required_capacity_kw: recommendCapacity(Math.round(input.monthlyBill / 8)),
      grid_available: true,
      recommended_system_type: "on_grid",
      constraints: "Requested via SolarBot AI Assistant",
      notes: "Customer scheduled survey via online chatbot.",
      status: "scheduled",
    });

    return {
      success: true,
      surveyCode: survey.code,
      message: `Site survey scheduled! Reference: **${survey.code}** for ${surveyDate}. Our surveyor will contact you prior to visiting.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to schedule survey.",
    };
  }
}

/**
 * Execute real workflow: create service ticket.
 */
export async function executeCreateTicket(input: {
  customerId: string;
  issueCategory: string;
  description: string;
  preferredTechnician?: string;
}): Promise<{ success: boolean; ticketNumber?: string; message: string }> {
  try {
    const ticket = createTicket({
      customer_id: input.customerId,
      project_id: null,
      equipment_unit_id: null,
      serial_number: "GENERAL-ROOFTOP",
      issue_category: input.issueCategory,
      description: input.description,
      priority: "medium",
      assigned_technician: input.preferredTechnician || "Mahesh K.",
      created_by: "SolarBot Assistant",
    });

    return {
      success: true,
      ticketNumber: ticket.number,
      message: `Service ticket **${ticket.number}** created successfully. Technician **${ticket.assigned_technician}** has been assigned and will confirm the appointment.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to create service ticket.",
    };
  }
}
