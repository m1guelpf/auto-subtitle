'use client'

import { JobStatus } from '@/app/page'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, RefreshCw, CheckCircle } from 'lucide-react'

interface ResultsProps {
  jobStatus: JobStatus
  onStartOver: () => void
}

export function Results({ jobStatus, onStartOver }: ResultsProps) {
  const handleDownload = (fileType: string) => {
    const link = document.createElement('a')
    link.href = `/api/download/${jobStatus.job_id}/${fileType}`
    link.download = ''
    link.click()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <CardTitle className="text-green-700">Processing Complete!</CardTitle>
          </div>
          <CardDescription>
            Your subtitles have been generated successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {jobStatus.result && (
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Max words per subtitle:</span>
                <span className="font-medium">{jobStatus.result.config_used?.max_words || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Speaker detection:</span>
                <span className="font-medium">
                  {jobStatus.result.config_used?.speaker_detection ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Speakers found:</span>
                <span className="font-medium">{jobStatus.result.config_used?.speakers || 0}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Download Files</CardTitle>
          <CardDescription>
            Choose which files you&apos;d like to download
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            onClick={() => handleDownload('video')}
            className="w-full justify-start"
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Video with Subtitles (.mp4)
          </Button>
          
          <Button 
            onClick={() => handleDownload('ass')}
            className="w-full justify-start"
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Download ASS Subtitles (.ass)
          </Button>
          
          {jobStatus.result?.config_used?.output_srt && (
            <Button 
              onClick={() => handleDownload('srt')}
              className="w-full justify-start"
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Download SRT Subtitles (.srt)
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex space-x-3">
        <Button onClick={onStartOver} variant="outline" className="flex-1">
          <RefreshCw className="mr-2 h-4 w-4" />
          Process Another Video
        </Button>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        <p>Files will be automatically cleaned up after 24 hours</p>
      </div>
    </div>
  )
}