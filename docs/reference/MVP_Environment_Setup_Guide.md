**Environment Setup Guide**

Coaching Platform — MVP

Supabase • Vercel • Stripe • Expo • R2

# Overview

**This guide walks through setting up every service, tool, and configuration needed before writing any application code. Complete this guide before starting Tier 0 of the Build Sequencing document.**

## Service Inventory

| **Service** | **Purpose** | **Account Needed** | **Free Tier?** |
| --- | --- | --- | --- |
| **Supabase Cloud** | **Database, Auth, Storage, RLS, Realtime** | **supabase.com** | **Yes — 2 projects, 500MB DB, 1GB storage** |
| **Vercel** | **Hosting for Next.js (coach web + admin panel)** | **vercel.com** | **Yes — hobby tier** |
| **Stripe** | **Coach subscription billing** | **stripe.com** | **Yes — test mode free, live mode per-transaction** |
| **Expo / EAS** | **React Native build + push notifications** | **expo.dev** | **Yes — limited builds/month** |
| **Cloudflare R2** | **Backup storage (S3-compatible)** | **cloudflare.com** | **Yes — 10GB free, no egress fees** |
| **GitHub** | **Source code repository** | **github.com** | **Yes** |
| **Node.js** | **Local development runtime** | **nodejs.org** | **Yes — v18+ LTS recommended** |

## Setup Order

**Follow this order. Each step depends on the previous one.**

| **Step** | **Service** | **Produces** |
| --- | --- | --- |
| **1** | **GitHub — Repository** | **Code home, CI base** |
| **2** | **Supabase — Project** | **Database URL, anon key, service role key** |
| **3** | **Supabase — Schema + RLS** | **Tables, constraints, policies, seeds** |
| **4** | **Supabase — Storage** | **Private bucket, Storage RLS** |
| **5** | **Stripe — Account + Products** | **API keys, webhook secret, price IDs** |
| **6** | **Vercel — Project** | **Deployment URL, env vars configured** |
| **7** | **Expo — Project** | **App config, push notification setup** |
| **8** | **Cloudflare R2 — Bucket** | **Backup destination, access keys** |
| **9** | **Local Dev — Environment** | **Running dev server with all services connected** |

# Step 1: GitHub Repository

## Repository Structure

**Monorepo recommended. All three interfaces + shared types in one repo.**

coaching-platform/

├── apps/

│   ├── web/                 # Next.js (coach dashboard + admin panel)

│   └── mobile/              # React Native / Expo (client app)

├── packages/

│   ├── shared/              # Shared types, constants, validation schemas (Zod)

│   └── supabase/            # DB types, migration files, seed scripts

├── supabase/

│   ├── migrations/          # SQL migration files (sequential)

│   ├── seed.sql             # Seed data (roles, permissions, Super Admin)

│   └── config.toml          # Supabase CLI config

├── .env.local               # Local env vars (gitignored)

├── .env.example             # Template (committed, no secrets)

├── .gitignore

├── package.json             # Root workspace config

└── turbo.json               # Turborepo config (optional)

## Git Configuration

**Branch strategy:**

**main — production-ready code. Protected branch. No direct pushes.**

**dev — integration branch. All feature branches merge here first.**

