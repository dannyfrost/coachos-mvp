**RLS Policy Definitions**

Coaching Platform — MVP

20 Tables • 4 Roles • Supabase + PostgreSQL RLS

# RLS Architecture

**Design Principles**

**1. RLS is enabled on every table exposed via the Supabase Data API. No exceptions.**

**2. Default-deny: when RLS is enabled and no policy matches, access is denied. Policies whitelist access.**

**3. Tenant resolution uses security-definer helper functions in a private schema (not exposed via API), avoiding repeated joins inside policies.**

**4. Policies are role-aware: coach, assistant, client, and super_admin each get scoped access.**

**5. Participant/assignment scoping is enforced for sensitive tables (messages, daily_logs, VIP content) — not just coach_id filtering.**

**6. Service role keys bypass all RLS. DB constraints (composite FKs, triggers, CHECKs) remain the last line of defence for service-role operations.**

**7. Performance: avoid joins inside policies where possible. Use security-definer functions that resolve membership once per request. Add app-side WHERE filters to help the query planner.**

# Helper Functions

**These functions are created in a private schema (e.g., 'private') not exposed via the Supabase API. They use SECURITY DEFINER to read from tables the calling user may not have direct access to. They are stable within a single request because auth.uid() does not change mid-request.**

## get_my_role()

**Returns the authenticated user’s role_type.**

CREATE OR REPLACE FUNCTION private.get_my_role()

RETURNS text

LANGUAGE sql STABLE SECURITY DEFINER

SET search_path = ''

AS $$

SELECT role_type::text FROM public.platform_users

WHERE id = auth.uid();

$$;

## get_my_coach_id()

**Returns the coach_id for the authenticated user. For coaches, returns their own ID. For assistants, returns the coach they are assigned to (enforced to be exactly one via UNIQUE partial index on staff_assignments). For clients, returns their coach_id.**

*PREREQUISITE: CREATE UNIQUE INDEX staff_one_active_per_user ON staff_assignments(user_id) WHERE status = 'active'; — guarantees one active tenant per assistant. Without this, the function becomes nondeterministic.*

CREATE OR REPLACE FUNCTION private.get_my_coach_id()

RETURNS uuid

LANGUAGE sql STABLE SECURITY DEFINER

SET search_path = ''

AS $$

SELECT CASE

WHEN u.role_type = 'coach' THEN u.id

WHEN u.role_type = 'assistant' THEN (

SELECT sa.coach_id FROM public.staff_assignments sa

WHERE sa.user_id = u.id AND sa.status = 'active'

)

WHEN u.role_type = 'client' THEN (

SELECT c.coach_id FROM public.clients c

WHERE c.id = u.id

)

ELSE NULL

END

FROM public.platform_users u

WHERE u.id = auth.uid();

$$;

## is_my_assigned_client(uuid)

**For assistants: checks if the given client_id is in their assigned clients. For coaches: always true within their tenant. For clients: true only if the client_id matches auth.uid().**

CREATE OR REPLACE FUNCTION private.is_my_assigned_client(p_client_id uuid)

RETURNS boolean

LANGUAGE sql STABLE SECURITY DEFINER

SET search_path = ''

AS $$

SELECT CASE

WHEN private.get_my_role() = 'coach' THEN

EXISTS (

SELECT 1 FROM public.clients c

WHERE c.id = p_client_id AND c.coach_id = private.get_my_coach_id()

)

WHEN private.get_my_role() = 'assistant' THEN

EXISTS (

SELECT 1 FROM public.client_staff_assignments csa

WHERE csa.client_id = p_client_id

AND csa.staff_id = auth.uid()

AND csa.coach_id = private.get_my_coach_id()

)

WHEN private.get_my_role() = 'client' THEN

p_client_id = auth.uid()

ELSE false

END;

$$;

## has_permission(text)

**Checks if the authenticated assistant has a specific permission via their assigned role.**

CREATE OR REPLACE FUNCTION private.has_permission(p_permission text)

RETURNS boolean

LANGUAGE sql STABLE SECURITY DEFINER

SET search_path = ''

AS $$

SELECT EXISTS (

SELECT 1

FROM public.staff_assignments sa

JOIN public.role_permissions rp ON rp.role_id = sa.role_id

WHERE sa.user_id = auth.uid()

AND sa.status = 'active'

AND rp.permission = p_permission

AND rp.granted = true

);

$$;

## is_tenant_member(uuid)

**Checks if a given user_id belongs to the same tenant as the authenticated user. Used for platform_users visibility (no coach_id on that table).**

CREATE OR REPLACE FUNCTION private.is_tenant_member(p_user_id uuid)

RETURNS boolean

LANGUAGE sql STABLE SECURITY DEFINER

SET search_path = ''

AS $$

