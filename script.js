// Dummy geofences (latitude, longitude, radius in meters)
const geoFences = [
  {
    name: "Office",
    latitude: 11.356236, 
    longitude: 77.826647,
    radius: 1000, // 1km
  }
];

// Face recognition variables
let faceRegistered = false;
let faceDescriptors = {};
let videoStream = null;
let faceapiLoaded = false;

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
  try {
    await faceapi.loadTinyFaceDetectorModel(MODEL_URL);
    await faceapi.loadFaceLandmarkTinyModel(MODEL_URL);
    await faceapi.loadFaceRecognitionModel(MODEL_URL);
    console.log('Models loaded successfully');
    return true;
  } catch (err) {
    console.error('Error loading models:', err);
    return false;
  }
}

// Initialize face-api.js models
async function loadFaceAPIModels() {
  try {
    // Use './models' for relative path from your HTML file
    await faceapi.nets.tinyFaceDetector.loadFromUri('./models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('./models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('./models');
    console.log('Models loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading models:', error);
    alert('Error loading face recognition models. Please ensure you are using a local server.');
    return false;
  }
}

// Start video stream for face registration
async function startVideo(modalType) {
  try {
    const videoElement = modalType === 'register' ? document.getElementById('video') : document.getElementById('verify-video');
    
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
    }
    
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = videoStream;
    
    return true;
  } catch (error) {
    console.error('Error accessing camera:', error);
    alert('Could not access the camera. Please ensure camera permissions are granted.');
    return false;
  }
}

// Register face for a user
async function registerFace(email) {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const statusElement = document.getElementById('face-reg-status');
  
  // Create spinner element if it doesn't exist
  let spinner = statusElement.querySelector('.spinner');
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.className = 'spinner';
    statusElement.appendChild(spinner);
  }
  
  statusElement.innerHTML = '<div class="spinner"></div> Detecting face...';
  spinner.style.display = 'block';
  
  try {
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    if (detections.length === 0) {
      statusElement.innerHTML = 'No face detected. Please try again.';
      return false;
    }
    
    if (detections.length > 1) {
      statusElement.innerHTML = 'Multiple faces detected. Please ensure only your face is visible.';
      return false;
    }

    // Validate descriptor
    const descriptor = detections[0].descriptor;
    if (!descriptor || descriptor.length !== 128) { // Face descriptors should be 128-length arrays
      statusElement.innerHTML = 'Face detection failed. Please try again.';
      return false;
    }

    // Save to localStorage
    let faceData = JSON.parse(localStorage.getItem('faceData')) || {};
    faceData[email] = Array.from(descriptor); // Convert Float32Array to regular array
    localStorage.setItem('faceData', JSON.stringify(faceData));
    
    statusElement.innerHTML = 'Face registered successfully!';
    return true;
  } catch (error) {
    console.error('Error registering face:', error);
    statusElement.innerHTML = 'Error registering face. Please try again.';
    return false;
  }
}

