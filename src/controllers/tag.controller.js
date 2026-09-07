const { v4: uuidv4 } = require("uuid");
const pool = require("../db/connection");
const { tagDecorator } = require("../decorators/tag.decorator");

const index = async (req, res) => {
  try {
    const [tags] = await pool.query("SELECT * FROM tags");

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

    const [tags] = await pool.query("SELECT * FROM tags WHERE id = ?", [id]);

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
    const { name, user_id } = req.body;

    if (!name || !user_id) {
      return res.status(400).json({
        message: "Name and user_id are required",
      });
    }

    const id = uuidv4();

    await pool.query(
      `INSERT INTO tags (id, name, user_id)
             VALUES (?, ?, ?)`,
      [id, name, user_id],
    );

    return res.status(201).json({
      message: "Tag created successfully",
      tag: tagDecorator({
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
      `UPDATE tags
             SET name = ?
             WHERE id = ?`,
      [name, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Tag not found",
      });
    }

    const [tags] = await pool.query("SELECT * FROM tags WHERE id = ?", [id]);

    return res.status(200).json({
      message: "Tag updated successfully",
      tag: tagDecorator(tags[0]),
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

    const [result] = await pool.query("DELETE FROM tags WHERE id = ?", [id]);

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
