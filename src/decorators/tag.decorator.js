const tagDecorator = (tag) => ({
  id: tag.id,
  name: tag.name,
  created_at: tag.created_at,
  updated_at: tag.updated_at,
});

module.exports = { tagDecorator };
