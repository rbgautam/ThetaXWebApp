class ThetaController {
    constructor() {
        this.config = {
            ip: '192.168.1.1',
            port: 80,
            mode: 'access_point',
            username: '',
            password: ''
        };
        this.previewRunning = false;
        this.files = [];
        
        this.initializeElements();
        this.loadConfiguration();
        this.setupEventListeners();
    }

    initializeElements() {
        // Configuration elements
        this.cameraMode = document.getElementById('cameraMode');
        this.cameraIP = document.getElementById('cameraIP');
        this.cameraPort = document.getElementById('cameraPort');
        this.username = document.getElementById('username');
        this.password = document.getElementById('password');
        this.clientModeFields = document.getElementById('clientModeFields');
        this.updateConfigBtn = document.getElementById('updateConfig');
        this.testConnectionBtn = document.getElementById('testConnection');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Preview elements
        this.livePreview = document.getElementById('livePreview');
        this.previewPlaceholder = document.getElementById('previewPlaceholder');
        this.startPreviewBtn = document.getElementById('startPreview');
        this.stopPreviewBtn = document.getElementById('stopPreview');

        // Control elements
        this.takePictureBtn = document.getElementById('takePicture');
        this.refreshFilesBtn = document.getElementById('refreshFiles');
        this.captureStatus = document.getElementById('captureStatus');

        // Gallery elements
        this.fileTypeFilter = document.getElementById('fileTypeFilter');
        this.fileCount = document.getElementById('fileCount');
        this.gallery = document.getElementById('gallery');
    }

    async loadConfiguration() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                this.config = await response.json();
                this.updateFormFromConfig();
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }

    updateFormFromConfig() {
        this.cameraMode.value = this.config.mode;
        this.cameraIP.value = this.config.ip;
        this.cameraPort.value = this.config.port;
        this.username.value = this.config.username;
        this.password.value = this.config.password;
        
        this.toggleClientModeFields();
    }

    toggleClientModeFields() {
        const isClientMode = this.cameraMode.value === 'client';
        this.clientModeFields.style.display = isClientMode ? 'block' : 'none';
        
        if (!isClientMode) {
            this.cameraIP.value = '192.168.1.1';
            this.cameraPort.value = '80';
        }
    }

    setupEventListeners() {
        // Configuration
        this.cameraMode.addEventListener('change', () => this.toggleClientModeFields());
        this.updateConfigBtn.addEventListener('click', () => this.updateConfiguration());
        this.testConnectionBtn.addEventListener('click', () => this.testConnection());

        // Preview
        this.startPreviewBtn.addEventListener('click', () => this.startPreview());
        this.stopPreviewBtn.addEventListener('click', () => this.stopPreview());

        // Controls
        this.takePictureBtn.addEventListener('click', () => this.takePicture());
        this.refreshFilesBtn.addEventListener('click', () => this.loadFiles());

        // Gallery
        this.fileTypeFilter.addEventListener('change', () => this.loadFiles());
    }

    async updateConfiguration() {
        const newConfig = {
            ip: this.cameraIP.value.trim(),
            port: parseInt(this.cameraPort.value) || 80,
            mode: this.cameraMode.value,
            username: this.username.value.trim(),
            password: this.password.value.trim()
        };

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });

            if (response.ok) {
                const result = await response.json();
                this.config = result.config;
                this.showStatus('connectionStatus', 'Configuration updated successfully!', 'success');
            } else {
                throw new Error('Failed to update configuration');
            }
        } catch (error) {
            console.error('Configuration update error:', error);
            this.showStatus('connectionStatus', 'Failed to update configuration: ' + error.message, 'error');
        }
    }

    async testConnection() {
        this.showStatus('connectionStatus', 'Testing connection...', 'info');
        
        try {
            const response = await fetch('/api/camera/info');
            
            if (response.ok) {
                const info = await response.json();
                this.showStatus('connectionStatus', 
                    `✓ Connected to ${info.model} (Serial: ${info.serialNumber})`, 'success');
            } else {
                const error = await response.json();
                throw new Error(error.details || 'Connection failed');
            }
        } catch (error) {
            console.error('Connection test error:', error);
            this.showStatus('connectionStatus', 
                `✗ Connection failed: ${error.message}`, 'error');
        }
    }

    async startPreview() {
        if (this.previewRunning) return;

        try {
            this.previewRunning = true;
            this.startPreviewBtn.style.display = 'none';
            this.stopPreviewBtn.style.display = 'inline-block';
            this.previewPlaceholder.style.display = 'none';
            this.livePreview.style.display = 'block';

            // Set the preview source to the streaming endpoint
            this.livePreview.src = '/api/camera/preview?' + Date.now();
            
            this.livePreview.onload = () => {
                console.log('Preview started successfully');
            };

            this.livePreview.onerror = (error) => {
                console.error('Preview error:', error);
                this.stopPreview();
                this.showStatus('connectionStatus', 'Failed to start live preview', 'error');
            };

        } catch (error) {
            console.error('Preview start error:', error);
            this.stopPreview();
            this.showStatus('connectionStatus', 'Failed to start live preview: ' + error.message, 'error');
        }
    }

    stopPreview() {
        this.previewRunning = false;
        this.startPreviewBtn.style.display = 'inline-block';
        this.stopPreviewBtn.style.display = 'none';
        this.livePreview.style.display = 'none';
        this.previewPlaceholder.style.display = 'block';
        this.livePreview.src = '';
    }

    async takePicture() {
        this.showStatus('captureStatus', 'Taking picture...', 'info');
        this.takePictureBtn.disabled = true;

        try {
            const response = await fetch('/api/camera/take-picture', {
                method: 'POST'
            });

            if (response.ok) {
                const result = await response.json();
                this.showStatus('captureStatus', '✓ Picture taken successfully!', 'success');
                
                // Refresh the file list to show the new image
                setTimeout(() => this.loadFiles(), 1000);
            } else {
                const error = await response.json();
                throw new Error(error.details || 'Failed to take picture');
            }
        } catch (error) {
            console.error('Picture capture error:', error);
            this.showStatus('captureStatus', `✗ Failed to take picture: ${error.message}`, 'error');
        } finally {
            this.takePictureBtn.disabled = false;
        }
    }

    async loadFiles() {
        try {
            const fileType = this.fileTypeFilter.value;
            const response = await fetch(`/api/camera/files?fileType=${fileType}&entryCount=50`);
            
            if (response.ok) {
                const result = await response.json();
                this.files = result.entries || [];
                this.renderGallery();
                this.updateFileCount();
            } else {
                const error = await response.json();
                throw new Error(error.details || 'Failed to load files');
            }
        } catch (error) {
            console.error('File loading error:', error);
            this.showStatus('connectionStatus', `Failed to load files: ${error.message}`, 'error');
        }
    }

    renderGallery() {
        if (this.files.length === 0) {
            this.gallery.innerHTML = `
                <div class="gallery-placeholder">
                    <p>No files found on the camera</p>
                </div>
            `;
            return;
        }

        this.gallery.innerHTML = this.files.map(file => {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            const isVideo = fileExtension === 'mp4';
            const fileSize = this.formatFileSize(file.size);
            const fileName = file.name;
            
            return `
                <div class="file-item">
                    <img src="/api/camera/download/${fileName}?thumb=true" 
                         alt="${fileName}" 
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNmN2ZhZmMiLz48dGV4dCB4PSIxMDAiIHk9Ijc1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjYTBhZWMwIj5ObyBUaHVtYm5haWw8L3RleHQ+PC9zdmc+'">
                    <h4>${fileName}</h4>
                    <div class="file-info">
                        ${isVideo ? '📹' : '📸'} ${fileSize} • ${file.dateTime || 'Unknown date'}
                    </div>
                    <div class="file-actions">
                        <button class="btn btn-secondary" onclick="thetaController.downloadFile('${fileName}', false)">
                            Download
                        </button>
                        <button class="btn btn-secondary" onclick="thetaController.downloadFile('${fileName}', true)">
                            Thumb
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateFileCount() {
        this.fileCount.textContent = `${this.files.length} files`;
    }

    async downloadFile(fileName, isThumb = false) {
        try {
            const url = `/api/camera/download/${fileName}${isThumb ? '?thumb=true' : ''}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = isThumb ? `thumb_${fileName}` : fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl);
            } else {
                throw new Error('Download failed');
            }
        } catch (error) {
            console.error('Download error:', error);
            alert(`Failed to download ${fileName}: ${error.message}`);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showStatus(elementId, message, type) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.className = `status-message ${type}`;
        
        // Auto-clear success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                element.textContent = '';
                element.className = 'status-message';
            }, 5000);
        }
    }
}

// Initialize the application
const thetaController = new ThetaController();

// Global function for file downloads (called from dynamically generated HTML)
window.thetaController = thetaController;