SELECT EXISTS (

-- Same coach

SELECT 1 FROM public.coaches co WHERE co.id = p_user_id

AND co.id = private.get_my_coach_id()

UNION ALL

-- Same-tenant client

SELECT 1 FROM public.clients cl WHERE cl.id = p_user_id

AND cl.coach_id = private.get_my_coach_id()

UNION ALL

-- Same-tenant staff

SELECT 1 FROM public.staff_assignments sa WHERE sa.user_id = p_user_id

AND sa.coach_id = private.get_my_coach_id()

AND sa.status = 'active'

);

$$;

# Access Matrix

**R = Read, W = Write (Insert/Update), D = Delete, — = No access. Scoping annotations: T = tenant, A = assigned clients, P = participant, S = self only.**

| **Table** | **Coach** | **Assistant** | **Client** | **Super Admin** |
| --- | --- | --- | --- | --- |
| **platform_users** | **R(T+self)** | **R(self+A)** | **R(self+coach)** | **R(all)** |
| **coaches** | **RW(self)** | **R(own coach)** | **—** | **R(all)** |
| **coach_subs** | **R(T)** | **—** | **—** | **R(all)** |
| **clients** | **RWD(T)** | **R(A)** | **R(S)** | **R(all)** |
| **client_subs** | **RWD(T)** | **R(A+billing)** | **R(S)** | **R(all)** |
| **staff_assign** | **RWD(T)** | **R(S)** | **—** | **R(all)** |
| **client_staff** | **RWD(T)** | **R(own)** | **—** | **R(all)** |
| **daily_logs** | **R(T)** | **R(A)** | **RW(S)** | **—** |
| **flash_cards** | **RW(T,notes)** | **RW(A,notes)** | **—** | **—** |
| **plans** | **RWD(T)** | **R(+draft)** | **—** | **—** |
| **plan_assign** | **RWD(T)** | **R(A)** | **R(S)** | **—** |
| **messages** | **RW(T)** | **RW(P)** | **RW(P)** | **—** |
| **absence_events** | **RW(T)** | **RW(A)** | **—** | **—** |
| **roles** | **R(all)** | **R(all)** | **—** | **RWD(locked)** |
| **role_perms** | **R(all)** | **R(all)** | **—** | **RWD(locked)** |
| **vip_groups** | **RWD(T)** | **R(T)** | **R(member)** | **—** |
| **vip_members** | **RWD(T)** | **R(T)** | **R(S)** | **—** |
| **vip_posts** | **RWD(T)** | **R(T)** | **RW(member)** | **—** |
| **vip_reactions** | **RD(T)** | **R(T)** | **RWD(member)** | **—** |
| **audit_logs** | **R(T)** | **—** | **—** | **R(all)** |

# Enable RLS on All Tables

**RLS must be enabled before any policies take effect. With RLS enabled and no policies, access is denied by default (PostgreSQL default-deny).**

ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

ALTER TABLE coach_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE client_staff_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE flash_cards ENABLE ROW LEVEL SECURITY;

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE plan_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE absence_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE vip_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE vip_group_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE vip_group_posts ENABLE ROW LEVEL SECURITY;

ALTER TABLE vip_post_reactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

# Per-Table RLS Policies

**Each policy is named with the pattern: {table}_{operation}_{role}. USING controls which existing rows are visible/modifiable. WITH CHECK controls which new/updated rows can be written.**

## 1. platform_users

*No coach_id on this table. Visibility resolved via is_tenant_member() helper.*

-- Self: everyone can read their own record

CREATE POLICY pu_select_self ON platform_users FOR SELECT

TO authenticated

USING (id = auth.uid());

-- Coach: see all tenant members

CREATE POLICY pu_select_coach ON platform_users FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'coach'

AND private.is_tenant_member(id)

);

-- Assistant: see assigned clients + own coach

CREATE POLICY pu_select_assistant ON platform_users FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND (

private.is_my_assigned_client(id)

OR id = private.get_my_coach_id()

)

);

-- Client: see own coach record

CREATE POLICY pu_select_client_coach ON platform_users FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'client'

AND id = private.get_my_coach_id()

);

-- Super Admin: read all

CREATE POLICY pu_select_admin ON platform_users FOR SELECT

TO authenticated

USING (private.get_my_role() = 'super_admin');

-- Self: update own record (name, email changes)

CREATE POLICY pu_update_self ON platform_users FOR UPDATE

TO authenticated

USING (id = auth.uid())

WITH CHECK (id = auth.uid());

## 2. coaches

-- Coach: read/update own record

CREATE POLICY coaches_select_self ON coaches FOR SELECT

TO authenticated

