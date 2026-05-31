# Catalyst Trading Dashboard

AI-powered institutional-grade trading intelligence dashboard.
Live data · Drill-down analysis · 15%+ opportunity screening

---

## Deploy to Vercel in 5 Steps (Free)

### Step 1 — Get your Anthropic API Key
1. Go to console.anthropic.com
2. Click API Keys → Create Key
3. Copy the key (starts with sk-ant-...)

### Step 2 — Upload to GitHub
1. Go to github.com → New Repository → Name it "catalyst-dashboard"
2. Upload all files from this folder (drag and drop)
3. Click Commit

### Step 3 — Deploy on Vercel
1. Go to vercel.com → Sign up free with your GitHub account
2. Click "Add New Project"
3. Select your "catalyst-dashboard" repository
4. Click Deploy

### Step 4 — Add your API Key
1. In Vercel → your project → Settings → Environment Variables
2. Name: ANTHROPIC_API_KEY
3. Value: your key from Step 1
4. Click Save
5. Go to Deployments → click the three dots → Redeploy

### Step 5 — Share
Your dashboard is now live at:
  https://your-project-name.vercel.app

Share that URL with anyone.

---

## Running Locally (Optional)

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your API key
npm run dev
# Open http://localhost:3000
```

---

## File Structure

```
catalyst-app/
├── src/app/
│   ├── api/claude/route.js    ← Secure API proxy (server-side only)
│   ├── components/Dashboard.js ← Main UI
│   ├── layout.js
│   └── page.js
├── .env.example               ← Copy to .env.local for local dev
├── .gitignore                 ← Keeps your API key out of GitHub
├── next.config.js
└── package.json
```

---

## Costs

Vercel hosting: FREE (up to 100GB bandwidth/month)
Anthropic API: ~$0.01–0.05 per dashboard refresh depending on response length

To control costs, add users only you trust — every refresh calls the API.

---

## Adding Access Control (Optional)

To restrict who can use it, add a simple password in your .env.local:
  DASHBOARD_PASSWORD=your_chosen_password

Then update /src/app/api/claude/route.js to check:
  const { prompt, mode, password } = body
  if (password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

And add a password prompt to Dashboard.js before the tabs render.
