import { usersConfig } from "./users";
import { listingsConfig } from "./listings";
import type { EntityConfig } from "../entity-framework";

export const entityConfigs: Record<string, EntityConfig<any>> = {
  users: usersConfig,
  listings: listingsConfig,
  // Add others as needed
};

export function getEntityConfig(slug: string): EntityConfig<any> | null {
  return entityConfigs[slug] || null;
}