**feature/* — individual task branches (e.g., feature/flash-card-computation).**

**Commits: use conventional commits (feat:, fix:, chore:, docs:). Keeps changelog readable.**

## .gitignore Essentials

node_modules/

.env.local

.env.*.local

.next/

dist/

.expo/

*.tsbuildinfo

.turbo/

coverage/

*CRITICAL: .env.local must be gitignored. It contains service role keys, Stripe secrets, and R2 credentials. Never commit secrets to the repository.*

# Step 2: Supabase Project

## Create Project

**1. Go to supabase.com → New Project.**

**2. Name: coaching-platform (or your preferred name).**

**3. Region: select closest to your primary user base. Recommended: EU (Frankfurt) for Algeria/Europe users.**

**4. Database password: generate a strong random password. Store it in your password manager immediately. You will not see it again.**

**5. Plan: Free tier is sufficient for pilot. Upgrade to Pro before public launch for daily backups and higher limits.**

## Retrieve Keys

**After project creation, go to Settings → API. You need:**

| **Key** | **Where to Find** | **Used For** | **Security Level** |
| --- | --- | --- | --- |
| **Project URL** | **Settings → API → URL** | **Client-side Supabase init** | **Public (safe in frontend)** |
| **Anon Key** | **Settings → API → anon public** | **Client-side Supabase init. Subject to RLS** | **Public (safe in frontend)** |
| **Service Role Key** | **Settings → API → service_role secret** | **Server-side only. Bypasses RLS** | **SECRET — never in frontend** |
| **DB Connection String** | **Settings → Database → Connection string** | **pg_dump backups, migrations** | **SECRET — server/local only** |
| **JWT Secret** | **Settings → API → JWT Settings** | **Token verification (rarely needed directly)** | **SECRET** |

*Service role key and DB connection string must NEVER appear in frontend code, SSR responses, browser-accessible endpoints, or git repositories. Design Rule #11 from the Schema document applies.*

## Install Supabase CLI

npm install -g supabase

supabase login

supabase link --project-ref YOUR_PROJECT_REF

**The CLI lets you manage migrations, run local dev, generate TypeScript types, and push schema changes.**

## Auth Configuration

**In Supabase Dashboard → Authentication → Settings:**

| **Setting** | **Value** | **Why** |
| --- | --- | --- |
| **Site URL** | **Your Vercel deployment URL** | **Redirect target after email confirmation** |
| **Redirect URLs** | **Add localhost:3000 for local dev** | **Dev environment auth flow** |
| **Email confirmations** | **Enabled** | **Required for coach signup flow** |
| **Email templates** | **Customize confirmation + invite emails** | **Professional branding** |
| **Disable signup** | **No (keep enabled)** | **Coaches self-register** |
| **JWT expiry** | **3600 (1 hour)** | **Balance security vs UX. Refresh tokens handle re-auth** |

# Step 3: Schema Deployment

## Migration Strategy

**Use Supabase CLI migrations. Never modify the live database schema manually. Every change goes through a numbered migration file.**

# Create a new migration

supabase migration new create_initial_schema

# This creates: supabase/migrations/TIMESTAMP_create_initial_schema.sql

# Paste your DDL into this file

# Push to remote project

supabase db push

# Generate TypeScript types from live schema

supabase gen types typescript --project-id YOUR_PROJECT_REF > packages/supabase/database.types.ts

## Migration File Order

**Create migrations in this exact order (matches Schema document):**

| **Migration** | **Content** |
| --- | --- |
| **001_create_enums** | **All enum types (status, role_type, trial_status, plan_type, etc.)** |
| **002_create_tables** | **All 20 tables with columns, PKs, FKs, defaults** |
| **003_composite_constraints** | **UNIQUE(id, coach_id) on parent tables + composite FKs on children** |
| **004_indexes** | **All recommended indexes (dashboard, messaging, daily_logs, flash_cards, absence)** |
| **005_triggers** | **Role-type enforcement, roles.locked, role_permissions locked** |
| **006_private_schema** | **CREATE SCHEMA private + all 5 helper functions** |
| **007_rls_enable** | **ALTER TABLE ... ENABLE ROW LEVEL SECURITY on all 20 tables** |
| **008_rls_policies** | **All RLS policies for all 20 tables** |
| **009_rpc_functions** | **All 20 RPC functions (public schema)** |
| **010_revoke_grants** | **REVOKE UPDATE on messages/flash_cards + GRANT EXECUTE on RPCs** |
| **011_storage_policies** | **Storage RLS policies on storage.objects** |
| **012_seed_data** | **Seed roles (locked=true), role_permissions, Super Admin user** |

*Run migrations sequentially. If any migration fails, fix it before proceeding. Do not skip migrations.*

## Type Generation

**After schema deployment, generate TypeScript types:**

supabase gen types typescript --project-id YOUR_PROJECT_REF \

> packages/supabase/database.types.ts

**Import these types in both web and mobile apps for type-safe Supabase queries. Regenerate after every migration.**

# Step 4: Supabase Storage

## Create Bucket

**In Supabase Dashboard → Storage → New Bucket:**

| **Setting** | **Value** | **Why** |
| --- | --- | --- |
| **Bucket name** | **tenant-media** | **Matches Storage RLS policies and path convention** |
| **Public** | **NO — private** | **Public buckets bypass retrieval access control entirely** |
| **File size limit** | **5MB** | **Prevents abuse. Enforced at bucket level** |
| **Allowed MIME types** | **image/jpeg, image/png** | **Only meal photos and VIP images** |

*CRITICAL: the bucket must be PRIVATE. Public buckets bypass all access control for downloads. Anyone with the URL can access files in a public bucket. This would break tenant isolation completely.*

## Storage RLS

**Storage RLS policies are deployed via migration 011_storage_policies. They enforce:**

**1. INSERT: coach can upload to any client folder in tenant. Client can upload only to own folder ({coach_id}/{client_id}/{filename}). Path segments validated.**

**2. SELECT: same scoping. Coach sees all tenant media. Assistant sees assigned client media. Client sees own media only.**

**3. DELETE: coach only.**

**4. No UPDATE policy: files are immutable. Upload new, delete old.**

## Verify Bucket Configuration

# After setup, verify via Supabase Dashboard:

# Storage → tenant-media → Settings

# Confirm: Public = OFF, File size limit = 5242880 (5MB)

# Confirm: Allowed MIME types = image/jpeg, image/png

# Test: try uploading a file without auth → must fail

# Test: try uploading a .exe file → must fail

# Step 5: Stripe

## Account Setup

**1. Create account at stripe.com.**

**2. Start in TEST MODE. Do not activate live mode until ready for paid rollout.**

**3. Complete business verification (can be done later, required for live mode).**

## Create Product + Price

**In Stripe Dashboard → Products → Add Product:**

| **Field** | **Value** |
| --- | --- |
| **Product name** | **Coaching Platform — MVP Tier** |
| **Pricing model** | **Recurring** |
| **Price** | **Set your price (to be finalized after test period)** |
| **Billing period** | **Monthly** |
| **Currency** | **EUR or USD (your primary market currency)** |

**After creation, copy the Price ID (starts with price_). You need this in your env vars.**

## Retrieve Keys

| **Key** | **Where** | **Used For** | **Security** |
| --- | --- | --- | --- |
| **Publishable key** | **Developers → API keys** | **Frontend: Stripe.js, Checkout redirect** | **Public (safe in frontend)** |
| **Secret key** | **Developers → API keys** | **Server-side: create sessions, manage subscriptions** | **SECRET — server only** |
| **Webhook signing secret** | **Developers → Webhooks (after endpoint creation)** | **Verify webhook payloads** | **SECRET — server only** |
| **Price ID** | **Products → your product → price** | **Reference in checkout session creation** | **Public (not sensitive)** |

## Configure Webhook

**In Stripe Dashboard → Developers → Webhooks → Add Endpoint:**

| **Setting** | **Value** |
| --- | --- |
| **Endpoint URL** | **https://your-vercel-domain.com/api/stripe/webhook** |
| **Events to listen for** | **customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed** |
| **API version** | **Latest** |

**After creation, copy the Webhook Signing Secret (starts with whsec_).**

## Local Testing with Stripe CLI

# Install Stripe CLI

brew install stripe/stripe-cli/stripe  # macOS

# or download from https://stripe.com/docs/stripe-cli

# Login

stripe login

# Forward webhooks to local dev server

stripe listen --forward-to localhost:3000/api/stripe/webhook

# This outputs a webhook signing secret for local dev

# Add it to .env.local as STRIPE_WEBHOOK_SECRET

# Trigger test events

stripe trigger customer.subscription.created

# Step 6: Vercel

## Project Setup

**1. Go to vercel.com → Import Git Repository → select your GitHub repo.**

**2. Root Directory: apps/web (the Next.js app).**

**3. Framework Preset: Next.js (auto-detected).**

**4. Build Command: next build (or turbo run build if using Turborepo).**

**5. Output Directory: .next (default).**

## Environment Variables

**In Vercel → Project Settings → Environment Variables, add all variables from the Environment Variables Reference section below. Set them for Production, Preview, and Development environments as appropriate.**

*Vercel encrypts environment variables at rest. They are injected at build time and runtime. They are not visible in client-side bundles unless prefixed with NEXT_PUBLIC_.*

## Deployment Configuration

| **Setting** | **Value** | **Notes** |
| --- | --- | --- |
| **Node.js version** | **18.x** | **Match your local dev version** |
| **Build command** | **next build** | **Or turbo run build for monorepo** |
| **Install command** | **npm install** | **Or pnpm install if using pnpm** |
| **Framework** | **Next.js** | **Auto-detected** |
| **Region** | **EU (Frankfurt) — fra1** | **Match Supabase region for lowest latency** |

## Cron Jobs (vercel.json)

**Vercel Cron triggers your API routes on a schedule. Add to vercel.json:**

{

"crons": [

{

"path": "/api/flash-cards/compute",

"schedule": "0 * * * *"

},

{

"path": "/api/absence/detect",

"schedule": "0 */6 * * *"

},

