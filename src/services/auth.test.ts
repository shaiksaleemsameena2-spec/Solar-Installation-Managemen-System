import { describe, it, expect, beforeEach } from "vitest";
import { registerAccount, authenticate, getRegisteredUsers, _resetAuthForTesting } from "./auth";

describe("SolarOps Database & Auth Integration", () => {
  beforeEach(() => {
    _resetAuthForTesting();
  });

  it("successfully creates a new customer account and establishes session", async () => {
    const session = await registerAccount({
      name: "Vikram Reddy",
      email: "vikram.reddy@test.com",
      password: "securepassword123",
      role: "customer",
      phone: "+91 91234 56789",
      city: "Hyderabad",
    });

    expect(session.name).toBe("Vikram Reddy");
    expect(session.email).toBe("vikram.reddy@test.com");
    expect(session.role).toBe("customer");
    expect(session.customerId).toBeDefined();

    // Verify persisted in user registry
    const registered = getRegisteredUsers();
    expect(registered.length).toBe(1);
    expect(registered[0].email).toBe("vikram.reddy@test.com");
  });

  it("prevents creating duplicate accounts with the same email", async () => {
    await registerAccount({
      name: "User One",
      email: "duplicate@test.com",
      password: "password123",
      role: "sales",
    });

    await expect(
      registerAccount({
        name: "User Two",
        email: "duplicate@test.com",
        password: "password456",
        role: "sales",
      }),
    ).rejects.toThrow("already exists");
  });

  it("authenticates newly registered accounts with correct password", async () => {
    await registerAccount({
      name: "Neha Gupta",
      email: "neha.gupta@test.com",
      password: "mysecretpassword",
      role: "installation",
    });

    // Valid password
    const session = await authenticate("neha.gupta@test.com", "mysecretpassword");
    expect(session.name).toBe("Neha Gupta");
    expect(session.role).toBe("installation");

    // Invalid password
    await expect(authenticate("neha.gupta@test.com", "wrongpassword")).rejects.toThrow("Incorrect password");
  });
});
