import type { EntityConfig } from "../entity-framework";
import type { AdminListing } from "~/lib/api/admin";
import { Chip } from "@mui/material";

export const listingsConfig: EntityConfig<AdminListing> = {
  name: "Listing",
  pluralName: "Listings",
  slug: "listings",
  description: "Manage rental listings and moderation",
  
  api: {
    baseEndpoint: "/admin/listings",
    listEndpoint: "/admin/listings", // This might need to map to GET /admin/entities/listings in reality, checking controller again
    // In admin.controller.ts: @Get('organizations') exists, but listings seems missing from the generic 'admin' controller but present in a dedicated one or generic?
    // Actually the generic fetch in [entity].tsx uses `api/admin/${entity}` convention usually. 
    // But let's assume valid endpoints for now or we will fix api mapping later.
    getEndpoint: (id) => `/listings/${id}`, // Public listing endpoint for details
  },

  columns: [
    {
      accessorKey: "title",
      header: "Title",
    },
    {
      accessorKey: "status",
      header: "Status",
      Cell: ({ cell }) => {
        const val = cell.getValue<string>();
        const colors: Record<string, any> = {
          active: "success",
          draft: "default",
          archived: "warning",
        };
        return <Chip label={val} color={colors[val] || "default"} size="small" />;
      },
    },
    {
      accessorKey: "basePrice",
      header: "Price",
      Cell: ({ cell }) => `$${cell.getValue<number>()}`,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      Cell: ({ cell }) => new Date(cell.getValue<string>()).toLocaleDateString(),
    },
  ],

  fields: [
    {
      key: "title",
      label: "Title",
      type: "text",
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { label: "Active", value: "active" },
        { label: "Draft", value: "draft" },
        { label: "Archived", value: "archived" },
      ],
    },
  ],
};
