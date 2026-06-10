import io
from fpdf import FPDF
from docx import Document

def export_to_pdf(text: str) -> io.BytesIO:
    """
    Exports plain text or basic markdown text to a PDF file buffer.
    """
    pdf = FPDF()
    pdf.add_page()
    
    # Use a standard font that supports basic characters well
    pdf.set_font("Arial", size=11)
    
    # Clean up text for FPDF (which uses latin-1 or similar by default without custom fonts)
    # Replaces some smart quotes or unicode chars with simple ascii equivalents if possible
    text = text.replace('"', '"').replace('"', '"').replace("'", "'").replace("'", "'")
    text = text.encode('latin-1', 'replace').decode('latin-1')
    
    # Split text into lines to handle newlines, or use multi_cell
    # multi_cell handles line wrapping automatically
    pdf.multi_cell(0, 7, txt=text)
    
    # Get the PDF bytes
    pdf_bytes = pdf.output(dest='S')
    
    # Wrap in BytesIO (fpdf2 returns a bytearray)
    buffer = io.BytesIO(bytes(pdf_bytes))
    buffer.seek(0)
    return buffer

def export_to_docx(text: str) -> io.BytesIO:
    """
    Exports plain text or basic markdown text to a DOCX file buffer.
    """
    doc = Document()
    
    # Split text by newlines and add as paragraphs
    for line in text.split('\n'):
        doc.add_paragraph(line)
        
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer
