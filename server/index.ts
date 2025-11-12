/*import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const serverInstance = app.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  serverInstance.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use, trying a new port.`);
      let newPort = port + 1;
      const retryListen = () => {
        app.listen({
          port: newPort,
          host: "0.0.0.0",
          reusePort: true,
        }, () => {
          log(`serving on port ${newPort}`);
        }).on('error', (nextErr: any) => {
          if (nextErr.code === 'EADDRINUSE') {
            log(`Port ${newPort} is also in use, trying port ${newPort + 1}.`);
            newPort++;
            retryListen();
          } else {
            log(`Server error: ${nextErr.message}`);
          }
        });
      };
      retryListen();
    } else {
      log(`Server error: ${err.message}`);
    }
  });
})();*/
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ---------------------- Request Logging Middleware ----------------------
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      log(logLine);
    }
  });

  next();
});

// ---------------------- Main Async Bootstrap ----------------------
(async () => {
  try {
    // 1️⃣ Register routes
    const server = await registerRoutes(app);

    // 2️⃣ Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      log(`❌ Error: ${message} (${status})`);
    });

    // 3️⃣ Serve frontend
    if (app.get("env") === "development") {
      await setupVite(app, server); // Vite Dev Middleware
    } else {
      serveStatic(app); // Serve /dist/public (built React)
    }

    // ---------------------- Server Listener ----------------------
    const port = parseInt(process.env.PORT || "8080", 10);
    const host = "0.0.0.0";

    // Only enable reusePort on Linux (macOS throws ENOTSUP)
    const listenOptions: any =
      process.platform === "linux"
        ? { port, host, reusePort: true }
        : { port, host };

    const serverInstance = app.listen(listenOptions, () => {
      log(
        `✅ Server running at http://${host}:${port} (env: ${app.get("env")})`,
      );
    });

    // ---------------------- Error Handling ----------------------
    serverInstance.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        log(`⚠️  Port ${port} is already in use. Trying next port...`);
        let newPort = port + 1;
        const retryListen = () => {
          app
            .listen({ port: newPort, host }, () => {
              log(`✅ Server now listening on http://${host}:${newPort}`);
            })
            .on("error", (nextErr: any) => {
              if (nextErr.code === "EADDRINUSE") {
                newPort++;
                retryListen();
              } else {
                log(`❌ Server error: ${nextErr.message}`);
              }
            });
        };
        retryListen();
      } else {
        log(`❌ Server error: ${err.message}`);
      }
    });

    // ---------------------- Graceful Shutdown ----------------------
    const shutdown = () => {
      log("🛑 Shutting down server...");
      serverInstance.close(() => {
        log("✅ Server closed gracefully.");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err: any) {
    log(`❌ Fatal startup error: ${err.message}`);
    process.exit(1);
  }
})();
