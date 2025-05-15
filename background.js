console.log("[Background] Background script loaded");

// Import PDF.js
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Store user data
let userData = {
  resume: null,
  linkedin: null,
  learnedData: {}
};

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Background] Received message:", request.action);

  switch (request.action) {
    case 'processResume':
      console.log("[Background] Processing resume file:", request.file);
      try {
        // Store basic file info
        userData.resume = {
          name: request.file.name,
          type: request.file.type,
          size: request.file.size,
          timestamp: new Date().toISOString()
        };
        console.log("[Background] Stored basic file info:", userData.resume);
        sendResponse({ success: true });
      } catch (error) {
        console.error("[Background] Error in processResume:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;

    case 'processResumeContent':
      console.log("[Background] Processing resume content, file type:", request.fileType);
      try {
        if (!request.content) {
          throw new Error("No content received");
        }

        // Convert ArrayBuffer to Uint8Array
        const content = new Uint8Array(request.content);
        console.log("[Background] Content length:", content.length);

        if (content.length === 0) {
          throw new Error("Empty content received");
        }

        // Create a Blob from the content
        const blob = new Blob([content], { type: request.fileType });
        console.log("[Background] Created blob:", {
          type: blob.type,
          size: blob.size
        });
        
        // Read the content as text
        const reader = new FileReader();
        reader.onload = async function(e) {
          try {
            let text;
            console.log("[Background] File type:", request.fileType);
            
            if (request.fileType === 'application/pdf') {
              console.log("[Background] Processing PDF file");
              try {
                const pdf = await pdfjsLib.getDocument({ data: content }).promise;
                console.log("[Background] PDF loaded, pages:", pdf.numPages);
                text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                  console.log(`[Background] Processing page ${i}`);
                  const page = await pdf.getPage(i);
                  const textContent = await page.getTextContent();
                  text += textContent.items.map(item => item.str).join(' ') + '\n';
                }
              } catch (pdfError) {
                console.error("[Background] PDF processing error:", pdfError);
                throw new Error("Failed to process PDF: " + pdfError.message);
              }
            } else {
              console.log("[Background] Processing text file");
              text = e.target.result;
            }

            if (!text || text.trim().length === 0) {
              throw new Error("No text content extracted from file");
            }

            console.log("[Background] Resume text extracted, first 100 chars:", text.substring(0, 100));

            // Parse the text to extract information
            const parsedData = parseResumeText(text);
            console.log("[Background] Parsed resume data:", parsedData);

            // Update userData with parsed information
            userData.resume = {
              ...userData.resume,
              content: text,
              parsedData: parsedData
            };

            // Store the processed data
            chrome.storage.local.set({ userData }, () => {
              console.log("[Background] User data saved to storage");
              if (chrome.runtime.lastError) {
                console.error("[Background] Error saving to storage:", chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse({ success: true, data: parsedData });
              }
            });
          } catch (error) {
            console.error("[Background] Error processing resume content:", error);
            sendResponse({ success: false, error: error.message });
          }
        };

        reader.onerror = function(error) {
          console.error("[Background] Error reading resume content:", error);
          sendResponse({ success: false, error: "Failed to read resume content: " + error.message });
        };

        reader.onprogress = function(e) {
          if (e.lengthComputable) {
            const percentLoaded = Math.round((e.loaded / e.total) * 100);
            console.log(`[Background] Text extraction progress: ${percentLoaded}%`);
          }
        };

        console.log("[Background] Starting to read blob as text");
        reader.readAsText(blob);
        return true; // Keep the message channel open for async response
      } catch (error) {
        console.error("[Background] Error in processResumeContent:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;

    case 'connectLinkedIn':
      console.log("Connecting to LinkedIn");
      // Here you would implement LinkedIn authentication
      // For now, we'll just simulate a successful connection
      userData.linkedin = {
        connected: true,
        timestamp: new Date().toISOString()
      };
      chrome.storage.local.set({ userData }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error saving LinkedIn data:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true;

    case 'toggleAutoFill':
      console.log("Auto-fill toggled:", request.enabled);
      // Store the auto-fill preference
      chrome.storage.local.set({ autoFillEnabled: request.enabled }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error saving auto-fill preference:", chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true;

    case 'learnFromSubmission':
      console.log("Learning from form submission");
      // Here you would implement the learning algorithm
      // For now, we'll just store the submission data
      if (!userData.learningData) {
        userData.learningData = [];
      }
      userData.learningData.push({
        data: request.data,
        timestamp: new Date().toISOString()
      });
      chrome.storage.local.set({ userData }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error saving learning data:", chrome.runtime.lastError);
        }
      });
      break;
  }
});

// Function to parse resume text and extract information
function parseResumeText(text) {
  const data = {
    name: extractName(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    skills: extractSkills(text),
    experience: extractExperience(text),
    education: extractEducation(text),
    location: extractLocation(text)
  };

  console.log("Extracted data:", data);
  return data;
}

// Helper functions for text extraction
function extractName(text) {
  // Look for name patterns at the start of the document
  const namePatterns = [
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m,  // Standard name format
    /^Name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/im,  // Name: format
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*[-|]/m  // Name followed by separator
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractEmail(text) {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  return emailMatch ? emailMatch[0] : null;
}

function extractPhone(text) {
  const phonePatterns = [
    /(?:\+?\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/,  // Standard phone
    /Phone:?\s*(?:\+?\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/i,  // Phone: format
    /Tel:?\s*(?:\+?\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/i  // Tel: format
  ];

  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) return match[0].replace(/^(?:Phone|Tel):?\s*/i, '');
  }
  return null;
}

function extractSkills(text) {
  // Look for skills section with various headers
  const skillPatterns = [
    /(?:skills|technical skills|competencies|expertise)[:]\s*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i,
    /(?:skills|technical skills|competencies|expertise)[:]\s*([\s\S]*?)(?=\n\s*[A-Z][a-z]+:)/i
  ];

  for (const pattern of skillPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1]
        .split(/[,•|]/)
        .map(skill => skill.trim())
        .filter(Boolean)
        .filter(skill => skill.length > 1);  // Filter out single characters
    }
  }
  return [];
}

function extractExperience(text) {
  const experiencePatterns = [
    /(?:experience|work experience|employment|professional experience)[:]\s*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i,
    /(?:experience|work experience|employment|professional experience)[:]\s*([\s\S]*?)(?=\n\s*[A-Z][a-z]+:)/i
  ];

  for (const pattern of experiencePatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractEducation(text) {
  const educationPatterns = [
    /(?:education|academic background|qualifications)[:]\s*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i,
    /(?:education|academic background|qualifications)[:]\s*([\s\S]*?)(?=\n\s*[A-Z][a-z]+:)/i
  ];

  for (const pattern of educationPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractLocation(text) {
  const locationPatterns = [
    /(?:location|address|city|location:)\s*([\s\S]*?)(?:\n|$)/i,
    /(?:based in|located in)\s*([\s\S]*?)(?:\n|$)/i
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

// Load saved data when extension starts
chrome.storage.local.get(['userData'], (result) => {
  if (result.userData) {
    userData = result.userData;
    console.log("Loaded saved user data:", userData);
  }
}); 