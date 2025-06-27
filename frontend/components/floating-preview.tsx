'use client'

import { useState, useEffect } from 'react'
import { VideoSubtitlePreview } from './video-subtitle-preview'
import { X, Minimize2, Maximize2, Move } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SpeakerStyle {
  speaker_id: string
  font_family: string
  font_size: number
  font_weight: string
  primary_color: string
  outline_color: string
  shadow_color: string
  background_color: string
  position: string
  margin_left: number
  margin_right: number
  margin_vertical: number
  bold: boolean
  italic: boolean
  underline: boolean
  strikeout: boolean
  outline_width: number
  shadow_distance: number
  text_effect: string
  letter_spacing: number
  line_spacing: number
  scale_x: number
  scale_y: number
  rotation: number
  animation: string
  fade_in_duration: number
  fade_out_duration: number
  background_box: boolean
  box_padding: number
  box_opacity: number
  border_style: number
  all_caps: boolean
  word_wrap: boolean
  max_line_length: number
  enable_word_highlighting: boolean
  highlight_color: string
  highlight_outline_color: string
  highlight_bold: boolean
}

interface FloatingPreviewProps {
  style: SpeakerStyle
  maxWords?: number | string
  enableWordHighlighting?: boolean
  enableSpeakerDetection?: boolean
  isVisible?: boolean
  onClose?: () => void
}

export function FloatingPreview({
  style,
  maxWords = 4,
  enableWordHighlighting = true,
  enableSpeakerDetection = false,
  isVisible = true,
  onClose
}: FloatingPreviewProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  if (!isVisible) return null

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const newX = e.clientX - dragOffset.x
    const newY = e.clientY - dragOffset.y
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - 320 // Preview width
    const maxY = window.innerHeight - (isMinimized ? 60 : 400) // Preview height
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  // Auto-position for mobile
  useEffect(() => {
    const updatePosition = () => {
      if (window.innerWidth < 768) { // Mobile
        setPosition({ x: 10, y: 10 })
      }
    }
    
    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => window.removeEventListener('resize', updatePosition)
  }, [])

  return (
    <div
      className={`fixed z-50 bg-white rounded-lg shadow-2xl border-2 border-gray-200 ${
        isDragging ? 'scale-105 shadow-3xl' : ''
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? '280px' : '320px',
        maxWidth: 'calc(100vw - 20px)'
      }}
    >
      {/* Header Bar */}
      <div
        className={`flex items-center justify-between p-2 bg-gray-50 rounded-t-lg border-b cursor-move ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Move className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {isMinimized ? 'Preview' : 'Live Subtitle Preview'}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-6 h-6 p-0"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="w-6 h-6 p-0 text-red-500 hover:text-red-700"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-3">
          <VideoSubtitlePreview
            style={style}
            maxWords={maxWords}
            enableWordHighlighting={enableWordHighlighting}
            enableSpeakerDetection={enableSpeakerDetection}
            className="scale-90 transform-gpu"
          />
        </div>
      )}

      {/* Minimized content */}
      {isMinimized && (
        <div className="p-2 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Words: {maxWords === "full_sentence" ? "Full" : maxWords}</span>
            <span>Highlight: {enableWordHighlighting ? "On" : "Off"}</span>
          </div>
        </div>
      )}
    </div>
  )
}