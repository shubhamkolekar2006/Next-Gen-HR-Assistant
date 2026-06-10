# ⚡ Quick Start Guide

## 🚀 Run Everything in 5 Minutes

### Step 1: Backend (Terminal 1)

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt

# Create .env file with your MongoDB and API keys
# Then run:
python run.py
```

✅ Backend running on http://localhost:8000

### Step 2: Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

✅ Frontend running on http://localhost:5173

### Step 3: Test

1. Open browser: http://localhost:5173
2. Click chat bubble (bottom right)
3. Try: "show all employees"
4. Check dashboard for metrics

## 🔑 Required Credentials

Create `backend/.env`:

```env
MONGODB_URL=your-mongodb-connection-string
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-1.5-flash
SENDER_EMAIL=your-email@gmail.com
SENDER_APP_PASSWORD=your-app-password
```

## 📦 Model Files

Copy from `models/` to `backend/models/`:
- `attrition_model.pkl`
- `label_encoders (1).pkl`
- `feature_columns.pkl`

## ✅ Done!

Your TalentFlow platform is now running!

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

**Need help?** See SETUP.md for detailed instructions.