// Verify face for attendance
async function verifyFace(email) {
  const video = document.getElementById('verify-video');
  const statusElement = document.getElementById('face-verify-status');
  
  statusElement.innerHTML = '<div class="spinner"></div> Verifying face...';
  
  try {
    // Load registered descriptor
    const faceData = JSON.parse(localStorage.getItem('faceData')) || {};
    const registeredDescriptor = faceData[email];
    
    if (!registeredDescriptor || !Array.isArray(registeredDescriptor)) {
      throw new Error("No registered face data found. Please register first.");
    }

    // Detect current face
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    if (detections.length === 0) {
      throw new Error("No face detected. Please position your face in the frame.");
    }
    
    if (detections.length > 1) {
      throw new Error("Multiple faces detected. Please ensure only your face is visible.");
    }

    const currentDescriptor = detections[0].descriptor;
    
    // Validate descriptors
    if (!currentDescriptor || currentDescriptor.length !== 128) {
      throw new Error("Face detection failed. Please try again.");
    }

    if (registeredDescriptor.length !== currentDescriptor.length) {
      throw new Error("Face data mismatch. Please re-register your face.");
    }

    // Compare descriptors
    const distance = faceapi.euclideanDistance(
      new Float32Array(registeredDescriptor), // Convert back to Float32Array
      currentDescriptor
    );
    
    const threshold = 0.55;
    if (distance > threshold) {
      throw new Error(`Verification failed (score: ${(1-distance).toFixed(2)}). Please try again.`);
    }
    
    return true;
  } catch (error) {
    console.error('Verification error:', error);
    statusElement.innerHTML = error.message;
    return false;
  }
}
// Show face registration modal
async function showFaceRegistrationModal(email) {
  const modal = document.getElementById('face-reg-modal');
  const statusElement = document.getElementById('face-reg-status');
  
  // Clear previous status
  statusElement.innerHTML = '';
  modal.style.display = 'block';
  
  try {
    // Load models if not already loaded
    if (!faceapiLoaded) {
      statusElement.textContent = 'Loading face recognition models...';
      const modelsLoaded = await loadFaceAPIModels();
      if (!modelsLoaded) {
        modal.style.display = 'none';
        return false;
      }
    }
    
    // Start video stream
    const videoStarted = await startVideo('register');
    if (!videoStarted) {
      modal.style.display = 'none';
      return false;
    }
    
    return new Promise((resolve) => {
      document.getElementById('register-face-btn').onclick = async () => {
        const success = await registerFace(email);
        if (success) {
          setTimeout(() => {
            modal.style.display = 'none';
            if (videoStream) {
              videoStream.getTracks().forEach(track => track.stop());
            }
            resolve(true);
          }, 1500);
        } else {
          resolve(false);
        }
      };
      
      document.querySelector('.close-modal').onclick = () => {
        modal.style.display = 'none';
        if (videoStream) {
          videoStream.getTracks().forEach(track => track.stop());
        }
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Error in face registration modal:', error);
    modal.style.display = 'none';
    return false;
  }
}

// Show face verification modal
async function showFaceVerificationModal(email) {
  const modal = document.getElementById('face-verify-modal');
  modal.style.display = 'block';
  
  // Start video stream
  const videoStarted = await startVideo('verify');
  if (!videoStarted) {
    modal.style.display = 'none';
    return false;
  }
  
  // Wait for models to load if not already loaded
  if (!faceapiLoaded) {
    document.getElementById('face-verify-status').textContent = 'Loading face recognition models...';
    await loadFaceAPIModels();
    document.getElementById('face-verify-status').textContent = '';
  }
  
  return new Promise((resolve) => {
    // Handle verify face button click
    document.getElementById('verify-face-btn').onclick = async () => {
      const success = await verifyFace(email);
      if (success) {
        setTimeout(() => {
          modal.style.display = 'none';
          if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
          }
          resolve(true);
        }, 1500);
      } else {
        resolve(false);
      }
    };
    
    // Handle modal close
    document.querySelector('.close-verify-modal').onclick = () => {
      modal.style.display = 'none';
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      resolve(false);
    };
  });
}

// Helper function to get user-specific attendance key
function getAttendanceKey(email) {
  return `attendanceData_${email}`;
}

// Initialize admin account if not exists
function initializeAdminAccount() {
  let users = JSON.parse(localStorage.getItem("users")) || [];
  const adminExists = users.some(user => user.email === "admin@ksr.com" && user.role === "admin");
  
  if (!adminExists) {
    users.push({
      email: "admin@ksr.com",
      password: "Admin@123",
      role: "admin"
    });
    localStorage.setItem("users", JSON.stringify(users));
  }
}

// **Handle Registration**
async function registerUser(event) {
  event.preventDefault();
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;
  const role = document.getElementById("user-role").value;
  const errorMessage = document.getElementById("error-message");

  // Clear previous error messages
  errorMessage.style.display = "none";
  errorMessage.textContent = "";

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errorMessage.textContent = "Please enter a valid email address.";
    errorMessage.style.display = "block";
    return;
  }

  // Password validation
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    errorMessage.textContent =
      "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.";
    errorMessage.style.display = "block";
    return;
  }

  // Role validation
  if (!role) {
    errorMessage.textContent = "Please select a role.";
    errorMessage.style.display = "block";
    return;
  }

  // Check if user already exists
  let users = JSON.parse(localStorage.getItem("users")) || [];
  if (users.find((user) => user.email === email)) {
    errorMessage.textContent = "User already exists. Please login.";
    errorMessage.style.display = "block";
    return;
  }

  // For students, require face registration
  if (role === "student") {
    try {
      const faceRegistered = await showFaceRegistrationModal(email);
      if (!faceRegistered) {
        errorMessage.textContent = "Face registration is required for students.";
        errorMessage.style.display = "block";
        return;
      }
    } catch (error) {
      console.error('Error in face registration:', error);
      errorMessage.textContent = "Error during face registration. Please try again.";
      errorMessage.style.display = "block";
      return;
    }
  }

  // Save user data
  users = JSON.parse(localStorage.getItem("users")) || [];
  users.push({ email, password, role });
  localStorage.setItem("users", JSON.stringify(users));
  
  // Initialize empty attendance data for new student users
  if (role === "student") {
    localStorage.setItem(getAttendanceKey(email), JSON.stringify([]));
  }
  
  alert("Registration successful! Please login.");
  showLogin(); // This will navigate to the login form
}
// **Handle Login**
function loginUser(event) {
  event.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  let users = JSON.parse(localStorage.getItem("users")) || [];
  const user = users.find((user) => user.email === email && user.password === password);
  
  if (user) {
    alert("Login successful!");
    localStorage.setItem("loggedInUser", JSON.stringify(user)); // Store the logged-in user's data
    
    if (user.role === "admin") {
      showAdminDashboard();
    } else {
      showAttendanceForm();
      getUserLocation();
      showAttendanceData();
    }
  } else {
    alert("Invalid email or password.");
  }
}

