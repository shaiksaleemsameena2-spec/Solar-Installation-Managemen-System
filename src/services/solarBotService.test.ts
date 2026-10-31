import { describe, it, expect, beforeEach } from "vitest";
import { processSolarBotQuery, clearConversationHistory } from "./solarBotService";

describe("SolarBot AI Assistant Service", () => {
  beforeEach(() => {
    clearConversationHistory();
  });

  it("handles conversational savings calculator trigger", async () => {
    const res = await processSolarBotQuery("Calculate my solar savings", null);
    expect(res.sender).toBe("bot");
    expect(res.actionCard?.type).toBe("calculator");
    expect(res.text).toContain("calculate your solar generation");
  });

  it("provides verified technician list", async () => {
    const res = await processSolarBotQuery("Find a nearby solar technician", null);
    expect(res.sender).toBe("bot");
    expect(res.actionCard?.type).toBe("technician_list");
    expect(res.text).toContain("verified solar technicians");
  });

  it("requires authentication for guest inquiring about private installation status", async () => {
    const res = await processSolarBotQuery("Track my solar installation", null);
    expect(res.sender).toBe("bot");
    expect(res.actionCard?.type).toBe("auth_required");
    expect(res.text).toContain("Authentication Required");
  });

  it("answers government subsidy questions with PM Surya Ghar facts", async () => {
    const res = await processSolarBotQuery("Tell me about government subsidies", null);
    expect(res.sender).toBe("bot");
    expect(res.text).toContain("PM Surya Ghar");
    expect(res.text).toContain("₹78,000");
  });

  it("gives safety warning on maintenance & inverter issues", async () => {
    const res = await processSolarBotQuery("How do I troubleshoot an inverter red light?", null);
    expect(res.sender).toBe("bot");
    expect(res.text).toContain("SAFETY WARNING");
    expect(res.text).toContain("DC cables");
  });
});

