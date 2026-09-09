const { categoryDecorator } = require("./category.decorator");
const { tagDecorator } = require("./tag.decorator");

const taskDecorator = (task) => {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: Boolean(task.status),
    category: task.category ? categoryDecorator(task.category) : null,
    userId: task.user_id,
    tags: task.tags ? task.tags.map(tagDecorator) : [],
  };
};

module.exports = {
  taskDecorator,
};