USING (id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY coaches_update_self ON coaches FOR UPDATE

TO authenticated

USING (id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (id = auth.uid());

-- Assistant: read own coach

CREATE POLICY coaches_select_assistant ON coaches FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND id = private.get_my_coach_id()

);

-- Super Admin: read all

CREATE POLICY coaches_select_admin ON coaches FOR SELECT

TO authenticated

USING (private.get_my_role() = 'super_admin');

## 3. coach_subscriptions

-- Coach: read own subscriptions

CREATE POLICY csub_select_coach ON coach_subscriptions FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'coach'

AND coach_id = auth.uid()

);

-- Super Admin: read all

CREATE POLICY csub_select_admin ON coach_subscriptions FOR SELECT

TO authenticated

USING (private.get_my_role() = 'super_admin');

*Coach subscriptions are managed server-side via Stripe webhooks using the service role. No INSERT/UPDATE policies needed for authenticated users.*

## 4. clients

-- Coach: full access to own tenant clients

CREATE POLICY clients_select_coach ON clients FOR SELECT

TO authenticated

USING (coach_id = private.get_my_coach_id() AND private.get_my_role() = 'coach');

CREATE POLICY clients_insert_coach ON clients FOR INSERT

TO authenticated

WITH CHECK (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY clients_update_coach ON clients FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

CREATE POLICY clients_delete_coach ON clients FOR DELETE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read assigned clients only

CREATE POLICY clients_select_assistant ON clients FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND private.is_my_assigned_client(id)

);

-- Client: read own record

CREATE POLICY clients_select_self ON clients FOR SELECT

TO authenticated

USING (id = auth.uid() AND private.get_my_role() = 'client');

-- Super Admin: read all

CREATE POLICY clients_select_admin ON clients FOR SELECT

TO authenticated

USING (private.get_my_role() = 'super_admin');

## 5. client_subscriptions

-- Coach: full CRUD on own tenant

CREATE POLICY clsub_select_coach ON client_subscriptions FOR SELECT

TO authenticated

USING (coach_id = private.get_my_coach_id() AND private.get_my_role() = 'coach');

CREATE POLICY clsub_insert_coach ON client_subscriptions FOR INSERT

TO authenticated

WITH CHECK (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY clsub_update_coach ON client_subscriptions FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

-- Assistant: read assigned clients + billing permission

CREATE POLICY clsub_select_assistant ON client_subscriptions FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND private.is_my_assigned_client(client_id)

);

-- Assistant with billing role: update payment status

CREATE POLICY clsub_update_billing ON client_subscriptions FOR UPDATE

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND private.has_permission('mark_payment')

AND private.is_my_assigned_client(client_id)

)

WITH CHECK (

private.has_permission('mark_payment')

AND private.is_my_assigned_client(client_id)

);

-- Client: read own

CREATE POLICY clsub_select_client ON client_subscriptions FOR SELECT

TO authenticated

USING (client_id = auth.uid() AND private.get_my_role() = 'client');

-- Super Admin: read all

CREATE POLICY clsub_select_admin ON client_subscriptions FOR SELECT

TO authenticated

USING (private.get_my_role() = 'super_admin');

## 6. staff_assignments

-- Coach: full CRUD on own tenant staff

CREATE POLICY sa_select_coach ON staff_assignments FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY sa_insert_coach ON staff_assignments FOR INSERT

TO authenticated

WITH CHECK (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY sa_update_coach ON staff_assignments FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

CREATE POLICY sa_delete_coach ON staff_assignments FOR DELETE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read own assignment record

CREATE POLICY sa_select_self ON staff_assignments FOR SELECT

TO authenticated

USING (user_id = auth.uid() AND private.get_my_role() = 'assistant');

-- Super Admin: read all

CREATE POLICY sa_select_admin ON staff_assignments FOR SELECT

TO authenticated

USING (private.get_my_role() = 'super_admin');

## 7. client_staff_assignments

-- Coach: full CRUD

CREATE POLICY csa_select_coach ON client_staff_assignments FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY csa_insert_coach ON client_staff_assignments FOR INSERT

TO authenticated

WITH CHECK (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY csa_update_coach ON client_staff_assignments FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

CREATE POLICY csa_delete_coach ON client_staff_assignments FOR DELETE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read own assignments

CREATE POLICY csa_select_assistant ON client_staff_assignments FOR SELECT

TO authenticated

USING (

staff_id = auth.uid()

AND private.get_my_role() = 'assistant'

);

-- Super Admin: read all

CREATE POLICY csa_select_admin ON client_staff_assignments FOR SELECT

TO authenticated

USING (private.get_my_role() = 'super_admin');

## 8. daily_logs

*Clients INSERT/UPDATE their own logs. Coaches and assistants READ only.*

-- Coach: read all tenant logs

CREATE POLICY dl_select_coach ON daily_logs FOR SELECT

TO authenticated

USING (coach_id = private.get_my_coach_id() AND private.get_my_role() = 'coach');

-- Assistant: read assigned clients' logs

CREATE POLICY dl_select_assistant ON daily_logs FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND private.is_my_assigned_client(client_id)

);

-- Client: read own logs

CREATE POLICY dl_select_client ON daily_logs FOR SELECT

TO authenticated

USING (client_id = auth.uid() AND private.get_my_role() = 'client');

-- Client: insert own logs

CREATE POLICY dl_insert_client ON daily_logs FOR INSERT

TO authenticated

WITH CHECK (

client_id = auth.uid()

AND private.get_my_role() = 'client'

AND coach_id = private.get_my_coach_id()

);

-- Client: update own logs (same day corrections)

CREATE POLICY dl_update_client ON daily_logs FOR UPDATE

TO authenticated

USING (client_id = auth.uid() AND private.get_my_role() = 'client')

WITH CHECK (client_id = auth.uid() AND coach_id = private.get_my_coach_id());

## 9. flash_cards

*System-computed. Coach and assistant update ONLY the 'notes' field via RPC. No direct UPDATE policies — column-level safety enforced by revoking direct UPDATE and routing through a narrow RPC function.*

-- Coach: read all tenant flash cards

CREATE POLICY fc_select_coach ON flash_cards FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read assigned clients' cards

CREATE POLICY fc_select_assistant ON flash_cards FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND private.is_my_assigned_client(client_id)

);

