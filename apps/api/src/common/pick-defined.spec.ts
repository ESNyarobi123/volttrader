import { pickDefined } from "./pick-defined";

describe("pickDefined", () => {
  it("keeps only the requested keys that are defined", () => {
    const input = { name: "Pro", subtitle: undefined, sortOrder: 0, published: false };
    expect(pickDefined(input, ["name", "subtitle", "sortOrder", "published"])).toEqual({
      name: "Pro",
      sortOrder: 0,
      published: false,
    });
  });

  it("keeps explicit nulls (a null patch clears a nullable column)", () => {
    expect(pickDefined({ phone: null }, ["phone"])).toEqual({ phone: null });
  });

  it("ignores keys that were not requested", () => {
    expect(pickDefined({ name: "Pro", featured: true }, ["featured"])).toEqual({ featured: true });
  });
});
