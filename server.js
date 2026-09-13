import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

try {
  process.loadEnvFile();
} catch (e) {
  // .env may not exist
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = "0.0.0.0";

const WEB_DIR = join(__dirname, "web");
const FUNCTIONS_DIR = join(__dirname, "functions", "api");

// Raw body parser for API requests to preserve all payloads
app.use("/api", express.raw({ type: "*/*", limit: "15mb" }));

// Cache loaded function modules
const functionModules = new Map();

async function getFunctionModule(name) {
  if (functionModules.has(name)) {
    return functionModules.get(name);
  }
  const filePath = join(FUNCTIONS_DIR, `${name}.js`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const mod = await import(`file://${filePath}`);
    functionModules.set(name, mod);
    return mod;
  } catch (err) {
    console.error(`[API Load Error] Failed to load ${name}:`, err);
    throw err;
  }
}

// API router for Cloudflare Pages Functions adapter
app.all("/api/:endpoint", async (req, res) => {
  const { endpoint } = req.params;

  if (endpoint.startsWith("_")) {
    return res.status(403).json({ error: "Access denied" });
  }

  let mod;
  try {
    mod = await getFunctionModule(endpoint);
  } catch (err) {
    return res.status(500).json({ error: `Error loading function: ${err.message}` });
  }

  if (!mod) {
    return res.status(404).json({ error: `API endpoint '${endpoint}' not found` });
  }

  const method = req.method.toUpperCase();
  const handler =
    method === "GET"
      ? mod.onRequestGet || mod.onRequest
      : method === "POST"
      ? mod.onRequestPost || mod.onRequest
      : method === "PUT"
      ? mod.onRequestPut || mod.onRequest
      : method === "PATCH"
      ? mod.onRequestPatch || mod.onRequest
      : method === "DELETE"
      ? mod.onRequestDelete || mod.onRequest
      : method === "OPTIONS"
      ? mod.onRequestOptions || mod.onRequest
      : mod.onRequest;

  if (!handler) {
    if (method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      return res.status(204).end();
    }
    return res.status(405).json({ error: `Method ${method} not allowed` });
  }

  // Construct Web standard Request object
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  const url = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) {
      if (Array.isArray(v)) {
        v.forEach((val) => headers.append(k, val));
      } else {
        headers.set(k, v);
      }
    }
  }

  const hasBody = !["GET", "HEAD"].includes(method) && req.body && req.body.length > 0;
  const webRequest = new Request(url, {
    method,
    headers,
    body: hasBody ? req.body : undefined,
  });

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL || "https://piezelkmhhfwydgriejb.supabase.co",
    SUPABASE_ANON_KEY:
      process.env.SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZXplbGttaGhmd3lkZ3JpZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDI4OTQsImV4cCI6MjEwMjI3ODg5NH0.9ilysxm-N-QLBHE7B8fiPf-OdCWhjQIMynxC-boSHz4",
    ...process.env,
  };

  const context = {
    request: webRequest,
    env,
    params: req.params,
    data: {},
    waitUntil: (promise) => {
      Promise.resolve(promise).catch((err) => console.error("[waitUntil error]", err));
    },
    next: () => {},
  };

  try {
    const webResponse = await handler(context);
    res.status(webResponse.status);
    for (const [k, v] of webResponse.headers.entries()) {
      res.setHeader(k, v);
    }
    const arrayBuffer = await webResponse.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error(`[API Handler Error in ${endpoint}]:`, err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Pretty route aliases
app.get("/book/:slug", (req, res) => {
  res.sendFile(join(WEB_DIR, "book.html"));
});

// Serve static assets from web/
app.use(express.static(WEB_DIR));

// Clean URL handling for HTML files: e.g. /dashboard -> /dashboard.html
app.get("*", (req, res, next) => {
  const cleanPath = req.path.replace(/^\//, "").replace(/\/$/, "");
  if (!cleanPath) {
    return res.sendFile(join(WEB_DIR, "index.html"));
  }
  const candidateHtml = join(WEB_DIR, `${cleanPath}.html`);
  if (fs.existsSync(candidateHtml)) {
    return res.sendFile(candidateHtml);
  }
  next();
});

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(join(WEB_DIR, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`eqstudio.link server running at http://${HOST}:${PORT}`);
});
