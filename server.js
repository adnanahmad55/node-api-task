const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const Message = require("./models/Message");
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
 * onlineUsers
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

    // multi-tab safe
    if (!onlineUsers.has(email)) {
      onlineUsers.set(email, new Set());
    }
    onlineUsers.get(email).add(socket.id);
    socket.email = email;

    console.log("✅ User online:", email);

    // 🔥 SEND UNDELIVERED MESSAGES
    const pendingMessages = await Message.find({
      receiverEmail: email,
      delivered: false,
    }).sort({ createdAt: 1 });

    for (let msg of pendingMessages) {
      socket.emit("receive_message", {
        senderEmail: msg.senderEmail,
        message: msg.message,
        time: msg.createdAt,
      });
    }

    // mark delivered
    await Message.updateMany(
      { receiverEmail: email, delivered: false },
      { delivered: true }
    );

    io.emit("live_users_list", Array.from(onlineUsers.keys()));
  });

  // =====================
  // SEND MESSAGE
  // =====================
  socket.on("send_message", async (data) => {
    try {
      const { senderEmail, receiverEmail, message } = data;
      if (!senderEmail || !receiverEmail || !message) return;

      // 🔥 SAVE MESSAGE ALWAYS
      const msg = await Message.create({
        senderEmail,
        receiverEmail,
        message,
        delivered: false,
        read: false,
      });

      // 🔥 SEND TO ALL RECEIVER SOCKETS
      if (onlineUsers.has(receiverEmail)) {
        for (let sockId of onlineUsers.get(receiverEmail)) {
          io.to(sockId).emit("receive_message", {
            senderEmail,
            message,
            time: msg.createdAt,
          });

          // 🔥 sidebar refresh trigger
          io.to(sockId).emit("sidebar_update");
        }

        msg.delivered = true;
        await msg.save();
      }
    } catch (err) {
      console.error("❌ send_message error:", err.message);
    }
  });

  // =====================
  // MARK READ (CHAT OPEN)
  // =====================
  socket.on("mark_read", async ({ userEmail, otherEmail }) => {
    try {
      await Message.updateMany(
        {
          senderEmail: otherEmail,
          receiverEmail: userEmail,
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
