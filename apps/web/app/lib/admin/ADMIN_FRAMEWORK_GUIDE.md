# Generic Admin Framework Guide

## Overview

This framework provides a modern, data-driven approach for building admin interfaces in the Gharbatai Rentals application. It is inspired by the original gharbatai admin portal's schema-driven architecture but enhanced with modern React patterns, TypeScript, and better extensibility.

## Key Features

1. **Data-Driven Configuration**: Define entities via configuration objects
2. **Generic Components**: Reusable table, form, and detail view components
3. **Type Safety**: Full TypeScript support with generic types
4. **Extensibility**: Hooks, custom renderers, and transformers
5. **Modern UI**: Built on Material-UI v5 with Material React Table

## Architecture

### Core Concepts

```
┌─────────────────────────────────────────────────────────────┐
│                    Entity Configuration                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Fields    │  │  Columns    │  │      Actions        │  │
│  │  (Forms)    │  │  (Tables)   │  │  (Bulk/Row/Hooks)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Generic Components                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ GenericDataTable│  │ GenericDataForm │  │  DetailView │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Entity Registry                           │
│         Central registration and lookup of entities          │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Define an Entity Configuration

```typescript
// lib/admin/entities/users.ts
import type { EntityConfig } from "../generic-admin-framework";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "CUSTOMER" | "OWNER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  createdAt: string;
}

