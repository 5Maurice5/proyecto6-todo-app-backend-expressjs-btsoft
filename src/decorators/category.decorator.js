const categoryDecorator = (category) => ({
  id: category.id,
  name: category.name,
  created_at: category.created_at,
  updated_at: category.updated_at,
});

module.exports = { categoryDecorator };
