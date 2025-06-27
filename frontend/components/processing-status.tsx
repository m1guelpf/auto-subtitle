'use client'

import { useEffect, useState } from 'react'
import { JobStatus } from '@/app/page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-react'

interface ProcessingStatusProps {
  jobId: string
  onComplete: (status: JobStatus) => void
}

export function ProcessingStatus({ jobId, onComplete }: ProcessingStatusProps) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/status/${jobId}`)
        const jobStatus: JobStatus = await response.json()
        
        setStatus(jobStatus)
        
        if (jobStatus.status === 'completed') {
          onComplete(jobStatus)
        } else if (jobStatus.status === 'failed') {
          setError(jobStatus.error || 'Processing failed')
        }
      } catch (err) {
        setError('Failed to check status')
      }
    }

    // Poll immediately, then every 2 seconds
    pollStatus()
    const interval = setInterval(pollStatus, 2000)

    return () => clearInterval(interval)
  }, [jobId, onComplete])

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Processing Failed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <CardTitle>Processing Your Video</CardTitle>
          </div>
          <CardDescription>
            AI is analyzing audio and generating customized subtitles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round(status.progress)}%</span>
                </div>
                <Progress value={status.progress} className="w-full" />
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{status.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Job ID: {status.job_id}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="text-center space-y-2">
        <h3 className="font-medium">What&apos;s happening?</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>🎵 Extracting audio from your video</p>
          <p>🤖 AI transcribing speech with word-level timing</p>
          <p>👥 Detecting different speakers (if enabled)</p>
          <p>🎨 Applying custom styling to subtitles</p>
          <p>🎬 Embedding subtitles into final video</p>
        </div>
      </div>
    </div>
  )
}