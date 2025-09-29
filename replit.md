# Overview

This is a Node.js web application that provides a browser-based controller interface for Ricoh Theta X 360° cameras. The application serves as a bridge between web browsers and the camera, offering live preview streaming, remote capture control, and file management capabilities. The system supports both Access Point mode (direct camera connection) and Client mode (network-connected camera with authentication).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Backend Architecture
- **Framework**: Express.js server running on port 5000
- **Request Handling**: Dual authentication system supporting both unauthenticated requests (Access Point mode) and HTTP Digest authentication (Client mode)
- **HTTP Client**: Axios for basic requests and DigestClient for authenticated requests
- **Configuration Management**: In-memory camera configuration with support for dynamic IP, port, and authentication settings

## Frontend Architecture
- **Client-Side**: Vanilla JavaScript with class-based architecture (ThetaController)
- **UI Framework**: Pure HTML/CSS with responsive design using CSS Grid and Flexbox
- **Real-time Features**: Live preview streaming and dynamic gallery updates
- **State Management**: Local configuration persistence and real-time camera status monitoring

## Camera Integration
- **Connection Modes**: 
  - Access Point mode for direct camera connection (192.168.1.1:80)
  - Client mode for network-connected cameras with digest authentication
- **API Communication**: RESTful API wrapper around Ricoh Theta's native HTTP API
- **Media Handling**: Support for both image and video capture with file type filtering
- **Stream Management**: Live preview streaming with start/stop controls

## Security Model
- **Authentication**: HTTP Digest authentication for client mode using camera serial number credentials
- **CORS**: Cross-origin resource sharing enabled for browser compatibility
- **Input Validation**: Client-side and server-side validation for camera configuration parameters

# External Dependencies

## Core Dependencies
- **express**: Web server framework for API endpoints and static file serving
- **axios**: HTTP client for camera communication in Access Point mode
- **digest-fetch**: HTTP Digest authentication client for Client mode camera access
- **cors**: Cross-origin resource sharing middleware
- **multer**: File upload handling middleware

## Camera Hardware
- **Ricoh Theta X**: Primary target camera model with specific API endpoints
- **Network Requirements**: WiFi connectivity for Access Point mode or existing network for Client mode

## Development Dependencies
- **@types/node**: TypeScript definitions for Node.js development
- **mime-types**: MIME type detection for media file handling

## Browser Compatibility
- **Modern Browsers**: Requires support for ES6 classes, fetch API, and modern CSS features
- **Media Streaming**: Browser support for MJPEG streaming and 360° content display