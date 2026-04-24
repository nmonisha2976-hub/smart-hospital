let step = 1;
let symptoms = [];

/* LOGIN FUNCTION */
function login() {
  const roleElement = document.getElementById("role");

  if (!roleElement) {
    console.error("Role dropdown not found");
    return;
  }

  const role = roleElement.value;

  if (role === "patient") {
    window.location.href = "health.html";
  } else if (role === "doctor") {
    window.location.href = "doctor.html";
  } else if (role === "admin") {
    window.location.href = "admin.html";
  } else {
    console.error("Invalid role selected");
  }
}

/* ADD SYMPTOMS */
function addSymptom(s) {
  if (!symptoms.includes(s)) {
    symptoms.push(s);
    console.log("Symptoms:", symptoms);
  }
}

/* NEXT STEP HANDLER */
function nextStep() {
  const current = document.getElementById("step" + step);

  if (!current) return;

  current.style.display = "none";
  step++;

  const next = document.getElementById("step" + step);

  if (next) {
    next.style.display = "block";
  } else {
    submitData();
  }
}

/* SUBMIT DATA */
async function submitData() {
  const height = document.getElementById("height")?.value;
  const weight = document.getElementById("weight")?.value;

  // Basic validation
  if (!height || !weight) {
    alert("Please enter height and weight");
    return;
  }

  const details = `${height},${weight}`;

  try {
    const res = await fetch("/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Patient",
        doctor: "Dr. Rao",
        symptoms: symptoms.join(","),
        details
      })
    });

    if (!res.ok) {
      throw new Error("Failed to submit data");
    }

    // Only redirect after success
    window.location.href = "patient.html";

  } catch (err) {
    console.error("Error:", err);
    alert("Something went wrong. Try again.");
  }
}