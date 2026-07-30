# Supabase Database Backup & Restore Guide

This guide details how to perform backups and restores specifically for the LabScan Supabase PostgreSQL database. 

## 1. What Needs Backing Up

Since LabScan uses Supabase as a standard PostgreSQL database (connecting via `DATABASE_URL`), the backup focus is on:
1. **Database Schema & Migrations**: The layout of all application tables, relationships, indexes, and constraints.
2. **Application Data**: The contents of the `users`, `branches`, `labs`, `experiments`, `student_sessions`, `student_checklist_progress`, and `audit_logs` tables.

> [!IMPORTANT]
> Do **not** back up or restore Supabase-managed internal system schemas (e.g., `auth`, `graphql`, `realtime`, `storage`, `vault`), as doing so will break the target Supabase instance's administrative configuration.

---

## 2. Backup Procedure (pg_dump)

To back up only the application schema and data, use PostgreSQL's `pg_dump` utility. Run this command from your terminal:

```bash
pg_dump \
  --host=db.<your-project-ref>.supabase.co \
  --username=postgres \
  --dbname=postgres \
  --port=5432 \
  --format=custom \
  --exclude-schema='auth' \
  --exclude-schema='graphql' \
  --exclude-schema='realtime' \
  --exclude-schema='storage' \
  --exclude-schema='supabase_functions' \
  --exclude-schema='vault' \
  --file=labscan_supabase_backup_$(date +%F).dump
```

### Key Parameters:
* `--host`: Retrieve this from **Supabase Dashboard > Settings > Database > Connection info > Host**.
* `--format=custom (-F c)`: Outputs a compressed binary archive. This format is highly flexible as it allows filtering specific tables or schemas during restore.
* `--exclude-schema`: Excludes Supabase internal schemas.

---

## 3. Restore Procedure (pg_restore)

To restore a custom-format backup (`.dump` file) into a clean Supabase database instance:

### Step A: Reset or Seed Schema (Recommended)
Before running the restore, apply the migrations locally or from the project to ensure the baseline tables exist:
```bash
# In the backend directory
npm run db:migrate
```

### Step B: Run pg_restore
Use `pg_restore` to insert the backed up data. Note that we use `--clean` to drop and recreate table contents:

```bash
pg_restore \
  --host=db.<target-project-ref>.supabase.co \
  --username=postgres \
  --dbname=postgres \
  --port=5432 \
  --clean \
  --no-owner \
  --no-privileges \
  labscan_supabase_backup_YYYY-MM-DD.dump
```

### Key Parameters:
* `--clean`: Clean (drop) database objects before recreating them.
* `--no-owner`: Do not output commands to set ownership of objects to match the original database. This prevents permission errors due to user name mismatches.
* `--no-privileges`: Prevent restoring access privileges (grants/revokes), which could clash with the target instance's pre-configured user roles.

---

## 4. Automated Backup Strategies for Supabase

Depending on your Supabase tier, use one of the following strategies:

### Tier A: Supabase Paid Tiers (Pro/Enterprise)
* **Frequency**: Automated daily database backups are built-in.
* **How to Restore**: Go to **Supabase Dashboard > Settings > Database > Backups** and select the point-in-time recovery option.

### Tier B: Supabase Free Tier (Self-Managed)
Free projects do not include automated daily backups. You can configure a scheduled GitHub Actions cron workflow to run daily and store the dump file securely (e.g., in AWS S3 or Google Cloud Storage):

```yaml
# Example: .github/workflows/daily-backup.yml
name: Daily Database Backup

on:
  schedule:
    - cron: '0 0 * * *' # Run daily at midnight UTC

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL Client
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client

      - name: Run Backup
        env:
          PGPASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        run: |
          pg_dump \
            -h db.${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co \
            -U postgres \
            -d postgres \
            -p 5432 \
            -F c \
            --exclude-schema='auth' \
            --exclude-schema='graphql' \
            --exclude-schema='realtime' \
            --exclude-schema='storage' \
            --exclude-schema='supabase_functions' \
            --exclude-schema='vault' \
            -f backup.dump

      # Add step here to upload backup.dump to AWS S3 or GCP Storage bucket
```
