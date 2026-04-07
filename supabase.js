// Supabase configuration
const SUPABASE_URL = 'https://jvysmxdkiynzqlnzidze.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2eXNteGRraXluenFsbnppZHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NzE0NTEsImV4cCI6MjA4NzM0NzQ1MX0.HaKg31YZg_lKoVz5NxWkAq-N3T1Gt2DTk3ZYfFW_TqY';

// Initialize Supabase client with error handling
let _supabase;
try {
    if (typeof supabase === 'undefined') {
        throw new Error('Supabase SDK not loaded. Please check your internet connection and CDN link.');
    }

    const { createClient } = supabase;
    if (typeof createClient !== 'function') {
        throw new Error('Supabase createClient function not available.');
    }

    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully');
} catch (error) {
    console.error('Error initializing Supabase client:', error);
    // Create a mock client for error handling
    _supabase = {
        auth: {
            getUser: () => Promise.reject(new Error('Supabase not initialized: ' + error.message)),
            signUp: () => Promise.reject(new Error('Supabase not initialized: ' + error.message)),
            signInWithPassword: () => Promise.reject(new Error('Supabase not initialized: ' + error.message)),
            signOut: () => Promise.reject(new Error('Supabase not initialized: ' + error.message))
        },
        from: () => ({
            select: () => Promise.reject(new Error('Supabase not initialized: ' + error.message)),
            insert: () => Promise.reject(new Error('Supabase not initialized: ' + error.message)),
            upsert: () => Promise.reject(new Error('Supabase not initialized: ' + error.message)),
            delete: () => Promise.reject(new Error('Supabase not initialized: ' + error.message)),
            eq: () => ({ select: () => Promise.reject(new Error('Supabase not initialized: ' + error.message)) }),
            single: () => Promise.reject(new Error('Supabase not initialized: ' + error.message))
        })
    };
}

// Function to register a new user
async function registerUser(username, email, password, company) {
    try {
        // Sign up the user
        const { data, error } = await _supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            throw error;
        }

        // Wait a moment for auth to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the current user
        const { data: { user } } = await _supabase.auth.getUser();

        if (user) {
            // Store additional user info in the database
            const { data: profileData, error: profileError } = await _supabase
                .from('profiles')
                .upsert([
                    {
                        id: user.id,
                        username: username,
                        company: company,
                    },
                ], {
                    onConflict: 'id'
                });

            if (profileError) {
                throw profileError;
            }

            return { success: true, message: 'Registration successful!' };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Function to log in a user
async function loginUser(email, password) {
    try {
        const { data, error } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            throw error;
        }

        // Get user profile information
        const { data: profile, error: profileError } = await _supabase
            .from('profiles')
            .select('company')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            throw profileError;
        }

        return {
            success: true,
            user: {
                ...data.user,
                company: profile.company,
            },
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Function to trigger a workflow via webhook
async function triggerWorkflow(workflowId) {
    console.log('Global triggerWorkflow called with ID:', workflowId);

    try {
        // Validate input
        if (!workflowId) {
            console.error('Workflow ID is required');
            return { success: false, message: 'Workflow ID is required' };
        }

        // Sanitize workflow ID - remove any whitespace or special characters that might cause issues
        const sanitizedWorkflowId = workflowId.trim();
        if (!sanitizedWorkflowId) {
            console.error('Workflow ID is required (after sanitization)');
            return { success: false, message: 'Workflow ID is required (after sanitization)' };
        }

        // Construct the n8n webhook URL
        const n8nWebhookUrl = `https://ef0ps4gk.rcsrv.net/webhook/${encodeURIComponent(sanitizedWorkflowId)}`;

        console.log(`Triggering workflow with URL: ${n8nWebhookUrl}`);
        console.log(`Original workflow ID: "${workflowId}", Sanitized: "${sanitizedWorkflowId}"`);

        // Test if we can even make the request
        console.log('Attempting to trigger workflow...');

        // Make the actual API call to trigger the workflow with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        // Add more detailed logging
        console.log('About to make fetch request...');

        const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
            // Add a simple body to ensure the request is properly formed
            body: JSON.stringify({
                triggeredBy: 'social-media-automation',
                workflowId: sanitizedWorkflowId,
                timestamp: new Date().toISOString()
            })
        });

        clearTimeout(timeoutId);

        console.log('Fetch request completed');
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        console.log('Response headers:', [...response.headers.entries()]);

        // Try to get response text regardless of status
        const responseText = await response.text();
        console.log('Response text:', responseText);

        // Check if the request was successful
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            console.error('Response text:', responseText);
            return {
                success: false,
                message: `Server error: ${response.status} - ${response.statusText}`,
                details: responseText.substring(0, 200) // First 200 chars of response
            };
        }

        // Try to parse response data, but handle if it's empty or invalid
        let result = {};
        if (responseText) {
            try {
                result = JSON.parse(responseText);
                console.log('Parsed JSON response:', result);
            } catch (parseError) {
                console.warn('Could not parse response as JSON, using raw text');
                result = { message: 'Workflow triggered successfully', rawResponse: responseText };
            }
        } else {
            result = { message: 'Workflow triggered successfully (empty response)' };
        }

        console.log('Returning success result');
        return {
            success: true,
            message: `Workflow ${sanitizedWorkflowId} triggered successfully!`,
            data: result
        };
    } catch (error) {
        console.error('Error triggering workflow:', error);
        console.error('Error stack:', error.stack);

        // Handle different types of errors with more specificity
        if (error.name === 'AbortError') {
            return { success: false, message: 'Request timed out. Please check your internet connection or n8n server.' };
        } else if (error.message.includes('Failed to fetch')) {
            return { success: false, message: 'Network error. Please check your internet connection and ensure the n8n server is accessible.', errorDetails: error.toString() };
        } else if (error.message.includes('CORS')) {
            return { success: false, message: 'CORS error. The server is not allowing requests from this domain.', errorDetails: error.toString() };
        } else {
            // Provide more detailed error information
            const errorMessage = error.message || 'Unknown error occurred';
            return { success: false, message: `Error: ${errorMessage}`, errorDetails: error.toString() };
        }
    }
}

