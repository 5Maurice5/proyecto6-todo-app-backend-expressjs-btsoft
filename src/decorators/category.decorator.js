const categoryDecorator = (category) => {
  return {
    id: category.id,
    name: category.name,
    userId: category.user_id,
  };
};

module.exports = {
  categoryDecorator,
};
