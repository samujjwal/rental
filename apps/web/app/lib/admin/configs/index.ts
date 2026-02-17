import { usersConfig } from "./users";
import { listingsConfig } from "./listings";
import type { EntityConfig } from "../entity-framework";

type AnyEntityConfig = EntityConfig<Record<string, unknown>>;

export const entityConfigs: Record<string, AnyEntityConfig> = {
  users: usersConfig as unknown as AnyEntityConfig,
  listings: listingsConfig as unknown as AnyEntityConfig,
  // Add others as needed
};

export function getEntityConfig(slug: string): AnyEntityConfig | null {
  return entityConfigs[slug] || null;
}
