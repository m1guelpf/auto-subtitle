'use client'

import { useState, useEffect } from 'react'
import { VideoSubtitlePreview } from './video-subtitle-preview'
import { FloatingPreview } from './floating-preview'
import { Eye, EyeOff, Smartphone, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'

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

interface AdaptivePreviewProps {
  style: SpeakerStyle
  maxWords?: number | string
  enableWordHighlighting?: boolean
  enableSpeakerDetection?: boolean
}

export function AdaptivePreview({
  style,
  maxWords = 4,
  enableWordHighlighting = true,
  enableSpeakerDetection = false
}: AdaptivePreviewProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [showFloating, setShowFloating] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Mobile: Modal Preview
  if (isMobile) {
    return (
      <>
        {/* Floating Preview Button */}
        <div className="fixed bottom-4 right-4 z-40">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                className="rounded-full w-14 h-14 shadow-lg bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <Smartphone className="w-6 h-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] max-h-[90vh] p-2">
              <DialogHeader>
                <DialogTitle className="text-center">Subtitle Preview</DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto">
                <VideoSubtitlePreview
                  style={style}
                  maxWords={maxWords}
                  enableWordHighlighting={enableWordHighlighting}
                  enableSpeakerDetection={enableSpeakerDetection}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Inline preview for context */}
        <div className="mb-4 border rounded-lg p-3 bg-gray-50">
          <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Tap the floating button for live preview
          </div>
          <div className="aspect-video bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center text-white text-sm">
            Preview available in fullscreen
          </div>
        </div>
      </>
    )
  }

  // Desktop: Floating + Toggle
  return (
    <>
      {/* Preview Toggle */}
      <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Monitor className="w-4 h-4" />
          Live Preview (Draggable)
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFloating(!showFloating)}
          className="flex items-center gap-2"
        >
          {showFloating ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showFloating ? 'Hide' : 'Show'}
        </Button>
      </div>

      {/* Floating Preview */}
      <FloatingPreview
        style={style}
        maxWords={maxWords}
        enableWordHighlighting={enableWordHighlighting}
        enableSpeakerDetection={enableSpeakerDetection}
        isVisible={showFloating}
        onClose={() => setShowFloating(false)}
      />
    </>
  )
}