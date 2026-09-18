# streamlit-keepalive

Keeps the Streamlit Community Cloud apps behind [dagem-portfolio] awake, so
visitors rarely hit a cold-start "app is sleeping" screen.

## Why this exists

Streamlit Community Cloud puts apps to sleep after a period of inactivity
(Streamlit's own documentation isn't fully consistent on the exact
threshold — reported as anywhere from 12 hours to a few days). A plain HTTP
ping does **not** prevent this: `your-app.streamlit.app` returns a static
dashboard shell with `200 OK` whether the app is awake or asleep, so
ping-based uptime monitors give false confidence. This repo instead uses a
real headless-browser visit — the same thing Streamlit's own docs recommend
("simply visit your app") — automated on a schedule.

## What it does

Every 6 hours, a GitHub Actions workflow (`.github/workflows/keepalive.yml`)
visits each app listed in `apps.json`. If an app shows the sleep screen, it
clicks "Yes, get this app back up!" and waits for it to finish booting.

## Before trusting the schedule

**Run it manually first.** Go to the repo's **Actions** tab → "Keep
Streamlit apps awake" → **Run workflow**, and check the logs. Streamlit
Cloud's page structure isn't something we control and can change without
notice — this was written against documented, real-world behavior but
hasn't been live-tested end-to-end from the environment that built it.

## Editing the app list

Edit `apps.json` — add, remove, or rename entries as your deployed apps
change. No other code changes needed.

## Adjusting the schedule

Edit the `cron` line in `.github/workflows/keepalive.yml`. The current
`0 */6 * * *` runs at 00:00, 06:00, 12:00, and 18:00 UTC.