{

"path": "/api/absence/send-reminder",

"schedule": "30 */6 * * *"

},

{

"path": "/api/subscriptions/check-expiry",

"schedule": "0 2 * * *"

},

{

"path": "/api/backup/database",

"schedule": "0 0 * * *"

},

{

"path": "/api/backup/cleanup",

"schedule": "30 0 * * *"

}

]

}

*Vercel Hobby plan: cron jobs run once/day max. Pro plan: up to every minute. For hourly flash card computation, you need Vercel Pro or use Supabase pg_cron as an alternative.*

# Step 7: Expo / React Native

## Project Initialization

cd apps/

npx create-expo-app mobile --template blank-typescript

cd mobile

npx expo install expo-dev-client

**Use Expo with dev builds (not managed workflow) for full native module access.**

## Key Dependencies

npx expo install @supabase/supabase-js

npx expo install @react-native-async-storage/async-storage

npx expo install expo-image-picker

npx expo install expo-notifications

npx expo install expo-secure-store

npx expo install react-native-url-polyfill

## Supabase Client Setup

// lib/supabase.ts

import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Database } from '../../packages/supabase/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {

auth: {

storage: AsyncStorage,

autoRefreshToken: true,

persistSession: true,

detectSessionInUrl: false,

},

});

## Push Notifications (Expo)

