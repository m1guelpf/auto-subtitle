# Complete Technical Documentation - Visub

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Celery & Redis Deep Dive](#celery--redis-deep-dive)
4. [Backend: FastAPI + Celery](#backend-fastapi--celery)
5. [Frontend: Next.js](#frontend-nextjs)
6. [Audio/Video Processing Pipeline](#audiovideo-processing-pipeline)
7. [Subtitle System](#subtitle-system)
8. [Karaoke Word Highlighting](#karaoke-word-highlighting)
9. [ASS File Generation](#ass-file-generation)
10. [Complete Data Flow](#complete-data-flow)
11. [API Endpoints](#api-endpoints)
12. [Configuration System](#configuration-system)
13. [Deployment & Scaling](#deployment--scaling)

---

## System Architecture Overview

Visub is a distributed video subtitle generation platform built with modern web technologies. The system is designed around **asynchronous processing** using **Celery** and **Redis** to handle computationally intensive video processing tasks without blocking the user interface.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Workers       │
│   (Next.js)     │◄──►│   (FastAPI)      │◄──►│   (Celery)      │
│                 │    │                  │    │                 │
│ • Upload UI     │    │ • API Routes     │    │ • Video Proc    │
│ • Config UI     │    │ • Job Management │    │ • Transcription │
│ • Style Editor  │    │ • File Handling  │    │ • ASS Generation│
│ • Progress      │    │ • Status Updates │    │ • FFmpeg Render │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │      Redis       │
                    │                  │
                    │ • Message Broker │
                    │ • Result Backend │
                    │ • Job Queue      │
                    │ • Status Cache   │
                    └──────────────────┘
```

**Why This Architecture?**

1. **Scalability**: Video processing is CPU/GPU intensive. By using background workers, multiple videos can be processed simultaneously without affecting user experience.

2. **Reliability**: If a worker crashes during processing, the job can be retried automatically. Redis persists job state across system restarts.

3. **User Experience**: Users don't have to wait for processing to complete. They can upload, configure, and monitor progress in real-time.

4. **Resource Management**: Processing load is distributed across dedicated worker processes, preventing the web server from becoming unresponsive.

---

## Technology Stack

### Backend Components
- **FastAPI**: Modern, async web framework for Python with automatic OpenAPI documentation
- **Celery**: Distributed task queue system for background processing
- **Redis**: In-memory data store serving as message broker and result backend
- **WhisperX**: AI transcription engine with word-level timestamps and speaker diarization
- **FFmpeg**: Video/audio processing and subtitle embedding
- **Pydantic**: Data validation and serialization for type safety

### Frontend Components
- **Next.js 14**: React framework with App Router for modern web development
- **React**: Component-based UI library with hooks for state management
- **TypeScript**: Static typing for improved development experience and code quality
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **shadcn/ui**: High-quality React components built on Radix UI primitives
- **React Hook Form**: Performant form library with minimal re-renders

### Infrastructure
- **Redis**: Multi-purpose data store for caching, queuing, and session management
- **Celery Workers**: Background processing services for compute-intensive tasks
- **File System**: Temporary storage for uploads and generated files
- **Docker**: Containerization for consistent deployment across environments

---

## Celery & Redis Deep Dive

### What is Celery?

**Celery** is a distributed task queue system that allows you to run functions asynchronously in background processes. It's particularly useful for tasks that are:
- CPU/GPU intensive (like video processing)
- Time-consuming (like AI transcription)
- Should not block the web interface
- Need to be retried if they fail
- Should be distributed across multiple machines

### What is Redis?

**Redis** (Remote Dictionary Server) is an in-memory data structure store that can function as:
- **Database**: Fast key-value storage
- **Cache**: Temporary data storage with expiration
- **Message Broker**: Queue system for distributing tasks
- **Session Store**: User session management

### Why Celery + Redis for Visub?

#### 1. **Asynchronous Video Processing**
Video processing is inherently slow and resource-intensive. Without background processing:
```python
# BAD: Synchronous processing blocks the web server
@app.post("/upload")
def upload_video(file):
    transcribe_audio(file)  # Takes 2-5 minutes
    generate_subtitles()    # Takes 30 seconds
    render_video()          # Takes 1-2 minutes
    return result           # User waits 3-8 minutes!
```

With Celery:
```python
# GOOD: Asynchronous processing
@app.post("/upload")
def upload_video(file):
    job = process_video_task.delay(file)  # Returns immediately
    return {"job_id": job.id}             # User gets instant response

@celery.task
def process_video_task(file):
    # This runs in background worker
    transcribe_audio(file)
    generate_subtitles()
    render_video()
    return result
```

#### 2. **Real-time Progress Updates**
Users can monitor processing progress without page refreshes:

```python
@celery.task(bind=True)
def process_video_task(self, file):
    # Update progress during processing
    self.update_state(state='PROCESSING', meta={'progress': 25, 'message': 'Extracting audio...'})
    extract_audio(file)
    
    self.update_state(state='PROCESSING', meta={'progress': 50, 'message': 'Transcribing with AI...'})
    transcribe_audio(file)
    
    self.update_state(state='PROCESSING', meta={'progress': 75, 'message': 'Generating subtitles...'})
    generate_subtitles()
    
    return {'status': 'completed', 'result': 'video.mp4'}
```

#### 3. **Horizontal Scaling**
Multiple worker processes can handle videos simultaneously:

```bash
# Start multiple workers for parallel processing
celery -A webapp.celery worker --concurrency=4 --hostname=worker1
celery -A webapp.celery worker --concurrency=4 --hostname=worker2
celery -A webapp.celery worker --concurrency=4 --hostname=worker3
```

#### 4. **Fault Tolerance**
If a worker crashes, Redis retains job state and tasks can be retried:

```python
@celery.task(bind=True, autoretry_for=(Exception,), retry_kwargs={'max_retries': 3})
def process_video_task(self, file):
    try:
        return process_video(file)
    except Exception as exc:
        # Automatically retry up to 3 times
        raise self.retry(exc=exc, countdown=60)
```

### How Celery & Redis Interact

#### 1. **Task Queue (Redis List)**
When a task is submitted, Celery serializes it and pushes to a Redis list:

```python
# When you call: process_video_task.delay(video_path)
# Celery does this internally:
redis_client.lpush('celery:default', {
    'id': 'task-uuid-123',
    'task': 'webapp.process_video_task',
    'args': [video_path],
    'kwargs': {},
    'eta': None
})
```

#### 2. **Worker Process**
Celery workers continuously poll Redis for new tasks:

```python
# Worker process loop (simplified)
while True:
    task_data = redis_client.brpop('celery:default', timeout=1)
    if task_data:
        task = deserialize(task_data)
        result = execute_task(task)
        store_result(redis_client, task.id, result)
```

#### 3. **Result Storage (Redis Hash)**
Task results and status updates are stored in Redis:

```python
# Task status in Redis
redis_client.hset(f'celery-task-meta-{task_id}', {
    'status': 'PROCESSING',
    'result': {'progress': 50, 'message': 'Transcribing...'},
    'date_done': None,
    'traceback': None
})
```

#### 4. **Status Polling (Frontend)**
The frontend polls for status updates:

```typescript
const pollStatus = async () => {
  const response = await fetch(`/api/status/${jobId}`)
  const status = await response.json()
  
  if (status.status === 'PROCESSING') {
    setProgress(status.result.progress)
    setTimeout(pollStatus, 2000)  // Poll every 2 seconds
  }
}
```

### Redis Data Structures in Visub

#### 1. **Task Queue (Lists)**
```
celery:default = [
  "task-id-1",
  "task-id-2", 
  "task-id-3"
]
```

#### 2. **Task Results (Hashes)**
```
celery-task-meta-{task_id} = {
  "status": "PROCESSING",
  "result": {"progress": 45, "message": "Generating ASS file..."},
  "date_done": null,
  "traceback": null,
  "children": []
}
```

#### 3. **Worker Registry (Sets)**
```
celery:workers = {
  "worker1@hostname",
  "worker2@hostname"
}
```

---

## Backend: FastAPI + Celery

### FastAPI Application Structure

```python
# webapp.py - Main application file
from fastapi import FastAPI
from celery import Celery

# Initialize FastAPI app
app = FastAPI(title="Visub API")

# Initialize Celery with Redis
celery = Celery(
    'webapp',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

# Configure Celery for production
celery.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    result_expires=3600,  # Results expire after 1 hour
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minute timeout
    worker_prefetch_multiplier=1,  # One task per worker at a time
)
```

### Main API Endpoints

#### 1. **Upload Endpoint**
```python
@app.post("/api/upload")
async def upload_video(
    video_file: UploadFile,
    subtitle_config: str,
    transcription_config: str
):
    # 1. Validate file type and size
    if not video_file.content_type.startswith('video/'):
        raise HTTPException(400, "Invalid file type")
    
    # 2. Save file to temporary directory
    upload_dir = "/tmp/visub_uploads"
    job_id = str(uuid.uuid4())
    file_path = f"{upload_dir}/{job_id}/{video_file.filename}"
    
    with open(file_path, "wb") as f:
        content = await video_file.read()
        f.write(content)
    
    # 3. Parse configurations
    subtitle_config = json.loads(subtitle_config)
    transcription_config = json.loads(transcription_config)
    
    # 4. Enqueue background task
    task = process_video_task.delay(
        job_id=job_id,
        video_path=file_path,
        subtitle_config=subtitle_config,
        transcription_config=transcription_config
    )
    
    # 5. Return job ID immediately
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Video uploaded successfully"
    }
```

#### 2. **Status Endpoint**
```python
@app.get("/api/status/{job_id}")
async def get_job_status(job_id: str):
    # Query Celery result from Redis
    result = celery.AsyncResult(job_id)
    
    response = {
        "job_id": job_id,
        "status": result.status,
        "created_at": result.date_done,
    }
    
    if result.status == 'PENDING':
        response.update({
            "progress": 0,
            "message": "Task is waiting to be processed"
        })
    elif result.status == 'PROCESSING':
        response.update({
            "progress": result.result.get('progress', 0),
            "message": result.result.get('message', 'Processing...')
        })
    elif result.status == 'SUCCESS':
        response.update({
            "progress": 100,
            "message": "Processing completed",
            "result": result.result
        })
    elif result.status == 'FAILURE':
        response.update({
            "progress": 0,
            "message": "Processing failed",
            "error": str(result.info)
        })
    
    return response
```

### Celery Task Implementation

```python
@celery.task(bind=True)
def process_video_task(self, job_id, video_path, subtitle_config, transcription_config):
    try:
        # Update status: Starting
        self.update_state(
            state='PROCESSING',
            meta={'progress': 5, 'message': 'Initializing processing...'}
        )
        
        # Initialize API instance
        output_dir = f"/tmp/visub_uploads/{job_id}/output"
        api_instance = VisubAPI(temp_dir=output_dir)
        
        # Update status: Audio extraction
        self.update_state(
            state='PROCESSING',
            meta={'progress': 15, 'message': 'Extracting audio from video...'}
        )
        
        # Process video through API
        result = api_instance.process_video(
            video_path=video_path,
            output_dir=output_dir,
            subtitle_config=subtitle_config,
            transcription_config=transcription_config
        )
        
        # Update status: Transcription
        self.update_state(
            state='PROCESSING',
            meta={'progress': 40, 'message': 'Transcribing audio with AI...'}
        )
        
        # Update status: Subtitle generation
        self.update_state(
            state='PROCESSING',
            meta={'progress': 70, 'message': 'Generating subtitle files...'}
        )
        
        # Update status: Video rendering
        self.update_state(
            state='PROCESSING',
            meta={'progress': 90, 'message': 'Rendering final video...'}
        )
        
        # Return success result
        return {
            'status': 'success',
            'video_path': result['video_files'],
            'subtitle_files': result['subtitle_files'],
            'config_used': result['config_used']
        }
        
    except Exception as e:
        # Update status: Failed
        self.update_state(
            state='FAILURE',
            meta={'error': str(e), 'traceback': traceback.format_exc()}
        )
        raise
```

---

## Frontend: Next.js

### Component Architecture

```typescript
// app/page.tsx - Main page component
export default function Home() {
  const [currentStep, setCurrentStep] = useState<
    'upload' | 'config' | 'processing' | 'results'
  >('upload')
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  
  // Configuration states
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfigType>({
    max_words: 4,
    output_srt: false,
    enable_speaker_detection: false,
    enable_word_highlighting: true,
    speakers: []
  })
  
  const [transcriptionConfig, setTranscriptionConfig] = useState<TranscriptionConfigType>({
    model: 'base',
    language: 'auto',
    device: 'cpu',
    compute_type: 'int8',
    batch_size: 16
  })

  // Step handlers
  const handleFileUpload = (file: File) => {
    setSelectedFile(file)
    setCurrentStep('config')
  }

  const handleConfigComplete = () => {
    setCurrentStep('processing')
  }

  const handleJobStart = (id: string) => {
    setJobId(id)
    // Start polling for status
  }

  // Render current step
  return (
    <div className="container mx-auto p-4">
      {currentStep === 'upload' && (
        <VideoUpload onFileSelect={handleFileUpload} />
      )}
      {currentStep === 'config' && selectedFile && (
        <SubtitleConfig
          file={selectedFile}
          subtitleConfig={subtitleConfig}
          transcriptionConfig={transcriptionConfig}
          onSubtitleConfigChange={setSubtitleConfig}
          onTranscriptionConfigChange={setTranscriptionConfig}
          onComplete={handleConfigComplete}
          onJobStart={handleJobStart}
        />
      )}
      {currentStep === 'processing' && jobId && (
        <ProcessingStatus
          jobId={jobId}
          onComplete={(status) => {
            setJobStatus(status)
            setCurrentStep('results')
          }}
        />
      )}
      {currentStep === 'results' && jobStatus && (
        <Results jobStatus={jobStatus} />
      )}
    </div>
  )
}
```

### Real-time Status Polling

```typescript
// components/processing-status.tsx
export function ProcessingStatus({ jobId, onComplete }: ProcessingStatusProps) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/status/${jobId}`)
        const statusData = await response.json()
        
        setStatus(statusData)
        
        if (statusData.status === 'SUCCESS') {
          onComplete(statusData)
          return // Stop polling
        }
        
        if (statusData.status === 'FAILURE') {
          setError(statusData.error || 'Processing failed')
          return // Stop polling
        }
        
        // Continue polling for PENDING/PROCESSING states
        setTimeout(pollStatus, 2000)
        
      } catch (error) {
        setError('Failed to get status')
        console.error('Status polling error:', error)
      }
    }

    // Start polling
    pollStatus()
  }, [jobId, onComplete])

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h3 className="mt-2 text-lg font-semibold text-red-900">Processing Failed</h3>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing Video</CardTitle>
        <CardDescription>
          Your video is being processed. This may take several minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{status?.progress || 0}%</span>
          </div>
          <Progress value={status?.progress || 0} className="w-full" />
        </div>
        
        <div className="text-sm text-gray-600">
          {status?.message || 'Initializing...'}
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Job ID: {jobId}</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Audio/Video Processing Pipeline

### Complete Processing Workflow

```
1. File Upload & Validation
   ├── File type validation (.mp4, .avi, .mov, .mkv, .webm)
   ├── File size validation (max 500MB)
   └── Save to temporary directory

2. Audio Extraction
   ├── FFmpeg: Extract audio from video
   ├── Convert to WAV format (16kHz, mono)
   └── Optimize for WhisperX processing

3. AI Transcription (WhisperX)
   ├── Load WhisperX model (tiny/base/medium/large)
   ├── Perform transcription with word-level timestamps
   ├── Optional: Speaker diarization with HuggingFace
   └── Return segments with precise word data

4. Subtitle Generation
   ├── Group words into subtitle chunks
   ├── Apply custom styling and formatting
   ├── Generate ASS file with inline highlighting tags
   └── Optional: Generate SRT file

5. Video Rendering
   ├── FFmpeg: Embed ASS subtitles into video
   ├── Re-encode video with subtitles burned in
   └── Output final MP4 file

6. Cleanup & Results
   ├── Clean temporary audio files
   ├── Maintain result files for download
   └── Update job status to completed
```

### Audio Extraction Implementation

```python
def get_audio(video_paths: list) -> dict:
    """Extract audio from video files using FFmpeg."""
    temp_directory = tempfile.gettempdir()
    audio_paths = {}

    for video_path in video_paths:
        output_path = os.path.join(temp_directory, f"{filename(video_path)}.wav")
        
        print(f"Extracting audio from {filename(video_path)}...")
        
        # FFmpeg command for optimal WhisperX input
        ffmpeg.input(video_path).output(
            output_path,
            acodec='pcm_s16le',  # 16-bit PCM for compatibility
            ac=1,                # Mono channel reduces noise
            ar='16000'           # 16kHz sample rate (WhisperX standard)
        ).run(quiet=True, overwrite_output=True)
        
        audio_paths[video_path] = output_path

    return audio_paths
```

### WhisperX Integration

```python
def word_transcribe(audio_path, model="base", device="cpu", **kwargs):
    """Transcribe audio with word-level timestamps using WhisperX."""
    
    # 1. Load WhisperX model
    print(f"Loading WhisperX model: {model}")
    whisper_model = whisperx.load_model(
        model_name=model,
        device=device,
        compute_type=kwargs.get('compute_type', 'int8')
    )
    
    # 2. Load and prepare audio
    audio = whisperx.load_audio(audio_path)
    
    # 3. Perform initial transcription
    print("Transcribing audio...")
    result = whisper_model.transcribe(
        audio,
        batch_size=kwargs.get('batch_size', 16),
        language=kwargs.get('language', 'auto')
    )
    
    # 4. Align words for precise timestamps
    print("Aligning words for precise timing...")
    align_model, metadata = whisperx.load_align_model(
        language_code=result["language"],
        device=device
    )
    
    result = whisperx.align(
        result["segments"],
        align_model,
        metadata,
        audio,
        device,
        return_char_alignments=False
    )
    
    # 5. Optional: Speaker diarization
    if kwargs.get('enable_diarization') and kwargs.get('hf_token'):
        print("Performing speaker diarization...")
        diarize_model = whisperx.DiarizationPipeline(
            use_auth_token=kwargs.get('hf_token'),
            device=device
        )
        
        diarize_segments = diarize_model(audio_path)
        result = whisperx.assign_word_speakers(diarize_segments, result)
    
    return result
```

---

## Subtitle System

### Configuration Structure

The subtitle system uses a hierarchical configuration approach:

```python
@dataclass
class SpeakerStyle:
    """Individual speaker styling configuration."""
    # Font settings
    font_family: FontFamily = FontFamily.IMPACT
    font_size: int = 48
    font_weight: str = "bold"
    
    # Colors (ASS format &H00BBGGRR)
    primary_color: str = "&H00FFFFFF"      # White text
    outline_color: str = "&H00000000"      # Black outline
    shadow_color: str = "&H80000000"       # Semi-transparent shadow
    
    # Position and alignment
    position: SubtitlePosition = SubtitlePosition.MIDDLE_CENTER
    margin_left: int = 20
    margin_right: int = 20
    margin_vertical: int = 40
    
    # Text effects
    bold: bool = True
    italic: bool = False
    all_caps: bool = True
    outline_width: float = 3.0
    text_effect: TextEffect = TextEffect.OUTLINE
    
    # Animation
    animation: AnimationStyle = AnimationStyle.NONE
    fade_in_duration: float = 0.2
    fade_out_duration: float = 0.2
    
    # Word highlighting (Karaoke-style)
    enable_word_highlighting: bool = True
    highlight_color: str = "&H0000FFFF"        # Yellow highlight
    highlight_outline_color: str = "&H00000000" # Black outline
    highlight_bold: bool = True

@dataclass 
class SubtitleConfig:
    """Main subtitle generation configuration."""
    max_words_per_subtitle: int = 4
    speaker_styles: Dict[str, SpeakerStyle] = field(default_factory=dict)
    default_style: SpeakerStyle = field(default_factory=SpeakerStyle)
    enable_speaker_detection: bool = False
    enable_word_highlighting: bool = True
    output_srt: bool = False
```

### Word Grouping Logic

```python
def group_words_into_subtitles(segments, config):
    """Group words from WhisperX into subtitle chunks."""
    subtitle_groups = []
    
    for segment in segments:
        if "words" not in segment:
            continue
            
        words = segment["words"]
        
        if config.max_words_per_subtitle >= 999:  # Full sentence mode
            # Group by sentence boundaries
            current_sentence = []
            
            for word in words:
                current_sentence.append(word)
                
                # Check for sentence endings
                word_text = word["word"].strip()
                if word_text.endswith(('.', '!', '?', ':', ';')):
                    if current_sentence:
                        subtitle_groups.append({
                            "start": current_sentence[0]["start"],
                            "end": current_sentence[-1]["end"],
                            "text": " ".join(w["word"] for w in current_sentence),
                            "speaker": current_sentence[0].get("speaker"),
                            "words": current_sentence
                        })
                        current_sentence = []
        else:
            # Group by word count
            for i in range(0, len(words), config.max_words_per_subtitle):
                word_group = words[i:i + config.max_words_per_subtitle]
                
                if word_group:
                    subtitle_groups.append({
                        "start": word_group[0]["start"],
                        "end": word_group[-1]["end"],
                        "text": " ".join(w["word"] for w in word_group),
                        "speaker": word_group[0].get("speaker"),
                        "words": word_group
                    })
    
    return subtitle_groups
```

---

## Karaoke Word Highlighting

### Core Implementation

The karaoke-style word highlighting is the signature feature of Visub, creating TikTok-perfect word-by-word emphasis as the speaker talks.

#### Technique Overview

1. **Exact WhisperX Timing**: Uses precise word timestamps without interpolation
2. **Seamless Transitions**: Each word ends exactly when the next begins
3. **ASS Inline Tags**: Uses Advanced SubStation Alpha format for mixed styling within single lines
4. **No Flasheo**: Eliminates gaps between highlighted words

#### Implementation Details

```python
def generate_karaoke_highlighting(words, style, config):
    """Generate karaoke-style word highlighting with seamless timing."""
    
    # 1. Create seamless timing - each word ends when next begins
    adjusted_timings = []
    for word_index, word_data in enumerate(words):
        start_time = round(word_data["start"], 2)
        
        if word_index < len(words) - 1:
            # End exactly when next word starts (seamless)
            end_time = round(words[word_index + 1]["start"], 2)
        else:
            # Last word: use its natural end time
            end_time = round(word_data["end"], 2)
            
        adjusted_timings.append({
            "start": start_time,
            "end": end_time,
            "word": word_data["word"]
        })
    
    # 2. Generate ASS dialogue lines with highlighting
    dialogue_lines = []
    
    for word_index, timing in enumerate(adjusted_timings):
        # Process all words with text transformations
        processed_words = []
        for i, word_item in enumerate(words):
            word_text = word_item["word"].strip()
            if style.all_caps:
                word_text = word_text.upper()
            processed_words.append((i, word_text))
        
        # Create text with inline highlighting
        highlighted_text = " ".join(
            create_highlight_tags(word_text, i == word_index, style)
            for i, word_text in processed_words
        )
        
        # Create ASS dialogue line
        dialogue_lines.append(
            f"Dialogue: 0,{ass_time(timing['start'])},{ass_time(timing['end'])},"
            f"{style_name},,0,0,0,,{highlighted_text}"
        )
    
    return dialogue_lines

def create_highlight_tags(word_text, is_highlighted, style):
    """Create ASS inline tags for word highlighting."""
    if is_highlighted:
        tags = ""
        
        # Bold formatting if enabled
        if style.highlight_bold:
            tags += "{\\b1}"
        
        # Highlight color
        tags += f"{{\\c{style.highlight_color}}}"
        
        # Word text
        tags += word_text
        
        # Reset to normal styling
        tags += f"{{\\c{style.primary_color}}}"
        if style.highlight_bold:
            tags += "{\\b0}"
            
        return tags
    else:
        return word_text
```

### Example ASS Output

```ass
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Impact,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,2,5,20,20,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text

# First word highlighted (yellow)
Dialogue: 0,0:00:00.56,0:00:00.71,Default,,0,0,0,,{\b1}{\c&H0000FFFF&}HELLO{\c&H00FFFFFF&}{\b0} WORLD FRIEND

# Second word highlighted
Dialogue: 0,0:00:00.71,0:00:00.91,Default,,0,0,0,,HELLO {\b1}{\c&H0000FFFF&}WORLD{\c&H00FFFFFF&}{\b0} FRIEND

# Third word highlighted
Dialogue: 0,0:00:00.91,0:00:01.25,Default,,0,0,0,,HELLO WORLD {\b1}{\c&H0000FFFF&}FRIEND{\c&H00FFFFFF&}{\b0}
```

### Timing Algorithm

```python
def calculate_seamless_timing(words):
    """Calculate seamless timing to eliminate gaps."""
    adjusted_timings = []
    
    for word_index, word_data in enumerate(words):
        # Start time: exact WhisperX timestamp
        start_time = round(word_data["start"], 2)
        
        if word_index < len(words) - 1:
            # End time: when next word starts (seamless)
            end_time = round(words[word_index + 1]["start"], 2)
        else:
            # Last word: use its natural end time
            end_time = round(word_data["end"], 2)
        
        # Ensure minimum duration (avoid zero-length subtitles)
        if end_time - start_time < 0.1:
            end_time = start_time + 0.1
        
        adjusted_timings.append({
            "start": start_time,
            "end": end_time,
            "word": word_data["word"],
            "original_start": word_data["start"],
            "original_end": word_data["end"]
        })
    
    return adjusted_timings
```

---

## ASS File Generation

### ASS Format Structure

ASS (Advanced SubStation Alpha) is a subtitle format that supports:
- Multiple styles in a single file
- Inline formatting tags
- Precise timing control
- Animation effects
- Color and positioning

#### Complete ASS File Example

```ass
[Script Info]
Title: Word-by-Word Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1280
PlayResY: 720
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

Style: Default,Impact,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,2,5,20,20,40,1
Style: Speaker_SPEAKER_00,Arial,32,&H000000FF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,2,5,20,20,40,1
Style: Speaker_SPEAKER_01,Arial,32,&H0000FF00,&H0000FF00,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,2,5,20,20,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text

Dialogue: 0,0:00:00.56,0:00:00.71,Default,,0,0,0,,{\b1}{\c&H0000FFFF&}HELLO{\c&H00FFFFFF&}{\b0} WORLD FRIEND
Dialogue: 0,0:00:00.71,0:00:00.91,Default,,0,0,0,,HELLO {\b1}{\c&H0000FFFF&}WORLD{\c&H00FFFFFF&}{\b0} FRIEND
Dialogue: 0,0:00:00.91,0:00:01.25,Default,,0,0,0,,HELLO WORLD {\b1}{\c&H0000FFFF&}FRIEND{\c&H00FFFFFF&}{\b0}
```

### ASS Inline Tags Used

```python
# Color tags
{\c&H00FFFFFF&}  # Primary color (white)
{\c&H0000FFFF&}  # Highlight color (yellow)

# Font weight
{\b1}            # Bold on
{\b0}            # Bold off

# Animations (when enabled)
{\fad(200,200)}  # Fade in/out
{\t(0,200,\fscx100\fscy100)}  # Transform scale
{\move(x1,y1,x2,y2,t1,t2)}    # Movement

# Positioning
{\pos(640,360)}  # Absolute position
{\an5}           # Alignment center

# Effects
{\bord3}         # Border width
{\shad2}         # Shadow distance
{\blur2}         # Blur effect
```

### Style Generation Code

```python
def to_ass_style(self, style_name: str) -> str:
    """Convert speaker style to ASS format style string."""
    alignment = self.position.value
    bold_flag = 1 if self.bold else 0
    italic_flag = 1 if self.italic else 0
    underline_flag = 1 if self.underline else 0
    strikeout_flag = 1 if self.strikeout else 0
    
    # Get font name from enum
    font_name = self.font_family.value
    
    # Handle color formats
    primary_color = self.primary_color
    outline_color = self.outline_color
    shadow_color = self.shadow_color
    background_color = self.background_color
    
    # ASS format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, 
    # OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, 
    # ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, 
    # Alignment, MarginL, MarginR, MarginV, Encoding
    style_line = (
        f"Style: {style_name},{font_name},{self.font_size},"
        f"{primary_color},{primary_color},{outline_color},{background_color},"
        f"{bold_flag},{italic_flag},{underline_flag},{strikeout_flag},"
        f"{self.scale_x},{self.scale_y},{self.letter_spacing},{self.rotation},"
        f"{self.border_style},{self.outline_width},{self.shadow_distance},"
        f"{alignment},{self.margin_left},{self.margin_right},{self.margin_vertical},1"
    )
    
    return style_line
```

---

## Complete Data Flow

### 1. Upload and Configuration Flow

```
Frontend                    Backend                     Celery Worker
   │                          │                             │
   ├─ User selects file       │                             │
   ├─ Configure settings      │                             │
   ├─ Submit form             │                             │
   │                          │                             │
   ├─ POST /api/upload ──────►│                             │
   │                          ├─ Validate file             │
   │                          ├─ Save to /tmp              │
   │                          ├─ Parse config              │
   │                          ├─ Generate job_id           │
   │                          ├─ Enqueue task ────────────►│
   │                          └─ Return job_id             │
   │◄─────────────────────────│                             │
   │                          │                             │
   ├─ Store job_id            │                             │
   └─ Start status polling    │                             │
```

### 2. Background Processing Flow

```
Celery Worker                  Redis                    External Tools
     │                          │                           │
     ├─ Pick up task           │                           │
     ├─ Update status ─────────►│ Set PROCESSING            │
     │                          │                           │
     ├─ Extract audio ─────────────────────────────────────►│ FFmpeg
     ├─ Update progress ───────►│ Progress: 15%             │
     │                          │                           │
     ├─ Transcribe ────────────────────────────────────────►│ WhisperX
     ├─ Update progress ───────►│ Progress: 40%             │
     │                          │                           │
     ├─ Generate ASS           │                           │
     ├─ Update progress ───────►│ Progress: 70%             │
     │                          │                           │
     ├─ Render video ──────────────────────────────────────►│ FFmpeg
     ├─ Update progress ───────►│ Progress: 90%             │
     │                          │                           │
     ├─ Cleanup files          │                           │
     └─ Set result ────────────►│ Status: SUCCESS           │
```

### 3. Status Monitoring and Download Flow

```
Frontend                    Backend                     Redis
   │                          │                           │
   ├─ Poll status (every 2s)  │                           │
   ├─ GET /api/status ───────►│                           │
   │                          ├─ Query Redis ───────────►│
   │                          │◄─────────────────────────│
   │◄─────────────────────────│                           │
   │                          │                           │
   ├─ Update progress bar     │                           │
   ├─ Show completion         │                           │
   │                          │                           │
   ├─ Download files          │                           │
   ├─ GET /api/download ─────►│                           │
   │                          ├─ Locate files             │
   │                          └─ Stream file              │
   │◄─────────────────────────│                           │
```

### 4. Error Handling Flow

```
Worker Error                   Redis                    Frontend
     │                          │                           │
     ├─ Exception occurs        │                           │
     ├─ Set FAILURE status ────►│ Status: FAILURE           │
     ├─ Store error message ───►│ Error: "Description"      │
     │                          │                           │
     │                          │◄─────── Poll status ─────┤
     │                          │ Return error ─────────────►│
     │                          │                           ├─ Show error UI
     │                          │                           ├─ Offer retry
     │                          │                           └─ Log for debugging
```

---

## API Endpoints

### Core Processing Endpoints

#### POST /api/upload
Upload video and start processing

**Request:**
```bash
curl -X POST "http://localhost:8000/api/upload" \
  -F "video_file=@video.mp4" \
  -F 'subtitle_config={
    "max_words": 4,
    "enable_speaker_detection": true,
    "enable_word_highlighting": true,
    "speakers": [
      {
        "speaker_id": "SPEAKER_00",
        "font_family": "Impact",
        "font_size": 48,
        "primary_color": "&H00FFFFFF",
        "highlight_color": "&H0000FFFF"
      }
    ]
  }' \
  -F 'transcription_config={
    "model": "medium",
    "language": "auto",
    "device": "cpu",
    "compute_type": "int8"
  }'
```

**Response:**
```json
{
  "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "queued",
  "message": "Video uploaded successfully"
}
```

#### GET /api/status/{job_id}
Get processing status and progress

**Response:**
```json
{
  "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "PROCESSING",
  "progress": 45,
  "message": "Generating ASS subtitle file...",
  "created_at": "2025-06-24T10:30:00.000Z",
  "result": null
}
```

**Completed Response:**
```json
{
  "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "SUCCESS",
  "progress": 100,
  "message": "Processing completed successfully",
  "created_at": "2025-06-24T10:30:00.000Z",
  "completed_at": "2025-06-24T10:35:00.000Z",
  "result": {
    "video_files": {
      "/path/to/video.mp4": "/path/to/output/video_with_subtitles.mp4"
    },
    "subtitle_files": {
      "/path/to/video.mp4": "/path/to/output/video.ass"
    },
    "config_used": {
      "max_words": 4,
      "speaker_detection": true,
      "speakers": 2
    }
  }
}
```

#### GET /api/download/{job_id}/{file_type}
Download generated files

**File Types:**
- `video` - MP4 with embedded subtitles
- `ass` - ASS subtitle file
- `srt` - SRT subtitle file (if generated)

### Configuration Endpoints

#### GET /api/models
List available WhisperX models

**Response:**
```json
[
  "tiny", "tiny.en", "base", "base.en", "small", "small.en",
  "medium", "medium.en", "large-v1", "large-v2", "large-v3",
  "large", "distil-large-v2", "distil-medium.en", "distil-small.en"
]
```

#### GET /api/languages
List supported languages

**Response:**
```json
[
  "auto", "en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh",
  "ar", "hi", "th", "vi", "id", "ms", "tl", "nl", "sv", "da", "no"
]
```

#### GET /api/positions
List subtitle position options

**Response:**
```json
[
  {"value": "bottom_left", "label": "Bottom Left"},
  {"value": "bottom_center", "label": "Bottom Center"},
  {"value": "bottom_right", "label": "Bottom Right"},
  {"value": "middle_left", "label": "Middle Left"},
  {"value": "middle_center", "label": "Middle Center"},
  {"value": "middle_right", "label": "Middle Right"},
  {"value": "top_left", "label": "Top Left"},
  {"value": "top_center", "label": "Top Center"},
  {"value": "top_right", "label": "Top Right"}
]
```

#### GET /api/fonts
List available viral video fonts

**Response:**
```json
[
  {"value": "impact", "label": "Impact", "category": "viral"},
  {"value": "arial_black", "label": "Arial Black", "category": "viral"},
  {"value": "bebas_neue", "label": "Bebas Neue", "category": "modern"},
  {"value": "montserrat_black", "label": "Montserrat Black", "category": "modern"}
]
```

#### GET /api/presets
List viral video style presets

**Response:**
```json
{
  "tiktok_classic": {
    "name": "TikTok Classic",
    "description": "Bold Impact font with black outline - perfect for TikTok",
    "preview": {
      "font_family": "Impact",
      "font_size": 52,
      "primary_color": "&H00FFFFFF",
      "outline_color": "&H00000000",
      "all_caps": true,
      "bold": true
    }
  },
  "youtube_viral": {
    "name": "YouTube Viral",
    "description": "Eye-catching yellow text for maximum attention",
    "preview": {
      "font_family": "Arial Black",
      "font_size": 48,
      "primary_color": "&H0000FFFF",
      "outline_color": "&H00000000"
    }
  }
}
```

#### POST /api/validate-config
Validate subtitle configuration

**Request:**
```json
{
  "max_words": 4,
  "enable_speaker_detection": true,
  "speakers": [
    {
      "speaker_id": "SPEAKER_00",
      "font_size": 48,
      "primary_color": "&H00FFFFFF"
    }
  ]
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": ["max_words > 10 may result in very long subtitles"]
}
```

### Management Endpoints

#### DELETE /api/jobs/{job_id}
Clean up job files and data

**Response:**
```json
{
  "message": "Job deleted successfully",
  "files_deleted": [
    "/tmp/visub_uploads/job_id/video.mp4",
    "/tmp/visub_uploads/job_id/output/video.ass"
  ]
}
```

#### GET /health
Health check for monitoring

**Response:**
```json
{
  "status": "healthy",
  "redis": "healthy",
  "workers": 3,
  "timestamp": "2025-06-24T10:30:00.000Z",
  "version": "1.0.0"
}
```

---

## Configuration System

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# File Upload Settings
UPLOAD_DIR=/tmp/visub_uploads
MAX_FILE_SIZE=500  # MB
CLEANUP_INTERVAL=3600  # seconds
FILE_RETENTION=86400  # 24 hours

# HuggingFace (for speaker diarization)
HF_TOKEN=your_token_here

# Processing Settings
DEFAULT_MODEL=base
DEFAULT_DEVICE=cpu
DEFAULT_COMPUTE_TYPE=int8

# Celery Settings
CELERY_TASK_TIME_LIMIT=1800  # 30 minutes
CELERY_WORKER_CONCURRENCY=4
CELERY_WORKER_PREFETCH_MULTIPLIER=1
```

### Celery Configuration

```python
# Production Celery configuration
celery_app.conf.update(
    # Serialization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    
    # Timezone
    timezone='UTC',
    enable_utc=True,
    
    # Results
    result_expires=3600,  # 1 hour
    result_backend_transport_options={
        'master_name': 'mymaster',
        'visibility_timeout': 3600,
    },
    
    # Tasks
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # Workers
    worker_prefetch_multiplier=1,  # Process one task at a time
    worker_max_tasks_per_child=100,  # Restart worker after 100 tasks
    worker_disable_rate_limits=True,
    
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
    
    # Routes
    task_routes={
        'webapp.process_video_task': {'queue': 'video_processing'},
        'webapp.cleanup_task': {'queue': 'maintenance'},
    },
    
    # Beat schedule (for periodic tasks)
    beat_schedule={
        'cleanup-old-files': {
            'task': 'webapp.cleanup_old_files',
            'schedule': 3600.0,  # Every hour
        },
    },
)
```

---

## Deployment & Scaling

### Docker Compose Production Setup

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379/0
      - UPLOAD_DIR=/app/uploads
      - MAX_FILE_SIZE=1000
      - HF_TOKEN=${HF_TOKEN}
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker:
    build: .
    command: celery -A webapp.celery worker --loglevel=info --concurrency=4
    environment:
      - REDIS_URL=redis://redis:6379/0
      - UPLOAD_DIR=/app/uploads
      - HF_TOKEN=${HF_TOKEN}
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 2  # Run 2 worker instances

  monitor:
    build: .
    command: celery -A webapp.celery flower --port=5555
    ports:
      - "5555:5555"
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    restart: unless-stopped

volumes:
  redis_data:
```

### Horizontal Scaling

#### Multiple Workers
```bash
# Scale workers dynamically
docker-compose up --scale worker=5

# Or run workers on different machines
# Machine 1
celery -A webapp.celery worker --hostname=gpu-worker-1 --queues=video_processing

# Machine 2  
celery -A webapp.celery worker --hostname=cpu-worker-1 --queues=maintenance

# Machine 3
celery -A webapp.celery worker --hostname=cpu-worker-2 --queues=video_processing
```

#### Load Balancer Configuration (nginx)
```nginx
upstream backend {
    server backend-1:8000 weight=3;
    server backend-2:8000 weight=3;
    server backend-3:8000 weight=3;
    least_conn;
}

upstream frontend {
    server frontend-1:3000;
    server frontend-2:3000;
    server frontend-3:3000;
}

server {
    listen 80;
    server_name visub.example.com;

    # API routes to backend
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Large file uploads
        client_max_body_size 1G;
        proxy_read_timeout 1800s;
    }

    # Frontend routes
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Monitoring and Observability

#### Health Checks
```python
@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint."""
    health_status = {"status": "healthy", "timestamp": datetime.utcnow()}
    
    # Check Redis connection
    try:
        redis_client.ping()
        health_status["redis"] = "healthy"
    except Exception as e:
        health_status["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check Celery workers
    try:
        inspect = celery.control.inspect()
        active_workers = inspect.active()
        worker_count = len(active_workers) if active_workers else 0
        health_status["workers"] = worker_count
        
        if worker_count == 0:
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["workers"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check disk space
    upload_dir = "/tmp/visub_uploads"
    if os.path.exists(upload_dir):
        statvfs = os.statvfs(upload_dir)
        free_space_gb = (statvfs.f_frsize * statvfs.f_bavail) / (1024**3)
        health_status["disk_space_gb"] = round(free_space_gb, 2)
        
        if free_space_gb < 1.0:  # Less than 1GB free
            health_status["status"] = "degraded"
    
    return health_status
```

#### Celery Monitoring with Flower
```python
# Start Flower web monitoring
celery -A webapp.celery flower --port=5555 --broker=redis://localhost:6379/0

# Access monitoring dashboard at http://localhost:5555
```

#### Logging Configuration
```python
import logging
from pythonjsonlogger import jsonlogger

# Configure structured logging
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)
logger = logging.getLogger()
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

# Log important events
logger.info("Video processing started", extra={
    "job_id": job_id,
    "file_size": file_size,
    "model": model_name,
    "speaker_detection": enable_speaker_detection
})
```

### Performance Optimization

#### Redis Optimization
```bash
# redis.conf optimizations for video processing
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
tcp-keepalive 300
timeout 0
```

#### Celery Performance Tuning
```python
# Optimize for video processing workloads
celery_app.conf.update(
    # Process one video at a time per worker to avoid memory issues
    worker_prefetch_multiplier=1,
    
    # Restart workers periodically to prevent memory leaks
    worker_max_tasks_per_child=50,
    
    # Increase timeouts for long video processing
    task_time_limit=3600,  # 1 hour
    task_soft_time_limit=3300,  # 55 minutes
    
    # Optimize for large message sizes (video metadata)
    broker_transport_options={
        'fanout_prefix': True,
        'fanout_patterns': True,
    },
    
    # Enable compression for large results
    task_compression='gzip',
    result_compression='gzip',
)
```

---

## Quick Start Guide

### For Developers

1. **Clone and Setup**
```bash
git clone <repository-url>
cd visub
cp .env.example .env
# Edit .env with your HuggingFace token
```

2. **Start Services**
```bash
# Terminal 1: Redis
redis-server --port 6379

# Terminal 2: Backend
pip install -r requirements.txt requirements-webapp.txt
uvicorn webapp:app --reload

# Terminal 3: Worker
celery -A webapp.celery worker --loglevel=info

# Terminal 4: Frontend
cd frontend && npm install && npm run dev
```

3. **Access Application**
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Celery Monitor: http://localhost:5555 (if running Flower)

### For Production

1. **Environment Setup**
```bash
# Create production environment file
cat > .env << EOF
REDIS_URL=redis://redis:6379/0
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=1000
HF_TOKEN=your_token_here
CELERY_WORKER_CONCURRENCY=4
EOF
```

2. **Deploy with Docker**
```bash
docker-compose up -d --build
docker-compose logs -f
```

3. **Monitor Health**
```bash
curl http://localhost:8000/health
```

This documentation provides everything needed to understand, develop, and deploy the Visub system. The combination of FastAPI, Celery, and Redis creates a robust, scalable platform for video subtitle generation with real-time karaoke-style word highlighting.