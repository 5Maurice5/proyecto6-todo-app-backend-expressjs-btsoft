const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");
const { userDecorator } = require("../decorators/user.decorator");
const AppError = require("../utils/app-error");
const catchAsync = require("../utils/catch-async");

const register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Name, email and password are required", 400);
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

  return res.status(201).json({
    user: userDecorator({
      id,
      name,
      email,
    }),
  });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const [users] = await pool.query(
    "SELECT id, name, email, password FROM users WHERE email = ?",
    [email],
  );

  if (users.length === 0) {
    throw new AppError("Invalid credentials", 401);
  }

  const user = users[0];

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", 401);
  }

  const userLogin = userDecorator(user);

  const token = jwt.sign(
    {
      id: userLogin.id,
      email: userLogin.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    },
  );

  return res.status(200).json({
    token,
    user: userLogin,
  });
});

module.exports = {
  register,
  login,
};
