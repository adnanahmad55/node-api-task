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
      match: /^[0-9]{10}$/, // 10 digit mobile number
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
    },

    login: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[a-zA-Z0-9]{8}$/, // exactly 8 characters
    },

    // 🔐 Password will be stored as bcrypt hash
    // ❌ No regex here (bcrypt hash won't match regex)
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // createdAt & updatedAt
  }
);

module.exports = mongoose.model("User", userSchema);
