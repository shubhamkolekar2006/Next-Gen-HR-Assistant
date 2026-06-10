"""
Document Generation Agent - Auto-generates HR documents (offer letters, contracts, certificates)
"""
import json
import re
from datetime import datetime
from typing import Dict, Any, Literal
import logging

from langgraph.graph import StateGraph
from app.core.config import settings
from app.core.database import get_database
from app.services.email_service import send_email
from app.services.llama_client import LlamaModel

logger = logging.getLogger(__name__)

LLAMA_MODEL_NAME = settings.LLAMA_MODEL
model = LlamaModel(model_name=LLAMA_MODEL_NAME)

class DocumentGenerationAgent:
    """Agent for generating HR documents"""
    
    def __init__(self):
        self.model = model
    
    async def generate_offer_letter(self, candidate_data: Dict[str, Any], job_data: Dict[str, Any], offer_details: Dict[str, Any]) -> Dict[str, Any]:
        """Generate offer letter"""
        prompt = f"""Generate a professional employment offer letter. Include:

- Company letterhead format
- Candidate name and address
- Position title and department
- Start date
- Salary and compensation details
- Benefits summary
- Reporting structure
- Employment terms and conditions
- Acceptance deadline
- Professional closing

Candidate Information:
{json.dumps(candidate_data, indent=2)}

Job Information:
{json.dumps(job_data, indent=2)}

Offer Details:
{json.dumps(offer_details, indent=2)}

Generate a complete, professional offer letter:"""

        try:
            response = model.generate_content(prompt)
            document_content = response.text.strip()
            
            # Save document
            db = get_database()
            document = {
                "type": "offer_letter",
                "candidate_name": candidate_data.get("name", ""),
                "candidate_email": candidate_data.get("email", ""),
                "job_id": job_data.get("job_id", ""),
                "content": document_content,
                "generated_at": datetime.now().isoformat(),
                "status": "generated"
            }
            
            result = await db["Generated_Documents"].insert_one(document)
            document["_id"] = str(result.inserted_id)
            
            return {
                "success": True,
                "document": document,
                "content": document_content
            }
        except Exception as e:
            logger.error(f"Error generating offer letter: {e}")
            return {"error": str(e)}
    
    async def generate_contract(self, employee_data: Dict[str, Any], contract_terms: Dict[str, Any]) -> Dict[str, Any]:
        """Generate employment contract"""
        prompt = f"""Generate a professional employment contract. Include:

- Parties involved (employer and employee)
- Position and job description
- Employment start date and duration
- Compensation and benefits
- Working hours and location
- Leave entitlements
- Confidentiality clauses
- Termination conditions
- Legal compliance
- Signatures section

Employee Information:
{json.dumps(employee_data, indent=2)}

Contract Terms:
{json.dumps(contract_terms, indent=2)}

Generate a complete, legally compliant employment contract:"""

        try:
            response = model.generate_content(prompt)
            document_content = response.text.strip()
            
            db = get_database()
            document = {
                "type": "employment_contract",
                "employee_id": employee_data.get("employee_id", ""),
                "employee_name": employee_data.get("name", ""),
                "content": document_content,
                "generated_at": datetime.now().isoformat(),
                "status": "generated"
            }
            
            result = await db["Generated_Documents"].insert_one(document)
            document["_id"] = str(result.inserted_id)
            
            return {
                "success": True,
                "document": document,
                "content": document_content
            }
        except Exception as e:
            logger.error(f"Error generating contract: {e}")
            return {"error": str(e)}
    
    async def generate_experience_certificate(self, employee_data: Dict[str, Any], employment_details: Dict[str, Any]) -> Dict[str, Any]:
        """Generate experience certificate"""
        prompt = f"""Generate a professional experience certificate. Include:

- Company letterhead
- Certificate title
- Employee name and designation
- Employment period (from - to dates)
- Job responsibilities summary
- Performance acknowledgment
- Company seal area
- Date and authorized signature

Employee Information:
{json.dumps(employee_data, indent=2)}

Employment Details:
{json.dumps(employment_details, indent=2)}

Generate a complete, professional experience certificate:"""

        try:
            response = model.generate_content(prompt)
            document_content = response.text.strip()
            
            db = get_database()
            document = {
                "type": "experience_certificate",
                "employee_id": employee_data.get("employee_id", ""),
                "employee_name": employee_data.get("name", ""),
                "content": document_content,
                "generated_at": datetime.now().isoformat(),
                "status": "generated"
            }
            
            result = await db["Generated_Documents"].insert_one(document)
            document["_id"] = str(result.inserted_id)
            
            return {
                "success": True,
                "document": document,
                "content": document_content
            }
        except Exception as e:
            logger.error(f"Error generating certificate: {e}")
            return {"error": str(e)}
    
    async def generate_salary_certificate(self, employee_data: Dict[str, Any], salary_details: Dict[str, Any]) -> Dict[str, Any]:
        """Generate salary certificate"""
        prompt = f"""Generate a professional salary certificate. Include:

- Company letterhead
- Certificate title
- Employee name and ID
- Designation
- Employment period
- Current salary details
- Benefits summary
- Date of issuance
- Authorized signature

Employee Information:
{json.dumps(employee_data, indent=2)}

Salary Details:
{json.dumps(salary_details, indent=2)}

Generate a complete, professional salary certificate:"""

        try:
            response = model.generate_content(prompt)
            document_content = response.text.strip()
            
            db = get_database()
            document = {
                "type": "salary_certificate",
                "employee_id": employee_data.get("employee_id", ""),
                "employee_name": employee_data.get("name", ""),
                "content": document_content,
                "generated_at": datetime.now().isoformat(),
                "status": "generated"
            }
            
            result = await db["Generated_Documents"].insert_one(document)
            document["_id"] = str(result.inserted_id)
            
            return {
                "success": True,
                "document": document,
                "content": document_content
            }
        except Exception as e:
            logger.error(f"Error generating salary certificate: {e}")
            return {"error": str(e)}
    
    async def send_document_email(self, document: Dict[str, Any], recipient_email: str):
        """Send generated document via email"""
        subject = f"{document['type'].replace('_', ' ').title()} - {document.get('employee_name', 'Document')}"
        body = f"""Dear {document.get('employee_name', 'Recipient')},

Please find attached your {document['type'].replace('_', ' ')}.

{document['content']}

Best regards,
TalentFlow HR Team"""

        await send_email(recipient_email, subject, body)
        
        # Mark as sent
        db = get_database()
        await db["Generated_Documents"].update_one(
            {"_id": document["_id"]},
            {"$set": {"status": "sent", "sent_at": datetime.now().isoformat(), "sent_to": recipient_email}}
        )

