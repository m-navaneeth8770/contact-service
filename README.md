# Bitespeed Backend Task: Identity Reconciliation

A production-ready web service that identifies and consolidates customer identities across multiple purchases — even when customers use different email addresses or phone numbers each time.

---

## 🌐 Hosted Endpoint

```
https://contact-service-j19d.onrender.com
```

> ⚠️ **Important:** This service is hosted on Render.com's free tier. If the service is idle, the **first request may take 30–60 seconds** to wake up. Please wait and retry — all subsequent requests will be instant.

---

## 📌 The `/identify` Endpoint

```
POST https://contact-service-j19d.onrender.com/api/identify
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "string (optional)",
  "phoneNumber": number (optional)
}
```
> At least one of `email` or `phoneNumber` must be provided.

**Response `200 OK`:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["123456", "717171"],
    "secondaryContactIds": [2, 3]
  }
}
```

---

## 🧪 Test Cases for Evaluators

You can test using **Postman**, **Insomnia**, **Thunder Client**, or **curl**.

---

### Test 1 — Create a New Customer (New Primary Contact)

When no existing contact matches, a new primary contact is created.

**Request:**
```
POST https://contact-service-j19d.onrender.com/api/identify
```
```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": 123456
}
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

**curl:**
```bash
curl -X POST https://contact-service-j19d.onrender.com/api/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": 123456}'
```

---

### Test 2 — Returning Customer with New Email (Creates Secondary Contact)

Same phone number as an existing contact, but a new email → creates a secondary contact linked to the primary.

**Request:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": 123456
}
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

**curl:**
```bash
curl -X POST https://contact-service-j19d.onrender.com/api/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "mcfly@hillvalley.edu", "phoneNumber": 123456}'
```

---

### Test 3 — Query with Only Email (No New Info, Returns Consolidated View)

Sending just an existing email returns the full consolidated identity without creating anything new.

**Request:**
```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": null
}
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

**curl:**
```bash
curl -X POST https://contact-service-j19d.onrender.com/api/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": null}'
```

---

### Test 4 — Two Separate Primaries Get Merged (The Key Edge Case)

First, create two completely separate primary contacts:

**Step 1 — Create first primary (george):**
```json
{
  "email": "george@hillvalley.edu",
  "phoneNumber": 919191
}
```

**Step 2 — Create second primary (biff):**
```json
{
  "email": "biffsucks@hillvalley.edu",
  "phoneNumber": 717171
}
```

**Step 3 — Send a request linking both (george's email + biff's phone):**
```json
{
  "email": "george@hillvalley.edu",
  "phoneNumber": 717171
}
```

**Expected Response** — george (older) stays primary, biff gets demoted to secondary:
```json
{
  "contact": {
    "primaryContatctId": 3,
    "emails": ["george@hillvalley.edu", "biffsucks@hillvalley.edu"],
    "phoneNumbers": ["919191", "717171"],
    "secondaryContactIds": [4]
  }
}
```

**curl for Step 3:**
```bash
curl -X POST https://contact-service-j19d.onrender.com/api/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "george@hillvalley.edu", "phoneNumber": 717171}'
```

---

### Test 5 — Only Phone Number Provided

**Request:**
```json
{
  "phoneNumber": 123456
}
```

**Expected Response:** Returns the full consolidated contact that has this phone number.

**curl:**
```bash
curl -X POST https://contact-service-j19d.onrender.com/api/identify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": 123456}'
```

---

### Test 6 — Validation: Both Fields Missing (Returns 400)

**Request:**
```json
{}
```

**Expected Response `400 Bad Request`:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "",
      "message": "At least one of email or phoneNumber must be provided"
    }
  ]
}
```

**curl:**
```bash
curl -X POST https://contact-service-j19d.onrender.com/api/identify \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### Test 7 — Validation: Invalid Email Format (Returns 400)

**Request:**
```json
{
  "email": "not-a-valid-email"
}
```

**Expected Response `400 Bad Request`:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

### Test 8 — Health Check

```
GET https://contact-service-j19d.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "db": "connected"
}
```

**curl:**
```bash
curl https://contact-service-j19d.onrender.com/health
```

---

## 🏗 How the Identity Resolution Works

The `/identify` endpoint handles three scenarios on every request:

**Scenario 1 — No existing match:**
Creates a new `Contact` row with `linkPrecedence: "primary"` and returns it with empty `secondaryContactIds`.

**Scenario 2 — Match found, new information present:**
If the incoming request shares an email or phone with an existing contact but contains something new (e.g. a new email for a known phone), a new `Contact` row is created with `linkPrecedence: "secondary"` and `linkedId` pointing to the oldest primary.

**Scenario 3 — Two separate primaries linked by incoming request:**
If the email matches one existing primary and the phone matches a different existing primary, the two are **merged**. The older primary stays `primary`. The newer primary is updated: `linkPrecedence → "secondary"`, `linkedId → older primary's id`. All of the demoted primary's secondaries are re-linked to the true primary.

---

## 🛠 Tech Stack

- **Runtime:** Node.js 20 + TypeScript
- **Framework:** Express.js
- **ORM:** Prisma 5
- **Database:** PostgreSQL (hosted on Render.com)
- **Validation:** Zod
- **Logging:** Morgan
- **Hosting:** Render.com
- **CI/CD:** GitHub Actions

---

## 💻 Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/m-navaneeth8770/contact-service.git
cd contact-service

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 4. Run migrations
npx prisma migrate dev

# 5. Start dev server
npm run dev
```

Server starts at `http://localhost:3000`

### Environment Variables

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/contactdb"
PORT=3000
NODE_ENV=development
```

---

## 📁 Project Structure

```
contact-service/
├── .github/workflows/main.yml        # CI/CD pipeline
├── prisma/
│   ├── schema.prisma                 # Contact table schema
│   └── migrations/                   # SQL migration history
├── src/
│   ├── controllers/
│   │   └── identifyController.ts     # Core identity resolution logic
│   ├── lib/
│   │   └── prisma.ts                 # Database client
│   ├── middleware/
│   │   ├── errorHandler.ts           # Global error handler
│   │   └── validate.ts               # Request validation middleware
│   ├── routes/
│   │   └── contact.ts                # Route definitions
│   ├── schemas/
│   │   └── identifySchema.ts         # Zod validation schema
│   └── index.ts                      # Express entry point
├── Dockerfile
├── .env.example
└── README.md
```

---

## 🚀 CI/CD

Every push to `main` triggers a GitHub Actions pipeline that:
1. Spins up a PostgreSQL service container
2. Installs dependencies
3. Generates Prisma client
4. Runs database migrations
5. Compiles TypeScript

View pipeline: `https://github.com/m-navaneeth8770/contact-service/actions`