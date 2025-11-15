const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq } = require('drizzle-orm');
const { dataConnectionTable } = require('./shared/schema.ts');

async function fixConnection() {
  // Connect to user's external config database
  const sql = neon('postgresql://DE_Data:data123@20.244.29.185:5432/config_db');
  const db = drizzle(sql);
  
  console.log('Updating connection in external database...');
  const result = await db
    .update(dataConnectionTable)
    .set({ databaseName: 'hcdw' })
    .where(eq(dataConnectionTable.connectionId, 2))
    .returning();
    
  console.log('Updated connection:', result);
}

fixConnection().catch(console.error);
