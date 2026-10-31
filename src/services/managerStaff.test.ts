import { describe, it, expect, beforeEach } from "vitest";
import { getDB, resetDemoDB } from "./store";
import {
  createTicket,
  directAssignTicketStaff,
  createTechnician,
  deleteTechnician,
  updateTechnicianLocation,
} from "./api";
import { DEMO_USERS, authenticate } from "./auth";

describe("Manager Staff Management & Direct Assignment", () => {
  beforeEach(() => {
    resetDemoDB();
  });

  it("simplifies demo users to strictly 3 roles: SuperAdmin, Staff, Customer", () => {
    expect(DEMO_USERS.length).toBe(3);
    const roles = DEMO_USERS.map((u) => u.role);
    expect(roles).toContain("superadmin");
    expect(roles).toContain("staff");
    expect(roles).toContain("customer");
  });

  it("authenticates manager as superadmin role", async () => {
    const session = await authenticate("admin@demo.solarops", "demo1234");
    expect(session.role).toBe("superadmin");
  });

  it("directly assigns staff to customer ticket without confirmation request", () => {
    const db = getDB();
    const custId = db.customers[0].id;

    // 1. Customer creates ticket awaiting manager assignment
    const ticket = createTicket({
      customer_id: custId,
      project_id: null,
      equipment_unit_id: null,
      serial_number: "",
      issue_category: "Inverter Fault",
      description: "Inverter blinking red LED since morning",
      priority: "high",
      assigned_technician: "",
      assignment_status: "awaiting_manager",
    });

    expect(ticket.status).toBe("open");
    expect(ticket.assignment_status).toBe("awaiting_manager");
    expect(ticket.assigned_technician).toBe("");

    // 2. Manager assigns staff directly
    directAssignTicketStaff(ticket.id, "Mahesh K.", "2026-11-05T10:00:00");

    const updated = db.service_tickets.find((t) => t.id === ticket.id);
    expect(updated).toBeDefined();
    expect(updated!.assigned_technician).toBe("Mahesh K.");
    expect(updated!.status).toBe("assigned");
    expect(updated!.assignment_status).toBe("assigned");
    expect(updated!.appointment_time).toBe("2026-11-05T10:00:00");
  });

  it("allows manager to add a new staff member", () => {
    const db = getDB();
    const initialCount = db.technicians.length;

    const newStaff = createTechnician({
      name: "Kavitha Sharma",
      phone: "+91 98450 12345",
      specializations: ["Inverter Specialist", "Grid-Tie Expert"],
      experience_years: 5,
      location_name: "Madhapur, Hyderabad",
      lat: 17.4485,
      lng: 78.3908,
      working_hours: "Mon–Sat 9:00–18:00",
    });

    expect(newStaff.id).toBeDefined();
    expect(newStaff.name).toBe("Kavitha Sharma");
    expect(db.technicians.length).toBe(initialCount + 1);

    const found = db.technicians.find((t) => t.id === newStaff.id);
    expect(found).toBeDefined();
    expect(found?.location_name).toBe("Madhapur, Hyderabad");
    expect(found?.lat).toBe(17.4485);
  });

  it("allows manager to update staff location coordinates and location name", () => {
    const db = getDB();
    const tech = db.technicians[0];

    updateTechnicianLocation(tech.id, 17.4401, 78.3450, "Gachibowli, Hyderabad");

    const updated = db.technicians.find((t) => t.id === tech.id);
    expect(updated?.location_name).toBe("Gachibowli, Hyderabad");
    expect(updated?.lat).toBe(17.4401);
    expect(updated?.lng).toBe(78.3450);
  });

  it("allows manager to remove staff and re-queues their open tickets", () => {
    const db = getDB();
    const tech = db.technicians[0];
    const techName = tech.name;

    // Create an open ticket assigned to this tech
    const ticket = createTicket({
      customer_id: db.customers[0].id,
      project_id: null,
      equipment_unit_id: null,
      serial_number: "",
      issue_category: "Performance Issue",
      description: "Low generation during noon hours",
      priority: "medium",
      assigned_technician: techName,
    });

    expect(ticket.assigned_technician).toBe(techName);

    // Manager removes staff
    deleteTechnician(tech.id);

    // Verify removed from technicians list
    const deleted = db.technicians.find((t) => t.id === tech.id);
    expect(deleted).toBeUndefined();

    // Verify ticket was returned to manager queue
    const updatedTicket = db.service_tickets.find((t) => t.id === ticket.id);
    expect(updatedTicket?.assigned_technician).toBe("");
    expect(updatedTicket?.status).toBe("open");
    expect(updatedTicket?.assignment_status).toBe("awaiting_manager");
  });
});
