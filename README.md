# ✈️ TripMate — Group Chat & Expense Splitting for Trips

**TripMate** is a real-time trip planning and group expense manager built around a **WhatsApp Group Chat UI** + **Google Pay-inspired Expense Splitting cards**.

---

## ✨ Features

- 💬 **WhatsApp Group Chat UI**: Group chat interface for trip members with date separators, message bubbles, system event pills, and custom chat attachments.
- 💳 **Google Pay Style Expenses**: Expense cards rendered right inside the chat with visual focus on amounts, payment status, payer details, and split breakdowns.
- 📊 **Per-Person Split Tracking**: Track individual pending vs paid shares (`Yaseen ₹3,000 ✓ Paid`, `Bilal ₹3,000 ⏳ Pending`).
- ⚡ **Real-time Socket.IO Sync**: Live updates for chat messages, expenses, itinerary, bookings, tasks, polls, documents, and settlements.
- 📅 **Trip Workspace Features**:
  - **Itinerary Timeline**
  - **Bookings & Tickets**
  - **Task Lists**
  - **Group Polls**
  - **Document Vault**
  - **Settlement Balances**
- 📱 **Responsive Design**: WhatsApp Web 2-column layout on Desktop + full screen group chat on Mobile.

---

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client.
- **Backend**: Node.js, Express, TypeScript, MongoDB (Mongoose), Socket.IO Server, JWT Auth, Bcrypt.

---

## 🚀 Quick Start

### Prerequisites

- Node.js (v18+)
- MongoDB Atlas or local MongoDB instance

### Installation

1. **Clone Repository**:
   ```bash
   git clone https://github.com/yaseenysn/tripmate.git
   cd tripmate
   ```

2. **Install Dependencies**:
   ```bash
   # Install root dependencies
   npm install

   # Install client dependencies
   cd client && npm install

   # Install server dependencies
   cd ../server && npm install
   ```

3. **Environment Setup**:
   Create a `.env` file inside `server/`:
   ```env
   PORT=5000
   JWT_SECRET=your_secret_jwt_key
   MONGODB_URI=your_mongodb_connection_string
   ```

4. **Run Development Servers**:
   ```bash
   # Start Server
   cd server && npm run dev

   # Start Client
   cd client && npm run dev
   ```

5. **Seed Test Data (Optional)**:
   ```bash
   cd server && npm run seed
   ```

---

## 🔒 License

MIT License. Built for seamless trip planning and group expense management.
