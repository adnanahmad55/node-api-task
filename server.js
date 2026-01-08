const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

// INIT APP FIRST
const app = express();

// MIDDLEWARES
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

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
  res.send("API is running...");
});

// SERVER
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
