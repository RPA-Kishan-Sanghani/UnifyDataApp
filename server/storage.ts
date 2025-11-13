import { users, auditTable, errorTable, dataConnectionTable, configTable, dataDictionaryTable, reconciliationConfigTable, dataQualityConfigTable, applicationConfigTable, userConfigDbSettings, userActivity, chatSessionsTable, chatMessagesTable, savedChartsTable, type User, type InsertUser, type AuditRecord, type ErrorRecord, type DataConnection, type InsertDataConnection, type UpdateDataConnection, type ConfigRecord, type InsertConfigRecord, type UpdateConfigRecord, type DataDictionaryRecord, type InsertDataDictionaryRecord, type UpdateDataDictionaryRecord, type ReconciliationConfig, type InsertReconciliationConfig, type UpdateReconciliationConfig, type DataQualityConfig, type InsertDataQualityConfig, type UpdateDataQualityConfig, type ApplicationConfig, type InsertApplicationConfig, type UpdateApplicationConfig, type UserConfigDbSettings, type InsertUserConfigDbSettings, type UpdateUserConfigDbSettings, type UserActivity, type InsertUserActivity, type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage, type SavedChart, type InsertSavedChart, type UpdateSavedChart } from "@shared/schema";
import { db, pool, getUserSpecificPool } from "./db";
import { eq, and, gte, lte, count, desc, asc, like, inArray, sql, ilike, or } from "drizzle-orm";
import { Pool } from 'pg';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(userId: string, updates: { firstName?: string; lastName?: string; photoUrl?: string }): Promise<User | undefined>;

  // Dashboard metrics
  getDashboardMetrics(userId: string, dateRange?: { start: Date; end: Date }, filters?: {
    search?: string;
    system?: string;
    layer?: string;
    status?: string;
    category?: string;
    targetTable?: string;
  }): Promise<{
    totalPipelines: number;
    successfulRuns: number;
    failedRuns: number;
    scheduledRuns: number;
    runningRuns: number;
  }>;

  // Pipeline summary by category
  getPipelineSummary(userId: string, dateRange?: { start: Date; end: Date }, filters?: {
    search?: string;
    system?: string;
    layer?: string;
    status?: string;
    category?: string;
    targetTable?: string;
  }): Promise<{
    dataQuality: { total: number; success: number; failed: number };
    reconciliation: { total: number; success: number; failed: number };
    bronze: { total: number; success: number; failed: number };
    silver: { total: number; success: number; failed: number };
    gold: { total: number; success: number; failed: number };
  }>;

  // Pipeline runs with filtering and pagination
  getPipelineRuns(userId: string, options: {
    page?: number;
    limit?: number;
    search?: string;
    sourceSystem?: string;
    status?: string;
    dateRange?: { start: Date; end: Date };
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: Array<{
      auditKey: number;
      codeName: string;
      runId: string;
      sourceSystem: string;
      schemaName: string;
      targetTableName: string;
      sourceFileName: string;
      startTime: Date;
      endTime?: Date;
      insertedRowCount: number;
      updatedRowCount: number;
      deletedRowCount: number;
      noChangeRowCount: number;
      status: string;
      errorDetails?: string;
      duration?: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }>;

  // All pipelines with filtering and pagination
  getAllPipelines(userId: string, options: {
    page?: number;
    limit?: number;
    search?: string;
    sourceSystem?: string;
    status?: string;
    dateRange?: { start: Date; end: Date };
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: Array<{
      auditKey: number;
      codeName: string;
      runId: string;
      sourceSystem: string;
      schemaName: string;
      targetTableName: string;
      sourceFileName: string;
      startTime: Date;
      endTime?: Date;
      insertedRowCount: number;
      updatedRowCount: number;
      deletedRowCount: number;
      noChangeRowCount: number;
      status: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }>;

  // Error logs
  getErrors(userId: string, dateRange?: { start: Date; end: Date }): Promise<ErrorRecord[]>;

  // Data connections
  createConnection(userId: string, connection: InsertDataConnection): Promise<DataConnection>;
  getConnections(userId: string, filters?: {
    category?: string;
    search?: string;
    status?: string;
  }): Promise<DataConnection[]>;
  getConnection(userId: string, id: number): Promise<DataConnection | undefined>;
  updateConnection(userId: string, id: number, updates: UpdateDataConnection): Promise<DataConnection | undefined>;
  deleteConnection(userId: string, id: number): Promise<boolean>;
  testConnection(userId: string, connectionData: Partial<DataConnection>): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }>;
  getDatabaseSchemas(userId: string, connectionId: number): Promise<string[]>;
  getDatabaseTables(userId: string, connectionId: number, schemaName: string): Promise<string[]>;
  getDatabaseColumns(userId: string, connectionId: number, schemaName: string, tableName: string): Promise<string[]>;
  getDatabaseColumnMetadata(userId: string, connectionId: number, schemaName: string, tableName: string): Promise<any[]>;

  // Pipeline configuration methods
  getPipelines(userId: string, filters?: { search?: string; executionLayer?: string; sourceApplicationName?: string; targetApplicationName?: string; status?: string }): Promise<ConfigRecord[]>;
  getPipeline(userId: string, id: number): Promise<ConfigRecord | undefined>;
  getMaxConfigKey(userId: string): Promise<number>;
  createPipeline(userId: string, pipeline: InsertConfigRecord): Promise<ConfigRecord>;
  updatePipeline(userId: string, id: number, updates: UpdateConfigRecord): Promise<ConfigRecord | undefined>;
  deletePipeline(userId: string, id: number): Promise<boolean>;
  getSourceApplications(userId: string): Promise<Array<{ applicationId: number; applicationName: string }>>;
  getTargetApplications(userId: string): Promise<Array<{ applicationId: number; applicationName: string }>>;

  // Metadata methods for dropdowns
  getMetadata(userId: string, type: string): Promise<string[]>;

  // Data dictionary methods
  getDataDictionaryEntries(userId: string, filters?: { search?: string; executionLayer?: string; schemaName?: string; tableName?: string; customField?: string; customValue?: string }): Promise<DataDictionaryRecord[]>;
  getDataDictionaryEntriesByConfig(userId: string, configKey: string, layer: string): Promise<DataDictionaryRecord[]>;
  getDataDictionaryEntry(userId: string, id: number): Promise<DataDictionaryRecord | undefined>;
  createDataDictionaryEntry(userId: string, entry: InsertDataDictionaryRecord): Promise<DataDictionaryRecord>;
  updateDataDictionaryEntry(userId: string, id: number, updates: UpdateDataDictionaryRecord): Promise<DataDictionaryRecord | undefined>;
  deleteDataDictionaryEntry(userId: string, id: number): Promise<boolean>;

  // Reconciliation config methods
  getReconciliationConfigs(userId: string, filters?: { search?: string; executionLayer?: string; configKey?: number; reconType?: string; status?: string }): Promise<ReconciliationConfig[]>;
  getReconciliationConfig(userId: string, id: number): Promise<ReconciliationConfig | undefined>;
  createReconciliationConfig(userId: string, config: InsertReconciliationConfig): Promise<ReconciliationConfig>;
  updateReconciliationConfig(userId: string, id: number, updates: UpdateReconciliationConfig): Promise<ReconciliationConfig | undefined>;
  deleteReconciliationConfig(userId: string, id: number): Promise<boolean>;

  // Application Configuration
  getApplicationConfigs(userId: string, filters?: { search?: string; status?: string; applicationType?: string }): Promise<ApplicationConfig[]>;
  getApplicationConfig(userId: string, id: number): Promise<ApplicationConfig | undefined>;
  createApplicationConfig(userId: string, config: InsertApplicationConfig): Promise<ApplicationConfig>;
  updateApplicationConfig(userId: string, id: number, updates: UpdateApplicationConfig): Promise<ApplicationConfig | undefined>;
  deleteApplicationConfig(userId: string, id: number): Promise<boolean>;
  findMatchingConfig(userId: string, criteria: {
    executionLayer?: string;
    sourceSystem?: string;
    sourceType?: string;
    sourceSchemaName?: string;
    sourceTableName?: string;
    targetSystem?: string;
    targetType?: string;
    targetSchemaName?: string;
    targetTableName?: string;
  }): Promise<ConfigRecord | undefined>;

  // Data Quality Config methods
  getDataQualityConfigs(userId: string, filters?: { search?: string; executionLayer?: string; configKey?: number; validationType?: string; status?: string }): Promise<DataQualityConfig[]>;
  getDataQualityConfig(userId: string, id: number): Promise<DataQualityConfig | undefined>;
  createDataQualityConfig(userId: string, config: InsertDataQualityConfig): Promise<DataQualityConfig>;
  updateDataQualityConfig(userId: string, id: number, updates: UpdateDataQualityConfig): Promise<DataQualityConfig | undefined>;
  deleteDataQualityConfig(userId: string, id: number): Promise<boolean>;

  // User Config DB Settings methods
  getUserConfigDbSettings(userId: string): Promise<UserConfigDbSettings | undefined>;
  createUserConfigDbSettings(settings: InsertUserConfigDbSettings): Promise<UserConfigDbSettings>;
  updateUserConfigDbSettings(userId: string, settings: UpdateUserConfigDbSettings): Promise<UserConfigDbSettings | undefined>;
  testUserConfigDbConnection(settings: Partial<UserConfigDbSettings>): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }>;

  // User Activity methods
  logUserActivity(activity: InsertUserActivity): Promise<UserActivity>;
  getUserActivity(userId: string, limit?: number): Promise<UserActivity[]>;

  // Chat History methods
  ensureChatHistoryTables(userId: string): Promise<boolean>;
  createChatSession(userId: string, connectionName: string, layer: string): Promise<{ sessionId: string }>;
  getChatSessions(userId: string, connectionName?: string, layer?: string, limit?: number): Promise<Array<{
    sessionId: string;
    connectionName: string;
    layer: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    firstMessage?: string;
  }>>;
  getChatMessages(userId: string, sessionId: string): Promise<Array<{
    messageId: string;
    sessionId: string;
    messageType: string;
    content: string;
    sql?: string;
    data?: string;
    columns?: string;
    rowCount?: number;
    chartType?: string;
    timestamp: Date;
  }>>;
  saveChatMessage(userId: string, message: {
    messageId: string;
    sessionId: string;
    messageType: string;
    content: string;
    sql?: string;
    data?: any;
    columns?: string[];
    rowCount?: number;
    chartType?: string;
  }): Promise<void>;
  updateChatSessionTimestamp(userId: string, sessionId: string): Promise<void>;
  deleteChatSession(userId: string, sessionId: string): Promise<boolean>;
  cleanupOldChatMessages(userId: string): Promise<number>;

  // Saved Charts methods
  getSavedCharts(userId: string): Promise<SavedChart[]>;
  getSavedChart(userId: string, chartId: string): Promise<SavedChart | undefined>;
  createSavedChart(userId: string, chart: InsertSavedChart): Promise<SavedChart>;
  updateSavedChart(userId: string, chartId: string, updates: UpdateSavedChart): Promise<SavedChart | undefined>;
  deleteSavedChart(userId: string, chartId: string): Promise<boolean>;
  refreshSavedChart(userId: string, chartId: string): Promise<SavedChart | undefined>;

  // Tour status methods
  getUserTourStatus(userId: string): Promise<boolean>;
  updateUserTourStatus(userId: string, completed: boolean): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        tourCompleted: users.tourCompleted
      }).from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('Error fetching user by id:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        tourCompleted: users.tourCompleted
      }).from(users).where(eq(users.username, username));
      return user || undefined;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        password: users.password,
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        tourCompleted: users.tourCompleted
      }).from(users).where(eq(users.email, email));
      return user || undefined;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(insertUser.password, 10);
      
      const [user] = await db
        .insert(users)
        .values({
          username: insertUser.username,
          email: insertUser.email,
          password: hashedPassword,
          firstName: insertUser.firstName,
          lastName: insertUser.lastName
        })
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          password: users.password,
          firstName: users.firstName,
          lastName: users.lastName,
          photoUrl: users.photoUrl,
          tourCompleted: users.tourCompleted
        });
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user in database');
    }
  }

  async updateUserProfile(userId: string, updates: { firstName?: string; lastName?: string; photoUrl?: string }): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          password: users.password,
          firstName: users.firstName,
          lastName: users.lastName,
          photoUrl: users.photoUrl,
          tourCompleted: users.tourCompleted
        });
      return updatedUser || undefined;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  async getDashboardMetrics(userId: string, dateRange?: { start: Date; end: Date }, filters?: {
    search?: string;
    system?: string;
    layer?: string;
    status?: string;
    category?: string;
    targetTable?: string;
  }) {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty metrics if no user config
    if (!userPoolResult) {
      return {
        totalPipelines: 0,
        successfulRuns: 0,
        failedRuns: 0,
        scheduledRuns: 0,
        runningRuns: 0,
      };
    }

    const userPool = userPoolResult.pool;
    const client = await userPool.connect();
    
    try {
      const metrics = {
        totalPipelines: 0,
        successfulRuns: 0,
        failedRuns: 0,
        scheduledRuns: 0,
        runningRuns: 0,
      };

      // Query 1: Data Quality Pipelines from data_quality_output_table
      try {
        const dqWhereClauses = [];
        const dqParams: any[] = [];
        let dqParamIndex = 1;

        // Note: data_quality_output_table has no date column, so we skip date filtering

        if (filters?.status) {
          const statusValue = filters.status.toLowerCase() === 'failed' ? 'Y' :
                             filters.status.toLowerCase() === 'success' ? 'N' :
                             filters.status;
          dqWhereClauses.push(`result = $${dqParamIndex}`);
          dqParams.push(statusValue);
          dqParamIndex++;
        }

        const dqWhereClause = dqWhereClauses.length > 0 ? `WHERE ${dqWhereClauses.join(' AND ')}` : '';

        const dqQuery = `
          SELECT result as status, COUNT(*) as count
          FROM data_quality_output_table
          ${dqWhereClause}
          GROUP BY result
        `;

        const dqResult = await client.query(dqQuery, dqParams);
        
        dqResult.rows.forEach(row => {
          const status = row.status?.toLowerCase();
          const count = Number(row.count);

          metrics.totalPipelines += count;

          if (status === 'n') {
            metrics.successfulRuns += count;
          } else if (status === 'y') {
            metrics.failedRuns += count;
          }
        });
      } catch (dqError) {
        console.log('data_quality_output_table not found or error querying:', dqError);
      }

      // Query 2: Data Reconciliation Pipelines from recon_result
      try {
        const reconWhereClauses = [];
        const reconParams: any[] = [];
        let reconParamIndex = 1;

        // Note: recon_result has no date column, so we skip date filtering

        if (filters?.status) {
          const statusValue = filters.status.toLowerCase() === 'failed' ? 'Fail' :
                             filters.status.toLowerCase() === 'success' ? 'Pass' :
                             filters.status;
          reconWhereClauses.push(`result = $${reconParamIndex}`);
          reconParams.push(statusValue);
          reconParamIndex++;
        }

        const reconWhereClause = reconWhereClauses.length > 0 ? `WHERE ${reconWhereClauses.join(' AND ')}` : '';

        const reconQuery = `
          SELECT result as status, COUNT(*) as count
          FROM recon_result
          ${reconWhereClause}
          GROUP BY result
        `;

        const reconResult = await client.query(reconQuery, reconParams);
        
        reconResult.rows.forEach(row => {
          const status = row.status?.toLowerCase();
          const count = Number(row.count);

          metrics.totalPipelines += count;

          if (status === 'pass') {
            metrics.successfulRuns += count;
          } else if (status === 'fail') {
            metrics.failedRuns += count;
          }
        });
      } catch (reconError) {
        console.log('recon_result table not found or error querying:', reconError);
      }

      // Query 3: Regular Pipelines from audit_table
      const whereClauses = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (dateRange) {
        whereClauses.push(`start_time >= $${paramIndex} AND start_time <= $${paramIndex + 1}`);
        params.push(dateRange.start, dateRange.end);
        paramIndex += 2;
      }

      if (filters?.search) {
        whereClauses.push(`code_name LIKE $${paramIndex}`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (filters?.system) {
        whereClauses.push(`source_system = $${paramIndex}`);
        params.push(filters.system);
        paramIndex++;
      }

      if (filters?.layer) {
        whereClauses.push(`schema_name ILIKE $${paramIndex}`);
        params.push(`%${filters.layer.toLowerCase()}%`);
        paramIndex++;
      }

      if (filters?.status) {
        const statusValue = filters.status.toLowerCase() === 'failed' ? 'Fail' :
                           filters.status.toLowerCase() === 'success' ? 'Success' :
                           filters.status;
        whereClauses.push(`status = $${paramIndex}`);
        params.push(statusValue);
        paramIndex++;
      }

      if (filters?.targetTable) {
        whereClauses.push(`target_table_name LIKE $${paramIndex}`);
        params.push(`%${filters.targetTable}%`);
        paramIndex++;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const query = `
        SELECT status, COUNT(*) as count
        FROM audit_table
        ${whereClause}
        GROUP BY status
      `;

      const result = await client.query(query, params);
      
      result.rows.forEach(row => {
        const status = row.status?.toLowerCase();
        const count = Number(row.count);

        metrics.totalPipelines += count;

        if (status === 'success') {
          metrics.successfulRuns += count;
        } else if (status === 'failed' || status === 'fail') {
          metrics.failedRuns += count;
        } else if (status === 'scheduled') {
          metrics.scheduledRuns += count;
        } else if (status === 'running') {
          metrics.runningRuns += count;
        }
      });

      return metrics;
    } finally {
      client.release();
    }
  }

  async getPipelineSummary(userId: string, dateRange?: { start: Date; end: Date }, filters?: {
    search?: string;
    system?: string;
    layer?: string;
    status?: string;
    category?: string;
    targetTable?: string;
  }) {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty summary if no user config
    if (!userPoolResult) {
      return {
        dataQuality: { total: 0, success: 0, failed: 0 },
        reconciliation: { total: 0, success: 0, failed: 0 },
        bronze: { total: 0, success: 0, failed: 0 },
        silver: { total: 0, success: 0, failed: 0 },
        gold: { total: 0, success: 0, failed: 0 },
      };
    }

    const userPool = userPoolResult.pool;
    const client = await userPool.connect();
    
    try {
      const summary = {
        dataQuality: { total: 0, success: 0, failed: 0 },
        reconciliation: { total: 0, success: 0, failed: 0 },
        bronze: { total: 0, success: 0, failed: 0 },
        silver: { total: 0, success: 0, failed: 0 },
        gold: { total: 0, success: 0, failed: 0 },
      };

      // Query 1: Data Quality Pipelines from data_quality_output_table
      try {
        const dqWhereClauses = [];
        const dqParams: any[] = [];
        let dqParamIndex = 1;

        // Note: data_quality_output_table has no date column, so we skip date filtering

        if (filters?.status) {
          const statusValue = filters.status.toLowerCase() === 'failed' ? 'Y' :
                             filters.status.toLowerCase() === 'success' ? 'N' :
                             filters.status;
          dqWhereClauses.push(`result = $${dqParamIndex}`);
          dqParams.push(statusValue);
          dqParamIndex++;
        }

        const dqWhereClause = dqWhereClauses.length > 0 ? `WHERE ${dqWhereClauses.join(' AND ')}` : '';

        const dqQuery = `
          SELECT result as status, COUNT(*) as count
          FROM data_quality_output_table
          ${dqWhereClause}
          GROUP BY result
        `;

        const dqResult = await client.query(dqQuery, dqParams);
        
        dqResult.rows.forEach(row => {
          const status = row.status?.toLowerCase();
          const count = Number(row.count);

          summary.dataQuality.total += count;

          if (status === 'n') {
            summary.dataQuality.success += count;
          } else if (status === 'y') {
            summary.dataQuality.failed += count;
          }
        });
      } catch (dqError) {
        console.log('data_quality_output_table not found or error querying:', dqError);
      }

      // Query 2: Data Reconciliation Pipelines from recon_result
      try {
        const reconWhereClauses = [];
        const reconParams: any[] = [];
        let reconParamIndex = 1;

        // Note: recon_result has no date column, so we skip date filtering

        if (filters?.status) {
          const statusValue = filters.status.toLowerCase() === 'failed' ? 'Fail' :
                             filters.status.toLowerCase() === 'success' ? 'Pass' :
                             filters.status;
          reconWhereClauses.push(`result = $${reconParamIndex}`);
          reconParams.push(statusValue);
          reconParamIndex++;
        }

        const reconWhereClause = reconWhereClauses.length > 0 ? `WHERE ${reconWhereClauses.join(' AND ')}` : '';

        const reconQuery = `
          SELECT result as status, COUNT(*) as count
          FROM recon_result
          ${reconWhereClause}
          GROUP BY result
        `;

        const reconResult = await client.query(reconQuery, reconParams);
        
        reconResult.rows.forEach(row => {
          const status = row.status?.toLowerCase();
          const count = Number(row.count);

          summary.reconciliation.total += count;

          if (status === 'pass') {
            summary.reconciliation.success += count;
          } else if (status === 'fail') {
            summary.reconciliation.failed += count;
          }
        });
      } catch (reconError) {
        console.log('recon_result table not found or error querying:', reconError);
      }

      // Query 3: Regular Pipelines from audit_table (Bronze/Silver/Gold layers)
      const whereClauses = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (dateRange) {
        whereClauses.push(`start_time >= $${paramIndex} AND start_time <= $${paramIndex + 1}`);
        params.push(dateRange.start, dateRange.end);
        paramIndex += 2;
      }

      if (filters?.search) {
        whereClauses.push(`code_name LIKE $${paramIndex}`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (filters?.system) {
        whereClauses.push(`source_system = $${paramIndex}`);
        params.push(filters.system);
        paramIndex++;
      }

      if (filters?.layer) {
        whereClauses.push(`schema_name ILIKE $${paramIndex}`);
        params.push(`%${filters.layer.toLowerCase()}%`);
        paramIndex++;
      }

      if (filters?.status) {
        const statusValue = filters.status.toLowerCase() === 'failed' ? 'Fail' :
                           filters.status.toLowerCase() === 'success' ? 'Success' :
                           filters.status;
        whereClauses.push(`status = $${paramIndex}`);
        params.push(statusValue);
        paramIndex++;
      }

      if (filters?.targetTable) {
        whereClauses.push(`target_table_name LIKE $${paramIndex}`);
        params.push(`%${filters.targetTable}%`);
        paramIndex++;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const query = `
        SELECT schema_name, status, COUNT(*) as count
        FROM audit_table
        ${whereClause}
        GROUP BY schema_name, status
      `;

      const result = await client.query(query, params);

      result.rows.forEach(row => {
        const schemaName = row.schema_name?.toLowerCase() || '';
        const status = row.status?.toLowerCase();
        const count = Number(row.count);

        let category: 'bronze' | 'silver' | 'gold';

        // Categorize based on schema name patterns (only Bronze/Silver/Gold)
        if (schemaName.includes('bronze')) {
          category = 'bronze';
        } else if (schemaName.includes('silver')) {
          category = 'silver';
        } else if (schemaName.includes('gold')) {
          category = 'gold';
        } else {
          // Default to bronze for schemas that don't match specific patterns
          category = 'bronze';
        }

        summary[category].total += count;

        if (status === 'success') {
          summary[category].success += count;
        } else if (status === 'failed' || status === 'fail') {
          summary[category].failed += count;
        }
      });

      return summary;
    } finally {
      client.release();
    }
  }

  async getPipelineRuns(userId: string, options: {
    page?: number;
    limit?: number;
    search?: string;
    sourceSystem?: string;
    status?: string;
    dateRange?: { start: Date; end: Date };
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty result if no user config
    if (!userPoolResult) {
      return {
        data: [],
        total: 0,
        page: options.page || 1,
        limit: options.limit || 5,
      };
    }

    const userPool = userPoolResult.pool;
    const {
      page = 1,
      limit = 5,
      search,
      sourceSystem,
      status,
      dateRange,
      sortBy = 'startTime',
      sortOrder = 'desc'
    } = options;

    const client = await userPool.connect();
    
    try {
      // Build WHERE clause conditions
      const whereClauses = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClauses.push(`code_name LIKE $${paramIndex}`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (sourceSystem && sourceSystem !== 'all') {
        whereClauses.push(`source_system = $${paramIndex}`);
        params.push(sourceSystem);
        paramIndex++;
      }

      if (status && status !== 'all') {
        whereClauses.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (dateRange) {
        whereClauses.push(`start_time >= $${paramIndex} AND start_time <= $${paramIndex + 1}`);
        params.push(dateRange.start, dateRange.end);
        paramIndex += 2;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM audit_table
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.count || '0');

      // Build sort column
      const sortColumnMap: Record<string, string> = {
        'codeName': 'code_name',
        'status': 'status',
        'sourceSystem': 'source_system',
        'startTime': 'start_time'
      };
      const sortColumn = sortColumnMap[sortBy] || 'start_time';
      const sortOrderClause = sortOrder.toUpperCase();

      // Apply pagination
      const offset = (page - 1) * limit;
      
      const dataQuery = `
        SELECT 
          audit_key, code_name, run_id, source_system, schema_name,
          target_table_name, source_file_name, start_time, end_time,
          inserted_row_count, updated_row_count, deleted_row_count,
          no_change_row_count, status
        FROM audit_table
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const dataResult = await client.query(dataQuery, [...params, limit, offset]);

      // Get error details for each audit record
      const auditKeys = dataResult.rows.map(r => r.audit_key);
      let errorDetails: Record<number, string> = {};

      if (auditKeys.length > 0) {
        const errorQuery = `
          SELECT audit_key, error_details
          FROM error_table
          WHERE audit_key = ANY($1)
        `;
        const errorResult = await client.query(errorQuery, [auditKeys]);
        
        errorResult.rows.forEach(error => {
          if (error.audit_key && !errorDetails[error.audit_key]) {
            errorDetails[error.audit_key] = error.error_details || '';
          }
        });
      }

      const data = dataResult.rows.map(row => ({
        auditKey: row.audit_key,
        codeName: row.code_name || 'Unknown Process',
        runId: row.run_id || '',
        sourceSystem: row.source_system || 'Unknown',
        schemaName: row.schema_name || '',
        targetTableName: row.target_table_name || '',
        sourceFileName: row.source_file_name || '',
        startTime: row.start_time || new Date(),
        endTime: row.end_time || undefined,
        insertedRowCount: row.inserted_row_count || 0,
        updatedRowCount: row.updated_row_count || 0,
        deletedRowCount: row.deleted_row_count || 0,
        noChangeRowCount: row.no_change_row_count || 0,
        status: row.status || 'Unknown',
        errorDetails: errorDetails[row.audit_key] || undefined,
        duration: row.end_time && row.start_time ?
          Math.round((new Date(row.end_time).getTime() - new Date(row.start_time).getTime()) / 1000) : undefined,
      }));

      return {
        data,
        total,
        page,
        limit,
      };
    } finally {
      client.release();
    }
  }

  async getAllPipelines(userId: string, options: {
    page?: number;
    limit?: number;
    search?: string;
    sourceSystem?: string;
    status?: string;
    dateRange?: { start: Date; end: Date };
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty result if no user config
    if (!userPoolResult) {
      return {
        data: [],
        total: 0,
        page: options.page || 1,
        limit: options.limit || 10,
      };
    }

    const userPool = userPoolResult.pool;
    const {
      page = 1,
      limit = 10,
      search,
      sourceSystem,
      status,
      dateRange,
      sortBy = 'startTime',
      sortOrder = 'desc'
    } = options;

    const client = await userPool.connect();
    
    try {
      // Build WHERE clause conditions
      const whereClauses = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClauses.push(`(
          code_name ILIKE $${paramIndex} OR
          run_id ILIKE $${paramIndex} OR
          source_system ILIKE $${paramIndex} OR
          target_table_name ILIKE $${paramIndex} OR
          source_file_name ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (sourceSystem && sourceSystem !== 'all') {
        whereClauses.push(`source_system = $${paramIndex}`);
        params.push(sourceSystem);
        paramIndex++;
      }

      if (status && status !== 'all') {
        whereClauses.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (dateRange) {
        whereClauses.push(`start_time >= $${paramIndex} AND start_time <= $${paramIndex + 1}`);
        params.push(dateRange.start, dateRange.end);
        paramIndex += 2;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM audit_table
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.count || '0');

      // Build sort column
      const sortColumnMap: Record<string, string> = {
        'codeName': 'code_name',
        'runId': 'run_id',
        'sourceSystem': 'source_system',
        'status': 'status',
        'startTime': 'start_time'
      };
      const sortColumn = sortColumnMap[sortBy] || 'start_time';
      const sortOrderClause = sortOrder.toUpperCase();

      // Apply pagination
      const offset = (page - 1) * limit;
      
      const dataQuery = `
        SELECT 
          audit_key, code_name, run_id, source_system, schema_name,
          target_table_name, source_file_name, start_time, end_time,
          inserted_row_count, updated_row_count, deleted_row_count,
          no_change_row_count, status
        FROM audit_table
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const dataResult = await client.query(dataQuery, [...params, limit, offset]);

      const data = dataResult.rows.map(row => ({
        auditKey: row.audit_key,
        codeName: row.code_name || 'Unknown Process',
        runId: row.run_id || '',
        sourceSystem: row.source_system || 'Unknown',
        schemaName: row.schema_name || '',
        targetTableName: row.target_table_name || '',
        sourceFileName: row.source_file_name || '',
        startTime: row.start_time || new Date(),
        endTime: row.end_time || undefined,
        insertedRowCount: row.inserted_row_count || 0,
        updatedRowCount: row.updated_row_count || 0,
        deletedRowCount: row.deleted_row_count || 0,
        noChangeRowCount: row.no_change_row_count || 0,
        status: row.status || 'Unknown',
      }));

      return {
        data,
        total,
        page,
        limit,
      };
    } finally {
      client.release();
    }
  }

  async getErrors(userId: string, dateRange?: { start: Date; end: Date }) {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty array if no user config
    if (!userPoolResult) {
      return [];
    }

    const userPool = userPoolResult.pool;
    const client = await userPool.connect();
    
    try {
      // Build WHERE clause conditions
      const whereClauses = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (dateRange) {
        whereClauses.push(`execution_time >= $${paramIndex} AND execution_time <= $${paramIndex + 1}`);
        params.push(dateRange.start, dateRange.end);
        paramIndex += 2;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const query = `
        SELECT *
        FROM error_table
        ${whereClause}
        ORDER BY execution_time DESC
      `;

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  private getLayerFromCodeName(codeName: string): string {
    const name = codeName.toLowerCase();
    if (name.includes('quality')) return 'Quality';
    if (name.includes('reconciliation')) return 'Reconciliation';
    if (name.includes('bronze')) return 'Bronze';
    if (name.includes('silver')) return 'Silver';
    if (name.includes('gold')) return 'Gold';
    return 'Bronze'; // Default
  }

  private getOwnerFromSystem(sourceSystem: string): string {
    // In a real system, this would map to actual users
    const owners = ['John Smith', 'Sarah Johnson', 'Mike Davis', 'Alex Chen', 'Lisa Wang'];
    const hash = sourceSystem.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return owners[Math.abs(hash) % owners.length];
  }

  // Source connection methods
  async createConnection(userId: string, connection: InsertDataConnection): Promise<DataConnection> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) throw new Error('User configuration not found');
    const { db: userDb } = userPoolResult;

    try {
      console.log('Creating connection with data:', connection);
      const [created] = await userDb
        .insert(dataConnectionTable)
        .values({
          connectionName: connection.connectionName,
          applicationName: connection.applicationName || null,
          applicationId: connection.applicationId || null,
          connectionType: connection.connectionType,
          host: connection.host || null,
          port: connection.port || null,
          username: connection.username || null,
          password: connection.password || null,
          databaseName: connection.databaseName || null,
          filePath: connection.filePath || null,
          apiKey: connection.apiKey || null,
          cloudProvider: connection.cloudProvider || null,
          status: connection.status || 'Pending',
          lastSync: connection.lastSync || null
        })
        .returning();
      console.log('Connection created successfully:', created);
      return created;
    } catch (error) {
      console.error('Error creating connection in database:', error);
      throw new Error(`Failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getConnections(userId: string, filters?: {
    category?: string;
    search?: string;
    status?: string;
  }): Promise<DataConnection[]> {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty array if no user config
    if (!userPoolResult) {
      return [];
    }

    const { db: userDb } = userPoolResult;
    
    try {
      // Build WHERE conditions using Drizzle ORM
      const conditions = [];

      if (filters?.category && filters.category !== 'all') {
        const categoryMap: { [key: string]: string[] } = {
          'database': ['Database', 'MySQL', 'PostgreSQL', 'SQL Server', 'Oracle', 'MongoDB'],
          'file': ['File', 'CSV', 'JSON', 'XML', 'Excel'],
          'cloud': ['Azure', 'AWS', 'GCP', 'Cloud'],
          'api': ['API', 'REST', 'GraphQL', 'HTTP'],
          'other': ['FTP', 'SFTP', 'Salesforce', 'SSH', 'Other']
        };

        if (categoryMap[filters.category]) {
          conditions.push(inArray(dataConnectionTable.connectionType, categoryMap[filters.category]));
        }
      }

      if (filters?.search) {
        conditions.push(like(dataConnectionTable.connectionName, `%${filters.search}%`));
      }

      if (filters?.status && filters.status !== 'all') {
        conditions.push(eq(dataConnectionTable.status, filters.status));
      }

      // Execute query with Drizzle ORM (automatically converts snake_case to camelCase)
      let result;
      if (conditions.length > 0) {
        result = await userDb
          .select()
          .from(dataConnectionTable)
          .where(and(...conditions))
          .orderBy(desc(dataConnectionTable.createdAt));
      } else {
        result = await userDb
          .select()
          .from(dataConnectionTable)
          .orderBy(desc(dataConnectionTable.createdAt));
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching connections:', error);
      throw new Error(`Failed to fetch connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getConnection(userId: string, id: number): Promise<DataConnection | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [connection] = await userDb
      .select()
      .from(dataConnectionTable)
      .where(eq(dataConnectionTable.connectionId, id));
    return connection || undefined;
  }

  async updateConnection(userId: string, id: number, updates: UpdateDataConnection): Promise<DataConnection | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [updated] = await userDb
      .update(dataConnectionTable)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(dataConnectionTable.connectionId, id))
      .returning();
    return updated || undefined;
  }

  async deleteConnection(userId: string, id: number): Promise<boolean> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return false;
    const { db: userDb } = userPoolResult;

    const result = await userDb
      .delete(dataConnectionTable)
      .where(eq(dataConnectionTable.connectionId, id));
    return (result.rowCount || 0) > 0;
  }

  async testConnection(userId: string, connectionData: Partial<DataConnection>): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const { connectionType, host, port, username, password, databaseName, apiKey, filePath } = connectionData;

    try {
      switch (connectionType?.toLowerCase()) {
        case 'database':
        case 'mysql':
        case 'postgresql':
        case 'sql server':
          if (!host || !username || !password) {
            return {
              success: false,
              message: 'Missing required database connection parameters'
            };
          }
          // Simulate database connection test
          await this.simulateConnectionDelay();
          return {
            success: true,
            message: 'Database connection successful',
            details: { host, port: port || 5432, database: databaseName }
          };

        case 'api':
        case 'rest':
        case 'http':
          if (!host || !apiKey) {
            return {
              success: false,
              message: 'Missing API endpoint or API key'
            };
          }
          await this.simulateConnectionDelay();
          return {
            success: true,
            message: 'API connection successful',
            details: { endpoint: host }
          };

        case 'file':
        case 'csv':
        case 'json':
          if (!filePath) {
            return {
              success: false,
              message: 'Missing file path'
            };
          }
          await this.simulateConnectionDelay();
          return {
            success: true,
            message: 'File access successful',
            details: { path: filePath }
          };

        case 'cloud':
        case 'azure':
        case 'aws':
        case 'gcp':
          if (!apiKey && !password) {
            return {
              success: false,
              message: 'Missing cloud credentials'
            };
          }
          await this.simulateConnectionDelay();
          return {
            success: true,
            message: 'Cloud connection successful',
            details: { provider: connectionType }
          };

        case 'ftp':
        case 'sftp':
          if (!host || !username || !password) {
            return {
              success: false,
              message: 'Missing FTP/SFTP credentials'
            };
          }
          await this.simulateConnectionDelay();
          return {
            success: true,
            message: 'FTP/SFTP connection successful',
            details: { host, port: port || 21 }
          };

        default:
          return {
            success: false,
            message: 'Unsupported connection type'
          };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        details: error
      };
    }
  }

  private async simulateConnectionDelay(): Promise<void> {
    // Simulate network delay for connection testing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 500));
  }

  // Get database schemas from a connection
  async getDatabaseSchemas(userId: string, connectionId: number): Promise<string[]> {
    // Get the connection details first
    const connection = await this.getConnection(userId, connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // For PostgreSQL connections, try to connect to the actual database
    if (connection.connectionType?.toLowerCase() === 'postgresql') {
      try {
        // Create connection to the external PostgreSQL database
        // Check if this is a cloud database that requires SSL
        const requiresSSL = connection.host?.includes('neon.tech') ||
                          connection.host?.includes('aws') ||
                          connection.host?.includes('gcp') ||
                          connection.host?.includes('azure');

        let pool;
        if (requiresSSL) {
          // Use connection string with SSL parameters for cloud databases
          const connectionString = `postgresql://${connection.username}:${connection.password}@${connection.host}:${connection.port || 5432}/${connection.databaseName}?sslmode=require`;
          pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000, // 10 second timeout
          });
        } else {
          // Use regular config for local databases
          pool = new Pool({
            host: connection.host || undefined,
            port: connection.port || 5432,
            database: connection.databaseName || undefined,
            user: connection.username || undefined,
            password: connection.password || undefined,
            ssl: false,
            connectionTimeoutMillis: 10000, // 10 second timeout
          });
        }

        const client = await pool.connect();
        try {
          const result = await client.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY schema_name
          `);

          await client.release();
          await pool.end();

          return result.rows.map((row: any) => row.schema_name);
        } catch (queryError) {
          await client.release();
          await pool.end();
          throw queryError;
        }
      } catch (error) {
        console.error('Error fetching schemas from external database:', error);
        throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // For MySQL connections, connect to the actual MySQL database
    if (connection.connectionType?.toLowerCase() === 'mysql') {
      try {
        const mysqlConnection = await mysql.createConnection({
          host: connection.host || undefined,
          port: connection.port || 3306,
          user: connection.username || undefined,
          password: connection.password || undefined,
          database: connection.databaseName || undefined,
          connectTimeout: 10000, // 10 second timeout
        });

        try {
          const [rows] = await mysqlConnection.query(`
            SELECT SCHEMA_NAME
            FROM information_schema.SCHEMATA
            WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
            ORDER BY SCHEMA_NAME
          `);

          await mysqlConnection.end();
          
          return (rows as any[]).map((row: any) => row.SCHEMA_NAME);
        } catch (queryError) {
          await mysqlConnection.end();
          throw queryError;
        }
      } catch (error) {
        console.error('Error fetching schemas from MySQL database:', error);
        throw new Error(`Failed to connect to MySQL database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Simulate fetching schemas for other connection types
    await this.simulateConnectionDelay();

    switch (connection.connectionType?.toLowerCase()) {
      case 'sql server':
        return ['dbo', 'sys', 'INFORMATION_SCHEMA', 'tempdb', 'model', 'msdb'];
      case 'oracle':
        return ['HR', 'OE', 'PM', 'IX', 'SH', 'BI'];
      default:
        return ['public', 'default'];
    }
  }

  // Get database columns from a connection, schema, and table
  async getDatabaseColumns(userId: string, connectionId: number, schemaName: string, tableName: string): Promise<string[]> {
    // Get the connection details first
    const connection = await this.getConnection(userId, connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // For PostgreSQL connections, try to connect to the actual database
    if (connection.connectionType?.toLowerCase() === 'postgresql') {
      try {
        // Create connection to the external PostgreSQL database
        // Check if this is a cloud database that requires SSL
        const requiresSSL = connection.host?.includes('neon.tech') ||
                          connection.host?.includes('aws') ||
                          connection.host?.includes('gcp') ||
                          connection.host?.includes('azure');

        let pool;
        if (requiresSSL) {
          // Use connection string with SSL parameters for cloud databases
          const connectionString = `postgresql://${connection.username}:${connection.password}@${connection.host}:${connection.port || 5432}/${connection.databaseName}?sslmode=require`;
          pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000, // 10 second timeout
          });
        } else {
          // Use regular config for local databases
          pool = new Pool({
            host: connection.host || undefined,
            port: connection.port || 5432,
            database: connection.databaseName || undefined,
            user: connection.username || undefined,
            password: connection.password || undefined,
            ssl: false,
            connectionTimeoutMillis: 10000, // 10 second timeout
          });
        }

        const client = await pool.connect();
        try {
          const result = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = $1
            AND table_name = $2
            ORDER BY ordinal_position
          `, [schemaName, tableName]);

          await client.release();
          await pool.end();

          return result.rows.map((row: any) => row.column_name);
        } catch (queryError) {
          await client.release();
          await pool.end();
          throw queryError;
        }
      } catch (error) {
        console.error('Error fetching columns from external database:', error);
        throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // For MySQL connections, connect to the actual MySQL database
    if (connection.connectionType?.toLowerCase() === 'mysql') {
      try {
        const mysqlConnection = await mysql.createConnection({
          host: connection.host || undefined,
          port: connection.port || 3306,
          user: connection.username || undefined,
          password: connection.password || undefined,
          database: connection.databaseName || undefined,
          connectTimeout: 10000, // 10 second timeout
        });

        try {
          const [rows] = await mysqlConnection.query(`
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
          `, [schemaName, tableName]);

          await mysqlConnection.end();
          
          return (rows as any[]).map((row: any) => row.COLUMN_NAME);
        } catch (queryError) {
          await mysqlConnection.end();
          throw queryError;
        }
      } catch (error) {
        console.error('Error fetching columns from MySQL database:', error);
        throw new Error(`Failed to connect to MySQL database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Return mock columns for other connection types
    await this.simulateConnectionDelay();
    return ['id', 'name', 'email', 'phone', 'address', 'city', 'state', 'country', 'postal_code', 'created_at', 'updated_at'];
  }

  // Get enhanced database column metadata with data types and constraints
  async getDatabaseColumnMetadata(userId: string, connectionId: number, schemaName: string, tableName: string): Promise<any[]> {
    // Get the connection details first
    const connection = await this.getConnection(userId, connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // For PostgreSQL connections, try to connect to the actual database
    if (connection.connectionType?.toLowerCase() === 'postgresql') {
      try {
        // Create connection to the external PostgreSQL database
        // Check if this is a cloud database that requires SSL
        const requiresSSL = connection.host?.includes('neon.tech') ||
                          connection.host?.includes('aws') ||
                          connection.host?.includes('gcp') ||
                          connection.host?.includes('azure');

        let pool;
        if (requiresSSL) {
          // Use connection string with SSL parameters for cloud databases
          const connectionString = `postgresql://${connection.username}:${connection.password}@${connection.host}:${connection.port || 5432}/${connection.databaseName}?sslmode=require`;
          pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000, // 10 second timeout
          });
        } else {
          // Use regular config for local databases
          pool = new Pool({
            host: connection.host || undefined,
            port: connection.port || 5432,
            database: connection.databaseName || undefined,
            user: connection.username || undefined,
            password: connection.password || undefined,
            ssl: false,
            connectionTimeoutMillis: 10000, // 10 second timeout
          });
        }

        const client = await pool.connect();
        try {
          const result = await client.query(`
            SELECT
              c.column_name,
              c.data_type,
              c.character_maximum_length,
              c.numeric_precision,
              c.numeric_scale,
              c.is_nullable,
              CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
              CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
              fk.foreign_table_name
            FROM information_schema.columns c
            LEFT JOIN (
              SELECT kcu.column_name, kcu.table_schema, kcu.table_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk ON c.column_name = pk.column_name
                AND c.table_schema = pk.table_schema
                AND c.table_name = pk.table_name
            LEFT JOIN (
              SELECT
                kcu.column_name,
                kcu.table_schema,
                kcu.table_name,
                ccu.table_name as foreign_table_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
            ) fk ON c.column_name = fk.column_name
                AND c.table_schema = fk.table_schema
                AND c.table_name = fk.table_name
            WHERE c.table_schema = $1
            AND c.table_name = $2
            ORDER BY c.ordinal_position
          `, [schemaName, tableName]);

          await client.release();
          await pool.end();

          return result.rows.map((row: any) => ({
            attributeName: row.column_name,
            dataType: row.data_type,
            length: row.character_maximum_length,
            precision: row.numeric_precision,
            scale: row.numeric_scale,
            isPrimaryKey: row.is_primary_key,
            isForeignKey: row.is_foreign_key,
            foreignKeyTable: row.foreign_table_name,
            columnDescription: '',
            isNotNull: row.is_nullable === 'NO'
          }));
        } catch (queryError) {
          await client.release();
          await pool.end();
          throw queryError;
        }
      } catch (error) {
        console.error('Error fetching column metadata from external database:', error);
        throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // For MySQL connections, connect to the actual MySQL database
    if (connection.connectionType?.toLowerCase() === 'mysql') {
      try {
        const mysqlConnection = await mysql.createConnection({
          host: connection.host || undefined,
          port: connection.port || 3306,
          user: connection.username || undefined,
          password: connection.password || undefined,
          database: connection.databaseName || undefined,
          connectTimeout: 10000, // 10 second timeout
        });

        try {
          const [rows] = await mysqlConnection.query(`
            SELECT
              c.COLUMN_NAME as column_name,
              c.DATA_TYPE as data_type,
              c.CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
              c.NUMERIC_PRECISION as numeric_precision,
              c.NUMERIC_SCALE as numeric_scale,
              c.IS_NULLABLE as is_nullable,
              CASE WHEN k.COLUMN_NAME IS NOT NULL AND k.CONSTRAINT_NAME = 'PRIMARY' THEN true ELSE false END as is_primary_key,
              CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN true ELSE false END as is_foreign_key,
              fk.REFERENCED_TABLE_NAME as foreign_table_name
            FROM information_schema.COLUMNS c
            LEFT JOIN information_schema.KEY_COLUMN_USAGE k
              ON c.TABLE_SCHEMA = k.TABLE_SCHEMA
              AND c.TABLE_NAME = k.TABLE_NAME
              AND c.COLUMN_NAME = k.COLUMN_NAME
              AND k.CONSTRAINT_NAME = 'PRIMARY'
            LEFT JOIN information_schema.KEY_COLUMN_USAGE fk
              ON c.TABLE_SCHEMA = fk.TABLE_SCHEMA
              AND c.TABLE_NAME = fk.TABLE_NAME
              AND c.COLUMN_NAME = fk.COLUMN_NAME
              AND fk.REFERENCED_TABLE_NAME IS NOT NULL
            WHERE c.TABLE_SCHEMA = ?
            AND c.TABLE_NAME = ?
            ORDER BY c.ORDINAL_POSITION
          `, [schemaName, tableName]);

          await mysqlConnection.end();
          
          return (rows as any[]).map((row: any) => ({
            attributeName: row.column_name,
            dataType: row.data_type,
            length: row.character_maximum_length,
            precision: row.numeric_precision,
            scale: row.numeric_scale,
            isPrimaryKey: row.is_primary_key,
            isForeignKey: row.is_foreign_key,
            foreignKeyTable: row.foreign_table_name,
            columnDescription: '',
            isNotNull: row.is_nullable === 'NO'
          }));
        } catch (queryError) {
          await mysqlConnection.end();
          throw queryError;
        }
      } catch (error) {
        console.error('Error fetching column metadata from MySQL database:', error);
        throw new Error(`Failed to connect to MySQL database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Return mock metadata for other connection types
    await this.simulateConnectionDelay();
    return [
      { attributeName: 'id', dataType: 'integer', isPrimaryKey: true, isForeignKey: false, columnDescription: '' },
      { attributeName: 'name', dataType: 'varchar', length: 255, isPrimaryKey: false, isForeignKey: false, columnDescription: '' },
      { attributeName: 'email', dataType: 'varchar', length: 255, isPrimaryKey: false, isForeignKey: false, columnDescription: '' },
      { attributeName: 'created_at', dataType: 'timestamp', isPrimaryKey: false, isForeignKey: false, columnDescription: '' }
    ];
  }

  // Get database tables from a connection and schema
  async getDatabaseTables(userId: string, connectionId: number, schemaName: string): Promise<string[]> {
    // Get the connection details first
    const connection = await this.getConnection(userId, connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // For PostgreSQL connections, try to connect to the actual database
    if (connection.connectionType?.toLowerCase() === 'postgresql') {
      try {
        // Create connection to the external PostgreSQL database
        // Check if this is a cloud database that requires SSL
        const requiresSSL = connection.host?.includes('neon.tech') ||
                          connection.host?.includes('aws') ||
                          connection.host?.includes('gcp') ||
                          connection.host?.includes('azure');

        let pool;
        if (requiresSSL) {
          // Use connection string with SSL parameters for cloud databases
          const connectionString = `postgresql://${connection.username}:${connection.password}@${connection.host}:${connection.port || 5432}/${connection.databaseName}?sslmode=require`;
          pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000, // 10 second timeout
          });
        } else {
          // Use regular config for local databases
          pool = new Pool({
            host: connection.host || undefined,
            port: connection.port || 5432,
            database: connection.databaseName || undefined,
            user: connection.username || undefined,
            password: connection.password || undefined,
            ssl: false,
            connectionTimeoutMillis: 10000, // 10 second timeout
          });
        }

        const client = await pool.connect();
        try {
          const result = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = $1
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
          `, [schemaName]);

          await client.release();
          await pool.end();

          return result.rows.map((row: any) => row.table_name);
        } catch (queryError) {
          await client.release();
          await pool.end();
          throw queryError;
        }
      } catch (error) {
        console.error('Error fetching tables from external database:', error);
        throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // For MySQL connections, connect to the actual MySQL database
    if (connection.connectionType?.toLowerCase() === 'mysql') {
      try {
        const mysqlConnection = await mysql.createConnection({
          host: connection.host || undefined,
          port: connection.port || 3306,
          user: connection.username || undefined,
          password: connection.password || undefined,
          database: connection.databaseName || undefined,
          connectTimeout: 10000, // 10 second timeout
        });

        try {
          const [rows] = await mysqlConnection.query(`
            SELECT TABLE_NAME
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
            AND TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
          `, [schemaName]);

          await mysqlConnection.end();
          
          return (rows as any[]).map((row: any) => row.TABLE_NAME);
        } catch (queryError) {
          await mysqlConnection.end();
          throw queryError;
        }
      } catch (error) {
        console.error('Error fetching tables from MySQL database:', error);
        throw new Error(`Failed to connect to MySQL database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Simulate fetching tables for other connection types
    await this.simulateConnectionDelay();

    // Return sample tables based on schema name
    const sampleTables: Record<string, string[]> = {
      'public': ['users', 'orders', 'products', 'customers', 'payments'],
      'sales_db': ['sales_transactions', 'sales_reps', 'territories', 'quotas'],
      'inventory_db': ['products', 'warehouses', 'stock_levels', 'suppliers'],
      'analytics': ['user_events', 'page_views', 'conversion_funnel', 'cohort_analysis'],
      'reporting': ['daily_summary', 'monthly_reports', 'kpi_metrics', 'dashboard_data'],
      'dbo': ['Customers', 'Orders', 'Products', 'Employees', 'Categories'],
      'HR': ['EMPLOYEES', 'DEPARTMENTS', 'JOBS', 'JOB_HISTORY', 'LOCATIONS'],
      'default': ['table1', 'table2', 'table3', 'table4', 'table5']
    };

    return sampleTables[schemaName] || sampleTables['default'];
  }

  // Pipeline configuration methods
  async getPipelines(userId: string, filters?: { search?: string; executionLayer?: string; sourceApplicationName?: string; targetApplicationName?: string; status?: string }): Promise<ConfigRecord[]> {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty array if no user config
    if (!userPoolResult) {
      return [];
    }

    const { pool: userPool } = userPoolResult;
    
    try {
      // Build WHERE conditions
      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.search) {
        whereClauses.push(`ct.source_table_name ILIKE $${paramIndex++}`);
        params.push(`%${filters.search}%`);
      }

      if (filters?.executionLayer && filters.executionLayer !== 'all') {
        whereClauses.push(`ct.execution_layer ILIKE $${paramIndex++}`);
        params.push(filters.executionLayer);
      }

      if (filters?.status && filters.status !== 'all') {
        whereClauses.push(`ct.active_flag = $${paramIndex++}`);
        params.push(filters.status);
      }

      // Check if application_config_table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'application_config_table'
        );
      `;
      const tableCheckResult = await userPool.query(tableCheckQuery);
      const hasApplicationConfigTable = tableCheckResult.rows[0]?.exists || false;

      let query: string;
      
      if (hasApplicationConfigTable) {
        // Add application name filters if table exists
        if (filters?.sourceApplicationName && filters.sourceApplicationName !== 'all') {
          whereClauses.push(`source_app.application_name ILIKE $${paramIndex++}`);
          params.push(`%${filters.sourceApplicationName}%`);
        }

        if (filters?.targetApplicationName && filters.targetApplicationName !== 'all') {
          whereClauses.push(`target_app.application_name ILIKE $${paramIndex++}`);
          params.push(`%${filters.targetApplicationName}%`);
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Execute raw SQL query with LEFT JOINs for both source and target applications
        query = `
          SELECT ct.*
          FROM config_table ct
          LEFT JOIN application_config_table source_app ON ct.source_application_id = source_app.application_id
          LEFT JOIN application_config_table target_app ON ct.target_application_id = target_app.application_id
          ${whereClause}
          ORDER BY ct.created_at DESC
        `;
      } else {
        // If application_config_table doesn't exist, query without joins
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        query = `
          SELECT ct.*
          FROM config_table ct
          ${whereClause}
          ORDER BY ct.created_at DESC
        `;
      }

      const result = await userPool.query(query, params);
      
      // Convert snake_case column names to camelCase
      return result.rows.map((row: any) => ({
        configKey: row.config_key,
        executionLayer: row.execution_layer,
        sourceSystem: row.source_system,
        sourceType: row.source_type,
        sourceFilePath: row.source_file_path,
        sourceFileName: row.source_file_name,
        sourceFileDelimiter: row.source_file_delimiter,
        sourceSchemaName: row.source_schema_name,
        sourceTableName: row.source_table_name,
        targetType: row.target_type,
        targetFilePath: row.target_file_path,
        targetFileDelimiter: row.target_file_delimiter,
        targetSchemaName: row.target_schema_name,
        temporaryTargetTable: row.temporary_target_table,
        targetTableName: row.target_table_name,
        loadType: row.load_type,
        primaryKey: row.primary_key,
        effectiveDate: row.effective_date_column,
        md5Columns: row.md5_columns,
        customCode: row.custom_code,
        executionSequence: row.execution_sequence,
        enableDynamicSchema: row.enable_dynamic_schema,
        activeFlag: row.active_flag,
        fullDataRefreshFlag: row.full_data_refresh_flag,
        connectionId: row.source_connection_id,
        sourceApplicationId: row.source_application_id,
        targetLayer: row.target_layer,
        targetSystem: row.target_system,
        targetConnectionId: row.target_connection_id,
        targetApplicationId: row.target_application_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) as ConfigRecord[];
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      throw new Error(`Failed to fetch pipelines: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPipeline(userId: string, id: number): Promise<ConfigRecord | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [pipeline] = await userDb.select().from(configTable).where(eq(configTable.configKey, id));
    return pipeline || undefined;
  }

  async getMaxConfigKey(userId: string): Promise<number> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return 0;
    const { db: userDb } = userPoolResult;

    try {
      const result = await userDb
        .select({ maxKey: sql<number>`COALESCE(MAX(config_key), 0)` })
        .from(configTable);
      
      return result[0]?.maxKey || 0;
    } catch (error) {
      console.error('Error fetching max config_key:', error);
      return 0;
    }
  }

  async createPipeline(userId: string, pipeline: InsertConfigRecord): Promise<ConfigRecord> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) throw new Error('User configuration not found');
    const { db: userDb } = userPoolResult;

    try {
      console.log('Creating pipeline with data:', JSON.stringify(pipeline, null, 2));
      const [created] = await userDb.insert(configTable).values(pipeline).returning();
      return created;
    } catch (error) {
      console.error('Error creating pipeline:', error);
      throw new Error(`Failed to create pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updatePipeline(userId: string, id: number, updates: UpdateConfigRecord): Promise<ConfigRecord | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [updated] = await userDb
      .update(configTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(configTable.configKey, id))
      .returning();
    return updated || undefined;
  }

  async deletePipeline(userId: string, id: number): Promise<boolean> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return false;
    const { db: userDb } = userPoolResult;

    const result = await userDb.delete(configTable).where(eq(configTable.configKey, id));
    return (result.rowCount || 0) > 0;
  }

  async getSourceApplications(userId: string): Promise<Array<{ applicationId: number; applicationName: string }>> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return [];
    const { pool: userPool } = userPoolResult;

    try {
      // Check if application_config table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'application_config'
        );
      `;
      const tableCheckResult = await userPool.query(tableCheckQuery);
      const hasApplicationConfig = tableCheckResult.rows[0]?.exists || false;

      if (!hasApplicationConfig) {
        return [];
      }

      // Get distinct source applications from config_table
      const query = `
        SELECT DISTINCT 
          ac.application_id as "applicationId",
          ac.application_name as "applicationName"
        FROM config_table ct
        INNER JOIN application_config ac ON ct.source_application_id = ac.application_id
        WHERE ct.source_application_id IS NOT NULL
        ORDER BY ac.application_name
      `;
      
      const result = await userPool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching source applications:', error);
      return [];
    }
  }

  async getTargetApplications(userId: string): Promise<Array<{ applicationId: number; applicationName: string }>> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return [];
    const { pool: userPool } = userPoolResult;

    try {
      // Check if application_config table exists
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'application_config'
        );
      `;
      const tableCheckResult = await userPool.query(tableCheckQuery);
      const hasApplicationConfig = tableCheckResult.rows[0]?.exists || false;

      if (!hasApplicationConfig) {
        return [];
      }

      // Get distinct target applications from config_table
      const query = `
        SELECT DISTINCT 
          ac.application_id as "applicationId",
          ac.application_name as "applicationName"
        FROM config_table ct
        INNER JOIN application_config ac ON ct.target_application_id = ac.application_id
        WHERE ct.target_application_id IS NOT NULL
        ORDER BY ac.application_name
      `;
      
      const result = await userPool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching target applications:', error);
      return [];
    }
  }

  async getDataDictionaryTargetApplications(userId: string): Promise<Array<{ applicationId: number; applicationName: string }>> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return [];
    const { pool: userPool } = userPoolResult;

    try {
      console.log('🔍 Debugging FIN_CCFD_branch example...');
      
      // Check specific table mentioned by user
      const finCheck = await userPool.query(`
        SELECT 
          dd.config_key as dd_config_key,
          dd.table_name as dd_table_name,
          ct.config_key as ct_config_key,
          ct.target_table_name as ct_target_table,
          ct.target_application_id,
          ct.source_application_id,
          COALESCE(ct.target_application_id, ct.source_application_id) as coalesced_app_id
        FROM data_dictionary_table dd
        LEFT JOIN config_table ct ON dd.config_key = ct.config_key
        WHERE dd.table_name = 'FIN_CCFD_branch'
        LIMIT 5
      `);
      console.log('📋 FIN_CCFD_branch data:', JSON.stringify(finCheck.rows, null, 2));
      
      // Use COALESCE to check target_application_id first, then fall back to source_application_id
      // This works with existing data and provides a migration path
      const query = `
        SELECT DISTINCT 
          ac.application_id as "applicationId",
          ac.application_name as "applicationName"
        FROM data_dictionary_table dd
        INNER JOIN config_table ct ON dd.config_key = ct.config_key
        INNER JOIN application_config ac ON COALESCE(ct.target_application_id, ct.source_application_id) = ac.application_id
        WHERE COALESCE(ct.target_application_id, ct.source_application_id) IS NOT NULL
        ORDER BY ac.application_name
      `;
      
      console.log('🚀 Executing COALESCE query...');
      const result = await userPool.query(query);
      console.log(`📦 Found ${result.rows.length} applications:`, result.rows);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching data dictionary target applications:', error);
      return [];
    }
  }

  async getMetadata(userId: string, type: string): Promise<string[]> {
    // Static metadata for dropdowns - in production this could come from a metadata table
    const metadataMap: Record<string, string[]> = {
      'execution_layer': ['Bronze', 'Silver', 'Gold'],
      'load_type': ['Truncate', 'Incremental', 'SCD1', 'SCD2'],
      'source_system': ['MySQL', 'PostgreSQL', 'SQL Server', 'Oracle', 'CSV', 'JSON', 'Parquet', 'Excel', 'API'],
      'connection_types': ['MySQL', 'PostgreSQL', 'SQL Server', 'Oracle', 'CSV', 'JSON', 'Parquet', 'Excel', 'API'],
      'source_type': ['Table', 'File', 'API'],
      'target_type': ['Table', 'File', 'API'],
      'file_delimiter': [',', ';', '|', '\t', 'NA'],
      'active_flag': ['Y', 'N'],
      'dynamic_schema': ['Y', 'N'],
      'full_refresh_flag': ['Y', 'N'],
      'execution_sequence': ['Pre', 'Post', 'NA'],
      'effective_date': ['created_at', 'updated_at', 'last_modified', 'effective_date'],
      'data_type': ['int', 'bigint', 'varchar', 'text', 'char', 'decimal', 'float', 'double', 'boolean', 'date', 'datetime', 'timestamp', 'json', 'blob'],
      'is_not_null': ['Yes', 'No'],
      'is_primary_key': ['Yes', 'No'],
      'is_foreign_key': ['Yes', 'No'],
      'recon_type': ['Count Check', 'Amount Check', 'Sum Check', 'Data Check', 'Duplicate Check', 'Null Check']
    };

    return metadataMap[type] || [];
  }

  // Data dictionary implementation
  async getDataDictionaryEntries(userId: string, filters?: { search?: string; executionLayer?: string; schemaName?: string; tableName?: string; targetApplicationName?: string; customField?: string; customValue?: string }): Promise<DataDictionaryRecord[]> {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty array if no user config
    if (!userPoolResult) {
      return [];
    }

    const { db: userDb } = userPoolResult;
    
    try {
      // Build WHERE conditions using Drizzle ORM
      const conditions = [];

      if (filters?.search) {
        conditions.push(like(dataDictionaryTable.attributeName, `%${filters.search}%`));
      }

      if (filters?.executionLayer && filters.executionLayer !== 'all') {
        conditions.push(eq(dataDictionaryTable.executionLayer, filters.executionLayer));
      }

      if (filters?.schemaName && filters.schemaName !== 'all') {
        conditions.push(eq(dataDictionaryTable.schemaName, filters.schemaName));
      }

      if (filters?.tableName && filters.tableName !== 'all') {
        conditions.push(eq(dataDictionaryTable.tableName, filters.tableName));
      }

      // Handle custom field filtering
      if (filters?.customField && filters?.customValue && filters.customField !== 'all') {
        switch (filters.customField) {
          case 'attributeName':
            conditions.push(like(dataDictionaryTable.attributeName, `%${filters.customValue}%`));
            break;
          case 'dataType':
            conditions.push(like(dataDictionaryTable.dataType, `%${filters.customValue}%`));
            break;
          case 'schemaName':
            conditions.push(like(dataDictionaryTable.schemaName, `%${filters.customValue}%`));
            break;
          case 'tableName':
            conditions.push(like(dataDictionaryTable.tableName, `%${filters.customValue}%`));
            break;
          case 'columnDescription':
            conditions.push(like(dataDictionaryTable.columnDescription, `%${filters.customValue}%`));
            break;
          case 'createdBy':
            conditions.push(like(dataDictionaryTable.createdBy, `%${filters.customValue}%`));
            break;
          case 'updatedBy':
            conditions.push(like(dataDictionaryTable.updatedBy, `%${filters.customValue}%`));
            break;
          case 'configKey':
            const configKeyValue = parseInt(filters.customValue);
            if (!isNaN(configKeyValue)) {
              conditions.push(eq(dataDictionaryTable.configKey, configKeyValue));
            }
            break;
        }
      }

      // Execute query with Drizzle ORM
      // If filtering by target application name, join through config_table and application_config
      let result;
      
      if (filters?.targetApplicationName && filters.targetApplicationName !== 'all') {
        // Add join condition for target application filter
        conditions.push(eq(applicationConfigTable.applicationName, filters.targetApplicationName));
        
        // Use COALESCE to check target_application_id first, then fall back to source_application_id
        const appIdJoinCondition = sql`COALESCE(${configTable.targetApplicationId}, ${configTable.sourceApplicationId}) = ${applicationConfigTable.applicationId}`;
        
        if (conditions.length > 0) {
          result = await userDb
            .select({
              dataDictionaryKey: dataDictionaryTable.dataDictionaryKey,
              configKey: dataDictionaryTable.configKey,
              executionLayer: dataDictionaryTable.executionLayer,
              schemaName: dataDictionaryTable.schemaName,
              tableName: dataDictionaryTable.tableName,
              attributeName: dataDictionaryTable.attributeName,
              dataType: dataDictionaryTable.dataType,
              length: dataDictionaryTable.length,
              precisionValue: dataDictionaryTable.precisionValue,
              scale: dataDictionaryTable.scale,
              isNotNull: dataDictionaryTable.isNotNull,
              isPrimaryKey: dataDictionaryTable.isPrimaryKey,
              isForeignKey: dataDictionaryTable.isForeignKey,
              activeFlag: dataDictionaryTable.activeFlag,
              columnDescription: dataDictionaryTable.columnDescription,
              createdBy: dataDictionaryTable.createdBy,
              updatedBy: dataDictionaryTable.updatedBy,
              insertDate: dataDictionaryTable.insertDate,
              updateDate: dataDictionaryTable.updateDate,
            })
            .from(dataDictionaryTable)
            .innerJoin(configTable, eq(dataDictionaryTable.configKey, configTable.configKey))
            .innerJoin(applicationConfigTable, appIdJoinCondition)
            .where(and(...conditions))
            .orderBy(desc(dataDictionaryTable.insertDate));
        } else {
          result = await userDb
            .select({
              dataDictionaryKey: dataDictionaryTable.dataDictionaryKey,
              configKey: dataDictionaryTable.configKey,
              executionLayer: dataDictionaryTable.executionLayer,
              schemaName: dataDictionaryTable.schemaName,
              tableName: dataDictionaryTable.tableName,
              attributeName: dataDictionaryTable.attributeName,
              dataType: dataDictionaryTable.dataType,
              length: dataDictionaryTable.length,
              precisionValue: dataDictionaryTable.precisionValue,
              scale: dataDictionaryTable.scale,
              isNotNull: dataDictionaryTable.isNotNull,
              isPrimaryKey: dataDictionaryTable.isPrimaryKey,
              isForeignKey: dataDictionaryTable.isForeignKey,
              activeFlag: dataDictionaryTable.activeFlag,
              columnDescription: dataDictionaryTable.columnDescription,
              createdBy: dataDictionaryTable.createdBy,
              updatedBy: dataDictionaryTable.updatedBy,
              insertDate: dataDictionaryTable.insertDate,
              updateDate: dataDictionaryTable.updateDate,
            })
            .from(dataDictionaryTable)
            .innerJoin(configTable, eq(dataDictionaryTable.configKey, configTable.configKey))
            .innerJoin(applicationConfigTable, appIdJoinCondition)
            .orderBy(desc(dataDictionaryTable.insertDate));
        }
      } else {
        // No join needed - standard query
        if (conditions.length > 0) {
          result = await userDb
            .select()
            .from(dataDictionaryTable)
            .where(and(...conditions))
            .orderBy(desc(dataDictionaryTable.insertDate));
        } else {
          result = await userDb
            .select()
            .from(dataDictionaryTable)
            .orderBy(desc(dataDictionaryTable.insertDate));
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching data dictionary entries:', error);
      throw new Error(`Failed to fetch data dictionary entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDataDictionaryEntriesByConfig(userId: string, configKey: string, layer: string): Promise<DataDictionaryRecord[]> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return [];
    const { db: userDb } = userPoolResult;

    const configKeyNumber = parseInt(configKey);
    const entries = await userDb
      .select()
      .from(dataDictionaryTable)
      .where(and(
        eq(dataDictionaryTable.configKey, configKeyNumber),
        eq(dataDictionaryTable.executionLayer, layer)
      ))
      .orderBy(dataDictionaryTable.schemaName, dataDictionaryTable.tableName);
    return entries;
  }

  async getDataDictionaryEntry(userId: string, id: number): Promise<DataDictionaryRecord | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [entry] = await userDb
      .select()
      .from(dataDictionaryTable)
      .where(eq(dataDictionaryTable.dataDictionaryKey, id));
    return entry || undefined;
  }

  async createDataDictionaryEntry(userId: string, entry: InsertDataDictionaryRecord): Promise<DataDictionaryRecord> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) throw new Error('User configuration not found');
    const { db: userDb } = userPoolResult;

    try {
      const [created] = await userDb
        .insert(dataDictionaryTable)
        .values({
          configKey: entry.configKey,
          executionLayer: entry.executionLayer,
          schemaName: entry.schemaName || null,
          tableName: entry.tableName || null,
          attributeName: entry.attributeName,
          dataType: entry.dataType,
          length: entry.length || null,
          precisionValue: entry.precisionValue || null,
          scale: entry.scale || null,
          columnDescription: entry.columnDescription || null,
          createdBy: entry.createdBy || 'API_USER',
          updatedBy: entry.updatedBy || 'API_USER',
          isNotNull: entry.isNotNull || 'N',
          isPrimaryKey: entry.isPrimaryKey || 'N',
          isForeignKey: entry.isForeignKey || 'N',
          activeFlag: entry.activeFlag || 'Y'
        })
        .returning();
      
      console.log('Successfully inserted data dictionary entry with ID:', created.dataDictionaryKey);
      return created;
    } catch (error) {
      console.error('Error creating data dictionary entry:', error);
      throw error;
    }
  }

  async updateDataDictionaryEntry(userId: string, id: number, updates: UpdateDataDictionaryRecord): Promise<DataDictionaryRecord | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    try {
      const [updated] = await userDb
        .update(dataDictionaryTable)
        .set({
          ...updates,
          updatedBy: updates.updatedBy || 'System'
        })
        .where(eq(dataDictionaryTable.dataDictionaryKey, id))
        .returning();

      console.log('Successfully updated data dictionary entry with ID:', id);
      return updated || undefined;
    } catch (error) {
      console.error('Error updating data dictionary entry:', error);
      throw error;
    }
  }

  async deleteDataDictionaryEntry(userId: string, id: number): Promise<boolean> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return false;
    const { db: userDb } = userPoolResult;

    const result = await userDb
      .delete(dataDictionaryTable)
      .where(eq(dataDictionaryTable.dataDictionaryKey, id));
    return (result.rowCount || 0) > 0;
  }

  // Reconciliation config methods implementation
  async getReconciliationConfigs(userId: string, filters?: { search?: string; executionLayer?: string; configKey?: number; reconType?: string; status?: string }): Promise<ReconciliationConfig[]> {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty array if no user config
    if (!userPoolResult) {
      return [];
    }

    const { db: userDb } = userPoolResult;
    
    try {
      // Build WHERE conditions using Drizzle ORM
      const conditions = [];

      if (filters?.search) {
        conditions.push(
          or(
            ilike(reconciliationConfigTable.sourceTable, `%${filters.search}%`),
            ilike(reconciliationConfigTable.targetTable, `%${filters.search}%`)
          )
        );
      }

      if (filters?.executionLayer && filters.executionLayer !== 'all') {
        conditions.push(ilike(reconciliationConfigTable.executionLayer, filters.executionLayer));
      }

      if (filters?.configKey) {
        conditions.push(eq(reconciliationConfigTable.configKey, filters.configKey));
      }

      if (filters?.reconType && filters.reconType !== 'all') {
        conditions.push(ilike(reconciliationConfigTable.reconType, filters.reconType));
      }

      if (filters?.status && filters.status !== 'all') {
        conditions.push(eq(reconciliationConfigTable.activeFlag, filters.status));
      }

      // Execute query with Drizzle ORM (automatically converts snake_case to camelCase)
      let result;
      if (conditions.length > 0) {
        result = await userDb
          .select()
          .from(reconciliationConfigTable)
          .where(and(...conditions))
          .orderBy(desc(reconciliationConfigTable.reconKey));
      } else {
        result = await userDb
          .select()
          .from(reconciliationConfigTable)
          .orderBy(desc(reconciliationConfigTable.reconKey));
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching reconciliation configs:', error);
      throw new Error(`Failed to fetch reconciliation configs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getReconciliationConfig(userId: string, id: number): Promise<ReconciliationConfig | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [config] = await userDb
      .select()
      .from(reconciliationConfigTable)
      .where(eq(reconciliationConfigTable.reconKey, id));
    return config || undefined;
  }

  async createReconciliationConfig(userId: string, config: InsertReconciliationConfig): Promise<ReconciliationConfig> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) throw new Error('User configuration not found');
    const { db: userDb } = userPoolResult;

    // Get the maximum existing recon_key
    const maxKeyResult = await userDb
      .select({ maxKey: sql<number>`COALESCE(MAX(${reconciliationConfigTable.reconKey}), 0)` })
      .from(reconciliationConfigTable);

    const nextKey = (maxKeyResult[0]?.maxKey ?? 0) + 1;

    console.log('Creating reconciliation config with next recon_key:', nextKey);
    
    // Use Drizzle ORM insert with explicit recon_key
    const [created] = await userDb
      .insert(reconciliationConfigTable)
      .values({
        reconKey: nextKey,
        configKey: config.configKey,
        executionLayer: config.executionLayer,
        sourceSchema: config.sourceSchema,
        sourceTable: config.sourceTable,
        targetSchema: config.targetSchema,
        targetTable: config.targetTable,
        reconType: config.reconType,
        attribute: config.attribute,
        sourceQuery: config.sourceQuery,
        targetQuery: config.targetQuery,
        thresholdPercentage: config.thresholdPercentage,
        activeFlag: config.activeFlag || 'Y',
      })
      .returning();
      
    console.log('Created reconciliation config with recon_key:', created.reconKey);
    
    return created;
  }

  async updateReconciliationConfig(userId: string, id: number, updates: UpdateReconciliationConfig): Promise<ReconciliationConfig | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [updated] = await userDb
      .update(reconciliationConfigTable)
      .set(updates)
      .where(eq(reconciliationConfigTable.reconKey, id))
      .returning();
    return updated || undefined;
  }

  

  async deleteReconciliationConfig(userId: string, id: number): Promise<boolean> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return false;
    const { db: userDb } = userPoolResult;

    const result = await userDb
      .delete(reconciliationConfigTable)
      .where(eq(reconciliationConfigTable.reconKey, id));
    return (result.rowCount || 0) > 0;
  }

  async getApplicationConfigs(userId: string, filters?: { search?: string; status?: string; applicationType?: string }): Promise<ApplicationConfig[]> {
    const userPoolResult = await getUserSpecificPool(userId);
    
    if (!userPoolResult) {
      return [];
    }

    const { db: userDb } = userPoolResult;
    
    try {
      const conditions = [];

      if (filters?.search) {
        conditions.push(
          or(
            ilike(applicationConfigTable.applicationName, `%${filters.search}%`),
            ilike(applicationConfigTable.applicationOwner, `%${filters.search}%`)
          )
        );
      }

      if (filters?.status) {
        conditions.push(eq(applicationConfigTable.status, filters.status));
      }

      if (filters?.applicationType) {
        conditions.push(eq(applicationConfigTable.applicationType, filters.applicationType));
      }

      const query = conditions.length > 0
        ? userDb.select().from(applicationConfigTable).where(and(...conditions))
        : userDb.select().from(applicationConfigTable);

      return await query.orderBy(desc(applicationConfigTable.lastUpdated));
    } catch (error) {
      console.error('Error fetching application configs:', error);
      return [];
    }
  }

  async getApplicationConfig(userId: string, id: number): Promise<ApplicationConfig | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [result] = await userDb
      .select()
      .from(applicationConfigTable)
      .where(eq(applicationConfigTable.applicationId, id));
    return result || undefined;
  }

  async createApplicationConfig(userId: string, config: InsertApplicationConfig): Promise<ApplicationConfig> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) throw new Error('User configuration not found');
    const { db: userDb } = userPoolResult;

    const [created] = await userDb
      .insert(applicationConfigTable)
      .values(config)
      .returning();
    return created;
  }

  async updateApplicationConfig(userId: string, id: number, updates: UpdateApplicationConfig): Promise<ApplicationConfig | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const updateData = {
      ...updates,
      lastUpdated: new Date(),
    };

    const [updated] = await userDb
      .update(applicationConfigTable)
      .set(updateData)
      .where(eq(applicationConfigTable.applicationId, id))
      .returning();
    return updated || undefined;
  }

  async deleteApplicationConfig(userId: string, id: number): Promise<boolean> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return false;
    const { db: userDb } = userPoolResult;

    const result = await userDb
      .delete(applicationConfigTable)
      .where(eq(applicationConfigTable.applicationId, id));
    return (result.rowCount || 0) > 0;
  }

  async findMatchingConfig(userId: string, criteria: {
    executionLayer?: string;
    sourceSystem?: string;
    sourceType?: string;
    sourceSchemaName?: string;
    sourceTableName?: string;
    targetSystem?: string;
    targetType?: string;
    targetSchemaName?: string;
    targetTableName?: string;
  }): Promise<ConfigRecord | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    try {
      // Build WHERE conditions for matching
      const conditions = [];

      if (criteria.executionLayer) {
        conditions.push(ilike(configTable.executionLayer, criteria.executionLayer));
      }
      if (criteria.sourceSystem) {
        conditions.push(ilike(configTable.sourceSystem, criteria.sourceSystem));
      }
      if (criteria.sourceType) {
        conditions.push(ilike(configTable.sourceType, criteria.sourceType));
      }
      if (criteria.sourceSchemaName) {
        conditions.push(ilike(configTable.sourceSchemaName, criteria.sourceSchemaName));
      }
      if (criteria.sourceTableName) {
        conditions.push(ilike(configTable.sourceTableName, criteria.sourceTableName));
      }
      if (criteria.targetSystem) {
        conditions.push(ilike(configTable.targetSystem, criteria.targetSystem));
      }
      if (criteria.targetType) {
        conditions.push(ilike(configTable.targetType, criteria.targetType));
      }
      if (criteria.targetSchemaName) {
        conditions.push(ilike(configTable.targetSchemaName, criteria.targetSchemaName));
      }
      if (criteria.targetTableName) {
        conditions.push(ilike(configTable.targetTableName, criteria.targetTableName));
      }

      // Only search if we have at least one condition
      if (conditions.length === 0) {
        return undefined;
      }

      // Search for matching config
      const [matchingConfig] = await userDb
        .select()
        .from(configTable)
        .where(and(...conditions))
        .limit(1);

      return matchingConfig || undefined;
    } catch (error) {
      console.error('Error finding matching config:', error);
      return undefined;
    }
  }

  // Data Quality Config implementations
  async getDataQualityConfigs(userId: string, filters?: { search?: string; executionLayer?: string; configKey?: number; validationType?: string; status?: string }): Promise<DataQualityConfig[]> {
    const userPoolResult = await getUserSpecificPool(userId);
    
    // Return empty array if no user config
    if (!userPoolResult) {
      return [];
    }

    const { db: userDb } = userPoolResult;
    
    try {
      // Build WHERE conditions using Drizzle ORM
      const conditions = [];

      if (filters?.search) {
        conditions.push(
          or(
            ilike(dataQualityConfigTable.tableName, `%${filters.search}%`),
            ilike(dataQualityConfigTable.attributeName, `%${filters.search}%`)
          )
        );
      }

      if (filters?.executionLayer && filters.executionLayer !== 'all') {
        conditions.push(ilike(dataQualityConfigTable.executionLayer, filters.executionLayer));
      }

      if (filters?.configKey) {
        conditions.push(eq(dataQualityConfigTable.configKey, filters.configKey));
      }

      if (filters?.validationType && filters.validationType !== 'all') {
        conditions.push(ilike(dataQualityConfigTable.validationType, filters.validationType));
      }

      if (filters?.status && filters.status !== 'all') {
        conditions.push(eq(dataQualityConfigTable.activeFlag, filters.status));
      }

      // Execute query with Drizzle ORM (automatically converts snake_case to camelCase)
      let result;
      if (conditions.length > 0) {
        result = await userDb
          .select()
          .from(dataQualityConfigTable)
          .where(and(...conditions))
          .orderBy(desc(dataQualityConfigTable.dataQualityKey));
      } else {
        result = await userDb
          .select()
          .from(dataQualityConfigTable)
          .orderBy(desc(dataQualityConfigTable.dataQualityKey));
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching data quality configs:', error);
      throw new Error(`Failed to fetch data quality configs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDataQualityConfig(userId: string, id: number): Promise<DataQualityConfig | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [config] = await userDb
      .select()
      .from(dataQualityConfigTable)
      .where(eq(dataQualityConfigTable.dataQualityKey, id));
    return config || undefined;
  }

  async createDataQualityConfig(userId: string, config: InsertDataQualityConfig): Promise<DataQualityConfig> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) throw new Error('User configuration not found');
    const { db: userDb } = userPoolResult;

    // Get the maximum existing data_quality_key
    const maxKeyResult = await userDb
      .select({ maxKey: sql<number>`COALESCE(MAX(${dataQualityConfigTable.dataQualityKey}), 0)` })
      .from(dataQualityConfigTable);

    const nextKey = (maxKeyResult[0]?.maxKey ?? 0) + 1;

    // Only insert fields that exist in the external database, with explicit primary key
    const insertData = {
      dataQualityKey: nextKey,
      configKey: config.configKey,
      executionLayer: config.executionLayer,
      tableName: config.tableName,
      attributeName: config.attributeName,
      validationType: config.validationType,
      referenceTableName: config.referenceTableName,
      defaultValue: config.defaultValue,
      errorTableTransferFlag: config.errorTableTransferFlag,
      thresholdPercentage: config.thresholdPercentage,
      activeFlag: config.activeFlag,
      customQuery: config.customQuery,
    };

    const [created] = await userDb
      .insert(dataQualityConfigTable)
      .values(insertData)
      .returning();
    return created;
  }

  async updateDataQualityConfig(userId: string, id: number, updates: UpdateDataQualityConfig): Promise<DataQualityConfig | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return undefined;
    const { db: userDb } = userPoolResult;

    const [updated] = await userDb
      .update(dataQualityConfigTable)
      .set(updates)
      .where(eq(dataQualityConfigTable.dataQualityKey, id))
      .returning();
    return updated || undefined;
  }

  async deleteDataQualityConfig(userId: string, id: number): Promise<boolean> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) return false;
    const { db: userDb } = userPoolResult;

    const result = await userDb
      .delete(dataQualityConfigTable)
      .where(eq(dataQualityConfigTable.dataQualityKey, id));
    return (result.rowCount || 0) > 0;
  }

  // User Config DB Settings methods implementation
  async getUserConfigDbSettings(userId: string): Promise<UserConfigDbSettings | undefined> {
    const [settings] = await db
      .select()
      .from(userConfigDbSettings)
      .where(and(
        eq(userConfigDbSettings.userId, userId),
        eq(userConfigDbSettings.isActive, true)
      ))
      .orderBy(desc(userConfigDbSettings.createdAt))
      .limit(1);
    return settings || undefined;
  }

  async createUserConfigDbSettings(settings: InsertUserConfigDbSettings): Promise<UserConfigDbSettings> {
    const [created] = await db
      .insert(userConfigDbSettings)
      .values(settings)
      .returning();
    return created;
  }

  async updateUserConfigDbSettings(userId: string, updates: UpdateUserConfigDbSettings): Promise<UserConfigDbSettings | undefined> {
    const [updated] = await db
      .update(userConfigDbSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userConfigDbSettings.userId, userId))
      .returning();
    return updated || undefined;
  }

  async testUserConfigDbConnection(settings: Partial<UserConfigDbSettings>): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    if (!settings.host || !settings.port || !settings.database || !settings.username || !settings.password) {
      return {
        success: false,
        message: 'Missing required connection parameters',
      };
    }

    // Detect database type based on port (3306 = MySQL, 5432 = PostgreSQL)
    const isMySQL = settings.port === 3306;
    const isPostgreSQL = settings.port === 5432;
    
    if (!isMySQL && !isPostgreSQL) {
      return {
        success: false,
        message: 'Unsupported database port. Use 3306 for MySQL or 5432 for PostgreSQL.',
      };
    }

    if (isMySQL) {
      // Test MySQL connection
      let connection = null;
      
      try {
        connection = await mysql.createConnection({
          host: settings.host,
          port: settings.port,
          database: settings.database,
          user: settings.username,
          password: settings.password,
          ssl: settings.sslEnabled ? {} : undefined,
          connectTimeout: settings.connectionTimeout || 10000,
        });

        await connection.query('SELECT 1');
        
        return {
          success: true,
          message: 'MySQL connection successful',
        };
      } catch (error: any) {
        return {
          success: false,
          message: 'MySQL connection failed',
          details: error.message,
        };
      } finally {
        if (connection) {
          await connection.end();
        }
      }
    } else {
      // Test PostgreSQL connection
      let testPool: Pool | null = null;
      
      try {
        testPool = new Pool({
          host: settings.host,
          port: settings.port,
          database: settings.database,
          user: settings.username,
          password: settings.password,
          ssl: settings.sslEnabled ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: settings.connectionTimeout || 10000,
        });

        // Test basic query
        await testPool.query('SELECT 1');
        
        // Test if config_table exists
        try {
          await testPool.query('SELECT COUNT(*) FROM config_table LIMIT 1');
        } catch (tableError: any) {
          return {
            success: false,
            message: 'Connection successful but config_table not found or not accessible',
            details: tableError.message,
          };
        }
        
        return {
          success: true,
          message: 'PostgreSQL connection successful and config_table accessible',
        };
      } catch (error: any) {
        return {
          success: false,
          message: 'PostgreSQL connection failed',
          details: error.message,
        };
      } finally {
        if (testPool) {
          await testPool.end();
        }
      }
    }
  }

  // User Activity methods implementation
  async logUserActivity(activity: InsertUserActivity): Promise<UserActivity> {
    const [logged] = await db
      .insert(userActivity)
      .values(activity)
      .returning();
    return logged;
  }

  async getUserActivity(userId: string, limit: number = 50): Promise<UserActivity[]> {
    return await db
      .select()
      .from(userActivity)
      .where(eq(userActivity.userId, userId))
      .orderBy(desc(userActivity.timestamp))
      .limit(limit);
  }

  // Chat History methods implementation
  async ensureChatHistoryTables(userId: string): Promise<boolean> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return false;
    }

    const client = await userPoolResult.pool.connect();
    try {
      // Create chat_sessions table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          session_id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          connection_name VARCHAR(255) NOT NULL,
          layer VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create chat_messages table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          message_id VARCHAR(100) PRIMARY KEY,
          session_id VARCHAR(100) NOT NULL,
          message_type VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          sql TEXT,
          data TEXT,
          columns TEXT,
          row_count INTEGER,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index for faster lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_connection_layer 
        ON chat_sessions(user_id, connection_name, layer, updated_at DESC)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_session 
        ON chat_messages(session_id, timestamp)
      `);

      return true;
    } catch (error) {
      console.error('Error ensuring chat history tables:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async createChatSession(userId: string, connectionName: string, layer: string): Promise<{ sessionId: string }> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      throw new Error('User config database not found');
    }

    await this.ensureChatHistoryTables(userId);

    const client = await userPoolResult.pool.connect();
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store layer in lowercase for consistency
      await client.query(
        `INSERT INTO chat_sessions (session_id, user_id, connection_name, layer, created_at, updated_at)
         VALUES ($1, $2, $3, LOWER($4), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [sessionId, userId, connectionName, layer]
      );

      return { sessionId };
    } finally {
      client.release();
    }
  }

  async getChatSessions(userId: string, connectionName?: string, layer?: string, limit: number = 20) {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return [];
    }

    await this.ensureChatHistoryTables(userId);

    const client = await userPoolResult.pool.connect();
    try {
      // Build WHERE clause dynamically based on provided filters
      let whereClause = 'WHERE cs.user_id = $1';
      const params: any[] = [userId];
      
      if (connectionName) {
        params.push(connectionName);
        whereClause += ` AND cs.connection_name = $${params.length}`;
      }
      
      if (layer) {
        params.push(layer);
        whereClause += ` AND LOWER(cs.layer) = LOWER($${params.length})`;
      }
      
      params.push(limit);
      
      const result = await client.query(
        `SELECT 
          cs.session_id,
          cs.connection_name,
          cs.layer,
          cs.created_at,
          cs.updated_at,
          COUNT(cm.message_id) as message_count,
          (SELECT content FROM chat_messages WHERE session_id = cs.session_id AND message_type = 'user' ORDER BY timestamp LIMIT 1) as first_message
         FROM chat_sessions cs
         LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
         ${whereClause}
         GROUP BY cs.session_id, cs.connection_name, cs.layer, cs.created_at, cs.updated_at
         ORDER BY cs.updated_at DESC
         LIMIT $${params.length}`,
        params
      );

      return result.rows.map((row: any) => ({
        sessionId: row.session_id,
        connectionName: row.connection_name,
        layer: row.layer,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messageCount: parseInt(row.message_count, 10),
        firstMessage: row.first_message,
      }));
    } finally {
      client.release();
    }
  }

  async getChatMessages(userId: string, sessionId: string) {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return [];
    }

    const client = await userPoolResult.pool.connect();
    try {
      // Ensure chart_type column exists
      await client.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN IF NOT EXISTS chart_type VARCHAR(50)
      `);
      
      const result = await client.query(
        `SELECT message_id, session_id, message_type, content, sql, data, columns, row_count, chart_type, timestamp
         FROM chat_messages
         WHERE session_id = $1
         ORDER BY timestamp ASC`,
        [sessionId]
      );

      return result.rows.map((row: any) => ({
        messageId: row.message_id,
        sessionId: row.session_id,
        messageType: row.message_type,
        content: row.content,
        sql: row.sql,
        data: row.data,
        columns: row.columns,
        rowCount: row.row_count,
        chartType: row.chart_type,
        timestamp: row.timestamp,
      }));
    } finally {
      client.release();
    }
  }

  async saveChatMessage(userId: string, message: {
    messageId: string;
    sessionId: string;
    messageType: string;
    content: string;
    sql?: string;
    data?: any;
    columns?: string[];
    rowCount?: number;
    chartType?: string;
  }): Promise<void> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      throw new Error('User config database not found');
    }

    const client = await userPoolResult.pool.connect();
    try {
      // First, ensure chart_type column exists in chat_messages table
      await client.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN IF NOT EXISTS chart_type VARCHAR(50)
      `);
      
      await client.query(
        `INSERT INTO chat_messages (message_id, session_id, message_type, content, sql, data, columns, row_count, chart_type, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          message.messageId,
          message.sessionId,
          message.messageType,
          message.content,
          message.sql || null,
          message.data ? JSON.stringify(message.data) : null,
          message.columns ? JSON.stringify(message.columns) : null,
          message.rowCount || null,
          message.chartType || null,
        ]
      );
    } finally {
      client.release();
    }
  }

  async updateChatSessionTimestamp(userId: string, sessionId: string): Promise<void> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return;
    }

    const client = await userPoolResult.pool.connect();
    try {
      await client.query(
        `UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = $1`,
        [sessionId]
      );
    } finally {
      client.release();
    }
  }

  async deleteChatSession(userId: string, sessionId: string): Promise<boolean> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return false;
    }

    const client = await userPoolResult.pool.connect();
    try {
      // Delete messages first
      await client.query(`DELETE FROM chat_messages WHERE session_id = $1`, [sessionId]);
      
      // Delete session
      const result = await client.query(
        `DELETE FROM chat_sessions WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId]
      );

      return result.rowCount! > 0;
    } finally {
      client.release();
    }
  }

  async cleanupOldChatMessages(userId: string): Promise<number> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return 0;
    }

    const client = await userPoolResult.pool.connect();
    try {
      // Delete sessions older than 1 month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const sessionsResult = await client.query(
        `SELECT session_id FROM chat_sessions WHERE user_id = $1 AND created_at < $2`,
        [userId, oneMonthAgo]
      );

      const sessionIds = sessionsResult.rows.map((row: any) => row.session_id);

      if (sessionIds.length === 0) {
        return 0;
      }

      // Delete old messages
      await client.query(
        `DELETE FROM chat_messages WHERE session_id = ANY($1)`,
        [sessionIds]
      );

      // Delete old sessions
      const result = await client.query(
        `DELETE FROM chat_sessions WHERE session_id = ANY($1)`,
        [sessionIds]
      );

      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  // Saved Charts methods
  async getSavedCharts(userId: string): Promise<SavedChart[]> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return [];
    }

    const client = await userPoolResult.pool.connect();
    try {
      // Ensure saved_charts table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS saved_charts (
          chart_id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          sql TEXT NOT NULL,
          chart_type VARCHAR(50) NOT NULL,
          chart_data TEXT NOT NULL,
          columns TEXT,
          connection_name VARCHAR(255) NOT NULL,
          layer VARCHAR(50) NOT NULL,
          grid_x INTEGER NOT NULL DEFAULT 0,
          grid_y INTEGER NOT NULL DEFAULT 0,
          grid_w INTEGER NOT NULL DEFAULT 6,
          grid_h INTEGER NOT NULL DEFAULT 4,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await client.query(
        `SELECT * FROM saved_charts WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map((row: any) => ({
        chartId: row.chart_id,
        userId: row.user_id,
        title: row.title,
        sql: row.sql,
        chartType: row.chart_type,
        chartData: row.chart_data,
        columns: row.columns,
        connectionName: row.connection_name,
        layer: row.layer,
        gridX: row.grid_x,
        gridY: row.grid_y,
        gridW: row.grid_w,
        gridH: row.grid_h,
        createdAt: row.created_at,
        lastRefreshedAt: row.last_refreshed_at,
      }));
    } finally {
      client.release();
    }
  }

  async getSavedChart(userId: string, chartId: string): Promise<SavedChart | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return undefined;
    }

    const client = await userPoolResult.pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM saved_charts WHERE chart_id = $1 AND user_id = $2`,
        [chartId, userId]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      return {
        chartId: row.chart_id,
        userId: row.user_id,
        title: row.title,
        sql: row.sql,
        chartType: row.chart_type,
        chartData: row.chart_data,
        columns: row.columns,
        connectionName: row.connection_name,
        layer: row.layer,
        gridX: row.grid_x,
        gridY: row.grid_y,
        gridW: row.grid_w,
        gridH: row.grid_h,
        createdAt: row.created_at,
        lastRefreshedAt: row.last_refreshed_at,
      };
    } finally {
      client.release();
    }
  }

  async createSavedChart(userId: string, chart: InsertSavedChart): Promise<SavedChart> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      throw new Error('User config database not found');
    }

    const client = await userPoolResult.pool.connect();
    try {
      // Ensure table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS saved_charts (
          chart_id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          sql TEXT NOT NULL,
          chart_type VARCHAR(50) NOT NULL,
          chart_data TEXT NOT NULL,
          columns TEXT,
          connection_name VARCHAR(255) NOT NULL,
          layer VARCHAR(50) NOT NULL,
          grid_x INTEGER NOT NULL DEFAULT 0,
          grid_y INTEGER NOT NULL DEFAULT 0,
          grid_w INTEGER NOT NULL DEFAULT 6,
          grid_h INTEGER NOT NULL DEFAULT 4,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await client.query(
        `INSERT INTO saved_charts (chart_id, user_id, title, sql, chart_type, chart_data, columns, connection_name, layer, grid_x, grid_y, grid_w, grid_h)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          chart.chartId,
          chart.userId,
          chart.title,
          chart.sql,
          chart.chartType,
          chart.chartData,
          chart.columns || null,
          chart.connectionName,
          chart.layer,
          chart.gridX,
          chart.gridY,
          chart.gridW,
          chart.gridH,
        ]
      );

      const row = result.rows[0];
      return {
        chartId: row.chart_id,
        userId: row.user_id,
        title: row.title,
        sql: row.sql,
        chartType: row.chart_type,
        chartData: row.chart_data,
        columns: row.columns,
        connectionName: row.connection_name,
        layer: row.layer,
        gridX: row.grid_x,
        gridY: row.grid_y,
        gridW: row.grid_w,
        gridH: row.grid_h,
        createdAt: row.created_at,
        lastRefreshedAt: row.last_refreshed_at,
      };
    } finally {
      client.release();
    }
  }

  async updateSavedChart(userId: string, chartId: string, updates: UpdateSavedChart): Promise<SavedChart | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return undefined;
    }

    const client = await userPoolResult.pool.connect();
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        setClauses.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }
      if (updates.gridX !== undefined) {
        setClauses.push(`grid_x = $${paramIndex++}`);
        values.push(updates.gridX);
      }
      if (updates.gridY !== undefined) {
        setClauses.push(`grid_y = $${paramIndex++}`);
        values.push(updates.gridY);
      }
      if (updates.gridW !== undefined) {
        setClauses.push(`grid_w = $${paramIndex++}`);
        values.push(updates.gridW);
      }
      if (updates.gridH !== undefined) {
        setClauses.push(`grid_h = $${paramIndex++}`);
        values.push(updates.gridH);
      }

      if (setClauses.length === 0) {
        return this.getSavedChart(userId, chartId);
      }

      values.push(chartId, userId);
      
      const result = await client.query(
        `UPDATE saved_charts SET ${setClauses.join(', ')} 
         WHERE chart_id = $${paramIndex} AND user_id = $${paramIndex + 1}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      return {
        chartId: row.chart_id,
        userId: row.user_id,
        title: row.title,
        sql: row.sql,
        chartType: row.chart_type,
        chartData: row.chart_data,
        columns: row.columns,
        connectionName: row.connection_name,
        layer: row.layer,
        gridX: row.grid_x,
        gridY: row.grid_y,
        gridW: row.grid_w,
        gridH: row.grid_h,
        createdAt: row.created_at,
        lastRefreshedAt: row.last_refreshed_at,
      };
    } finally {
      client.release();
    }
  }

  async deleteSavedChart(userId: string, chartId: string): Promise<boolean> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return false;
    }

    const client = await userPoolResult.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM saved_charts WHERE chart_id = $1 AND user_id = $2`,
        [chartId, userId]
      );

      return (result.rowCount || 0) > 0;
    } finally {
      client.release();
    }
  }

  async refreshSavedChart(userId: string, chartId: string): Promise<SavedChart | undefined> {
    const userPoolResult = await getUserSpecificPool(userId);
    if (!userPoolResult) {
      return undefined;
    }

    const client = await userPoolResult.pool.connect();
    try {
      // Get the chart
      const chartResult = await client.query(
        `SELECT * FROM saved_charts WHERE chart_id = $1 AND user_id = $2`,
        [chartId, userId]
      );

      if (chartResult.rows.length === 0) {
        return undefined;
      }

      const chart = chartResult.rows[0];

      // Get connection details from config database
      const configResult = await client.query(
        `SELECT sc.* FROM source_connection_table sc
         JOIN config_table ct ON sc.connection_id = ct.source_connection_id
         WHERE ct.execution_layer = $1
         LIMIT 1`,
        [chart.layer]
      );

      if (configResult.rows.length === 0) {
        throw new Error('Connection not found for chart');
      }

      const connection = configResult.rows[0];

      // Re-execute the SQL query to get fresh data
      let freshData;
      if (connection.connection_type === 'postgresql') {
        const dataClient = new Pool({
          host: connection.host,
          port: connection.port,
          database: connection.database_name,
          user: connection.username,
          password: connection.password,
          ssl: false,
        }).connect();

        const dc = await dataClient;
        try {
          const dataResult = await dc.query(chart.sql);
          freshData = dataResult.rows;
        } finally {
          dc.release();
        }
      } else {
        // For other connection types, return existing data
        freshData = JSON.parse(chart.chart_data);
      }

      // Update chart with fresh data and timestamp
      const updateResult = await client.query(
        `UPDATE saved_charts 
         SET chart_data = $1, last_refreshed_at = CURRENT_TIMESTAMP
         WHERE chart_id = $2 AND user_id = $3
         RETURNING *`,
        [JSON.stringify(freshData), chartId, userId]
      );

      const row = updateResult.rows[0];
      return {
        chartId: row.chart_id,
        userId: row.user_id,
        title: row.title,
        sql: row.sql,
        chartType: row.chart_type,
        chartData: row.chart_data,
        columns: row.columns,
        connectionName: row.connection_name,
        layer: row.layer,
        gridX: row.grid_x,
        gridY: row.grid_y,
        gridW: row.grid_w,
        gridH: row.grid_h,
        createdAt: row.created_at,
        lastRefreshedAt: row.last_refreshed_at,
      };
    } finally {
      client.release();
    }
  }

  async getUserTourStatus(userId: string): Promise<boolean> {
    try {
      const [user] = await db.select({
        tourCompleted: users.tourCompleted
      }).from(users).where(eq(users.id, userId));
      return user?.tourCompleted || false;
    } catch (error) {
      console.error('Error fetching tour status:', error);
      return false;
    }
  }

  async updateUserTourStatus(userId: string, completed: boolean): Promise<void> {
    try {
      await db.update(users)
        .set({ tourCompleted: completed })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error('Error updating tour status:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();