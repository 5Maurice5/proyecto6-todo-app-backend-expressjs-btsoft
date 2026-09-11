const express = require("express");

const {
  index,
  show,
  store,
  update,
  destroy,
} = require("../controllers/task.controller");

const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authMiddleware, index);
router.get("/:id", authMiddleware, show);
router.post("/", authMiddleware, store);
router.put("/:id", authMiddleware, update);
router.delete("/:id", authMiddleware, destroy);

module.exports = router;
