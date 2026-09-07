const { v4: uuidv4 } = require("uuid");
const pool = require("../db/connection");
const { taskDecorator } = require("../decorators/task.decorator");

const index = async (req, res) => {
  try {
    const [tasks] = await pool.query(`
            SELECT
                tasks.*,
                categories.name AS category_name
            FROM tasks
            INNER JOIN categories
                ON tasks.category_id = categories.id
        `);

    for (const task of tasks) {
      const [tags] = await pool.query(
        `
                SELECT
                    tags.id,
                    tags.name
                FROM tags
                INNER JOIN tags_task
                    ON tags.id = tags_task.tag_id
                WHERE tags_task.task_id = ?
            `,
        [task.id],
      );

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

    const [tasks] = await pool.query(
      `
            SELECT
                tasks.*,
                categories.name AS category_name
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
                tags.name
            FROM tags
            INNER JOIN tags_task
                ON tags.id = tags_task.tag_id
            WHERE tags_task.task_id = ?
        `,
      [id],
    );

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

    const taskStatus = status || "Pending";
    const id = uuidv4();

    await connection.beginTransaction();

    await connection.query(
      `
            INSERT INTO tasks
                (id, title, description, status, category_id, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      [id, title, description || null, taskStatus, category_id, user_id],
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

    const [tasks] = await connection.query("SELECT * FROM tasks WHERE id = ?", [
      id,
    ]);

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
      [id],
    );

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

    if (!title || !category_id) {
      return res.status(400).json({
        message: "Title and category_id are required",
      });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
            UPDATE tasks
            SET
                title = ?,
                description = ?,
                status = ?,
                category_id = ?
            WHERE id = ?
        `,
      [title, description || null, status || "Pending", category_id, id],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: "Task not found",
      });
    }

    /*
     * Eliminamos las relaciones anteriores
     * y las volvemos a crear.
     */
    await connection.query("DELETE FROM tags_task WHERE task_id = ?", [id]);

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

    const [tasks] = await connection.query("SELECT * FROM tasks WHERE id = ?", [
      id,
    ]);

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
      [id],
    );

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

    await connection.beginTransaction();

    const [result] = await connection.query("DELETE FROM tasks WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: "Task not found",
      });
    }

    await connection.commit();

    return res.status(200).json({
      message: "Task deleted successfully",
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
