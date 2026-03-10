import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import db from "./src/server/db.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/version", (req, res) => {
    res.json({ version: "1.0.1" }); // Current version
  });

  app.post("/api/auth", (req, res) => {
    const { password } = req.body;
    console.log(`Auth attempt received. Password length: ${password?.length || 0}`);
    if (password && password.toString().trim() === "041994") {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Invalid password" });
    }
  });

  // Novels
  app.get("/api/novels", (req, res) => {
    const novels = db.prepare("SELECT * FROM novels ORDER BY created_at DESC").all();
    res.json(novels);
  });

  app.post("/api/novels", (req, res) => {
    const { id, name } = req.body;
    db.prepare("INSERT INTO novels (id, name) VALUES (?, ?)").run(id, name);
    res.json({ success: true });
  });

  app.delete("/api/novels/:id", (req, res) => {
    db.prepare("DELETE FROM novels WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Chapters
  app.get("/api/chapters/:novelId", (req, res) => {
    const chapters = db.prepare("SELECT * FROM chapters WHERE novel_id = ? ORDER BY order_index ASC").all(req.params.novelId);
    res.json(chapters);
  });

  app.post("/api/chapters/upsert", (req, res) => {
    const { id, novel_id, title, content, translated_content, status, error, order_index } = req.body;
    db.prepare(`
      INSERT INTO chapters (id, novel_id, title, content, translated_content, status, error, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        content=excluded.content,
        translated_content=excluded.translated_content,
        status=excluded.status,
        error=excluded.error,
        order_index=excluded.order_index
    `).run(id, novel_id, title, content, translated_content, status, error, order_index);
    res.json({ success: true });
  });

  app.delete("/api/chapters/:id", (req, res) => {
    db.prepare("DELETE FROM chapters WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // API Keys
  app.get("/api/keys", (req, res) => {
    const keys = db.prepare("SELECT * FROM api_keys").all();
    res.json(keys);
  });

  app.post("/api/keys/upsert", (req, res) => {
    const { id, key, label, is_working, error_count, token_usage, quota_reached } = req.body;
    db.prepare(`
      INSERT INTO api_keys (id, key, label, is_working, error_count, token_usage, quota_reached)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        key=excluded.key,
        label=excluded.label,
        is_working=excluded.is_working,
        error_count=excluded.error_count,
        token_usage=excluded.token_usage,
        quota_reached=excluded.quota_reached
    `).run(id, key, label, is_working ? 1 : 0, error_count, token_usage, quota_reached ? 1 : 0);
    res.json({ success: true });
  });

  app.delete("/api/keys/:id", (req, res) => {
    db.prepare("DELETE FROM api_keys WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Settings
  app.get("/api/settings/:id", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings WHERE id = ?").get(req.params.id);
    if (settings && typeof settings === 'object' && 'selected_models' in settings) {
      (settings as any).selected_models = JSON.parse((settings as any).selected_models);
    }
    res.json(settings || null);
  });

  app.post("/api/settings/upsert", (req, res) => {
    const { id, prompt, target_language, source_language, selected_models } = req.body;
    db.prepare(`
      INSERT INTO settings (id, prompt, target_language, source_language, selected_models)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        prompt=excluded.prompt,
        target_language=excluded.target_language,
        source_language=excluded.source_language,
        selected_models=excluded.selected_models
    `).run(id, prompt, target_language, source_language, JSON.stringify(selected_models));
    res.json({ success: true });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from dist
    app.use(express.static(path.join(__dirname, "dist")));
    
    // Handle SPA routing - serve index.html for all non-api routes
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
