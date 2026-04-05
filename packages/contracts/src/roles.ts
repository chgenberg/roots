import { z } from "zod";

export const RoleEnum = z.enum([
  "PUBLIC",
  "CLUB_MEMBER",
  "CLUB_ADMIN",
  "SALES_REP",
  "SALES_ADMIN",
  "INTERNAL_ADMIN",
  "ASSOCIATION_ADMIN",
  "TEAM_LEADER",
  "SELLER",
]);

export type Role = z.infer<typeof RoleEnum>;

export const CLUB_ROLES: Role[] = ["CLUB_MEMBER", "CLUB_ADMIN"];
export const SALES_ROLES: Role[] = ["SALES_REP", "SALES_ADMIN"];
export const ADMIN_ROLES: Role[] = ["SALES_ADMIN", "INTERNAL_ADMIN"];
export const FUNDRAISING_ROLES: Role[] = [
  "ASSOCIATION_ADMIN",
  "TEAM_LEADER",
  "SELLER",
];
