const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const Message = require("./models/Message");
const User = require("./models/User"); // User model check kar lena path sahi ho
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");

require("dotenv").config();

// =====================
// INIT APP
// =====================
const app = express();
const server = http.createServer(app);

// =====================
// MIDDLEWARES
// =====================
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// =====================
// ROUTES
// =====================
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

// =====================
// MONGODB CONNECTION
// =====================
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// =====================
// HEALTH CHECK
// =====================
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// =====================
// ROOT
// =====================
app.get("/", (req, res) => {
  res.send("🚀 Server is running");
});

// =====================
// SOCKET.IO SETUP
// =====================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket"], // 🔥 Render fix
});

/**
 * onlineUsers Map
 * email -> Set(socketIds)
 */
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // =====================
  // USER JOIN
  // =====================
  socket.on("join", async ({ email }) => {
    if (!email) return;

    // Normalize email to avoid case-sensitivity issues
    const userEmail = email.toLowerCase();

    // Multi-tab safe logic
    if (!onlineUsers.has(userEmail)) {
      onlineUsers.set(userEmail, new Set());
    }
    onlineUsers.get(userEmail).add(socket.id);
    socket.email = userEmail;

    console.log("✅ User online:", userEmail);

    // Jab koi naya banda online aaye, sabko batao list update karne ke liye
    io.emit("sidebar_update"); 
    
    // 🔥 SEND UNDELIVERED MESSAGES
    try {
      const pendingMessages = await Message.find({
        receiverEmail: userEmail,
        delivered: false,
      }).sort({ createdAt: 1 });

      for (let msg of pendingMessages) {
        socket.emit("receive_message", {
          senderEmail: msg.senderEmail,
          message: msg.message,
          time: msg.createdAt,
        });
      }

      // Mark as delivered
      await Message.updateMany(
        { receiverEmail: userEmail, delivered: false },
        { delivered: true }
      );
    } catch (err) {
      console.error("❌ Pending messages error:", err);
    }

    io.emit("live_users_list", Array.from(onlineUsers.keys()));
  });

  // =====================
  // SEND MESSAGE
  // =====================
  socket.on("send_message", async (data) => {
    try {
      const { senderEmail, receiverEmail, message } = data;
      if (!senderEmail || !receiverEmail || !message) return;

      const sEmail = senderEmail.toLowerCase();
      const rEmail = receiverEmail.toLowerCase();

      // 🔥 SAVE MESSAGE ALWAYS
      const msg = await Message.create({
        senderEmail: sEmail,
        receiverEmail: rEmail,
        message,
        delivered: false,
        read: false,
      });

      // 🔥 SEND TO ALL RECEIVER SOCKETS (If Online)
      if (onlineUsers.has(rEmail)) {
        onlineUsers.get(rEmail).forEach((sockId) => {
          io.to(sockId).emit("receive_message", {
            senderEmail: sEmail,
            message,
            time: msg.createdAt,
          });
        });

        // Agar kam se kam ek socket par deliver ho gaya
        msg.delivered = true;
        await msg.save();
      }
    } catch (err) {
      console.error("❌ send_message error:", err.message);
    }
  });

  // =====================
  // MARK READ
  // =====================
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

  // =====================
  // DISCONNECT
  // =====================
  socket.on("disconnect", () => {
    const email = socket.email;
    console.log("🔴 Socket disconnected:", socket.id);

    if (email && onlineUsers.has(email)) {
      onlineUsers.get(email).delete(socket.id);

      if (onlineUsers.get(email).size === 0) {
        onlineUsers.delete(email);
        console.log("❌ User offline:", email);
      }
    }

    io.emit("live_users_list", Array.from(onlineUsers.keys()));
  });
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});