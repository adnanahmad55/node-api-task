const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    senderEmail: String,
    receiverEmail: String,
    message: String,
    fileUrl: { type: String, default: null },
messageType: { 
    type: String, 
    enum: ['text', 'image', 'video', 'audio'], // 🔥 'audio' add kiya
    default: 'text' 
},
    delivered: { type: Boolean, default: false },
    read: { type: Boolean, default: false }
}, { timestamps: true });

// 🔥 YE LINE SABSE ZAROORI HAI:
module.exports = mongoose.model("Message", messageSchema);