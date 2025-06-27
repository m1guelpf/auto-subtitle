import os
import ffmpeg
import argparse
import warnings
import tempfile
from .utils import filename, str2bool, ass_time, format_timedelta
from .transcribe import word_transcribe
from .config import SubtitleConfig, create_default_config
from datetime import timedelta

def get_animation_tags(animation_type, style):
    """Generate ASS animation tags based on animation type and style settings."""
    if animation_type == 'none':
        return ""
    
    fade_in_duration = getattr(style, 'fade_in_duration', 0.0) * 1000  # Convert to milliseconds
    fade_out_duration = getattr(style, 'fade_out_duration', 0.0) * 1000
    
    # Only apply animations if fade durations are greater than 0
    if fade_in_duration == 0 and fade_out_duration == 0:
        return ""
    
    if animation_type == 'fade_in':
        return f"{{\\fad({int(fade_in_duration)},{int(fade_out_duration)})}}"
    
    elif animation_type == 'slide_up':
        # Slide up animation using \\move
        return f"{{\\move(320,400,320,350,0,{int(fade_in_duration)})}}{{\\fad({int(fade_in_duration)},{int(fade_out_duration)})}}"
    
    elif animation_type == 'scale_in':
        # Scale in animation using \\fscx and \\fscy
        return f"{{\\t(0,{int(fade_in_duration)},\\fscx100\\fscy100)}}{{\\fscx50\\fscy50}}{{\\fad({int(fade_in_duration)},{int(fade_out_duration)})}}"
    
    elif animation_type == 'bounce':
        # Bounce effect using multiple \\t transforms
        bounce_time = int(fade_in_duration / 3)
        return f"{{\\t(0,{bounce_time},\\fscx120\\fscy120)}}{{\\t({bounce_time},{bounce_time*2},\\fscx90\\fscy90)}}{{\\t({bounce_time*2},{int(fade_in_duration)},\\fscx100\\fscy100)}}{{\\fad({int(fade_in_duration)},{int(fade_out_duration)})}}"
    
    elif animation_type == 'pulse':
        # Pulse animation
        pulse_time = int(fade_in_duration / 2)
        return f"{{\\t(0,{pulse_time},\\fscx110\\fscy110)}}{{\\t({pulse_time},{int(fade_in_duration)},\\fscx100\\fscy100)}}{{\\fad({int(fade_in_duration)},{int(fade_out_duration)})}}"
    
    elif animation_type == 'type_writer':
        # Typewriter effect (this is complex and might need different implementation)
        return f"{{\\fad({int(fade_in_duration)},{int(fade_out_duration)})}}"
    
    # Default fallback - only apply if durations are > 0
    return ""

def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("video", nargs="+", type=str,
                        help="paths to video files to transcribe")
    parser.add_argument("--model", default="medium-v2",
                        help="name of the WhisperX model to use")
    parser.add_argument("--output_dir", "-o", type=str,
                        default=".", help="directory to save the outputs")
    parser.add_argument("--num_words", "-n", type=int, default=4,
                    help="maximum number of words to show (default: 4)")
    parser.add_argument("--output_srt", type=str2bool, default=False,
                        help="whether to output the .srt file along with the video files")
    parser.add_argument("--srt_only", type=str2bool, default=False,
                        help="only generate the .srt file and not create overlayed video")
    parser.add_argument("--language", type=str, default="auto", choices=["auto","af","am","ar","as","az","ba","be","bg","bn","bo","br","bs","ca","cs","cy","da","de","el","en","es","et","eu","fa","fi","fo","fr","gl","gu","ha","haw","he","hi","hr","ht","hu","hy","id","is","it","ja","jw","ka","kk","km","kn","ko","la","lb","ln","lo","lt","lv","mg","mi","mk","ml","mn","mr","ms","mt","my","ne","nl","nn","no","oc","pa","pl","ps","pt","ro","ru","sa","sd","si","sk","sl","sn","so","sq","sr","su","sv","sw","ta","te","tg","th","tk","tl","tr","tt","uk","ur","uz","vi","yi","yo","zh"], 
    help="What is the origin language of the video? If unset, it is detected automatically.")

    args = parser.parse_args().__dict__
    model_name: str = args.pop("model")
    output_dir: str = args.pop("output_dir")
    output_srt: bool = args.pop("output_srt")
    srt_only: bool = args.pop("srt_only")
    language: str = args.pop("language")
    num_words: int = args.pop("num_words")
    
    os.makedirs(output_dir, exist_ok=True)

    if model_name.endswith(".en"):
        warnings.warn(
            f"{model_name} is an English-only model, forcing English detection.")
        args["language"] = "en"
    # if translate task used and language argument is set, then use it
    elif language != "auto":
        args["language"] = language
        
    audios = get_audio(args.pop("video"))
    
    # Create subtitle configuration
    config = create_default_config()
    config.max_words_per_subtitle = num_words
    config.output_srt = output_srt or srt_only
    
    subtitles = get_subtitles(
        audios, 
        output_dir, 
        lambda audio_path: word_transcribe(audio_path, **args),
        config
    )

    if srt_only:
        return

    for path, ass_path in subtitles.items():
        # Use MP4 as intermediate format (legal for processing, not distribution)
        out_path = os.path.join(output_dir, f"{filename(path)}_subtitled.mp4")

        print(f"Adding subtitles to {filename(path)}...")

        video = ffmpeg.input(path)
        audio = video.audio

        # Apply subtitles - subtitle filter requires reencoding
        # Preserve original format but must recompute video due to subtitle overlay
        ffmpeg.concat(
            video.filter('subtitles', ass_path), 
            audio, 
            v=1, 
            a=1
        ).output(out_path).run(quiet=False, overwrite_output=True)

        print(f"Saved subtitled video to {os.path.abspath(out_path)}.")


