import os
from typing import Iterator, TextIO
from datetime import timedelta

def str2bool(string):
    string = string.lower()
    str2val = {"true": True, "false": False}

    if string in str2val:
        return str2val[string]
    else:
        raise ValueError(
            f"Expected one of {set(str2val.keys())}, got {string}")


def format_timestamp(seconds: float, always_include_hours: bool = False):
    assert seconds >= 0, "non-negative timestamp expected"
    milliseconds = round(seconds * 1000.0)

    hours = milliseconds // 3_600_000
    milliseconds -= hours * 3_600_000

    minutes = milliseconds // 60_000
    milliseconds -= minutes * 60_000

    seconds = milliseconds // 1_000
    milliseconds -= seconds * 1_000

    hours_marker = f"{hours:02d}:" if always_include_hours or hours > 0 else ""
    return f"{hours_marker}{minutes:02d}:{seconds:02d},{milliseconds:03d}"


# def write_srt(transcript: Iterator[dict], file: TextIO):
#     for i, segment in enumerate(transcript, start=1):
#         print(
#             f"{i}\n"
#             f"{format_timestamp(segment['start'], always_include_hours=True)} --> "
#             f"{format_timestamp(segment['end'], always_include_hours=True)}\n"
#             f"{segment['text'].strip().replace('-->', '->')}\n",
#             file=file,
#             flush=True,
#         )


def ass_time(seconds: float) -> str:
    """Convert seconds to ASS time format (H:MM:SS.cc)."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds - int(seconds)) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def format_timedelta(td: timedelta) -> str:
    """Format timedelta to SRT time format (HH:MM:SS,mmm)."""
    total_seconds = td.total_seconds()
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)
    milliseconds = int((total_seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"

def filename(path):
    return os.path.splitext(os.path.basename(path))[0]
