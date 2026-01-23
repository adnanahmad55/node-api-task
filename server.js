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

const app = express();
const server = http.createServer(app);

app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket"],
});

const onlineUsers = new Map(); // email -> Set(socketIds)

io.on("connection", (socket) => {
  socket.on("join", async ({ email }) => {
    if (!email) return;
    socket.email = email;

    if (!onlineUsers.has(email)) onlineUsers.set(email, new Set());
    onlineUsers.get(email).add(socket.id);

    console.log(`User Online: ${email}`);

    // Send pending messages
    const pending = await Message.find({ receiverEmail: email, delivered: false });
    for (let m of pending) {
      socket.emit("receive_message", { senderEmail: m.senderEmail, message: m.message });
      m.delivered = true;
      await m.save();
    }

    // Broadcast updated online list
    io.emit("live_users_list", Array.from(onlineUsers.keys()));
  });

  socket.on("send_message", async (data) => {
    const { senderEmail, receiverEmail, message } = data;
    const msg = await Message.create({ senderEmail, receiverEmail, message, delivered: false });

    if (onlineUsers.has(receiverEmail)) {
      onlineUsers.get(receiverEmail).forEach(id => {
        io.to(id).emit("receive_message", { senderEmail, message });
      });
      msg.delivered = true;
      await msg.save();
    }
  });

  socket.on("disconnect", () => {
    if (socket.email && onlineUsers.has(socket.email)) {
      onlineUsers.get(socket.email).delete(socket.id);
      if (onlineUsers.get(socket.email).size === 0) {
        onlineUsers.delete(socket.email);
      }
      io.emit("live_users_list", Array.from(onlineUsers.keys()));
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server on ${PORT}`));