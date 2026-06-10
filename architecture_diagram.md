# System Architecture Diagram

This diagram outlines the high-level architecture of the **TalentFlow** HR Agent Platform, detailing the interaction between the React frontend, FastAPI backend, AI/ML services (LangGraph & Gemini), and the MongoDB database.

```mermaid
graph TD
    %% Define Styles
    classDef frontend fill:#3b82f6,stroke:#1e40af,stroke-width:2px,color:#fff
    classDef backend fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff
    classDef ai fill:#8b5cf6,stroke:#5b21b6,stroke-width:2px,color:#fff
    classDef db fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff
    classDef external fill:#64748b,stroke:#334155,stroke-width:2px,color:#fff

    %% Frontend Components
    subgraph Frontend ["Frontend (React + TypeScript + Vite)"]
        UI["User Interface<br/>(Tailwind CSS, React Router)"]
        Pages["Pages<br/>(Dashboard, Employees, Chat)"]
        Services["API Service Layer<br/>(Axios + React Query)"]
        
        UI --> Pages
        Pages --> Services
    end

    %% Backend Components
    subgraph Backend ["Backend (FastAPI)"]
        Router["API Router (v1)"]
        Endpoints["Endpoints<br/>(Auth, Chatbot, Employees, Analytics)"]
        Security["Security Layer<br/>(JWT, CORS)"]
        
        Router --> Security
        Security --> Endpoints
    end

    %% AI & Services
    subgraph ServicesLayer ["Services & AI (LangGraph)"]
        LangGraph["LangGraph Orchestrator<br/>(Routing Agent)"]
        
        subgraph Agents ["Specialized AI Agents"]
            TA_Agent["Talent Acquisition"]
            EL_Agent["Employee Lifecycle"]
            HR_Insights["HR Insights & Retention"]
            HR_Action["HR Knowledge & Action"]
        end
        
        ML_Model["ML Service<br/>(scikit-learn Attrition Model)"]
        EmailService["Email Service"]
        
        LangGraph --> Agents
        LangGraph --> ML_Model
        LangGraph --> EmailService
    end

    %% Database
    subgraph Database ["Database"]
        MongoDB[("MongoDB<br/>(Motor Async)")]
        Collections[/"Collections:<br/>employee, Attrition, Candidates, etc."/]
        MongoDB --- Collections
    end

    %% External APIs
    Gemini["Google Gemini API<br/>(LLM)"]

    %% Connections
    Services -- "REST API (HTTP/JSON)" --> Router
    Endpoints -- "Query/Process" --> LangGraph
    Endpoints -- "CRUD Operations" --> MongoDB
    
    Agents -- "Natural Language Processing" --> Gemini
    Agents -- "Data Retrieval/Update" --> MongoDB
    ML_Model -- "Fetch Training Data" --> MongoDB
    
    %% Apply Styles
    class Frontend frontend
    class Backend backend
    class ServicesLayer ai
    class Agents ai
    class Database db
    class Gemini external
```

### Architecture Components Breakdown

1. **Frontend**: Built with React, TypeScript, and Vite. It communicates with the backend via Axios and React Query, offering a modern UI with Tailwind CSS. It handles routing and displays dashboards, employee details, and the chatbot interface.
2. **Backend**: Powered by FastAPI. It handles routing, security (JWT authentication, CORS), and exposes RESTful endpoints for the frontend to consume.
3. **Services & AI (LangGraph)**: The core intelligence of the application. LangGraph orchestrates the workflow by taking user queries and routing them to specialized agents (e.g., Talent Acquisition, HR Insights). It utilizes Google's Gemini API for natural language understanding and invokes ML models (scikit-learn) for predictions like employee attrition.
4. **Database**: MongoDB handles data persistence asynchronously using the Motor driver. It stores information across various collections like employees, attendance, performance, and candidates.
