const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
// INIT APP FIRST
const app = express();
const { Server } = require("socket.io");

// MIDDLEWARES
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));

// ROUTES
const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

// MONGODB CONNECTION
mongoose
  .connect(
    process.env.MONGO_URL
  )
  .then(() => console.log("✅ MongoDB Connected (Atlas)"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// TEST ROUTE
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// SERVER
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
let liveUsers = [];
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

socket.on("join_live_users", (user) => {
  socket.join("live_users");

  const alreadyExists = liveUsers.find(
    (u) => u.email === user.email
  );

  if (!alreadyExists) {
    liveUsers.push({
      socketId: socket.id,
      email: user.email,
      name: user.firstName + " " + user.lastName,
    });
  }

  io.to("live_users").emit("live_users_list", liveUsers);
});


  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);

    liveUsers = liveUsers.filter(
      (u) => u.socketId !== socket.id
    );

    io.to("live_users").emit("live_users_list", liveUsers);
  });
});
const PORT = 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running with Socket.io on port ${PORT}`);
});
