const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

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
 * liveUsers = {
 *   userId/email : socketId
 * }
 */
const liveUsers = {};

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // =====================
  // USER JOIN (AFTER LOGIN)
  // =====================
  socket.on("join", (user) => {
    if (!user?.email) return;

    liveUsers[user.email] = socket.id;

    console.log("✅ User joined:", user.email);

    io.emit("live_users_list", Object.keys(liveUsers));
  });

  // =====================
  // SEND MESSAGE (1-to-1)
  // =====================
  socket.on("send_message", ({ senderEmail, receiverEmail, message }) => {
    const receiverSocketId = liveUsers[receiverEmail];

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive_message", {
        senderEmail,
        message,
        time: new Date(),
      });
    }
  });

  // =====================
  // USER DISCONNECT
  // =====================
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);

    for (let email in liveUsers) {
      if (liveUsers[email] === socket.id) {
        delete liveUsers[email];
        break;
      }
    }

    io.emit("live_users_list", Object.keys(liveUsers));
  });
});

// =====================
// START SERVER (RENDER SAFE)
// =====================
const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
