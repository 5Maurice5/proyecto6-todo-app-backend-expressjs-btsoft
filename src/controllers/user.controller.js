const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");
const { userDecorator } = require("../decorators/user.decorator");
const AppError = require("../utils/app-error");
const catchAsync = require("../utils/catch-async");

const createUser = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Name, email and password are required", 422);
  }

  const [existingUsers] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [email],
  );

  if (existingUsers.length > 0) {
    throw new AppError("Email already exists", 409);
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
    message: "User created successfully",
    user: userDecorator({
      id,
      name,
      email,
    }),
  });
});

module.exports = {
  createUser,
};
