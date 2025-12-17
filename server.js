const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
dotenv.config();
JWT_SECRET = "ddjskdjsdkjd"
const app = express();
app.use(cors());
app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 3000;
const DB_USER = process.env.DB_USER;
const DB_PASS = encodeURIComponent(process.env.MONGOOSEPASS);
const DB_NAME = process.env.DB_NAME;

// MongoDB connection
mongoose
  .connect(
    `mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.e2dgvha.mongodb.net/${DB_NAME}?retryWrites=true&w=majority`
  )
  .then(() => {
    console.log("✅ Database connected successfully");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => console.log("❌ MongoDB connection error:", err));

// ---------------- Schema -----------------
// Schema update
const schema = new mongoose.Schema({
  userId: String, // logged-in user ka ID
  name: String,
  time: String,
  fields: [String],
  rows: [
    { values: [String], createdAt: String },
  ],
});

const model = mongoose.model("firstschema", schema);


const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  otp: String,
  otpExpire: Date
});

const User = mongoose.model("User", userSchema);


// ---------------- Utility -----------------
function getFormattedDateTime() {
  const date = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  return date.toLocaleString("en-IN", options);
}

// ---------------- API Routes -----------------
// JWT authentication middleware
// ---------------- Authorization Middleware -----------------
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "Token missing" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id; // logged-in user id store
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
}



app.get("/getall", verifyToken, async (req, res) => {
  try {
    const data = await model.find({ userId: req.userId });
    res.status(200).json({ message: "Data retrieved successfully", data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add Holder (user-specific)
app.post("/addHolder", verifyToken, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Name is required" });

  try {
    const exist = await model.findOne({ name, userId: req.userId });
    if (exist) return res.status(409).json({ message: "Holder already exists" });

    const newHolder = await model.create({
      name,
      time: getFormattedDateTime(),
      userId: req.userId
    });

    res.status(201).json({ message: "Holder created successfully", data: newHolder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Add Field to a Holder
app.post("/addField/:holderId", async (req, res) => {
  try {
    const { field } = req.body;
    const updated = await model.findByIdAndUpdate(
      req.params.holderId,
      { $push: { fields: field } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add Row to a Holder
app.post("/addRow/:holderId", async (req, res) => {
  try {
    const { values } = req.body;
    const updated = await model.findByIdAndUpdate(
      req.params.holderId,
      { $push: { rows: { values, createdAt: getFormattedDateTime() } } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete Field
app.delete("/deleteField/:holderId/:fieldIndex", async (req, res) => {
  try {
    const { holderId, fieldIndex } = req.params;
    const index = Number(fieldIndex);

    const holder = await model.findById(holderId);
    if (!holder) return res.status(404).json({ message: "Holder not found" });

    holder.fields.splice(index, 1);
    holder.rows.forEach((row) => row.values.splice(index, 1));

    await holder.save();
    res.json(holder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete Row
app.delete("/deleteRow/:holderId/:rowIndex", async (req, res) => {
  try {
    const { holderId, rowIndex } = req.params;
    const index = Number(rowIndex);

    const holder = await model.findById(holderId);
    if (!holder) return res.status(404).json({ message: "Holder not found" });

    holder.rows.splice(index, 1);
    await holder.save();
    res.json(holder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete Holder
app.delete("/deleteHolder/:id", async (req, res) => {
  try {
    const holder = await model.findById(req.params.id);
    if (!holder) return res.status(404).json({ message: "Holder not found" });

    await model.findByIdAndDelete(req.params.id);
    res.json({ message: "Holder deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Holder by ID
app.get("/holder/:id", async (req, res) => {
  try {
    const holder = await model.findById(req.params.id);
    res.json(holder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const exist = await User.findOne({ email });
    if (exist) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hash,
    });

    res.status(201).json({
      message: "Registered successfully",
      userId: user._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      userId: user._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});





app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpire = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // Configure nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, 
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}`,
    });

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("❌ Nodemailer Error:", err.message);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ---------------- VERIFY OTP ----------------
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== otp || user.otpExpire < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // OTP verified successfully
    user.otp = null;       // clear OTP after verification
    user.otpExpire = null;
    await user.save();

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Reset password directly (OTP already verified)
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

