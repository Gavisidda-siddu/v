// Authentication & API integration for Healthcare Platform

const API_BASE = '/api';

function getAccessToken() {
    return localStorage.getItem('accessToken');
}

function getRefreshToken() {
    return localStorage.getItem('refreshToken');
}

function setTokens(access, refresh) {
    if (access) localStorage.setItem('accessToken', access);
    if (refresh) localStorage.setItem('refreshToken', refresh);
}

async function apiFetch(path, options = {}) {
    const headers = options.headers || {};
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    headers['Content-Type'] = 'application/json';
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    return response;
}

// Check if user is logged in
function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const currentUser = localStorage.getItem('currentUser');
    
    if (!isLoggedIn || !currentUser) {
        // Not logged in, redirect to signin
        window.location.href = '/signin/';
        return false;
    }
    return true;
}

// Get current user data
function getCurrentUser() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        return JSON.parse(currentUser);
    }
    return null;
}

// Get user profile data
async function getUserProfile() {
    try {
        const res = await apiFetch('/profile/');
        if (!res.ok) return null;
        return await res.json();
    } catch (_) {
        return null;
    }
}

// Save user profile
async function saveUserProfile(profileData) {
    const res = await apiFetch('/profile/', {
        method: 'PUT',
        body: JSON.stringify(profileData)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return await res.json();
}

// Logout function
async function logout() {
    const refresh = getRefreshToken();
    if (refresh) {
        try { await apiFetch('/auth/logout/', { method: 'POST', body: JSON.stringify({ refresh }) }); } catch (_) {}
    }
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/signin/';
}

// Sign up - save user to localStorage
async function signup(name, email, password, phone = '') {
    const username = name || email;
    const res = await apiFetch('/auth/signup/', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, phone })
    });
    if (res.ok) {
        return { success: true, message: 'Account created. Check email for OTP.' };
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, message: err?.detail || 'Signup failed' };
}

// Sign in - validate user credentials
async function signin(email, password) {
    const res = await apiFetch('/auth/signin/', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.access) {
        return { success: false, message: data?.message || 'Invalid credentials' };
    }
    setTokens(data.access, data.refresh);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(data.user));
    return { success: true, message: 'Login successful' };
}

async function verifyOtp(email, otp_code) {
    const res = await apiFetch('/auth/verify-otp/', {
        method: 'POST',
        body: JSON.stringify({ email, otp_code })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.access) {
        return { success: false, message: data?.message || 'OTP verification failed' };
    }
    setTokens(data.access, data.refresh);
    localStorage.setItem('isLoggedIn', 'true');
    // We may not have full user details here; fetch profile next time
    return { success: true, message: 'OTP verified' };
}

// Get medications from localStorage
async function getMedications() {
    const res = await apiFetch('/medications/');
    if (!res.ok) return [];
    return await res.json();
}

// Save medication to localStorage
async function saveMedication(medication) {
    const body = {
        name: medication.name,
        dosage: medication.dosage,
        reminder_time: medication.time || medication.reminder_time,
        notes: ''
    };
    const res = await apiFetch('/medications/', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Failed to save medication');
    return await res.json();
}

// Delete medication from localStorage
async function deleteMedication(medId) {
    await apiFetch(`/medications/${medId}/`, { method: 'DELETE' });
}

// Get appointments from localStorage
async function getAppointments() {
    const res = await apiFetch('/appointments/');
    if (!res.ok) return [];
    return await res.json();
}

// Save appointment to localStorage
async function saveAppointment(appointment) {
    const body = {
        name: appointment.name,
        age: Number(appointment.age),
        gender: appointment.gender,
        department: appointment.department,
        date: appointment.date,
        time: appointment.time
    };
    const res = await apiFetch('/appointments/', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Failed to save appointment');
    return await res.json();
}

// Delete appointment from localStorage
async function deleteAppointment(apptId) {
    await apiFetch(`/appointments/${apptId}/`, { method: 'DELETE' });
}

// Navigation HTML Generator
function getNavigationHTML() {
    return `
        <nav>
            <div class="nav-container">
                <div class="logo">HealthConnect</div>
                
                <div class="nav-links">
                    <a href="/">🏠 Home</a>
                    <a href="/appointment/">📅 Appointments</a>
                    <a href="/medication/">💊 Medications</a>
                    <a href="/faq/">❓ FAQs</a>
                    <a href="/bloodbank/">🩸 Blood Bank</a>
                    <a href="/consultation/">📹 Consultation</a>
                    <a href="/records/">📋 Records</a>
                    <a href="/chat/">💬 Chat</a>
                </div>
                
                <div class="profile-container">
                    <button class="profile-icon" id="profile-icon">👤</button>
                    <div class="profile-dropdown" id="profile-dropdown">
                        <a href="/profile/">📝 View Profile</a>
                        <button onclick="handleUploadPhoto()">📷 Upload Photo</button>
                        <button class="logout-btn">🚪 Logout</button>
                    </div>
                </div>
                
                <button class="hamburger" id="hamburger">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
            
            <div class="mobile-menu" id="mobile-menu">
                <a href="/">🏠 Home</a>
                <a href="/appointment/">📅 Appointments</a>
                <a href="/medication/">💊 Medications</a>
                <a href="/faq/">❓ FAQs</a>
                <a href="/bloodbank/">🩸 Blood Bank</a>
                <a href="/consultation/">📹 Consultation</a>
                <a href="/records/">📋 Records</a>
                <a href="/chat/">💬 Chat</a>
                <a href="/profile/">👤 Profile</a>
            </div>
        </nav>
    `;
}

// Floating Buttons HTML Generator
function getFloatingButtonsHTML() {
    return `
        <div class="floating-buttons">
            <button class="floating-btn callback-button" onclick="window.location.href='callback.html'" title="Request Callback">📞</button>
            <button class="floating-btn sos-button" onclick="window.location.href='sos.html'" title="Emergency SOS">🚨</button>
        </div>
    `;
}

// Mobile Menu Toggle
function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', function() {
            mobileMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });
    }
}

