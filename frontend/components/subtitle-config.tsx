'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SubtitleConfigType, TranscriptionConfigType } from '@/app/page'
import { SubtitleStyleEditor } from './subtitle-style-editor'
import { GlobalSubtitlePreview } from './global-subtitle-preview'
import { StickyAutoPreview } from './sticky-auto-preview'
import { SpeakerStyleReference } from './speaker-style-reference'

interface SubtitleConfigProps {
  file: File
  subtitleConfig: SubtitleConfigType
  transcriptionConfig: TranscriptionConfigType
  onSubtitleConfigChange: (config: SubtitleConfigType) => void
  onTranscriptionConfigChange: (config: TranscriptionConfigType) => void
  onComplete: () => void
  onJobStart: (jobId: string) => void
}

export function SubtitleConfig({
  file,
  subtitleConfig,
  transcriptionConfig,
  onSubtitleConfigChange,
  onTranscriptionConfigChange,
  onComplete,
  onJobStart
}: SubtitleConfigProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [speakerStyles, setSpeakerStyles] = useState<Record<string, any>>({})

  const handleStyleChange = (speakerId: string, style: any) => {
    setSpeakerStyles(prev => ({
      ...prev,
      [speakerId]: style
    }))
  }

  const addCustomSpeaker = () => {
    const newSpeakerId = `SPEAKER_${Object.keys(speakerStyles).length + 1}`
    const defaultStyle = {
      speaker_id: newSpeakerId,
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
      all_caps: false,
      word_wrap: true,
      max_line_length: 30,
      enable_word_highlighting: true,
      highlight_color: '&H0000FFFF',  // Yellow highlight
      highlight_outline_color: '&H00000000',  // Black outline for highlight
      highlight_bold: true
    }
    
    setSpeakerStyles(prev => ({
      ...prev,
      [newSpeakerId]: defaultStyle
    }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    onComplete()
    
    try {
      const formData = new FormData()
      formData.append('video_file', file)
      
      // Include speaker styles in subtitle config
      const configWithStyles = {
        ...subtitleConfig,
        // Convert "full_sentence" to a large number that the backend can handle
        max_words: subtitleConfig.max_words === "full_sentence" ? 50 : subtitleConfig.max_words,
        speakers: Object.values(speakerStyles)
      }
      
      formData.append('subtitle_config', JSON.stringify(configWithStyles))
      formData.append('transcription_config', JSON.stringify(transcriptionConfig))

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      if (response.ok) {
        onJobStart(result.job_id)
      } else {
        throw new Error(result.detail || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <div className="space-y-6">
        <Card>
        <CardHeader>
          <CardTitle>File Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><strong>Name:</strong> {file.name}</div>
            <div><strong>Size:</strong> {(file.size / (1024 * 1024)).toFixed(1)} MB</div>
            <div><strong>Type:</strong> {file.type}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basic Settings</CardTitle>
          <CardDescription>Configure basic subtitle options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Words per subtitle
            </label>
            <select
              value={subtitleConfig.max_words}
              onChange={(e) => {
                const value = e.target.value === "full_sentence" ? "full_sentence" : parseInt(e.target.value)
                onSubtitleConfigChange({
                  ...subtitleConfig,
                  max_words: value
                })
              }}
              className="w-full px-3 py-2 pr-8 border border-input rounded-md"
            >
              <option value={1}>1 word</option>
              <option value={2}>2 words</option>
              <option value={3}>3 words</option>
              <option value={4}>4 words (recommended)</option>
              <option value={5}>5 words</option>
              <option value={6}>6 words</option>
              <option value={7}>7 words</option>
              <option value={8}>8 words</option>
              <option value={9}>9 words</option>
              <option value={10}>10 words</option>
              <option value="full_sentence">Full sentence</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enableSpeakerDetection"
              checked={subtitleConfig.enable_speaker_detection}
              onChange={(e) => onSubtitleConfigChange({
                ...subtitleConfig,
                enable_speaker_detection: e.target.checked
              })}
            />
            <label htmlFor="enableSpeakerDetection" className="text-sm font-medium">
              Enable Speaker Detection
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enableWordHighlighting"
              checked={subtitleConfig.enable_word_highlighting ?? true}
              onChange={(e) => onSubtitleConfigChange({
                ...subtitleConfig,
                enable_word_highlighting: e.target.checked
              })}
            />
            <label htmlFor="enableWordHighlighting" className="text-sm font-medium">
              Enable Word Highlighting
            </label>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Subtitle Styling</label>
                <p className="text-xs text-gray-500 mt-1">
                  {subtitleConfig.enable_speaker_detection 
                    ? "Speaker order is determined by who speaks first in the video"
                    : "Customize how your subtitles will appear"}
                </p>
              </div>
            </div>

            {/* Show styles based on speaker detection */}
            {Object.keys(speakerStyles).length === 0 && (
              <div className="text-center py-6 text-gray-500 border rounded-lg bg-gray-50">
                <p className="text-sm mb-3">
                  {subtitleConfig.enable_speaker_detection 
                    ? "No speaker styles configured yet."
                    : "No custom style configured yet."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomSpeaker}
                >
                  {subtitleConfig.enable_speaker_detection 
                    ? "Add First Speaker Style"
                    : "Add Custom Style"}
                </Button>
              </div>
            )}
            
{Object.entries(speakerStyles).map(([speakerId, style], index) => {
              const speakerName = subtitleConfig.enable_speaker_detection 
                ? `Speaker ${speakerId.split('_')[1] || (index + 1)}`
                : "Subtitle Style"
              
              return (
                <div key={speakerId}>
                  <SpeakerStyleReference 
                    style={style}
                    speakerName={speakerName}
                  />
                  <SubtitleStyleEditor
                    speakerId={speakerId}
                    speakerName={speakerName}
                    style={style}
                    onStyleChange={handleStyleChange}
                    onRemove={(Object.keys(speakerStyles).length > 1 && subtitleConfig.enable_speaker_detection) ? () => {
                      setSpeakerStyles(prev => {
                        const newStyles = { ...prev }
                        delete newStyles[speakerId]
                        return newStyles
                      })
                    } : undefined}
                    maxWords={subtitleConfig.max_words}
                    enableWordHighlighting={subtitleConfig.enable_word_highlighting ?? true}
                    enableSpeakerDetection={subtitleConfig.enable_speaker_detection}
                  />
                </div>
              )
            })}
            
            {/* Add additional speakers button - only if speaker detection is enabled */}
            {Object.keys(speakerStyles).length > 0 && subtitleConfig.enable_speaker_detection && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomSpeaker}
                  className="w-full"
                >
                  + Add Speaker {Object.keys(speakerStyles).length + 1} Style
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="outputSrt"
              checked={subtitleConfig.output_srt}
              onChange={(e) => onSubtitleConfigChange({
                ...subtitleConfig,
                output_srt: e.target.checked
              })}
            />
            <label htmlFor="outputSrt" className="text-sm font-medium">
              Generate SRT file
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Model Settings</CardTitle>
          <CardDescription>Configure transcription quality and language</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Model</label>
            <select
              value={transcriptionConfig.model}
              onChange={(e) => onTranscriptionConfigChange({
                ...transcriptionConfig,
                model: e.target.value
              })}
              className="w-full px-3 py-2 pr-8 border border-input rounded-md"
            >
              <option value="tiny">Tiny (fastest)</option>
              <option value="base">Base (recommended)</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large-v3">Large V3 (best quality)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Language</label>
            <select
              value={transcriptionConfig.language}
              onChange={(e) => onTranscriptionConfigChange({
                ...transcriptionConfig,
                language: e.target.value
              })}
              className="w-full px-3 py-2 pr-8 border border-input rounded-md"
            >
              <option value="auto">Auto-detect</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ru">Russian</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
        </CardContent>
      </Card>

        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? 'Starting Processing...' : 'Generate Subtitles'}
        </Button>
      </div>

      {/* Sticky Auto Preview - Always visible after scroll, auto-playing */}
      <StickyAutoPreview
        videoFile={file}
        style={Object.keys(speakerStyles).length > 0 ? Object.values(speakerStyles)[0] : {
          speaker_id: 'DEFAULT',
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
          all_caps: false,
          word_wrap: true,
          max_line_length: 30,
          enable_word_highlighting: true,
          highlight_color: '&H0000FFFF',
          highlight_outline_color: '&H00000000',
          highlight_bold: true
        }}
        maxWords={subtitleConfig.max_words}
        enableWordHighlighting={subtitleConfig.enable_word_highlighting ?? true}
        enableSpeakerDetection={subtitleConfig.enable_speaker_detection}
      />
    </div>
  )
}