**Expo Push Notifications wrap FCM (Android) and APNs (iOS). Setup:**

**1. Register for push tokens in the app on first login.**

**2. Store the push token in platform_users or a dedicated push_tokens table (post-MVP consideration).**

**3. Server sends push via Expo Push API when: new message, absence reminder, subscription renewal.**

*For MVP pilot, push notifications can be deferred. In-app indicators (unread badges) are sufficient initially. Push becomes important before public launch.*

## Build & Distribution

| **Platform** | **Method** | **Notes** |
| --- | --- | --- |
| **Android** | **Direct APK via EAS Build** | **npx eas build --platform android --profile preview. Distribute APK directly to pilot users** |
| **iOS** | **TestFlight via EAS Build** | **npx eas build --platform ios --profile preview. Requires Apple Developer account ($99/year). Distribute via TestFlight invite** |

# Build for both platforms

npx eas build --platform all --profile preview

# For development builds (local testing on device)

npx eas build --platform android --profile development

## app.json Configuration

{

"expo": {

"name": "Coaching App",

"slug": "coaching-app",

"version": "1.0.0",

"orientation": "portrait",

"scheme": "coaching-app",

"ios": {

"bundleIdentifier": "com.yourcompany.coachingapp",

"supportsTablet": false

},

"android": {

"package": "com.yourcompany.coachingapp",

"adaptiveIcon": { "backgroundColor": "#1B3A5C" }

},

"plugins": [

"expo-notifications",

"expo-image-picker",

"expo-secure-store"

]

}

}

# Step 8: Cloudflare R2 (Backup Storage)

*Recommended for pilot. Required before public launch. Skip this step if deferring backup to later.*

## Setup

**1. Create Cloudflare account at cloudflare.com.**

**2. Go to R2 Object Storage → Create Bucket.**

**3. Bucket name: coaching-platform-backups.**

**4. Location: Automatic (or EU if you want data residency).**

## API Credentials

**Go to R2 → Manage R2 API Tokens → Create API Token:**

| **Setting** | **Value** |
| --- | --- |
| **Token name** | **coaching-platform-backup** |
| **Permissions** | **Object Read & Write** |
| **Bucket scope** | **coaching-platform-backups only** |
| **TTL** | **No expiry (or rotate quarterly)** |

**After creation, copy:**

