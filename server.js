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
// HEALTH CHECK (🔥 VERY IMPORTANT FOR RENDER)
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

// 🔥 Store live users
let liveUsers = [];

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // USER JOINS AFTER LOGIN
  socket.on("join_live_users", (user) => {
    if (!user?.email) return;

    const alreadyExists = liveUsers.find(
      (u) => u.email === user.email
    );

    if (!alreadyExists) {
      liveUsers.push({
        socketId: socket.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      });
    }

    io.emit("live_users_list", liveUsers);
  });

  // USER DISCONNECT
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);

    liveUsers = liveUsers.filter(
      (u) => u.socketId !== socket.id
    );

    io.emit("live_users_list", liveUsers);
  });
});

// =====================
// START SERVER (🔥 RENDER SAFE)
// =====================
const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
