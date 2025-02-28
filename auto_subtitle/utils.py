import os
from typing import Iterator, TextIO


def format_timestamp(seconds: float, always_include_hours: bool = False,subtitle_format: str = "srt"):
    assert seconds >= 0, "non-negative timestamp expected"
    milliseconds = round(seconds * 1000.0)

    hours = milliseconds // 3_600_000
    milliseconds -= hours * 3_600_000

    minutes = milliseconds // 60_000
    milliseconds -= minutes * 60_000

    seconds = milliseconds // 1_000
    milliseconds -= seconds * 1_000

    hours_marker = f"{hours:02d}:" if always_include_hours or hours > 0 else ""

    #return f"{hours_marker}{minutes:02d}:{seconds:02d},{milliseconds:03d}"
    if subtitle_format == "srt":
        output=f"{hours_marker}{minutes:02d}:{seconds:02d},{milliseconds:03d}"
    else:
        output= f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"

    return output


def write_srt(transcript: Iterator[dict], file: TextIO,subtitle_format: str = "srt"):
 
    if subtitle_format == "vtt":         
        print("WEBVTT\n", file=file)
        for i, segment in enumerate(transcript, start=1):
            print(
                f"{format_timestamp(segment['start'], always_include_hours=True,subtitle_format=subtitle_format)} --> "
                f"{format_timestamp(segment['end'], always_include_hours=True,subtitle_format=subtitle_format)}\n"
                f"{segment['text'].strip().replace('-->', '->')}\n",
                file=file,
                flush=True,
            )

    else: #srt
        for i, segment in enumerate(transcript, start=1):        
            print(
                f"{i}\n"
                f"{format_timestamp(segment['start'], always_include_hours=True,subtitle_format=subtitle_format)} --> "
                f"{format_timestamp(segment['end'], always_include_hours=True,subtitle_format=subtitle_format)}\n"
                f"{segment['text'].strip().replace('-->', '->')}\n",
                file=file,
                flush=True,
            )


def filename(path):
    return os.path.splitext(os.path.basename(path))[0]