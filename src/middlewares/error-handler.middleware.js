const DB_ERROR_MAP = {
  ER_DUP_ENTRY: {
    statusCode: 409,
    message: "The resource already exists",
  },
  ER_ROW_IS_REFERENCED_2: {
    statusCode: 409,
    message: "Resource cannot be deleted because it has related records",
  },
  ER_NO_REFERENCED_ROW_2: {
    statusCode: 400,
    message: "Referenced resource does not exist",
  },
};

const errorHandler = (error, req, res, next) => {
  console.error(error);

  if (error.isOperational) {
    return res.status(error.statusCode).json({
      message: error.message,
    });
  }

  const dbError = error.code && DB_ERROR_MAP[error.code];

  if (dbError) {
    return res.status(dbError.statusCode).json({
      message: dbError.message,
    });
  }

  return res.status(500).json({
    message: "Internal server error",
  });
};

module.exports = errorHandler;
