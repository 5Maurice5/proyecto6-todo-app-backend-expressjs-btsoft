const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");

const { categoryDecorator } = require("../decorators/category.decorator");
const AppError = require("../utils/app-error");
const catchAsync = require("../utils/catch-async");

const index = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const [categories] = await pool.query(
    `
      SELECT id, name, user_id
      FROM categories
      WHERE user_id = ?
    `,
    [userId],
  );

  return res.status(200).json({
    categories: categories.map(categoryDecorator),
  });
});

const show = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const [categories] = await pool.query(
    `
      SELECT id, name, user_id
      FROM categories
      WHERE id = ?
      AND user_id = ?
    `,
    [id, userId],
  );

  if (categories.length === 0) {
    throw new AppError("Category not found", 404);
  }

  return res.status(200).json({
    category: categoryDecorator(categories[0]),
  });
});

const store = catchAsync(async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  if (!name) {
    throw new AppError("Name is required", 400);
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
});

const update = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.user.id;

  if (!name) {
    throw new AppError("Name is required", 400);
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
    throw new AppError("Category not found", 404);
  }

  const [categories] = await pool.query(
    `
      SELECT id, name, user_id
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
});

const destroy = catchAsync(async (req, res) => {
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
    throw new AppError("Category not found", 404);
  }

  return res.status(200).json({
    message: "Category deleted successfully",
  });
});

module.exports = {
  index,
  show,
  store,
  update,
  destroy,
};
