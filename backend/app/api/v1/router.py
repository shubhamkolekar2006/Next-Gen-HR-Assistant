from fastapi import APIRouter
from app.api.v1.endpoints import chatbot, employees, analytics, agents, chatbot_logs, interview_coordinator, documents, onboarding, jobs, auth, lifecycle_agents, orchestrator

api_router = APIRouter()

api_router.include_router(chatbot.router, prefix="/chatbot", tags=["chatbot"])
api_router.include_router(chatbot_logs.router, tags=["chatbot"])
api_router.include_router(employees.router, tags=["employees"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(jobs.router, tags=["jobs"])
api_router.include_router(agents.router, tags=["agents"])
api_router.include_router(interview_coordinator.router, prefix="/agents", tags=["interview-coordinator"])
api_router.include_router(documents.router, prefix="/agents", tags=["documents"])
api_router.include_router(onboarding.router, prefix="/agents", tags=["onboarding"])
api_router.include_router(lifecycle_agents.router, prefix="/agents", tags=["lifecycle-agents"])
api_router.include_router(orchestrator.router, prefix="/orchestrator", tags=["orchestrator"])
api_router.include_router(auth.router, tags=["auth"])

