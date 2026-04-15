# Bet-Mate Debug Handoff
> You are acting as a debug agent. Read this brief, then work through the checklist top-to-bottom.

## What Was Done

- **3 Codex PRs merged** (#8 blackbook endpoints + tests, #9 user_id scoping, #10 paper bets UI revamp)
- **Blackbook auto-bet built**: Watch button on racing page → PUT `/blackbook/{runner}/auto-bet` → stores probability threshold, stake, phone/email/pushover → triggers paper bet + notification when ML model prediction exceeds threshold
- **Notifications module** (`app/notifications.py`): Twilio SMS, Resend email, Pushover push — all run in daemon thread, never block predictions
- **Railway EU → Lightsail Sydney migration**: engine now on `54.79.12.88`, Betfair reachable from AU
- **nginx on port 80** → FastAPI on port 8000 (Lightsail firewall only exposes 80)
- **Vercel proxy rewrite**: browser hits `/api/ml-proxy/*` → Vercel server proxies → `http://54.79.12.88/*`
- **40/40 tests passing** including 3 new blackbook trigger tests

## Proxy Chain
```
Browser → https://[vercel]/api/ml-proxy/api/races/today
        → next.config.mjs rewrite (server-side, no CORS)
        → http://54.79.12.88/api/races/today  (nginx port 80)
        → http://127.0.0.1:8000/api/races/today  (FastAPI)
```

## Required Vercel Env Vars
| Var | Value |
|-----|-------|
| `NEXT_PUBLIC_ML_API` | `/api/ml-proxy` |
| `ML_API_PROXY_TARGET` | `http://54.79.12.88:8000` *(code normalises :8000 → 80 automatically)* |

## Local .env.local (apps/web/.env.local — already set)
```
NEXT_PUBLIC_ML_API=/api/ml-proxy
ML_API_PROXY_TARGET=http://54.79.12.88
```

---

## Debug Checklist

### 1. Lightsail engine alive?
```bash
curl http://54.79.12.88/health
# → {"status":"ok","service":"advanced-ml-engine"}

curl http://54.79.12.88/api/races/today | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('races',[])), 'races')"
# → 10-20 races (Betfair live data)
```
If down → SSH and check service:
```bash
ssh -i ~/.ssh/lightsail_key.pem ubuntu@54.79.12.88 "sudo systemctl status bet-mate-engine"
sudo journalctl -u bet-mate-engine -n 50
sudo systemctl restart bet-mate-engine
```

### 2. Vercel proxy working?
Browser devtools → Network tab → reload `/racing`:
- Find request to `/api/ml-proxy/api/races/today`
- **200** ✓ proxy works
- **502/504** → engine is down (fix step 1)
- **404** → `ML_API_PROXY_TARGET` missing from Vercel dashboard
- **No request** → `NEXT_PUBLIC_ML_API` missing from Vercel dashboard → add + redeploy

### 3. Vercel dashboard env vars set?
Vercel → bet-mate project → Settings → Environment Variables → Production:
- `NEXT_PUBLIC_ML_API` = `/api/ml-proxy`
- `ML_API_PROXY_TARGET` = `http://54.79.12.88:8000`

Missing? Add it then **Redeploy** (Deployments → ··· → Redeploy).

### 4. CORS error in browser console?
Means browser is calling Lightsail directly (not via proxy).
`NEXT_PUBLIC_ML_API` is wrong — must be `/api/ml-proxy`, not the IP.
Fix in Vercel dashboard + redeploy.

If CORS persists after fix, SSH to Lightsail and confirm:
```bash
grep BETMATE_CORS_ORIGINS /app/bet-mate-engine/.env
# Must include your Vercel production domain
# Edit file and: sudo systemctl restart bet-mate-engine
```

### 5. Local dev blank?
```bash
cat apps/web/.env.local | grep ML_API
# Should show:
# NEXT_PUBLIC_ML_API=/api/ml-proxy
# ML_API_PROXY_TARGET=http://54.79.12.88
pnpm dev   # restart required after .env.local changes
```

### 6. Backend tests
```bash
cd services/prediction-engine
python -m pytest tests/ -v --tb=short
# Expected: 40 passed
```

### 7. Useful SSH commands
```bash
ssh -i ~/.ssh/lightsail_key.pem ubuntu@54.79.12.88
sudo systemctl status bet-mate-engine nginx
sudo journalctl -u bet-mate-engine -f   # live logs
sudo systemctl restart bet-mate-engine
sudo nginx -t && sudo systemctl restart nginx
```
