# 📁 Complete Project Structure Explanation

## 🎯 Project Overview

**TalentFlow** is a Next-Gen HR Management Platform that uses AI/ML to automate HR processes. It consists of:
- **Backend**: FastAPI (Python) with MongoDB database
- **Frontend**: React + TypeScript with Vite
- **AI/ML**: Gemini API for natural language processing, scikit-learn for attrition prediction
- **Architecture**: Agentic AI system using LangGraph for intelligent routing

---

## 📂 Root Directory Structure

```
hr-final-agent/
├── app.py                    # Legacy Flask app (original chatbot)
├── backend/                  # FastAPI backend application
├── frontend/                 # React + TypeScript frontend
├── models/                   # ML model files (pickle)
├── templates/                # HTML templates (legacy)
├── README.md                 # Main documentation
├── PROJECT_SUMMARY.md        # Project summary
├── QUICK_START.md            # Quick setup guide
└── SETUP.md                  # Detailed setup instructions
```

---

## 🔧 Backend Structure (`backend/`)

### **Purpose**: Handles all server-side logic, API endpoints, AI services, and database operations

```
backend/
├── app/                      # Main application package
│   ├── __init__.py          # Package initialization
│   ├── main.py              # FastAPI app entry point & server setup
│   │
│   ├── api/                 # API layer - REST endpoints
│   │   ├── v1/              # API version 1
│   │   │   ├── router.py    # Main API router (combines all endpoints)
│   │   │   └── endpoints/   # Individual endpoint modules
│   │   │       ├── auth.py              # Authentication endpoints (login, register)
│   │   │       ├── chatbot.py          # Chatbot query endpoint
│   │   │       ├── chatbot_logs.py     # Chat history/logs endpoints
│   │   │       ├── employees.py        # Employee CRUD operations
│   │   │       ├── analytics.py        # Analytics & dashboard data
│   │   │       ├── jobs.py             # Job postings management
│   │   │       ├── agents.py           # Agent management endpoints
│   │   │       ├── interview_coordinator.py  # Interview scheduling
│   │   │       ├── documents.py        # Document generation
│   │   │       └── onboarding.py       # Employee onboarding
│   │
│   ├── core/                # Core configuration & infrastructure
│   │   ├── config.py        # Settings & environment variables (MongoDB, Gemini, JWT, etc.)
│   │   ├── database.py      # MongoDB connection & database utilities
│   │   └── security.py      # JWT authentication, password hashing
│   │
│   └── services/            # Business logic & AI services
│       ├── ai_service.py                    # Main LangGraph chatbot orchestrator
│       ├── gemini_client.py                 # Gemini API wrapper
│       ├── enhanced_chatbot.py              # Enhanced chatbot logic
│       ├── ml_service.py                    # ML model loading & attrition prediction
│       ├── email_service.py                 # Email sending functionality
│       ├── resume_screening_agent.py        # Resume screening AI agent
│       ├── interview_coordinator_agent.py   # Interview scheduling agent
│       ├── meeting_scheduler_agent.py        # Meeting scheduling agent
│       ├── onboarding_agent.py              # Employee onboarding automation
│       └── document_generation_agent.py     # Document generation agent
│
├── models/                  # ML model files (pickle format)
│   ├── attrition_model.pkl          # Trained attrition prediction model
│   ├── label_encoders.pkl           # Label encoders for categorical features
│   ├── feature_columns.pkl          # Feature column names
│   └── employee_arima_models.pkl    # Time series models for employee data
│
├── requirements.txt         # Python dependencies
├── run.py                   # Alternative entry point for running server
├── check_db.py              # Database connection checker utility
└── check_interviews.py      # Interview data checker utility
```

### **Key Backend Files Explained**:

#### **`app/main.py`**
- FastAPI application initialization
- CORS middleware setup
- Database connection lifecycle (startup/shutdown)
- Routes all API requests to `/api/v1`

#### **`app/core/config.py`**
- Centralized configuration using Pydantic Settings
- Stores: MongoDB URL, Gemini API key, email credentials, JWT secrets
- Loads from `.env` file or environment variables

#### **`app/core/database.py`**
- MongoDB connection using Motor (async driver)
- Database client initialization
- Collection access utilities

#### **`app/services/ai_service.py`**
- **Core AI orchestrator** using LangGraph
- Routes queries to: Database operations, Email sending, or Attrition prediction
- Uses Gemini API to convert natural language to MongoDB queries
- Handles field matching and query execution

#### **`app/services/ml_service.py`**
- Loads pre-trained ML models (attrition prediction)
- Provides prediction functions
- Handles feature encoding and preprocessing

