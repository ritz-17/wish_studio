# Deploying Wish Studio to AWS (single EC2 server)

This guide puts the whole app on one EC2 server and sets up GitHub Actions so that every push to `main` deploys automatically.

```
                         GitHub Actions
  push to main ──▶ CI (lint, typecheck, build) ──▶ build Docker images ──▶ push to GHCR
                                                                              │
                                                       ssh: pull images + restart
                                                                              ▼
  Browser ──http──▶ EC2 ┌─ Caddy :80 ─┬─ /api/*, /ws ──▶ api (Express + WebSocket)
                        │             └─ everything else ──▶ web (Next.js)
                        └─ postgres (data on a Docker volume, not exposed to the internet)
```

| File | What it does |
| --- | --- |
| `apps/web/Dockerfile`, `apps/api/Dockerfile` | Build the two app images |
| `docker-compose.prod.yml` | Runs Postgres, API, web and Caddy on the server |
| `deploy/Caddyfile` | Routes `/api` and `/ws` to the API, everything else to the web app |
| `deploy/deploy.sh` | Runs on the server: pull images, migrate the database, restart, health check |
| `deploy/server.env.example` | Template for the server's `.env` |
| `.github/workflows/ci.yml` | Lint, typecheck and build on every pull request and branch push |
| `.github/workflows/deploy.yml` | On push to `main`: CI, build and push images, deploy to EC2 |

Do the steps in order. Pushing to GitHub comes last because the first push triggers a deploy.

---

## Part 1: AWS

### 1. Set a billing alarm (2 minutes, do this first)

AWS console → **Billing and Cost Management → Budgets → Create budget** → *Monthly cost budget*, amount `$20`, your email. That way any unexpected charge reaches you by email.

### 2. Pick a region

Top-right of the console. Choose the one closest to your users (e.g. `ap-south-1` Mumbai, `us-east-1` N. Virginia, `eu-west-2` London) and use it for everything below.

### 3. Create an SSH key pair

**EC2 → Key Pairs → Create key pair**

- Name: `wish-studio`
- Type: `ED25519`, format: `.pem`

The browser downloads `wish-studio.pem`. Move it somewhere safe and lock it down:

```bash
mkdir -p ~/.ssh && mv ~/Downloads/wish-studio.pem ~/.ssh/ && chmod 400 ~/.ssh/wish-studio.pem
```

### 4. Launch the server

**EC2 → Instances → Launch instances**

| Setting | Value |
| --- | --- |
| Name | `wish-studio` |
| AMI | **Ubuntu Server 24.04 LTS**, architecture **64-bit (x86)**. The images are built for x86, so don't pick Arm. |
| Instance type | `t3.small` (2 GB RAM, recommended) or `t3.micro` (1 GB, works with the swap file in step 7) |
| Key pair | `wish-studio` |
| Network → Security group | Create new, with the three rules below |
| Storage | `20` GiB, `gp3` |

Security group inbound rules:

| Type | Port | Source | Why |
| --- | --- | --- | --- |
| SSH | 22 | Anywhere (0.0.0.0/0) | GitHub Actions connects from changing IPs. Logins are key-only. |
| HTTP | 80 | Anywhere | The website |
| HTTPS | 443 | Anywhere | For when you add a domain later |

Click **Launch instance**.

### 5. Give it a permanent IP (Elastic IP)

Without this, the IP changes every time the server stops.

**EC2 → Elastic IPs → Allocate Elastic IP address → Allocate**, then **Actions → Associate Elastic IP address** → pick the `wish-studio` instance → **Associate**.

Write the IP down. This guide calls it `YOUR_IP`.

### 6. Connect to the server

```bash
ssh -i ~/.ssh/wish-studio.pem ubuntu@YOUR_IP
```

Type `yes` when it asks about the fingerprint.

### 7. Install Docker and prepare the server

Paste this into the server's terminal:

```bash
sudo apt-get update && sudo apt-get upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# 2 GB swap so builds/updates don't run out of memory on small instances
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# App folder that GitHub Actions deploys into
sudo mkdir -p /opt/wish-studio && sudo chown ubuntu:ubuntu /opt/wish-studio
```

Log out (`exit`) and SSH back in so the `docker` group takes effect, then check:

```bash
docker run --rm hello-world
```

### 8. Create the server's `.env`

Still on the server:

```bash
openssl rand -hex 24          # copy the output: this is your database password
nano /opt/wish-studio/.env
```

Paste the following, replacing the three placeholder values:

```bash
POSTGRES_PASSWORD=<the openssl output>
WEB_ORIGINS=http://YOUR_IP
SITE_ADDRESS=:80
IMAGE_PREFIX=ghcr.io/<your-github-username-in-lowercase>
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`. Then:

```bash
chmod 600 /opt/wish-studio/.env
```

This file never goes into git. Keep a copy of the password in a password manager.

---

## Part 2: GitHub