-- No UPDATE policies for authenticated users.

-- All notes updates go through this RPC:

CREATE OR REPLACE FUNCTION public.update_flash_card_notes(

p_card_id uuid,

p_notes text

)

RETURNS void

LANGUAGE plpgsql SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

v_client_id uuid;

v_coach_id uuid;

BEGIN

SELECT client_id, coach_id INTO v_client_id, v_coach_id

FROM public.flash_cards WHERE id = p_card_id;

IF NOT FOUND THEN RAISE EXCEPTION 'Flash card not found'; END IF;

-- Coach: must own tenant

IF private.get_my_role() = 'coach' AND v_coach_id = auth.uid() THEN

UPDATE public.flash_cards SET notes = p_notes WHERE id = p_card_id;

-- Assistant: must be assigned to client

ELSIF private.get_my_role() = 'assistant'

AND private.is_my_assigned_client(v_client_id) THEN

UPDATE public.flash_cards SET notes = p_notes WHERE id = p_card_id;

ELSE

RAISE EXCEPTION 'Not authorized to update this flash card';

END IF;

END$$;

*Flash card INSERT/DELETE is handled by service role (background computation jobs). Revoke direct UPDATE on flash_cards for the authenticated role: REVOKE UPDATE ON flash_cards FROM authenticated;*

## 10. plans

-- Coach: full CRUD on own plans

CREATE POLICY plans_select_coach ON plans FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY plans_insert_coach ON plans FOR INSERT

TO authenticated

WITH CHECK (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY plans_update_coach ON plans FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

CREATE POLICY plans_delete_coach ON plans FOR DELETE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read plans + create drafts if permitted

CREATE POLICY plans_select_assistant ON plans FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND coach_id = private.get_my_coach_id()

);

CREATE POLICY plans_insert_assistant ON plans FOR INSERT

TO authenticated

WITH CHECK (

private.get_my_role() = 'assistant'

AND coach_id = private.get_my_coach_id()

AND private.has_permission('modify_plans')

);

## 11. plan_assignments

-- Coach: full CRUD

CREATE POLICY pa_select_coach ON plan_assignments FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY pa_insert_coach ON plan_assignments FOR INSERT

TO authenticated

WITH CHECK (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY pa_update_coach ON plan_assignments FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

CREATE POLICY pa_delete_coach ON plan_assignments FOR DELETE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read assigned clients' assignments

CREATE POLICY pa_select_assistant ON plan_assignments FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND private.is_my_assigned_client(client_id)

);

-- Client: read own assignments

CREATE POLICY pa_select_client ON plan_assignments FOR SELECT

TO authenticated

USING (client_id = auth.uid() AND private.get_my_role() = 'client');

## 12. messages

*CRITICAL: participant-scoped with explicit recipient validation. Read: sender OR recipient only (except coach sees all). Write: sender_id = auth.uid() always. Recipients must be valid tenant participants. Column-level safety: read_at updates go through RPC, not direct UPDATE.*

-- Coach: read all tenant messages

CREATE POLICY msg_select_coach ON messages FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Coach: send to clients or staff in own tenant

CREATE POLICY msg_insert_coach ON messages FOR INSERT

TO authenticated

