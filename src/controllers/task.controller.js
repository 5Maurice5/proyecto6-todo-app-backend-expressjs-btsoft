const { v4: uuidv4, validate: uuidValidate } = require("uuid");

const pool = require("../db/connection");

const { taskDecorator } = require("../decorators/task.decorator");
const { categoryDecorator } = require("../decorators/category.decorator");
const { tagDecorator } = require("../decorators/tag.decorator");

const validateTags = async (connection, tag_ids) => {
  if (tag_ids === undefined) {
    return;
  }

  if (!Array.isArray(tag_ids)) {
    const error = new Error("tag_ids must be an array");
    error.status = 400;
    throw error;
  }

  if (tag_ids.length === 0) {
    return;
  }

  for (const tagId of tag_ids) {
    if (!uuidValidate(tagId)) {
      const error = new Error(`Invalid tag ID: ${tagId}`);
      error.status = 400;
      throw error;
    }
  }

  const placeholders = tag_ids.map(() => "?").join(", ");

  const [tags] = await connection.query(
    `SELECT id
     FROM tags
     WHERE id IN (${placeholders})`,
    tag_ids,
  );

  const foundTagIds = new Set(tags.map((tag) => tag.id));

  const missingTagId = tag_ids.find((tagId) => !foundTagIds.has(tagId));

  if (missingTagId) {
    const error = new Error(`Tag not found: ${missingTagId}`);
    error.status = 404;
    throw error;
  }
};

const getTagsByTaskIds = async (connection, taskIds) => {
  if (taskIds.length === 0) {
    return new Map();
  }

  const placeholders = taskIds.map(() => "?").join(", ");

  const [tags] = await connection.query(
    `
      SELECT
        tags.id,
        tags.name,
        tags.user_id,
        tags_task.task_id
      FROM tags
      INNER JOIN tags_task
        ON tags.id = tags_task.tag_id
      WHERE tags_task.task_id IN (${placeholders})
    `,
    taskIds,
  );

  const tagsByTask = new Map();

  for (const tag of tags) {
    if (!tagsByTask.has(tag.task_id)) {
      tagsByTask.set(tag.task_id, []);
    }

    tagsByTask.get(tag.task_id).push({
      id: tag.id,
      name: tag.name,
      user_id: tag.user_id,
    });
  }

  return tagsByTask;
};

const index = async (req, res) => {
  try {
    const [tasks] = await pool.query(`
      SELECT
        tasks.*,
        categories.id AS category_id,
        categories.name AS category_name,
        categories.user_id AS category_user_id
      FROM tasks
      INNER JOIN categories
        ON tasks.category_id = categories.id
    `);

    const taskIds = tasks.map((task) => task.id);

    const tagsByTask = await getTagsByTaskIds(pool, taskIds);

    for (const task of tasks) {
      task.category = {
        id: task.category_id,
        name: task.category_name,
        user_id: task.category_user_id,
      };

      task.tags = tagsByTask.get(task.id) || [];
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

    const tagsByTask = await getTagsByTaskIds(pool, [id]);

    task.category = {
      id: task.category_id,
      name: task.category_name,
      user_id: task.category_user_id,
    };

    task.tags = tagsByTask.get(id) || [];

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

    try {
      await validateTags(connection, tag_ids);
    } catch (error) {
      return res.status(error.status || 500).json({
        message: error.message,
      });
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
      const values = tag_ids.map((tagId) => [tagId, taskId]);

      await connection.query(
        `
          INSERT INTO tags_task
            (tag_id, task_id)
          VALUES ?
        `,
        [values],
      );
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

    const tagsByTask = await getTagsByTaskIds(connection, [taskId]);

    tasks[0].category = {
      id: tasks[0].category_id,
      name: tasks[0].category_name,
      user_id: tasks[0].category_user_id,
    };

    tasks[0].tags = tagsByTask.get(taskId) || [];

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

    try {
      await validateTags(connection, tag_ids);
    } catch (error) {
      return res.status(error.status || 500).json({
        message: error.message,
      });
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

    await connection.query("DELETE FROM tags_task WHERE task_id = ?", [id]);

    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      const values = tag_ids.map((tagId) => [tagId, id]);

      await connection.query(
        `
          INSERT INTO tags_task
            (tag_id, task_id)
          VALUES ?
        `,
        [values],
      );
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

    const tagsByTask = await getTagsByTaskIds(connection, [id]);

    tasks[0].category = {
      id: tasks[0].category_id,
      name: tasks[0].category_name,
      user_id: tasks[0].category_user_id,
    };

    tasks[0].tags = tagsByTask.get(id) || [];

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

    const tagsByTask = await getTagsByTaskIds(connection, [id]);

    task.category = {
      id: task.category_id,
      name: task.category_name,
      user_id: task.category_user_id,
    };

    task.tags = tagsByTask.get(id) || [];

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
