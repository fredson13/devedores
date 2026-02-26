import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("pindureta.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    closure_id INTEGER,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (closure_id) REFERENCES closures(id)
  );

  CREATE TABLE IF NOT EXISTS closures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_received REAL NOT NULL,
    total_debts REAL NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add closure_id to transactions if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(transactions)").all();
  const hasClosureId = tableInfo.some((col: any) => col.name === 'closure_id');
  
  if (!hasClosureId) {
    console.log("Adding closure_id column to transactions table...");
    db.prepare("ALTER TABLE transactions ADD COLUMN closure_id INTEGER").run();
    // Add index for performance
    db.prepare("CREATE INDEX IF NOT EXISTS idx_transactions_closure ON transactions(closure_id)").run();
  }
} catch (e) {
  console.error("Migration error:", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/customers", (req, res) => {
    const customers = db.prepare(`
      SELECT c.*, 
             COALESCE(SUM(t.amount), 0) as total_debt
      FROM customers c
      LEFT JOIN transactions t ON c.id = t.customer_id
      GROUP BY c.id
      ORDER BY total_debt DESC
    `).all();
    res.json(customers);
  });

  app.post("/api/customers", (req, res) => {
    const { name, phone } = req.body;
    const info = db.prepare("INSERT INTO customers (name, phone) VALUES (?, ?)").run(name, phone);
    res.json({ id: info.lastInsertRowid, name, phone, total_debt: 0 });
  });

  app.get("/api/customers/:id/transactions", (req, res) => {
    const transactions = db.prepare("SELECT * FROM transactions WHERE customer_id = ? ORDER BY date DESC").all(req.params.id);
    res.json(transactions);
  });

  app.post("/api/transactions", (req, res) => {
    const { customer_id, amount, description } = req.body;
    const info = db.prepare("INSERT INTO transactions (customer_id, amount, description) VALUES (?, ?, ?)").run(customer_id, amount, description);
    res.json({ id: info.lastInsertRowid, customer_id, amount, description });
  });

  app.get("/api/transactions", (req, res) => {
    const transactions = db.prepare(`
      SELECT t.*, c.name as customer_name 
      FROM transactions t 
      JOIN customers c ON t.customer_id = c.id 
      ORDER BY t.date DESC
    `).all();
    res.json(transactions);
  });

  app.delete("/api/customers/:id", (req, res) => {
    db.prepare("DELETE FROM transactions WHERE customer_id = ?").run(req.params.id);
    db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/closures", (req, res) => {
    const closures = db.prepare("SELECT * FROM closures ORDER BY created_at DESC").all();
    res.json(closures);
  });

  app.post("/api/closures", (req, res) => {
    try {
      const { total_received, total_debts, start_date, end_date, transaction_ids } = req.body;
      console.log("Processing closure:", { total_received, total_debts, transaction_ids });
      
      const info = db.prepare(`
        INSERT INTO closures (total_received, total_debts, start_date, end_date) 
        VALUES (?, ?, ?, ?)
      `).run(total_received, total_debts, start_date, end_date);
      
      const closureId = info.lastInsertRowid;
      
      if (transaction_ids && Array.isArray(transaction_ids) && transaction_ids.length > 0) {
        const placeholders = transaction_ids.map(() => "?").join(",");
        db.prepare(`
          UPDATE transactions 
          SET closure_id = ? 
          WHERE id IN (${placeholders})
        `).run(closureId, ...transaction_ids);
      } else {
        // Fallback to date range
        db.prepare(`
          UPDATE transactions 
          SET closure_id = ? 
          WHERE closure_id IS NULL 
          AND date BETWEEN ? AND ?
        `).run(closureId, start_date, end_date);
      }
      
      res.json({ id: closureId });
    } catch (error: any) {
      console.error("Closure error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/closures/:id/transactions", (req, res) => {
    const transactions = db.prepare(`
      SELECT t.*, c.name as customer_name 
      FROM transactions t 
      JOIN customers c ON t.customer_id = c.id 
      WHERE t.closure_id = ? 
      ORDER BY t.date DESC
    `).all(req.params.id);
    res.json(transactions);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