def get_audio(paths):
    temp_dir = tempfile.gettempdir()

    audio_paths = {}

    for path in paths:
        print(f"Extracting audio from {filename(path)}...")
        output_path = os.path.join(temp_dir, f"{filename(path)}.wav")

        ffmpeg.input(path).output(
            output_path,
            acodec="pcm_s16le", ac=1, ar="16k"
        ).run(quiet=True, overwrite_output=True)

        audio_paths[path] = output_path

    return audio_paths


def get_subtitles(audio_paths: dict, output_dir: str, transcribe: callable, config: SubtitleConfig):
    """
    Generate word-by-word ASS subtitles with customizable styling per speaker.
    
    Args:
        audio_paths: Dict of {path: audio_path}
        output_dir: Directory for ASS/SRT output
        transcribe: Callable returning transcription with word-level timestamps
        config: SubtitleConfig object containing all styling preferences
    
    Returns:
        Dict of {path: ass_path}
    """
    subtitles_path = {}

    for path, audio_path in audio_paths.items():
        base_name = os.path.splitext(os.path.basename(path))[0]
        ass_path = os.path.join(output_dir, f"{base_name}.ass")
        srt_path = os.path.join(output_dir, f"{base_name}.srt") if config.output_srt else None
        
        print(f"Generating subtitles for {base_name}...")
        print(f"DEBUG: Config max_words_per_subtitle: {config.max_words_per_subtitle}")
        print(f"DEBUG: Config speaker_styles: {list(config.speaker_styles.keys())}")
        print(f"DEBUG: Config enable_speaker_detection: {config.enable_speaker_detection}")
        print(f"DEBUG: Config enable_word_highlighting: {config.enable_word_highlighting}")

        # Transcribe audio (assumes word-level timestamps)
        result = transcribe(audio_path)

        # Extract and group words into subtitles
        subtitle_groups = []
        
        for segment in result["segments"]:
            if "words" in segment:
                words_in_segment = segment["words"]
                
                # Check if we're using full sentence mode
                if config.max_words_per_subtitle >= 999:  # Full sentence mode
                    # Group words by sentence boundaries
                    current_sentence = []
                    
                    for word in words_in_segment:
                        current_sentence.append(word)
                        
                        # Check if this word ends a sentence
                        word_text = word["word"].strip()
                        if word_text.endswith(('.', '!', '?', ':', ';')) or len(current_sentence) >= 50:  # Max 50 words per sentence as safety
                            if current_sentence:
                                # Get speaker information from first word in sentence
                                speaker_id = current_sentence[0].get("speaker", None)
                                
                                # Combine text from all words in sentence
                                combined_text = " ".join(w["word"] for w in current_sentence)
                                
                                subtitle_groups.append({
                                    "start": current_sentence[0]["start"],
                                    "end": current_sentence[-1]["end"],
                                    "text": combined_text,
                                    "speaker": speaker_id,
                                    "words": current_sentence  # Preserve individual word data for highlighting
                                })
                                current_sentence = []
                    
                    # Handle any remaining words in incomplete sentence
                    if current_sentence:
                        speaker_id = current_sentence[0].get("speaker", None)
                        combined_text = " ".join(w["word"] for w in current_sentence)
                        
                        subtitle_groups.append({
                            "start": current_sentence[0]["start"],
                            "end": current_sentence[-1]["end"],
                            "text": combined_text,
                            "speaker": speaker_id,
                            "words": current_sentence
                        })
                else:
                    # Group words into chunks of max_words_per_subtitle
                    for i in range(0, len(words_in_segment), config.max_words_per_subtitle):
                        word_group = words_in_segment[i:i + config.max_words_per_subtitle]
                        
                        if word_group:  # Make sure group is not empty
                            # Get speaker information from first word in group
                            speaker_id = word_group[0].get("speaker", None)
                            
                            # Combine text from all words in group
                            combined_text = " ".join(word["word"] for word in word_group)
                            
                            subtitle_groups.append({
                                "start": word_group[0]["start"],
                                "end": word_group[-1]["end"],
                                "text": combined_text,
                                "speaker": speaker_id,
                                "words": word_group  # Preserve individual word data for highlighting
                            })

        # Write ASS file with multiple styles
        with open(ass_path, "w", encoding="utf-8") as f:
            # Write ASS header with no animations/transitions
            f.write("""[Script Info]
Title: Word-by-Word Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1280
PlayResY: 720
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
""")
            
            # Write all style definitions
            styles = config.get_all_styles_for_ass()
            print(f"DEBUG: Writing {len(styles)} styles to ASS file")
            for i, style in enumerate(styles):
                print(f"DEBUG: Style {i}: {style}")
                f.write(style + "\n")
            
            f.write("\n[Events]\n")
            f.write("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
            
            # Write dialogue events with appropriate styles and word highlighting
            for i, subtitle in enumerate(subtitle_groups):
                start_time = ass_time(subtitle["start"])
                end_time = ass_time(subtitle["end"])
                text = subtitle["text"].replace('\n', '\\N')
                
                # Determine style name and get the actual style object for text transformations
                style_name = "Default"
                current_style = config.default_style
                
                if subtitle["speaker"] and subtitle["speaker"] in config.speaker_styles:
                    # Speaker detected and has custom style
                    style_name = f"Speaker_{subtitle['speaker']}"
                    current_style = config.speaker_styles[subtitle["speaker"]]
                    print(f"DEBUG: Using custom style for detected speaker {subtitle['speaker']}: {style_name}")
                elif config.speaker_styles and not config.enable_speaker_detection:
                    # No speaker detection but custom styles exist - use first custom style
                    first_speaker_id = list(config.speaker_styles.keys())[0]
                    style_name = f"Speaker_{first_speaker_id}"
                    current_style = config.speaker_styles[first_speaker_id]
                    print(f"DEBUG: No speaker detection, using first custom style: {style_name}")
                elif config.speaker_styles and subtitle["speaker"] is None:
                    # Speaker detection enabled but no speaker detected for this subtitle - use first custom style
                    first_speaker_id = list(config.speaker_styles.keys())[0]
                    style_name = f"Speaker_{first_speaker_id}"
                    current_style = config.speaker_styles[first_speaker_id]
                    print(f"DEBUG: Speaker detection enabled but no speaker for this subtitle, using first custom style: {style_name}")
                else:
                    print(f"DEBUG: Using default style for speaker {subtitle.get('speaker', 'None')}")
                
                # Apply text transformations based on style settings
                if hasattr(current_style, 'all_caps') and current_style.all_caps:
                    text = text.upper()
                    print(f"DEBUG: Applied uppercase transformation to: {text}")
                
                # Add word highlighting if enabled (karaoke-style)
                if (config.enable_word_highlighting and 
                    hasattr(current_style, 'enable_word_highlighting') and 
                    current_style.enable_word_highlighting and
                    "words" in subtitle):
                    
                    # Create karaoke-style highlighting using exact WhisperX word timings
                    words = subtitle["words"]
                    
                    # Apply text transformations to individual words first
                    processed_words = []
                    for i, word_item in enumerate(words):
                        word_text = word_item["word"].strip()
                        if hasattr(current_style, 'all_caps') and current_style.all_caps:
                            word_text = word_text.upper()
                        processed_words.append((i, word_text))
                    
                    # Use the style's primary color for non-highlighted words
                    default_color = current_style.primary_color
                    
                    # Create seamless timing by forcing exact continuity
                    adjusted_timings = []
                    
                    # First pass: use exact WhisperX timings, only adjust for seamless continuity
                    for word_index, word_data in enumerate(words):
                        # Always use exact WhisperX start time for each word (rounded to 2 decimals)
                        start_time = round(word_data["start"], 2)
                        
                        if word_index < len(words) - 1:
                            # End exactly when next word starts (WhisperX timing)
                            end_time = round(words[word_index + 1]["start"], 2)
                        else:
                            # Last word: use its exact WhisperX end time
                            end_time = round(word_data["end"], 2)
                        
                        adjusted_timings.append({
                            "start": start_time,
                            "end": end_time,
                            "word": word_data["word"],
                            "original_start": word_data["start"],
                            "original_end": word_data["end"]
                        })
                    
                    # Get animation tags for subtitle entrance effect
                    animation_tags = ""
                    if hasattr(current_style, 'animation') and current_style.animation != 'none':
                        # Animation applied only to the first word for entrance effect, then word highlighting continues
                        animation_tags = get_animation_tags(current_style.animation, current_style)
                    
                    # Second pass: create subtitle lines with perfectly seamless timing
                    for word_index, timing in enumerate(adjusted_timings):
                        word_start = ass_time(timing["start"])
                        word_end = ass_time(timing["end"])
                        
                        # Get highlight styling from current style configuration
                        highlight_color = getattr(current_style, 'highlight_color', '&H0000FFFF')
                        highlight_bold = getattr(current_style, 'highlight_bold', True)
                        
                        # Build the highlight formatting tags
                        highlight_start_tags = ""
                        highlight_end_tags = ""
                        
                        # Add bold formatting if enabled
                        if highlight_bold:
                            highlight_start_tags += "{\\b1}"
                            highlight_end_tags = "{\\b0}" + highlight_end_tags
                        
                        # Add color formatting
                        highlight_start_tags += f"{{\\c{highlight_color}}}"
                        highlight_end_tags = f"{{\\c{default_color}}}" + highlight_end_tags
                        
                        
                        # Create subtitle text showing full chunk with current word highlighted
                        highlighted_text = " ".join(
                            f"{highlight_start_tags}{word_text}{highlight_end_tags}" if i == word_index else word_text
                            for i, word_text in processed_words
                        )
                        
                        # Write subtitle line for this word with forced seamless timing (add animation only to first word)
                        final_animation_tags = animation_tags if word_index == 0 else ""
                        f.write(f"Dialogue: 0,{word_start},{word_end},{style_name},,0,0,0,,{final_animation_tags}{highlighted_text}\n")
                else:
                    # Write the base subtitle line without highlighting
                    # Add animation effects if enabled
                    animation_tags = ""
                    if hasattr(current_style, 'animation') and current_style.animation != 'none':
                        animation_tags = get_animation_tags(current_style.animation, current_style)
                    
                    f.write(f"Dialogue: 0,{start_time},{end_time},{style_name},,0,0,0,,{animation_tags}{text}\n")

        # Write SRT file if requested
        if config.output_srt and srt_path:
            with open(srt_path, "w", encoding="utf-8") as srt:
                for i, subtitle in enumerate(subtitle_groups, 1):
                    start_time = format_timedelta(timedelta(seconds=subtitle["start"]))
                    end_time = format_timedelta(timedelta(seconds=subtitle["end"]))
                    speaker_prefix = f"[{subtitle['speaker']}] " if subtitle["speaker"] else ""
                    srt.write(f"{i}\n{start_time} --> {end_time}\n{speaker_prefix}{subtitle['text']}\n\n")

        subtitles_path[path] = ass_path

    return subtitles_path




if __name__ == '__main__':
    main()
