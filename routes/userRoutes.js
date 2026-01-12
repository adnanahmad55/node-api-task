const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/User");


// =======================
// REGISTER / ADD USER
// =======================
router.post("/add", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      mobile,
      email,
      password,
      login,
      address,
    } = req.body;

    // 🔐 Password strength check
    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{6,}$/;

    if (!strongPassword.test(password)) {
      return res.status(400).json({
        message: "Password must contain uppercase, lowercase & special character",
      });
    }

    // 🔒 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      firstName,
      lastName,
      mobile,
      email,
      login,
      address,
      password: hashedPassword,
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        email: user.email,
        login: user.login,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// =======================
// LOGIN USER
// =======================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid password",
      });
    }

    res.status(200).json({
      message: "Login successful",
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        login: user.login,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// =======================
// GET ALL USERS
// =======================
router.get("/all", async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

module.exports = router;