| **Credential** | **Env Var Name** | **Used For** |
| --- | --- | --- |
| **Account ID** | **R2_ACCOUNT_ID** | **R2 endpoint construction** |
| **Access Key ID** | **R2_ACCESS_KEY_ID** | **S3-compatible auth** |
| **Secret Access Key** | **R2_SECRET_ACCESS_KEY** | **S3-compatible auth** |
| **Bucket name** | **R2_BUCKET_NAME** | **Target bucket** |

## Server Usage (S3-compatible)

// R2 is S3-compatible. Use AWS SDK:

npm install @aws-sdk/client-s3

// lib/r2.ts

import { S3Client } from '@aws-sdk/client-s3';

export const r2 = new S3Client({

region: 'auto',

endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,

credentials: {

accessKeyId: process.env.R2_ACCESS_KEY_ID!,

secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,

},

});

# Step 9: Local Development

## Prerequisites

| **Tool** | **Version** | **Install** |
| --- | --- | --- |
| **Node.js** | **18.x LTS+** | **nodejs.org or nvm** |
| **npm** | **9+** | **Bundled with Node.js** |
| **Supabase CLI** | **Latest** | **npm install -g supabase** |
| **Stripe CLI** | **Latest** | **brew install stripe/stripe-cli/stripe** |
| **Expo CLI** | **Latest** | **npx expo (no global install needed)** |
| **Git** | **Latest** | **git-scm.com** |

## Initial Setup

# Clone and install

git clone git@github.com:your-org/coaching-platform.git

cd coaching-platform

npm install

# Copy env template

cp .env.example .env.local

# Fill in all values from the Environment Variables Reference

# Link Supabase project

supabase link --project-ref YOUR_PROJECT_REF

# Push migrations (if not already deployed)

supabase db push

# Generate types

supabase gen types typescript --project-id YOUR_PROJECT_REF \

> packages/supabase/database.types.ts

## Run Development Servers

# Terminal 1: Next.js web app

cd apps/web

npm run dev

# → http://localhost:3000

# Terminal 2: React Native mobile (Expo)

cd apps/mobile

npx expo start --dev-client

# Scan QR code with Expo Go or dev client on device

# Terminal 3: Stripe webhook forwarding

stripe listen --forward-to localhost:3000/api/stripe/webhook

## Supabase Local Dev (Optional)

**For fully local development without hitting the remote Supabase project:**

supabase start

# Starts local Postgres, Auth, Storage, Studio

# Local Studio: http://localhost:54323

# Update .env.local to point to local URLs

*Local Supabase is useful for fast iteration and testing migrations. Use remote Supabase for integration testing and staging.*

# Environment Variables Reference

**Complete list of all environment variables needed across all services.**

## .env.local (Full Reference)

| **Variable** | **Source** | **Used By** | **Security** |
| --- | --- | --- | --- |
| **NEXT_PUBLIC_SUPABASE_URL** | **Supabase → Settings → API** | **Web + Mobile** | **Public** |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | **Supabase → Settings → API** | **Web + Mobile** | **Public** |
| **SUPABASE_SERVICE_ROLE_KEY** | **Supabase → Settings → API** | **Server routes only** | **SECRET** |
| **SUPABASE_DB_URL** | **Supabase → Settings → Database** | **Migrations, pg_dump** | **SECRET** |
| **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** | **Stripe → API keys** | **Web frontend** | **Public** |
| **STRIPE_SECRET_KEY** | **Stripe → API keys** | **Server routes only** | **SECRET** |
| **STRIPE_WEBHOOK_SECRET** | **Stripe → Webhooks** | **Webhook handler only** | **SECRET** |
| **STRIPE_PRICE_ID** | **Stripe → Products → Price** | **Checkout session creation** | **Public** |
| **R2_ACCOUNT_ID** | **Cloudflare → R2** | **Backup routes** | **SECRET** |
| **R2_ACCESS_KEY_ID** | **Cloudflare → R2 API Tokens** | **Backup routes** | **SECRET** |
| **R2_SECRET_ACCESS_KEY** | **Cloudflare → R2 API Tokens** | **Backup routes** | **SECRET** |
| **R2_BUCKET_NAME** | **Your bucket name** | **Backup routes** | **Config** |
| **EXPO_PUBLIC_SUPABASE_URL** | **Same as NEXT_PUBLIC_SUPABASE_URL** | **Mobile app** | **Public** |
| **EXPO_PUBLIC_SUPABASE_ANON_KEY** | **Same as NEXT_PUBLIC_SUPABASE_ANON_KEY** | **Mobile app** | **Public** |