// **Logout**
function logout() {
  localStorage.removeItem("loggedInUser");
  alert("You have been logged out.");
  location.reload();
}

// **Show Forms**
function showLogin() {
  document.getElementById("register-form").style.display = "none";
  document.getElementById("login-form").style.display = "block";
  document.getElementById("attendance-form").style.display = "none";
  document.getElementById("attendance-data").style.display = "none";
  document.getElementById("forgot-password-form").style.display = "none";
  document.getElementById("reset-password-form").style.display = "none";
  document.getElementById("admin-dashboard").style.display = "none";
}

function showRegister() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "block";
  document.getElementById("attendance-form").style.display = "none";
  document.getElementById("attendance-data").style.display = "none";
  document.getElementById("forgot-password-form").style.display = "none";
  document.getElementById("reset-password-form").style.display = "none";
  document.getElementById("admin-dashboard").style.display = "none";
}

function showAttendanceForm() {
  document.getElementById("register-form").style.display = "none";
  document.getElementById("login-form").style.display = "none";
  document.getElementById("attendance-form").style.display = "block";
  document.getElementById("attendance-data").style.display = "block";
  document.getElementById("forgot-password-form").style.display = "none";
  document.getElementById("reset-password-form").style.display = "none";
  document.getElementById("admin-dashboard").style.display = "none";
}

function showForgotPassword() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "none";
  document.getElementById("forgot-password-form").style.display = "block";
  document.getElementById("reset-password-form").style.display = "none";
  document.getElementById("admin-dashboard").style.display = "none";
}

function showResetPassword(email) {
  document.getElementById("forgot-password-form").style.display = "none";
  document.getElementById("reset-password-form").style.display = "block";
  document.getElementById("reset-email").value = email;
}

function showAdminDashboard() {
  document.getElementById("register-form").style.display = "none";
  document.getElementById("login-form").style.display = "none";
  document.getElementById("attendance-form").style.display = "none";
  document.getElementById("attendance-data").style.display = "none";
  document.getElementById("forgot-password-form").style.display = "none";
  document.getElementById("reset-password-form").style.display = "none";
  document.getElementById("admin-dashboard").style.display = "block";
  loadAllAttendanceData();
}

// **Handle Forgot Password Submission**
function handleForgotPassword(event) {
  event.preventDefault();
  const email = document.getElementById("forgot-email").value;
  const users = JSON.parse(localStorage.getItem("users")) || [];
  
  if (users.find(user => user.email === email)) {
    showResetPassword(email);
  } else {
    alert("No account found with this email. Please register.");
    showRegister();
  }
}

// **Handle Reset Password Submission**
function handleResetPassword(event) {
  event.preventDefault();
  const email = document.getElementById("reset-email").value;
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const errorMessage = document.getElementById("reset-error-message");
  
  // Clear previous error messages
  errorMessage.style.display = "none";
  errorMessage.textContent = "";
  
  // Password validation
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    errorMessage.textContent = "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.";
    errorMessage.style.display = "block";
    return;
  }
  
  if (newPassword !== confirmPassword) {
    errorMessage.textContent = "Passwords do not match.";
    errorMessage.style.display = "block";
    return;
  }
  
  // Update password in local storage
  let users = JSON.parse(localStorage.getItem("users")) || [];
  const userIndex = users.findIndex(user => user.email === email);
  
  if (userIndex !== -1) {
    users[userIndex].password = newPassword;
    localStorage.setItem("users", JSON.stringify(users));
    alert("Password updated successfully!");
    showLogin();
  } else {
    alert("User not found. Please register.");
    showRegister();
  }
}

