'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Film, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VideoUploadProps {
  onFileSelect: (file: File) => void
}

export function VideoUpload({ onFileSelect }: VideoUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0])
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024 // 500MB
  })

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Film className="h-16 w-16 text-muted-foreground" />
            <Upload className="h-6 w-6 text-primary absolute -top-1 -right-1 bg-background rounded-full p-1" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">
              {isDragActive ? 'Drop your video here' : 'Upload a video file'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Drag & drop or click to select • MP4, AVI, MOV, MKV, WebM
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum file size: 500MB
            </p>
          </div>
          
          <Button variant="outline" type="button">
            Choose File
          </Button>
        </div>
      </div>

    </div>
  )
}