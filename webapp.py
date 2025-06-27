"""
Production-ready Visub Web Application
A complete web API for video subtitle generation with customizable styling.

Installation:
1. pip install fastapi uvicorn python-multipart redis celery
2. Start Redis server: redis-server
3. Start Celery worker: celery -A webapp.celery worker --loglevel=info
4. Run: uvicorn webapp:app --host 0.0.0.0 --port 8000

Features:
- Upload videos and generate subtitles
- Customize font, color, position per speaker
- Speaker detection and diarization
- Background job processing with Celery
- File cleanup and management
- Production logging and error handling
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional, Dict, Any
import json
import os
import tempfile
import uuid
import shutil
import logging
from pathlib import Path
from datetime import datetime, timedelta
import redis
from celery import Celery
import asyncio
from concurrent.futures import ThreadPoolExecutor

from visub.api import VisubAPI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6380/0")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/visub_uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "500")) * 1024 * 1024  # 500MB default
CLEANUP_INTERVAL = int(os.getenv("CLEANUP_INTERVAL", "3600"))  # 1 hour
FILE_RETENTION = int(os.getenv("FILE_RETENTION", "86400"))  # 24 hours
HF_TOKEN = os.getenv("HF_TOKEN")

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize FastAPI
app = FastAPI(
    title="Visub Subtitle Generator",
    description="Production API for generating customized video subtitles",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Redis
redis_client = redis.from_url(REDIS_URL)

# Initialize Celery
celery = Celery(
    "visub_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["webapp"]
)

# Initialize Visub API
visub_api = VisubAPI(temp_dir=UPLOAD_DIR)

# Thread pool for CPU-bound tasks
executor = ThreadPoolExecutor(max_workers=2)

# Models
class SpeakerConfig(BaseModel):
    speaker_id: str
    font_family: str = "Arial"
    font_size: int = 30
    color: str = "#FFFFFF"
    position: str = "bottom_center"
    bold: bool = False
    italic: bool = False

    @validator('font_size')
    def validate_font_size(cls, v):
        if not 8 <= v <= 100:
            raise ValueError('Font size must be between 8 and 100')
        return v

    @validator('color')
    def validate_color(cls, v):
        if v.startswith('#') and len(v) == 7:
            try:
                int(v[1:], 16)
                return v
            except ValueError:
                raise ValueError('Invalid hex color format')
        elif v.startswith('&H'):
            return v
        else:
            raise ValueError('Color must be hex (#RRGGBB) or ASS format (&H00BBGGRR)')

class SubtitleConfig(BaseModel):
    max_words: int = 4
    output_srt: bool = False
    enable_speaker_detection: bool = False
    speakers: List[SpeakerConfig] = []

    @validator('max_words')
    def validate_max_words(cls, v):
        if not 1 <= v <= 50:
            raise ValueError('Max words must be between 1 and 50')
        return v

class TranscriptionConfig(BaseModel):
    model: str = "medium"
    language: str = "auto"
    device: str = "cuda"
    compute_type: str = "float16"
    batch_size: int = 16
    hf_token: Optional[str] = None

    @validator('model')
    def validate_model(cls, v):
        valid_models = [
            "tiny", "tiny.en", "base", "base.en", "small", "small.en",
            "medium", "medium.en", "large-v1", "large-v2", "large-v3",
            "large", "distil-large-v2", "distil-medium.en", "distil-small.en",
            "distil-large-v3", "large-v3-turbo", "turbo"
        ]
        if v not in valid_models:
            raise ValueError(f'Model must be one of: {valid_models}')
        return v

class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, processing, completed, failed
    progress: float
    message: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    result: Optional[Dict] = None
    error: Optional[str] = None

# Job management
class JobManager:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    def create_job(self, job_id: str) -> JobStatus:
        job = JobStatus(
            job_id=job_id,
            status="pending",
            progress=0.0,
            message="Job created",
            created_at=datetime.utcnow()
        )
        self.redis.setex(f"job:{job_id}", FILE_RETENTION, job.json())
        return job
    
    def get_job(self, job_id: str) -> Optional[JobStatus]:
        job_data = self.redis.get(f"job:{job_id}")
        if job_data:
            return JobStatus.parse_raw(job_data)
        return None
    
    def update_job(self, job_id: str, **kwargs):
        job = self.get_job(job_id)
        if job:
            for key, value in kwargs.items():
                setattr(job, key, value)
            self.redis.setex(f"job:{job_id}", FILE_RETENTION, job.json())
    
    def delete_job(self, job_id: str):
        self.redis.delete(f"job:{job_id}")

job_manager = JobManager(redis_client)

# Celery task
@celery.task(bind=True)
def process_video_task(self, job_id: str, video_path: str, output_dir: str, 
                      subtitle_config: dict, transcription_config: dict):
    """Background task to process video."""
    try:
        job_manager.update_job(job_id, status="processing", progress=10.0, message="Starting processing")
        
        # Process video
        results = visub_api.process_video(
            video_path=video_path,
            output_dir=output_dir,
            subtitle_config=subtitle_config,
            transcription_config=transcription_config
        )
        
        job_manager.update_job(
            job_id,
            status="completed",
            progress=100.0,
            message="Processing completed",
            completed_at=datetime.utcnow(),
            result=results
        )
        
        logger.info(f"Job {job_id} completed successfully")
        return results
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {str(e)}")
        job_manager.update_job(
            job_id,
            status="failed",
            progress=0.0,
            message="Processing failed",
            completed_at=datetime.utcnow(),
            error=str(e)
        )
        raise

# Health check
@app.get("/health")
async def health_check():
    try:
        redis_client.ping()
        return {"status": "healthy", "redis": "connected", "timestamp": datetime.utcnow()}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e), "timestamp": datetime.utcnow()}

# API Routes
@app.get("/")
async def root():
    return {
        "name": "Visub Subtitle Generator",
        "version": "1.0.0",
        "description": "Production API for video subtitle generation",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/api/models")
async def get_supported_models():
    return {"models": visub_api.get_supported_models()}

@app.get("/api/languages")
async def get_supported_languages():
    return {"languages": visub_api.get_supported_languages()}

@app.get("/api/positions")
async def get_supported_positions():
    return {"positions": visub_api.get_supported_positions()}

@app.get("/api/fonts")
async def get_viral_fonts():
    return {"fonts": visub_api.get_viral_fonts()}

@app.get("/api/effects")
async def get_text_effects():
    return {"effects": visub_api.get_text_effects()}

@app.get("/api/animations")
async def get_animation_styles():
    return {"animations": visub_api.get_animation_styles()}

@app.get("/api/presets")
async def get_preset_styles():
    return {"presets": visub_api.get_preset_styles()}

@app.get("/api/colors")
async def get_color_palette():
    return {"colors": visub_api.get_color_palette()}

@app.post("/api/validate-config")
async def validate_config(config: SubtitleConfig):
    try:
        config_dict = config.dict()
        validation_result = visub_api.validate_config(config_dict)
        return validation_result
    except Exception as e:
        logger.error(f"Config validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/upload")
async def upload_video(
    video_file: UploadFile = File(...),
    subtitle_config: str = Form(...),
    transcription_config: Optional[str] = Form(None)
):
    """Upload video and start processing job."""
    
    # Validate file
    if not video_file.content_type or not video_file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    if video_file.size and video_file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Parse and validate configurations
    try:
        subtitle_config_dict = json.loads(subtitle_config)
        transcription_config_dict = json.loads(transcription_config) if transcription_config else {}
        
        # Validate using Pydantic models
        SubtitleConfig(**subtitle_config_dict)
        if transcription_config_dict:
            TranscriptionConfig(**transcription_config_dict)
            
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in configuration")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Configuration validation error: {str(e)}")
    
    # Create job
    job_id = str(uuid.uuid4())
    job = job_manager.create_job(job_id)
    
    try:
        # Create job directory
        job_dir = os.path.join(UPLOAD_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        # Save uploaded video
        video_path = os.path.join(job_dir, f"input_{video_file.filename}")
        with open(video_path, "wb") as buffer:
            content = await video_file.read()
            buffer.write(content)
        
        output_dir = os.path.join(job_dir, "output")
        os.makedirs(output_dir, exist_ok=True)
        
        # Start background processing
        process_video_task.delay(
            job_id=job_id,
            video_path=video_path,
            output_dir=output_dir,
            subtitle_config=subtitle_config_dict,
            transcription_config=transcription_config_dict
        )
        
        logger.info(f"Started processing job {job_id} for file {video_file.filename}")
        
        return {
            "job_id": job_id,
            "status": "accepted",
            "message": "Video uploaded and processing started"
        }
        
    except Exception as e:
        # Clean up on error
        job_dir = os.path.join(UPLOAD_DIR, job_id)
        if os.path.exists(job_dir):
            shutil.rmtree(job_dir, ignore_errors=True)
        job_manager.delete_job(job_id)
        
        logger.error(f"Upload failed for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/api/status/{job_id}")
async def get_job_status(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.get("/api/download/{job_id}/{file_type}")
async def download_file(job_id: str, file_type: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    output_dir = os.path.join(job_dir, "output")
    
    if not os.path.exists(output_dir):
        raise HTTPException(status_code=404, detail="Output files not found")
    
    # Find the requested file
    file_path = None
    file_extension = {"ass": ".ass", "srt": ".srt", "video": ".mp4"}
    
    if file_type not in file_extension:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    for file in os.listdir(output_dir):
        if file.endswith(file_extension[file_type]):
            file_path = os.path.join(output_dir, file)
            break
    
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File type '{file_type}' not found")
    
    return FileResponse(
        file_path,
        media_type='application/octet-stream',
        filename=os.path.basename(file_path)
    )

@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Clean up files
    job_dir = os.path.join(UPLOAD_DIR, job_id)
    if os.path.exists(job_dir):
        shutil.rmtree(job_dir, ignore_errors=True)
    
    # Remove from Redis
    job_manager.delete_job(job_id)
    
    logger.info(f"Deleted job {job_id}")
    return {"message": "Job deleted successfully"}

@app.post("/api/cleanup")
async def cleanup_old_jobs(background_tasks: BackgroundTasks):
    """Clean up old jobs and files."""
    background_tasks.add_task(cleanup_expired_jobs)
    return {"message": "Cleanup started"}

def cleanup_expired_jobs():
    """Remove expired jobs and their files."""
    try:
        cutoff_time = datetime.utcnow() - timedelta(seconds=FILE_RETENTION)
        
        # Find expired job directories
        for item in os.listdir(UPLOAD_DIR):
            item_path = os.path.join(UPLOAD_DIR, item)
            if os.path.isdir(item_path):
                # Check if directory is old enough
                creation_time = datetime.fromtimestamp(os.path.getctime(item_path))
                if creation_time < cutoff_time:
                    shutil.rmtree(item_path, ignore_errors=True)
                    logger.info(f"Cleaned up expired job directory: {item}")
        
        logger.info("Cleanup completed")
        
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("Visub API starting up...")
    
    # Test Redis connection
    try:
        redis_client.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
    
    # Schedule periodic cleanup
    import threading
    def periodic_cleanup():
        while True:
            cleanup_expired_jobs()
            threading.Event().wait(CLEANUP_INTERVAL)
    
    cleanup_thread = threading.Thread(target=periodic_cleanup, daemon=True)
    cleanup_thread.start()
    
    logger.info("Visub API startup complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "webapp:app",
        host="0.0.0.0",
        port=8000,
        workers=1,
        log_level="info"
    )