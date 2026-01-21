// legacy/legacy.js
document.addEventListener('DOMContentLoaded', async function() {
  // Check if user is authenticated
  try {
    const response = await fetch('/api/legacy/get', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.status === 401) {
      // Not authenticated - redirect to login
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/login.html?next=${next}`;
      return;
    }
    
    if (!response.ok) {
      throw new Error('Failed to load legacy plan');
    }
    
    const data = await response.json();
    if (data.ok) {
      // User is authenticated, load legacy UI
      initializeLegacyUI(data.plan);
    } else {
      showError(data.error || 'Authentication failed');
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/login.html?next=${next}`;
  }
});

function initializeLegacyUI(plan) {
  console.log('Legacy UI initialized with plan:', plan);
  
  // Update UI to show user is authenticated
  document.body.classList.add('authenticated');
  
  // Load existing plan data into form if exists
  if (plan) {
    loadPlanIntoForm(plan);
  }
  
  // Setup save button
  const saveButton = document.getElementById('saveLegacyPlan');
  if (saveButton) {
    saveButton.addEventListener('click', saveLegacyPlan);
  }
}

function loadPlanIntoForm(plan) {
  // Implement based on your form structure
  if (plan.fullName) {
    const nameInput = document.getElementById('fullName');
    if (nameInput) nameInput.value = plan.fullName;
  }
  
  if (plan.instructions) {
    const instructionsTextarea = document.getElementById('instructions');
    if (instructionsTextarea) instructionsTextarea.value = plan.instructions;
  }
  
  // Update status display
  updatePlanStatus('loaded');
}

async function saveLegacyPlan() {
  const saveButton = document.getElementById('saveLegacyPlan');
  const statusElement = document.getElementById('saveStatus');
  
  // Collect form data
  const planData = {
    fullName: document.getElementById('fullName')?.value || '',
    instructions: document.getElementById('instructions')?.value || '',
    beneficiaries: [], // Add your beneficiary collection logic
    trustees: [], // Add your trustee collection logic
    timestamp: Date.now()
  };
  
  // Show loading
  saveButton.disabled = true;
  if (statusElement) {
    statusElement.textContent = 'Saving...';
    statusElement.className = 'status-loading';
  }
  
  try {
    const response = await fetch('/api/legacy/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ plan: planData })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      // Success
      if (statusElement) {
        statusElement.textContent = '✓ Plan saved successfully!';
        statusElement.className = 'status-success';
      }
      
      // Store locally for quick access
      localStorage.setItem('legacyPlan_lastSaved', Date.now().toString());
      localStorage.setItem('legacyPlan_data', JSON.stringify(planData));
      
      // Redirect to dashboard after success
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1500);
    } else {
      // Error
      throw new Error(data.error || 'Save failed');
    }
  } catch (error) {
    console.error('Save failed:', error);
    if (statusElement) {
      statusElement.textContent = `✗ Error: ${error.message}`;
      statusElement.className = 'status-error';
    }
  } finally {
    saveButton.disabled = false;
  }
}

function updatePlanStatus(status) {
  const statusElement = document.getElementById('planStatus');
  if (!statusElement) return;
  
  switch(status) {
    case 'loaded':
      statusElement.textContent = '✓ Plan loaded from your account';
      statusElement.className = 'status-loaded';
      break;
    case 'saving':
      statusElement.textContent = 'Saving...';
      statusElement.className = 'status-saving';
      break;
    case 'saved':
      statusElement.textContent = '✓ Plan saved successfully';
      statusElement.className = 'status-saved';
      break;
    case 'error':
      statusElement.textContent = '✗ Error loading plan';
      statusElement.className = 'status-error';
      break;
  }
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `
    <h3>Authentication Required</h3>
    <p>${message}</p>
    <a href="/login.html?next=${encodeURIComponent(window.location.pathname)}" class="btn">
      Log In to Continue
    </a>
  `;
  
  const container = document.querySelector('.container') || document.body;
  container.innerHTML = '';
  container.appendChild(errorDiv);
}
