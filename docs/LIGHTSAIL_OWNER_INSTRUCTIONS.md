# Lightsail Owner Instructions

This is the exact deploy flow for the BetMate Prediction Engine on the current AWS Lightsail instance.

Important:

- This server does **not** use `git pull` inside `/app/bet-mate-engine`.
- `/app/bet-mate-engine` is a deployed app folder, **not** a git repository.
- The working deploy method is:
  1. Clone the latest GitHub code into `/tmp`
  2. Copy the updated app files into `/app/bet-mate-engine/app/`
  3. Restart the FastAPI systemd service
  4. Verify health and route behavior

---

## Lightsail browser SSH steps

1. Open **AWS Lightsail**
2. Open the BetMate instance
3. Click **Connect using SSH**
4. Wait for the browser terminal to open

You should see a prompt similar to:

```bash
ubuntu@ip-172-26-13-149:~$
```

---

## Full deploy commands

Run these commands exactly:

```bash
cd /tmp
rm -rf /tmp/bet-mate-latest
git clone https://github.com/ThunderOpsAI/bet-mate.git bet-mate-latest
grep -n "paper-bets/batch" /tmp/bet-mate-latest/services/prediction-engine/app/main.py
sudo cp -a /tmp/bet-mate-latest/services/prediction-engine/app/. /app/bet-mate-engine/app/
grep -n "paper-bets/batch" /app/bet-mate-engine/app/main.py
sudo systemctl restart bet-mate-engine
sleep 5
sudo systemctl status bet-mate-engine --no-pager
curl http://54.79.12.88/health
curl -i -X POST http://54.79.12.88/api/paper-bets/batch
```

---

## What success looks like

### 1. Route exists in cloned code

This command:

```bash
grep -n "paper-bets/batch" /tmp/bet-mate-latest/services/prediction-engine/app/main.py
```

should return something like:

```text
462:@app.post("/api/paper-bets/batch")
```

### 2. Route exists in deployed code

This command:

```bash
grep -n "paper-bets/batch" /app/bet-mate-engine/app/main.py
```

should also return the route.

### 3. Service restarted correctly

This command:

```bash
sudo systemctl status bet-mate-engine --no-pager
```

should show:

```text
Active: active (running)
```

### 4. Health check passes

This command:

```bash
curl http://54.79.12.88/health
```

should return:

```json
{"status":"ok","service":"advanced-ml-engine"}
```

### 5. Batch route is live

This command:

```bash
curl -i -X POST http://54.79.12.88/api/paper-bets/batch
```

should return:

```text
HTTP/1.1 401 Unauthorized
{"detail":"Missing bearer token"}
```

That `401` is the **good** result for a raw curl. It means:

- nginx is reaching FastAPI
- FastAPI is running
- the route exists
- the old `405 Method Not Allowed` problem is gone

---

## Bad results and what they mean

### If you get this:

```text
HTTP/1.1 405 Method Not Allowed
allow: DELETE
```

It means the deployed code does **not** have the `POST /api/paper-bets/batch` route active.

Usually this means:

- the new code was not copied over correctly, or
- the service did not restart onto the new code

Run the full deploy commands again.

### If you get this:

```text
502 Bad Gateway
```

It means nginx is up, but FastAPI is down or crash-looping.

Run:

```bash
sudo systemctl status bet-mate-engine --no-pager
sudo journalctl -u bet-mate-engine -n 80 --no-pager
```

Look at the bottom of the journal output for the real Python error.

### If the service fails after copying only one file

If the app crashes because `main.py` expects newer support files, copy the full app directory again:

```bash
sudo cp -a /tmp/bet-mate-latest/services/prediction-engine/app/. /app/bet-mate-engine/app/
sudo systemctl restart bet-mate-engine
sleep 5
sudo systemctl status bet-mate-engine --no-pager
```

### If logs mention a missing Python package

Run:

```bash
/app/bet-mate-engine/venv/bin/pip install -r /tmp/bet-mate-latest/services/prediction-engine/requirements.txt
sudo systemctl restart bet-mate-engine
sleep 5
sudo systemctl status bet-mate-engine --no-pager
```

---

## Quick deploy version

Use this when you just want the short repeatable workflow:

```bash
cd /tmp
rm -rf /tmp/bet-mate-latest
git clone https://github.com/ThunderOpsAI/bet-mate.git bet-mate-latest
sudo cp -a /tmp/bet-mate-latest/services/prediction-engine/app/. /app/bet-mate-engine/app/
sudo systemctl restart bet-mate-engine
sleep 5
sudo systemctl status bet-mate-engine --no-pager
curl http://54.79.12.88/health
curl -i -X POST http://54.79.12.88/api/paper-bets/batch
```

---

## Useful terminal notes

- Press `q` to exit `systemctl status` if it opens in a pager
- Press `Ctrl + C` to exit live logs
- Run `exit` to leave the Lightsail SSH session

---

## Final check before leaving

Do not consider the deploy successful until all of these are true:

- `bet-mate-engine` is `active (running)`
- `/health` returns `{"status":"ok","service":"advanced-ml-engine"}`
- `POST /api/paper-bets/batch` returns `401 Missing bearer token`

That means the deploy is live and the route is active.
