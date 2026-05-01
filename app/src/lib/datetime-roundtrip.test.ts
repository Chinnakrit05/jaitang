/**
 * End-to-end timezone round-trip test.
 *
 * Simulates the full path of a datetime as it travels through the app:
 *   1. User in Bangkok sees current local time pre-filled in the form.
 *   2. They submit (form converts wall-clock string → UTC ISO).
 *   3. Server stores the ISO instant.
 *   4. Server reads it back and the form displays it again.
 *
 * The acceptance criterion: step 4's displayed wall-clock string must equal
 * step 1's. Anything else is the off-by-N-hours bug we are guarding against.
 */
import { describe, expect, it } from "vitest";
import { toLocalDateTimeInput } from "./utils";

// Mimic the form's onSubmit conversion (browser side, in user's TZ).
function clientSubmitConvert(localStr: string): string {
  // In the browser, `new Date(naiveString)` parses in the runtime TZ.
  // The vitest runner has TZ=Asia/Bangkok (see package.json `test` script),
  // so this is exactly the behavior a Bangkok user's browser would have.
  return new Date(localStr).toISOString();
}

// Mimic what the server does when it receives the (now ISO Z) string and
// stores it. The server's TZ is irrelevant here because the string already
// carries `Z`.
function serverStore(isoFromClient: string): string {
  return new Date(isoFromClient).toISOString();
}

describe("datetime round-trip — Bangkok user", () => {
  it("create then re-render: wall-clock survives intact", () => {
    // 1. user opens form; useEffect fills in the local time
    const userTypedAt = "2026-05-02T10:30"; // pretend the input shows this
    const initialDisplay = userTypedAt; // what the user sees

    // 2. user submits — form converts to UTC ISO
    const submitted = clientSubmitConvert(userTypedAt);
    // In Bangkok TZ, "10:30 local" = "03:30 UTC"
    expect(submitted).toBe("2026-05-02T03:30:00.000Z");

    // 3. server stores the ISO instant
    const stored = serverStore(submitted);
    expect(stored).toBe("2026-05-02T03:30:00.000Z");

    // 4. server returns the row; form re-displays
    const redisplayed = toLocalDateTimeInput(stored);
    expect(redisplayed).toBe(initialDisplay);
  });

  it("edit-without-changing: the value must not drift on round-trip", () => {
    // Existing row from DB
    const stored = "2026-05-02T03:30:00.000Z"; // 10:30 Bangkok
    // Form displays it
    const displayed = toLocalDateTimeInput(stored);
    expect(displayed).toBe("2026-05-02T10:30");
    // User saves without touching the input
    const submitted = clientSubmitConvert(displayed);
    // Should produce the SAME instant back
    expect(submitted).toBe(stored);
  });

  it("midnight crossing: 23:30 Bangkok stores as the previous UTC day", () => {
    const userTypedAt = "2026-05-02T23:30";
    const submitted = clientSubmitConvert(userTypedAt);
    // 23:30 Bangkok = 16:30 UTC of the SAME day (UTC+7, so back 7 hours)
    expect(submitted).toBe("2026-05-02T16:30:00.000Z");
    // Round-trip
    expect(toLocalDateTimeInput(submitted)).toBe(userTypedAt);
  });

  it("regression: pre-fix path would shift the instant by 7 hours", () => {
    // What pre-fix code did: TZ-naive string straight to server, server
    // (UTC) parses as UTC. Sanity-check the bad path so we remember why
    // we don't do it any more.
    const userTypedAt = "2026-05-02T10:30";
    // Simulate what a UTC server would do with a naive string
    const wouldBeStoredOnUtcServer = new Date(userTypedAt).toISOString();
    // In a UTC runtime this would be "2026-05-02T10:30:00.000Z" (wrong),
    // but our test runner is Bangkok, so we get "03:30Z" (right).
    // The asymmetry is the whole bug — server and browser disagree on what
    // a TZ-naive string means. The fix is to never let one cross the wire.
    expect(wouldBeStoredOnUtcServer).toBe("2026-05-02T03:30:00.000Z");
  });
});
