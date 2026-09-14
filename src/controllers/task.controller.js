const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");

const { taskDecorator } = require("../decorators/task.decorator");
const AppError = require("../utils/app-error");
const catchAsync = require("../utils/catch-async");

const TASK_COLUMNS = `
  tasks.id,
  tasks.title,
  tasks.description,
  tasks.status,
  tasks.category_id,
  tasks.user_id,
  categories.name AS category_name
`;

const getTagsByTaskId = async (connection, taskId) => {
  const [tags] = await connection.query(
    `
      SELECT
        tags.id,
        tags.name
      FROM tags
      INNER JOIN tags_task
        ON tags.id = tags_task.tag_id
      WHERE tags_task.task_id = ?
    `,
    [taskId],
  );

  return tags;
};

const index = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const [tasks] = await pool.query(
    `
      SELECT
        ${TASK_COLUMNS}
      FROM tasks
      INNER JOIN categories
        ON tasks.category_id = categories.id
      WHERE tasks.user_id = ?
    `,
    [userId],
  );

  for (const task of tasks) {
    task.tags = await getTagsByTaskId(pool, task.id);
  }

  return res.status(200).json({
    tasks: tasks.map(taskDecorator),
  });
});

const show = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const [tasks] = await pool.query(
    `
      SELECT
        ${TASK_COLUMNS}
      FROM tasks
      INNER JOIN categories
        ON tasks.category_id = categories.id
      WHERE tasks.id = ?
      AND tasks.user_id = ?
    `,
    [id, userId],
  );

  if (tasks.length === 0) {
    throw new AppError("Task not found", 404);
  }

  const task = tasks[0];

  task.tags = await getTagsByTaskId(pool, id);

  return res.status(200).json({
    task: taskDecorator(task),
  });
});

const store = catchAsync(async (req, res) => {
  const { title, description, status, category_id, tag_ids } = req.body;
  const userId = req.user.id;

  if (!title || !category_id) {
    throw new AppError("Title and category_id are required", 400);
  }

  const connection = await pool.getConnection();

  try {
    const [categories] = await connection.query(
      `
        SELECT id
        FROM categories
        WHERE id = ?
        AND user_id = ?
      `,
      [category_id, userId],
    );

    if (categories.length === 0) {
      throw new AppError("Category not found", 404);
    }

    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      for (const tagId of tag_ids) {
        const [tags] = await connection.query(
          `
            SELECT id
            FROM tags
            WHERE id = ?
            AND user_id = ?
          `,
          [tagId, userId],
        );

        if (tags.length === 0) {
          throw new AppError(`Tag not found: ${tagId}`, 404);
        }
      }
    }

    const id = uuidv4();
    const taskStatus = status || "Pending";

    await connection.beginTransaction();

    await connection.query(
      `
        INSERT INTO tasks
          (id, title, description, status, category_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, title, description || null, taskStatus, category_id, userId],
    );

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
        SELECT id, title, description, status, category_id, user_id
        FROM tasks
        WHERE id = ?
        AND user_id = ?
      `,
      [id, userId],
    );

    tasks[0].tags = await getTagsByTaskId(connection, id);

    return res.status(201).json({
      message: "Task created successfully",
      task: taskDecorator(tasks[0]),
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
});

const update = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { title, description, status, category_id, tag_ids } = req.body;
  const userId = req.user.id;

  if (!title || !category_id) {
    throw new AppError("Title and category_id are required", 400);
  }

  const connection = await pool.getConnection();

  try {
    const [tasks] = await connection.query(
      `
        SELECT id
        FROM tasks
        WHERE id = ?
        AND user_id = ?
      `,
      [id, userId],
    );

    if (tasks.length === 0) {
      throw new AppError("Task not found", 404);
    }

    const [categories] = await connection.query(
      `
        SELECT id
        FROM categories
        WHERE id = ?
        AND user_id = ?
      `,
      [category_id, userId],
    );

    if (categories.length === 0) {
      throw new AppError("Category not found", 404);
    }

    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      for (const tagId of tag_ids) {
        const [tags] = await connection.query(
          `
            SELECT id
            FROM tags
            WHERE id = ?
            AND user_id = ?
          `,
          [tagId, userId],
        );

        if (tags.length === 0) {
          throw new AppError(`Tag not found: ${tagId}`, 404);
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
        AND user_id = ?
      `,
      [
        title,
        description || null,
        status || "Pending",
        category_id,
        id,
        userId,
      ],
    );

    await connection.query(
      `
        DELETE FROM tags_task
        WHERE task_id = ?
      `,
      [id],
    );

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

    const [updatedTasks] = await connection.query(
      `
        SELECT id, title, description, status, category_id, user_id
        FROM tasks
        WHERE id = ?
        AND user_id = ?
      `,
      [id, userId],
    );

    updatedTasks[0].tags = await getTagsByTaskId(connection, id);

    return res.status(200).json({
      message: "Task updated successfully",
      task: taskDecorator(updatedTasks[0]),
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
});

const destroy = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        DELETE FROM tasks
        WHERE id = ?
        AND user_id = ?
      `,
      [id, userId],
    );

    if (result.affectedRows === 0) {
      throw new AppError("Task not found", 404);
    }

    await connection.commit();

    return res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

module.exports = {
  index,
  show,
  store,
  update,
  destroy,
};
