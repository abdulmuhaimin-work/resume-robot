console.log("[Popup] Popup script loaded");

document.addEventListener('DOMContentLoaded', function() {
  console.log("[Popup] DOM Content Loaded");
  const uploadResumeBtn = document.getElementById('uploadResume');
  const fileInput = document.getElementById('resumeFileInput');
  const connectLinkedInBtn = document.getElementById('connectLinkedIn');
  const toggleAutoFillBtn = document.getElementById('toggleAutoFill');
  const testFillBtn = document.getElementById('testFill');
  const statusDiv = document.getElementById('status');

  console.log("[Popup] File input element found:", fileInput);

  // Add click listener to document to monitor all clicks
  document.addEventListener('click', function(e) {
    console.log("[Popup] Document click event:", e.target);
  });

  // Set up MutationObserver to watch for file input changes
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      console.log("[Popup] Mutation observed:", mutation);
      if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
        console.log("[Popup] File input value changed");
        handleFileSelection(fileInput.files[0]);
      }
    });
  });

  observer.observe(fileInput, {
    attributes: true,
    attributeFilter: ['value']
  });

  // Test data for form filling
  const testData = {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "123-456-7890",
    linkedin: "https://linkedin.com/in/johndoe",
    experience: "5 years of software development experience",
    skills: "JavaScript, Python, React, Node.js"
  };

  // Handle resume upload
  uploadResumeBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("[Popup] Upload button clicked");
    
    // Create a new file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx';
    
    input.onchange = function(e) {
      const file = e.target.files[0];
      if (file) {
        console.log("[Popup] File selected:", {
          name: file.name,
          type: file.type,
          size: file.size
        });
        handleFileSelection(file);
      }
    };
    
    input.click();
  };

  // Handle file input click
  fileInput.onclick = function(e) {
    console.log("[Popup] File input clicked");
    e.stopPropagation();
  };

  // Function to handle file selection
  function handleFileSelection(file) {
    if (!file) {
      console.log("[Popup] No file selected");
      return;
    }

    console.log("[Popup] File selected:", {
      name: file.name,
      type: file.type,
      size: file.size
    });
    
    statusDiv.textContent = 'Status: Processing resume...';
    
    // Read the file content
    const reader = new FileReader();
    reader.onload = function(e) {
      console.log("[Popup] File read successfully");
      const content = e.target.result;
      
      // Send message to background script to process resume
      chrome.runtime.sendMessage({
        action: 'processResume',
        file: {
          name: file.name,
          type: file.type,
          size: file.size
        }
      }, response => {
        console.log("[Popup] Process resume response:", response);
        if (chrome.runtime.lastError) {
          console.error("[Popup] Error sending processResume message:", chrome.runtime.lastError);
          statusDiv.textContent = 'Status: Error processing resume. Please try again.';
          return;
        }

        if (response && response.success) {
          // Now send the file content
          chrome.runtime.sendMessage({
            action: 'processResumeContent',
            content: content,
            fileType: file.type
          }, response => {
            console.log("[Popup] Process resume content response:", response);
            if (chrome.runtime.lastError) {
              console.error("[Popup] Error sending processResumeContent message:", chrome.runtime.lastError);
              statusDiv.textContent = 'Status: Error processing resume content. Please try again.';
              return;
            }

            if (response && response.success) {
              statusDiv.textContent = 'Status: Resume processed successfully!';
              console.log("[Popup] Resume processed successfully, data:", response.data);
              
              // Store the processed resume data
              chrome.storage.local.set({ 'resumeData': response.data }, function() {
                console.log("[Popup] Resume data stored in chrome.storage");
              });
              
              // Enable the auto-fill button after successful upload
              toggleAutoFillBtn.disabled = false;
            } else {
              statusDiv.textContent = 'Status: Error processing resume content. Please try again.';
              console.error('[Popup] Error processing resume content:', response?.error);
            }
          });
        } else {
          statusDiv.textContent = 'Status: Error processing resume. Please try again.';
          console.error('[Popup] Error processing resume:', response?.error);
        }
      });
    };
    
    reader.onerror = function(e) {
      console.error("[Popup] Error reading file:", e);
      statusDiv.textContent = 'Status: Error reading file. Please try again.';
    };
    
    console.log("[Popup] Starting to read file");
    if (file.type === 'application/pdf') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  // Handle test fill button
  testFillBtn.addEventListener('click', () => {
    console.log("[Popup] Test fill button clicked");
    statusDiv.textContent = 'Status: Filling form with resume data...';
    
    // Get the stored resume data
    chrome.storage.local.get(['resumeData'], function(result) {
      if (chrome.runtime.lastError) {
        console.error("[Popup] Error getting resume data:", chrome.runtime.lastError);
        statusDiv.textContent = 'Status: Error accessing resume data. Please try again.';
        return;
      }

      const resumeData = result.resumeData;
      if (!resumeData) {
        console.error("[Popup] No resume data found");
        statusDiv.textContent = 'Status: No resume data found. Please upload a resume first.';
        return;
      }

      // Get the active tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
          console.error("[Popup] Error querying tabs:", chrome.runtime.lastError);
          statusDiv.textContent = 'Status: Error accessing current tab. Please try again.';
          return;
        }

        if (!tabs || !tabs[0]) {
          console.error("[Popup] No active tab found");
          statusDiv.textContent = 'Status: No active tab found. Please try again.';
          return;
        }

        // Send message to content script with resume data
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'fillForm',
          data: resumeData
        }, response => {
          if (chrome.runtime.lastError) {
            console.error("[Popup] Error sending message to content script:", chrome.runtime.lastError);
            statusDiv.textContent = 'Status: Error communicating with page. Please try again.';
            return;
          }

          console.log("[Popup] Fill form response:", response);
          if (response && response.success) {
            statusDiv.textContent = 'Status: Form filled successfully!';
          } else {
            statusDiv.textContent = 'Status: Error filling form. Please try again.';
            console.error('[Popup] Error filling form:', response?.error);
          }
        });
      });
    });
  });

  // Handle LinkedIn connection
  connectLinkedInBtn.addEventListener('click', () => {
    console.log("[Popup] LinkedIn connection button clicked");
    statusDiv.textContent = 'Status: Connecting to LinkedIn...';
    chrome.runtime.sendMessage({
      action: 'connectLinkedIn'
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("[Popup] Error connecting to LinkedIn:", chrome.runtime.lastError);
        statusDiv.textContent = 'Status: Error connecting to LinkedIn. Please try again.';
        return;
      }

      if (response && response.success) {
        statusDiv.textContent = 'Status: Connected to LinkedIn!';
        // Enable the auto-fill button after successful LinkedIn connection
        toggleAutoFillBtn.disabled = false;
      } else {
        statusDiv.textContent = 'Status: LinkedIn connection failed. Please try again.';
        console.error('[Popup] LinkedIn connection failed:', response?.error);
      }
    });
  });

  // Handle auto-fill toggle
  let autoFillEnabled = false;
  toggleAutoFillBtn.addEventListener('click', () => {
    console.log("[Popup] Auto-fill toggle button clicked");
    autoFillEnabled = !autoFillEnabled;
    toggleAutoFillBtn.textContent = autoFillEnabled ? 'Disable Auto-fill' : 'Enable Auto-fill';
    chrome.runtime.sendMessage({
      action: 'toggleAutoFill',
      enabled: autoFillEnabled
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("[Popup] Error toggling auto-fill:", chrome.runtime.lastError);
        statusDiv.textContent = 'Status: Error toggling auto-fill. Please try again.';
        return;
      }

      if (response && response.success) {
        statusDiv.textContent = `Status: Auto-fill ${autoFillEnabled ? 'enabled' : 'disabled'}`;
      } else {
        statusDiv.textContent = 'Status: Error toggling auto-fill. Please try again.';
        console.error('[Popup] Error toggling auto-fill:', response?.error);
      }
    });
  });

  // Initially disable the auto-fill button until resume is uploaded or LinkedIn is connected
  toggleAutoFillBtn.disabled = true;
}); 