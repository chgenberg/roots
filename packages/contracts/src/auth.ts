import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterClubSchema = z.object({
  orgName: z.string().min(2),
  orgNumber: z.string().min(6),
  email: z.string().email(),
  password: z.string().min(8),
  contactName: z.string().min(2),
});

export type RegisterClubInput = z.infer<typeof RegisterClubSchema>;

export const RegisterAssociationSchema = z.object({
  orgName: z.string().min(2, "Club name is required"),
  orgNumber: z.string().optional(),
  nationalFederation: z.string().optional(),
  sportType: z.string().optional(),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  contactName: z.string().min(2, "Contact name is required"),
  phone: z.string().optional(),
  // personalNumber togs bort medvetet: fältet samlades in i klartext utan
  // att någon funktion läste det. Behöver vi identitet i framtiden gör vi
  // det via BankID, inte via ett fritextfält i ett registreringsformulär.
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});

export type RegisterAssociationInput = z.infer<
  typeof RegisterAssociationSchema
>;

export const RegisterTeamLeaderSchema = z.object({
  teamName: z.string().min(2, "Team name is required"),
  orgName: z.string().optional(),
  orgSearchQuery: z.string().optional(),
  existingOrgId: z.string().uuid().optional(),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  contactName: z.string().min(2, "Contact name is required"),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});

export type RegisterTeamLeaderInput = z.infer<typeof RegisterTeamLeaderSchema>;

export const RegisterSellerSchema = z.object({
  inviteToken: z.string(),
  email: z.string().email("Invalid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  displayName: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
  birthYear: z.number().int(),
  guardianName: z.string().min(2).optional(),
  guardianEmail: z.string().email().optional(),
  guardianConsent: z.boolean().optional(),
});

export type RegisterSellerInput = z.infer<typeof RegisterSellerSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const PasswordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

// ── POST /v1/auth/change-password (Sprint C — Byt lösenord) ─────────

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "New password is too long"),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const ChangePasswordResponseSchema = z.object({
  ok: z.literal(true),
});
export type ChangePasswordResponse = z.infer<typeof ChangePasswordResponseSchema>;
