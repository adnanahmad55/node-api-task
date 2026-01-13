const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderEmail: String,
    receiverEmail: String,
    message: String,
    delivered: { type: Boolean, default: false },
    read: { type: Boolean, default: false } // 🔥 NEW
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
