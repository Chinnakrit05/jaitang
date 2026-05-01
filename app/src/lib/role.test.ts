import { describe, expect, it } from "vitest";
import { assertOwner, assertWritable } from "./role";

describe("assertOwner", () => {
  it("allows owner", () => {
    expect(() => assertOwner("owner")).not.toThrow();
  });

  it("blocks editor", () => {
    expect(() => assertOwner("editor")).toThrow();
  });

  it("blocks viewer", () => {
    expect(() => assertOwner("viewer")).toThrow();
  });
});

describe("assertWritable", () => {
  it("allows owner", () => {
    expect(() => assertWritable("owner")).not.toThrow();
  });

  it("allows editor", () => {
    expect(() => assertWritable("editor")).not.toThrow();
  });

  it("blocks viewer", () => {
    expect(() => assertWritable("viewer")).toThrow();
  });
});
