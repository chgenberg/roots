import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Lösenord måste vara minst 8 tecken"),
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
  orgName: z.string().min(2, "Föreningsnamn krävs"),
  orgNumber: z.string().optional(),
  nationalFederation: z.string().optional(),
  sportType: z.string().optional(),
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(8, "Lösenord måste vara minst 8 tecken"),
  contactName: z.string().min(2, "Kontaktperson krävs"),
  phone: z.string().optional(),
  personalNumber: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});

export type RegisterAssociationInput = z.infer<
  typeof RegisterAssociationSchema
>;

export const RegisterTeamLeaderSchema = z.object({
  teamName: z.string().min(2, "Lagnamn krävs"),
  orgName: z.string().optional(),
  orgSearchQuery: z.string().optional(),
  existingOrgId: z.string().uuid().optional(),
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(8, "Lösenord måste vara minst 8 tecken"),
  contactName: z.string().min(2, "Kontaktperson krävs"),
  phone: z.string().optional(),
  personalNumber: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});

export type RegisterTeamLeaderInput = z.infer<typeof RegisterTeamLeaderSchema>;

export const RegisterSellerSchema = z.object({
  inviteToken: z.string(),
  email: z.string().email("Ogiltig e-postadress"),
  password: z.string().min(8, "Lösenord måste vara minst 8 tecken"),
  displayName: z.string().min(2, "Namn krävs"),
  phone: z.string().optional(),
});

export type RegisterSellerInput = z.infer<typeof RegisterSellerSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const PasswordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});
