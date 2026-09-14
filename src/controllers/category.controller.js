const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");
const { categoryDecorator } = require("../decorators/category.decorator");
const AppError = require("../utils/app-error");
const catchAsync = require("../utils/catch-async");
const paginate = require("../utils/paginate");

const notFound = (id) => {
  throw new AppError(
    `No query results for model [App\\Models\\Category] ${id}`,
    404,
  );
};

const validateName = async ({ name, excludeId, required }) => {
  const errors = {};

  if (required && !name) {
    errors.name = ["The name field is required."];
  } else if (name !== undefined) {
    if (typeof name !== "string") {
      errors.name = ["The name must be a string."];
    } else if (name.length > 255) {
      errors.name = ["The name must not be greater than 255 characters."];
    } else {
      const query = excludeId
        ? "SELECT id FROM categories WHERE name = ? AND id != ?"
        : "SELECT id FROM categories WHERE name = ?";
      const params = excludeId ? [name, excludeId] : [name];

      const [existing] = await pool.query(query, params);

      if (existing.length > 0) {
        errors.name = ["The name has already been taken."];
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("The given data was invalid.", 422, errors);
  }
};

const index = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;

  const { rows, meta, links } = await paginate(pool, {
    baseQuery: `
      SELECT id, name, created_at, updated_at
      FROM categories
      ORDER BY id ASC
    `,
    countQuery: "SELECT COUNT(*) as total FROM categories",
    page,
    perPage: 10,
    path: "/api/categories",
  });

  return res.status(200).json({
    data: rows.map(categoryDecorator),
    links,
    meta,
  });
});

const show = catchAsync(async (req, res) => {
  const { id } = req.params;

  const [categories] = await pool.query(
    "SELECT id, name, created_at, updated_at FROM categories WHERE id = ?",
    [id],
  );

  if (categories.length === 0) {
    notFound(id);
  }

  return res.status(200).json({ data: categoryDecorator(categories[0]) });
});

const store = catchAsync(async (req, res) => {
  const { name } = req.body;

  await validateName({ name, required: true });

  const id = uuidv4();
  const userId = req.user.id;

  await pool.query(
    "INSERT INTO categories (id, name, user_id) VALUES (?, ?, ?)",
    [id, name, userId],
  );

  const [categories] = await pool.query(
    "SELECT id, name, created_at, updated_at FROM categories WHERE id = ?",
    [id],
  );

  return res.status(201).json({ data: categoryDecorator(categories[0]) });
});

const update = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const [existing] = await pool.query(
    "SELECT id FROM categories WHERE id = ?",
    [id],
  );

  if (existing.length === 0) {
    notFound(id);
  }

  await validateName({ name, excludeId: id, required: false });

  if (name !== undefined) {
    await pool.query("UPDATE categories SET name = ? WHERE id = ?", [name, id]);
  }

  const [categories] = await pool.query(
    "SELECT id, name, created_at, updated_at FROM categories WHERE id = ?",
    [id],
  );

  return res.status(200).json({ data: categoryDecorator(categories[0]) });
});

const destroy = catchAsync(async (req, res) => {
  const { id } = req.params;

  const [result] = await pool.query("DELETE FROM categories WHERE id = ?", [
    id,
  ]);

  if (result.affectedRows === 0) {
    notFound(id);
  }

  return res.status(200).json({ message: "Categoría eliminada" });
});

module.exports = { index, show, store, update, destroy };
