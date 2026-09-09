const { v4: uuidv4, validate: uuidValidate } = require("uuid");

const pool = require("../db/connection");

const { taskDecorator } = require("../decorators/task.decorator");
const { categoryDecorator } = require("../decorators/category.decorator");
const { tagDecorator } = require("../decorators/tag.decorator");

const index = async (req, res) => {
  try {
    const [tasks] = await pool.query(`       SELECT
        tasks.*,
        categories.id AS category_id,
        categories.name AS category_name,
        categories.user_id AS category_user_id
      FROM tasks
      INNER JOIN categories
        ON tasks.category_id = categories.id
    `);

    for (const task of tasks) {
      const [tags] = await pool.query(
        `
      SELECT
        tags.id,
        tags.name,
        tags.user_id
      FROM tags
      INNER JOIN tags_task
        ON tags.id = tags_task.tag_id
      WHERE tags_task.task_id = ?
    `,
        [task.id],
      );

      task.category = {
        id: task.category_id,
        name: task.category_name,
        user_id: task.category_user_id,
      };

      task.tags = tags;
    }

    return res.status(200).json({
      tasks: tasks.map(taskDecorator),
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

    if (!uuidValidate(id)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const [tasks] = await pool.query(
      `
    SELECT
      tasks.*,
      categories.id AS category_id,
      categories.name AS category_name,
      categories.user_id AS category_user_id
    FROM tasks
    INNER JOIN categories
      ON tasks.category_id = categories.id
    WHERE tasks.id = ?
  `,
      [id],
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const task = tasks[0];

    const [tags] = await pool.query(
      `
    SELECT
      tags.id,
      tags.name,
      tags.user_id
    FROM tags
    INNER JOIN tags_task
      ON tags.id = tags_task.tag_id
    WHERE tags_task.task_id = ?
  `,
      [id],
    );

    task.category = {
      id: task.category_id,
      name: task.category_name,
      user_id: task.category_user_id,
    };

    task.tags = tags;

    return res.status(200).json({
      task: taskDecorator(task),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const store = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { title, description, status, category_id, user_id, tag_ids } =
      req.body;

    if (!title || !category_id || !user_id) {
      return res.status(400).json({
        message: "Title, category_id and user_id are required",
      });
    }

    if (!uuidValidate(category_id)) {
      return res.status(400).json({
        message: "Invalid category ID",
      });
    }

    if (!uuidValidate(user_id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    if (status !== undefined && typeof status !== "boolean") {
      return res.status(400).json({
        message: "Status must be a boolean",
      });
    }

    const [categories] = await connection.query(
      "SELECT id, name, user_id FROM categories WHERE id = ?",
      [category_id],
    );

    if (categories.length === 0) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    const [users] = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [user_id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (tag_ids !== undefined && !Array.isArray(tag_ids)) {
      return res.status(400).json({
        message: "tag_ids must be an array",
      });
    }

    if (Array.isArray(tag_ids)) {
      for (const tagId of tag_ids) {
        if (!uuidValidate(tagId)) {
          return res.status(400).json({
            message: `Invalid tag ID: ${tagId}`,
          });
        }

        const [tags] = await connection.query(
          "SELECT id FROM tags WHERE id = ?",
          [tagId],
        );

        if (tags.length === 0) {
          return res.status(404).json({
            message: `Tag not found: ${tagId}`,
          });
        }
      }
    }

    const taskId = uuidv4();

    const taskStatus = status ?? false;

    await connection.beginTransaction();

    await connection.query(
      `
    INSERT INTO tasks
      (id, title, description, status, category_id, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
      [taskId, title, description || null, taskStatus, category_id, user_id],
    );

    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      for (const tagId of tag_ids) {
        await connection.query(
          `
        INSERT INTO tags_task
          (tag_id, task_id)
        VALUES (?, ?)
      `,
          [tagId, taskId],
        );
      }
    }

    await connection.commit();

    const [tasks] = await connection.query(
      `
    SELECT
      tasks.*,
      categories.id AS category_id,
      categories.name AS category_name,
      categories.user_id AS category_user_id
    FROM tasks
    INNER JOIN categories
      ON tasks.category_id = categories.id
    WHERE tasks.id = ?
  `,
      [taskId],
    );

    const [tags] = await connection.query(
      `
    SELECT
      tags.id,
      tags.name,
      tags.user_id
    FROM tags
    INNER JOIN tags_task
      ON tags.id = tags_task.tag_id
    WHERE tags_task.task_id = ?
  `,
      [taskId],
    );

    tasks[0].category = {
      id: tasks[0].category_id,
      name: tasks[0].category_name,
      user_id: tasks[0].category_user_id,
    };

    tasks[0].tags = tags;

    return res.status(201).json({
      message: "Task created successfully",
      task: taskDecorator(tasks[0]),
    });
  } catch (error) {
    await connection.rollback();

    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    connection.release();
  }
};

const update = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const { title, description, status, category_id, tag_ids } = req.body;

    if (!uuidValidate(id)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const [existingTasks] = await connection.query(
      "SELECT * FROM tasks WHERE id = ?",
      [id],
    );

    if (existingTasks.length === 0) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const task = existingTasks[0];

    if (!title || !category_id) {
      return res.status(400).json({
        message: "Title and category_id are required",
      });
    }

    if (!uuidValidate(category_id)) {
      return res.status(400).json({
        message: "Invalid category ID",
      });
    }

    if (status !== undefined && typeof status !== "boolean") {
      return res.status(400).json({
        message: "Status must be a boolean",
      });
    }

    const [categories] = await connection.query(
      "SELECT id, name, user_id FROM categories WHERE id = ?",
      [category_id],
    );

    if (categories.length === 0) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    if (tag_ids !== undefined && !Array.isArray(tag_ids)) {
      return res.status(400).json({
        message: "tag_ids must be an array",
      });
    }

    if (Array.isArray(tag_ids)) {
      for (const tagId of tag_ids) {
        if (!uuidValidate(tagId)) {
          return res.status(400).json({
            message: `Invalid tag ID: ${tagId}`,
          });
        }

        const [tags] = await connection.query(
          "SELECT id FROM tags WHERE id = ?",
          [tagId],
        );

        if (tags.length === 0) {
          return res.status(404).json({
            message: `Tag not found: ${tagId}`,
          });
        }
      }
    }

    await connection.beginTransaction();

    await connection.query(
      `
    UPDATE tasks
    SET
      title = ?,
      description = ?,
      status = ?,
      category_id = ?
    WHERE id = ?
  `,
      [
        title,
        description ?? task.description,
        status ?? task.status,
        category_id,
        id,
      ],
    );

    // Delete previous tag relationships
    await connection.query("DELETE FROM tags_task WHERE task_id = ?", [id]);

    // Create new tag relationships
    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      for (const tagId of tag_ids) {
        await connection.query(
          `
        INSERT INTO tags_task
          (tag_id, task_id)
        VALUES (?, ?)
      `,
          [tagId, id],
        );
      }
    }

    await connection.commit();

    const [tasks] = await connection.query(
      `
    SELECT
      tasks.*,
      categories.id AS category_id,
      categories.name AS category_name,
      categories.user_id AS category_user_id
    FROM tasks
    INNER JOIN categories
      ON tasks.category_id = categories.id
    WHERE tasks.id = ?
  `,
      [id],
    );

    const [tags] = await connection.query(
      `
    SELECT
      tags.id,
      tags.name,
      tags.user_id
    FROM tags
    INNER JOIN tags_task
      ON tags.id = tags_task.tag_id
    WHERE tags_task.task_id = ?
  `,
      [id],
    );

    tasks[0].category = {
      id: tasks[0].category_id,
      name: tasks[0].category_name,
      user_id: tasks[0].category_user_id,
    };

    tasks[0].tags = tags;

    return res.status(200).json({
      message: "Task updated successfully",
      task: taskDecorator(tasks[0]),
    });
  } catch (error) {
    await connection.rollback();

    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    connection.release();
  }
};

const destroy = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    if (!uuidValidate(id)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const [tasks] = await connection.query(
      `
    SELECT
      tasks.*,
      categories.id AS category_id,
      categories.name AS category_name,
      categories.user_id AS category_user_id
    FROM tasks
    INNER JOIN categories
      ON tasks.category_id = categories.id
    WHERE tasks.id = ?
  `,
      [id],
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const task = tasks[0];

    const [tags] = await connection.query(
      `
    SELECT
      tags.id,
      tags.name,
      tags.user_id
    FROM tags
    INNER JOIN tags_task
      ON tags.id = tags_task.tag_id
    WHERE tags_task.task_id = ?
  `,
      [id],
    );

    task.category = {
      id: task.category_id,
      name: task.category_name,
      user_id: task.category_user_id,
    };

    task.tags = tags;

    await connection.beginTransaction();

    await connection.query("DELETE FROM tags_task WHERE task_id = ?", [id]);

    await connection.query("DELETE FROM tasks WHERE id = ?", [id]);

    await connection.commit();

    return res.status(200).json({
      message: "Task deleted successfully",
      task: taskDecorator(task),
    });
  } catch (error) {
    await connection.rollback();

    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  index,
  show,
  store,
  update,
  destroy,
};
