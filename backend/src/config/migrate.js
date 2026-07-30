const { getPool } = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigration(shouldExit = true) {
  console.log('Running database migrations...');
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Ensure the schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of migration files in backend/db/migrations/
    const migrationsDir = path.join(__dirname, '../../db/migrations');
    
    // Check if directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.error(`Migrations directory not found at: ${migrationsDir}`);
      if (shouldExit) process.exit(1);
      throw new Error('Migrations directory not found.');
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Apply migrations in alphabetical order

    console.log(`Found ${files.length} migration file(s).`);

    // Fetch applied migrations
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(rows.map(r => r.version));

    for (const file of files) {
      if (appliedVersions.has(file)) {
        console.log(`Migration ${file} is already applied.`);
        continue;
      }

      console.log(`Applying migration ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Run each migration file and its status tracking update inside a single transaction
      try {
        await client.query('BEGIN');
        
        // Execute the entire SQL script
        await client.query(sql);

        // Record that this migration was applied successfully
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);

        await client.query('COMMIT');
        console.log(`Migration ${file} applied successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.log(`Failed to apply migration ${file}, transaction rolled back.`);
        throw err;
      }
    }

    console.log('All database migrations completed successfully.');
    if (shouldExit) process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    if (shouldExit) process.exit(1);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigration(true);
} else {
  module.exports = { runMigration };
}
