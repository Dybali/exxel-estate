import {db} from './server';
import {env} from './runtime';
import {TEAM_TITLE_SCHEMA} from './company-office';
import {AGENT_LANGUAGE_SCHEMA} from './agent-directory';
const schema=[
 `CREATE TABLE IF NOT EXISTS company_team_invitations (id uuid PRIMARY KEY,agency_id uuid NOT NULL REFERENCES agencies(id),invited_email text NOT NULL,invited_by uuid NOT NULL REFERENCES users(id),created_at text NOT NULL,expires_at text NOT NULL,accepted_at text,revoked_at text)`,
 `CREATE INDEX IF NOT EXISTS company_team_invitation_email_idx ON company_team_invitations(invited_email,expires_at)`,
 `CREATE TABLE IF NOT EXISTS company_team_memberships (id uuid PRIMARY KEY,agency_id uuid NOT NULL REFERENCES agencies(id),user_id uuid NOT NULL REFERENCES users(id),invitation_id uuid NOT NULL UNIQUE REFERENCES company_team_invitations(id),joined_at text NOT NULL,ended_at text)`,
 `CREATE TABLE IF NOT EXISTS company_team_codes (invitation_id uuid PRIMARY KEY REFERENCES company_team_invitations(id),code_hash text NOT NULL UNIQUE)`,
 `CREATE UNIQUE INDEX IF NOT EXISTS company_team_one_active_company_idx ON company_team_memberships(user_id) WHERE ended_at IS NULL`,
 `CREATE TABLE IF NOT EXISTS company_featured_listings (agency_id uuid NOT NULL REFERENCES agencies(id),listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,created_at text NOT NULL,PRIMARY KEY(agency_id,listing_id))`,
 `CREATE INDEX IF NOT EXISTS company_team_active_agency_idx ON company_team_memberships(agency_id) WHERE ended_at IS NULL`,
 // Office page: consultant titles (lib/company-office.ts) and spoken languages (lib/agent-directory.ts).
 TEAM_TITLE_SCHEMA,
 AGENT_LANGUAGE_SCHEMA
];
let ready:Promise<void>|undefined;
export async function teamDB(){if(!ready)ready=(async()=>{if((env as {DATABASE_URL?:string}).DATABASE_URL)await db().prepare('ALTER TABLE listings ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id)').run();for(const statement of schema)await db().prepare(statement).run();})().catch(e=>{ready=undefined;throw e});await ready;return db();}
export async function activeTeamCompany(userId:string){const database=await teamDB();return database.prepare(`SELECT a.id,a.name,a.owner_id FROM company_team_memberships m JOIN agencies a ON a.id=m.agency_id JOIN users owner ON owner.id=a.owner_id JOIN users member ON member.id=m.user_id WHERE member.role IN ('buyer','individual') AND m.user_id=? AND m.ended_at IS NULL AND a.status='approved' AND owner.role='agent' AND owner.agent_status='approved'`).bind(userId).first<{id:string;name:string;owner_id:string}>();}
