const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const DigestClient = require('digest-fetch');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Default camera settings
let cameraConfig = {
    ip: '192.168.1.1',
    port: 80,
    mode: 'access_point', // 'access_point' or 'client'
    username: '', // for client mode
    password: ''  // for client mode
};

// Helper to make requests with proper auth
async function makeRequest(method, path, data = null, options = {}) {
    const baseURL = `http://${cameraConfig.ip}:${cameraConfig.port}`;
    const url = `${baseURL}${path}`;
    
    if (cameraConfig.mode === 'client' && cameraConfig.username && cameraConfig.password) {
        // Use digest auth for client mode
        const client = new DigestClient(cameraConfig.username, cameraConfig.password);
        const requestOptions = {
            method,
            headers: { 'Content-Type': 'application/json' },
            ...options
        };
        
        if (data) {
            requestOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
        }
        
        return await client.fetch(url, requestOptions);
    } else {
        // Use axios for access point mode
        const config = {
            method,
            url,
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' },
            ...options
        };
        
        if (data) {
            config.data = data;
        }
        
        return await axios(config);
    }
}

// API Routes

// Get camera configuration
app.get('/api/config', (req, res) => {
    res.json(cameraConfig);
});

// Update camera configuration
app.post('/api/config', (req, res) => {
    const { ip, port, mode, username, password } = req.body;
    
    if (ip) cameraConfig.ip = ip;
    if (port) cameraConfig.port = port;
    if (mode) cameraConfig.mode = mode;
    if (username !== undefined) cameraConfig.username = username;
    if (password !== undefined) cameraConfig.password = password;
    
    res.json({ success: true, config: cameraConfig });
});

// Get camera info
app.get('/api/camera/info', async (req, res) => {
    try {
        const response = await makeRequest('GET', '/osc/info');
        const data = response.data || await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error getting camera info:', error.message);
        res.status(500).json({ 
            error: 'Failed to get camera info', 
            details: error.message 
        });
    }
});

// Take picture
app.post('/api/camera/take-picture', async (req, res) => {
    try {
        // Start taking picture
        const takeResponse = await makeRequest('POST', '/osc/commands/execute', {
            name: 'camera.takePicture'
        });
        
        const takeData = takeResponse.data || await takeResponse.json();
        const commandId = takeData.id;
        
        // Poll for completion
        let completed = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout
        
        while (!completed && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            
            const statusResponse = await makeRequest('POST', '/osc/commands/status', {
                id: commandId
            });
            
            const statusData = statusResponse.data || await statusResponse.json();
            
            if (statusData.state === 'done') {
                completed = true;
                res.json({
                    success: true,
                    fileUrl: statusData.results?.fileUrl || null
                });
            } else if (statusData.state === 'error') {
                throw new Error('Picture capture failed');
            }
            
            attempts++;
        }
        
        if (!completed) {
            throw new Error('Picture capture timed out');
        }
        
    } catch (error) {
        console.error('Error taking picture:', error.message);
        res.status(500).json({ 
            error: 'Failed to take picture', 
            details: error.message 
        });
    }
});

// List files
app.get('/api/camera/files', async (req, res) => {
    try {
        const { fileType = 'all', startPosition = 0, entryCount = 20 } = req.query;
        
        const response = await makeRequest('POST', '/osc/commands/execute', {
            name: 'camera.listFiles',
            parameters: {
                fileType,
                startPosition: parseInt(startPosition),
                entryCount: parseInt(entryCount),
                maxThumbSize: 0,
                _detail: false
            }
        });
        
        const data = response.data || await response.json();
        res.json(data.results);
    } catch (error) {
        console.error('Error listing files:', error.message);
        res.status(500).json({ 
            error: 'Failed to list files', 
            details: error.message 
        });
    }
});

// Download file with dynamic path handling using query parameter
app.get('/api/camera/download', async (req, res) => {
    try {
        const filePath = req.query.path; // Get the path from query parameter
        const isThumb = req.query.thumb === 'true';
        
        if (!filePath) {
            return res.status(400).json({ error: 'File path is required' });
        }
        
        let url = `/files/${filePath}`;
        if (isThumb) {
            url += '?type=thumb';
        }
        
        if (cameraConfig.mode === 'client' && cameraConfig.username && cameraConfig.password) {
            // Handle digest auth download
            const client = new DigestClient(cameraConfig.username, cameraConfig.password);
            const fullUrl = `http://${cameraConfig.ip}:${cameraConfig.port}${url}`;
            const response = await client.fetch(fullUrl);
            
            // Set headers
            res.set({
                'Content-Type': response.headers.get('content-type') || 'application/octet-stream'
            });
            
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
            
        } else {
            // Handle access point mode download
            const response = await axios.get(url, {
                baseURL: `http://${cameraConfig.ip}:${cameraConfig.port}`,
                responseType: 'stream',
                timeout: 30000
            });
            
            // Set appropriate headers
            res.set({
                'Content-Type': response.headers['content-type'] || 'application/octet-stream',
                'Content-Length': response.headers['content-length']
            });
            
            response.data.pipe(res);
        }
        
    } catch (error) {
        console.error('Error downloading file:', error.message);
        res.status(500).json({ 
            error: 'Failed to download file', 
            details: error.message 
        });
    }
});

// Live preview stream
app.get('/api/camera/preview', async (req, res) => {
    try {
        if (cameraConfig.mode === 'client' && cameraConfig.username && cameraConfig.password) {
            // Handle client mode preview with digest auth
            const client = new DigestClient(cameraConfig.username, cameraConfig.password);
            const url = `http://${cameraConfig.ip}:${cameraConfig.port}/osc/commands/execute`;
            const response = await client.fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'camera.getLivePreview' })
            });
            
            // Forward headers
            res.set({
                'Content-Type': response.headers.get('content-type') || 'multipart/x-mixed-replace; boundary="---osclivepreview---"',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            
            // Pipe the response
            const reader = response.body.getReader();
            
            const pump = async () => {
                try {
                    const { done, value } = await reader.read();
                    if (done) {
                        res.end();
                        return;
                    }
                    res.write(Buffer.from(value));
                    await pump();
                } catch (error) {
                    console.error('Preview stream error:', error);
                    res.end();
                }
            };
            
            await pump();
            
        } else {
            // Handle access point mode preview
            const response = await axios.post('/osc/commands/execute', {
                name: 'camera.getLivePreview'
            }, {
                baseURL: `http://${cameraConfig.ip}:${cameraConfig.port}`,
                responseType: 'stream',
                timeout: 0 // No timeout for streaming
            });
            
            // Forward the camera's headers, especially Content-Type with correct boundary
            res.set({
                'Content-Type': response.headers['content-type'] || 'multipart/x-mixed-replace; boundary="---osclivepreview---"',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            
            response.data.pipe(res);
            
            // Handle client disconnect
            req.on('close', () => {
                response.data.destroy();
            });
            
            // Handle stream errors
            response.data.on('error', (error) => {
                console.error('Preview stream error:', error);
                res.end();
            });
        }
        
    } catch (error) {
        console.error('Error starting live preview:', error.message);
        res.status(500).json({ 
            error: 'Failed to start live preview', 
            details: error.message 
        });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ricoh Theta X Controller running on http://0.0.0.0:${PORT}`);
    console.log('Access the web interface at the above URL');
});