WITH CHECK (

coach_id = auth.uid()

AND private.get_my_role() = 'coach'

AND sender_id = auth.uid()

AND private.is_tenant_member(recipient_id)

);

-- Assistant: read messages where they are sender or recipient

CREATE POLICY msg_select_assistant ON messages FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND coach_id = private.get_my_coach_id()

AND (sender_id = auth.uid() OR recipient_id = auth.uid())

);

-- Assistant: send to assigned clients OR own coach

CREATE POLICY msg_insert_assistant ON messages FOR INSERT

TO authenticated

WITH CHECK (

private.get_my_role() = 'assistant'

AND coach_id = private.get_my_coach_id()

AND sender_id = auth.uid()

AND (

private.is_my_assigned_client(recipient_id)

OR recipient_id = private.get_my_coach_id()

)

);

-- Client: read messages where they are sender or recipient

CREATE POLICY msg_select_client ON messages FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'client'

AND coach_id = private.get_my_coach_id()

AND (sender_id = auth.uid() OR recipient_id = auth.uid())

);

-- Client: send only to own coach or assigned assistant

CREATE POLICY msg_insert_client ON messages FOR INSERT

TO authenticated

WITH CHECK (

private.get_my_role() = 'client'

AND coach_id = private.get_my_coach_id()

AND sender_id = auth.uid()

AND (

recipient_id = private.get_my_coach_id()

OR EXISTS (

SELECT 1 FROM public.client_staff_assignments csa

WHERE csa.client_id = auth.uid()

AND csa.staff_id = recipient_id

AND csa.coach_id = private.get_my_coach_id()

)

)

);

-- No direct UPDATE policies for authenticated users.

-- Mark-as-read goes through RPC to prevent column tampering:

CREATE OR REPLACE FUNCTION public.mark_message_read(

p_message_id uuid

)

RETURNS void

LANGUAGE plpgsql SECURITY DEFINER

SET search_path = ''

AS $$

DECLARE

v_recipient uuid;

v_coach_id uuid;

BEGIN

SELECT recipient_id, coach_id INTO v_recipient, v_coach_id

FROM public.messages WHERE id = p_message_id;

IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;

IF v_recipient != auth.uid() THEN

RAISE EXCEPTION 'Not the recipient of this message';

END IF;

IF v_coach_id != private.get_my_coach_id() THEN

RAISE EXCEPTION 'Not in same tenant';

END IF;

UPDATE public.messages SET read_at = now() WHERE id = p_message_id;

END$$;

*Revoke direct UPDATE on messages for authenticated role: REVOKE UPDATE ON messages FROM authenticated; All read_at updates go through mark_message_read() RPC.*

## 13. absence_events

-- Coach: read + update all tenant events

CREATE POLICY ae_select_coach ON absence_events FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY ae_update_coach ON absence_events FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

-- Assistant: read + update assigned clients' events

CREATE POLICY ae_select_assistant ON absence_events FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND private.is_my_assigned_client(client_id)

);

CREATE POLICY ae_update_assistant ON absence_events FOR UPDATE

TO authenticated

USING (

private.get_my_role() = 'assistant'

AND private.is_my_assigned_client(client_id)

)

WITH CHECK (private.is_my_assigned_client(client_id));

*Absence event INSERT is handled by the background cron job via service role. No authenticated-user INSERT policy needed.*

## 14. roles

-- Coach + Assistant: read all roles (needed to display role assignments)

CREATE POLICY roles_select_auth ON roles FOR SELECT

TO authenticated

USING (

private.get_my_role() IN ('coach', 'assistant', 'super_admin')

);

-- Super Admin: insert/update/delete (trigger enforces locked)

CREATE POLICY roles_insert_admin ON roles FOR INSERT

TO authenticated

WITH CHECK (private.get_my_role() = 'super_admin');

CREATE POLICY roles_update_admin ON roles FOR UPDATE

TO authenticated

USING (private.get_my_role() = 'super_admin')

WITH CHECK (private.get_my_role() = 'super_admin');

CREATE POLICY roles_delete_admin ON roles FOR DELETE

TO authenticated

USING (private.get_my_role() = 'super_admin');

*DB triggers enforce: no UPDATE/DELETE on locked roles; no unlocking locked roles. RLS allows the operation; trigger blocks it if locked = true.*

## 15. role_permissions

-- Coach + Assistant: read all permissions

CREATE POLICY rp_select_auth ON role_permissions FOR SELECT

TO authenticated

USING (

private.get_my_role() IN ('coach', 'assistant', 'super_admin')

);

-- Super Admin: manage permissions (trigger enforces locked parent)

CREATE POLICY rp_insert_admin ON role_permissions FOR INSERT

TO authenticated

WITH CHECK (private.get_my_role() = 'super_admin');

CREATE POLICY rp_update_admin ON role_permissions FOR UPDATE

