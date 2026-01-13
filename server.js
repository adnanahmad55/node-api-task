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
app.use("/api/chat", chatRoutes);
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// =====================
// ROUTES
// =====================
app.use("/api/users", userRoutes);

// =====================
// MONGODB CONNECTION
// =====================
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// =====================
// HEALTH CHECK (RENDER SAFE)
// =====================
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// =====================
// ROOT ROUTE
// =====================
app.get("/", (req, res) => {
  res.send("🚀 Server is running");
});

// =====================
// CHAT APIs (FOR UI)
// =====================

// 🔹 LEFT SIDEBAR – USERS I CHATTED WITH
app.get("/api/chat/users/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const chats = await Message.find({
      $or: [{ senderEmail: email }, { receiverEmail: email }],
    }).select("senderEmail receiverEmail");

    const users = new Set();

    chats.forEach((c) => {
      if (c.senderEmail !== email) users.add(c.senderEmail);
      if (c.receiverEmail !== email) users.add(c.receiverEmail);
    });

    res.json([...users]);
  } catch (err) {
    res.status(500).json({ message: "Failed to load chat users" });
  }
});

// 🔹 MESSAGE HISTORY (RIGHT CHAT)
app.get(
  "/api/chat/messages/:userEmail/:otherEmail",
  async (req, res) => {
    try {
      const { userEmail, otherEmail } = req.params;

      const messages = await Message.find({
        $or: [
          { senderEmail: userEmail, receiverEmail: otherEmail },
          { senderEmail: otherEmail, receiverEmail: userEmail },
        ],
      }).sort({ createdAt: 1 });

      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Failed to load messages" });
    }
  }
);

// =====================
// SOCKET.IO SETUP
// =====================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/**
 * onlineUsers
 * email -> socketId
 */
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // =====================
  // USER JOIN
  // =====================
  socket.on("join", async ({ email }) => {
    if (!email) return;

    onlineUsers.set(email, socket.id);
    console.log("✅ User online:", email);

    // 🔥 SEND OFFLINE (UNDELIVERED) MESSAGES
    const pendingMessages = await Message.find({
      receiverEmail: email,
      delivered: false,
    }).sort({ createdAt: 1 });

    pendingMessages.forEach((msg) => {
      socket.emit("receive_message", {
        senderEmail: msg.senderEmail,
        message: msg.message,
        time: msg.createdAt,
      });
    });

    // mark delivered
    await Message.updateMany(
      { receiverEmail: email, delivered: false },
      { delivered: true }
    );

    // update online list
    io.emit("live_users_list", Array.from(onlineUsers.keys()));
  });

  // =====================
  // SEND MESSAGE
  // =====================
  socket.on(
    "send_message",
    async ({ senderEmail, receiverEmail, message }) => {
      if (!senderEmail || !receiverEmail || !message) return;

      // 🔥 SAVE MESSAGE (ALWAYS)
      const msg = await Message.create({
        senderEmail,
        receiverEmail,
        message,
        delivered: false,
      });

      // 🔥 IF RECEIVER ONLINE
      if (onlineUsers.has(receiverEmail)) {
        io.to(onlineUsers.get(receiverEmail)).emit("receive_message", {
          senderEmail,
          message,
          time: msg.createdAt,
        });

        msg.delivered = true;
        await msg.save();
      }
    }
  );

  // =====================
  // DISCONNECT
  // =====================
  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);

    for (let [email, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(email);
        console.log("❌ User offline:", email);
        break;
      }
    }

    io.emit("live_users_list", Array.from(onlineUsers.keys()));
  });
});

// =====================
// START SERVER (RENDER SAFE)
// =====================
const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
