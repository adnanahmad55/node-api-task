const express = require("express");
const router = express.Router();
const User = require("../models/User");

// CREATE USER API
router.post("/add", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json({ message: "User saved successfully", user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET ALL USERS
router.get("/all", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

module.exports = router;
