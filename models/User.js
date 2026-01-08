const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      match: /^[0-9]{10}$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
    },
    login: {
      type: String,
      required: true,
      match: /^[a-zA-Z0-9]{8}$/,
    },
    password: {
      type: String,
      required: true,
      match: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{6,}$/,
    },
  },
  {
    timestamps: true, // creates createdAt & updatedAt
  }
);

module.exports = mongoose.model("User", userSchema);
