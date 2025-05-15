// Add a visual indicator that the content script is running
const indicator = document.createElement('div');
indicator.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: #4CAF50;
  color: white;
  padding: 10px;
  border-radius: 5px;
  z-index: 9999;
  font-family: Arial, sans-serif;
`;
indicator.textContent = 'Resume Robot is running!';
document.body.appendChild(indicator);

// Store form field mappings
const fieldMappings = {
  'name': ['name', 'full name', 'fullname', 'applicant name'],
  'email': ['email', 'e-mail', 'email address'],
  'phone': ['phone', 'telephone', 'mobile', 'cell', 'contact number'],
  'address': ['address', 'street address', 'location'],
  'city': ['city', 'town'],
  'state': ['state', 'province', 'region'],
  'zip': ['zip', 'postal code', 'zip code'],
  'country': ['country', 'nation'],
  'linkedin': ['linkedin', 'linkedin profile', 'linkedin url'],
  'github': ['github', 'github profile', 'github url'],
  'portfolio': ['portfolio', 'website', 'personal website'],
  'experience': ['experience', 'work experience', 'employment history'],
  'education': ['education', 'academic background', 'qualifications'],
  'skills': ['skills', 'technical skills', 'competencies']
};

// Initialize content script
console.log("[Content] Content script initialized");

// Keep track of active message handlers
const activeHandlers = new Set();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Content] Message received:", request);

  // Create a unique ID for this message handler
  const handlerId = Date.now();
  activeHandlers.add(handlerId);

  // Wrap everything in a Promise to ensure proper async handling
  const handleMessage = async () => {
    try {
      if (!request || !request.action) {
        console.error("[Content] Invalid message received:", request);
        sendResponse({ success: false, error: "Invalid message format" });
        return;
      }

      if (request.action === 'fillForm') {
        if (!request.data) {
          console.error("[Content] No data provided for fillForm action");
          sendResponse({ success: false, error: "No data provided" });
          return;
        }

        console.log("[Content] Attempting to fill form with data:", request.data);
        
        // Get all form fields
        const formFields = detectFormFields();
        console.log("[Content] Detected form fields:", formFields);

        if (formFields.length === 0) {
          console.log("[Content] No form fields detected");
          sendResponse({ success: false, error: "No form fields detected" });
          return;
        }

        // Fill each field
        let filledCount = 0;
        const errors = [];

        for (const field of formFields) {
          try {
            const fieldData = determineFieldData(field, request.data);
            if (fieldData) {
              fillField(field, fieldData);
              filledCount++;
              console.log(`[Content] Filled field ${field.purpose} with value:`, fieldData);
            }
          } catch (fieldError) {
            console.error("[Content] Error filling field:", fieldError);
            errors.push({
              field: field.purpose,
              error: fieldError.message
            });
          }
        }

        console.log(`[Content] Filled ${filledCount} fields, ${errors.length} errors`);
        sendResponse({ 
          success: true, 
          filledCount,
          errors: errors.length > 0 ? errors : undefined
        });
        return;
      }

      // Unknown action
      console.warn("[Content] Unknown action received:", request.action);
      sendResponse({ success: false, error: "Unknown action" });
    } catch (error) {
      console.error("[Content] Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    } finally {
      // Clean up the handler
      activeHandlers.delete(handlerId);
    }
  };

  // Execute the handler and return true to indicate async response
  handleMessage().catch(error => {
    console.error("[Content] Unhandled error in message handler:", error);
    sendResponse({ success: false, error: "Unhandled error in message handler" });
    activeHandlers.delete(handlerId);
  });

  return true; // Keep the message channel open for async response
});

// Function to detect form fields
function detectFormFields() {
  console.log("[Content] Detecting form fields...");
  const formFields = document.querySelectorAll('input, textarea, select');
  const detectedFields = [];

  formFields.forEach(field => {
    try {
      const fieldInfo = {
        element: field,
        type: field.type || field.tagName.toLowerCase(),
        name: field.name,
        id: field.id,
        label: findLabel(field),
        placeholder: field.placeholder
      };

      // Try to determine the field's purpose
      const purpose = determineFieldPurpose(fieldInfo);
      if (purpose) {
        fieldInfo.purpose = purpose;
        detectedFields.push(fieldInfo);
        console.log(`[Content] Detected field: ${purpose} (${fieldInfo.type})`);
      }
    } catch (fieldError) {
      console.error("[Content] Error processing field:", fieldError);
    }
  });

  console.log("[Content] Detected fields:", detectedFields);
  return detectedFields;
}

// Function to find associated label for a field
function findLabel(field) {
  try {
    // Try to find label by for attribute
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Try to find parent label
    const parentLabel = field.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();

    // Try to find preceding label
    const precedingLabel = field.previousElementSibling;
    if (precedingLabel && precedingLabel.tagName === 'LABEL') {
      return precedingLabel.textContent.trim();
    }

    return '';
  } catch (error) {
    console.error("[Content] Error finding label:", error);
    return '';
  }
}

// Function to determine field purpose
function determineFieldPurpose(fieldInfo) {
  try {
    const text = [
      fieldInfo.name,
      fieldInfo.id,
      fieldInfo.label,
      fieldInfo.placeholder
    ].join(' ').toLowerCase();

    for (const [purpose, keywords] of Object.entries(fieldMappings)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return purpose;
      }
    }

    return null;
  } catch (error) {
    console.error("[Content] Error determining field purpose:", error);
    return null;
  }
}

// Function to fill a single field
function fillField(field, value) {
  try {
    const element = field.element;
    console.log(`[Content] Filling field ${field.purpose} with value:`, value);
    
    // Handle different field types
    switch (element.type) {
      case 'checkbox':
        element.checked = value;
        break;
      case 'radio':
        const radio = document.querySelector(`input[type="radio"][name="${element.name}"][value="${value}"]`);
        if (radio) radio.checked = true;
        break;
      case 'select-one':
        const option = Array.from(element.options).find(opt => 
          opt.text.toLowerCase().includes(value.toLowerCase())
        );
        if (option) element.value = option.value;
        break;
      default:
        element.value = value;
        // Trigger change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch (error) {
    console.error("[Content] Error filling field:", error);
    throw error; // Re-throw to be caught by the caller
  }
}

// Function to determine field data from user data
function determineFieldData(field, userData) {
  try {
    if (field.purpose && userData[field.purpose]) {
      return userData[field.purpose];
    }
    return null;
  } catch (error) {
    console.error("[Content] Error determining field data:", error);
    return null;
  }
}

// Listen for form submissions to learn from manual corrections
document.addEventListener('submit', function(e) {
  try {
    console.log("[Content] Form submitted, collecting data...");
    const form = e.target;
    const fields = detectFormFields();
    const formData = {};

    fields.forEach(field => {
      if (field.purpose) {
        formData[field.purpose] = field.element.value;
      }
    });

    console.log("[Content] Sending form data to background script:", formData);
    // Send the form data to the background script for learning
    chrome.runtime.sendMessage({
      action: 'learnFromSubmission',
      data: formData
    }).catch(error => {
      console.error("[Content] Error sending form data:", error);
    });
  } catch (error) {
    console.error("[Content] Error handling form submission:", error);
  }
}); 