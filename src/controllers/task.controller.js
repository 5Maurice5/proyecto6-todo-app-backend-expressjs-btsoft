const { v4: uuidv4 } = require("uuid");

const pool = require("../db/connection");
const { taskDecorator } = require("../decorators/task.decorator");
const AppError = require("../utils/app-error");
const catchAsync = require("../utils/catch-async");
const paginate = require("../utils/paginate");

const TASK_COLUMNS = `
  tasks.id,
  tasks.title,
  tasks.description,
  tasks.status,
  tasks.created_at,
  tasks.updated_at,
  categories.id AS category_id,
  categories.name AS category_name,
  categories.created_at AS category_created_at,
  categories.updated_at AS category_updated_at
`;

const notFoundTask = (id) => {
  throw new AppError(
    `No query results for model [App\\Models\\Task] ${id}`,
    404,
  );
};

const attachCategory = (task) => {
  task.category = {
    id: task.category_id,
    name: task.category_name,
    created_at: task.category_created_at,
    updated_at: task.category_updated_at,
  };
};

const getTagsByTaskId = async (connection, taskId) => {
  const [tags] = await connection.query(
    `
      SELECT tags.id, tags.name, tags.created_at, tags.updated_at
      FROM tags
      INNER JOIN tags_task ON tags.id = tags_task.tag_id
      WHERE tags_task.task_id = ?
    `,
    [taskId],
  );

  return tags;
};

const validateTaskInput = async ({
  title,
  description,
  status,
  category_id,
  tags,
  requireTitle,
  requireCategory,
}) => {
  const errors = {};

  if (requireTitle && !title) {
    errors.title = ["The title field is required."];
  } else if (title !== undefined) {
    if (typeof title !== "string") {
      errors.title = ["The title must be a string."];
    } else if (title.length > 255) {
      errors.title = ["The title must not be greater than 255 characters."];
    }
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    errors.description = ["The description must be a string."];
  }

  if (status !== undefined && typeof status !== "boolean") {
    errors.status = ["The status field must be true or false."];
  }

  if (requireCategory && !category_id) {
    errors.category_id = ["The category id field is required."];
  } else if (category_id) {
    const [found] = await pool.query("SELECT id FROM categories WHERE id = ?", [
      category_id,
    ]);

    if (found.length === 0) {
      errors.category_id = ["The selected category id is invalid."];
    }
  }

  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags)) {
      errors.tags = ["The tags must be an array."];
    } else {
      for (const tagId of tags) {
        const [found] = await pool.query("SELECT id FROM tags WHERE id = ?", [
          tagId,
        ]);

        if (found.length === 0) {
          errors.tags = ["The selected tags is invalid."];
          break;
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError("The given data was invalid.", 422, errors);
  }
};

const index = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;

  const {
    rows: tasks,
    meta,
    links,
  } = await paginate(pool, {
    baseQuery: `
      SELECT ${TASK_COLUMNS}
      FROM tasks
      INNER JOIN categories ON tasks.category_id = categories.id
      ORDER BY tasks.id ASC
    `,
    countQuery: "SELECT COUNT(*) as total FROM tasks",
    page,
    perPage: 10,
    path: "/api/tasks",
  });

  for (const task of tasks) {
    attachCategory(task);
    task.tags = await getTagsByTaskId(pool, task.id);
  }

  return res.status(200).json({
    data: tasks.map(taskDecorator),
    links,
    meta,
  });
});

const show = catchAsync(async (req, res) => {
  const { id } = req.params;

  const [tasks] = await pool.query(
    `
      SELECT ${TASK_COLUMNS}
      FROM tasks
      INNER JOIN categories ON tasks.category_id = categories.id
      WHERE tasks.id = ?
    `,
    [id],
  );

  if (tasks.length === 0) {
    notFoundTask(id);
  }

  const task = tasks[0];
  attachCategory(task);
  task.tags = await getTagsByTaskId(pool, id);

  return res.status(200).json({ data: taskDecorator(task) });
});

const store = catchAsync(async (req, res) => {
  const { title, description, status, category_id, tags } = req.body;

  await validateTaskInput({
    title,
    description,
    status,
    category_id,
    tags,
    requireTitle: true,
    requireCategory: true,
  });

  const connection = await pool.getConnection();

  try {
    const id = uuidv4();
    const userId = req.user.id;
    const taskStatus = Boolean(status);
    const shouldSyncTags = Array.isArray(tags) && tags.length > 0;

    await connection.beginTransaction();

    await connection.query(
      `
        INSERT INTO tasks (id, title, description, status, category_id, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, title, description || null, taskStatus, category_id, userId],
    );

    if (shouldSyncTags) {
      for (const tagId of tags) {
        await connection.query(
          "INSERT INTO tags_task (tag_id, task_id) VALUES (?, ?)",
          [tagId, id],
        );
      }
    }

    await connection.commit();

    const [createdTasks] = await connection.query(
      `
        SELECT ${TASK_COLUMNS}
        FROM tasks
        INNER JOIN categories ON tasks.category_id = categories.id
        WHERE tasks.id = ?
      `,
      [id],
    );

    const task = createdTasks[0];
    attachCategory(task);
    task.tags = await getTagsByTaskId(connection, id);

    return res.status(201).json({ data: taskDecorator(task) });
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const update = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { title, description, status, category_id, tags } = req.body;

  const [existing] = await pool.query("SELECT id FROM tasks WHERE id = ?", [
    id,
  ]);

  if (existing.length === 0) {
    notFoundTask(id);
  }

  await validateTaskInput({
    title,
    description,
    status,
    category_id,
    tags,
    requireTitle: false,
    requireCategory: false,
  });

  const connection = await pool.getConnection();

  try {
    const fields = [];
    const values = [];

    if (title !== undefined) {
      fields.push("title = ?");
      values.push(title);
    }
    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description || null);
    }
    if (status !== undefined) {
      fields.push("status = ?");
      values.push(Boolean(status));
    }
    if (category_id !== undefined) {
      fields.push("category_id = ?");
      values.push(category_id);
    }

    await connection.beginTransaction();

    if (fields.length > 0) {
      await connection.query(
        `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`,
        [...values, id],
      );
    }

    const shouldSyncTags = Array.isArray(tags) && tags.length > 0;

    if (shouldSyncTags) {
      await connection.query("DELETE FROM tags_task WHERE task_id = ?", [id]);

      for (const tagId of tags) {
        await connection.query(
          "INSERT INTO tags_task (tag_id, task_id) VALUES (?, ?)",
          [tagId, id],
        );
      }
    }

    await connection.commit();

    const [updatedTasks] = await connection.query(
      `
        SELECT ${TASK_COLUMNS}
        FROM tasks
        INNER JOIN categories ON tasks.category_id = categories.id
        WHERE tasks.id = ?
      `,
      [id],
    );

    const task = updatedTasks[0];
    attachCategory(task);
    task.tags = await getTagsByTaskId(connection, id);

    return res.status(200).json({ data: taskDecorator(task) });
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const destroy = catchAsync(async (req, res) => {
  const { id } = req.params;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query("DELETE FROM tags_task WHERE task_id = ?", [id]);

    const [result] = await connection.query("DELETE FROM tasks WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      throw new AppError(
        `No query results for model [App\\Models\\Task] ${id}`,
        404,
      );
    }

    await connection.commit();

    return res.status(200).json({ message: "Tarea eliminada" });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

module.exports = { index, show, store, update, destroy };
