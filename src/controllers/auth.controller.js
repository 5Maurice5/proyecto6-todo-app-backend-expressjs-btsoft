const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");
const { userDecorator } = require("../decorators/user.decorator");
const AppError = require("../utils/app-error");
const catchAsync = require("../utils/catch-async");

const buildToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

const register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  const errors = {};
  if (!name) errors.name = ["The name field is required."];
  if (!email) errors.email = ["The email field is required."];
  if (!password) errors.password = ["The password field is required."];

  if (Object.keys(errors).length > 0) {
    throw new AppError("The given data was invalid.", 422, errors);
  }

  const id = uuidv4();
  const hashedPassword = await bcrypt.hash(password, 10);

  await pool.query(
    `
      INSERT INTO users (id, name, email, password)
      VALUES (?, ?, ?, ?)
    `,
    [id, name, email, hashedPassword],
  );

  const [users] = await pool.query(
    "SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?",
    [id],
  );

  const user = userDecorator(users[0]);
  const token = buildToken(user);

  return res.status(201).json({
    message: "User registered successfully",
    user,
    token,
  });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const errors = {};
  if (!email) errors.email = ["The email field is required."];
  if (!password) errors.password = ["The password field is required."];

  if (Object.keys(errors).length > 0) {
    throw new AppError("The given data was invalid.", 422, errors);
  }

  const [users] = await pool.query(
    "SELECT id, name, email, password, created_at, updated_at FROM users WHERE email = ?",
    [email],
  );

  const user = users[0];
  const isPasswordValid = user
    ? await bcrypt.compare(password, user.password)
    : false;

  if (!user || !isPasswordValid) {
    throw new AppError("The provided credentials are incorrect.", 422, {
      email: ["The provided credentials are incorrect."],
    });
  }

  const userLogin = userDecorator(user);
  const token = buildToken(userLogin);

  return res.status(200).json({
    message: "Login successful",
    user: userLogin,
    token,
  });
});

const me = catchAsync(async (req, res) => {
  const [users] = await pool.query(
    "SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?",
    [req.user.id],
  );

  if (users.length === 0) {
    throw new AppError("Unauthenticated.", 401);
  }

  return res.status(200).json({
    user: userDecorator(users[0]),
  });
});

const logout = catchAsync(async (req, res) => {
  return res.status(200).json({
    message: "Logout successful",
  });
});

module.exports = {
  register,
  login,
  me,
  logout,
};
