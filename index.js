const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

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

// Helper function to create axios config
function getAxiosConfig() {
    const baseURL = `http://${cameraConfig.ip}:${cameraConfig.port}`;
    const config = {
        baseURL,
        timeout: 10000,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // Add digest auth for client mode
    if (cameraConfig.mode === 'client' && cameraConfig.username && cameraConfig.password) {
        config.auth = {
            username: cameraConfig.username,
            password: cameraConfig.password
        };
    }

    return config;
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
        const axiosConfig = getAxiosConfig();
        const response = await axios.get('/osc/info', axiosConfig);
        res.json(response.data);
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
        const axiosConfig = getAxiosConfig();
        
        // Start taking picture
        const takeResponse = await axios.post('/osc/commands/execute', {
            name: 'camera.takePicture'
        }, axiosConfig);
        
        const commandId = takeResponse.data.id;
        
        // Poll for completion
        let completed = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout
        
        while (!completed && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            
            const statusResponse = await axios.post('/osc/commands/status', {
                id: commandId
            }, axiosConfig);
            
            if (statusResponse.data.state === 'done') {
                completed = true;
                res.json({
                    success: true,
                    fileUrl: statusResponse.data.results?.fileUrl || null
                });
            } else if (statusResponse.data.state === 'error') {
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
        const axiosConfig = getAxiosConfig();
        const { fileType = 'all', startPosition = 0, entryCount = 20 } = req.query;
        
        const response = await axios.post('/osc/commands/execute', {
            name: 'camera.listFiles',
            parameters: {
                fileType,
                startPosition: parseInt(startPosition),
                entryCount: parseInt(entryCount),
                maxThumbSize: 0,
                _detail: false
            }
        }, axiosConfig);
        
        res.json(response.data.results);
    } catch (error) {
        console.error('Error listing files:', error.message);
        res.status(500).json({ 
            error: 'Failed to list files', 
            details: error.message 
        });
    }
});

// Download file
app.get('/api/camera/download/*', async (req, res) => {
    try {
        const fileUrl = req.params[0];
        const isThumb = req.query.thumb === 'true';
        
        const axiosConfig = getAxiosConfig();
        axiosConfig.responseType = 'stream';
        
        let url = `/files/${fileUrl}`;
        if (isThumb) {
            url += '?type=thumb';
        }
        
        const response = await axios.get(url, axiosConfig);
        
        // Set appropriate headers
        res.set({
            'Content-Type': response.headers['content-type'] || 'application/octet-stream',
            'Content-Length': response.headers['content-length']
        });
        
        response.data.pipe(res);
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
        const axiosConfig = getAxiosConfig();
        axiosConfig.responseType = 'stream';
        
        const response = await axios.post('/osc/commands/execute', {
            name: 'camera.getLivePreview'
        }, axiosConfig);
        
        // Set headers for MJPEG stream
        res.set({
            'Content-Type': 'multipart/x-mixed-replace; boundary="---osclivepreview---"',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        
        response.data.pipe(res);
        
        // Handle client disconnect
        req.on('close', () => {
            response.data.destroy();
        });
        
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