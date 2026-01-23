// models/Message.js
const messageSchema = new mongoose.Schema({
    senderEmail: String,
    receiverEmail: String,
    message: String,        // Text or caption
    fileUrl: String,        // URL of image/video
    messageType: { 
        type: String, 
        enum: ['text', 'image', 'video'], 
        default: 'text' 
    },
    delivered: { type: Boolean, default: false },
    read: { type: Boolean, default: false }
}, { timestamps: true });