TO authenticated

USING (private.get_my_role() = 'super_admin')

WITH CHECK (private.get_my_role() = 'super_admin');

CREATE POLICY rp_delete_admin ON role_permissions FOR DELETE

TO authenticated

USING (private.get_my_role() = 'super_admin');

## 16. vip_groups

-- Coach: full CRUD on own group

CREATE POLICY vg_select_coach ON vip_groups FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY vg_insert_coach ON vip_groups FOR INSERT

TO authenticated

WITH CHECK (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY vg_update_coach ON vip_groups FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

CREATE POLICY vg_delete_coach ON vip_groups FOR DELETE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read own coach group

CREATE POLICY vg_select_assistant ON vip_groups FOR SELECT

TO authenticated

USING (

coach_id = private.get_my_coach_id()

AND private.get_my_role() = 'assistant'

);

-- Client: read groups they are members of

CREATE POLICY vg_select_member ON vip_groups FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'client'

AND EXISTS (

SELECT 1 FROM vip_group_members vgm

WHERE vgm.group_id = vip_groups.id

AND vgm.client_id = auth.uid()

AND vgm.status = 'active'

)

);

## 17. vip_group_members

-- Coach: full CRUD

CREATE POLICY vgm_select_coach ON vip_group_members FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY vgm_insert_coach ON vip_group_members FOR INSERT

TO authenticated

