const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");

/**
 * 🔹 1. GET ALL REGISTERED USERS (Public - No Login Required)
 * Task 2 ke liye: Bina login kiye saare users yahan se dikhenge.
 */
router.get("/all-registered", async (req, res) => {
  try {
    // Saare users fetch karein firstName, lastName aur email ke saath
    const users = await User.find({})
                            .select("email firstName lastName createdAt")
                            .sort({ createdAt: -1 }); // Naye users pehle dikhenge
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Public data fetch failed: " + err.message });
  }
});

/**
 * 🔹 2. GET CHAT SIDEBAR USERS (Requires Login Email)
 * Is route mein logged-in user ko exclude kiya jata hai ($ne).
 */
router.get("/users/:email", async (req, res) => {
  try {
    const loggedInEmail = req.params.email.toLowerCase();

    const users = await User.find({ email: { $ne: loggedInEmail } })
                            .select("email firstName lastName");

    const usersWithLastMsg = await Promise.all(users.map(async (user) => {
      const userEmail = user.email.toLowerCase();

      const lastMsg = await Message.findOne({
        $or: [
          { senderEmail: loggedInEmail, receiverEmail: userEmail },
          { senderEmail: userEmail, receiverEmail: loggedInEmail }
        ]
      }).sort({ createdAt: -1 });

      const unread = await Message.countDocuments({
        senderEmail: userEmail,
        receiverEmail: loggedInEmail,
        read: false
      });

      return {
        ...user._doc,
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
 * 🔹 3. GET LOGGED IN USER PROFILE
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
 * 🔹 4. CHAT HISTORY
 */
router.get("/messages/:me/:other", async (req, res) => {
  try {
    const { me, other } = req.params;
    const myEmail = me.toLowerCase();
    const otherEmail = other.toLowerCase();

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