#### **`app/api/v1/endpoints/`**
Each endpoint file handles specific REST API routes:
- **`chatbot.py`**: `POST /api/v1/chatbot/ask` - Process user queries
- **`employees.py`**: `GET/POST/PUT/DELETE /api/v1/employees` - Employee management
- **`analytics.py`**: `GET /api/v1/analytics/*` - Dashboard metrics
- **`auth.py`**: `POST /api/v1/auth/login` - Authentication

---

## 🎨 Frontend Structure (`frontend/`)

### **Purpose**: User interface built with React, TypeScript, and Tailwind CSS

```
frontend/
├── src/
│   ├── main.tsx             # React app entry point
│   ├── App.tsx              # Main app component with routing
│   ├── index.css            # Global styles & Tailwind imports
│   │
│   ├── pages/               # Page components (routes)
│   │   ├── Home.tsx         # Landing page
│   │   ├── Login.tsx        # Login page
│   │   ├── Welcome.tsx      # Post-login welcome screen
│   │   ├── Dashboard.tsx    # Main dashboard with metrics
│   │   ├── Employees.tsx    # Employee directory/list
│   │   ├── HireEmployee.tsx # Add new employee form
│   │   ├── Analytics.tsx    # Analytics & charts page
│   │   ├── AgentDashboard.tsx # AI agents management page
│   │   ├── Profile.tsx      # User profile page
│   │   ├── Policies.tsx     # HR policies page
│   │   └── Settings.tsx     # Application settings
│   │
│   ├── components/          # Reusable React components
│   │   ├── layout/          # Layout components
│   │   │   ├── AppLayout.tsx    # Main app layout (sidebar + content)
│   │   │   ├── Navbar.tsx       # Top navigation bar
│   │   │   └── Sidebar.tsx      # Side navigation menu
│   │   │
│   │   ├── chatbot/         # Chatbot UI components
│   │   │   ├── ChatWindow.tsx   # Full chat interface
│   │   │   └── ChatBubble.tsx   # Floating chat button
│   │   │
│   │   ├── agents/          # AI agent interfaces
│   │   │   ├── TalentAcquisitionAgentInterface.tsx
│   │   │   ├── EmployeeLifecycleAgentInterface.tsx
│   │   │   ├── HRInsightsRetentionAgentInterface.tsx
│   │   │   ├── HRKnowledgeActionAgentInterface.tsx
│   │   │   ├── ResumeScreeningAgentInterface.tsx
│   │   │   ├── InterviewCoordinatorAgentInterface.tsx
│   │   │   ├── MeetingSchedulerAgentInterface.tsx
│   │   │   ├── OnboardingAgentInterface.tsx
│   │   │   ├── DocumentGenerationAgentInterface.tsx
│   │   │   └── DatabaseManagerAgentInterface.tsx
│   │   │
│   │   └── ui/              # Reusable UI components (Shadcn/ui style)
│   │       ├── button.tsx   # Button component
│   │       ├── card.tsx     # Card component
│   │       ├── input.tsx    # Input field component
│   │       └── badge.tsx    # Badge component
│   │
│   ├── services/            # API service layer
│   │   └── api.ts           # Axios client & API functions
│   │                         # (chatbotService, employeeService, analyticsService, etc.)
│   │
│   ├── contexts/            # React Context providers
│   │   └── AuthContext.tsx  # Authentication state management
│   │
│   ├── types/               # TypeScript type definitions
│   │   ├── api.ts           # API request/response types
│   │   └── employee.ts      # Employee data types
│   │
│   └── lib/                 # Utility functions
│       └── utils.ts         # Helper functions (clsx, cn, etc.)
│
├── index.html               # HTML entry point
├── package.json             # Node.js dependencies & scripts
├── vite.config.ts          # Vite build configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── postcss.config.js       # PostCSS configuration
```

### **Key Frontend Files Explained**:

#### **`src/App.tsx`**
- Sets up React Router with protected routes
- Wraps app with QueryClient (React Query) and AuthProvider
- Defines all application routes

#### **`src/pages/Dashboard.tsx`**
- Main dashboard showing HR metrics
- Displays: total employees, average salary, attrition rate, etc.
- Uses charts (Recharts) for visualizations

#### **`src/pages/Employees.tsx`**
- Employee directory with search and filtering
- Lists all employees with pagination
- Links to employee details

#### **`src/components/chatbot/ChatWindow.tsx`**
- Full-featured chat interface
- Sends queries to `/api/v1/chatbot/ask`
- Displays conversation history

#### **`src/services/api.ts`**
- Centralized API client using Axios
- All API calls go through this file
- Handles authentication tokens
- Error handling and interceptors

#### **`src/contexts/AuthContext.tsx`**
- Manages user authentication state
- Provides login/logout functions
- Stores JWT tokens in localStorage

---

## 🤖 AI Agents & Services

### **Agent Architecture**:
The system uses **LangGraph** to create an agentic workflow:

