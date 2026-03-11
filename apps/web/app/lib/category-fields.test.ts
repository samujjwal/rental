import { describe, it, expect } from "vitest";
import {
  getCategoryFields,
  groupCategoryFields,
  formatFieldValue,
  CATEGORY_FIELD_MAP,
  type CategoryField,
} from "~/lib/category-fields";

/* ═══════════ getCategoryFields ═══════════ */

describe("getCategoryFields", () => {
  it("returns vehicle fields for car slug", () => {
    const fields = getCategoryFields("car");
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.find((f) => f.key === "make")).toBeTruthy();
  });

  it("returns property fields for apartment slug", () => {
    const fields = getCategoryFields("apartment");
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.find((f) => f.key === "bedrooms" || f.key === "bathrooms")).toBeTruthy();
  });

  it("returns electronics fields for camera slug", () => {
    const fields = getCategoryFields("camera");
    expect(fields.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown slug", () => {
    expect(getCategoryFields("xyznonexistent")).toEqual([]);
  });

  it("returns empty array for null/undefined", () => {
    expect(getCategoryFields(null)).toEqual([]);
    expect(getCategoryFields(undefined)).toEqual([]);
    expect(getCategoryFields("")).toEqual([]);
  });

  it("is case-insensitive", () => {
    const a = getCategoryFields("CAR");
    const b = getCategoryFields("car");
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("performs partial / prefix matching", () => {
    // "camera-electronics" should match "camera" key or vice versa
    const fields = getCategoryFields("camera-electronics");
    expect(fields.length).toBeGreaterThan(0);
  });

  it("returns parking-space fields", () => {
    const fields = getCategoryFields("parking-space");
    expect(fields.find((f) => f.key === "parkingType")).toBeTruthy();
  });

  it("returns bike fields", () => {
    const fields = getCategoryFields("bike");
    expect(fields.length).toBeGreaterThan(0);
  });

  it("returns sports fields", () => {
    const fields = getCategoryFields("sports");
    expect(fields.length).toBeGreaterThan(0);
  });
});

/* ═══════════ CATEGORY_FIELD_MAP ═══════════ */

describe("CATEGORY_FIELD_MAP", () => {
  it("maps vehicles aliases to same array", () => {
    expect(CATEGORY_FIELD_MAP["car"]).toBe(CATEGORY_FIELD_MAP["truck"]);
    expect(CATEGORY_FIELD_MAP["car"]).toBe(CATEGORY_FIELD_MAP["van"]);
  });

  it("maps property aliases to same array", () => {
    expect(CATEGORY_FIELD_MAP["apartment"]).toBe(CATEGORY_FIELD_MAP["house"]);
  });

  it("has required fields for vehicles", () => {
    const required = CATEGORY_FIELD_MAP["car"].filter((f) => f.required);
    expect(required.length).toBeGreaterThanOrEqual(3); // make, model, year at minimum
  });
});

/* ═══════════ groupCategoryFields ═══════════ */

describe("groupCategoryFields", () => {
  it("groups fields by their group property", () => {
    const fields: CategoryField[] = [
      { key: "a", label: "A", type: "text", group: "Section 1" },
      { key: "b", label: "B", type: "number", group: "Section 1" },
      { key: "c", label: "C", type: "boolean", group: "Section 2" },
    ];
    const groups = groupCategoryFields(fields);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Section 1");
    expect(groups[0].fields).toHaveLength(2);
    expect(groups[1].label).toBe("Section 2");
    expect(groups[1].fields).toHaveLength(1);
  });

  it("defaults group label to Details when group is missing", () => {
    const fields: CategoryField[] = [
      { key: "x", label: "X", type: "text" },
    ];
    const groups = groupCategoryFields(fields);
    expect(groups[0].label).toBe("Details");
  });

  it("returns empty array for empty input", () => {
    expect(groupCategoryFields([])).toEqual([]);
  });

  it("groups real vehicle fields correctly", () => {
    const vehicleFields = getCategoryFields("car");
    const groups = groupCategoryFields(vehicleFields);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].label).toBeTruthy();
  });
});

/* ═══════════ formatFieldValue ═══════════ */

describe("formatFieldValue", () => {
  it("returns dash for null/undefined/empty", () => {
    const field: CategoryField = { key: "x", label: "X", type: "text" };
    expect(formatFieldValue(field, null)).toBe("\u2014");
    expect(formatFieldValue(field, undefined)).toBe("\u2014");
    expect(formatFieldValue(field, "")).toBe("\u2014");
  });

  it("formats boolean as Yes/No", () => {
    const field: CategoryField = { key: "x", label: "X", type: "boolean" };
    expect(formatFieldValue(field, true)).toBe("Yes");
    expect(formatFieldValue(field, false)).toBe("No");
  });

  it("resolves select option label", () => {
    const field: CategoryField = {
      key: "x",
      label: "X",
      type: "select",
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
      ],
    };
    expect(formatFieldValue(field, "a")).toBe("Alpha");
    expect(formatFieldValue(field, "b")).toBe("Beta");
  });

  it("falls back to raw value for unknown select option", () => {
    const field: CategoryField = {
      key: "x",
      label: "X",
      type: "select",
      options: [{ value: "a", label: "Alpha" }],
    };
    expect(formatFieldValue(field, "z")).toBe("z");
  });

  it("resolves multiselect labels", () => {
    const field: CategoryField = {
      key: "x",
      label: "X",
      type: "multiselect",
      options: [
        { value: "gps", label: "GPS" },
        { value: "bt", label: "Bluetooth" },
      ],
    };
    expect(formatFieldValue(field, ["gps", "bt"])).toBe("GPS, Bluetooth");
  });

  it("appends unit for number fields", () => {
    const field: CategoryField = { key: "area", label: "Area", type: "number", unit: "sq ft" };
    expect(formatFieldValue(field, 1500)).toBe("1500 sq ft");
  });

  it("returns stringified value for text fields", () => {
    const field: CategoryField = { key: "x", label: "X", type: "text" };
    expect(formatFieldValue(field, "hello")).toBe("hello");
    expect(formatFieldValue(field, 42)).toBe("42");
  });
});