## .env.example Template

**Commit this file to the repo (no real values):**

# Supabase

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

SUPABASE_DB_URL=postgresql://postgres:password@db.YOUR_PROJECT.supabase.co:5432/postgres

# Stripe

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

STRIPE_SECRET_KEY=sk_test_...

STRIPE_WEBHOOK_SECRET=whsec_...

STRIPE_PRICE_ID=price_...

# Cloudflare R2 (backup)

R2_ACCOUNT_ID=your-account-id

R2_ACCESS_KEY_ID=your-access-key

R2_SECRET_ACCESS_KEY=your-secret-key

R2_BUCKET_NAME=coaching-platform-backups

# Expo (mobile)

EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co

EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Security Checklist

**Verify all items before first deployment.**

| **Check** | **Verified?** |
| --- | --- |
| **.env.local is in .gitignore** |  |
| **No secrets in committed files (grep for sk_test, whsec_, service_role)** |  |
| **Supabase service role key only in server-side code** |  |
| **NEXT_PUBLIC_ prefix only on non-secret values** |  |
| **Storage bucket is PRIVATE (not public)** |  |
| **Storage bucket has file size limit (5MB) and MIME type restrictions** |  |
| **RLS is enabled on all 20 tables** |  |
| **RLS acceptance tests pass (cross-tenant, participant, assignment, storage)** |  |
| **Stripe webhook endpoint uses signature verification** |  |
| **R2 API token is scoped to backup bucket only** |  |
| **No service keys in mobile app code (only anon key)** |  |
| **Expo app uses expo-secure-store for auth tokens, not AsyncStorage for secrets** |  |
| **Vercel env vars are set for Production environment** |  |
| **Database password is in password manager, not in any file** |  |

# Post-Setup Verification

**After completing all steps, verify the full stack works:**

| **Test** | **Expected Result** |
| --- | --- |
| **Visit Supabase Studio → Table Editor** | **All 20 tables visible with columns** |
| **Run: supabase gen types** | **TypeScript types generated without errors** |
| **Visit localhost:3000** | **Next.js app loads (even if blank)** |
| **Visit Supabase → Storage → tenant-media** | **Bucket exists, private, empty** |
| **Run: stripe listen --forward-to localhost:3000/api/stripe/webhook** | **Stripe CLI connects, ready to forward** |
| **Run: stripe trigger customer.subscription.created** | **Webhook received at localhost** |
| **Run: npx expo start** | **Expo dev server starts, QR code shown** |
| **Connect mobile device to Expo** | **App loads on device** |
| **Run: supabase db push (no-op if already deployed)** | **No pending migrations** |
| **Query: SELECT * FROM roles** | **Seeded roles visible (Assistant, Senior Assistant, Billing Operations)** |
| **Query: SELECT * FROM platform_users WHERE role_type = 'super_admin'** | **Super Admin user exists** |

**If all verifications pass, the environment is ready. Proceed to Tier 0 of the Build Sequencing document.**

# Common Issues

| **Problem** | **Cause** | **Fix** |
| --- | --- | --- |
| **RLS blocks all queries** | **Policies not deployed or not matching user role** | **Check RLS is enabled + policies exist. Test with Supabase SQL Editor using SET ROLE** |
| **Stripe webhook 400 error** | **Signature mismatch** | **Use the local webhook secret from stripe listen, not the dashboard secret** |
| **Expo build fails** | **Missing native dependencies** | **Run npx expo install to sync. Check app.json plugins array** |
| **Supabase types outdated** | **Schema changed without regenerating** | **Run supabase gen types again** |
| **Storage upload 403** | **Bucket is public or RLS policy missing** | **Verify bucket is private + INSERT policy exists on storage.objects** |
| **CORS errors on web** | **Supabase URL mismatch** | **Verify NEXT_PUBLIC_SUPABASE_URL matches your project URL exactly** |
| **Mobile auth not persisting** | **AsyncStorage not configured** | **Ensure @react-native-async-storage/async-storage is installed and passed to createClient** |

