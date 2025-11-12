import { getUserSpecificPool } from '../db';

async function addApplicationIdColumn() {
  const userId = 'c26e5660-883e-4764-8e18-3a2de65f0dde'; // User A_Suradkar17
  
  const userPoolResult = await getUserSpecificPool(userId);
  if (!userPoolResult) {
    console.error('User configuration not found');
    return;
  }

  const { pool } = userPoolResult;
  const client = await pool.connect();

  try {
    console.log('Adding application_id column to data_connection_table...');
    
    // Check if column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'data_connection_table' 
      AND column_name = 'application_id'
    `);

    if (checkResult.rows.length > 0) {
      console.log('Column application_id already exists');
    } else {
      await client.query('ALTER TABLE data_connection_table ADD COLUMN application_id INTEGER');
      console.log('Column application_id added successfully');
    }

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    client.release();
  }
}

addApplicationIdColumn()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
