from dataclasses import dataclass, field
from typing import Dict, Optional, List
from enum import Enum
import random

class SubtitlePosition(Enum):
    """Subtitle positioning options for ASS format."""
    BOTTOM_CENTER = 2
    BOTTOM_LEFT = 1
    BOTTOM_RIGHT = 3
    MIDDLE_LEFT = 9
    MIDDLE_CENTER = 5
    MIDDLE_RIGHT = 6
    TOP_LEFT = 7
    TOP_CENTER = 8
    TOP_RIGHT = 9

class FontFamily(Enum):
    """Popular fonts for viral video content."""
    IMPACT = "Impact"
    ARIAL_BLACK = "Arial Black"
    BEBAS_NEUE = "Bebas Neue"
    MONTSERRAT_BLACK = "Montserrat Black"
    OSWALD = "Oswald"
    ROBOTO_BLACK = "Roboto Black"
    ANTON = "Anton"
    BARLOW = "Barlow"
    LATO_BLACK = "Lato Black"
    OPEN_SANS_BOLD = "Open Sans"
    NUNITO_BLACK = "Nunito Black"
    ARIAL = "Arial"
    HELVETICA = "Helvetica"

class TextEffect(Enum):
    """Text effects for enhanced visibility."""
    NONE = "none"
    GLOW = "glow"
    SHADOW = "shadow"
    OUTLINE = "outline"
    OUTLINE_GLOW = "outline_glow"
    DOUBLE_OUTLINE = "double_outline"
    DROP_SHADOW = "drop_shadow"

class AnimationStyle(Enum):
    """Animation styles for text appearance."""
    NONE = "none"
    FADE_IN = "fade_in"
    SLIDE_UP = "slide_up"
    SCALE_IN = "scale_in"
    TYPE_WRITER = "type_writer"
    BOUNCE = "bounce"
    PULSE = "pulse"

@dataclass
class SpeakerStyle:
    """Configuration for individual speaker subtitle styling with viral video options."""
    # Font settings
    font_family: FontFamily = FontFamily.IMPACT
    font_size: int = 48
    font_weight: str = "bold"  # normal, bold, extra-bold
    
    # Colors (in ASS format &H00BBGGRR)
    primary_color: str = "&H00FFFFFF"  # Main text color
    outline_color: str = "&H00000000"  # Outline color
    shadow_color: str = "&H80000000"   # Shadow color (with transparency)
    background_color: str = "&H00000000"  # Background box color
    
    # Position and alignment  
    position: SubtitlePosition = SubtitlePosition.MIDDLE_CENTER
    margin_left: int = 20
    margin_right: int = 20
    margin_vertical: int = 40
    
    # Text styling
    bold: bool = True
    italic: bool = False
    underline: bool = False
    strikeout: bool = False
    
    # Effects
    outline_width: float = 3.0
    shadow_distance: float = 2.0
    text_effect: TextEffect = TextEffect.OUTLINE
    
    # Advanced styling
    letter_spacing: float = 0.0
    line_spacing: float = 1.0
    scale_x: float = 100.0  # Horizontal scaling percentage
    scale_y: float = 100.0  # Vertical scaling percentage
    rotation: float = 0.0   # Text rotation in degrees
    
    # Animation
    animation: AnimationStyle = AnimationStyle.NONE
    fade_in_duration: float = 0.0
    fade_out_duration: float = 0.0
    
    # Background box
    background_box: bool = False
    box_padding: int = 10
    box_opacity: float = 0.8
    
    # Stroke/border
    border_style: int = 1  # 0=outline+shadow, 1=opaque box, 2=no shadow, 3=transparent box
    
    # TikTok-style presets
    all_caps: bool = True
    word_wrap: bool = True
    max_line_length: int = 30
    
    # Word-level highlighting (karaoke-style)
    enable_word_highlighting: bool = True
    highlight_color: str = "&H0000FFFF"  # Yellow highlight by default
    highlight_outline_color: str = "&H00000000"  # Black outline for highlight
    highlight_bold: bool = True  # Make highlighted word bold
    
    def to_ass_style(self, style_name: str) -> str:
        """Convert speaker style to comprehensive ASS format style string."""
        alignment = self.position.value
        bold_flag = 1 if self.bold else 0
        italic_flag = 1 if self.italic else 0
        underline_flag = 1 if self.underline else 0
        strikeout_flag = 1 if self.strikeout else 0
        
        # Get font name from enum
        font_name = self.font_family.value
        
        # Handle transparent colors
        primary_color = "&H00000000" if self.primary_color == "transparent" else self.primary_color
        outline_color = "&H00000000" if self.outline_color == "transparent" else self.outline_color
        shadow_color = "&H00000000" if self.shadow_color == "transparent" else self.shadow_color
        background_color = "&H00000000" if self.background_color == "transparent" else self.background_color
        
        # ASS format: PrimaryColour, SecondaryColour, OutlineColour, BackColour
        # Force no animations by setting fixed values and encoding=1 (no auto-transitions)
        style_line = (
            f"Style: {style_name},{font_name},{self.font_size},"
            f"{primary_color},{primary_color},{outline_color},{background_color},"
            f"{bold_flag},{italic_flag},{underline_flag},{strikeout_flag},"
            f"{self.scale_x},{self.scale_y},{self.letter_spacing},{self.rotation},"
            f"{self.border_style},{self.outline_width},{self.shadow_distance},"
            f"{alignment},{self.margin_left},{self.margin_right},{self.margin_vertical},1"
        )
        
        print(f"DEBUG: Generated ASS style for {style_name}: {style_line}")
        return style_line
    
    def apply_text_effect(self) -> Dict[str, float]:
        """Apply specific text effects based on chosen effect type."""
        effects = {}
        
        if self.text_effect == TextEffect.GLOW:
            effects.update({
                "outline_width": 5.0,
                "shadow_distance": 0.0,
                "outline_color": self.primary_color,
            })
        elif self.text_effect == TextEffect.SHADOW:
            effects.update({
                "outline_width": 0.0,
                "shadow_distance": 4.0,
            })
        elif self.text_effect == TextEffect.OUTLINE:
            effects.update({
                "outline_width": self.outline_width,
                "shadow_distance": 1.0,
            })
        elif self.text_effect == TextEffect.OUTLINE_GLOW:
            effects.update({
                "outline_width": self.outline_width + 2.0,
                "shadow_distance": 0.0,
            })
        elif self.text_effect == TextEffect.DOUBLE_OUTLINE:
            effects.update({
                "outline_width": self.outline_width * 1.5,
                "shadow_distance": 2.0,
            })
        elif self.text_effect == TextEffect.DROP_SHADOW:
            effects.update({
                "outline_width": 2.0,
                "shadow_distance": 6.0,
            })
        
        return effects

