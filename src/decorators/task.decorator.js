const taskDecorator = (task) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  status: Boolean(task.status),
  category: task.category ?? null,
  tags: task.tags || [],
  created_at: task.created_at,
  updated_at: task.updated_at,
});

module.exports = { taskDecorator };
