const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");

const { tagDecorator } = require("../decorators/tag.decorator");
const AppError = require("../utils/app-error");
const catchAsync = require("../utils/catch-async");

const index = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const [tags] = await pool.query(
    `
      SELECT id, name, user_id
      FROM tags
      WHERE user_id = ?
    `,
    [userId],
  );

  return res.status(200).json({
    tags: tags.map(tagDecorator),
  });
});

const show = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const [tags] = await pool.query(
    `
      SELECT id, name, user_id
      FROM tags
      WHERE id = ?
      AND user_id = ?
    `,
    [id, userId],
  );

  if (tags.length === 0) {
    throw new AppError("Tag not found", 404);
  }

  return res.status(200).json({
    tag: tagDecorator(tags[0]),
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
      INSERT INTO tags (id, name, user_id)
      VALUES (?, ?, ?)
    `,
    [id, name, userId],
  );

  return res.status(201).json({
    message: "Tag created successfully",
    tag: tagDecorator({
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
      UPDATE tags
      SET name = ?
      WHERE id = ?
      AND user_id = ?
    `,
    [name, id, userId],
  );

  if (result.affectedRows === 0) {
    throw new AppError("Tag not found", 404);
  }

  const [tags] = await pool.query(
    `
      SELECT id, name, user_id
      FROM tags
      WHERE id = ?
      AND user_id = ?
    `,
    [id, userId],
  );

  return res.status(200).json({
    message: "Tag updated successfully",
    tag: tagDecorator(tags[0]),
  });
});

const destroy = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const [result] = await pool.query(
    `
      DELETE FROM tags
      WHERE id = ?
      AND user_id = ?
    `,
    [id, userId],
  );

  if (result.affectedRows === 0) {
    throw new AppError("Tag not found", 404);
  }

  return res.status(200).json({
    message: "Tag deleted successfully",
  });
});

module.exports = {
  index,
  show,
  store,
  update,
  destroy,
};
