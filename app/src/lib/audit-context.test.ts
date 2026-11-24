import { describe, expect, it } from "vitest";
import {
  auditHeaders,
  openAuditScope,
  runAsNewRequest,
  setAuditVia,
} from "./audit-context";

/** Shaped like requireSession(): opens the scope before its first
 *  await, learns the user after it. */
async function fakeRequireSession(userId: string) {
  const scope = openAuditScope();
  await new Promise((r) => setTimeout(r, 1));
  scope.actor = userId;
  return { userId };
}

/** What lib/ does: reads the headers somewhere further down, later. */
async function writeSomething() {
  await Promise.resolve();
  return auditHeaders();
}

describe("audit scope", () => {
  it("is empty outside any request", async () => {
    expect(await runAsNewRequest(writeSomething)).toEqual({});
  });

  it("reaches the action that awaited requireSession, and what it calls", async () => {
    const headers = await runAsNewRequest(async () => {
      await fakeRequireSession("user-a");
      setAuditVia("reports");
      return writeSomething();
    });
    expect(headers).toEqual({ "x-jaitang-actor": "user-a", "x-jaitang-via": "reports" });
  });

  it("keeps the via when something deeper calls requireSession again", async () => {
    const headers = await runAsNewRequest(async () => {
      await fakeRequireSession("user-a");
      setAuditVia("scan");
      await fakeRequireSession("user-a");
      return writeSomething();
    });
    expect(headers).toEqual({ "x-jaitang-actor": "user-a", "x-jaitang-via": "scan" });
  });

  it("doesn't let two requests at once see each other's user", async () => {
    const request = (user: string, via: "form" | "reports", delay: number) =>
      runAsNewRequest(async () => {
        await fakeRequireSession(user);
        setAuditVia(via);
        await new Promise((r) => setTimeout(r, delay));
        return writeSomething();
      });
    const [a, b] = await Promise.all([
      request("user-a", "form", 5),
      request("user-b", "reports", 1),
    ]);
    expect(a).toEqual({ "x-jaitang-actor": "user-a", "x-jaitang-via": "form" });
    expect(b).toEqual({ "x-jaitang-actor": "user-b", "x-jaitang-via": "reports" });
  });

  it("names the screen even before the user is known", async () => {
    const headers = await runAsNewRequest(async () => {
      await Promise.resolve();
      setAuditVia("import");
      return writeSomething();
    });
    expect(headers).toEqual({ "x-jaitang-via": "import" });
  });
});
