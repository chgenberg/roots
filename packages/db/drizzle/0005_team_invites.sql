-- Sprint E9: ASSOCIATION_ADMIN can create teams and invite their team
-- leader from inside the portal. We can't write a `teams` row up front
-- because teams.leader_id is NOT NULL, so we hold the pre-team state
-- here until the leader claims the invite.

CREATE TABLE IF NOT EXISTS "team_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id"),
  "team_name" varchar(255) NOT NULL,
  "invited_email" varchar(255),
  "token" varchar(64) NOT NULL UNIQUE,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "used_at" timestamp,
  "used_by_team_id" uuid REFERENCES "teams"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "team_invites_org_id_idx" ON "team_invites" ("org_id");
CREATE INDEX IF NOT EXISTS "team_invites_campaign_id_idx" ON "team_invites" ("campaign_id");
CREATE INDEX IF NOT EXISTS "team_invites_used_at_idx" ON "team_invites" ("used_at");
