const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");

const { categoryDecorator } = require("../decorators/category.decorator");

const index = async (req, res) => {
  try {
    const userId = req.user.id;

    const [categories] = await pool.query(
      `
            SELECT *
            FROM categories
            WHERE user_id = ?
            `,
      [userId],
    );

    return res.status(200).json({
      categories: categories.map(categoryDecorator),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const show = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [categories] = await pool.query(
      `
            SELECT *
            FROM categories
            WHERE id = ?
            AND user_id = ?
            `,
      [id, userId],
    );

    if (categories.length === 0) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    return res.status(200).json({
      category: categoryDecorator(categories[0]),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const store = async (req, res) => {
  try {
    const { name } = req.body;

    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    const id = uuidv4();

    await pool.query(
      `
            INSERT INTO categories (id, name, user_id)
            VALUES (?, ?, ?)
            `,
      [id, name, userId],
    );

    return res.status(201).json({
      message: "Category created successfully",
      category: categoryDecorator({
        id,
        name,
        user_id: userId,
      }),
    });
  } catch (error) {
    console.error(error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    const [result] = await pool.query(
      `
            UPDATE categories
            SET name = ?
            WHERE id = ?
            AND user_id = ?
            `,
      [name, id, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    const [categories] = await pool.query(
      `
            SELECT *
            FROM categories
            WHERE id = ?
            AND user_id = ?
            `,
      [id, userId],
    );

    return res.status(200).json({
      message: "Category updated successfully",
      category: categoryDecorator(categories[0]),
    });
  } catch (error) {
    console.error(error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const userId = req.user.id;

    const [result] = await pool.query(
      `
            DELETE FROM categories
            WHERE id = ?
            AND user_id = ?
            `,
      [id, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    return res.status(200).json({
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error(error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        message: "Category cannot be deleted because it has associated tasks",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  index,
  show,
  store,
  update,
  destroy,
};
