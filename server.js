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
    
    // Voice notes aur media detection fix
    let type = 'image';
    const mime = req.file.mimetype;
    if (mime.startsWith('video')) type = 'video';
    if (mime.startsWith('audio') || req.file.originalname.endsWith('.webm')) type = 'video'; 

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

app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/", (req, res) => res.send("🚀 Server is running"));

// SOCKET.IO SETUP
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket"],
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("join", async ({ email, view }) => {
    if (!email) return;
    const userEmail = email.toLowerCase();

    if (!onlineUsers.has(userEmail)) {
      onlineUsers.set(userEmail, new Set());
    }
    onlineUsers.get(userEmail).add(socket.id);
    socket.email = userEmail;

    io.emit("live_users_list", Array.from(onlineUsers.keys()));
    
    try {
      // Delivered status update (sirf online hone par)
      await Message.updateMany(
        { receiverEmail: userEmail, delivered: false },
        { delivered: true }
      );

      // Pending messages sirf unhe bhejo jo delivered nahi huye the
      const pendingMessages = await Message.find({
        receiverEmail: userEmail,
        read: false, // Sirf unread messages ko refresh par notify karo
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
      
      // Sidebar refresh logic
      io.emit("sidebar_update"); 
    } catch (err) {
      console.error("❌ Join Error:", err);
    }
  });

  // TYPING INDICATOR
  socket.on("typing", ({ receiverEmail, isTyping }) => {
    const rEmail = receiverEmail.toLowerCase();
    if (onlineUsers.has(rEmail)) {
      onlineUsers.get(rEmail).forEach((sockId) => {
        io.to(sockId).emit("display_typing", { senderEmail: socket.email, isTyping });
      });
    }
  });

  // SEND MESSAGE
  socket.on("send_message", async (data) => {
    try {
      const { senderEmail, receiverEmail, message, fileUrl, messageType } = data;
      if (!senderEmail || !receiverEmail) return;

      const sEmail = senderEmail.toLowerCase();
      const rEmail = receiverEmail.toLowerCase();

      const msg = await Message.create({
        senderEmail: sEmail,
        receiverEmail: rEmail,
        message: message || "",
        fileUrl: fileUrl || null,
        messageType: messageType || 'text',
        delivered: false,
        read: false,
      });

      if (onlineUsers.has(rEmail)) {
        onlineUsers.get(rEmail).forEach((sockId) => {
          io.to(sockId).emit("receive_message", {
            senderEmail: sEmail,
            message: msg.message,
            fileUrl: msg.fileUrl,
            messageType: msg.messageType,
            time: msg.createdAt,
          });
        });

        msg.delivered = true;
        await msg.save();
      }
      
      // Notify sidebar update for both (last msg & badges)
      onlineUsers.get(sEmail)?.forEach(id => io.to(id).emit("sidebar_update"));
      if (onlineUsers.has(rEmail)) {
          onlineUsers.get(rEmail).forEach(id => io.to(id).emit("sidebar_update"));
      }
      
    } catch (err) {
      console.error("❌ send_message error:", err.message);
    }
  });

  // MARK READ logic (Frontend se trigger hoga jab chat khulegi)
  socket.on("mark_read", async ({ userEmail, otherEmail }) => {
    try {
      if(!userEmail || !otherEmail) return;
      const me = userEmail.toLowerCase();
      const other = otherEmail.toLowerCase();

      await Message.updateMany(
        { senderEmail: other, receiverEmail: me, read: false },
        { read: true, delivered: true }
      );

      // Dono ko notify karo taaki badge hat jaye
      onlineUsers.get(me)?.forEach(id => io.to(id).emit("sidebar_update"));
      onlineUsers.get(other)?.forEach(id => io.to(id).emit("sidebar_update"));
    } catch (err) {
      console.error("❌ mark_read error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    const email = socket.email;
    if (email && onlineUsers.has(email)) {
      const socketSet = onlineUsers.get(email);
      socketSet.delete(socket.id);
      if (socketSet.size === 0) onlineUsers.delete(email);
    }
    io.emit("live_users_list", Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});