1. **Routing Agent** (`ai_service.py`):
   - Analyzes user query
   - Routes to appropriate handler:
     - Database operations
     - Email sending
     - Attrition prediction

2. **Specialized Agents** (4 composite agents):
   - **Talent Acquisition Agent**: Job requisition intake, candidate scoring, interview orchestration, offer draft
   - **Employee Lifecycle Agent**: Onboarding, document compliance, policy workflows, probation tracking
   - **HR Insights & Retention Agent**: Attrition risk, intervention playbooks, team-level trends
   - **HR Knowledge & Action Agent**: Policy Q&A, HR data retrieval, controlled operational actions with approvals

### **How It Works**:
```
User Query → LangGraph Router → Gemini API (query understanding) 
→ MongoDB Query/Email/ML Prediction → Formatted Response → User
```

---

## 🗄️ Database Structure (MongoDB)

### **Collections Used**:
- **`employee`**: Employee records (ID, Name, Department, Salary, etc.)
- **`Leave_Attendance`**: Leave balances and attendance records
- **`Performance`**: Performance reviews and ratings
- **`Attrition`**: Training data for ML model
- **`Candidates`**: Job applicants
- **`Interviews`**: Interview records
- **`Jobs`**: Job postings
- **`Onboarding`**: Onboarding records
- **`Communication`**: Communication logs
- **`Resume_screening`**: Resume screening results
- **`skill_courses`**: Training courses

---

## 🔄 Data Flow

### **Chatbot Query Flow**:
1. User types query in frontend → `ChatWindow.tsx`
2. Frontend calls `POST /api/v1/chatbot/ask` → `api.ts`
3. Backend receives in `chatbot.py` endpoint
4. Routes to `ai_service.py` → LangGraph workflow
5. Gemini API converts natural language to MongoDB query
6. Executes query on MongoDB
7. Formats response using `format_natural_language()`
8. Returns to frontend → displays in chat

### **Employee Management Flow**:
1. User views `Employees.tsx` page
2. Frontend calls `GET /api/v1/employees` → `employees.py`
3. Backend queries MongoDB `employee` collection
4. Returns paginated results
5. Frontend displays in table/list

### **Analytics Flow**:
1. User views `Dashboard.tsx` or `Analytics.tsx`
2. Frontend calls `GET /api/v1/analytics/summary` → `analytics.py`
3. Backend aggregates data from MongoDB
4. Calculates metrics (counts, averages, distributions)
5. Returns JSON → Frontend renders charts

---

## 🛠️ Configuration Files

### **Backend**:
- **`requirements.txt`**: Python packages (FastAPI, Motor, LangGraph, scikit-learn, etc.)
- **`.env`** (not in repo): Environment variables (MongoDB URL, API keys)

### **Frontend**:
- **`package.json`**: Node.js packages (React, TypeScript, Vite, Tailwind, etc.)
- **`vite.config.ts`**: Vite build settings
- **`tailwind.config.js`**: Tailwind CSS theme and plugins

---

## 🚀 Entry Points

### **Backend**:
- **`backend/app/main.py`**: Main FastAPI app (run with `uvicorn app.main:app`)
- **`backend/run.py`**: Alternative entry point
- **`app.py`**: Legacy Flask app (original implementation)

### **Frontend**:
- **`frontend/src/main.tsx`**: React app entry point
- **`frontend/index.html`**: HTML entry point

---

## 📊 Key Technologies

### **Backend**:
- **FastAPI**: Modern Python web framework
- **Motor**: Async MongoDB driver
- **LangGraph**: Agent orchestration framework
- **Gemini API**: Google's AI for natural language understanding
- **scikit-learn**: ML model for attrition prediction
- **Pydantic**: Data validation

### **Frontend**:
- **React 18**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool & dev server
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **React Query**: Data fetching & caching
- **Axios**: HTTP client
- **Recharts**: Chart library

---

## 🔐 Security

- **JWT Authentication**: Token-based auth in `core/security.py`
- **Password Hashing**: Bcrypt for password storage
- **CORS**: Configured in `main.py` for frontend origins
- **Environment Variables**: Sensitive data in `.env` (not committed)

---

## 📝 Summary

This is a **full-stack HR management platform** with:
- ✅ **AI-powered chatbot** for natural language queries
- ✅ **Employee management** system
- ✅ **Analytics dashboard** with ML predictions
- ✅ **Multiple AI agents** for automation
- ✅ **Modern React UI** with responsive design
- ✅ **RESTful API** with automatic documentation

The architecture follows **separation of concerns**:
- **Frontend**: UI/UX, user interactions
- **Backend API**: Business logic, data processing
- **Services**: AI/ML operations, email, etc.
- **Database**: Data persistence (MongoDB)

---

**Built with ❤️ using React, FastAPI, MongoDB, and Gemini API**

