const express = require("express");

const app = express();

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("Server is working");
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});