// Profile Dropdown Toggle
function initProfileDropdown() {
    const profileIcon = document.getElementById('profile-icon');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    if (profileIcon && profileDropdown) {
        profileIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!profileIcon.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('active');
            }
        });
    }
}

// Handle page navigation
document.addEventListener('DOMContentLoaded', function() {
    // Initialize mobile menu and profile dropdown
    initMobileMenu();
    initProfileDropdown();
    
    // Add click handlers for navigation if on a protected page
    const protectedPaths = ['/', '/appointment/', '/medication/', '/faq/', 
                          '/callback/', '/chatbot/', '/bloodbank/', '/consultation/',
                          '/records/', '/sos/', '/chat/', '/profile/'];
    
    const currentPath = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/';
    
    // Check if user is logged in for protected pages
    if (protectedPaths.includes(currentPath)) {
        if (!checkAuth()) {
            return; // Will redirect
        }
    }
    
    // Handle logout button clicks
    const logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    });
    
    // Add upload photo handler
    window.handleUploadPhoto = function() {
        alert('Photo upload feature will be available soon!');
    };
    
    // Initialize chatbot toggle
    const chatbotToggle = document.getElementById('chatbot-toggle');
    const chatbot = document.getElementById('chatbot');
    const chatbotClose = document.getElementById('chatbot-close');
    
    if (chatbotToggle) {
        chatbotToggle.addEventListener('click', function() {
            chatbot.classList.add('active');
        });
    }
    
    if (chatbotClose) {
        chatbotClose.addEventListener('click', function() {
            chatbot.classList.remove('active');
        });
    }
    
    // Initialize accordion
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const isActive = content.classList.contains('active');
            
            // Close all accordion items
            document.querySelectorAll('.accordion-content').forEach(item => {
                item.classList.remove('active');
            });
            
            // Open clicked item if it wasn't active
            if (!isActive) {
                content.classList.add('active');
            }
        });
    });
    
    // Initialize medication form
    const medicationForm = document.getElementById('medication-form');
    if (medicationForm) {
        medicationForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const medicineName = document.getElementById('medicine-name').value;
            const dosage = document.getElementById('dosage').value;
            const time = document.getElementById('reminder-time').value;
            
            if (medicineName && dosage && time) {
                saveMedication({
                    name: medicineName,
                    dosage: dosage,
                    time: time
                });
                
                // Refresh the list
                displayMedications();
                
                // Clear form
                this.reset();
                
                // Show success message
                alert('Medication added successfully!');
            }
        });
    }
    
    // Display medications on page load
    if (currentPath === '/medication/') {
        displayMedications();
    }
    
    // Initialize SOS modal
    const sosButton = document.getElementById('sos-button');
    const sosModal = document.getElementById('sos-modal');
    const sosModalClose = document.getElementById('sos-modal-close');
    
    if (sosButton) {
        sosButton.addEventListener('click', function() {
            sosModal.classList.add('active');
        });
    }
    
    if (sosModalClose) {
        sosModalClose.addEventListener('click', function() {
            sosModal.classList.remove('active');
        });
    }
    
    // Close SOS modal on outside click
    if (sosModal) {
        sosModal.addEventListener('click', function(e) {
            if (e.target === sosModal) {
                sosModal.classList.remove('active');
            }
        });
    }
});

// Display medications
async function displayMedications() {
    const container = document.getElementById('medications-list');
    if (!container) return;
    const medications = await getMedications();
    if (!medications || medications.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No medications added yet.</p>';
        return;
    }
    container.innerHTML = medications.map(med => `
        <div class="medication-item" style="background: white; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h4 style="color: #4A90E2; margin-bottom: 0.5rem;">${med.name}</h4>
            <p style="color: #666; margin-bottom: 0.3rem;"><strong>Dosage:</strong> ${med.dosage}</p>
            <p style="color: #666; margin-bottom: 1rem;"><strong>Time:</strong> ${med.reminder_time}</p>
            <button class="btn btn-danger" onclick="deleteMedicationById(${med.id})" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;">Delete</button>
        </div>
    `).join('');
}

// Delete medication by ID
async function deleteMedicationById(id) {
    await deleteMedication(id);
    displayMedications();
}

// Display user profile
async function displayUserProfile() {
    const profile = await getUserProfile();
    if (!profile) return;
    if (document.getElementById('profile-name')) document.getElementById('profile-name').textContent = profile.user_email || '';
    if (document.getElementById('profile-email')) document.getElementById('profile-email').textContent = profile.user_email || '';
    if (document.getElementById('profile-phone')) document.getElementById('profile-phone').value = profile.phone || '';
    if (document.getElementById('profile-age')) document.getElementById('profile-age').value = profile.age || '';
    if (document.getElementById('profile-gender')) document.getElementById('profile-gender').value = profile.gender || '';
    if (document.getElementById('profile-address')) document.getElementById('profile-address').value = profile.address || '';
}

// Save profile changes
async function saveProfileChanges() {
    const profileData = {
        phone: document.getElementById('profile-phone').value,
        age: document.getElementById('profile-age').value,
        gender: document.getElementById('profile-gender').value,
        address: document.getElementById('profile-address').value
    };
    await saveUserProfile(profileData);
    alert('Profile updated successfully!');
}

