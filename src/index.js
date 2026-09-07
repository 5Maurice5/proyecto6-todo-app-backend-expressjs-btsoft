require("dotenv").config();

const express = require("express");
const pool = require("./db/connection");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

async function testDatabaseConnection() {
  try {
    const [rows] = await pool.query("SELECT 1");

    console.log("Database connected successfully");
    console.log(rows);
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
}

testDatabaseConnection();

app.get("/", (req, res) => {
  res.json({
    message: "Todo List API is running",
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
