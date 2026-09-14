require("dotenv").config();

const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/user.routes");
const categoryRoutes = require("./routes/category.routes");
const tagRoutes = require("./routes/tag.routes");
const taskRoutes = require("./routes/task.routes");
const authRoutes = require("./routes/auth.routes");

const errorHandler = require("./middlewares/error-handler.middleware");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
  }),
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Todo List API is running",
  });
});

app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
