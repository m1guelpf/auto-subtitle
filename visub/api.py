"""
Web API interface for Visub subtitle generation.
This module provides functions that can be easily integrated with web frameworks
like Flask, FastAPI, or Django.
"""

import os
import tempfile
import json
from typing import Dict, List, Optional, Union
from pathlib import Path

from .config import (
    SubtitleConfig, SpeakerStyle, SubtitlePosition, FontFamily, TextEffect, AnimationStyle,
    create_multi_speaker_config, create_auto_speaker_config, create_viral_preset_styles, 
    get_viral_color_palette, hex_to_ass_color
)
from .transcribe import word_transcribe
from .cli import get_audio, get_subtitles


class VisubAPI:
    """Main API class for video subtitle generation."""
    
    def __init__(self, temp_dir: Optional[str] = None):
        """
        Initialize the Visub API.
        
        Args:
            temp_dir: Directory for temporary files. Uses system temp if None.
        """
        self.temp_dir = temp_dir or tempfile.gettempdir()
    
    def process_video(
        self, 
        video_path: str, 
        output_dir: str,
        subtitle_config: Dict,
        transcription_config: Optional[Dict] = None
    ) -> Dict:
        """
        Process a video file and generate subtitles with custom styling.
        
        Args:
            video_path: Path to the input video file
            output_dir: Directory to save output files
            subtitle_config: Dictionary containing subtitle styling configuration
            transcription_config: Optional transcription settings
        
        Returns:
            Dictionary with results including paths to generated files
        """
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Parse configuration
        config = self._parse_subtitle_config(subtitle_config)
        trans_config = transcription_config or {}
        
        # Extract audio
        audio_paths = get_audio([video_path])
        
        # Create transcription function with config
        def transcribe_func(audio_path):
            return word_transcribe(
                audio_path,
                model=trans_config.get('model', 'base'),
                device=trans_config.get('device', 'cpu'),
                batch_size=trans_config.get('batch_size', 16),
                compute_type=trans_config.get('compute_type', 'int8'),
                language=trans_config.get('language', 'auto'),
                enable_diarization=config.enable_speaker_detection,
                hf_token=trans_config.get('hf_token') or os.getenv('HF_TOKEN')
            )
        
        # If speaker detection is enabled, first run transcription to detect speakers
        detected_speakers = set()
        if config.enable_speaker_detection:
            print("DEBUG: Pre-processing to detect speakers...")
            transcription_result = transcribe_func(list(audio_paths.values())[0])
            for segment in transcription_result.get("segments", []):
                if "words" in segment:
                    for word in segment["words"]:
                        if word.get("speaker"):
                            detected_speakers.add(word["speaker"])
            
            print(f"DEBUG: Detected speakers: {detected_speakers}")
            print(f"DEBUG: Total speakers found: {len(detected_speakers)}")
            
            # Only use auto-config with random colors if no custom speaker styles were provided
            if not config.speaker_styles:
                if detected_speakers:
                    print("DEBUG: No custom speaker styles provided, creating auto speaker config with random colors")
                    auto_config = create_auto_speaker_config(list(detected_speakers))
                    config.speaker_styles = auto_config.speaker_styles
                else:
                    print("DEBUG: No speakers detected and no custom styles, using default styling")
            else:
                print(f"DEBUG: Using provided custom speaker styles for speakers: {list(config.speaker_styles.keys())}")
                if detected_speakers:
                    print(f"DEBUG: Detected speakers in audio: {detected_speakers}")
                    # Check if any detected speakers match our custom styles
                    matching_speakers = [s for s in detected_speakers if s in config.speaker_styles]
                    if matching_speakers:
                        print(f"DEBUG: Found matching custom styles for speakers: {matching_speakers}")
                    else:
                        print("DEBUG: No detected speakers match custom style IDs - will use first custom style as fallback")
        
        # Generate subtitles
        subtitle_paths = get_subtitles(audio_paths, output_dir, transcribe_func, config)
        
        # Generate final video with embedded subtitles
        video_paths = {}
        for original_path, ass_path in subtitle_paths.items():
            import ffmpeg
            from .utils import filename
            
            # Use MP4 as intermediate format (legal for processing, not distribution)
            output_video_path = os.path.join(output_dir, f"{filename(original_path)}_subtitled.mp4")
            
            print(f"Adding subtitles to {filename(original_path)}...")
            
            video = ffmpeg.input(original_path)
            audio = video.audio
            
            # Apply subtitles - subtitle filter requires reencoding
            # Preserve original format but must recompute video due to subtitle overlay
            ffmpeg.concat(
                video.filter('subtitles', ass_path), 
                audio, 
                v=1, 
                a=1
            ).output(output_video_path).run(quiet=False, overwrite_output=True)
            
            video_paths[original_path] = output_video_path
            print(f"Saved subtitled video to {output_video_path}")
        
        # Prepare results
        results = {
            'status': 'success',
            'video_path': video_path,
            'subtitle_files': subtitle_paths,
            'video_files': video_paths,
            'config_used': {
                'max_words': config.max_words_per_subtitle,
                'speaker_detection': config.enable_speaker_detection,
                'output_srt': config.output_srt,
                'speakers': len(detected_speakers)
            }
        }
        
        return results
    
    def _parse_subtitle_config(self, config_dict: Dict) -> SubtitleConfig:
        """
        Parse subtitle configuration from dictionary format.
        
        Expected format:
        {
            "max_words": 4,
            "output_srt": false,
            "enable_speaker_detection": true,
            "speakers": [
                {
                    "speaker_id": "SPEAKER_00",
                    "font_family": "Impact",
                    "font_size": 48,
                    "primary_color": "&H00FFFFFF",
                    "outline_color": "&H00000000",
                    "position": "bottom_center",
                    "bold": true,
                    "italic": false,
                    "text_effect": "outline",
                    "outline_width": 3.0,
                    ...
                }
            ]
        }
        """
        config = SubtitleConfig()
        
        max_words_value = config_dict.get('max_words', 4)
        # Handle "full_sentence" option - use a large number to represent full sentences
        config.max_words_per_subtitle = 999 if max_words_value == "full_sentence" else max_words_value
        config.output_srt = config_dict.get('output_srt', False)
        config.enable_speaker_detection = config_dict.get('enable_speaker_detection', False)
        config.enable_word_highlighting = config_dict.get('enable_word_highlighting', True)
        
        # Parse speaker configurations
        speakers = config_dict.get('speakers', [])
        if speakers:
            print(f"DEBUG: Parsing {len(speakers)} custom speaker configurations")
            for speaker_config in speakers:
                speaker_id = speaker_config.get('speaker_id', 'default')
                
                # Convert frontend format to backend format with safer enum handling
                def safe_font_family(font_name):
                    font_map = {
                        'Impact': FontFamily.IMPACT,
                        'Arial Black': FontFamily.ARIAL_BLACK,
                        'Bebas Neue': FontFamily.BEBAS_NEUE,
                        'Montserrat Black': FontFamily.MONTSERRAT_BLACK,
                        'Oswald': FontFamily.OSWALD,
                        'Roboto Black': FontFamily.ROBOTO_BLACK,
                        'Anton': FontFamily.ANTON,
                        'Barlow': FontFamily.BARLOW,
                        'Lato Black': FontFamily.LATO_BLACK,
                        'Open Sans': FontFamily.OPEN_SANS_BOLD,
                        'Nunito Black': FontFamily.NUNITO_BLACK,
                        'Arial': FontFamily.ARIAL,
                        'Helvetica': FontFamily.HELVETICA
                    }
                    return font_map.get(font_name, FontFamily.IMPACT)
                
                def safe_position(pos_name):
                    pos_map = {
                        'bottom_left': SubtitlePosition.BOTTOM_LEFT,
                        'bottom_center': SubtitlePosition.BOTTOM_CENTER,
                        'bottom_right': SubtitlePosition.BOTTOM_RIGHT,
                        'middle_left': SubtitlePosition.MIDDLE_LEFT,
                        'middle_center': SubtitlePosition.MIDDLE_CENTER,
                        'middle_right': SubtitlePosition.MIDDLE_RIGHT,
                        'top_left': SubtitlePosition.TOP_LEFT,
                        'top_center': SubtitlePosition.TOP_CENTER,
                        'top_right': SubtitlePosition.TOP_RIGHT
                    }
                    return pos_map.get(pos_name, SubtitlePosition.BOTTOM_CENTER)
                
                def safe_text_effect(effect_name):
                    effect_map = {
                        'none': TextEffect.NONE,
                        'glow': TextEffect.GLOW,
                        'shadow': TextEffect.SHADOW,
                        'outline': TextEffect.OUTLINE,
                        'outline_glow': TextEffect.OUTLINE_GLOW,
                        'double_outline': TextEffect.DOUBLE_OUTLINE,
                        'drop_shadow': TextEffect.DROP_SHADOW
                    }
                    return effect_map.get(effect_name, TextEffect.OUTLINE)
                
                def safe_animation(anim_name):
                    anim_map = {
                        'none': AnimationStyle.NONE,
                        'fade_in': AnimationStyle.FADE_IN,
                        'slide_up': AnimationStyle.SLIDE_UP,
                        'scale_in': AnimationStyle.SCALE_IN,
                        'type_writer': AnimationStyle.TYPE_WRITER,
                        'bounce': AnimationStyle.BOUNCE,
                        'pulse': AnimationStyle.PULSE
                    }
                    return anim_map.get(anim_name, AnimationStyle.NONE)
                
                style = SpeakerStyle(
                    font_family=safe_font_family(speaker_config.get('font_family', 'Impact')),
                    font_size=speaker_config.get('font_size', 48),
                    font_weight=speaker_config.get('font_weight', 'bold'),
                    primary_color=hex_to_ass_color(speaker_config.get('primary_color', '&H00FFFFFF')),
                    outline_color=hex_to_ass_color(speaker_config.get('outline_color', '&H00000000')),
                    shadow_color=hex_to_ass_color(speaker_config.get('shadow_color', '&H80000000')),
                    background_color=hex_to_ass_color(speaker_config.get('background_color', '&H00000000')),
                    position=safe_position(speaker_config.get('position', 'bottom_center')),
                    margin_left=speaker_config.get('margin_left', 20),
                    margin_right=speaker_config.get('margin_right', 20),
                    margin_vertical=speaker_config.get('margin_vertical', 40),
                    bold=speaker_config.get('bold', True),
                    italic=speaker_config.get('italic', False),
                    underline=speaker_config.get('underline', False),
                    strikeout=speaker_config.get('strikeout', False),
                    outline_width=speaker_config.get('outline_width', 3.0),
                    shadow_distance=speaker_config.get('shadow_distance', 2.0),
                    text_effect=safe_text_effect(speaker_config.get('text_effect', 'outline')),
                    letter_spacing=speaker_config.get('letter_spacing', 0.0),
                    line_spacing=speaker_config.get('line_spacing', 1.0),
                    scale_x=speaker_config.get('scale_x', 100.0),
                    scale_y=speaker_config.get('scale_y', 100.0),
                    rotation=speaker_config.get('rotation', 0.0),
                    animation=safe_animation(speaker_config.get('animation', 'none')),
                    fade_in_duration=speaker_config.get('fade_in_duration', 0.0),
                    fade_out_duration=speaker_config.get('fade_out_duration', 0.0),
                    background_box=speaker_config.get('background_box', False),
                    box_padding=speaker_config.get('box_padding', 10),
                    box_opacity=speaker_config.get('box_opacity', 0.8),
                    border_style=speaker_config.get('border_style', 1),
                    all_caps=speaker_config.get('all_caps', True),
                    word_wrap=speaker_config.get('word_wrap', True),
                    max_line_length=speaker_config.get('max_line_length', 30),
                    enable_word_highlighting=speaker_config.get('enable_word_highlighting', True),
                    highlight_color=hex_to_ass_color(speaker_config.get('highlight_color', '&H0000FFFF')),
                    highlight_outline_color=hex_to_ass_color(speaker_config.get('highlight_outline_color', '&H00000000')),
                    highlight_bold=speaker_config.get('highlight_bold', True)
                )
                
                config.add_speaker_style(speaker_id, style)
                print(f"DEBUG: Added custom style for {speaker_id}: {style.font_family.value}, {style.primary_color}")
            
            # If speaker detection is disabled but custom styles exist, use first custom style as default
            if not config.enable_speaker_detection and config.speaker_styles:
                first_speaker_id = list(config.speaker_styles.keys())[0]
                first_style = config.speaker_styles[first_speaker_id]
                config.default_style = first_style
                print(f"DEBUG: Speaker detection disabled, using custom style {first_speaker_id} as default")
            elif config.enable_speaker_detection and config.speaker_styles:
                print(f"DEBUG: Speaker detection enabled with custom styles, keeping default style unchanged for fallback")
        else:
            print("DEBUG: No custom speaker styles provided")
        
        return config
    
    def get_supported_models(self) -> List[str]:
        """Get list of supported WhisperX models."""
        return [
            "tiny", "tiny.en", "base", "base.en", "small", "small.en",
            "medium", "medium.en", "large-v1", "large-v2", "large-v3",
            "large", "distil-large-v2", "distil-medium.en", "distil-small.en",
            "distil-large-v3", "large-v3-turbo", "turbo"
        ]
    
    def get_supported_languages(self) -> List[str]:
        """Get list of supported languages for transcription."""
        return [
            "auto", "af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo", 
            "br", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", 
            "eu", "fa", "fi", "fo", "fr", "gl", "gu", "ha", "haw", "he", "hi", 
            "hr", "ht", "hu", "hy", "id", "is", "it", "ja", "jw", "ka", "kk", 
            "km", "kn", "ko", "la", "lb", "ln", "lo", "lt", "lv", "mg", "mi", 
            "mk", "ml", "mn", "mr", "ms", "mt", "my", "ne", "nl", "nn", "no", 
            "oc", "pa", "pl", "ps", "pt", "ro", "ru", "sa", "sd", "si", "sk", 
            "sl", "sn", "so", "sq", "sr", "su", "sv", "sw", "ta", "te", "tg", 
            "th", "tk", "tl", "tr", "tt", "uk", "ur", "uz", "vi", "yi", "yo", "zh"
        ]
    
    def get_supported_positions(self) -> List[Dict]:
        """Get list of supported subtitle positions."""
        return [
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
    
    def get_viral_fonts(self) -> List[Dict]:
        """Get list of fonts popular for viral video content."""
        return [
            {"value": font.name.lower(), "label": font.value, "category": "viral"}
            for font in FontFamily
        ]
    
    def get_text_effects(self) -> List[Dict]:
        """Get list of available text effects."""
        return [
            {"value": effect.value, "label": effect.value.replace("_", " ").title()}
            for effect in TextEffect
        ]
    
    def get_animation_styles(self) -> List[Dict]:
        """Get list of available animation styles."""
        return [
            {"value": anim.value, "label": anim.value.replace("_", " ").title()}
            for anim in AnimationStyle
        ]
    
    def get_preset_styles(self) -> Dict[str, Dict]:
        """Get preset styling configurations for viral content."""
        presets = create_viral_preset_styles()
        result = {}
        
        for name, style in presets.items():
            result[name] = {
                "name": name.replace("_", " ").title(),
                "description": self._get_preset_description(name),
                "preview": {
                    "font_family": style.font_family.value,
                    "font_size": style.font_size,
                    "primary_color": style.primary_color,
                    "outline_color": style.outline_color,
                    "text_effect": style.text_effect.value,
                    "all_caps": style.all_caps,
                    "bold": style.bold
                }
            }
        
        return result
    
    def get_color_palette(self) -> List[Dict]:
        """Get popular colors for viral video content."""
        colors = get_viral_color_palette()
        color_names = [
            "White", "Yellow", "Green", "Blue", "Magenta", 
            "Lime", "Pink", "Orange", "Purple", "Cyan"
        ]
        
        return [
            {"value": color, "label": name, "hex": self._ass_to_hex(color)}
            for color, name in zip(colors, color_names)
        ]
    
    def _get_preset_description(self, preset_name: str) -> str:
        """Get description for preset styles."""
        descriptions = {
            "tiktok_classic": "Bold Impact font with black outline - perfect for TikTok",
            "youtube_viral": "Eye-catching yellow text for maximum attention",
            "instagram_reel": "Modern style with trendy glow effect",
            "podcast_clean": "Clean, readable style for long-form content",
            "gaming_streamer": "High-energy style popular with gamers",
            "minimalist": "Simple, elegant styling for sophisticated content",
            "news_documentary": "Professional style with background box",
            "retro_vintage": "Stylized retro look with unique flair"
        }
        return descriptions.get(preset_name, "Custom styling preset")
    
    def _ass_to_hex(self, ass_color: str) -> str:
        """Convert ASS color format to hex for frontend display."""
        if ass_color.startswith("&H"):
            # Extract BGR values from format &H00BBGGRR
            hex_part = ass_color[2:]  # Remove &H
            if len(hex_part) >= 8:
                # Skip alpha (first 2 chars) and get BGR values
                alpha = hex_part[0:2]
                b = hex_part[2:4]
                g = hex_part[4:6] 
                r = hex_part[6:8]
                return f"#{r}{g}{b}".upper()
            elif len(hex_part) >= 6:
                # Handle format without alpha
                b, g, r = hex_part[0:2], hex_part[2:4], hex_part[4:6]
                return f"#{r}{g}{b}".upper()
        return "#FFFFFF"  # Default to white
    
    def validate_config(self, config_dict: Dict) -> Dict:
        """
        Validate subtitle configuration dictionary.
        
        Returns:
            Dictionary with validation results and any errors
        """
        errors = []
        warnings = []
        
        # Validate max_words
        max_words = config_dict.get('max_words', 4)
        if not isinstance(max_words, int) or max_words < 1:
            errors.append("max_words must be a positive integer")
        elif max_words > 50:
            warnings.append("max_words > 50 may result in very long subtitles")
        
        # Validate speakers
        speakers = config_dict.get('speakers', [])
        if not isinstance(speakers, list):
            errors.append("speakers must be a list")
        else:
            for i, speaker in enumerate(speakers):
                speaker_errors = self._validate_speaker_config(speaker, i)
                errors.extend(speaker_errors)
        
        # Check for duplicate speaker IDs
        speaker_ids = [s.get('speaker_id') for s in speakers if isinstance(s, dict)]
        if len(speaker_ids) != len(set(speaker_ids)):
            errors.append("Duplicate speaker IDs found")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _validate_speaker_config(self, speaker: Dict, index: int) -> List[str]:
        """Validate individual speaker configuration."""
        errors = []
        prefix = f"Speaker {index}: "
        
        if not isinstance(speaker, dict):
            return [f"{prefix}Must be a dictionary"]
        
        # Validate speaker_id
        speaker_id = speaker.get('speaker_id')
        if not speaker_id or not isinstance(speaker_id, str):
            errors.append(f"{prefix}speaker_id is required and must be a string")
        
        # Validate font_size
        font_size = speaker.get('font_size', 30)
        if not isinstance(font_size, int) or font_size < 8 or font_size > 100:
            errors.append(f"{prefix}font_size must be an integer between 8 and 100")
        
        # Validate color format
        color = speaker.get('color', '#FFFFFF')
        if isinstance(color, str):
            if color.startswith('#') and len(color) == 7:
                try:
                    int(color[1:], 16)  # Validate hex
                except ValueError:
                    errors.append(f"{prefix}Invalid hex color format")
            elif not color.startswith('&H'):
                errors.append(f"{prefix}Color must be hex (#RRGGBB) or ASS format (&H00BBGGRR)")
        
        # Validate position
        position = speaker.get('position', 'bottom_center')
        valid_positions = [pos['value'] for pos in self.get_supported_positions()]
        if position not in valid_positions:
            errors.append(f"{prefix}Invalid position. Must be one of: {valid_positions}")
        
        return errors


def create_api_instance(temp_dir: Optional[str] = None) -> VisubAPI:
    """Factory function to create a Visub API instance."""
    return VisubAPI(temp_dir)