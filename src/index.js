require("dotenv").config();

const express = require("express");

const userRoutes = require("./routes/user.routes");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Todo List API is running",
  });
});

app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
