import smtplib
import re
from email.message import EmailMessage
import logging

from app.core.config import settings
from app.services.llama_client import LlamaModel

logger = logging.getLogger(__name__)

llama_model = LlamaModel()

async def send_email(recipient_email: str, subject: str, user_query: str) -> dict:
    """Send email using SMTP"""
    prompt = f"""You are an HR assistant writing a professional email.

Email Details:
- Recipient: {recipient_email}
- Subject: {subject}
- Context: {user_query}

Write a complete, professional email body based on the subject line.
- Use proper greeting and closing
- Be professional and concise
- Match the tone to the subject
- Don't include the subject line in the body

Respond with ONLY the email body text."""

    try:
        # Generate email body with Llama
        response = llama_model.generate_content(prompt)
        email_body = response.text.strip()

        # Create email message
        msg = EmailMessage()
        msg['From'] = settings.SENDER_EMAIL
        msg['To'] = recipient_email
        msg['Subject'] = subject
        msg.set_content(email_body)

        # Send email
        try:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
                smtp.login(settings.SENDER_EMAIL, settings.SENDER_APP_PASSWORD)
                smtp.send_message(msg)

            return {
                "success": True,
                "message": f"✅ Email sent successfully to {recipient_email}",
                "content": email_body,
                "recipient": recipient_email,
                "subject": subject
            }
        except smtplib.SMTPAuthenticationError:
            return {
                "success": False,
                "message": "⚠️ Authentication Failed. Check SENDER_EMAIL and SENDER_APP_PASSWORD.",
                "content": email_body,
                "error": "SMTPAuthenticationError"
            }
        except Exception as smtp_error:
            return {
                "success": False,
                "message": f"⚠️ Email Sending Failed: {smtp_error}",
                "content": email_body,
                "error": str(smtp_error)
            }

    except Exception as e:
        logger.error(f"Email service error: {e}")
        return {
            "success": False,
            "message": f"⚠️ Error generating email: {e}",
            "error": str(e)
        }

def extract_email_info(user_query: str) -> tuple:
    """Extract email and subject from user query"""
    email_match = re.search(r"(?:email\s*id|to|email)\s*[:\-]?\s*(\S+@\S+)", user_query, re.IGNORECASE)
    subject_match = re.search(r"subject\s*[:\-]?\s*(.+?)(?:$|\n)", user_query, re.IGNORECASE)
    
    recipient_email = email_match.group(1).strip() if email_match else None
    subject = subject_match.group(1).strip() if subject_match else None
    
    return recipient_email, subject

