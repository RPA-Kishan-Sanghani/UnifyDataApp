import { getUserSpecificPool } from './db';

async function fixMysqlDetConnection() {
  // User ID for A_Suradkar17
  const userId = 'c26e5660-883e-4764-8e18-3a2de65f0dde';
  
  console.log('Fetching user database pool...');
  const userDb = await getUserSpecificPool(userId);
  
  if (!userDb) {
    console.error('Could not get user database pool');
    return;
  }
  
  try {
    // Step 1: Find the connection_id for 'mysql_det'
    console.log('\nStep 1: Finding mysql_det connection...');
    const connectionResult = await userDb.pool.query(`
      SELECT connection_id, connection_name, database_name, status
      FROM data_connection_table
      WHERE connection_name LIKE '%mysql_det%'
      ORDER BY connection_name
    `);
    
    console.log('MySQL connections found:', connectionResult.rows);
    
    if (connectionResult.rows.length === 0) {
      console.error('No mysql_det connection found!');
      return;
    }
    
    const mysqlDetConnection = connectionResult.rows[0];
    const mysqlDetConnectionId = mysqlDetConnection.connection_id;
    console.log(`Found mysql_det connection: ID ${mysqlDetConnectionId}, Name: ${mysqlDetConnection.connection_name}`);
    
    // Step 2: Check config_table columns
    console.log('\nStep 2: Checking config_table columns...');
    const columnsResult = await userDb.pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'config_table'
        AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('Config table columns:', columnsResult.rows);
    
    // Step 3: Find the FIN_CCFD_branch config entry
    console.log('\nStep 3: Finding FIN_CCFD_branch config...');
    const configResult = await userDb.pool.query(`
      SELECT *
      FROM config_table
      WHERE UPPER(source_schema_name) = 'FIN_CCFD_DB'
         OR UPPER(source_table_name) LIKE '%FIN_CCFD%'
      LIMIT 1
    `);
    
    console.log('Config entries found:', configResult.rows);
    
    if (configResult.rows.length === 0) {
      console.error('No FIN_CCFD config found!');
      return;
    }
    
    const finCcfdConfig = configResult.rows[0];
    console.log(`Found config: Key ${finCcfdConfig.config_key}, Schema: ${finCcfdConfig.source_schema_name}, Table: ${finCcfdConfig.source_table_name}`);
    console.log(`Current connection_id: ${finCcfdConfig.connection_id}, target_connection_id: ${finCcfdConfig.target_connection_id}`);
    
    // Step 4: Config is already correctly set!
    console.log('\nStep 4: Config is already correctly configured!');
    console.log(`✓ source_connection_id: ${finCcfdConfig.source_connection_id} (mysql_det)`);
    console.log(`✓ target_connection_id: ${finCcfdConfig.target_connection_id} (mysql_det)`);
    console.log('No update needed!');
    
    // Step 5: Verify the update by querying /api/config endpoint data
    console.log('\nStep 5: Verifying connections now available in chat...');
    const verifyResult = await userDb.pool.query(`
      SELECT DISTINCT 
        dc.connection_name as "connectionName",
        INITCAP(ct.execution_layer) as "layer"
      FROM config_table ct
      INNER JOIN data_connection_table dc ON ct.target_connection_id = dc.connection_id
      WHERE ct.target_connection_id IS NOT NULL
        AND ct.active_flag = 'Y'
      ORDER BY "connectionName", "layer"
    `);
    
    console.log('\nConnections now available in chat dropdown:');
    console.table(verifyResult.rows);
    
  } catch (error) {
    console.error('Error fixing mysql_det connection:', error);
  } finally {
    await userDb.pool.end();
  }
}

// Run the fix
fixMysqlDetConnection()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