### 9. Create the repository

On github.com: **New repository** → name `wish-studio`, **Private**, and leave it empty (no README, no .gitignore).

### 10. Add the deploy secrets

Repository → **Settings → Secrets and variables → Actions → New repository secret**. Add three:

| Name | Value |
| --- | --- |
| `EC2_HOST` | `YOUR_IP` |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | The whole contents of the key file, including the `-----BEGIN` and `-----END` lines. Copy it with `pbcopy < ~/.ssh/wish-studio.pem` |

You don't need a registry password. The workflow uses GitHub's built-in token to push images to GitHub Container Registry (GHCR), and passes it to the server only for the moment it pulls.

### 11. Push the code (this triggers the first deploy)

On your Mac, in the project folder:

```bash
git status                     # make sure .env is NOT listed
git add -A
git commit -m "Initial commit with Docker and CI/CD"
git branch -M main
git remote add origin git@github.com:<your-github-username>/wish-studio.git
git push -u origin main
```

If you don't have SSH set up with GitHub, use `https://github.com/<your-github-username>/wish-studio.git` as the remote instead.

### 12. Watch it deploy

Repository → **Actions** → the **Deploy** run. It goes through three jobs:

1. **ci**: lint, typecheck, build (about 1–2 minutes)
2. **Build api/web image**: about 3–5 minutes the first time, faster later thanks to the cache
3. **Deploy to EC2**: copies files, pulls images, runs database migrations, restarts, waits for the health check

When it turns green, open **http://YOUR_IP**. The badge in the top-right should say **LIVE**.

---

## Everyday workflow

- **Open a pull request**: CI runs and shows a check on the PR.
- **Merge or push to `main`**: CI, then build, then automatic deploy.
- **Deploy again without a code change**: Actions → Deploy → **Run workflow**.

## Running the server

SSH in, then `cd /opt/wish-studio`.

```bash
docker compose -f docker-compose.prod.yml ps                 # what's running
docker compose -f docker-compose.prod.yml logs -f api        # live API logs (also: web, caddy, postgres)
docker compose -f docker-compose.prod.yml restart api        # restart one service
```

**Roll back** to an earlier version: find the commit SHA in GitHub, then on the server:

```bash
bash deploy/deploy.sh <full-commit-sha>
```

**Back up the database:**

```bash
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U wishstudio wishstudio | gzip > backup-$(date +%F).sql.gz
```

Copy backups off the server, for example with `scp ubuntu@YOUR_IP:/opt/wish-studio/backup-*.sql.gz .` from your Mac.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Deploy fails at `ssh-keyscan` or times out | The security group is missing port 22 from 0.0.0.0/0, or `EC2_HOST` is wrong |
| `Permission denied (publickey)` | `EC2_SSH_KEY` is incomplete. Paste the full file including the BEGIN/END lines. `EC2_USER` must be `ubuntu`. |
| `set POSTGRES_PASSWORD in .env` (or `IMAGE_PREFIX`, `WEB_ORIGINS`) | `/opt/wish-studio/.env` is missing that line (step 8) |
| `denied` / `unauthorized` when pulling images | `IMAGE_PREFIX` must be `ghcr.io/` plus your GitHub username, all lowercase |
| Page loads but saving fails, or the badge says OFFLINE | `WEB_ORIGINS` must exactly match the browser address, e.g. `http://YOUR_IP` with no trailing slash. Run `docker compose -f docker-compose.prod.yml up -d` after editing `.env`. |
| `API did not become healthy in time` | Read the API logs that the job prints. Usually a database or `.env` problem. |
| Server becomes unresponsive | Out of memory on `t3.micro`. Check the swap file exists (`free -h`) or move to `t3.small`. |

## Adding a domain later

1. Point an `A` record for your domain at `YOUR_IP`.
2. In `/opt/wish-studio/.env`, set `SITE_ADDRESS=yourdomain.com` and `WEB_ORIGINS=https://yourdomain.com`.
3. Run `docker compose -f docker-compose.prod.yml up -d`. Caddy fetches and renews the HTTPS certificate automatically.

## Rough monthly cost

| Item | Approx. (us-east-1, on-demand) |
| --- | --- |
| `t3.small` (or `t3.micro`) | ~$15 (~$7.50) |
| Public IPv4 / Elastic IP | ~$3.60 |
| 20 GB gp3 disk | ~$1.60 |

New AWS accounts may get free-tier credits that cover part of this, so check the Billing console for your account. GHCR and GitHub Actions minutes for this project fit in GitHub's free allowance.

## Security notes and what changes in Option 2

- SSH is open to the internet, protected only by your key. Ubuntu AMIs already disable password login.
- Postgres isn't exposed. Only Caddy (80/443) is.
- The planned ECS Fargate + RDS setup replaces SSH with short-lived AWS credentials through GitHub OIDC, moves the database to managed RDS with automated backups, and puts the app behind a load balancer.
