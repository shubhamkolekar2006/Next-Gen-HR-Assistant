# 🎯 Next Gen HR - Complete HR Management Platform using agentic AI

A comprehensive, production-ready HR management platform with AI/ML capabilities, built with React + TypeScript frontend and FastAPI backend.

## 📋 Features

- ✅ **AI-Powered Chatbot** - Natural language queries for HR data using Gemini API and LangGraph
- ✅ **Employee Management** - Complete employee directory with search and filtering
- ✅ **Analytics Dashboard** - Real-time HR metrics and insights
- ✅ **Attrition Prediction** - ML-powered risk assessment using scikit-learn
- ✅ **Email Integration** - Automated email generation and sending
- ✅ **Modern UI** - Beautiful React interface with Tailwind CSS and Shadcn/ui components

## 🏗️ Project Structure

```
talentflow/
├── frontend/              # React + TypeScript application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API service layer
│   │   └── types/         # TypeScript types
│   └── package.json
│
├── backend/               # FastAPI application
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── core/         # Configuration and database
│   │   ├── services/     # Business logic
│   │   └── main.py       # FastAPI app entry point
│   └── requirements.txt
│
└── models/                # ML model files
    ├── attrition_model.pkl
    ├── label_encoders.pkl
    └── feature_columns.pkl
```

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Gemini API key (free-tier)

### Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Create virtual environment:**
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Setup environment variables:**
Create a `.env` file in the `backend` directory:
```env
MONGODB_URL=your-mongodb-connection-string
DATABASE_NAME=HR_AGENT
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SENDER_EMAIL=your-email@gmail.com
SENDER_APP_PASSWORD=your-app-password
JWT_SECRET=your-secret-key
```

5. **Ensure ML models are accessible:**
Make sure the model files from the `models/` directory are accessible. You can:
- Copy them to `backend/models/`
- Or update the `MODEL_DIR` path in `.env`

6. **Run the backend:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

### Frontend Setup

1. **Navigate to frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Setup environment variables (optional):**
Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:8000/api/v1
```

4. **Run the frontend:**
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 📚 API Endpoints

### Chatbot
- `POST /api/v1/chatbot/ask` - Process natural language queries

### Employees
- `GET /api/v1/employees` - Get all employees (with search, pagination)
- `GET /api/v1/employees/{id}` - Get employee by ID
- `GET /api/v1/employees/{id}/attrition-risk` - Get attrition risk for employee

### Analytics
- `GET /api/v1/analytics/summary` - Get dashboard summary
- `GET /api/v1/analytics/department-distribution` - Get department stats
- `GET /api/v1/analytics/attrition-risk` - Get attrition risk distribution

## 🎨 Features Overview

### AI Chatbot
The chatbot can handle three types of queries:
1. **Database Queries**: "Show all employees", "Find employee with ID 123"
2. **Email Sending**: "Send email to user@example.com subject: Welcome"
3. **Attrition Prediction**: "Show top 5 high risk employees"

### Employee Management
- Browse all employees
- Search by name, ID, or department
- View employee details
- Check attrition risk for individual employees

### Analytics Dashboard
- Total employees count
- Average salary
- Attrition rate
- High-risk employee count
- Department distribution

## 🔧 Configuration

### MongoDB Collections

The application uses these MongoDB collections:
- `employee` - Employee data
- `Leave_Attendance` - Leave and attendance records
- `Performance` - Performance reviews
- `Attrition` - ML training data
- `Candidates`, `Interviews`, `Jobs`, `Onboarding`, etc.

### ML Model Files

Required model files:
- `attrition_model.pkl` - Trained scikit-learn model
- `label_encoders.pkl` - Label encoders for categorical features
- `feature_columns.pkl` - Feature column names

Place these in `backend/models/` directory.

## 🚨 Security Notes

⚠️ **Important**: 
- Never commit `.env` files to version control
- Change all default secrets in production
- Use environment variables for all sensitive data
- Implement proper authentication before deploying

## 🛠️ Development

### Backend Development
```bash
cd backend
uvicorn app.main:app --reload
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Building for Production

**Backend:**
```bash
# Use production WSGI server
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

**Frontend:**
```bash
cd frontend
npm run build
# Output in dist/ directory
```

## 📝 Migration from Flask

This project was migrated from a Flask-based chatbot. Key changes:
- FastAPI replaces Flask for better async support
- Motor replaces PyMongo for async MongoDB operations
- React + TypeScript frontend replaces HTML templates
- Structured API endpoints with automatic documentation
- Better error handling and logging

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Verify your MongoDB connection string
- Check network/firewall settings
- Ensure MongoDB Atlas IP whitelist includes your IP

### ML Model Not Loading
- Verify model files exist in correct directory
- Check file permissions
- Verify model file paths in logs

### API CORS Errors
- Check CORS settings in `backend/app/main.py`
- Verify frontend URL is in allowed origins

## 📄 License

This project is for educational and development purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ using React, FastAPI, MongoDB, and Gemini API**

