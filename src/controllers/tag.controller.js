const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");

const { tagDecorator } = require("../decorators/tag.decorator");

const index = async (req, res) => {
  try {
    const userId = req.user.id;

    const [tags] = await pool.query(
      `
            SELECT *
            FROM tags
            WHERE user_id = ?
            `,
      [userId],
    );

    return res.status(200).json({
      tags: tags.map(tagDecorator),
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

    const [tags] = await pool.query(
      `
            SELECT *
            FROM tags
            WHERE id = ?
            AND user_id = ?
            `,
      [id, userId],
    );

    if (tags.length === 0) {
      return res.status(404).json({
        message: "Tag not found",
      });
    }

    return res.status(200).json({
      tag: tagDecorator(tags[0]),
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
  } catch (error) {
    console.error(error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Tag already exists",
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
            UPDATE tags
            SET name = ?
            WHERE id = ?
            AND user_id = ?
            `,
      [name, id, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Tag not found",
      });
    }

    const [tags] = await pool.query(
      `
            SELECT *
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
  } catch (error) {
    console.error(error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Tag already exists",
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
            DELETE FROM tags
            WHERE id = ?
            AND user_id = ?
            `,
      [id, userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Tag not found",
      });
    }

    return res.status(200).json({
      message: "Tag deleted successfully",
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
