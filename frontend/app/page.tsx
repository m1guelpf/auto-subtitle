'use client'

import { useState } from 'react'
import { VideoUpload } from '@/components/video-upload'
import { SubtitleConfig } from '@/components/subtitle-config'
import { ProcessingStatus } from '@/components/processing-status'
import { Results } from '@/components/results'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Film, Sparkles } from 'lucide-react'

export type JobStatus = {
  job_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message: string
  created_at: string
  completed_at?: string
  result?: any
  error?: string
}

export type SpeakerConfig = {
  speaker_id: string
  font_family: string
  font_size: number
  color: string
  position: string
  bold: boolean
  italic: boolean
}

export type SubtitleConfigType = {
  max_words: number | "full_sentence"
  output_srt: boolean
  enable_speaker_detection: boolean
  enable_word_highlighting?: boolean
  speakers: SpeakerConfig[]
}

export type TranscriptionConfigType = {
  model: string
  language: string
  device: string
  compute_type: string
  batch_size: number
  hf_token?: string
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<'upload' | 'config' | 'processing' | 'results'>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
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

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setCurrentStep('config')
  }

  const handleConfigComplete = () => {
    setCurrentStep('processing')
  }

  const handleJobStart = (id: string) => {
    setJobId(id)
  }

  const handleJobComplete = (status: JobStatus) => {
    setJobStatus(status)
    setCurrentStep('results')
  }

  const handleStartOver = () => {
    setCurrentStep('upload')
    setSelectedFile(null)
    setJobId(null)
    setJobStatus(null)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Film className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">Visub</h1>
          <Sparkles className="h-6 w-6 text-yellow-500" />
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Transform your videos with AI-powered subtitles. Customize fonts, colors, and positions for each speaker automatically.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {/* Desktop: Show all steps */}
        <div className="hidden md:flex items-center space-x-4">
          {['Upload', 'Configure', 'Process', 'Download'].map((step, index) => {
            const stepNames = ['upload', 'config', 'processing', 'results']
            const currentIndex = stepNames.indexOf(currentStep)
            const isActive = index === currentIndex
            const isCompleted = index < currentIndex
            
            return (
              <div key={step} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium
                  ${isActive ? 'bg-primary text-primary-foreground' : 
                    isCompleted ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}
                `}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-sm ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {step}
                </span>
                {index < 3 && (
                  <div className={`w-12 h-0.5 mx-4 ${isCompleted ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Mobile: Show compact version with current + next step */}
        <div className="md:hidden flex items-center space-x-3">
          {(() => {
            const steps = ['Upload', 'Configure', 'Process', 'Download']
            const stepNames = ['upload', 'config', 'processing', 'results']
            const currentIndex = stepNames.indexOf(currentStep)
            
            return (
              <>
                {/* Current step */}
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium bg-primary text-primary-foreground">
                    {currentIndex + 1}
                  </div>
                  <span className="ml-2 text-sm text-foreground font-medium">
                    {steps[currentIndex]}
                  </span>
                </div>

                {/* Connector and next step (if not last) */}
                {currentIndex < 3 && (
                  <>
                    <div className="w-8 h-0.5 bg-muted" />
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium bg-muted text-muted-foreground">
                        {currentIndex + 2}
                      </div>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {steps[currentIndex + 1]}
                      </span>
                    </div>
                  </>
                )}

                {/* Indicator for remaining steps */}
                {currentIndex < 2 && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span>• • •</span>
                    <span className="ml-1">{4 - currentIndex - 1} more</span>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>

      {/* Main Content */}
      <Card className="backdrop-blur-sm bg-white/80 border-white/20">
        <CardHeader className="text-center">
          <CardTitle>
            {currentStep === 'upload' && 'Upload Your Video'}
            {currentStep === 'config' && 'Configure Subtitles'}
            {currentStep === 'processing' && 'Generating Subtitles'}
            {currentStep === 'results' && 'Download Results'}
          </CardTitle>
          <CardDescription>
            {currentStep === 'upload' && 'Select a video file to get started'}
            {currentStep === 'config' && 'Customize how your subtitles will look and behave'}
            {currentStep === 'processing' && 'AI is analyzing your video and generating subtitles'}
            {currentStep === 'results' && 'Your subtitles are ready for download'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 'upload' && (
            <VideoUpload onFileSelect={handleFileSelect} />
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
              onComplete={handleJobComplete}
            />
          )}
          
          {currentStep === 'results' && jobStatus && (
            <Results
              jobStatus={jobStatus}
              onStartOver={handleStartOver}
            />
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center mt-8 text-sm text-muted-foreground">
        <p>Powered by OpenAI Whisper and WhisperX for accurate transcription</p>
      </div>
    </div>
  )
}