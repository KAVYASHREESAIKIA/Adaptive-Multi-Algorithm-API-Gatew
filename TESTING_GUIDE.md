# 🧪 Adaptive API Gateway: Complete Testing Guide

This guide provides a step-by-step walkthrough to test the **Adaptive Multi-Algorithm API Gateway** as both an **Admin** and an **End User**.

---

## 🚀 Step 0: Starting the Application
If you haven't already, start the entire stack using Docker Compose:
```bash
docker-compose up -d --build
```
*Wait for all containers (Postgres, Redis, Gateway-1, Gateway-2, Backend, Dashboard) to show as healthy.*

---

## 🛠 Phase 1: Testing as an ADMINISTRATOR
The Administrator manages the gateway logic and monitors system health.

### 1️⃣ Register & Initialize Admin Account
1. Open your browser to `http://localhost:5173`.
2. On the login screen, click **"Request Registration"** at the bottom.
3. Fill in the details:
   - **Email:** `admin@gmail.com`
   - **Password:** `AdminPass123`
   - **Role:** Select **"System Admin"**.
4. Click **Initialize Account**.
5. Switch back to the **Login** screen and log in.

### 2️⃣ Monitor Live Telemetry
- Navigate to the **"Live Monitoring"** tab.
- You should see cards for **Active Algorithm**, **Circuit Status**, **Total Requests**, and **Blocked Users**.
- Observe the **Traffic Telemetry** chart (it will update as you perform tests in the next phase).

### 3️⃣ Switch Rate-Limiting Algorithms
- In the **Strategy Engine** section, click on different algorithms (e.g., **Sliding Window**, **Fixed Window**).
- **Verify:** The "Active Algorithm" card at the top should change instantly.
- **Behind the scenes:** This change is propagated across all gateway instances via Redis.

---

## 👤 Phase 2: Testing as an END USER
The End User consumes the API and is subject to rate limiting and behavior analysis.

### 1️⃣ Register a Free Tier User
1. Open `http://localhost:5173` in a **new browser window** (or logout from admin).
2. Register a new user:
   - **Email:** `user@gmail.com`
   - **Password:** `UserPass123`
   - **Role:** Select **"Free Tier"**.
3. Log in as this user.

### 2️⃣ Access the Protected API
- Once logged in, you will see your **API Key** in the dashboard.
- Use a tool like **Postman** or the terminal to call the API through the gateway:
  ```powershell
  # Using PowerShell
  $response = Invoke-RestMethod -Uri "http://localhost:3001/api/data" `
    -Method Get `
    -Headers @{ 
        "Authorization" = "Bearer YOUR_ACCESS_TOKEN"; 
        "x-api-key" = "YOUR_API_KEY" 
    }
  $response
  ```
- **Verify:** You should receive a `200 OK` response with protected data.

### 3️⃣ Test Rate Limit Enforcement (Stress Test)
1. As the free user, send requests rapidly to exceed the 100/hr limit.
2. In your terminal, run:
   ```powershell
   for ($i=1; $i -le 110; $i++) { 
     Invoke-RestMethod -Uri "http://localhost:3001/api/data" -Method Get -Headers @{ "Authorization"="Bearer YOUR_TOKEN"; "x-api-key"="YOUR_KEY" }
   }
   ```
- **Verify:** After 100 requests, the gateway should return `429 Too Many Requests`.
- **Admin View:** If you log back in as admin, you will see the **"Blocked Users"** count increase.

---

## ⚡ Phase 3: Reliability & Circuit Breaker Testing
Verify that the system handles backend failures without crashing.

1. **Stop the Backend Service:**
   ```bash
   docker stop gateway-backend
   ```
2. **Trigger the Circuit Breaker:**
   Send 5 requests to the API. Since the backend is down, these will fail.
3. **Verify "Fail-Fast":**
   - Check the Admin Dashboard. The **Circuit Status** should change to **OPEN** (Red).
   - Any subsequent requests will be rejected **instantly** by the gateway, protecting the system from waiting on timeouts.
4. **Recovery:**
   - Start the backend: `docker start gateway-backend`.
   - After 60 seconds (reset timeout), the circuit will enter **HALF_OPEN**.
   - Send one request; if it succeeds, the circuit returns to **CLOSED** (Green).

---
