const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");

const createUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(422).json({
        message: "Name, email and password are required",
      });
    }

    const [existingUsers] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        message: "Email already exists",
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
      message: "User created successfully",
      user: userDecorator({
        id,
        name,
        email,
      }),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  createUser,
};