@dataclass 
class SubtitleConfig:
    """Main configuration for subtitle generation."""
    max_words_per_subtitle: int = 4
    min_words_per_subtitle: int = 1
    speaker_styles: Dict[str, SpeakerStyle] = field(default_factory=dict)
    default_style: SpeakerStyle = field(default_factory=SpeakerStyle)
    enable_speaker_detection: bool = False
    output_srt: bool = False
    enable_word_highlighting: bool = True  # Enable word highlighting by default
    
    def get_speaker_style(self, speaker_id: Optional[str] = None) -> SpeakerStyle:
        """Get style for a specific speaker, or default if not found."""
        if speaker_id and speaker_id in self.speaker_styles:
            return self.speaker_styles[speaker_id]
        return self.default_style
    
    def add_speaker_style(self, speaker_id: str, style: SpeakerStyle):
        """Add or update a speaker's style configuration."""
        self.speaker_styles[speaker_id] = style
    
    def get_all_styles_for_ass(self) -> List[str]:
        """Generate all ASS style definitions."""
        styles = [self.default_style.to_ass_style("Default")]
        
        # Only add regular speaker styles - highlighting is handled with inline tags
        for speaker_id, style in self.speaker_styles.items():
            style_name = f"Speaker_{speaker_id}"
            styles.append(style.to_ass_style(style_name))
            
        return styles
    
    def _create_highlight_style(self, base_style: SpeakerStyle) -> SpeakerStyle:
        """Create a highlight version of a style for word highlighting."""
        from copy import deepcopy
        highlight_style = deepcopy(base_style)
        
        # Override colors and formatting for highlighting
        if hasattr(base_style, 'highlight_color'):
            highlight_style.primary_color = base_style.highlight_color
        if hasattr(base_style, 'highlight_outline_color'):
            highlight_style.outline_color = base_style.highlight_outline_color
        if hasattr(base_style, 'highlight_bold'):
            highlight_style.bold = base_style.highlight_bold
        
            
        return highlight_style

def create_default_config() -> SubtitleConfig:
    """Create a default subtitle configuration."""
    return SubtitleConfig(
        max_words_per_subtitle=4,
        min_words_per_subtitle=1,
        default_style=SpeakerStyle(
            font_family=FontFamily.ARIAL,
            font_size=30,
            primary_color="&H00FFFFFF",
            position=SubtitlePosition.MIDDLE_CENTER,
            animation=AnimationStyle.NONE,
            highlight_color="&H0000FFFF"  # Yellow highlight by default
        )
    )

