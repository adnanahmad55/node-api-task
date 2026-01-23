const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const Message = require("./models/Message");
const User = require("./models/User"); 
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

// =====================
// CLOUDINARY CONFIG
// =====================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'messenger_media',
    resource_type: 'auto', 
  },
});
const upload = multer({ storage: storage });

// MIDDLEWARES
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// =====================
// MEDIA UPLOAD ROUTE
// =====================
app.post("/api/chat/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const type = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    res.json({ url: req.file.path, type: type });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ROUTES
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

// MONGODB CONNECTION
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/", (req, res) => {
  res.send("🚀 Server is running");
});

// SOCKET.IO SETUP
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket"],
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("join", async ({ email }) => {
    if (!email) return;
    const userEmail = email.toLowerCase();

    if (!onlineUsers.has(userEmail)) {
      onlineUsers.set(userEmail, new Set());
    }
    onlineUsers.get(userEmail).add(socket.id);
    socket.email = userEmail;

    io.emit("live_users_list", Array.from(onlineUsers.keys()));
    io.emit("sidebar_update"); 
    
    try {
      const pendingMessages = await Message.find({
        receiverEmail: userEmail,
        delivered: false,
      }).sort({ createdAt: 1 });

      for (let msg of pendingMessages) {
        socket.emit("receive_message", {
          senderEmail: msg.senderEmail,
          message: msg.message,
          fileUrl: msg.fileUrl,
          messageType: msg.messageType,
          time: msg.createdAt,
        });
      }

      await Message.updateMany(
        { receiverEmail: userEmail, delivered: false },
        { delivered: true }
      );
    } catch (err) {
      console.error("❌ Pending messages error:", err);
    }
  });

  socket.on("send_message", async (data) => {
    try {
      const { senderEmail, receiverEmail, message, fileUrl, messageType } = data;
      if (!senderEmail || !receiverEmail) return;

      const sEmail = senderEmail.toLowerCase();
      const rEmail = receiverEmail.toLowerCase();

      // Database mein save
      const msg = await Message.create({
        senderEmail: sEmail,
        receiverEmail: rEmail,
        message: message || "",
        fileUrl: fileUrl || null,
        messageType: messageType || 'text',
        delivered: false,
        read: false,
      });

      // Receiver ko bhej rhe hain media details ke saath
      if (onlineUsers.has(rEmail)) {
        onlineUsers.get(rEmail).forEach((sockId) => {
          io.to(sockId).emit("receive_message", {
            senderEmail: sEmail,
            message: msg.message,
            fileUrl: msg.fileUrl,       // 🔥 Ab media URL bhi jayega
            messageType: msg.messageType, // 🔥 Ab type bhi jayega
            time: msg.createdAt,
          });
        });

        msg.delivered = true;
        await msg.save();
      }
      
      // Sidebar refresh trigger
      if (onlineUsers.has(rEmail)) {
          onlineUsers.get(rEmail).forEach(id => io.to(id).emit("sidebar_update"));
      }
      
    } catch (err) {
      console.error("❌ send_message error:", err.message);
    }
  });

  socket.on("mark_read", async ({ userEmail, otherEmail }) => {
    try {
      if(!userEmail || !otherEmail) return;
      await Message.updateMany(
        {
          senderEmail: otherEmail.toLowerCase(),
          receiverEmail: userEmail.toLowerCase(),
          read: false,
        },
        { read: true }
      );
    } catch (err) {
      console.error("❌ mark_read error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    const email = socket.email;
    if (email && onlineUsers.has(email)) {
      onlineUsers.get(email).delete(socket.id);
      if (onlineUsers.get(email).size === 0) {
        onlineUsers.delete(email);
      }
    }
    io.emit("live_users_list", Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});