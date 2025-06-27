# Visub - Video Subtitle Generator

AI-powered web application for generating customizable video subtitles with **karaoke-style word highlighting** perfect for viral TikTok videos.

## Features

- 🎥 **Video Upload & Processing** - Support for multiple video formats
- 🎯 **AI Transcription** - WhisperX integration with word-level timestamps
- 👥 **Speaker Detection** - Automatic speaker diarization with distinct colors
- 🎨 **Custom Styling** - Per-speaker font, color, and position customization
- 🎤 **Karaoke-Style Highlighting** - Word-by-word highlighting as spoken (perfect for TikTok)
- 🎨 **Viral Video Presets** - Pre-configured styles for TikTok, YouTube, Instagram
- 🚀 **No Flasheo** - Seamless transitions with exact WhisperX timing
- ⚡ **Background Processing** - Redis & Celery for scalable video processing
- 🐳 **Docker Ready** - Full containerization for deployment
- 📱 **Modern UI** - Next.js frontend with shadcn/ui components

## 📖 Technical Documentation

For comprehensive system architecture, Celery & Redis integration details, and development guide, see:

**[📋 Complete Technical Documentation](./TECHNICAL_DOCUMENTATION.md)**

This documentation covers:
- **System Architecture** - How FastAPI, Celery, and Redis work together
- **Celery & Redis Deep Dive** - Why these technologies are perfect for video processing
- **Complete Data Flow** - From upload to download with real-time status updates
- **API Reference** - All endpoints with examples
- **Deployment & Scaling** - Production-ready Docker setup and horizontal scaling
- **Quick Start Guide** - Get up and running in minutes

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Redis server
- FFmpeg

### Local Development

1. **Environment Setup**

```bash
# Copy environment template
cp .env.example .env

# Edit with your HuggingFace token
# Get token from: https://huggingface.co/settings/tokens
# Accept terms: https://huggingface.co/pyannote/speaker-diarization-3.1
```

2. **Start Redis**

```bash
# Option 1: Local Redis
redis-server --port 6380

# Option 2: Docker Redis
docker run -d --name visub-redis -p 6380:6379 redis:alpine
```

3. **Backend Setup**

```bash
# Install dependencies
pip install -r requirements.txt
pip install -r requirements-webapp.txt

# Start FastAPI server
uvicorn webapp:app --host 0.0.0.0 --port 8000 --reload

# Start Celery worker (separate terminal)
celery -A webapp.celery worker --loglevel=info
```

4. **Frontend Setup**

```bash
cd frontend
npm install
npm run dev
```

5. **Access Application**

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Production Deployment

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Hetzner Deployment

1. **Server Setup**

```bash
# Update system
apt update && apt upgrade -y

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Clone repository
git clone <your-repo-url>
cd Visub
```

2. **Environment Configuration**

```bash
# Create production .env
nano .env

# Add your production settings:
HF_TOKEN=your_token_here
REDIS_URL=redis://visub-redis:6379/0
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=1000
```

3. **Deploy**

```bash
# Start production stack
docker-compose up -d --build

# Setup nginx proxy (optional)
# Configure domain & SSL
```

## Usage

### Basic Workflow

1. Upload video file (MP4, AVI, MOV, etc.)
2. Configure subtitle settings:
   - Words per subtitle (1-10)
   - Speaker detection (on/off)
   - **Word highlighting** (karaoke-style)
   - Custom styling per speaker
   - AI model quality
   - Language or auto-detect
3. Process video in background
4. Download result with embedded subtitles

### Karaoke-Style Word Highlighting

Perfect for viral TikTok videos! Features:
- **Real-time word highlighting** as spoken
- **Exact WhisperX timing** - no interpolation
- **Seamless transitions** - zero flasheo
- **Bold + white highlighting** for maximum visibility
- **Full sentence visibility** with progressive highlighting

Example: "NO NECESITO TU AYUDA"
- 0.0-0.5s: **NO** NECESITO TU AYUDA
- 0.5-1.2s: NO **NECESITO** TU AYUDA
- 1.2-1.5s: NO NECESITO **TU** AYUDA
- 1.5-2.0s: NO NECESITO TU **AYUDA**

### Speaker Detection

- Requires valid HuggingFace token
- Automatically assigns different colors to speakers
- Works best with clear, distinct voices
- Supports multiple speakers per video
- **Independent styling** per speaker with word highlighting

## Configuration

### AI Models

- `tiny` - Fastest, basic quality
- `base` - Recommended for development
- `medium` - Good quality/speed balance
- `large-v3` - Best quality, slower

### Performance Settings

**Development (CPU)**:
```json
{
  "device": "cpu",
  "compute_type": "int8",
  "batch_size": 8
}
```

**Production (GPU)**:
```json
{
  "device": "cuda",
  "compute_type": "float16", 
  "batch_size": 16
}
```

## API Reference

### Upload Video

```bash
curl -X POST "http://localhost:8000/api/upload" \
  -F "video_file=@video.mp4" \
  -F "subtitle_config={\"max_words\":4,\"enable_speaker_detection\":true}" \
  -F "transcription_config={\"model\":\"medium\",\"language\":\"auto\"}"
```

### Check Status

```bash
curl "http://localhost:8000/api/status/{job_id}"
```

### Download Results

```bash
curl "http://localhost:8000/api/download/{job_id}/video" -O
curl "http://localhost:8000/api/download/{job_id}/ass" -O
```

## Troubleshooting

### Common Issues

**Speaker Detection Shows 0 Speakers**
- Verify HuggingFace token is valid
- Accept model terms on HuggingFace
- Check worker logs for errors

**CUDA Errors**
- Switch to CPU mode in transcription config
- Or install proper CUDA/cuDNN libraries

**Redis Connection Failed**
- Ensure Redis is running on correct port
- Check REDIS_URL in .env

**Large File Processing Fails**
- Increase MAX_FILE_SIZE setting
- Use smaller/faster models
- Monitor disk space

### Logs

```bash
# Development logs
tail -f webapp.log
celery -A webapp.celery worker --loglevel=debug

# Production logs
docker-compose logs -f webapp
docker-compose logs -f worker
```

## Project Structure

```
Visub/
├── visub/                 # Core Python package
│   ├── api.py            # Web API interface
│   ├── config.py         # Configuration system
│   ├── transcribe.py     # WhisperX integration
│   └── cli.py            # Command-line interface
├── frontend/             # Next.js frontend
├── webapp.py             # FastAPI application
├── docker-compose.yml    # Production deployment
└── requirements*.txt     # Dependencies
```
