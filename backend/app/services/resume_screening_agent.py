"""
Resume Screening Agent - Automatically screens resumes and matches to job requirements
"""
import asyncio
import json
import re
from datetime import datetime
from typing import Literal, Dict, Any, Optional
from langgraph.graph import StateGraph
from app.core.config import settings
from bson import ObjectId
from app.core.database import get_database
from app.services.email_service import send_email
import logging
from pathlib import Path
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from collections import Counter

logger = logging.getLogger(__name__)

class ResumeScreeningAgent:
    """Agent for automated resume screening and candidate matching"""
    
    def __init__(self):
        # Try to load a pre-trained similarity model/pipeline if available
        self.similarity_model = None
        possible_paths = [
            Path(getattr(settings, "MODEL_DIR", "models")) / "resume_job_similarity.pkl",
            Path("backend") / "models" / "resume_job_similarity.pkl",
            Path("models") / "resume_job_similarity.pkl",
            Path("../models") / "resume_job_similarity.pkl",
        ]
        for p in possible_paths:
            try:
                if p.exists():
                    self.similarity_model = joblib.load(p)
                    logger.info(f"✅ Loaded resume similarity model from {p}")
                    break
            except Exception as e:
                logger.warning(f"Could not load similarity model from {p}: {e}")
    
    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Try to extract a JSON object from arbitrary text returned by the model."""
        try:
            # Fast path: try direct load first
            return json.loads(text)
        except Exception:
            pass

        # Strip common markdown fences
        cleaned = re.sub(r"```json\s*", "", text)
        cleaned = re.sub(r"```\s*", "", cleaned)
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except Exception:
            pass

        # Heuristic: find the outermost JSON object boundaries
        start = cleaned.find('{')
        end = cleaned.rfind('}')
        if start != -1 and end != -1 and end > start:
            candidate = cleaned[start:end + 1]
            try:
                return json.loads(candidate)
            except Exception:
                # Attempt minor normalizations
                normalized = candidate.replace("\'", '"').replace("'", '"')
                normalized = re.sub(r",\s*([}\]])", r"\1", normalized)  # remove trailing commas
                try:
                    return json.loads(normalized)
                except Exception:
                    return None
        return None

    def _heuristic_parse_resume(self, resume_text: str) -> Dict[str, Any]:
        """Enhanced heuristic parser to extract more information from resume text."""
        if not resume_text or not resume_text.strip():
            return {
                "name": "Unknown",
                "email": "",
                "phone": "",
                "skills": [],
                "experience_years": 0,
                "education": "",
                "previous_roles": [],
                "certifications": [],
                "summary": resume_text[:500] if resume_text else "",
            }
        
        # Extract email
        email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", resume_text)
        email = email_match.group(0) if email_match else ""
        
        # Extract phone
        phone_match = re.search(r"(\+?\d[\d\s().-]{7,}\d)", resume_text)
        phone = phone_match.group(0) if phone_match else ""
        
        # Extract name (first substantial line, usually at the top)
        name = "Unknown"
        lines = resume_text.splitlines()
        for i, line in enumerate(lines[:10]):  # Check first 10 lines
            candidate = line.strip()
            # Skip if it looks like email, phone, or section header
            if candidate and len(candidate) > 2 and len(candidate) < 100:
                if not re.search(r'[@\d{3,}]', candidate) and not re.search(r'^\s*[A-Z\s]{3,}:', candidate):
                    name = candidate[:100]
                    break
        
        # Extract skills - look for multiple patterns
        skills: list[str] = []
        
        # Pattern 1: "Skills:" or "Technical Skills:" etc.
        skills_section_started = False
        skills_lines = []
        for line in lines:
            line_lower = line.lower()
            if re.search(r'^\s*(technical\s+)?skills?\s*[:|•\-]', line_lower):
                skills_section_started = True
                # Extract from this line
                parts = line.split(':', 1) if ':' in line else line.split('-', 1) if '-' in line else [line]
                if len(parts) > 1:
                    skills_text = parts[1]
                else:
                    skills_text = line
                # Continue reading next lines until we hit another section
            elif skills_section_started:
                if re.search(r'^\s*[A-Z][A-Z\s]{2,}:', line):  # New section header
                    break
                skills_lines.append(line)
        
        # Combine all skills text
        all_skills_text = ' '.join(skills_lines)
        if not all_skills_text:
            # Try to find skills in the original line
            for line in lines:
                if re.search(r'^\s*(technical\s+)?skills?\s*[:|•\-]', line, re.IGNORECASE):
                    parts = line.split(':', 1) if ':' in line else [line]
                    if len(parts) > 1:
                        all_skills_text = parts[1]
                    break
        
        # Parse skills from text
        if all_skills_text:
            # Split by common delimiters
            skill_candidates = re.split(r'[,;•|\n\r]+', all_skills_text)
            skills = [s.strip() for s in skill_candidates if s.strip() and len(s.strip()) > 1]
        
        # If no skills found, try to extract common tech terms from entire resume
        if not skills:
            common_tech = ['python', 'java', 'javascript', 'sql', 'html', 'css', 'react', 'node', 'angular', 
                          'vue', 'django', 'flask', 'spring', 'aws', 'azure', 'docker', 'kubernetes',
                          'machine learning', 'ai', 'data science', 'analytics', 'excel', 'powerpoint']
            resume_lower = resume_text.lower()
            found_skills = [tech for tech in common_tech if tech in resume_lower]
            if found_skills:
                skills = found_skills[:15]  # Limit to 15
        
        # Extract experience years - look for patterns like "5 years", "3+ years", etc.
        experience_years = 0
        exp_patterns = [
            r'(\d+)\s*\+?\s*years?\s*(?:of\s*)?(?:experience|exp)',
            r'experience[:\s]+(\d+)\s*years?',
            r'(\d+)\s*years?\s*in',
        ]
        for pattern in exp_patterns:
            match = re.search(pattern, resume_text, re.IGNORECASE)
            if match:
                try:
                    exp_val = int(match.group(1))
                    if exp_val > experience_years:
                        experience_years = exp_val
                except:
                    pass
        
        # Extract education
        education = ""
        edu_keywords = ['bachelor', 'master', 'phd', 'degree', 'diploma', 'certification', 'university', 'college']
        for line in lines:
            line_lower = line.lower()
            if any(kw in line_lower for kw in edu_keywords):
                education = line.strip()[:200]
                break
        
        # Extract previous roles/job titles
        previous_roles = []
        role_keywords = ['developer', 'engineer', 'analyst', 'manager', 'specialist', 'consultant', 'designer']
        for line in lines:
            line_lower = line.lower()
            if any(kw in line_lower for kw in role_keywords):
                # Check if it looks like a job title (short line, capitalized)
                if len(line.strip()) < 80 and line.strip()[0].isupper():
                    previous_roles.append(line.strip()[:100])
                    if len(previous_roles) >= 5:
                        break
        
        # Extract summary (first paragraph or first few lines)
        summary = ""
        for i, line in enumerate(lines[:5]):
            if line.strip() and len(line.strip()) > 20:
                summary += line.strip() + " "
                if len(summary) > 300:
                    break
        summary = summary.strip()[:500]
        
        # If no summary, use first 500 chars of resume
        if not summary:
            summary = resume_text[:500].strip()

        return {
            "name": name,
            "email": email,
            "phone": phone,
            "skills": skills[:20],  # Limit to 20 skills
            "experience_years": experience_years,
            "education": education,
            "previous_roles": previous_roles[:5],
            "certifications": [],
            "summary": summary,
        }

    async def parse_resume(self, resume_text: str) -> Dict[str, Any]:
        """Extract basic info from resume text without external APIs."""
        # Use heuristic parser to avoid API key dependencies
        data = self._heuristic_parse_resume(resume_text)
        # Ensure defaults
        data.setdefault("name", "Unknown")
        data.setdefault("email", "")
        data.setdefault("phone", "")
        data.setdefault("skills", [])
        data.setdefault("experience_years", 0)
        data.setdefault("education", "")
        data.setdefault("previous_roles", [])
        data.setdefault("certifications", [])
        data.setdefault("summary", "")
        return data
    
    async def score_candidate(self, candidate_data: Dict[str, Any], job_requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Score candidate using local similarity model or TF-IDF cosine similarity with direct skill matching."""
        # Get original resume text if available (for better scoring)
        original_resume_text = candidate_data.get("_original_text", "")
        
        # Build text corpora - include more context
        candidate_skills = candidate_data.get("skills", [])
        if isinstance(candidate_skills, str):
            candidate_skills = [s.strip() for s in candidate_skills.split(',') if s.strip()]
        
        # Use original resume text if available, otherwise build from parsed data
        if original_resume_text and len(original_resume_text.strip()) > 50:
            candidate_text = original_resume_text[:2000]  # Use first 2000 chars for scoring
        else:
            candidate_text_parts = [
                candidate_data.get("summary", ""),
                " ".join(candidate_skills) if candidate_skills else "",
                " ".join(candidate_data.get("previous_roles", [])) if isinstance(candidate_data.get("previous_roles"), list) else str(candidate_data.get("previous_roles", "")),
                candidate_data.get("education", ""),
            ]
            candidate_text = " ".join([str(p).strip() for p in candidate_text_parts if p and str(p).strip()])

        required_skills = job_requirements.get("required_skills", [])
        if isinstance(required_skills, str):
            required_skills = [s.strip() for s in required_skills.split(',') if s.strip()]
        
        job_text_parts = [
            " ".join(required_skills) if required_skills else "",
            str(job_requirements.get("education", "")),
            str(job_requirements.get("position", "")),
            str(job_requirements.get("department", "")),
        ]
        job_text = " ".join([str(p).strip() for p in job_text_parts if p and str(p).strip()])

        # Direct skill matching (more reliable than just TF-IDF)
        candidate_skills_lower = {str(s).strip().lower() for s in candidate_skills if s}
        required_skills_lower = {str(s).strip().lower() for s in required_skills if s}
        
        # Calculate direct skill match percentage
        matched_skills = set()
        if required_skills_lower:
            matched_skills = candidate_skills_lower.intersection(required_skills_lower)
            direct_skill_match = len(matched_skills) / len(required_skills_lower) * 100
        else:
            # If no required skills, give credit based on number of skills candidate has
            # More skills = higher score (up to 60%)
            skill_count_score = min(60, len(candidate_skills_lower) * 5)
            direct_skill_match = skill_count_score

        # Compute TF-IDF similarity (only if we have enough text)
        tfidf_score = 0.0
        tfidf_match = 0
        if len(candidate_text.strip()) > 20 and len(job_text.strip()) > 5:
            try:
                if self.similarity_model is not None:
                    # Attempt to use a pre-trained vectorizer/pipeline
                    try:
                        if hasattr(self.similarity_model, "transform"):
                            vec = self.similarity_model
                            X = vec.transform([candidate_text, job_text])
                            tfidf_score = float(cosine_similarity(X[0], X[1])[0][0])
                        elif isinstance(self.similarity_model, dict) and "vectorizer" in self.similarity_model:
                            vec = self.similarity_model["vectorizer"]
                            X = vec.transform([candidate_text, job_text])
                            tfidf_score = float(cosine_similarity(X[0], X[1])[0][0])
                        else:
                            # Fallback to ad-hoc TF-IDF
                            raise ValueError("Unsupported similarity model type")
                    except Exception as e:
                        logger.warning(f"Similarity model use failed, falling back to TF-IDF: {e}")
                        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1, max_features=5000)
                        X = vectorizer.fit_transform([candidate_text, job_text])
                        tfidf_score = float(cosine_similarity(X[0], X[1])[0][0])
                else:
                    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1, max_features=5000)
                    X = vectorizer.fit_transform([candidate_text, job_text])
                    tfidf_score = float(cosine_similarity(X[0], X[1])[0][0])
                
                tfidf_match = int(round(tfidf_score * 100))
            except Exception as e:
                logger.error(f"Error computing TF-IDF similarity: {e}")
                tfidf_score = 0.0
                tfidf_match = 0
        else:
            logger.warning(f"Insufficient text for TF-IDF: candidate={len(candidate_text)}, job={len(job_text)}")

        # Combine direct skill match and TF-IDF similarity
        # Weight depends on whether we have required skills
        if required_skills_lower:
            # If we have required skills, weight direct matching more (70%)
            skills_match = int(round(0.7 * direct_skill_match + 0.3 * tfidf_match))
        else:
            # If no required skills, weight TF-IDF more (60%) since we're matching general content
            skills_match = int(round(0.4 * direct_skill_match + 0.6 * tfidf_match))
        
        # Ensure skills_match varies based on actual content
        # If candidate has skills but score is too low, boost it
        if candidate_skills_lower and skills_match < 20:
            skills_match = max(20, int(round(direct_skill_match * 0.6)))
        
        # Add variation based on resume length and content richness
        content_richness = min(100, len(candidate_text.strip()) / 10)  # More content = higher
        if skills_match < 30:
            # Boost score slightly based on content richness
            skills_match = int(round(skills_match + (content_richness * 0.1)))

        # Experience matching - make it more dynamic
        required_exp = int(job_requirements.get("experience_years", 0) or 0)
        candidate_exp = int(candidate_data.get("experience_years", 0) or 0)
        if required_exp > 0:
            if candidate_exp >= required_exp:
                experience_match = 100
            elif candidate_exp > 0:
                # Partial credit for partial experience - more granular
                ratio = candidate_exp / required_exp
                if ratio >= 0.8:
                    experience_match = 90
                elif ratio >= 0.6:
                    experience_match = 75
                elif ratio >= 0.4:
                    experience_match = 60
                else:
                    experience_match = max(25, int(ratio * 100))
            else:
                experience_match = 20  # No experience when required
        else:
            # If no requirement, give credit based on actual experience
            if candidate_exp > 0:
                experience_match = min(70, 50 + (candidate_exp * 5))  # 5 points per year, max 70
            else:
                experience_match = 40  # No experience, neutral-low score

        # Education matching - more nuanced
        education_required = str(job_requirements.get("education", "")).strip().lower()
        candidate_edu = str(candidate_data.get("education", "")).strip().lower()
        if education_required:
            # Check if candidate education contains key terms from required education
            edu_keywords = set(education_required.split())
            candidate_edu_words = set(candidate_edu.split())
            common_words = edu_keywords.intersection(candidate_edu_words)
            if len(common_words) >= 2:
                education_match = 100
            elif len(common_words) >= 1:
                education_match = 75
            elif any(kw in candidate_edu for kw in edu_keywords if len(kw) > 3):
                education_match = 60
            else:
                education_match = 30
        else:
            # If no requirement, give credit if candidate has education
            if candidate_edu:
                education_match = 60  # Has education
            else:
                education_match = 45  # No education info

        # Aggregate overall score with weights
        overall_score = int(round(0.6 * skills_match + 0.25 * experience_match + 0.15 * education_match))
        
        # Add variation factor based on unique content characteristics
        # This ensures different resumes get different scores even with similar base metrics
        unique_factor = hash(candidate_text[:100]) % 10  # 0-9 variation
        overall_score = max(15, min(100, overall_score + unique_factor - 5))  # Add -5 to +4 variation

        # Identify missing skills
        missing_skills = [s for s in required_skills if isinstance(s, str) and s.strip() and s.strip().lower() not in candidate_skills_lower]

        recommendation = "hire" if overall_score >= 80 else "maybe" if overall_score >= 60 else "reject"
        strengths = []
        if skills_match >= 70:
            strengths.append("strong skill alignment")
        if required_skills_lower and direct_skill_match >= 80:
            strengths.append(f"matches {len(matched_skills)}/{len(required_skills_lower)} required skills")
        if experience_match >= 80:
            strengths.append("meets experience requirements")
        if education_match >= 80:
            strengths.append("meets education requirements")
        if len(candidate_skills_lower) >= 10:
            strengths.append("extensive skill set")
        
        weaknesses = []
        if skills_match < 50:
            weaknesses.append("low skills match")
        if required_skills_lower and len(missing_skills) > 0:
            weaknesses.append(f"missing {len(missing_skills)} required skill(s)")
        if experience_match < 60 and required_exp > 0:
            weaknesses.append("below required experience")
        if education_match < 60 and education_required:
            weaknesses.append("education below requirement")

        reason_parts = []
        if required_skills_lower and direct_skill_match > 0:
            reason_parts.append(f"Direct skill match: {int(direct_skill_match)}%")
        if tfidf_match > 0:
            reason_parts.append(f"Content similarity: {tfidf_match}%")
        if not reason_parts:
            reason_parts.append("Content-based scoring")
        reason = " | ".join(reason_parts)

        logger.info(f"Scoring: candidate_skills={len(candidate_skills_lower)}, required_skills={len(required_skills_lower)}, "
                   f"skills_match={skills_match} (direct={int(direct_skill_match)}, tfidf={tfidf_match}), "
                   f"exp={experience_match} (candidate={candidate_exp}, required={required_exp}), "
                   f"edu={education_match}, overall={overall_score}, unique_factor={unique_factor}")

        return {
            "overall_score": overall_score,
            "skills_match": skills_match,
            "experience_match": experience_match,
            "education_match": education_match,
            "recommendation": recommendation,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "missing_skills": missing_skills[:10],
            "reason": reason,
        }
    
    async def _derive_requirements_from_employees(self, role: str, department: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Infer job requirements from existing employees when explicit job definition is unavailable."""
        if not role:
            return None

        db = get_database()
        query: Dict[str, Any] = {
            "$or": [
                {"Role": role},
                {"role": role},
                {"Position": role},
            ]
        }
        if department:
            query["Department"] = department

        projection = {
            "Skills": 1,
            "skills": 1,
            "ExperienceYears": 1,
            "Experience": 1,
            "experience_years": 1,
            "Department": 1,
            "Education": 1,
            "education": 1,
        }

        cursor = db["employee"].find(query, projection).limit(100)
        employees = await cursor.to_list(length=100)
        if not employees:
            return None

        skill_counter: Counter[str] = Counter()
        exp_values = []
        education_counter: Counter[str] = Counter()
        department_value = department

        for emp in employees:
            dept = emp.get("Department") or department_value
            if dept:
                department_value = dept

            skills_value = emp.get("Skills") or emp.get("skills") or ""
            if isinstance(skills_value, list):
                parsed_skills = [str(s).strip() for s in skills_value if str(s).strip()]
            elif isinstance(skills_value, str):
                parsed_skills = [
                    s.strip()
                    for s in re.split(r"[,;/|]", skills_value)
                    if s.strip()
                ]
            else:
                parsed_skills = []

            skill_counter.update([skill for skill in parsed_skills if skill])

            exp = (
                emp.get("ExperienceYears")
                or emp.get("experience_years")
                or emp.get("Experience")
            )
            try:
                if isinstance(exp, (int, float)):
                    exp_values.append(float(exp))
                elif isinstance(exp, str) and exp.strip():
                    exp_values.append(float(exp.strip()))
            except (ValueError, TypeError):
                continue

            education_value = emp.get("Education") or emp.get("education")
            if education_value and isinstance(education_value, str):
                education_counter.update([education_value.strip()])

        top_skills = [skill for skill, _ in skill_counter.most_common(10)]
        avg_experience = int(round(sum(exp_values) / len(exp_values))) if exp_values else 0
        education = education_counter.most_common(1)
        primary_education = education[0][0] if education else ""

        return {
            "required_skills": top_skills,
            "experience_years": avg_experience,
            "education": primary_education,
            "position": role,
            "department": department_value or department or "",
        }

    async def screen_resume(self, resume_text: str, job_identifier: str, job_role: Optional[str] = None, department: Optional[str] = None) -> Dict[str, Any]:
        """Complete resume screening workflow"""
        db = get_database()
        
        # Get job requirements (support both JobID and _id strings)
        job = await db["Jobs"].find_one({"JobID": job_identifier})
        if not job:
            # Try treating job_id as Mongo ObjectId
            try:
                job = await db["Jobs"].find_one({"_id": ObjectId(job_identifier)})
            except Exception:
                job = None
        if not job and job_role:
            job = await db["Jobs"].find_one({"Position": job_role})
        if not job:
            job = await db["Jobs"].find_one({"Position": job_identifier})
        derived_requirements: Optional[Dict[str, Any]] = None
        if not job:
            derived_requirements = await self._derive_requirements_from_employees(job_role or job_identifier, department)
            if not derived_requirements:
                return {"error": "Job not found"}
        
        job_requirements = (
            {
                "required_skills": job.get("RequiredSkills", []),
                "experience_years": job.get("ExperienceRequired", 0),
                "education": job.get("EducationRequired", ""),
                "position": job.get("Position", ""),
                "department": job.get("Department", "")
            }
            if job
            else derived_requirements
        )
        has_job_document = job is not None
        job_identifier_value = (
            job.get("JobID")
            if job and job.get("JobID")
            else job_identifier
        )
        
        # Parse resume
        candidate_data = await self.parse_resume(resume_text)
        if not candidate_data or not isinstance(candidate_data, dict):
            candidate_data = {}
        # Guarantee minimum structure so screening never hard-fails on parsing
        candidate_data.setdefault("name", "Unknown")
        candidate_data.setdefault("email", "")
        candidate_data.setdefault("phone", "")
        candidate_data.setdefault("skills", [])
        candidate_data.setdefault("experience_years", 0)
        candidate_data.setdefault("education", "")
        candidate_data.setdefault("previous_roles", [])
        candidate_data.setdefault("certifications", [])
        candidate_data.setdefault("summary", "")
        
        # Store original resume text for better scoring differentiation
        candidate_data["_original_text"] = resume_text
        
        # Score candidate
        score = await self.score_candidate(candidate_data, job_requirements)
        
        # Save screening result
        screening_result = {
            "job_id": job_identifier_value,
            "candidate_name": candidate_data.get("name", "Unknown"),
            "candidate_email": candidate_data.get("email", ""),
            "candidate_data": candidate_data,
            "score": score,
            "screening_date": datetime.now().isoformat(),
            "status": "completed"
        }
        
        result = await db["Resume_screening"].insert_one(screening_result)
        screening_result["_id"] = str(result.inserted_id)
        
        # Auto-action based on score
        if has_job_document and score.get("overall_score", 0) >= 80:
            # High score - auto-advance to interview
            await self._auto_advance_candidate(candidate_data, job_identifier_value, screening_result)
        elif has_job_document and score.get("overall_score", 0) >= 60:
            # Medium score - notify HR for review
            await self._notify_hr_review(candidate_data, job_identifier_value, score)
        
        return screening_result
    
    async def _auto_advance_candidate(self, candidate_data: Dict, job_id: str, screening_result: Dict):
        """Automatically advance high-scoring candidates"""
        db = get_database()
        
        # Add to Candidates collection
        candidate = {
            "Name": candidate_data.get("name"),
            "Email": candidate_data.get("email"),
            "Phone": candidate_data.get("phone"),
            "Skills": candidate_data.get("skills", []),
            "Status": "Interview Scheduled",
            "JobID": job_id,
            "ScreeningScore": screening_result["score"]["overall_score"],
            "ScreeningResult": screening_result["_id"]
        }
        
        await db["Candidates"].insert_one(candidate)
        
        # Send automated email
        subject = f"Interview Invitation - {candidate_data.get('name')}"
        email_body = f"""Dear {candidate_data.get('name')},

Congratulations! Your application has been shortlisted.

We would like to invite you for an interview. Our team will contact you shortly to schedule a convenient time.

Best regards,
TalentFlow HR Team"""
        
        await send_email(
            candidate_data.get("email", ""),
            subject,
            email_body
        )
    
    async def _notify_hr_review(self, candidate_data: Dict, job_id: str, score: Dict):
        """Notify HR team for manual review"""
        hr_email = settings.SENDER_EMAIL  # Could be configurable
        subject = f"Manual Review Required - {candidate_data.get('name')}"
        email_body = f"""HR Team,

A candidate requires manual review:

Candidate: {candidate_data.get('name')}
Email: {candidate_data.get('email')}
Score: {score.get('overall_score', 0)}/100
Recommendation: {score.get('recommendation', 'maybe')}

Reason: {score.get('reason', 'N/A')}

Please review in the system.
"""
        
        await send_email(hr_email, subject, email_body)

# LangGraph Workflow for Resume Screening
async def route_screening(state: dict) -> Literal["parse_resume", "score_candidate", "save_result", "notify"]:
    """Route screening workflow steps"""
    step = state.get("step", "parse_resume")
    return step

async def parse_resume_node(state: dict):
    """Parse resume text"""
    agent = ResumeScreeningAgent()
    resume_text = state.get("resume_text", "")
    
    candidate_data = await agent.parse_resume(resume_text)
    # Ensure minimum structure in workflow too
    if not candidate_data or not isinstance(candidate_data, dict):
        candidate_data = {}
    candidate_data.setdefault("name", "Unknown")
    candidate_data.setdefault("email", "")
    candidate_data.setdefault("phone", "")
    candidate_data.setdefault("skills", [])
    candidate_data.setdefault("experience_years", 0)
    return {"candidate_data": candidate_data, "step": "score_candidate"}

async def score_candidate_node(state: dict):
    """Score candidate against job"""
    agent = ResumeScreeningAgent()
    candidate_data = state.get("candidate_data", {})
    job_id = state.get("job_id", "")
    
    db = get_database()
    try:
        job = await db["Jobs"].find_one({"JobID": job_id})
        if not job:
            job = await db["Jobs"].find_one({"_id": ObjectId(job_id)})
    except Exception:
        job = None
    
    if not job:
        return {"error": "Job not found", "step": "__end__"}
    
    job_requirements = {
        "required_skills": job.get("RequiredSkills", []),
        "experience_years": job.get("ExperienceRequired", 0),
    }
    
    score = await agent.score_candidate(candidate_data, job_requirements)
    return {"score": score, "step": "save_result"}

async def save_result_node(state: dict):
    """Save screening result"""
    db = get_database()
    candidate_data = state.get("candidate_data", {})
    score = state.get("score", {})
    job_id = state.get("job_id", "")
    
    result = {
        "job_id": job_id,
        "candidate_data": candidate_data,
        "score": score,
        "status": "completed"
    }
    
    await db["Resume_screening"].insert_one(result)
    
    return {"result": result, "step": "notify"}

async def notify_node(state: dict):
    """Send notifications based on score"""
    score = state.get("score", {})
    candidate_data = state.get("candidate_data", {})
    
    if score.get("overall_score", 0) >= 80:
        # High score - notify candidate
        subject = "Interview Invitation"
        body = f"Dear {candidate_data.get('name')}, your application has been shortlisted!"
        await send_email(candidate_data.get("email", ""), subject, body)
    
    return {"step": "__end__"}

def build_screening_graph():
    """Build LangGraph for resume screening"""
    graph = StateGraph(dict)
    
    graph.add_node("parse_resume", parse_resume_node)
    graph.add_node("score_candidate", score_candidate_node)
    graph.add_node("save_result", save_result_node)
    graph.add_node("notify", notify_node)
    
    graph.add_conditional_edges(
        "__start__",
        route_screening,
        {
            "parse_resume": "parse_resume",
            "score_candidate": "score_candidate",
            "save_result": "save_result",
            "notify": "notify"
        }
    )
    
    graph.add_edge("parse_resume", "score_candidate")
    graph.add_edge("score_candidate", "save_result")
    graph.add_edge("save_result", "notify")
    graph.add_edge("notify", "__end__")
    
    return graph.compile()

