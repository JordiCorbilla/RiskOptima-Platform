# On-Prem Deployment

This guide describes a local server deployment for RiskOptima Platform `0.3.1` with the pinned `riskoptima==2.7.1` package.

The recommended v1 deployment is Docker Compose on a single internal server. It runs one public web endpoint and keeps the FastAPI portfolio API plus the .NET economic-calendar API behind the frontend Nginx proxy.

## Topology

```text
Browser
  |
  | http://riskoptima.internal:8080
  v
Nginx frontend container
  |-- /api/*          -> FastAPI portfolio platform
  |-- /calendar-api/* -> .NET economic calendar API
  |-- /*              -> React/Vite static app

Persistent storage:
  riskoptima-sqlite volume          SQLite portfolio database
  riskoptima-generated-runs volume  cached report/chart/run artifacts
  economic-calendar/data            calendar SQLite DB and seed JSON
```

## Prerequisites

- Docker Engine and Docker Compose v2. Legacy `docker-compose` v1 also works with the current file, but v2 is preferred.
- Git access to the repository.
- Outbound internet access during image build to install Python, npm, .NET, and RiskOptima dependencies.
- Internal DNS name or static IP for the server, for example `riskoptima.internal`.

## Quick Start

From the repository root:

```powershell
docker compose up -d --build
```

If the server only has legacy Compose:

```powershell
docker-compose up -d --build
```

Open:

```text
http://localhost:8080
```

For an internal DNS name, point users to:

```text
http://riskoptima.internal:8080
```

Operational checks:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
Invoke-RestMethod http://localhost:8080/api/library/metadata
Invoke-RestMethod http://localhost:8080/calendar-api/events/today
```

Expected health shape:

```json
{
  "status": "ok",
  "platform_version": "0.3.1",
  "riskoptima_version": "2.7.1"
}
```

## RiskOptima Platform 0.3.1 Launch Runbook

Use this when releasing the current `main` branch to the on-prem server.
If the server has legacy Compose only, replace `docker compose` with `docker-compose` in the commands below.

1. Connect to the server and move to the deployment folder:

```powershell
cd C:\deploy\RiskOptima-Platform
```

2. Pull the release:

```powershell
git fetch origin
git checkout main
git pull --ff-only origin main
git log -1 --oneline
```

3. Confirm the pinned versions:

```powershell
Select-String -Path backend\requirements.txt -Pattern "riskoptima==2.7.1"
Select-String -Path backend\app\core\version.py -Pattern '0.3.1'
```

4. Build and start:

```powershell
docker compose up -d --build
```

Legacy Compose alternative:

```powershell
docker-compose up -d --build
```

5. Check containers:

```powershell
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
docker compose logs --tail=100 calendar
```

6. Verify the release:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
Invoke-RestMethod http://localhost:8080/api/library/metadata
Invoke-RestMethod http://localhost:8080/api/rates/sofr-curve
Invoke-RestMethod http://localhost:8080/calendar-api/events/today
```

7. Browser smoke test:

- Open `http://riskoptima.internal:8080` or `http://<server-ip>:8080`.
- Load `Vanguard Multi-Asset Model`.
- Click **Generate** and confirm the risk dashboard renders.
- Open **RiskOptima Explorer** and confirm RiskOptima `2.7.1` plus platform `0.3.1`.
- Run the `Packaged Sample Data` example.
- Open **Rates Workbench**, **Options Workbench**, **Backtest Studio**, and **Economic Calendar**.

## Ports

| Port | Service | Purpose |
| --- | --- | --- |
| `8080` | frontend Nginx | Main user-facing app |
| `127.0.0.1:8000` | FastAPI | Local-only direct API diagnostics on the server |
| `127.0.0.1:5176` | calendar API | Local-only economic-calendar diagnostics on the server |

For normal users, expose only `8080` internally. The direct diagnostic ports are bound to loopback by default; reach them from the server itself or through the Nginx frontend paths `/api` and `/calendar-api`.

## Persistent Data

Docker Compose persists portfolio data in named volumes:

