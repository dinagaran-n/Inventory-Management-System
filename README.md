# 📦 Inventory Management System

A scalable and containerized Inventory Management System built using **React**, **Golang**, and **Apache Cassandra**, orchestrated with **Docker**.
This project enables efficient product tracking, stock management, and real-time updates.

---

## 🚀 Tech Stack

* **Frontend:** React.js
* **Backend:** Golang (Go)
* **Database:** Apache Cassandra
* **Containerization:** Docker & Docker Compose

---

## 🧩 Features

* 📦 Add, update, and delete inventory items
* 📊 Real-time stock tracking
* ⚠️ Low stock alerts
* 🔍 Search and filter products
* 🧾 REST API for inventory operations
* 🐳 Fully containerized setup

---

## 🏗️ System Architecture

```
React Frontend → Go Backend API → Cassandra Database
                ↓
             Docker
```

---

## 📁 Project Structure

```
inventory-management/
│
├── frontend/        # React application
├── backend/         # Golang API server
├── database/        # Cassandra configs / schema
├── docker-compose.yml
└── README.md
```

---

## ⚙️ Installation & Setup

### 🔹 Prerequisites

* Docker installed
* Docker Compose installed

---

### 🔹 Run the Project

```bash
git clone https://github.com/your-username/inventory-management.git
cd inventory-management

docker-compose up --build
```

---

### 🔹 Access the Application

* Frontend: http://localhost:3000
* Backend API: http://localhost:8080

---

## 📡 API Endpoints

| Method | Endpoint      | Description      |
| ------ | ------------- | ---------------- |
| GET    | /products     | Get all products |
| POST   | /products     | Add new product  |
| PUT    | /products/:id | Update product   |
| DELETE | /products/:id | Delete product   |

---

## 🗄️ Database Schema (Cassandra)

Example table:

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    name TEXT,
    quantity INT,
    price FLOAT,
    category TEXT
);
```

---

## 🐳 Docker Setup

The project uses Docker Compose to manage:

* React frontend container
* Go backend container
* Cassandra database container

To stop containers:

```bash
docker-compose down
```
---

## 🧠 Future Improvements

* 🔐 Authentication & Role-based access
* 📈 Advanced analytics dashboard
* 📦 Barcode/QR code integration
* ☁️ Cloud deployment (AWS/GCP)

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## 📜 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Dinagaran N**
Passionate Full-Stack Developer | AI Enthusiast
