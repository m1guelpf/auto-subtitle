'use client'

import { VideoSubtitlePreview } from './video-subtitle-preview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SubtitleConfigType } from '@/app/page'

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

interface GlobalSubtitlePreviewProps {
  subtitleConfig: SubtitleConfigType
  speakerStyles: Record<string, SpeakerStyle>
}

export function GlobalSubtitlePreview({ subtitleConfig, speakerStyles }: GlobalSubtitlePreviewProps) {
  // Create a default style based on current configuration
  const getDefaultStyle = (): SpeakerStyle => {
    return {
      speaker_id: 'default',
      font_family: 'Impact',
      font_size: 48,
      font_weight: 'bold',
      primary_color: '&H00FFFFFF',
      outline_color: '&H00000000',
      shadow_color: '&H80000000',
      background_color: '&H00000000',
      position: 'middle_center',
      margin_left: 20,
      margin_right: 20,
      margin_vertical: 40,
      bold: true,
      italic: false,
      underline: false,
      strikeout: false,
      outline_width: 3.0,
      shadow_distance: 2.0,
      text_effect: 'outline',
      letter_spacing: 0.0,
      line_spacing: 1.0,
      scale_x: 100.0,
      scale_y: 100.0,
      rotation: 0.0,
      animation: 'none',
      fade_in_duration: 0.0,
      fade_out_duration: 0.0,
      background_box: false,
      box_padding: 10,
      box_opacity: 0.8,
      border_style: 1,
      all_caps: true,
      word_wrap: true,
      max_line_length: 30,
      enable_word_highlighting: subtitleConfig.enable_word_highlighting ?? true,
      highlight_color: '&H0000FFFF',
      highlight_outline_color: '&H00000000',
      highlight_bold: true
    }
  }

  // Convert SpeakerConfig from main page to full SpeakerStyle for preview
  const convertToSpeakerStyle = (speakerConfig: any): SpeakerStyle => {
    const defaultStyle = getDefaultStyle()
    
    // Convert hex color to ASS format if needed
    const convertColor = (color: string) => {
      if (color.startsWith('#')) {
        const hex = color.slice(1)
        if (hex.length === 6) {
          const r = hex.slice(0, 2)
          const g = hex.slice(2, 4)
          const b = hex.slice(4, 6)
          return `&H00${b}${g}${r}`.toUpperCase()
        }
      }
      return color
    }

    return {
      ...defaultStyle,
      speaker_id: speakerConfig.speaker_id || 'SPEAKER_00',
      font_family: speakerConfig.font_family || 'Impact',
      font_size: speakerConfig.font_size || 48,
      primary_color: speakerConfig.primary_color ? convertColor(speakerConfig.primary_color) : '&H00FFFFFF',
      position: speakerConfig.position || 'middle_center',
      bold: speakerConfig.bold ?? true,
      italic: speakerConfig.italic ?? false,
      enable_word_highlighting: subtitleConfig.enable_word_highlighting ?? true,
    }
  }

  // Get the style to preview (first custom style or default)
  const getPreviewStyle = (): SpeakerStyle => {
    const styleKeys = Object.keys(speakerStyles)
    if (styleKeys.length > 0) {
      return convertToSpeakerStyle(speakerStyles[styleKeys[0]])
    }
    return getDefaultStyle()
  }

  const previewStyle = getPreviewStyle()
  const hasCustomStyles = Object.keys(speakerStyles).length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Subtitle Preview</CardTitle>
        <div className="text-sm text-gray-600">
          {hasCustomStyles ? (
            <span>Previewing: {previewStyle.speaker_id}</span>
          ) : (
            <span>Default style preview</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <VideoSubtitlePreview 
          style={previewStyle}
          maxWords={subtitleConfig.max_words}
          enableWordHighlighting={subtitleConfig.enable_word_highlighting ?? true}
          enableSpeakerDetection={subtitleConfig.enable_speaker_detection}
        />
        
        {/* Configuration summary */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium">Words per subtitle:</span> {
                subtitleConfig.max_words === 'full_sentence' ? 'Full sentence' : subtitleConfig.max_words
              }
            </div>
            <div>
              <span className="font-medium">Word highlighting:</span> {
                subtitleConfig.enable_word_highlighting ? 'Enabled' : 'Disabled'
              }
            </div>
            <div>
              <span className="font-medium">Speaker detection:</span> {
                subtitleConfig.enable_speaker_detection ? 'Enabled' : 'Disabled'
              }
            </div>
            <div>
              <span className="font-medium">Custom styles:</span> {Object.keys(speakerStyles).length}
            </div>
          </div>
          
          {hasCustomStyles && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <span className="font-medium">Available styles:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.keys(speakerStyles).map(speakerId => (
                  <span key={speakerId} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {speakerId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}