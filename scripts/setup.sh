#!/bin/bash
# ============================================================
# Volta Setup Script
# ============================================================
# Prerequisites:
#   - Supabase CLI logged in (supabase login)
#   - Vercel CLI logged in (vercel login)
#   - Alpaca account created (https://app.alpaca.markets/signup)

set -e

echo "=== Volta Setup ==="
echo ""

# 1. Create Supabase project
echo "Step 1: Create Supabase project"
echo "  Go to https://supabase.com/dashboard and create a new project named 'volta'"
echo "  Or use: supabase projects create volta --org-id <your-org-id>"
echo ""
read -p "Enter your Supabase project ref (e.g., abcdefghijklmnop): " SUPABASE_REF

if [ -z "$SUPABASE_REF" ]; then
  echo "Error: Supabase project ref is required"
  exit 1
fi

# 2. Link Supabase
echo ""
echo "Step 2: Linking Supabase project..."
supabase init --force 2>/dev/null || true
supabase link --project-ref "$SUPABASE_REF"

# 3. Run migration
echo ""
echo "Step 3: Running database migration..."
supabase db push

# 4. Run seed data
echo ""
echo "Step 4: Seeding initial agents..."
supabase db execute --file supabase/seed/agents.sql

# 5. Get Supabase keys
echo ""
echo "Step 4: Fetching Supabase keys..."
SUPABASE_URL=$(supabase inspect db url 2>/dev/null || echo "")
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Copy .env.example to .env.local and fill in your keys:"
echo "   cp .env.example .env.local"
echo ""
echo "2. Get your Supabase keys from:"
echo "   https://supabase.com/dashboard/project/$SUPABASE_REF/settings/api"
echo ""
echo "3. Get your Alpaca paper trading keys from:"
echo "   https://app.alpaca.markets/paper/dashboard/overview"
echo ""
echo "4. Add your AI API keys (Anthropic and/or OpenAI)"
echo ""
echo "5. Generate a CRON_SECRET: openssl rand -hex 32"
echo ""
echo "6. Run locally: npm run dev"
echo ""
echo "7. Deploy to Vercel: vercel --prod"
echo "   (Remember to add all env vars in Vercel dashboard)"
echo ""
echo "=== Done ==="
