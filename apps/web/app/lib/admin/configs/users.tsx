import type { EntityConfig } from "../entity-framework";
import type { AdminUser } from "~/lib/api/admin";
import { Chip } from "@mui/material";

export const usersConfig: EntityConfig<AdminUser> = {
  name: "User",
  pluralName: "Users",
  slug: "users",
  description: "Manage system users, roles, and verification status",
  
  api: {
    baseEndpoint: "/admin/users",
    listEndpoint: "/admin/users",
    getEndpoint: (id) => `/admin/users/${id}`,
    updateEndpoint: (id) => `/admin/users/${id}`,
    // deleteEndpoint: (id) => `/admin/users/${id}`, // Users are usually suspended, not deleted
  },

  columns: [
    {
      accessorKey: "firstName",
      header: "First Name",
    },
    {
      accessorKey: "lastName",
      header: "Last Name",
      Cell: ({ cell }) => <>{(cell.getValue() as string) || "-"}</>,
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "role",
      header: "Role",
      Cell: ({ cell }) => {
        const role = cell.getValue<string>();
        const colors: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
          ADMIN: "error",
          USER: "default",
          HOST: "primary",
          SUPER_ADMIN: "error",
        };
        return <Chip label={role} color={colors[role] || "default"} size="small" />;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      Cell: ({ cell }) => {
        const status = cell.getValue<string>();
        const colors: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
          ACTIVE: "success",
          SUSPENDED: "error",
          PENDING_VERIFICATION: "warning",
          DEACTIVATED: "default",
        };
        return <Chip label={status} color={colors[status] || "default"} size="small" />;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Joined",
      Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
    },
  ],

  fields: [
    {
      key: "firstName",
      label: "First Name",
      type: "text",
      validation: { required: true },
    },
    {
      key: "lastName",
      label: "Last Name",
      type: "text",
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      validation: { required: true, email: true },
    },
    {
      key: "role",
      label: "Role",
      type: "select",
      options: [
        { label: "User", value: "USER" },
        { label: "Host", value: "HOST" },
        { label: "Admin", value: "ADMIN" },
      ],
      validation: { required: true },
    },
  ],

  filters: [
    {
      key: "role",
      label: "Role",
      type: "select",
      operator: "eq",
      options: [
        { label: "User", value: "USER" },
        { label: "Host", value: "HOST" },
        { label: "Admin", value: "ADMIN" },
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      operator: "eq",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Suspended", value: "SUSPENDED" },
        { label: "Pending", value: "PENDING_VERIFICATION" },
      ],
    },
  ],
};