// **Get User Location**
function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationStatus = document.getElementById("location-status");

        // Update location text
        locationStatus.innerText = `Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

        // Check if user is inside the geofence
        if (isWithinAnyGeofence(latitude, longitude)) {
          locationStatus.innerText += " (Within Geofence)";
          locationStatus.style.color = "green";
          markAttendanceAutomatically();
        } else {
          locationStatus.innerText += " (Outside Geofence)";
          locationStatus.style.color = "red";
          markAbsentIfLeft();
        }
      },
      (error) => {
        alert("Error getting location: " + error.message);
      }
    );
  } else {
    alert("Geolocation is not supported by this browser.");
  }
}

// **Check if User is Inside a Geofence**
function isWithinAnyGeofence(userLat, userLng) {
  return geoFences.some((geoFence) => {
    const distance = getDistanceFromLatLonInMeters(
      userLat,
      userLng,
      geoFence.latitude,
      geoFence.longitude
    );
    return distance <= geoFence.radius;
  });
}

// **Calculate Distance Between Two Coordinates (Haversine Formula)**
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// **Convert Degrees to Radians**
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Function to fetch current time from WorldTimeAPI
async function getInternetTime() {
  try {
    // Try primary API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch("https://worldtimeapi.org/api/ip", {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`API responded with ${response.status}`);
    
    const data = await response.json();
    return data.utc_datetime;
  } catch (error) {
    console.warn("Failed to fetch internet time:", error);
    
    // Secondary fallback API
    try {
      const fallbackResponse = await fetch("https://time.akamai.com/", {
        signal: AbortSignal.timeout(2000)
      });
      const timestamp = parseInt(await fallbackResponse.text()) * 1000;
      return new Date(timestamp).toISOString();
    } catch (fallbackError) {
      console.warn("Fallback time API failed:", fallbackError);
      return new Date().toISOString();
    }
  }
}

// **Mark Attendance Automatically**
async function markAttendanceAutomatically() {
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!loggedInUser || loggedInUser.role !== "student") return;
  
  const attendanceKey = getAttendanceKey(loggedInUser.email);
  let attendanceData = JSON.parse(localStorage.getItem(attendanceKey)) || [];
  const now = new Date(await getInternetTime());
  const today = now.toISOString().split('T')[0]; // Get just the date part
  
  // Find today's records
  const todaysRecords = attendanceData.filter(record => {
    const recordDate = new Date(record.date).toISOString().split('T')[0];
    return recordDate === today;
  });
  
  const lastRecord = todaysRecords.length > 0 ? todaysRecords[todaysRecords.length - 1] : null;

  // If last record is "Present", don't mark again unless they've been "Out"
  if (lastRecord && lastRecord.status === "Present") {
    console.log("Already marked present today");
    return;
  }

  // Verify face before marking attendance
  const faceVerified = await showFaceVerificationModal(loggedInUser.email);
  if (!faceVerified) {
    alert("Face verification failed. Attendance not marked.");
    return;
  }

  // If verification passed, mark the attendance
  attendanceData.push({ date: now.toISOString(), status: "Present" });
  localStorage.setItem(attendanceKey, JSON.stringify(attendanceData));
  showAttendanceData();
  alert("Attendance marked successfully!");
}

// **Mark Absent if User Leaves Geofence**
async function markAbsentIfLeft() {
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!loggedInUser || loggedInUser.role !== "student") return;
  
  const attendanceKey = getAttendanceKey(loggedInUser.email);
  let attendanceData = JSON.parse(localStorage.getItem(attendanceKey)) || [];
  const now = new Date(await getInternetTime());
  const today = now.toISOString().split('T')[0]; // Get just the date part
  
  // Find today's records
  const todaysRecords = attendanceData.filter(record => {
    const recordDate = new Date(record.date).toISOString().split('T')[0];
    return recordDate === today;
  });
  
  const lastRecord = todaysRecords.length > 0 ? todaysRecords[todaysRecords.length - 1] : null;

  if (lastRecord && lastRecord.status === "Present") {
    attendanceData.push({ date: now.toISOString(), status: "Out" });
    localStorage.setItem(attendanceKey, JSON.stringify(attendanceData));
    showAttendanceData();
  }
}

async function markAttendance() {
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!loggedInUser || loggedInUser.role !== "student") return;
  
  const attendanceKey = getAttendanceKey(loggedInUser.email);
  let attendanceData = JSON.parse(localStorage.getItem(attendanceKey)) || [];
  const now = new Date(await getInternetTime());
  const today = now.toISOString().split('T')[0]; // Get just the date part
  
  // Find today's records
  const todaysRecords = attendanceData.filter(record => {
    const recordDate = new Date(record.date).toISOString().split('T')[0];
    return recordDate === today;
  });
  
  const lastRecord = todaysRecords.length > 0 ? todaysRecords[todaysRecords.length - 1] : null;

  // If last record is "Present", don't mark again unless they've been "Out"
  if (lastRecord && lastRecord.status === "Present") {
    alert("Your attendance has already been marked as Present today.");
    return;
  }

  // Verify face before marking attendance
  const faceVerified = await showFaceVerificationModal(loggedInUser.email);
  if (!faceVerified) {
    alert("Face verification failed. Attendance not marked.");
    return;
  }

  // If verification passed, mark the attendance
  attendanceData.push({ date: now.toISOString(), status: "Present" });
  localStorage.setItem(attendanceKey, JSON.stringify(attendanceData));
  showAttendanceData();
  alert("Attendance marked successfully!");
}

// **Show Attendance Data**
function showAttendanceData() {
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!loggedInUser || loggedInUser.role !== "student") return;
  
  const attendanceKey = getAttendanceKey(loggedInUser.email);
  const attendanceData = JSON.parse(localStorage.getItem(attendanceKey)) || [];
  const tableBody = document.getElementById("attendance-table").getElementsByTagName("tbody")[0];
  tableBody.innerHTML = ""; // Clear existing records

  // Sort attendance data in descending order by date
  attendanceData.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Insert new records with serial numbers
  attendanceData.forEach((record, index) => {
    const row = tableBody.insertRow();
    const cell1 = row.insertCell(0); // Serial Number
    const cell2 = row.insertCell(1); // Date and Time
    const cell3 = row.insertCell(2); // Status

    cell1.textContent = index + 1; // Serial Number (starting from 1)
    cell2.textContent = new Date(record.date).toLocaleString(); // Date and Time
    cell3.textContent = record.status; // Status
  });

  document.getElementById("attendance-data").style.display = "block";
}

// **Load All Attendance Data for Admin**
function loadAllAttendanceData() {
  const adminTableBody = document.getElementById("admin-attendance-table").getElementsByTagName("tbody")[0];
  adminTableBody.innerHTML = ""; // Clear existing records

  // Make table header sticky
  const adminTable = document.getElementById("admin-attendance-table");
  const adminTableHead = adminTable.getElementsByTagName("thead")[0];
  adminTableHead.style.position = "sticky";
  adminTableHead.style.top = "0";
  adminTableHead.style.zIndex = "10";
  adminTableHead.style.backgroundColor = "#fe9901";

  // Get all keys from localStorage
  const allKeys = Object.keys(localStorage);
  let allAttendanceData = [];
  let serialNumber = 1;

  // Process each key to find attendance data
  allKeys.forEach(key => {
    if (key.startsWith("attendanceData_")) {
      const email = key.replace("attendanceData_", "");
      const attendanceRecords = JSON.parse(localStorage.getItem(key)) || [];
      
      attendanceRecords.forEach(record => {
        allAttendanceData.push({
          serialNumber: serialNumber++,
          email,
          date: record.date,
          status: record.status
        });
      });
    }
  });

  // Sort all attendance data by date (newest first)
  allAttendanceData.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Reset serial numbers after sorting
  allAttendanceData.forEach((record, index) => {
    record.serialNumber = index + 1;
  });

  // Populate the admin table
  allAttendanceData.forEach(record => {
    const row = adminTableBody.insertRow();
    const cell1 = row.insertCell(0); // Serial Number
    const cell2 = row.insertCell(1); // Student Email
    const cell3 = row.insertCell(2); // Date and Time
    const cell4 = row.insertCell(3); // Status

    cell1.textContent = record.serialNumber;
    cell2.textContent = record.email;
    cell3.textContent = new Date(record.date).toLocaleString();
    cell4.textContent = record.status;
  });
}

// **Export to PDF**
function exportToPDF() {
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!loggedInUser) return;
  
  if (typeof window.jspdf === "undefined") {
    console.error("jsPDF library not loaded!");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Set the title with user email
  doc.setFontSize(18);
  doc.text(`Attendance Records for ${loggedInUser.email}`, 10, 10);

  // Get the table data
  const table = document.getElementById("attendance-table");
  if (!table) {
    console.error("Table not found!");
    return;
  }

  const rows = table.rows;
  const data = [];

  // Extract data from the table
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowData = [];
    for (let j = 0; j < row.cells.length; j++) {
      rowData.push(row.cells[j].innerText);
    }
    data.push(rowData);
  }

  // Add the table to the PDF
  doc.autoTable({
    head: [data[0]], // Header row
    body: data.slice(1), // Data rows
    startY: 20, // Start position
  });

  // Save the PDF with user-specific filename
  doc.save(`attendance_records_${loggedInUser.email}.pdf`);
}

// **Export All Attendance to PDF (Admin)**
function exportAllToPDF() {
  if (typeof window.jspdf === "undefined") {
    console.error("jsPDF library not loaded!");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Set the title
  doc.setFontSize(18);
  doc.text("All Student Attendance Records", 10, 10);

  // Get the table data
  const table = document.getElementById("admin-attendance-table");
  if (!table) {
    console.error("Table not found!");
    return;
  }

  const rows = table.rows;
  const data = [];

  // Extract data from the table
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowData = [];
    for (let j = 0; j < row.cells.length; j++) {
      rowData.push(row.cells[j].innerText);
    }
    data.push(rowData);
  }

  // Add the table to the PDF
  doc.autoTable({
    head: [data[0]], // Header row
    body: data.slice(1), // Data rows
    startY: 20, // Start position
  });

  // Save the PDF
  doc.save("all_attendance_records.pdf");
}

// **Password Visibility Toggles**
function setupPasswordToggles() {
  // Toggle password visibility for registration form
  const toggleRegPassword = document.getElementById("toggle-reg-password");
  const regPasswordInput = document.getElementById("reg-password");
  
  if (toggleRegPassword && regPasswordInput) {
    toggleRegPassword.addEventListener("click", () => {
      if (regPasswordInput.type === "password") {
        regPasswordInput.type = "text";
        toggleRegPassword.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        regPasswordInput.type = "password";
        toggleRegPassword.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  }

  // Toggle password visibility for login form
  const togglePassword = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("password");
  
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        togglePassword.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        passwordInput.type = "password";
        togglePassword.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  }
  
  // Toggle new password visibility
  const toggleNewPassword = document.getElementById("toggle-new-password");
  const newPasswordInput = document.getElementById("new-password");
  
  if (toggleNewPassword && newPasswordInput) {
    toggleNewPassword.addEventListener("click", () => {
      if (newPasswordInput.type === "password") {
        newPasswordInput.type = "text";
        toggleNewPassword.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        newPasswordInput.type = "password";
        toggleNewPassword.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  }
  
  // Toggle confirm password visibility
  const toggleConfirmPassword = document.getElementById("toggle-confirm-password");
  const confirmPasswordInput = document.getElementById("confirm-password");
  
  if (toggleConfirmPassword && confirmPasswordInput) {
    toggleConfirmPassword.addEventListener("click", () => {
      if (confirmPasswordInput.type === "password") {
        confirmPasswordInput.type = "text";
        toggleConfirmPassword.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        confirmPasswordInput.type = "password";
        toggleConfirmPassword.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  }
}

// **Initialize App**
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM fully loaded and parsed");

  // Initialize admin account
  initializeAdminAccount();

  // Attach event listeners
  document.getElementById("userRegisterForm").addEventListener("submit", registerUser);
  document.getElementById("userLoginForm").addEventListener("submit", loginUser);
  document.getElementById("mark-attendance-btn").addEventListener("click", markAttendance);
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("admin-logout-btn").addEventListener("click", logout);
  document.getElementById("export-pdf-btn").addEventListener("click", exportToPDF);
  document.getElementById("forgotPasswordForm").addEventListener("submit", handleForgotPassword);
  document.getElementById("resetPasswordForm").addEventListener("submit", handleResetPassword);
  document.getElementById("export-all-pdf-btn").addEventListener("click", exportAllToPDF);

  // Setup password toggles
  setupPasswordToggles();

  // Check if the user is already logged in
  const loggedInUser = localStorage.getItem("loggedInUser");
  if (loggedInUser) {
    const user = JSON.parse(loggedInUser);
    if (user.role === "admin") {
      showAdminDashboard();
    } else {
      showAttendanceForm();
      getUserLocation();
      showAttendanceData();
    }
  }
});