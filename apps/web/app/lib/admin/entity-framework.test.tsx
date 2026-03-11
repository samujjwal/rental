import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  entityRegistry,
  createEntityConfig,
  registerEntity,
  getEntityConfig,
  createIdColumn,
  createStatusColumn,
  createDateColumn,
  createActionsColumn,
  validateField,
  transformFormData,
} from "./entity-framework";
import type { EntityConfig, FieldConfig } from "./entity-framework";

// ─── Mock StatusBadge ────────────────────────────────────────────────────────
vi.mock("~/components/ui/StatusBadge", () => ({
  StatusBadge: ({
    label,
    color,
    size,
  }: {
    label: string;
    color: string;
    size: string;
  }) => (
    <span data-testid="status-badge" data-color={color} data-size={size}>
      {label}
    </span>
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface TestEntity {
  id: string;
  name: string;
  status: string;
  email: string;
  createdAt: string;
}

const sampleConfig: EntityConfig<TestEntity> = {
  name: "Test Entity",
  pluralName: "Test Entities",
  slug: "test-entities",
  icon: "Box",
  description: "Test description",
  api: {
    baseEndpoint: "/api/test-entities",
    listEndpoint: "/api/test-entities",
    createEndpoint: "/api/test-entities",
    updateEndpoint: (id) => `/api/test-entities/${id}`,
    deleteEndpoint: (id) => `/api/test-entities/${id}`,
    getEndpoint: (id) => `/api/test-entities/${id}`,
  },
  columns: [],
  fields: [
    {
      key: "name" as keyof TestEntity & string,
      label: "Name",
      type: "text",
    },
    {
      key: "email" as keyof TestEntity & string,
      label: "Email",
      type: "email",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// EntityRegistry
// ═══════════════════════════════════════════════════════════════════════════════

describe("EntityRegistry", () => {
  beforeEach(() => {
    // Clear registry between tests
    const slugs = entityRegistry.getAll().map((e) => e.slug);
    slugs.forEach((s) => entityRegistry.unregister(s));
  });

  it("starts empty", () => {
    expect(entityRegistry.getAll()).toHaveLength(0);
    expect(entityRegistry.has("foo")).toBe(false);
  });

  it("registers and retrieves an entity", () => {
    entityRegistry.register(sampleConfig);
    expect(entityRegistry.has("test-entities")).toBe(true);
    const retrieved = entityRegistry.get<TestEntity>("test-entities");
    expect(retrieved?.name).toBe("Test Entity");
  });

  it("returns undefined for unknown slug", () => {
    expect(entityRegistry.get("unknown")).toBeUndefined();
  });

  it("getAll returns all registered entities", () => {
    entityRegistry.register(sampleConfig);
    entityRegistry.register({
      ...sampleConfig,
      name: "Second",
      slug: "second",
    });
    expect(entityRegistry.getAll()).toHaveLength(2);
  });

  it("unregister removes entity and returns true", () => {
    entityRegistry.register(sampleConfig);
    const result = entityRegistry.unregister("test-entities");
    expect(result).toBe(true);
    expect(entityRegistry.has("test-entities")).toBe(false);
  });

  it("unregister returns false for non-existent slug", () => {
    expect(entityRegistry.unregister("nope")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

describe("createEntityConfig", () => {
  it("returns the same config object (identity)", () => {
    const result = createEntityConfig(sampleConfig);
    expect(result).toBe(sampleConfig);
  });
});

describe("registerEntity / getEntityConfig", () => {
  beforeEach(() => {
    entityRegistry.getAll().map((e) => e.slug).forEach((s) => entityRegistry.unregister(s));
  });

  it("registers and retrieves via wrapper functions", () => {
    registerEntity(sampleConfig);
    const found = getEntityConfig<TestEntity>("test-entities");
    expect(found?.slug).toBe("test-entities");
  });

  it("returns undefined for unknown slug", () => {
    expect(getEntityConfig("unknown")).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Column Generators
// ═══════════════════════════════════════════════════════════════════════════════

describe("createIdColumn", () => {
  it("returns column with accessorKey 'id'", () => {
    const col = createIdColumn();
    expect(col.accessorKey).toBe("id");
  });

  it("has header 'ID' and size 80", () => {
    const col = createIdColumn();
    expect(col.header).toBe("ID");
    expect(col.size).toBe(80);
  });

  it("enables sorting", () => {
    const col = createIdColumn();
    expect(col.enableSorting).toBe(true);
  });
});

describe("createStatusColumn", () => {
  it("uses default accessorKey 'status'", () => {
    const col = createStatusColumn();
    expect(col.accessorKey).toBe("status");
    expect(col.header).toBe("Status");
  });

  it("accepts custom accessorKey and label", () => {
    const col = createStatusColumn("state", { label: "State" });
    expect(col.accessorKey).toBe("state");
    expect(col.header).toBe("State");
  });

  it("renders StatusBadge with default color map", () => {
    const col = createStatusColumn();
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    render(<CellFn row={{ original: { status: "ACTIVE" } }} />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveTextContent("ACTIVE");
    expect(badge).toHaveAttribute("data-color", "success");
  });

  it("renders StatusBadge with 'default' for unknown statuses", () => {
    const col = createStatusColumn();
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    render(<CellFn row={{ original: { status: "CUSTOM_STATUS" } }} />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toHaveAttribute("data-color", "default");
  });

  it("uses custom color map when provided", () => {
    const col = createStatusColumn("status", {
      colorMap: { ON: "success", OFF: "error" },
    });
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    render(<CellFn row={{ original: { status: "ON" } }} />);
    expect(screen.getByTestId("status-badge")).toHaveAttribute(
      "data-color",
      "success"
    );
  });
});

describe("createDateColumn", () => {
  it("uses default accessorKey 'createdAt'", () => {
    const col = createDateColumn();
    expect(col.accessorKey).toBe("createdAt");
    expect(col.header).toBe("Created");
  });

  it("accepts custom accessorKey and label", () => {
    const col = createDateColumn("updatedAt", { label: "Updated" });
    expect(col.accessorKey).toBe("updatedAt");
    expect(col.header).toBe("Updated");
  });

  it("renders date format by default", () => {
    const col = createDateColumn();
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    render(<CellFn row={{ original: { createdAt: "2024-01-15T10:00:00Z" } }} />);
    // Default format uses toLocaleDateString — just verify something rendered
    expect(screen.getByText(/2024|1\/15|15/)).toBeInTheDocument();
  });

  it("renders datetime format", () => {
    const col = createDateColumn("createdAt", { format: "datetime" });
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    render(<CellFn row={{ original: { createdAt: "2024-01-15T10:30:00Z" } }} />);
    // toLocaleString includes time
    expect(screen.getByText(/10:30|10:00|AM|PM/i)).toBeInTheDocument();
  });

  it("renders relative format", () => {
    const col = createDateColumn("createdAt", { format: "relative" });
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    // Set date to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    render(<CellFn row={{ original: { createdAt: twoHoursAgo } }} />);
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });

  it("renders 'Just now' for very recent dates", () => {
    const col = createDateColumn("createdAt", { format: "relative" });
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    render(<CellFn row={{ original: { createdAt: new Date().toISOString() } }} />);
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });

  it("renders days ago for relative dates", () => {
    const col = createDateColumn("createdAt", { format: "relative" });
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    render(<CellFn row={{ original: { createdAt: fiveDaysAgo } }} />);
    expect(screen.getByText("5d ago")).toBeInTheDocument();
  });

  it("renders full date for relative dates over 30 days", () => {
    const col = createDateColumn("createdAt", { format: "relative" });
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    render(<CellFn row={{ original: { createdAt: sixtyDaysAgo } }} />);
    // Falls back to toLocaleDateString for >30 days
    expect(screen.getByText(/\d+/)).toBeInTheDocument();
  });

  it("renders dash for missing value", () => {
    const col = createDateColumn();
    const CellFn = col.Cell as React.FC<{
      row: { original: Record<string, unknown> };
    }>;

    const { container } = render(
      <CellFn row={{ original: { createdAt: undefined } }} />
    );
    expect(container.textContent).toBe("-");
  });
});

describe("createActionsColumn", () => {
  it("returns column with id 'actions'", () => {
    const col = createActionsColumn([]);
    expect(col.id).toBe("actions");
    expect(col.header).toBe("Actions");
  });

  it("disables sorting and filtering", () => {
    const col = createActionsColumn([]);
    expect(col.enableSorting).toBe(false);
    expect(col.enableColumnFilter).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateField
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateField", () => {
  const makeField = (
    overrides: Partial<FieldConfig<TestEntity>> = {}
  ): FieldConfig<TestEntity> => ({
    key: "name" as keyof TestEntity & string,
    label: "Name",
    type: "text",
    ...overrides,
  });

  it("returns null when no validation rules", () => {
    const field = makeField();
    expect(validateField(field, "anything", {})).toBeNull();
  });

  it("returns error for required empty value", () => {
    const field = makeField({ validation: { required: true } });
    expect(validateField(field, "", {})).toBe("Name is required");
    expect(validateField(field, undefined, {})).toBe("Name is required");
    expect(validateField(field, null, {})).toBe("Name is required");
  });

  it("returns custom message for required", () => {
    const field = makeField({
      validation: { required: true, message: "Please fill this" },
    });
    expect(validateField(field, "", {})).toBe("Please fill this");
  });

  it("returns null for non-required empty values (skips further checks)", () => {
    const field = makeField({ validation: { minLength: 3 } });
    expect(validateField(field, "", {})).toBeNull();
    expect(validateField(field, null, {})).toBeNull();
  });

  // ─── Email ───────────────────────────────────────────────────────────────

  it("validates email format", () => {
    const field = makeField({
      key: "email" as keyof TestEntity & string,
      label: "Email",
      type: "email",
      validation: {},
    });
    expect(validateField(field, "bad-email", {})).toBe(
      "Please enter a valid email address"
    );
    expect(validateField(field, "user@example.com", {})).toBeNull();
  });

  it("skips email validation when email: false", () => {
    const field = makeField({
      type: "email",
      validation: { email: false },
    });
    expect(validateField(field, "notanemail", {})).toBeNull();
  });

  // ─── URL ─────────────────────────────────────────────────────────────────

  it("validates URL format", () => {
    const field = makeField({
      type: "url",
      label: "Website",
      validation: {},
    });
    expect(validateField(field, "not a url", {})).toBe(
      "Please enter a valid URL"
    );
    expect(validateField(field, "https://example.com", {})).toBeNull();
  });

  it("skips URL validation when url: false", () => {
    const field = makeField({
      type: "url",
      validation: { url: false },
    });
    expect(validateField(field, "not-a-url", {})).toBeNull();
  });

  // ─── Number ──────────────────────────────────────────────────────────────

  it("validates number min/max", () => {
    const field = makeField({
      type: "number",
      label: "Age",
      validation: { min: 18, max: 100 },
    });
    expect(validateField(field, 10, {})).toBe("Age must be at least 18");
    expect(validateField(field, 150, {})).toBe(
      "Age must be no more than 100"
    );
    expect(validateField(field, 25, {})).toBeNull();
  });

  // ─── Text minLength / maxLength / pattern ────────────────────────────────

  it("validates text minLength", () => {
    const field = makeField({
      type: "text",
      label: "Username",
      validation: { minLength: 3 },
    });
    expect(validateField(field, "ab", {})).toBe(
      "Username must be at least 3 characters"
    );
    expect(validateField(field, "abc", {})).toBeNull();
  });

  it("validates text maxLength", () => {
    const field = makeField({
      type: "text",
      label: "Bio",
      validation: { maxLength: 5 },
    });
    expect(validateField(field, "toolong", {})).toBe(
      "Bio must be no more than 5 characters"
    );
    expect(validateField(field, "ok", {})).toBeNull();
  });

  it("validates textarea minLength/maxLength", () => {
    const field = makeField({
      type: "textarea",
      label: "Description",
      validation: { minLength: 3, maxLength: 10 },
    });
    expect(validateField(field, "ab", {})).toBe(
      "Description must be at least 3 characters"
    );
    expect(validateField(field, "01234567890", {})).toBe(
      "Description must be no more than 10 characters"
    );
    expect(validateField(field, "hello", {})).toBeNull();
  });

  it("validates text pattern", () => {
    const field = makeField({
      type: "text",
      label: "Code",
      validation: { pattern: "^[A-Z]+$" },
    });
    expect(validateField(field, "abc", {})).toBe("Code format is invalid");
    expect(validateField(field, "ABC", {})).toBeNull();
  });

  // ─── Custom validator ────────────────────────────────────────────────────

  it("calls custom validator", () => {
    const custom = vi.fn().mockReturnValue("custom error");
    const field = makeField({
      validation: { custom },
    });
    const formData = { foo: "bar" };
    expect(validateField(field, "val", formData)).toBe("custom error");
    expect(custom).toHaveBeenCalledWith("val", formData);
  });

  it("returns null when custom validator passes", () => {
    const field = makeField({
      validation: { custom: () => null },
    });
    expect(validateField(field, "val", {})).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// transformFormData
// ═══════════════════════════════════════════════════════════════════════════════

describe("transformFormData", () => {
  const fields: FieldConfig<Record<string, unknown>>[] = [
    { key: "name", label: "Name", type: "text" },
    { key: "count", label: "Count", type: "number" },
    { key: "active", label: "Active", type: "boolean" },
    { key: "dob", label: "DOB", type: "date" },
    { key: "startTime", label: "Start", type: "datetime" },
    { key: "meta", label: "Meta", type: "json" },
  ];

  describe("toApi direction", () => {
    const base = { name: "", count: "", active: false, dob: "", startTime: "", meta: null };

    it("passes text through unchanged", () => {
      const result = transformFormData(fields, { ...base, name: "Alice" }, "toApi");
      expect(result.name).toBe("Alice");
    });

    it("converts number strings to numbers", () => {
      const result = transformFormData(fields, { ...base, count: "42" }, "toApi");
      expect(result.count).toBe(42);
    });

    it("converts empty number to null", () => {
      const result = transformFormData(fields, { ...base, count: "" }, "toApi");
      expect(result.count).toBeNull();
    });

    it("converts boolean values", () => {
      const result = transformFormData(fields, { ...base, active: true }, "toApi");
      expect(result.active).toBe(true);
    });

    it("converts falsy to false for boolean", () => {
      const result = transformFormData(fields, { ...base, active: 0 }, "toApi");
      expect(result.active).toBe(false);
    });

    it("converts date to ISO string", () => {
      const result = transformFormData(fields, { ...base, dob: "2024-06-15" }, "toApi");
      expect(result.dob).toContain("2024-06-15");
    });

    it("converts empty date to null", () => {
      const result = transformFormData(fields, { ...base, dob: "" }, "toApi");
      expect(result.dob).toBeNull();
    });

    it("converts datetime to ISO string", () => {
      const result = transformFormData(fields, { ...base, startTime: "2024-06-15T10:30" }, "toApi");
      expect(result.startTime).toContain("2024-06-15");
    });

    it("parses JSON string", () => {
      const result = transformFormData(fields, { ...base, meta: '{"a":1}' }, "toApi");
      expect(result.meta).toEqual({ a: 1 });
    });

    it("passes non-string JSON through", () => {
      const obj = { a: 1 };
      const result = transformFormData(fields, { ...base, meta: obj }, "toApi");
      expect(result.meta).toBe(obj);
    });
  });

  describe("fromApi direction", () => {
    const base = { name: "", count: 0, active: false, dob: "", startTime: "", meta: null };

    it("converts date to YYYY-MM-DD string", () => {
      const result = transformFormData(fields, { ...base, dob: "2024-06-15T10:00:00Z" }, "fromApi");
      expect(result.dob).toBe("2024-06-15");
    });

    it("converts empty date to empty string", () => {
      const result = transformFormData(fields, { ...base }, "fromApi");
      expect(result.dob).toBe("");
    });

    it("converts datetime to ISO slice(0,16)", () => {
      const result = transformFormData(fields, { ...base, startTime: "2024-06-15T10:30:00Z" }, "fromApi");
      expect(result.startTime).toBe("2024-06-15T10:30");
    });

    it("stringifies JSON objects", () => {
      const result = transformFormData(fields, { ...base, meta: { b: 2 } }, "fromApi");
      expect(JSON.parse(result.meta as string)).toEqual({ b: 2 });
    });

    it("passes non-object JSON through", () => {
      const result = transformFormData(fields, { ...base, meta: "raw" }, "fromApi");
      expect(result.meta).toBe("raw");
    });

    it("passes text through unchanged", () => {
      const result = transformFormData(fields, { ...base, name: "Bob" }, "fromApi");
      expect(result.name).toBe("Bob");
    });
  });
});
