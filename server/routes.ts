import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { users } from "@shared/schema";
import { insertUserSchema, insertDataConnectionSchema, updateDataConnectionSchema, insertConfigSchema, updateConfigSchema, insertDataDictionarySchema, updateDataDictionarySchema, insertReconciliationConfigSchema, updateReconciliationConfigSchema, insertDataQualityConfigSchema, updateDataQualityConfigSchema, insertApplicationConfigSchema, updateApplicationConfigSchema } from "@shared/schema";
import { sql } from "drizzle-orm";
import { generateToken, authMiddleware, type AuthRequest } from "./auth";
import bcrypt from 'bcryptjs';
import { trackActivity, trackFilterActivity, trackResourceActivity, ActivityType, ActivityCategory } from "./activity-tracker";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // User registration endpoint
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check for existing username
      const existingUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(409).json({ 
          error: 'Username already in use',
          field: 'username'
        });
      }
      
      // Check for existing email
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(409).json({ 
          error: 'Email already in use',
          field: 'email'
        });
      }
      
      const user = await storage.createUser(validatedData);
      res.status(201).json({ message: "User created successfully", userId: user.id });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(400).json({ error: 'Failed to create user' });
    }
  });


  // User login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      // Determine if input is email or username
      const isEmail = username.includes('@');
      let user;

      if (isEmail) {
        user = await storage.getUserByEmail(username);
      } else {
        user = await storage.getUserByUsername(username);
      }

      // Verify password using bcrypt
      if (user && user.password && await bcrypt.compare(password, user.password)) {
        // Generate JWT token
        const token = generateToken({
          userId: user.id,
          email: user.email || '',
          username: user.username || '',
        });

        // Log user activity
        await storage.logUserActivity({
          userId: user.id,
          activityType: 'sign_in',
          activityCategory: 'auth',
          pagePath: '/login',
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        });

        const { password: _, ...userWithoutPassword } = user;
        res.json({ 
          user: userWithoutPassword,
          token,
        });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // User logout endpoint
  app.post("/api/auth/logout", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      // Log user activity
      await storage.logUserActivity({
        userId,
        activityType: 'sign_out',
        activityCategory: 'auth',
        pagePath: req.originalUrl,
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Dashboard metrics endpoint
  app.get("/api/dashboard/metrics", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { startDate, endDate, search, system, layer, status, category, targetTable } = req.query;

      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };
      }

      const filters = {
        search: search as string,
        system: system as string,
        layer: layer as string,
        status: status as string,
        category: category as string,
        targetTable: targetTable as string,
      };

      // Track dashboard view with filters if applied
      const hasFilters = search || system || layer || status || category || targetTable;
      if (hasFilters) {
        await trackFilterActivity(req, filters);
      }
      await trackActivity(req, {
        activityType: ActivityType.DASHBOARD_VIEWED,
        activityCategory: ActivityCategory.NAVIGATION,
        resourceType: 'dashboard',
        resourceId: 'metrics',
      });

      const metrics = await storage.getDashboardMetrics(userId, dateRange, filters);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
  });

  // Pipeline summary endpoint
  app.get("/api/dashboard/pipeline-summary", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { startDate, endDate, search, system, layer, status, category, targetTable } = req.query;

      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };
      }

      const filters = {
        search: search as string,
        system: system as string,
        layer: layer as string,
        status: status as string,
        category: category as string,
        targetTable: targetTable as string,
      };

      // Track dashboard pipeline summary view with filters if applied
      try {
        const hasFilters = search || system || layer || status || category || targetTable;
        if (hasFilters) {
          await trackFilterActivity(req, filters);
        }
        await trackActivity(req, {
          activityType: ActivityType.DASHBOARD_VIEWED,
          activityCategory: ActivityCategory.NAVIGATION,
          resourceType: 'dashboard',
          resourceId: 'pipeline-summary',
        });
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      const summary = await storage.getPipelineSummary(userId, dateRange, filters);
      res.json(summary);
    } catch (error) {
      console.error('Error fetching pipeline summary:', error);
      res.status(500).json({ error: 'Failed to fetch pipeline summary' });
    }
  });

  // Pipeline runs endpoint with filtering and pagination
  app.get("/api/dashboard/pipelines", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const {
        page = "1",
        limit = "5",
        search,
        sourceSystem,
        status,
        startDate,
        endDate,
        sortBy = "startTime",
        sortOrder = "desc",
      } = req.query;

      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };
      }

      const options = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        sourceSystem: sourceSystem as string,
        status: status as string,
        dateRange,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      };

      const result = await storage.getPipelineRuns(userId, options);
      res.json(result);
    } catch (error) {
      console.error('Error fetching pipeline runs:', error);
      res.status(500).json({ error: 'Failed to fetch pipeline runs' });
    }
  });

  // All pipelines endpoint with filtering and pagination
  app.get("/api/dashboard/all-pipelines", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const {
        page = "1",
        limit = "20",
        search,
        sourceSystem,
        status,
        startDate,
        endDate,
        sortBy = "startTime",
        sortOrder = "desc",
      } = req.query;

      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };
      }

      const options = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        sourceSystem: sourceSystem as string,
        status: status as string,
        dateRange,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      };

      const result = await storage.getAllPipelines(userId, options);
      res.json(result);
    } catch (error) {
      console.error('Error fetching all pipelines:', error);
      res.status(500).json({ error: 'Failed to fetch all pipelines' });
    }
  });

  // Errors endpoint
  app.get("/api/dashboard/errors", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { startDate, endDate } = req.query;

      let dateRange;
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
        };
      }

      const errors = await storage.getErrors(userId, dateRange);
      res.json(errors);
    } catch (error) {
      console.error('Error fetching errors:', error);
      res.status(500).json({ error: 'Failed to fetch errors' });
    }
  });

  // Data connections endpoints
  // Get all connections with optional filtering
  app.get("/api/connections", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { category, search, status } = req.query;

      const filters = {
        category: category as string,
        search: search as string,
        status: status as string,
      };

      const connections = await storage.getConnections(userId, filters);
      
      // Track view activity with filters if applied
      try {
        const hasFilters = category || search || status;
        if (hasFilters) {
          await trackFilterActivity(req, filters);
        }
        await trackActivity(req, {
          activityType: ActivityType.CONNECTION_VIEWED,
          activityCategory: ActivityCategory.NAVIGATION,
          resourceType: 'connection',
        });
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.json(connections);
    } catch (error) {
      console.error('Error fetching connections:', error);
      res.status(500).json({ error: 'Failed to fetch connections' });
    }
  });

  // Get single connection
  app.get("/api/connections/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const connection = await storage.getConnection(userId, id);

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      res.json(connection);
    } catch (error) {
      console.error('Error fetching connection:', error);
      res.status(500).json({ error: 'Failed to fetch connection' });
    }
  });

  // Create new connection
  app.post("/api/connections", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const validatedData = insertDataConnectionSchema.parse(req.body);
      const connection = await storage.createConnection(userId, validatedData);
      
      // Track connection creation
      try {
        await trackResourceActivity(req, 'created', 'connection', connection.connectionId?.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.status(201).json(connection);
    } catch (error: any) {
      console.error('Error creating connection:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid connection data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create connection' });
    }
  });

  // Update connection
  app.put("/api/connections/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const validatedData = updateDataConnectionSchema.parse(req.body);
      const connection = await storage.updateConnection(userId, id, validatedData);

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // Track connection update
      try {
        await trackResourceActivity(req, 'updated', 'connection', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json(connection);
    } catch (error: any) {
      console.error('Error updating connection:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid connection data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update connection' });
    }
  });

  // Delete connection
  app.delete("/api/connections/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const success = await storage.deleteConnection(userId, id);

      if (!success) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // Track connection deletion
      try {
        await trackResourceActivity(req, 'deleted', 'connection', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json({ success: true, message: 'Connection deleted successfully' });
    } catch (error) {
      console.error('Error deleting connection:', error);
      res.status(500).json({ error: 'Failed to delete connection' });
    }
  });

  // Test connection
  app.post("/api/connections/test", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const result = await storage.testConnection(userId, req.body);

      // If test is successful and connectionId exists, update status to Active
      if (result.success && req.body.connectionId) {
        try {
          await storage.updateConnection(userId, req.body.connectionId, { 
            status: 'Active', 
            lastSync: new Date() 
          });
        } catch (updateError) {
          console.error('Error updating connection status:', updateError);
          // Don't fail the entire request if status update fails
        }
      }

      // Track connection test
      try {
        await trackResourceActivity(req, 'tested', 'connection', req.body.connectionId?.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json(result);
    } catch (error) {
      console.error('Error testing connection:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to test connection',
        details: error 
      });
    }
  });

  // Get database schemas from a connection
  app.get("/api/connections/:id/schemas", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const connectionId = parseInt(req.params.id);
      const schemas = await storage.getDatabaseSchemas(userId, connectionId);
      res.json(schemas);
    } catch (error) {
      console.error('Error fetching database schemas:', error);
      res.status(500).json({ error: 'Failed to fetch database schemas' });
    }
  });

  // Get database tables from a connection and schema
  app.get("/api/connections/:id/schemas/:schema/tables", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const connectionId = parseInt(req.params.id);
      const schemaName = req.params.schema;
      const tables = await storage.getDatabaseTables(userId, connectionId, schemaName);
      res.json(tables);
    } catch (error) {
      console.error('Error fetching database tables:', error);
      res.status(500).json({ error: 'Failed to fetch database tables' });
    }
  });

  // Get database columns from a connection, schema, and table
  app.get("/api/connections/:id/schemas/:schema/tables/:table/columns", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const connectionId = parseInt(req.params.id);
      const schemaName = req.params.schema;
      const tableName = req.params.table;
      const columns = await storage.getDatabaseColumns(userId, connectionId, schemaName, tableName);
      res.json(columns);
    } catch (error) {
      console.error('Error fetching database columns:', error);
      res.status(500).json({ error: 'Failed to fetch database columns' });
    }
  });

  // Get enhanced database column metadata with data types and constraints
  app.get("/api/connections/:id/schemas/:schema/tables/:table/metadata", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const connectionId = parseInt(req.params.id);
      const schemaName = req.params.schema;
      const tableName = req.params.table;
      const metadata = await storage.getDatabaseColumnMetadata(userId, connectionId, schemaName, tableName);
      res.json(metadata);
    } catch (error) {
      console.error('Error fetching column metadata:', error);
      res.status(500).json({ error: 'Failed to fetch column metadata' });
    }
  });

  // Get database columns with data types for filtering
  app.get("/api/connections/:id/schemas/:schema/tables/:table/columns-with-types", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const connectionId = parseInt(req.params.id);
      const schemaName = req.params.schema;
      const tableName = req.params.table;
      const { dataTypes } = req.query;

      const metadata = await storage.getDatabaseColumnMetadata(userId, connectionId, schemaName, tableName);

      // If dataTypes filter is provided, filter columns by data type
      if (dataTypes) {
        const allowedTypes = (dataTypes as string).split(',').map(type => type.toLowerCase());
        const filteredColumns = metadata.filter((col: any) => {
          const colType = col.dataType?.toLowerCase() || '';
          return allowedTypes.some(allowedType => {
            // More comprehensive matching for date/time types
            if (allowedType === 'date') {
              return colType.includes('date') || colType === 'date';
            }
            if (allowedType === 'datetime') {
              return colType.includes('datetime') || colType.includes('timestamp') || 
                     colType === 'datetime' || colType === 'datetime2' || 
                     colType === 'smalldatetime';
            }
            if (allowedType === 'timestamp') {
              return colType.includes('timestamp') || colType.includes('datetime') ||
                     colType === 'timestamp' || colType === 'timestamptz' ||
                     colType.startsWith('timestamp');
            }
            // Fallback to original logic
            return colType.includes(allowedType) || colType.startsWith(allowedType);
          });
        });
        res.json(filteredColumns.map((col: any) => ({ 
          columnName: col.columnName, 
          dataType: col.dataType 
        })));
      } else {
        res.json(metadata.map((col: any) => ({ 
          columnName: col.columnName, 
          dataType: col.dataType 
        })));
      }
    } catch (error) {
      console.error('Error fetching columns with types:', error);
      res.status(500).json({ error: 'Failed to fetch columns with types' });
    }
  });

  // Get configs for chat dropdown (connection_name and layer from config_table joined with data_connection_table)
  app.get("/api/config", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      
      // Get user's target database settings
      const userDbSettings = await storage.getUserConfigDbSettings(userId);
      if (!userDbSettings) {
        return res.status(404).json({ error: 'No database settings configured' });
      }

      // Connect to user's target database and get connections with layers
      const { Client } = await import('pg');
      const client = new Client({
        host: userDbSettings.host,
        port: userDbSettings.port,
        database: userDbSettings.database,
        user: userDbSettings.username,
        password: userDbSettings.password,
        ssl: userDbSettings.sslEnabled ?? undefined,
        connectionTimeoutMillis: userDbSettings.connectionTimeout ?? undefined,
      });

      await client.connect();

      try {
        // Join config_table with data_connection_table to get connection names and layers
        // Capitalize first letter of layer for UI display
        const result = await client.query(`
          SELECT DISTINCT 
            sc.connection_name as "connectionName",
            INITCAP(ct.execution_layer) as "layer"
          FROM config_table ct
          INNER JOIN data_connection_table sc ON ct.target_connection_id = sc.connection_id
          WHERE ct.target_connection_id IS NOT NULL
          ORDER BY "connectionName", "layer"
        `);

        res.json(result.rows);
      } finally {
        await client.end();
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
      res.status(500).json({ error: 'Failed to fetch configs' });
    }
  });

  // Pipeline configuration endpoints
  // Get all pipelines with optional filtering
  app.get("/api/pipelines", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { search, executionLayer, sourceApplicationName, targetApplicationName, status } = req.query;

      const filters = {
        search: search as string,
        executionLayer: executionLayer as string,
        sourceApplicationName: sourceApplicationName as string,
        targetApplicationName: targetApplicationName as string,
        status: status as string,
      };

      const pipelines = await storage.getPipelines(userId, filters);
      
      // Track pipeline view with filters if applied
      try {
        const hasFilters = search || executionLayer || sourceApplicationName || targetApplicationName || status;
        if (hasFilters) {
          await trackFilterActivity(req, filters);
        }
        await trackActivity(req, {
          activityType: ActivityType.PIPELINE_VIEWED,
          activityCategory: ActivityCategory.NAVIGATION,
          resourceType: 'pipeline',
        });
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.json(pipelines);
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      res.status(500).json({ error: 'Failed to fetch pipelines' });
    }
  });

  // Get source applications used in pipelines
  app.get("/api/pipelines/source-applications", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const applications = await storage.getSourceApplications(userId);
      res.json(applications);
    } catch (error) {
      console.error('Error fetching source applications:', error);
      res.status(500).json({ error: 'Failed to fetch source applications' });
    }
  });

  // Get target applications used in pipelines
  app.get("/api/pipelines/target-applications", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const applications = await storage.getTargetApplications(userId);
      res.json(applications);
    } catch (error) {
      console.error('Error fetching target applications:', error);
      res.status(500).json({ error: 'Failed to fetch target applications' });
    }
  });

  // Get single pipeline
  app.get("/api/pipelines/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const pipeline = await storage.getPipeline(userId, id);

      if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      res.json(pipeline);
    } catch (error) {
      console.error('Error fetching pipeline:', error);
      res.status(500).json({ error: 'Failed to fetch pipeline' });
    }
  });

  // Create new pipeline
  app.post("/api/pipelines", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const validatedData = insertConfigSchema.parse(req.body);
      
      // If config_key is not provided, generate it using max(config_key)+1
      if (!validatedData.configKey) {
        const maxConfigKey = await storage.getMaxConfigKey(userId);
        validatedData.configKey = maxConfigKey + 1;
        console.log(`Auto-generated config_key: ${validatedData.configKey} (max was ${maxConfigKey})`);
      }
      
      // Ensure execution layer, source system, target system, source type, and target type are lowercase
      if (validatedData.executionLayer) {
        validatedData.executionLayer = validatedData.executionLayer.toLowerCase();
      }
      if (validatedData.sourceSystem) {
        validatedData.sourceSystem = validatedData.sourceSystem.toLowerCase();
      }
      if (validatedData.targetSystem) {
        validatedData.targetSystem = validatedData.targetSystem.toLowerCase();
      }
      if (validatedData.sourceType) {
        validatedData.sourceType = validatedData.sourceType.toLowerCase();
      }
      if (validatedData.targetType) {
        validatedData.targetType = validatedData.targetType.toLowerCase();
      }
      // Convert load type to _load suffix for truncate and incremental
      if (validatedData.loadType && (validatedData.loadType.toLowerCase() === 'truncate' || validatedData.loadType.toLowerCase() === 'incremental')) {
        validatedData.loadType = `${validatedData.loadType.toLowerCase()}_load`;
      }
      const pipeline = await storage.createPipeline(userId, validatedData);
      
      // Track pipeline creation
      try {
        await trackResourceActivity(req, 'created', 'pipeline', pipeline.configKey?.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.status(201).json(pipeline);
    } catch (error: any) {
      console.error('Error creating pipeline:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid pipeline data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create pipeline' });
    }
  });

  // Update pipeline
  app.put("/api/pipelines/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const validatedData = updateConfigSchema.parse(req.body);
      // Ensure execution layer, source system, target system, source type, and target type are lowercase
      if (validatedData.executionLayer) {
        validatedData.executionLayer = validatedData.executionLayer.toLowerCase();
      }
      if (validatedData.sourceSystem) {
        validatedData.sourceSystem = validatedData.sourceSystem.toLowerCase();
      }
      if (validatedData.targetSystem) {
        validatedData.targetSystem = validatedData.targetSystem.toLowerCase();
      }
      if (validatedData.sourceType) {
        validatedData.sourceType = validatedData.sourceType.toLowerCase();
      }
      if (validatedData.targetType) {
        validatedData.targetType = validatedData.targetType.toLowerCase();
      }
      // Convert load type to _load suffix for truncate and incremental
      if (validatedData.loadType && (validatedData.loadType.toLowerCase() === 'truncate' || validatedData.loadType.toLowerCase() === 'incremental')) {
        validatedData.loadType = `${validatedData.loadType.toLowerCase()}_load`;
      }
      const pipeline = await storage.updatePipeline(userId, id, validatedData);

      if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      // Track pipeline update
      try {
        await trackResourceActivity(req, 'updated', 'pipeline', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json(pipeline);
    } catch (error: any) {
      console.error('Error updating pipeline:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid pipeline data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update pipeline' });
    }
  });

  // Delete pipeline
  app.delete("/api/pipelines/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const success = await storage.deletePipeline(userId, id);

      if (!success) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      // Track pipeline deletion
      try {
        await trackResourceActivity(req, 'deleted', 'pipeline', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json({ success: true, message: 'Pipeline deleted successfully' });
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      res.status(500).json({ error: 'Failed to delete pipeline' });
    }
  });

  // Data Dictionary routes
  app.get("/api/data-dictionary", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { search, executionLayer, schemaName, tableName, sourceSystem, targetApplicationName } = req.query;

      const filters = {
        search: search as string,
        executionLayer: executionLayer as string,
        schemaName: schemaName as string,
        tableName: tableName as string,
        sourceSystem: sourceSystem as string,
        targetApplicationName: targetApplicationName as string
      };

      const entries = await storage.getDataDictionaryEntries(userId, filters);
      
      // Track data dictionary view with filters if applied
      try {
        const hasFilters = search || executionLayer || schemaName || tableName || sourceSystem || targetApplicationName;
        if (hasFilters) {
          await trackFilterActivity(req, filters);
        }
        await trackActivity(req, {
          activityType: ActivityType.DATA_DICTIONARY_VIEWED,
          activityCategory: ActivityCategory.NAVIGATION,
          resourceType: 'data-dictionary',
        });
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.json(entries);
    } catch (error) {
      console.error('Error fetching data dictionary entries:', error);
      res.status(500).json({ error: 'Failed to fetch data dictionary entries' });
    }
  });

  // Get target applications used in data dictionary entries
  app.get("/api/data-dictionary/target-applications", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const applications = await storage.getDataDictionaryTargetApplications(userId);
      res.json(applications);
    } catch (error) {
      console.error('Error fetching data dictionary target applications:', error);
      res.status(500).json({ error: 'Failed to fetch target applications' });
    }
  });

  app.get("/api/data-dictionary/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const entry = await storage.getDataDictionaryEntry(userId, id);

      if (!entry) {
        return res.status(404).json({ error: 'Data dictionary entry not found' });
      }

      res.json(entry);
    } catch (error) {
      console.error('Error fetching data dictionary entry:', error);
      res.status(500).json({ error: 'Failed to fetch data dictionary entry' });
    }
  });

  app.post("/api/data-dictionary", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      console.log('Incoming data dictionary request body:', JSON.stringify(req.body, null, 2));
      
      // Extract source and target fields for config_key matching
      const { 
        sourceSystem, 
        sourceType, 
        sourceSchemaName, 
        sourceTableName,
        targetSystem,
        targetType,
        targetSchemaName,
        targetTableName,
        executionLayer,
        ...rest 
      } = req.body;

      // Find matching config based on source AND target fields
      const matchingConfig = await storage.findMatchingConfig(userId, {
        executionLayer,
        sourceSystem,
        sourceType,
        sourceSchemaName,
        sourceTableName,
        targetSystem,
        targetType,
        targetSchemaName,
        targetTableName
      });

      // Assign config_key if match found
      const configKey = matchingConfig?.configKey || req.body.configKey || 1;
      console.log('Matched config_key:', configKey, 'for source:', {
        executionLayer, sourceSystem, sourceType, sourceSchemaName, sourceTableName
      }, 'and target:', {
        targetSystem, targetType, targetSchemaName, targetTableName
      });

      // Validate and create entry with assigned config_key
      const validatedData = insertDataDictionarySchema.parse({
        ...rest,
        executionLayer,
        configKey
      });
      console.log('Validated data:', JSON.stringify(validatedData, null, 2));

      // Use the main database connection that's forced to external PostgreSQL
      const entry = await storage.createDataDictionaryEntry(userId, validatedData);

      console.log('Successfully saved to external database with ID:', entry.dataDictionaryKey);
      
      // Track data dictionary creation
      try {
        await trackResourceActivity(req, 'created', 'data-dictionary', entry.dataDictionaryKey?.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.status(201).json(entry);
    } catch (error) {
      console.error('Error creating data dictionary entry:', error);

      // Send detailed error message to user interface
      let userErrorMessage = 'Failed to create data dictionary entry';
      if (error instanceof Error) {
        // Extract meaningful error details for the user
        if (error.message.includes('duplicate key')) {
          userErrorMessage = 'This entry already exists. Please check for duplicates.';
        } else if (error.message.includes('not-null constraint')) {
          userErrorMessage = 'Required fields are missing. Please fill in all required information.';
        } else if (error.message.includes('foreign key constraint')) {
          userErrorMessage = 'Invalid reference data. Please check your selections.';
        } else {
          userErrorMessage = `Database error: ${error.message}`;
        }
      }

      res.status(500).json({ 
        error: userErrorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.put("/api/data-dictionary/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      
      // Extract source and target fields for config_key matching
      const { 
        sourceSystem, 
        sourceType, 
        sourceSchemaName, 
        sourceTableName,
        targetSystem,
        targetType,
        targetSchemaName,
        targetTableName,
        executionLayer,
        ...rest 
      } = req.body;

      // Find matching config based on source AND target fields
      const matchingConfig = await storage.findMatchingConfig(userId, {
        executionLayer,
        sourceSystem,
        sourceType,
        sourceSchemaName,
        sourceTableName,
        targetSystem,
        targetType,
        targetSchemaName,
        targetTableName
      });

      // Assign config_key if match found, otherwise keep existing or use provided
      const configKey = matchingConfig?.configKey || req.body.configKey;
      console.log('Matched config_key:', configKey, 'for source:', {
        executionLayer, sourceSystem, sourceType, sourceSchemaName, sourceTableName
      }, 'and target:', {
        targetSystem, targetType, targetSchemaName, targetTableName
      });

      // Validate and update entry with assigned config_key
      const validatedData = updateDataDictionarySchema.parse({
        ...rest,
        executionLayer,
        ...(configKey && { configKey })
      });

      const entry = await storage.updateDataDictionaryEntry(userId, id, validatedData);

      if (!entry) {
        return res.status(404).json({ error: 'Data dictionary entry not found' });
      }

      // Track data dictionary update
      try {
        await trackResourceActivity(req, 'updated', 'data-dictionary', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json(entry);
    } catch (error) {
      console.error('Error updating data dictionary entry:', error);
      res.status(500).json({ error: 'Failed to update data dictionary entry' });
    }
  });

  app.delete("/api/data-dictionary/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const success = await storage.deleteDataDictionaryEntry(userId, id);

      if (!success) {
        return res.status(404).json({ error: 'Data dictionary entry not found' });
      }

      // Track data dictionary deletion
      try {
        await trackResourceActivity(req, 'deleted', 'data-dictionary', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json({ success: true, message: 'Data dictionary entry deleted successfully' });
    } catch (error) {
      console.error('Error deleting data dictionary entry:', error);
      res.status(500).json({ error: 'Failed to delete data dictionary entry' });
    }
  });

  // Reconciliation config routes
  app.get("/api/reconciliation-configs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { search, executionLayer, configKey, reconType, status, targetApplicationId } = req.query;

      const filters = {
        search: search as string,
        executionLayer: executionLayer as string,
        configKey: configKey ? parseInt(configKey as string) : undefined,
        reconType: reconType as string,
        status: status as string,
        targetApplicationId: targetApplicationId ? parseInt(targetApplicationId as string) : undefined,
      };

      const configs = await storage.getReconciliationConfigs(userId, filters);
      
      // Track reconciliation view with filters if applied
      try {
        const hasFilters = search || executionLayer || configKey || reconType || status;
        if (hasFilters) {
          await trackFilterActivity(req, filters);
        }
        await trackActivity(req, {
          activityType: ActivityType.RECONCILIATION_VIEWED,
          activityCategory: ActivityCategory.NAVIGATION,
          resourceType: 'reconciliation',
        });
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.json(configs);
    } catch (error) {
      console.error('Error fetching reconciliation configs:', error);
      res.status(500).json({ error: 'Failed to fetch reconciliation configs' });
    }
  });

  

  app.get("/api/reconciliation-configs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const config = await storage.getReconciliationConfig(userId, id);

      if (!config) {
        return res.status(404).json({ error: 'Reconciliation config not found' });
      }

      res.json(config);
    } catch (error) {
      console.error('Error fetching reconciliation config:', error);
      res.status(500).json({ error: 'Failed to fetch reconciliation config' });
    }
  });

  // Database fix endpoint - cleans up invalid recon_key = 0 records and resets sequence
  app.post("/api/reconciliation-configs/fix-database", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      console.log('Starting database fix for reconciliation_config table...');
      
      // Step 1: Delete all records with recon_key = 0 (invalid records)
      const deleteResult = await pool.query(
        'DELETE FROM reconciliation_config WHERE recon_key = 0 OR recon_key IS NULL RETURNING *'
      );
      console.log(`Deleted ${deleteResult.rowCount} invalid records with recon_key = 0`);
      
      // Step 2: Get the current max recon_key
      const maxResult = await pool.query(
        'SELECT COALESCE(MAX(recon_key), 0) as max_key FROM reconciliation_config'
      );
      const maxKey = maxResult.rows[0]?.max_key || 0;
      console.log(`Current max recon_key: ${maxKey}`);
      
      // Step 3: Reset the sequence to start from max + 1
      const nextValue = maxKey + 1;
      await pool.query(
        `SELECT setval('reconciliation_config_recon_key_seq', $1, false)`,
        [nextValue]
      );
      console.log(`Reset sequence to start from: ${nextValue}`);
      
      res.json({
        success: true,
        message: 'Database fixed successfully',
        deletedRecords: deleteResult.rowCount,
        currentMaxKey: maxKey,
        nextKey: nextValue
      });
    } catch (error) {
      console.error('Error fixing database:', error);
      res.status(500).json({ error: 'Failed to fix database', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/reconciliation-configs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const validatedData = insertReconciliationConfigSchema.parse(req.body);
      
      // Search for matching config_key from config table
      const matchingConfig = await storage.findMatchingConfig(userId, {
        executionLayer: validatedData.executionLayer || undefined,
        sourceSystem: req.body.sourceSystem || undefined,
        sourceType: req.body.sourceType || undefined,
        sourceSchemaName: validatedData.sourceSchema || undefined,
        sourceTableName: validatedData.sourceTable || undefined,
        targetSystem: req.body.targetSystem || undefined,
        targetType: req.body.targetType || undefined,
        targetSchemaName: validatedData.targetSchema || undefined,
        targetTableName: validatedData.targetTable || undefined,
      });
      
      // Assign config_key if match found
      const configData = {
        ...validatedData,
        configKey: matchingConfig?.configKey || validatedData.configKey,
      };
      
      const config = await storage.createReconciliationConfig(userId, configData);
      
      // Track reconciliation creation
      try {
        await trackResourceActivity(req, 'created', 'reconciliation', config.reconKey?.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.status(201).json(config);
    } catch (error: any) {
      console.error('Error creating reconciliation config:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid reconciliation config data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create reconciliation config' });
    }
  });

  app.put("/api/reconciliation-configs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const validatedData = updateReconciliationConfigSchema.parse(req.body);
      
      // Search for matching config_key from config table
      const matchingConfig = await storage.findMatchingConfig(userId, {
        executionLayer: validatedData.executionLayer || undefined,
        sourceSystem: req.body.sourceSystem || undefined,
        sourceType: req.body.sourceType || undefined,
        sourceSchemaName: validatedData.sourceSchema || undefined,
        sourceTableName: validatedData.sourceTable || undefined,
        targetSystem: req.body.targetSystem || undefined,
        targetType: req.body.targetType || undefined,
        targetSchemaName: validatedData.targetSchema || undefined,
        targetTableName: validatedData.targetTable || undefined,
      });
      
      // Assign config_key if match found
      const configData = {
        ...validatedData,
        configKey: matchingConfig?.configKey || validatedData.configKey,
      };
      
      const config = await storage.updateReconciliationConfig(userId, id, configData);

      if (!config) {
        return res.status(404).json({ error: 'Reconciliation config not found' });
      }

      // Track reconciliation update
      try {
        await trackResourceActivity(req, 'updated', 'reconciliation', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json(config);
    } catch (error: any) {
      console.error('Error updating reconciliation config:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid reconciliation config data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update reconciliation config' });
    }
  });

  app.delete("/api/reconciliation-configs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const success = await storage.deleteReconciliationConfig(userId, id);

      if (!success) {
        return res.status(404).json({ error: 'Reconciliation config not found' });
      }

      // Track reconciliation deletion
      try {
        await trackResourceActivity(req, 'deleted', 'reconciliation', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json({ success: true, message: 'Reconciliation config deleted successfully' });
    } catch (error) {
      console.error('Error deleting reconciliation config:', error);
      res.status(500).json({ error: 'Failed to delete reconciliation config' });
    }
  });

  // Application Config routes
  app.get("/api/application-configs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { search, status, applicationType } = req.query;

      const filters = {
        search: search as string,
        status: status as string,
        applicationType: applicationType as string,
      };

      const configs = await storage.getApplicationConfigs(userId, filters);
      res.json(configs);
    } catch (error) {
      console.error('Error fetching application configs:', error);
      res.status(500).json({ error: 'Failed to fetch application configs' });
    }
  });

  app.get("/api/application-configs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const config = await storage.getApplicationConfig(userId, id);

      if (!config) {
        return res.status(404).json({ error: 'Application config not found' });
      }

      res.json(config);
    } catch (error) {
      console.error('Error fetching application config:', error);
      res.status(500).json({ error: 'Failed to fetch application config' });
    }
  });

  app.post("/api/application-configs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const validatedData = insertApplicationConfigSchema.parse(req.body);
      const config = await storage.createApplicationConfig(userId, validatedData);

      try {
        await trackResourceActivity(req, 'created', 'application_config', config.applicationId.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.status(201).json(config);
    } catch (error) {
      console.error('Error creating application config:', error);
      res.status(500).json({ error: 'Failed to create application config' });
    }
  });

  app.put("/api/application-configs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const validatedData = updateApplicationConfigSchema.parse(req.body);
      const config = await storage.updateApplicationConfig(userId, id, validatedData);

      if (!config) {
        return res.status(404).json({ error: 'Application config not found' });
      }

      try {
        await trackResourceActivity(req, 'updated', 'application_config', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json(config);
    } catch (error) {
      console.error('Error updating application config:', error);
      res.status(500).json({ error: 'Failed to update application config' });
    }
  });

  app.delete("/api/application-configs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const success = await storage.deleteApplicationConfig(userId, id);

      if (!success) {
        return res.status(404).json({ error: 'Application config not found' });
      }

      try {
        await trackResourceActivity(req, 'deleted', 'application_config', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json({ success: true, message: 'Application config deleted successfully' });
    } catch (error) {
      console.error('Error deleting application config:', error);
      res.status(500).json({ error: 'Failed to delete application config' });
    }
  });

  // Data Quality Config routes
  app.get("/api/data-quality-configs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { search, executionLayer, configKey, validationType, status, targetApplicationId } = req.query;

      const filters = {
        search: search as string,
        executionLayer: executionLayer as string,
        configKey: configKey ? parseInt(configKey as string) : undefined,
        validationType: validationType as string,
        status: status as string,
        targetApplicationId: targetApplicationId ? parseInt(targetApplicationId as string) : undefined,
      };

      const configs = await storage.getDataQualityConfigs(userId, filters);
      
      // Track data quality view with filters if applied
      try {
        const hasFilters = search || executionLayer || configKey || validationType || status;
        if (hasFilters) {
          await trackFilterActivity(req, filters);
        }
        await trackActivity(req, {
          activityType: ActivityType.DATA_QUALITY_VIEWED,
          activityCategory: ActivityCategory.NAVIGATION,
          resourceType: 'data-quality',
        });
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.json(configs);
    } catch (error) {
      console.error('Error fetching data quality configs:', error);
      res.status(500).json({ error: 'Failed to fetch data quality configs' });
    }
  });

  app.get("/api/data-quality-configs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const config = await storage.getDataQualityConfig(userId, id);

      if (!config) {
        return res.status(404).json({ error: 'Data quality config not found' });
      }

      res.json(config);
    } catch (error) {
      console.error('Error fetching data quality config:', error);
      res.status(500).json({ error: 'Failed to fetch data quality config' });
    }
  });

  app.post("/api/data-quality-configs", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      console.log('Received data quality config data:', JSON.stringify(req.body, null, 2));
      
      // Search for matching config_key from config table BEFORE validation
      const matchingConfig = await storage.findMatchingConfig(userId, {
        executionLayer: req.body.executionLayer || undefined,
        targetSystem: req.body.targetSystem || undefined,
        targetType: req.body.targetType || undefined,
        targetSchemaName: req.body.targetSchema || undefined,
        targetTableName: req.body.targetTableName || undefined,
      });
      
      console.log('Matched config_key:', matchingConfig?.configKey, 'for target:', {
        executionLayer: req.body.executionLayer,
        targetSystem: req.body.targetSystem,
        targetType: req.body.targetType,
        targetSchema: req.body.targetSchema,
        targetTableName: req.body.targetTableName
      });
      
      // Remove target fields that don't exist in database schema
      const { targetSystem, targetConnectionId, targetType, targetSchema, targetTableName, ...dataForDb } = req.body;
      
      // Add matched config_key
      const dataWithConfigKey = {
        ...dataForDb,
        configKey: matchingConfig?.configKey || req.body.configKey || undefined,
      };
      
      const validatedData = insertDataQualityConfigSchema.parse(dataWithConfigKey);
      console.log('Validated data:', JSON.stringify(validatedData, null, 2));
      
      const config = await storage.createDataQualityConfig(userId, validatedData);
      
      // Track data quality creation
      try {
        await trackResourceActivity(req, 'created', 'data-quality', config.dataQualityKey?.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.status(201).json(config);
    } catch (error: any) {
      console.error('Error creating data quality config:', error);
      if (error.name === 'ZodError') {
        console.error('Validation errors:', error.errors);
        return res.status(400).json({ error: 'Invalid data quality config data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create data quality config', details: error.message });
    }
  });

  app.put("/api/data-quality-configs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      
      // Search for matching config_key from config table BEFORE validation
      const matchingConfig = await storage.findMatchingConfig(userId, {
        executionLayer: req.body.executionLayer || undefined,
        targetSystem: req.body.targetSystem || undefined,
        targetType: req.body.targetType || undefined,
        targetSchemaName: req.body.targetSchema || undefined,
        targetTableName: req.body.targetTableName || undefined,
      });
      
      console.log('Matched config_key:', matchingConfig?.configKey, 'for target:', {
        executionLayer: req.body.executionLayer,
        targetSystem: req.body.targetSystem,
        targetType: req.body.targetType,
        targetSchema: req.body.targetSchema,
        targetTableName: req.body.targetTableName
      });
      
      // Remove target fields that don't exist in database schema
      const { targetSystem, targetConnectionId, targetType, targetSchema, targetTableName, ...dataForDb } = req.body;
      
      // Add matched config_key
      const dataWithConfigKey = {
        ...dataForDb,
        ...(matchingConfig?.configKey && { configKey: matchingConfig.configKey }),
      };
      
      const validatedData = updateDataQualityConfigSchema.parse(dataWithConfigKey);
      
      const config = await storage.updateDataQualityConfig(userId, id, validatedData);

      if (!config) {
        return res.status(404).json({ error: 'Data quality config not found' });
      }

      // Track data quality update
      try {
        await trackResourceActivity(req, 'updated', 'data-quality', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json(config);
    } catch (error: any) {
      console.error('Error updating data quality config:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid data quality config data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update data quality config' });
    }
  });

  app.delete("/api/data-quality-configs/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const success = await storage.deleteDataQualityConfig(userId, id);

      if (!success) {
        return res.status(404).json({ error: 'Data quality config not found' });
      }

      // Track data quality deletion
      try {
        await trackResourceActivity(req, 'deleted', 'data-quality', id.toString());
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json({ success: true, message: 'Data quality config deleted successfully' });
    } catch (error) {
      console.error('Error deleting data quality config:', error);
      res.status(500).json({ error: 'Failed to delete data quality config' });
    }
  });

  // Get metadata for dropdowns
  app.get("/api/metadata/:type", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { type } = req.params;
      const metadata = await storage.getMetadata(userId, type);
      res.json(metadata);
    } catch (error) {
      console.error('Error fetching metadata:', error);
      res.status(500).json({ error: 'Failed to fetch metadata' });
    }
  });

  // Get existing temporary tables
  app.get("/api/temporary-tables", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      // Get distinct temporary target table names from config_table where they are not null/empty
      const tempTables = await db.execute(sql`
        SELECT DISTINCT temporary_target_table 
        FROM config_table 
        WHERE temporary_target_table IS NOT NULL 
        AND temporary_target_table != ''
        ORDER BY temporary_target_table
      `);

      const tableNames = tempTables.rows.map((row: any) => row.temporary_target_table);
      res.json(tableNames);
    } catch (error) {
      console.error('Error fetching temporary tables:', error);
      res.status(500).json({ error: 'Failed to fetch temporary tables' });
    }
  });

  // User Config DB Settings routes
  app.get("/api/user-config-db-settings", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const settings = await storage.getUserConfigDbSettings(userId);
      if (!settings) {
        return res.status(404).json({ error: 'No config database settings found' });
      }

      res.json(settings);
    } catch (error) {
      console.error('Error fetching user config DB settings:', error);
      res.status(500).json({ error: 'Failed to fetch config database settings' });
    }
  });

  app.post("/api/user-config-db-settings", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const settings = await storage.createUserConfigDbSettings({
        ...req.body,
        userId,
      });
      res.status(201).json(settings);
    } catch (error) {
      console.error('Error creating user config DB settings:', error);
      res.status(500).json({ error: 'Failed to create config database settings' });
    }
  });

  app.put("/api/user-config-db-settings", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      // Clear cached connection pool before updating settings
      const { closeUserPool } = await import('./db');
      closeUserPool(userId);
      console.log(`Cleared cached connection pool for user: ${userId}`);

      const updated = await storage.updateUserConfigDbSettings(userId, req.body);
      
      if (!updated) {
        return res.status(404).json({ error: 'Config database settings not found' });
      }

      // Track settings update
      try {
        await trackResourceActivity(req, 'updated', 'settings');
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating user config DB settings:', error);
      res.status(500).json({ error: 'Failed to update config database settings' });
    }
  });

  app.post("/api/user-config-db-settings/test", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const result = await storage.testUserConfigDbConnection(req.body);
      
      // Track settings test
      try {
        await trackResourceActivity(req, 'tested', 'settings');
      } catch (trackError) {
        console.error('Failed to track activity:', trackError);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error testing connection:', error);
      res.status(500).json({ success: false, message: 'Connection test failed', details: error });
    }
  });

  // User Activity routes
  app.post("/api/user-activity", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const activity = await storage.logUserActivity({
        ...req.body,
        userId,
      });
      res.status(201).json(activity);
    } catch (error) {
      console.error('Error logging user activity:', error);
      res.status(500).json({ error: 'Failed to log user activity' });
    }
  });

  app.get("/api/user-activity", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activities = await storage.getUserActivity(userId, limit);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ error: 'Failed to fetch user activity' });
    }
  });

  // Chat with Data routes
  app.get("/api/chat/data-dictionary", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { configKey, layer } = req.query;

      const dataDictionary = await storage.getDataDictionaryEntriesByConfig(
        userId,
        configKey as string,
        layer as string
      );
      
      res.json(dataDictionary);
    } catch (error) {
      console.error('Error fetching data dictionary for chat:', error);
      res.status(500).json({ error: 'Failed to fetch data dictionary' });
    }
  });

  app.post("/api/chat/query", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { 
        userQuery, 
        connectionName, 
        layer, 
        conversationHistory, 
        previousError,
        attempt = 1,
        tableOverride,
        chartContext
      } = req.body;

      // Get user's CONFIG database settings (where data_dictionary and config_table are stored)
      const configDbSettings = await storage.getUserConfigDbSettings(userId);
      if (!configDbSettings) {
        return res.status(404).json({ error: 'No database settings configured' });
      }

      // Connect to CONFIG database to get data_dictionary and target connection details
      const { Client } = await import('pg');
      const configClient = new Client({
        host: configDbSettings.host,
        port: configDbSettings.port,
        database: configDbSettings.database,
        user: configDbSettings.username,
        password: configDbSettings.password,
        ssl: configDbSettings.sslEnabled ?? undefined,
        connectionTimeoutMillis: configDbSettings.connectionTimeout ?? undefined,
      });

      await configClient.connect();
      
      let dataDictionary;
      let targetDbConfig;
      
      try {
        // Get data_dictionary from CONFIG database with ALL necessary columns for Gemini
        console.log(`[DEBUG] Querying data_dictionary for connection: ${connectionName}, layer: ${layer}`);
        const ddResult = await configClient.query(`
          SELECT DISTINCT
            dd.schema_name as "schemaName",
            dd.table_name as "tableName",
            dd.attribute_name as "attributeName",
            dd.data_type as "dataType",
            dd.length as "length",
            dd.precision_value as "precisionValue",
            dd.scale as "scale",
            dd.is_primary_key as "isPrimaryKey",
            dd.is_foreign_key as "isForeignKey",
            dd.is_not_null as "isNotNull",
            dd.column_description as "columnDescription"
          FROM data_dictionary_table dd
          INNER JOIN config_table ct ON dd.config_key = ct.config_key
          INNER JOIN data_connection_table sc ON ct.target_connection_id = sc.connection_id
          WHERE sc.connection_name = $1 
            AND LOWER(ct.execution_layer) = LOWER($2)
            AND dd.active_flag = 'Y'
          ORDER BY dd.schema_name, dd.table_name, dd.attribute_name
        `, [connectionName, layer]);
        
        dataDictionary = ddResult.rows;
        
        // Get unique tables for debugging
        const uniqueTables = Array.from(new Set(dataDictionary.map((d: any) => `${d.schemaName}.${d.tableName}`)));
        console.log(`[DEBUG] Found ${uniqueTables.length} unique tables:`, uniqueTables);

        // Get TARGET database connection details from data_connection_table
        const connResult = await configClient.query(`
          SELECT 
            host,
            port,
            database_name as database,
            username,
            password,
            connection_type as "dbType"
          FROM data_connection_table
          WHERE connection_name = $1
          LIMIT 1
        `, [connectionName]);
        
        if (connResult.rows.length === 0) {
          throw new Error(`Connection "${connectionName}" not found`);
        }
        
        targetDbConfig = connResult.rows[0];
      } finally {
        await configClient.end();
      }

      // Call Python service to generate and execute SQL on TARGET database
      const { spawn } = await import('child_process');
      const pythonProcess = spawn('python3', ['-u', 'python_services/chat_handler.py']);

      const inputData = JSON.stringify({
        user_query: userQuery,
        data_dictionary: dataDictionary,
        db_config: {
          host: targetDbConfig.host,
          port: targetDbConfig.port,
          database: targetDbConfig.database,
          username: targetDbConfig.username,
          password: targetDbConfig.password,
          dbType: targetDbConfig.dbType
        },
        conversation_history: conversationHistory || [],
        previous_error: previousError,
        attempt: attempt,
        table_override: tableOverride,
        layer: layer,  // Pass the selected layer for smart table disambiguation
        connection_name: connectionName,
        chart_context: chartContext // Pass chart editing context to AI
      });

      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();

      let outputData = '';
      let errorData = '';

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python process error:', errorData);
          return res.status(500).json({ 
            error: 'Failed to process query',
            details: errorData
          });
        }

        try {
          const result = JSON.parse(outputData);
          res.json(result);
        } catch (parseError) {
          console.error('Failed to parse Python output:', outputData);
          res.status(500).json({ error: 'Failed to parse query results' });
        }
      });

    } catch (error) {
      console.error('Error processing chat query:', error);
      res.status(500).json({ error: 'Failed to process query' });
    }
  });

  // Chat History routes
  // Get applications for chat selection
  app.get("/api/chat/applications", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const applications = await storage.getTargetApplications(userId);
      res.json(applications);
    } catch (error) {
      console.error('Error fetching applications for chat:', error);
      res.status(500).json({ error: 'Failed to fetch applications' });
    }
  });

  app.post("/api/chat/sessions", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { connectionName, layer, applicationName } = req.body;

      const session = await storage.createChatSession(userId, connectionName, layer, applicationName);
      res.status(201).json(session);
    } catch (error) {
      console.error('Error creating chat session:', error);
      res.status(500).json({ error: 'Failed to create chat session' });
    }
  });

  app.get("/api/chat/sessions", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { connectionName, layer, limit } = req.query;

      // Support both filtered (connection/layer) and unfiltered (all sessions) queries
      const sessions = await storage.getChatSessions(
        userId, 
        connectionName as string | undefined, 
        layer as string | undefined,
        limit ? parseInt(limit as string) : 20
      );
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      res.status(500).json({ error: 'Failed to fetch chat sessions' });
    }
  });

  app.get("/api/chat/sessions/:sessionId/messages", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { sessionId } = req.params;

      const messages = await storage.getChatMessages(userId, sessionId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  });

  app.post("/api/chat/messages", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { sessionId, messageType, content, sql, data, columns, rowCount, chartType } = req.body;

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await storage.saveChatMessage(userId, {
        messageId,
        sessionId,
        messageType,
        content,
        sql,
        data,
        columns,
        rowCount,
        chartType,
      });

      await storage.updateChatSessionTimestamp(userId, sessionId);

      res.status(201).json({ messageId });
    } catch (error) {
      console.error('Error saving chat message:', error);
      res.status(500).json({ error: 'Failed to save chat message' });
    }
  });

  app.delete("/api/chat/sessions/:sessionId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { sessionId } = req.params;

      const deleted = await storage.deleteChatSession(userId, sessionId);
      
      if (deleted) {
        res.json({ message: 'Session deleted successfully' });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    } catch (error) {
      console.error('Error deleting chat session:', error);
      res.status(500).json({ error: 'Failed to delete chat session' });
    }
  });

  app.post("/api/chat/cleanup", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      
      const deletedCount = await storage.cleanupOldChatMessages(userId);
      res.json({ deletedCount, message: `Cleaned up ${deletedCount} old sessions` });
    } catch (error) {
      console.error('Error cleaning up old chat messages:', error);
      res.status(500).json({ error: 'Failed to cleanup old messages' });
    }
  });

  // Saved Charts routes
  app.get("/api/saved-charts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const charts = await storage.getSavedCharts(userId);
      res.json(charts);
    } catch (error) {
      console.error('Error fetching saved charts:', error);
      res.status(500).json({ error: 'Failed to fetch saved charts' });
    }
  });

  app.post("/api/saved-charts", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { title, sql, chartType, chartData, columns, connectionName, layer, gridX, gridY, gridW, gridH } = req.body;

      // Check for duplicate chart (same SQL)
      const existingCharts = await storage.getSavedCharts(userId);
      const isDuplicate = existingCharts.some(chart => 
        chart.sql.trim().toLowerCase() === (sql || '').trim().toLowerCase()
      );
      
      if (isDuplicate) {
        return res.status(400).json({ error: 'This chart is already pinned to your dashboard' });
      }

      const chartId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const chart = await storage.createSavedChart(userId, {
        chartId,
        userId,
        title,
        sql,
        chartType,
        chartData,
        columns,
        connectionName,
        layer,
        gridX: gridX || 0,
        gridY: gridY || 0,
        gridW: gridW || 4,
        gridH: gridH || 4,
      });

      res.status(201).json(chart);
    } catch (error) {
      console.error('Error creating saved chart:', error);
      res.status(500).json({ error: 'Failed to create saved chart' });
    }
  });

  app.patch("/api/saved-charts/:chartId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { chartId } = req.params;
      const updates = req.body;

      const chart = await storage.updateSavedChart(userId, chartId, updates);
      
      if (chart) {
        res.json(chart);
      } else {
        res.status(404).json({ error: 'Chart not found' });
      }
    } catch (error) {
      console.error('Error updating saved chart:', error);
      res.status(500).json({ error: 'Failed to update saved chart' });
    }
  });

  app.delete("/api/saved-charts/:chartId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { chartId } = req.params;

      const deleted = await storage.deleteSavedChart(userId, chartId);
      
      if (deleted) {
        res.json({ message: 'Chart deleted successfully' });
      } else {
        res.status(404).json({ error: 'Chart not found' });
      }
    } catch (error) {
      console.error('Error deleting saved chart:', error);
      res.status(500).json({ error: 'Failed to delete saved chart' });
    }
  });

  app.post("/api/saved-charts/:chartId/refresh", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { chartId } = req.params;

      const chart = await storage.refreshSavedChart(userId, chartId);
      
      if (chart) {
        res.json(chart);
      } else {
        res.status(404).json({ error: 'Chart not found' });
      }
    } catch (error) {
      console.error('Error refreshing saved chart:', error);
      res.status(500).json({ error: 'Failed to refresh saved chart' });
    }
  });

  // Data Lineage routes
  app.get("/api/lineage/filters", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const filters = await storage.getLineageFilters(userId);
      
      await trackActivity(req, {
        activityType: 'lineage_filters_viewed' as any,
        activityCategory: 'navigation' as any,
        resourceType: 'lineage',
        pagePath: '/api/lineage/filters',
      });
      
      res.json(filters);
    } catch (error) {
      console.error('Error fetching lineage filters:', error);
      res.status(500).json({ error: 'Failed to fetch lineage filters' });
    }
  });

  app.get("/api/lineage/records", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      
      const filters: any = {};
      
      if (req.query.sourceApplicationId) {
        filters.sourceApplicationId = parseInt(req.query.sourceApplicationId as string);
      }
      if (req.query.targetApplicationId) {
        filters.targetApplicationId = parseInt(req.query.targetApplicationId as string);
      }
      if (req.query.sourceSchema) {
        filters.sourceSchema = req.query.sourceSchema as string;
      }
      if (req.query.targetSchema) {
        filters.targetSchema = req.query.targetSchema as string;
      }
      if (req.query.sourceLayer) {
        filters.sourceLayer = req.query.sourceLayer as string;
      }
      if (req.query.targetLayer) {
        filters.targetLayer = req.query.targetLayer as string;
      }
      if (req.query.sourceTable) {
        filters.sourceTable = req.query.sourceTable as string;
      }
      if (req.query.targetTable) {
        filters.targetTable = req.query.targetTable as string;
      }
      if (req.query.globalSearch) {
        filters.globalSearch = req.query.globalSearch as string;
      }
      
      const records = await storage.getLineageRecords(userId, filters);
      
      await trackActivity(req, {
        activityType: 'lineage_data_viewed' as any,
        activityCategory: 'data' as any,
        resourceType: 'lineage',
        pagePath: '/api/lineage/records',
        actionDetails: filters,
      });
      
      res.json(records);
    } catch (error) {
      console.error('Error fetching lineage records:', error);
      res.status(500).json({ error: 'Failed to fetch lineage records' });
    }
  });

  app.post("/api/lineage/traverse", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { nodeId, direction, filters } = req.body;
      
      if (!nodeId) {
        return res.status(400).json({ error: 'nodeId is required' });
      }
      
      if (!['upstream', 'downstream', 'both'].includes(direction)) {
        return res.status(400).json({ error: 'direction must be upstream, downstream, or both' });
      }
      
      // Import lineage graph utility
      const { LineageGraphBuilder } = await import('./lineage-graph');
      
      // Fetch all lineage records with optional filters
      const records = await storage.getLineageRecords(userId, filters || {});
      
      // Build in-memory graph
      const graph = LineageGraphBuilder.buildGraph(records);
      
      // Perform traversal based on direction
      let result;
      if (direction === 'upstream') {
        result = LineageGraphBuilder.traceUpstream(graph, nodeId);
      } else if (direction === 'downstream') {
        result = LineageGraphBuilder.traceDownstream(graph, nodeId);
      } else {
        result = LineageGraphBuilder.traceFullLineage(graph, nodeId);
      }
      
      // Convert nodes Map to array for JSON response
      const responseNodes = Array.from(result.nodes);
      
      await trackActivity(req, {
        activityType: 'lineage_traversal' as any,
        activityCategory: 'data' as any,
        resourceType: 'lineage',
        resourceId: nodeId,
        pagePath: '/api/lineage/traverse',
        actionDetails: { direction, filters },
      });
      
      res.json({
        nodes: responseNodes,
        edges: result.edges,
        paths: direction === 'both' 
          ? { upstream: (result as any).upstreamPaths, downstream: (result as any).downstreamPaths }
          : (result as any).paths,
      });
    } catch (error) {
      console.error('Error traversing lineage:', error);
      res.status(500).json({ error: 'Failed to traverse lineage' });
    }
  });

  // Tour completion routes
  app.get("/api/user/tour-status", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const tourStatus = await storage.getUserTourStatus(userId);
      res.json({ tourCompleted: tourStatus });
    } catch (error) {
      console.error('Error fetching tour status:', error);
      res.status(500).json({ error: 'Failed to fetch tour status' });
    }
  });

  app.post("/api/user/complete-tour", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      await storage.updateUserTourStatus(userId, true);
      res.json({ success: true, message: 'Tour marked as completed' });
    } catch (error) {
      console.error('Error updating tour status:', error);
      res.status(500).json({ error: 'Failed to update tour status' });
    }
  });

  // Update user profile endpoint
  const updateProfileSchema = z.object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    photoUrl: z.string().refine(
      (url) => {
        if (!url) return true;
        const lowerUrl = url.toLowerCase();
        
        // Allow HTTPS URLs or base64 data URLs for images, but reject javascript: schemes
        if (lowerUrl.startsWith('javascript:')) return false;
        
        if (lowerUrl.startsWith('data:image/')) {
          // Validate base64 size (max ~7MB base64 = ~5MB actual image)
          if (url.length > 7 * 1024 * 1024) return false;
          
          // Validate it's a valid image mime type
          const validMimeTypes = ['data:image/jpeg', 'data:image/jpg', 'data:image/png', 'data:image/gif', 'data:image/webp'];
          return validMimeTypes.some(mime => lowerUrl.startsWith(mime));
        }
        
        return lowerUrl.startsWith('https://');
      },
      { message: 'Photo must be either an HTTPS URL or a valid image (JPEG, PNG, GIF, WebP) under 5MB' }
    ).optional().or(z.literal('')),
  });

  app.put("/api/user/profile", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const validatedData = updateProfileSchema.parse(req.body);
      
      // Remove photoUrl if it's an empty string
      const updates = {
        ...validatedData,
        photoUrl: validatedData.photoUrl === '' ? null : validatedData.photoUrl,
      };
      
      const updatedUser = await storage.updateUserProfile(userId, updates as any);
      
      if (updatedUser) {
        // Remove password from response
        const { password, ...userWithoutPassword } = updatedUser;
        res.json({ success: true, user: userWithoutPassword });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid profile data', details: error.errors });
      } else {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}