const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

/**
 * 🔹 LEFT SIDEBAR USERS
 */
router.get("/users/:email", async (req, res) => {
  const email = req.params.email;

  const users = await Message.aggregate([
    {
      $match: {
        $or: [
          { senderEmail: email },
          { receiverEmail: email }
        ]
      }
    },
    {
      $project: {
        otherUser: {
          $cond: [
            { $eq: ["$senderEmail", email] },
            "$receiverEmail",
            "$senderEmail"
          ]
        }
      }
    },
    { $group: { _id: "$otherUser" } }
  ]);

  res.json(users.map(u => u._id));
});

/**
 * 🔹 CHAT HISTORY
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
