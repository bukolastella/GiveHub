# GiveHub Backend

**GiveHub** is a donation management system that allows users to donate to various cases created by admins. This backend project handles user authentication, case management, donations, and payment integration.

---

## 🚀 Features

### 🧑‍💻 User/Auth Flow

* Signup
* Login
* Forgot Password
* Change Password
* Profile Management
* Delete Account
* Auth with Google/Facebook

---

### 📦 Case Management

* Create a case (name, description, video or up to 3 images, price, start and end date)
* CRUD operations on cases

---

### 💸 Donations

* Date, user, case, amount, gateway, status
* Track donations timeline (status updates, pending, successful, etc.)
* Payment integration with **Paystack** and **Stripe** (support for recurring payments and card saving TBD)
* View a user’s donations (paginated, searchable by campaign, exportable to CSV and PDF)
* Filter campaigns by status
* Pay using Stripe or Paystack

---

## 🔧 Libraries

* TypeScript
* MongoDB
* Mongoose

---

## 💡 Notes

* Admins create cases for users to donate to.
* Timeline/status management for donations still needs enhancement.
* Recurring payments/card saving under consideration.

---

## 🗂️ Project Setup

Clone this repo and install dependencies:

```bash
git clone https://github.com/your-org/givehub-backend.git  
cd givehub-backend  
npm install  
```
