const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");
const { categoryDecorator } = require("../decorators/category.decorator");

const index = async (req, res) => {
  try {
    const [categories] = await pool.query("SELECT * FROM categories");

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

    const [categories] = await pool.query(
      "SELECT * FROM categories WHERE id = ?",
      [id],
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
    const { name, user_id } = req.body;

    if (!name || !user_id) {
      return res.status(400).json({
        message: "Name and user_id are required",
      });
    }

    const id = uuidv4();

    await pool.query(
      `
            INSERT INTO categories (id, name, user_id)
            VALUES (?, ?, ?)
            `,
      [id, name, user_id],
    );

    return res.status(201).json({
      message: "Category created successfully",
      category: categoryDecorator({
        id,
        name,
        user_id,
      }),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

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
            `,
      [name, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    const [categories] = await pool.query(
      "SELECT * FROM categories WHERE id = ?",
      [id],
    );

    return res.status(200).json({
      message: "Category updated successfully",
      category: categoryDecorator(categories[0]),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const destroy = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM categories WHERE id = ?", [
      id,
    ]);

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
