const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User"); // User model import kiya

/**
 * 🔹 LEFT SIDEBAR USERS (Ab saare users dikhenge)
 */
router.get("/users/:email", async (req, res) => {
  try {
    const loggedInEmail = req.params.email;

    // Apne ko chhod kar baaki saare users fetch karo
    // select('email firstName') se hume naam aur email dono mil jayenge
    const users = await User.find({ email: { $ne: loggedInEmail } })
                            .select("email firstName");
    
    res.json(users); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔹 CHAT HISTORY (Same rahega)
 */
router.get("/messages/:me/:other", async (req, res) => {
  const { me, other } = req.params;

  const messages = await Message.find({
    $or: [
      { senderEmail: me, receiverEmail: other },
      { senderEmail: other, receiverEmail: me }
    ]
  }).sort({ createdAt: 1 });

  res.json(messages);
});

module.exports = router;