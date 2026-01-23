const express = require("express");
const router = express.Router();
const User = require("../models/User");

// =======================
// REGISTER / ADD USER (Plain Text)
// =======================
router.post("/add", async (req, res) => {
  try {
    const { firstName, lastName, mobile, email, password, login, address } = req.body;

    // Direct password save kar rahe hain bina kisi hash ke
    const user = new User({
      firstName,
      lastName,
      mobile,
      email: email.toLowerCase(), // Normalize email
      login,
      address,
      password: password, // 🔥 Plain password store ho raha hai
    });

    await user.save();
    res.status(201).json({ 
      message: "User registered successfully (Plain Text Mode)",
      user: { email: user.email, login: user.login }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// =======================
// LOGIN USER (Plain Text Match)
// =======================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) return res.status(404).json({ message: "User not found" });

    // 🔥 Direct string comparison (No bcrypt.compare)
    if (password !== user.password) {
      return res.status(401).json({ message: "Invalid password" });
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

// GET ALL USERS
router.get("/all", async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

module.exports = router;