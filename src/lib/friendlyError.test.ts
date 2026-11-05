import { describe, it, expect } from "vitest";
import { friendlyError } from "@/lib/friendlyError";

describe("friendlyError", () => {
  it("maps a unique-violation code to plain English", () => {
    expect(friendlyError({ code: "23505", message: 'duplicate key value violates unique constraint "flight_options_pkey"' }, "Failed to save"))
      .toBe("That already exists — check for a duplicate.");
  });

  it("maps a foreign-key-violation code to plain English", () => {
    expect(friendlyError({ code: "23503", message: "update or delete on table violates foreign key constraint" }, "Failed to delete"))
      .toBe("That's linked to other records, so this can't be done right now.");
  });

  it("maps an RLS permission-denied code to plain English", () => {
    expect(friendlyError({ code: "42501", message: "new row violates row-level security policy for table \"flights\"" }, "Failed to save"))
      .toBe("You don't have permission to do that.");
  });

  it("falls back for a raw Postgres message with no mapped code", () => {
    expect(friendlyError(new Error('relation "foo" does not exist'), "Failed to load data"))
      .toBe("Failed to load data");
  });

  it("falls back for a raw JWT/session message", () => {
    expect(friendlyError(new Error("JWT expired"), "Failed to save")).toBe("Failed to save");
  });

  it("treats a network failure as unreachable, not a generic fallback", () => {
    expect(friendlyError(new TypeError("Failed to fetch"), "Failed to save"))
      .toBe("Couldn't reach the server — check your connection and try again.");
  });

  it("passes through a hand-written validation message unchanged", () => {
    expect(friendlyError(new Error("Mohammad is listed twice for the exact same day shift on 2026-11-04"), "Failed to save"))
      .toBe("Mohammad is listed twice for the exact same day shift on 2026-11-04");
  });

  it("uses the fallback when there is no error at all", () => {
    expect(friendlyError(undefined, "Failed to save")).toBe("Failed to save");
  });
});