WITH CHECK (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY vgm_update_coach ON vip_group_members FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

CREATE POLICY vgm_delete_coach ON vip_group_members FOR DELETE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read own coach group members

CREATE POLICY vgm_select_assistant ON vip_group_members FOR SELECT

TO authenticated

USING (

coach_id = private.get_my_coach_id()

AND private.get_my_role() = 'assistant'

);

-- Client: read own membership

CREATE POLICY vgm_select_client ON vip_group_members FOR SELECT

TO authenticated

USING (

client_id = auth.uid()

AND private.get_my_role() = 'client'

);

## 18. vip_group_posts

*Coach has full moderation. Clients can post only if active member (not muted/removed).*

-- Coach: full CRUD + moderation

CREATE POLICY vgp_select_coach ON vip_group_posts FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY vgp_insert_coach ON vip_group_posts FOR INSERT

TO authenticated

WITH CHECK (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY vgp_update_coach ON vip_group_posts FOR UPDATE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach')

WITH CHECK (coach_id = auth.uid());

CREATE POLICY vgp_delete_coach ON vip_group_posts FOR DELETE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read own coach group posts

CREATE POLICY vgp_select_assistant ON vip_group_posts FOR SELECT

TO authenticated

USING (

coach_id = private.get_my_coach_id()

AND private.get_my_role() = 'assistant'

);

-- Client: read group posts (if active member)

CREATE POLICY vgp_select_client ON vip_group_posts FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'client'

AND EXISTS (

SELECT 1 FROM vip_group_members vgm

WHERE vgm.group_id = vip_group_posts.group_id

AND vgm.client_id = auth.uid()

AND vgm.status = 'active'

)

);

-- Client: create posts (if active member, not muted)

CREATE POLICY vgp_insert_client ON vip_group_posts FOR INSERT

TO authenticated

WITH CHECK (

private.get_my_role() = 'client'

AND author_id = auth.uid()

AND coach_id = private.get_my_coach_id()

AND EXISTS (

SELECT 1 FROM vip_group_members vgm

WHERE vgm.group_id = vip_group_posts.group_id

AND vgm.client_id = auth.uid()

AND vgm.status = 'active'

)

);

## 19. vip_post_reactions

-- Coach: read + delete (moderation) on own tenant

CREATE POLICY vpr_select_coach ON vip_post_reactions FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

CREATE POLICY vpr_delete_coach ON vip_post_reactions FOR DELETE

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Assistant: read own coach group reactions

CREATE POLICY vpr_select_assistant ON vip_post_reactions FOR SELECT

TO authenticated

USING (

coach_id = private.get_my_coach_id()

AND private.get_my_role() = 'assistant'

);

-- Client: read reactions only on posts in groups they belong to

CREATE POLICY vpr_select_client ON vip_post_reactions FOR SELECT

TO authenticated

USING (

private.get_my_role() = 'client'

AND EXISTS (

SELECT 1 FROM vip_group_posts vgp

JOIN vip_group_members vgm ON vgm.group_id = vgp.group_id

WHERE vgp.id = vip_post_reactions.post_id

AND vgm.client_id = auth.uid()

AND vgm.status = 'active'

)

);

CREATE POLICY vpr_insert_client ON vip_post_reactions FOR INSERT

TO authenticated

WITH CHECK (

private.get_my_role() = 'client'

AND user_id = auth.uid()

AND coach_id = private.get_my_coach_id()

AND EXISTS (

SELECT 1 FROM vip_group_members vgm

JOIN vip_group_posts vgp ON vgp.group_id = vgm.group_id

WHERE vgp.id = vip_post_reactions.post_id

AND vgm.client_id = auth.uid()

AND vgm.status = 'active'

)

);

CREATE POLICY vpr_delete_client ON vip_post_reactions FOR DELETE

TO authenticated

USING (

user_id = auth.uid()

AND private.get_my_role() = 'client'

);

## 20. audit_logs

*Immutable. INSERT via service role only. Authenticated users can only read.*

-- Coach: read own tenant audit logs

CREATE POLICY al_select_coach ON audit_logs FOR SELECT

TO authenticated

USING (coach_id = auth.uid() AND private.get_my_role() = 'coach');

-- Super Admin: read all

CREATE POLICY al_select_admin ON audit_logs FOR SELECT

TO authenticated

USING (private.get_my_role() = 'super_admin');

*No INSERT/UPDATE/DELETE policies for authenticated users. Audit log writes happen via service role (background jobs, triggers). No authenticated user can modify audit records.*

# Storage RLS Policies

**All media is stored in private buckets. Path convention: {coach_id}/{client_id}/{filename}. Policies enforce tenant scope on storage.objects using storage.foldername() for path-based checks.**

## Bucket: tenant-media (private)

*Path convention: {coach_id}/{client_id}/{filename}. Both segments are enforced. Coaches can access any client path in their tenant. Assistants can access assigned client paths. Clients can only access their own path.*

-- Coach: upload to any client folder in their tenant

CREATE POLICY storage_insert_coach ON storage.objects FOR INSERT

TO authenticated

WITH CHECK (

bucket_id = 'tenant-media'

AND private.get_my_role() = 'coach'

AND (storage.foldername(name))[1] = auth.uid()::text

);

-- Client: upload only to own folder within tenant

CREATE POLICY storage_insert_client ON storage.objects FOR INSERT

TO authenticated

WITH CHECK (

bucket_id = 'tenant-media'

AND private.get_my_role() = 'client'

AND (storage.foldername(name))[1] = private.get_my_coach_id()::text

AND (storage.foldername(name))[2] = auth.uid()::text

);

-- Coach: read any file in their tenant

CREATE POLICY storage_select_coach ON storage.objects FOR SELECT

TO authenticated

USING (

bucket_id = 'tenant-media'

AND private.get_my_role() = 'coach'

AND (storage.foldername(name))[1] = auth.uid()::text

);

-- Assistant: read files for assigned clients only

CREATE POLICY storage_select_assistant ON storage.objects FOR SELECT

TO authenticated

USING (

bucket_id = 'tenant-media'

AND private.get_my_role() = 'assistant'

AND (storage.foldername(name))[1] = private.get_my_coach_id()::text

AND private.is_my_assigned_client((storage.foldername(name))[2]::uuid)

);

-- Client: read only own folder

CREATE POLICY storage_select_client ON storage.objects FOR SELECT

TO authenticated

USING (

bucket_id = 'tenant-media'

AND private.get_my_role() = 'client'

AND (storage.foldername(name))[1] = private.get_my_coach_id()::text

AND (storage.foldername(name))[2] = auth.uid()::text

);

-- Delete: only coaches can delete media in their tenant

CREATE POLICY storage_delete_coach ON storage.objects FOR DELETE

TO authenticated

USING (

bucket_id = 'tenant-media'

AND (storage.foldername(name))[1] = auth.uid()::text

AND private.get_my_role() = 'coach'

);

*No UPDATE policy: files are immutable. Upload new version, delete old. No policies on other buckets = default deny. Signed URLs are generated server-side with short TTL. createSignedUploadUrl requires INSERT permission (policy-gated). createSignedUrl requires SELECT permission (policy-gated). Service key bypasses all Storage RLS.*

# Schema Prerequisites for RLS

**These constraints and grants must exist before RLS policies are applied.**

-- One active staff assignment per assistant (guarantees get_my_coach_id() determinism)

CREATE UNIQUE INDEX staff_one_active_per_user

ON staff_assignments(user_id) WHERE status = 'active';

-- Revoke direct UPDATE on tables that use RPC for column safety

REVOKE UPDATE ON messages FROM authenticated;

REVOKE UPDATE ON flash_cards FROM authenticated;

-- Create private schema for helper functions (not exposed via API)

CREATE SCHEMA IF NOT EXISTS private;

-- Ensure PostgREST/Supabase does NOT expose the private schema

-- (configure via API settings, not SQL)

-- Grant execute on RPC functions to authenticated users

GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_flash_card_notes(uuid, text) TO authenticated;

# RLS Acceptance Tests

**These tests must pass before any pilot with real user data. They are launch gates, not optional.**

## Cross-Tenant Isolation

-- Setup: Coach A, Coach B, Client X under Coach A

-- Test: authenticate as Coach B

SELECT * FROM clients; -- must return 0 rows (no Coach A clients visible)

SELECT * FROM daily_logs; -- must return 0 rows

SELECT * FROM messages; -- must return 0 rows

SELECT * FROM flash_cards; -- must return 0 rows

## Participant-Scoped Messages

-- Setup: Coach A, Assistant X, Client Y, Client Z (all under Coach A)

-- Assistant X assigned to Client Y only

-- Message from Coach A to Client Z exists

-- Test: authenticate as Assistant X

SELECT * FROM messages; -- must NOT include Coach A <-> Client Z messages

-- must ONLY include messages where Assistant X is sender or recipient

-- Test: authenticate as Client Y

SELECT * FROM messages; -- must ONLY include messages where Client Y is sender or recipient

## Assignment-Scoped Data

-- Setup: Coach A, Assistant X assigned to Client Y only, Client Z exists

-- Test: authenticate as Assistant X

SELECT * FROM clients; -- must return Client Y only, NOT Client Z

SELECT * FROM daily_logs; -- must return Client Y logs only

SELECT * FROM flash_cards; -- must return Client Y card only

SELECT * FROM absence_events; -- must return Client Y events only

## Client Self-Scope

-- Test: authenticate as Client Y

SELECT * FROM clients; -- must return own record only

SELECT * FROM daily_logs; -- must return own logs only

INSERT INTO daily_logs (client_id, coach_id, ...) VALUES ('ClientZ', ...);

-- must FAIL (cannot insert logs for another client)

SELECT * FROM flash_cards; -- must return 0 rows (clients cannot see flash cards)

## VIP Group Membership Scope

-- Setup: VIP group under Coach A, Client Y is active member, Client Z is not

-- Test: authenticate as Client Z

SELECT * FROM vip_groups; -- must return 0 rows

SELECT * FROM vip_group_posts; -- must return 0 rows

-- Test: authenticate as Client Y

SELECT * FROM vip_group_posts; -- must return group posts

INSERT INTO vip_group_posts (...) -- must succeed (active member)

## Default-Deny Verification

-- Temporarily drop all policies on a test table

-- Verify: authenticated user sees 0 rows, cannot insert/update/delete

-- Re-apply policies after test

## Storage Cross-Tenant

-- Test: authenticate as Coach B

-- Attempt createSignedUploadUrl to 'tenant-media/coachA_id/...'

-- must FAIL (INSERT policy blocks wrong tenant path)

-- Attempt createSignedUrl for object in coachA_id/ path

-- must FAIL (SELECT policy blocks wrong tenant path)

## Storage Intra-Tenant Isolation

-- Setup: Coach A, Client Y, Client Z (both under Coach A)

-- Test: authenticate as Client Y

-- Attempt upload to 'tenant-media/{coachA_id}/{clientZ_id}/photo.jpg'

-- must FAIL (second path segment != auth.uid())

-- Attempt read of object at 'tenant-media/{coachA_id}/{clientZ_id}/photo.jpg'

-- must FAIL (second path segment != auth.uid())

-- Test: authenticate as Coach A

-- Upload to 'tenant-media/{coachA_id}/{clientY_id}/photo.jpg'

-- must SUCCEED (coach can access any client folder in tenant)

## Message Recipient Validation

-- Setup: Coach A, Client Y, Client Z (both under Coach A)

-- Test: authenticate as Client Y

INSERT INTO messages (sender_id, recipient_id, coach_id, content)

VALUES (clientY_id, clientZ_id, coachA_id, 'hello');

-- must FAIL (client can only message coach or assigned assistant)

-- Test: authenticate as Assistant X (assigned to Client Y only)

INSERT INTO messages (sender_id, recipient_id, coach_id, content)

VALUES (assistantX_id, clientZ_id, coachA_id, 'hello');

-- must FAIL (assistant can only message assigned clients or own coach)

-- INSERT with recipient = Coach A must SUCCEED

## Column-Level Safety (RPC)

-- Test: authenticate as any user

UPDATE messages SET content = 'hacked' WHERE id = some_message_id;

-- must FAIL (UPDATE revoked; all updates go through RPC)

UPDATE flash_cards SET status = 'green' WHERE id = some_card_id;

-- must FAIL (UPDATE revoked; only notes via RPC)

-- Test: call RPC functions

SELECT public.mark_message_read(some_message_id);

-- must SUCCEED only for the recipient, FAIL for others

SELECT public.update_flash_card_notes(some_card_id, 'new note');

-- must SUCCEED for coach/assigned assistant, FAIL for others

