const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

/* ================= DB ================= */
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Monisha@2712",
  database: "hospital"
});

db.connect(err => {
  if (err) console.log("❌ DB ERROR:", err);
  else console.log("✅ DB Connected");
});

/* =========================================================
   🔥 NEW ADD: DOCTORS API (THIS FIXES YOUR ERROR)
========================================================= */
app.get("/doctors", (req, res) => {
  db.query("SELECT * FROM doctors", (err, result) => {
    if (err) {
      console.log("❌ DOCTORS ERROR:", err);
      return res.status(500).json([]);
    }
    res.json(result);
  });
});

/* =========================================================
   🔥 OPTIONAL: AUTO INSERT SAMPLE DOCTORS (RUNS ONCE)
========================================================= */
db.query("SELECT COUNT(*) AS count FROM doctors", (err, result) => {
  if (!err && result[0].count === 0) {
    db.query(`
      INSERT INTO doctors (name, specialization) VALUES
      ('Dr. Rao', 'Cardiology'),
      ('Dr. Priya', 'Dermatology'),
      ('Dr. Kumar', 'Orthopedics')
    `);
    console.log("✅ Sample doctors inserted");
  }
});

/* ================= MULTER ================= */
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });

  res.json({ success: true, file: req.file.filename });
});

/* =========================================================
   🔥 HOSPITAL SUMMARY API
========================================================= */
app.get("/hospital-summary", (req, res) => {
  const sql1 = "SELECT * FROM doctors";
  const sql2 = "SELECT * FROM patient_appointments";

  db.query(sql1, (err, doctors) => {
    db.query(sql2, (err2, appointments) => {

      if (err || err2) {
        return res.json({ doctors: [], appointments: [] });
      }

      const enriched = doctors.map(doc => {
        const docApps = appointments.filter(a => a.doctor === doc.name);

        return {
          ...doc,
          total: docApps.length,
          online: docApps.filter(a => a.type === "online").length,
          offline: docApps.filter(a => a.type === "offline").length
        };
      });

      res.json({
        doctors: enriched,
        totalDoctors: doctors.length,
        totalAppointments: appointments.length
      });
    });
  });
});

/* ================= SAVE HEALTH + PDF ================= */
app.post("/save-health", (req, res) => {
  const data = req.body;

  if (!data.name || !data.age) {
    return res.status(400).json({
      success: false,
      message: "Name and age required"
    });
  }

  const fileName = `health_${Date.now()}.pdf`;
  const filePath = path.join(__dirname, "uploads", fileName);

  db.query(
    `INSERT INTO patients 
    (name, age, gender, height, weight, blood, symptoms, description) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.age,
      data.gender,
      data.height,
      data.weight,
      data.blood,
      data.symptoms,
      data.description
    ],
    (err) => {
      if (err) {
        console.log("❌ DB ERROR:", err);
        return res.status(500).json({ success: false });
      }

      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      doc.fontSize(20).text("MediCare+ Health Report", { align: "center" });
      doc.moveDown();

      doc.fontSize(14).text("Patient Details");

      doc.text(`Name: ${data.name}`);
      doc.text(`Age: ${data.age}`);
      doc.text(`Gender: ${data.gender}`);
      doc.text(`Height: ${data.height}`);
      doc.text(`Weight: ${data.weight}`);
      doc.text(`Blood: ${data.blood}`);

      doc.moveDown();
      doc.text("Symptoms:");
      doc.text(data.symptoms);

      doc.text("Description:");
      doc.text(data.description);

      doc.end();

      stream.on("finish", () => {
        db.query(
          "INSERT INTO reports (username, filename) VALUES (?, ?)",
          [data.name, fileName]
        );

        res.json({
          success: true,
          file: fileName
        });
      });

      stream.on("error", (err) => {
        console.log("❌ PDF ERROR:", err);
        res.status(500).json({ success: false });
      });
    }
  );
});

/* ================= BOOK APPOINTMENT ================= */
app.post("/book", (req, res) => {
  const { name, doctor, symptoms, details, type } = req.body;

  if (!name || !doctor) {
    return res.status(400).json({ success: false });
  }

  let urgency = "Normal";
  if (symptoms?.toLowerCase().includes("chest")) {
    urgency = "Emergency";
  }

  db.query(
    `INSERT INTO patient_appointments 
    (patient_name, doctor, urgency, status, details, type) 
    VALUES (?, ?, ?, ?, ?, ?)`,
    [name, doctor, urgency, "Pending", details || "", type || "online"],
    (err) => {
      if (err) {
        console.log("❌ BOOK ERROR:", err);
        return res.status(500).json({ success: false });
      }

      res.json({ success: true });
    }
  );
});

/* ================= APPOINTMENTS ================= */
app.get("/appointments", (req, res) => {
  db.query("SELECT * FROM patient_appointments ORDER BY id DESC", (err, result) => {
    if (err) return res.json([]);
    res.json(result);
  });
});

/* ================= DOCTOR FILTER ================= */
app.get("/doctor/:name", (req, res) => {
  db.query(
    "SELECT * FROM patient_appointments WHERE doctor=? ORDER BY id DESC",
    [req.params.name],
    (err, result) => {
      if (err) return res.json([]);
      res.json(result);
    }
  );
});

/* ================= ACCEPT / REJECT ================= */
app.post("/accept/:id", (req, res) => {
  db.query(
    "UPDATE patient_appointments SET status='Accepted' WHERE id=?",
    [req.params.id],
    () => res.json({ success: true })
  );
});

app.post("/reject/:id", (req, res) => {
  const reason = req.body.reason || "Not specified";

  db.query(
    "UPDATE patient_appointments SET status='Rejected', doctor_msg=? WHERE id=?",
    [reason, req.params.id],
    () => res.json({ success: true })
  );
});

/* ================= PRESCRIPTION ================= */
app.post("/prescription", (req, res) => {
  const { patient_name, doctor, prescription } = req.body;

  if (!patient_name || !doctor) {
    return res.status(400).json({ success: false });
  }

  db.query(
    `INSERT INTO prescriptions (patient_name, doctor, prescription)
     VALUES (?, ?, ?)`,
    [patient_name, doctor, prescription || ""],
    (err) => {

      if (err) {
        console.log("❌ PRESCRIPTION ERROR:", err);
        return res.status(500).json({ success: false });
      }

      db.query(
        `UPDATE patient_appointments 
         SET doctor_msg=? 
         WHERE patient_name=? AND doctor=?`,
        [prescription || "", patient_name, doctor]
      );

      res.json({ success: true });
    }
  );
});

/* ================= GET PRESCRIPTIONS ================= */
app.get("/prescriptions/:patient", (req, res) => {
  db.query(
    "SELECT * FROM prescriptions WHERE patient_name=? ORDER BY id DESC",
    [req.params.patient],
    (err, result) => {
      if (err) return res.json([]);
      res.json(result);
    }
  );
});

/* ================= LATEST REPORT ================= */
app.get("/latest-report", (req, res) => {
  const user = req.query.user;

  db.query(
    "SELECT filename FROM reports WHERE username=? ORDER BY id DESC LIMIT 1",
    [user],
    (err, result) => {
      if (err || !result.length) {
        return res.json({ file: null });
      }

      res.json({ file: result[0].filename });
    }
  );
});

/* ================= SERVER ================= */
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});