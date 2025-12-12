const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

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
const schema = new mongoose.Schema({
  name: String,
  time: String,
  fields: [String],
  rows: [
    {
      values: [String],
      createdAt: String,
    },
  ],
});

const model = mongoose.model("firstschema", schema);

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

// Get all holders
app.get("/getall", async (req, res) => {
  try {
    const data = await model.find();
    res.status(200).json({ message: "Data retrieved successfully", data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add Holder
app.post("/addHolder", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });

    const exist = await model.findOne({ name: name.trim() });
    if (exist)
      return res.status(409).json({ message: "Holder already exists" });

    const newHolder = await model.create({
      name,
      time: getFormattedDateTime(),
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
