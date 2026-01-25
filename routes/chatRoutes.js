const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");

/**
 * 🔹 LEFT SIDEBAR USERS (With Last Message & Unread Count)
 */
router.get("/users/:email", async (req, res) => {
  try {
    const loggedInEmail = req.params.email.toLowerCase();

    // 1. Saare users fetch karo (lastName bhi add kiya hai)
    const users = await User.find({ email: { $ne: loggedInEmail } })
                            .select("email firstName lastName");

    // 2. Har user ke liye last message aur unread messages dhundo
    const usersWithLastMsg = await Promise.all(users.map(async (user) => {
      const userEmail = user.email.toLowerCase();

      // Sabse naya message fetch karna
      const lastMsg = await Message.findOne({
        $or: [
          { senderEmail: loggedInEmail, receiverEmail: userEmail },
          { senderEmail: userEmail, receiverEmail: loggedInEmail }
        ]
      }).sort({ createdAt: -1 });

      // Kitne messages abhi tak read nahi huye hain
      const unread = await Message.countDocuments({
        senderEmail: userEmail,
        receiverEmail: loggedInEmail,
        read: false
      });

      return {
        ...user._doc,
        lastMessage: lastMsg ? (lastMsg.messageType === 'text' ? lastMsg.message : `[${lastMsg.messageType}]`) : "No messages yet",
        lastMsgTime: lastMsg ? lastMsg.createdAt : null,
        unreadCount: unread // Frontend isse badges dikhayega
      };
    }));

    res.json(usersWithLastMsg); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔹 CHAT HISTORY (Fixes visibility of both sender and receiver messages)
 */
router.get("/messages/:me/:other", async (req, res) => {
  try {
    const { me, other } = req.params;
    const myEmail = me.toLowerCase();
    const otherEmail = other.toLowerCase();

    // Dono side ka data fetch hoga taaki history poori dikhe
    const messages = await Message.find({
      $or: [
        { senderEmail: myEmail, receiverEmail: otherEmail },
        { senderEmail: otherEmail, receiverEmail: myEmail }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;