const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");
const { userDecorator } = require("../decorators/user.decorator");

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
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
      message: "User registered successfully",
      user: userDecorator({
        id,
        name,
        email,
      }),
    });
  } catch (error) {
    console.error(error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      },
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: userDecorator(user),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  register,
  login,
};
