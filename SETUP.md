# 🚀 TalentFlow Setup Guide

## Quick Start

### 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy ML model files from models/ directory to backend/models/
# Or update MODEL_DIR in .env

# Create .env file (copy from .env.example and fill in your values)
# Make sure to set:
# - MONGODB_URL
# - GEMINI_API_KEY
# - SENDER_EMAIL and SENDER_APP_PASSWORD

# Run the server
python run.py
# OR
uvicorn app.main:app --reload
```

Backend will run on `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# (Optional) Create .env file
# VITE_API_URL=http://localhost:8000/api/v1

# Run development server
npm run dev
```

Frontend will run on `http://localhost:5173`

## 🔑 Required Environment Variables

### Backend (.env)

```env
# MongoDB Connection
MONGODB_URL=mongodb+srv://user:password@cluster.mongodb.net/database
DATABASE_NAME=HR_AGENT

# Gemini API
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=models/gemini-2.0-flash

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SENDER_EMAIL=your-email@gmail.com
SENDER_APP_PASSWORD=your-gmail-app-password

# JWT (Change in production!)
JWT_SECRET=change-this-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Server
HOST=0.0.0.0
PORT=8000

# Model Directory
MODEL_DIR=models
```

### Frontend (.env) - Optional

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=TalentFlow
```

## 📦 ML Model Files

Ensure these files are in `backend/models/` directory:
- `attrition_model.pkl`
- `label_encoders.pkl` or `label_encoders (1).pkl`
- `feature_columns.pkl`

The application will automatically search multiple paths for these files.

## ✅ Verification

1. **Backend Health Check:**
   ```bash
   curl http://localhost:8000/health
   ```
   Should return: `{"status": "ok", "version": "1.0.0"}`

2. **Test Chatbot:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/chatbot/ask \
     -H "Content-Type: application/json" \
     -d '{"query": "show all employees"}'
   ```

3. **Frontend:**
   Open `http://localhost:5173` in your browser

## 🐛 Troubleshooting

### MongoDB Connection Fails
- Verify connection string format
- Check network/firewall
- Ensure MongoDB Atlas IP whitelist includes your IP
- Check credentials

### ML Models Not Loading
- Verify files exist in `backend/models/`
- Check file permissions
- Look for errors in backend logs
- Verify file names match exactly

### CORS Errors
- Check `backend/app/main.py` CORS settings
- Verify frontend URL is in allowed origins list

### Module Import Errors
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt` again
- Check Python version (3.9+)

## 📝 Next Steps

1. **Configure MongoDB Collections:**
   - Ensure `employee`, `Attrition`, `Leave_Attendance`, etc. collections exist
   - Add sample data for testing

2. **Test Chatbot:**
   - Try: "show all employees"
   - Try: "send email to test@example.com subject: Welcome"
   - Try: "show top 5 high risk employees"

3. **Customize:**
   - Update colors in `frontend/tailwind.config.js`
   - Add more API endpoints in `backend/app/api/v1/endpoints/`
   - Customize dashboard metrics

## 🚀 Production Deployment

### Backend (Railway/Render/Heroku)
1. Set environment variables in platform dashboard
2. Deploy: `git push` or connect GitHub repo
3. Ensure ML model files are accessible
4. Use production WSGI server: `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker`

### Frontend (Vercel/Netlify)
1. Build: `npm run build`
2. Set `VITE_API_URL` to your production backend URL
3. Deploy `dist/` directory

---

**Need help?** Check the main README.md for more details.

