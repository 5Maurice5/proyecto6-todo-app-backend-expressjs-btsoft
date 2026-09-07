const taskDecorator = (task) => {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    categoryId: task.category_id,
    userId: task.user_id,
    tags: task.tags || [],
  };
};

module.exports = {
  taskDecorator,
};
