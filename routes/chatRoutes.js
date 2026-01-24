const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");

/**
 * 🔹 LEFT SIDEBAR USERS (With Last Message & Time)
 */
router.get("/users/:email", async (req, res) => {
  try {
    const loggedInEmail = req.params.email.toLowerCase();

    // 1. Saare users fetch karo
    const users = await User.find({ email: { $ne: loggedInEmail } })
                            .select("email firstName");

    // 2. Har user ke liye last message dhundo
    const usersWithLastMsg = await Promise.all(users.map(async (user) => {
      const lastMsg = await Message.findOne({
        $or: [
          { senderEmail: loggedInEmail, receiverEmail: user.email.toLowerCase() },
          { senderEmail: user.email.toLowerCase(), receiverEmail: loggedInEmail }
        ]
      }).sort({ createdAt: -1 }); // Sabse naya message pehle

      return {
        ...user._doc,
        // 🔥 Ye data frontend use karega sidebar ke liye
        lastMessage: lastMsg ? (lastMsg.messageType === 'text' ? lastMsg.message : `[${lastMsg.messageType}]`) : "No messages yet",
        lastMsgTime: lastMsg ? lastMsg.createdAt : null
      };
    }));

    res.json(usersWithLastMsg); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔹 CHAT HISTORY
 */
router.get("/messages/:me/:other", async (req, res) => {
  try {
    const { me, other } = req.params;

    const messages = await Message.find({
      $or: [
        { senderEmail: me.toLowerCase(), receiverEmail: other.toLowerCase() },
        { senderEmail: other.toLowerCase(), receiverEmail: me.toLowerCase() }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;