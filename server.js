const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const Message = require("./models/Message");

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
const userRoutes = require("./routes/userRoutes");
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
// SOCKET.IO SETUP
// =====================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

/**
 * onlineUsers = Map
 * email -> socketId
 */
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // =====================
  // USER JOIN
  // =====================
  socket.on("join", async ({ email }) => {
    if (!email) return;

    onlineUsers.set(email, socket.id);
    console.log("✅ User joined:", email);

    // 🔥 SEND PENDING (OFFLINE) MESSAGES
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

    // mark as delivered
    await Message.updateMany(
      { receiverEmail: email, delivered: false },
      { delivered: true }
    );

    // update live users list
    io.emit("live_users_list", Array.from(onlineUsers.keys()));
  });

  // =====================
  // SEND MESSAGE (ONLINE + OFFLINE)
  // =====================
  socket.on(
    "send_message",
    async ({ senderEmail, receiverEmail, message }) => {
      if (!senderEmail || !receiverEmail || !message) return;

      // 🔥 SAVE MESSAGE FIRST
      const msg = await Message.create({
        senderEmail,
        receiverEmail,
        message,
        delivered: false,
      });

      // 🔥 IF RECEIVER ONLINE → SEND
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
  // USER DISCONNECT
  // =====================
  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);

    for (let [email, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
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
