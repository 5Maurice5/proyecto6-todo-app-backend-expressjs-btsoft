const tagDecorator = (tag) => {
  return {
    id: tag.id,
    name: tag.name,
    userId: tag.user_id,
  };
};

module.exports = {
  tagDecorator,
};
