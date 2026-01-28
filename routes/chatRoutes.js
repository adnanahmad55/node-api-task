const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");

/**
 * 🔹 1. GET ALL USERS (Task 2 & Sidebar)
 * Is route se aapko saare users milenge last message aur unread count ke saath.
 */
router.get("/users/:email", async (req, res) => {
  try {
    const loggedInEmail = req.params.email.toLowerCase();

    // 1. Saare users fetch karo (lastName bhi add kiya hai taaki Task 2 popup mein poora naam dikhe)
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

      // Kitne messages abhi tak read nahi huye hain (Unread Badge ke liye)
      const unread = await Message.countDocuments({
        senderEmail: userEmail,
        receiverEmail: loggedInEmail,
        read: false
      });

      return {
        ...user._doc,
        // Frontend Task 2 mein dikhane ke liye extra details
        lastMessage: lastMsg ? (lastMsg.messageType === 'text' ? lastMsg.message : `[${lastMsg.messageType}]`) : "No messages yet",
        lastMsgTime: lastMsg ? lastMsg.createdAt : null,
        unreadCount: unread 
      };
    }));

    res.json(usersWithLastMsg); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔹 2. GET LOGGED IN USER PROFILE
 * Login ke baad agar username nahi dikh raha, toh is route se frontend data fetch karega.
 */
router.get("/profile/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 🔹 3. CHAT HISTORY
 * Dono users ke beech ki chat history laane ke liye.
 */
router.get("/messages/:me/:other", async (req, res) => {
  try {
    const { me, other } = req.params;
    const myEmail = me.toLowerCase();
    const otherEmail = other.toLowerCase();

    // Sender aur Receiver dono ke messages fetch honge
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