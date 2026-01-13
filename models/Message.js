const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderEmail: String,
    receiverEmail: String,
    message: String,
    delivered: Boolean,
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