export const userEntityConfig: EntityConfig<User> = {
  name: "User",
  pluralName: "Users",
  slug: "users",
  description: "Manage user accounts",

  api: {
    baseEndpoint: "/api/admin/users",
    createEndpoint: "/api/admin/users",
    updateEndpoint: (id) => `/api/admin/users/${id}`,
    deleteEndpoint: (id) => `/api/admin/users/${id}`,
    getEndpoint: (id) => `/api/admin/users/${id}`,
  },

  fields: [
    {
      key: "email",
      label: "Email Address",
      type: "email",
      required: true,
      validation: { email: true },
    },
    {
      key: "firstName",
      label: "First Name",
      type: "text",
      required: true,
      validation: { minLength: 2, maxLength: 50 },
    },
    {
      key: "lastName",
      label: "Last Name",
      type: "text",
      required: true,
      validation: { minLength: 2, maxLength: 50 },
    },
    {
      key: "role",
      label: "Role",
      type: "select",
      required: true,
      options: [
        { value: "CUSTOMER", label: "Customer" },
        { value: "OWNER", label: "Property Owner" },
        { value: "ADMIN", label: "Administrator" },
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      required: true,
      options: [
        { value: "ACTIVE", label: "Active" },
        { value: "SUSPENDED", label: "Suspended" },
        { value: "BANNED", label: "Banned" },
      ],
    },
  ],

  columns: [
    { accessorKey: "id", header: "ID", size: 80 },
    { accessorKey: "email", header: "Email", size: 250 },
    { accessorKey: "firstName", header: "First Name", size: 120 },
    { accessorKey: "lastName", header: "Last Name", size: 120 },
    { accessorKey: "role", header: "Role", size: 120 },
    { accessorKey: "status", header: "Status", size: 100 },
  ],

  stats: [
    {
      id: "total",
      label: "Total Users",
      value: (data) => data.length,
      color: "primary",
    },
    {
      id: "active",
      label: "Active Users",
      value: (data) => data.filter((u) => u.status === "ACTIVE").length,
      color: "success",
    },
  ],

  bulkActions: [
    {
      id: "activate",
      label: "Activate",
      color: "success",
      requiresSelection: true,
      handler: async (ids) => {
        // API call to activate users
      },
    },
  ],

  rowActions: [
    {
      id: "impersonate",
      label: "Impersonate",
      visible: (record) => record.status === "ACTIVE",
      handler: async (record) => {
        // Impersonation logic
      },
    },
  ],
};
```

### 2. Register the Entity

```typescript
// routes/admin/generic/[entity].tsx
import { entityRegistry } from "~/lib/admin/generic-admin-framework";
import { userEntityConfig } from "~/lib/admin/entities/users";

// Register entity
entityRegistry.register(userEntityConfig);
```

### 3. Use the Generic Page

The generic entity page is already set up at `routes/admin/generic-new/[entity].tsx`. Simply navigate to `/admin/generic-new/users` to see the users admin interface.

## Configuration Reference

### EntityConfig

| Property       | Type              | Description                |
| -------------- | ----------------- | -------------------------- |
| `name`         | `string`          | Singular entity name       |
| `pluralName`   | `string`          | Plural entity name         |
| `slug`         | `string`          | URL-friendly identifier    |
| `description`  | `string`          | Entity description         |
| `icon`         | `ReactNode`       | Entity icon                |
| `api`          | `ApiConfig`       | API endpoint configuration |
| `fields`       | `FieldConfig[]`   | Form field definitions     |
| `columns`      | `MRT_ColumnDef[]` | Table column definitions   |
| `filters`      | `FilterConfig[]`  | Filter definitions         |
| `formSections` | `FormSection[]`   | Form section organization  |
| `stats`        | `StatConfig[]`    | Statistics cards           |
| `bulkActions`  | `BulkAction[]`    | Bulk action buttons        |
| `rowActions`   | `RowAction[]`     | Row action menu items      |
| `permissions`  | `Permissions`     | CRUD permissions           |
| `hooks`        | `Hooks`           | Lifecycle hooks            |
| `transformers` | `Transformers`    | Data transformers          |

### FieldConfig

| Property       | Type                  | Description          |
| -------------- | --------------------- | -------------------- |
| `key`          | `string`              | Field identifier     |
| `label`        | `string`              | Display label        |
| `type`         | `FieldType`           | Field type           |
| `description`  | `string`              | Help text            |
| `placeholder`  | `string`              | Placeholder text     |
| `defaultValue` | `any`                 | Default value        |
| `validation`   | `ValidationRule`      | Validation rules     |
| `options`      | `Option[]`            | Select options       |
| `hidden`       | `boolean \| function` | Hide condition       |
| `disabled`     | `boolean \| function` | Disable condition    |
| `readOnly`     | `boolean \| function` | Read-only condition  |
| `gridColumn`   | `number`              | Grid column span     |
| `renderForm`   | `function`            | Custom form renderer |

### Field Types

- `text` - Single line text
- `email` - Email address
- `password` - Password input
- `url` - URL input
- `number` - Numeric input
- `textarea` - Multi-line text
- `select` - Dropdown selection
- `multiselect` - Multiple selection
- `date` - Date picker
- `datetime` - Date/time picker
- `boolean` - Toggle/switch
- `json` - JSON editor
- `color` - Color picker
- `file` - File upload
- `reference` - Reference to another entity

### Validation Rules

| Rule        | Type       | Description                |
| ----------- | ---------- | -------------------------- |
| `required`  | `boolean`  | Required field             |
| `min`       | `number`   | Minimum value (numbers)    |
| `max`       | `number`   | Maximum value (numbers)    |
| `minLength` | `number`   | Minimum length (text)      |
| `maxLength` | `number`   | Maximum length (text)      |
| `pattern`   | `string`   | Regex pattern              |
| `email`     | `boolean`  | Email validation           |
| `url`       | `boolean`  | URL validation             |
| `custom`    | `function` | Custom validation function |

## Advanced Features

### Form Sections

Organize fields into collapsible sections:

```typescript
formSections: [
  {
    title: 'Basic Information',
    description: 'User contact details',
    fields: ['email', 'firstName', 'lastName'],
    defaultExpanded: true,
    collapsible: true,
  },
  {
    title: 'Permissions',
    description: 'Role and status settings',
    fields: ['role', 'status'],
  },
],
```

### Lifecycle Hooks

```typescript
hooks: {
  beforeCreate: async (data) => {
    // Modify data before create
    return { ...data, createdAt: new Date().toISOString() };
  },
  afterCreate: async (data) => {
    // Side effects after create
    console.log('Created:', data);
  },
  beforeUpdate: async (id, data) => {
    // Modify data before update
    return data;
  },
  afterUpdate: async (data) => {
    // Side effects after update
  },
  beforeDelete: async (id) => {
    // Return false to prevent deletion
    return confirm('Are you sure?');
  },
  afterDelete: async (id) => {
    // Cleanup after deletion
  },
  onError: (error, action) => {
    // Global error handling
    console.error(`${action} failed:`, error);
  },
},
```

### Data Transformers

```typescript
transformers: {
  // Transform list response
  list: (data) => data.map(item => ({
    ...item,
    fullName: `${item.firstName} ${item.lastName}`,
  })),

  // Transform single item response
  detail: (data) => ({
    ...data,
    formattedDate: new Date(data.createdAt).toLocaleDateString(),
  }),

  // Transform before create
  create: (data) => ({
    ...data,
    password: hashPassword(data.password),
  }),

  // Transform before update
  update: (data) => ({
    ...data,
    updatedAt: new Date().toISOString(),
  }),
},
```

### Custom Field Rendering

```typescript
{
  key: 'customField',
  label: 'Custom Field',
  type: 'text',
  renderForm: ({ value, onChange, onBlur, error, disabled }) => (
    <MyCustomInput
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      disabled={disabled}
    />
  ),
}
```

### Conditional Visibility

```typescript
{
  key: 'suspensionReason',
  label: 'Suspension Reason',
  type: 'textarea',
  hidden: (mode, data) => data?.status !== 'SUSPENDED',
}
```

### Dynamic Options

```typescript
{
  key: 'managerId',
  label: 'Manager',
  type: 'select',
  reference: {
    entity: 'users',
    displayField: 'fullName',
    valueField: 'id',
    filter: { role: 'MANAGER' },
  },
}
```

## Comparison with Original Gharbatai Admin

| Feature           | Original (Vue/Quasar)   | New (React/MUI)        |
| ----------------- | ----------------------- | ---------------------- |
| Schema Definition | `processSchema` mixin   | `EntityConfig` object  |
| Table Component   | `TableList.vue`         | `GenericDataTable.tsx` |
| Form Component    | `Form.vue` with Blitzar | `GenericDataForm.tsx`  |
| Field Types       | Hardcoded               | Extensible type system |
| Validation        | AJV schema              | Built-in + custom      |
| Actions           | Server-defined          | Client + server mix    |
| Styling           | SASS/Quasar             | MUI sx props           |
| State Management  | Vuex                    | React hooks            |
| Type Safety       | Limited                 | Full TypeScript        |

## Migration Guide

### From Old Admin Portal

1. **Extract Schema**: Convert server-side schema to `EntityConfig`
2. **Map Fields**: Convert field definitions to `FieldConfig`
3. **Update Columns**: Convert table columns to `MRT_ColumnDef`
4. **Migrate Actions**: Convert UI actions to `BulkAction`/`RowAction`
5. **Add Types**: Define TypeScript interfaces for entities

### Example Migration

**Old (Vue)**:

```javascript
// Server schema
{
  name: 'email',
  label: 'Email',
  type: 'email',
  show: true,
  required: true,
}
```

**New (React)**:

```typescript
// Entity config
{
  key: 'email',
  label: 'Email Address',
  type: 'email',
  required: true,
  validation: { email: true },
}
```

## Best Practices

1. **Type Safety**: Always define interfaces for your entities
2. **Validation**: Use both client and server validation
3. **Error Handling**: Implement `onError` hooks for consistent error handling
4. **Optimistic Updates**: Use `transformers` for immediate UI feedback
5. **Accessibility**: Leverage MUI's built-in accessibility features
6. **Performance**: Use `React.memo` for custom renderers
7. **Testing**: Test configurations independently from components

## Future Enhancements

- [ ] Server-side schema generation from Prisma
- [ ] Automatic entity discovery
- [ ] Built-in audit logging
- [ ] Advanced filtering with query builder
- [ ] Export to CSV/Excel/PDF
- [ ] Bulk import from files
- [ ] Custom view modes (kanban, calendar)
- [ ] Real-time updates via WebSocket
- [ ] Multi-tenant support
- [ ] Field-level permissions
