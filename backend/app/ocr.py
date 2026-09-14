"""Document text extraction: PDF text layer + Tesseract OCR for images / scanned pages."""
import io
import pdfplumber
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes


def _ocr_image_bytes(data: bytes, lang: str = "eng") -> str:
    img = Image.open(io.BytesIO(data))
    return pytesseract.image_to_string(img, lang=lang)


def extract_text(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Extract text from PDF or image. Falls back to OCR for scanned PDFs."""
    name = (filename or "").lower()
    is_pdf = name.endswith(".pdf") or (content_type or "").endswith("pdf")

    if is_pdf:
        text_parts = []
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for page in pdf.pages:
                    t = page.extract_text() or ""
                    text_parts.append(t)
        except Exception:
            text_parts = []
        joined = "\n".join(text_parts).strip()
        # If the PDF has little/no text layer, treat it as scanned -> OCR each page.
        if len(joined) < 40:
            try:
                images = convert_from_bytes(file_bytes, dpi=200)
                ocr_parts = []
                for im in images:
                    ocr_parts.append(pytesseract.image_to_string(im))
                joined = "\n".join(ocr_parts).strip()
            except Exception:
                pass
        return joined

    # Image file -> OCR
    try:
        return _ocr_image_bytes(file_bytes).strip()
    except Exception:
        return ""