// Expose the function globally with a check to avoid conflicts
if (typeof window.triggerWorkflow !== 'function') {
    // Add a safety check to prevent infinite recursion
    triggerWorkflow.callCount = 0;
    const originalTriggerWorkflow = triggerWorkflow;

    window.triggerWorkflow = async function(workflowId) {
        // Prevent infinite recursion
        if (triggerWorkflow.callCount > 10) {
            console.error('Infinite recursion detected in triggerWorkflow');
            return { success: false, message: 'Infinite recursion detected' };
        }

        triggerWorkflow.callCount++;
        try {
            return await originalTriggerWorkflow.call(this, workflowId);
        } finally {
            triggerWorkflow.callCount--;
        }
    };

    console.log('triggerWorkflow function exposed globally with recursion protection');
} else {
    console.warn('triggerWorkflow function already exists, not overwriting');
    // Log the existing function for debugging
    console.log('Existing triggerWorkflow function:', window.triggerWorkflow);
}

// Test function to check if everything is working
window.testWorkflowTrigger = async function testWorkflowTrigger() {
    console.log('Testing workflow trigger function...');
    console.log('triggerWorkflow function exists:', typeof window.triggerWorkflow === 'function');
    if (typeof window.triggerWorkflow === 'function') {
        console.log('Function is properly exposed globally');
        // Test with a simple workflow ID
        try {
            console.log('Testing with workflow ID: "test"');
            const result = await window.triggerWorkflow('test');
            console.log('Test result:', result);
            return result;
        } catch (error) {
            console.error('Test failed:', error);
            return { success: false, message: 'Test failed: ' + error.message };
        }
    } else {
        console.error('Function is not properly exposed globally');
        return { success: false, message: 'triggerWorkflow function is not exposed globally' };
    }
};

// Test Supabase connection
window.testSupabaseConnection = async function testSupabaseConnection() {
    console.log('Testing Supabase connection...');
    try {
        const { data, error } = await _supabase.from('user_workflows').select('id').limit(1);
        if (error) {
            console.error('Supabase connection test failed:', error);
            return { success: false, message: 'Supabase connection test failed: ' + error.message };
        }
        console.log('Supabase connection test successful');
        return { success: true, message: 'Supabase connection test successful' };
    } catch (error) {
        console.error('Supabase connection test error:', error);
        return { success: false, message: 'Supabase connection test error: ' + error.message };
    }
};

// Simple network test function
window.testNetworkConnectivity = async function testNetworkConnectivity() {
    console.log('Testing network connectivity...');
    try {
        // Test a simple fetch to a known good endpoint
        const response = await fetch('https://httpbin.org/get', {
            method: 'GET',
            mode: 'cors'
        });

        if (response.ok) {
            console.log('Network connectivity test successful');
            return { success: true, message: 'Network connectivity test successful' };
        } else {
            console.error('Network connectivity test failed:', response.status);
            return { success: false, message: `Network test failed with status: ${response.status}` };
        }
    } catch (error) {
        console.error('Network connectivity test error:', error);
        return { success: false, message: 'Network connectivity test error: ' + error.message };
    }
};

// Test specific workflow URL
window.testWorkflowUrl = async function testWorkflowUrl(workflowId = 'test') {
    console.log('Testing workflow URL with ID:', workflowId);
    try {
        const url = `https://ef0ps4gk.rcsrv.net/webhook-test/${workflowId}`;
        console.log('Testing URL:', url);

        // Test if the URL is accessible
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                test: true,
                timestamp: new Date().toISOString()
            })
        });

        console.log('Workflow URL test response:', response.status, response.statusText);
        const text = await response.text();
        console.log('Response text:', text);

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            responseText: text
        };
    } catch (error) {
        console.error('Workflow URL test error:', error);
        return {
            success: false,
            error: error.message,
            errorType: error.name
        };
    }
};