def generate_random_colors(num_speakers: int) -> List[str]:
    """Generate a list of random, distinct colors for speakers in ASS format."""
    colors = [
        "&H000000FF",  # Red
        "&H0000FF00",  # Green  
        "&H00FF0000",  # Blue
        "&H0000FFFF",  # Yellow
        "&H00FF00FF",  # Magenta
        "&H00FFFF00",  # Cyan
        "&H004080FF",  # Orange
        "&H008000FF",  # Purple
        "&H0000FF80",  # Lime
        "&H00FF8000",  # Pink
    ]
    
    # If we need more colors than predefined, generate random ones
    while len(colors) < num_speakers:
        r = random.randint(50, 255)  # Avoid very dark colors
        g = random.randint(50, 255)
        b = random.randint(50, 255)
        ass_color = f"&H00{b:02X}{g:02X}{r:02X}"
        colors.append(ass_color)
    
    return colors[:num_speakers]

def hex_to_ass_color(hex_color: str) -> str:
    """Convert hex color (#RRGGBB) to ASS format (&H00BBGGRR)."""
    if hex_color == 'transparent' or hex_color == '':
        return 'transparent'
    
    if hex_color.startswith('#') and len(hex_color) == 7:
        r = hex_color[1:3]
        g = hex_color[3:5]
        b = hex_color[5:7]
        return f"&H00{b}{g}{r}".upper()
    
    # If already in ASS format, return as is
    if hex_color.startswith('&H'):
        return hex_color
    
    return "&H00FFFFFF"  # Default to white

def create_auto_speaker_config(detected_speakers: List[str]) -> SubtitleConfig:
    """Create configuration with random colors for detected speakers."""
    config = create_default_config()
    config.enable_speaker_detection = True
    
    if not detected_speakers:
        return config
    
    # Generate random colors for each speaker
    colors = generate_random_colors(len(detected_speakers))
    
    for i, speaker_id in enumerate(detected_speakers):
        style = SpeakerStyle(
            font_family=FontFamily.ARIAL,
            font_size=32,  # Slightly larger for better visibility
            primary_color=colors[i],
            position=SubtitlePosition.MIDDLE_CENTER,
            bold=True,  # Bold for better visibility
            outline_width=3,  # Thicker outline for contrast
            animation=AnimationStyle.NONE,  # No animation by default
            highlight_color="&H0000FFFF"  # Yellow highlight by default
        )
        config.add_speaker_style(speaker_id, style)
        print(f"DEBUG: Assigned {colors[i]} color to {speaker_id}")
    
    return config

