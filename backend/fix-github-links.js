require('dotenv').config();
const pg = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Missing required environment variable: DATABASE_URL');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE "TaskSubmission" SET "githubLink" = NULL WHERE "githubLink" = ''`
    );
    console.log(`Updated ${result.rowCount} TaskSubmission record(s) where githubLink was empty string.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