- `riskoptima-sqlite`
- `riskoptima-generated-runs`

The economic calendar uses:

```text
economic-calendar/data
```

Back up all three locations before upgrades. For a simple server backup:

```powershell
docker compose stop
docker run --rm -v riskoptima-platform_riskoptima-sqlite:/data -v ${PWD}:/backup alpine tar czf /backup/riskoptima-sqlite.tgz -C /data .
docker run --rm -v riskoptima-platform_riskoptima-generated-runs:/data -v ${PWD}:/backup alpine tar czf /backup/riskoptima-generated-runs.tgz -C /data .
Compress-Archive -Path economic-calendar/data -DestinationPath economic-calendar-data.zip -Force
docker compose start
```

Volume names can include the folder name as a prefix. Confirm exact names with:

```powershell
docker volume ls
```

## Environment

Backend settings use the `RISKOPTIMA_PLATFORM_` prefix. See `backend/.env.example`.

Important settings:

```text
RISKOPTIMA_PLATFORM_DATABASE_PATH=/app/data/riskoptima_platform.db
RISKOPTIMA_PLATFORM_GENERATED_DATA_PATH=/app/generated_data
RISKOPTIMA_PLATFORM_CORS_ORIGINS=["http://riskoptima.internal:8080"]
```

Use `RISKOPTIMA_PLATFORM_RISKOPTIMA_PATH` only for local library development. Production should use the pinned PyPI dependency in `backend/requirements.txt`.

## Reverse Proxy

The included frontend container already proxies `/api` and `/calendar-api`. If you place IIS, Nginx, Apache, or a load balancer in front of Docker, forward traffic to the frontend container on port `8080`.

Example external Nginx server block:

```nginx
server {
  listen 80;
  server_name riskoptima.internal;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Service-Style Install Without Docker

Use this only when containers are not allowed.

Backend:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend:

```powershell
cd frontend/app
npm install
npm run build
```

Serve `frontend/app/dist` behind IIS or Nginx and configure:

- `/api/*` -> `http://127.0.0.1:8000/api/*`
- `/calendar-api/*` -> `http://127.0.0.1:5176/api/*`
- all other routes -> `index.html`

Economic calendar API:

```powershell
cd economic-calendar
dotnet run --project RiskOptima.EconomicCalendar.Api --urls http://0.0.0.0:5176
```

For long-running Windows services, use your standard service manager, Task Scheduler, NSSM, or IIS reverse-proxy process model. Keep the data directories outside temporary build folders.

## Upgrade Procedure

1. Back up SQLite and generated run data.
2. Pull the target repository version.
3. Review `backend/requirements.txt` for the RiskOptima package version.
4. Rebuild and restart:

```powershell
docker compose pull
docker compose up -d --build
```

5. Verify:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
Invoke-RestMethod http://localhost:8080/api/library/metadata
```

6. In the UI, load a sample portfolio, generate a run, open RiskOptima Explorer, Options Workbench, Rates Workbench, Backtest Studio, and Economic Calendar.

## Rollback

1. Stop services:

```powershell
docker compose stop
```

2. Check out the previous known-good commit or release tag.
3. Restore the backed-up volumes/data if the new build changed stored data.
4. Rebuild and restart:

```powershell
docker compose up -d --build
```

## Security Notes

- v1 has no authentication. Expose it only on a trusted internal network or behind your corporate access layer.
- Use HTTPS at the outer reverse proxy if users connect over shared networks.
- Do not mount a writable local RiskOptima checkout in production.
- Treat `backend/generated_data` as internal analytical output; it can include portfolio definitions and run artifacts.

## Quality Checklist

Before handing the server to users:

- `GET /api/health` returns `ok`.
- `GET /api/library/metadata` shows the expected RiskOptima version.
- The main app loads from a single URL.
- Portfolio sample load, generate, force recalculation, and cached run reload work.
- Risk, Optimization, Signals, Workbench, Renders, Options Workbench, Backtest Studio, and Economic Calendar are reachable.
- Backups include portfolio SQLite, generated run artifacts, and calendar data.