def create_viral_preset_styles() -> Dict[str, SpeakerStyle]:
    """Create preset styles for viral video content."""
    presets = {}
    
    # TikTok Classic (Impact font, white text, black outline)
    presets["tiktok_classic"] = SpeakerStyle(
        font_family=FontFamily.IMPACT,
        font_size=52,
        primary_color="&H00FFFFFF",  # White
        outline_color="&H00000000",  # Black
        outline_width=4.0,
        text_effect=TextEffect.OUTLINE,
        position=SubtitlePosition.BOTTOM_CENTER,
        all_caps=True,
        bold=True
    )
    
    # YouTube Viral (Bold Arial Black, bright colors)
    presets["youtube_viral"] = SpeakerStyle(
        font_family=FontFamily.ARIAL_BLACK,
        font_size=48,
        primary_color="&H0000FFFF",  # Yellow
        outline_color="&H00000000",  # Black
        outline_width=5.0,
        text_effect=TextEffect.DOUBLE_OUTLINE,
        position=SubtitlePosition.BOTTOM_CENTER,
        all_caps=True,
        bold=True
    )
    
    # Instagram Reel (Modern sans-serif with glow)
    presets["instagram_reel"] = SpeakerStyle(
        font_family=FontFamily.MONTSERRAT_BLACK,
        font_size=44,
        primary_color="&H00FFFFFF",  # White
        outline_color="&H00FF00FF",  # Magenta
        outline_width=3.0,
        text_effect=TextEffect.GLOW,
        position=SubtitlePosition.MIDDLE_CENTER,
        all_caps=False,
        bold=True
    )
    
    # Podcast Style (Clean, readable)
    presets["podcast_clean"] = SpeakerStyle(
        font_family=FontFamily.LATO_BLACK,
        font_size=40,
        primary_color="&H00FFFFFF",  # White
        outline_color="&H80000000",  # Semi-transparent black
        outline_width=2.0,
        text_effect=TextEffect.SHADOW,
        position=SubtitlePosition.BOTTOM_CENTER,
        all_caps=False,
        bold=True,
        background_box=True,
        box_opacity=0.7
    )
    
    # Gaming/Streamer (Bold with effects)
    presets["gaming_streamer"] = SpeakerStyle(
        font_family=FontFamily.BEBAS_NEUE,
        font_size=56,
        primary_color="&H0000FF00",  # Green
        outline_color="&H00000000",  # Black
        shadow_color="&H80008000",  # Dark green shadow
        outline_width=4.0,
        shadow_distance=3.0,
        text_effect=TextEffect.OUTLINE_GLOW,
        position=SubtitlePosition.TOP_CENTER,
        all_caps=True,
        bold=True
    )
    
    # Minimalist (Simple, elegant)
    presets["minimalist"] = SpeakerStyle(
        font_family=FontFamily.HELVETICA,
        font_size=36,
        primary_color="&H00F0F0F0",  # Light gray
        outline_color="&H00404040",  # Dark gray
        outline_width=1.5,
        text_effect=TextEffect.OUTLINE,
        position=SubtitlePosition.BOTTOM_CENTER,
        all_caps=False,
        bold=False
    )
    
    # News/Documentary (Professional)
    presets["news_documentary"] = SpeakerStyle(
        font_family=FontFamily.ARIAL,
        font_size=38,
        primary_color="&H00FFFFFF",  # White
        outline_color="&H00000000",  # Black
        outline_width=2.0,
        text_effect=TextEffect.OUTLINE,
        position=SubtitlePosition.BOTTOM_CENTER,
        all_caps=False,
        bold=True,
        background_box=True,
        background_color="&H80000000",  # Semi-transparent black
        box_opacity=0.8
    )
    
    # Retro/Vintage (Stylized)
    presets["retro_vintage"] = SpeakerStyle(
        font_family=FontFamily.ANTON,
        font_size=50,
        primary_color="&H0000FFFF",  # Yellow
        outline_color="&H00800080",  # Purple
        outline_width=6.0,
        text_effect=TextEffect.DOUBLE_OUTLINE,
        position=SubtitlePosition.MIDDLE_CENTER,
        all_caps=True,
        bold=True,
        rotation=2.0  # Slight tilt
    )
    
    return presets

def get_viral_color_palette() -> List[str]:
    """Get popular colors for viral video content in ASS format."""
    return [
        "&H00FFFFFF",  # White (classic)
        "&H0000FFFF",  # Yellow (attention-grabbing)
        "&H0000FF00",  # Green (gaming/tech)
        "&H00FF0000",  # Blue (professional)
        "&H00FF00FF",  # Magenta (trendy)
        "&H0000FF80",  # Lime (energetic)
        "&H00FF8000",  # Pink (playful)
        "&H004080FF",  # Orange (warm)
        "&H008000FF",  # Purple (creative)
        "&H00FFFF00",  # Cyan (cool)
    ]

def create_multi_speaker_config(speaker_configs: List[Dict]) -> SubtitleConfig:
    """Create configuration for multiple speakers from web interface data.
    
    Args:
        speaker_configs: List of dicts with keys: speaker_id, font_family, 
                        font_size, color, position, bold, italic
    """
    config = create_default_config()
    config.enable_speaker_detection = True
    
    for speaker_config in speaker_configs:
        speaker_id = speaker_config.get('speaker_id', 'default')
        
        # Convert hex color to ASS format if needed
        color = speaker_config.get('color', '#FFFFFF')
        if color.startswith('#'):
            # Convert #RRGGBB to &H00BBGGRR (ASS format)
            hex_color = color[1:]  # Remove #
            if len(hex_color) == 6:
                r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
                ass_color = f"&H00{b}{g}{r}".upper()
            else:
                ass_color = "&H00FFFFFF"  # Default to white
        else:
            ass_color = color
        
        # Convert position string to enum
        position_str = speaker_config.get('position', 'bottom_center').upper()
        try:
            position = SubtitlePosition[position_str]
        except KeyError:
            position = SubtitlePosition.BOTTOM_CENTER
        
        style = SpeakerStyle(
            font_family=FontFamily.ARIAL,  # Use enum
            font_size=speaker_config.get('font_size', 30),
            primary_color=ass_color,
            position=position,
            bold=speaker_config.get('bold', False),
            italic=speaker_config.get('italic', False)
        )
        
        config.add_speaker_style(speaker_id, style)
    
    return config