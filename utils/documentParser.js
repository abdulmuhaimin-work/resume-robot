import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function parsePDF(arrayBuffer) {
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    console.log(fullText);

    return fullText;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

export async function parseDOC(arrayBuffer) {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error parsing DOC:', error);
    throw error;
  }
}

export async function parseDocument(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        // For now, just return the raw text
        // In a real implementation, you would use a PDF or DOC parser library
        resolve(e.target.result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = function(error) {
      reject(error);
    };
    
    reader.readAsText(file);
  });
} 