import os
import glob
import psutil
import ffmpeg
import whisper
import argparse
import warnings
import tempfile
import subprocess
import multiprocessing
from torch.cuda import is_available
from .utils import get_filename, write_srt, is_audio, ffmpeg_extract_audio


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("paths", nargs="+", type=str,
                        help="paths/wildcards to video files to transcribe")
    parser.add_argument("--model", default="small",
                        choices=whisper.available_models(), help="name of the Whisper model to use")
    parser.add_argument("--output-dir", "-o", type=str,
                        default=".", help="directory to save the outputs")
    parser.add_argument("--output-srt", "-s", action='store_true', default=False, 
                        help="output the .srt file in the output directory")
    parser.add_argument("--output-audio", "-a", action='store_true', default=False, 
                        help="output the audio extracted")
    parser.add_argument("--output-video", "-v", action='store_true', default=False, 
                        help="generate video with embedded subtitles")
    parser.add_argument("--enhance-consistency", action='store_true', default=False, 
                        help="use the previous output as input to the next window to improve consistency (may stuck in a failure loop)")
    parser.add_argument("--extract-workers", type=int, default=max(1, psutil.cpu_count(logical=False) // 2),
                        help="number of workers to extract audio (only useful when there are multiple videos)")
    parser.add_argument("--verbose", action='store_true', default=False, 
                        help="print out the progress and debug messages")

    parser.add_argument("--task", type=str, default="transcribe", choices=[
                        "transcribe", "translate"], help="whether to perform X->X speech recognition ('transcribe') or X->English translation ('translate')")
    parser.add_argument("--language", type=str, default=None, 
                        choices=sorted(whisper.tokenizer.LANGUAGES.keys()) + sorted([k.title() for k in whisper.tokenizer.TO_LANGUAGE_CODE.keys()]), 
                        help="language spoken in the audio, specify None to perform language detection")
    parser.add_argument("--device", default="cuda" if is_available() else "cpu", help="device to use for PyTorch inference")

    args = parser.parse_args().__dict__
    model_name: str = args.pop("model")
    output_dir: str = args.pop("output_dir")
    output_srt: bool = args.pop("output_srt")
    output_video: bool = args.pop("output_video")
    output_audio: bool = args.pop("output_audio")
    device: str = args.pop("device")
    extract_wokers: str = args.pop("extract_workers")
    enhace_consistency: bool = args.pop("enhance_consistency")
    os.makedirs(output_dir, exist_ok=True)

    # Default output_srt to True if output_video is False
    if not output_video and not output_srt:
        output_srt = True

    # Process wildcards
    paths = []
    for path in args['paths']:
        paths += list(glob.glob(path))
    n = len(paths)
    if n == 0:
        print('Video file not found.')
        return
    elif n > 1:
        print('List of videos:')
        for i, path in enumerate(paths):
            print(f'  {i+1}. {path}')
    args.pop('paths')

    # Load models
    if model_name.endswith(".en"):
        warnings.warn(
            "forcing English detection")
        args["language"] = "en"

    model = whisper.load_model(model_name, device=device)

    # Extract audio from video. Skip if it is already an audio file
    audios = get_audio(paths, output_audio, output_dir, extract_wokers)

    # Generate subtitles with whisper
    subtitles = get_subtitles(
        audios, output_srt, output_dir, 
        lambda audio_path: model.transcribe(audio_path, condition_on_previous_text=enhace_consistency, **args)
    )

    if not output_video:
        return

    for path, srt_path in subtitles.items():
        # Skip audio files
        if is_audio(path):
            continue
        
        print(f"Adding subtitles to {path}...")
        
        out_path = os.path.join(output_dir, f"{get_filename(path)}.mp4")
        if os.path.exists(out_path) and os.path.samefile(path, out_path):
            out_path = os.path.join(output_dir, f"{get_filename(path)}-subtitled.mp4")
            warnings.warn(f"{path} will overwrite the original file. Renaming the output file to {out_path}")

        video = ffmpeg.input(path)
        audio = video.audio

        ffmpeg.concat(
            video.filter('subtitles', srt_path, force_style="OutlineColour=&H40000000,BorderStyle=3"), audio, v=1, a=1
        ).output(out_path).run(quiet=False, overwrite_output=True)

        print(f"Saved subtitled video to {os.path.abspath(out_path)}.")


def get_audio(paths, output_audio, output_dir, num_workers=1):
    temp_dir = tempfile.gettempdir()
    audio_paths = {}
    func_args = []

    for path in paths:
        if is_audio(path):
            # Skip audio files
            output_path = path
        else:
            output_path = output_dir if output_audio else tempfile.gettempdir()
            output_path = os.path.join(output_path, f"{get_filename(path)}.mp3")
            func_args.append((path, output_path))
            
        audio_paths[path] = output_path
    
    # Execute on multiple processes
    pool = multiprocessing.Pool(num_workers)
    pool.starmap(ffmpeg_extract_audio, func_args)

    return audio_paths


def get_subtitles(audio_paths: list, output_srt: bool, output_dir: str, transcribe: callable):
    subtitles_path = {}

    for path, audio_path in audio_paths.items():
        srt_path = output_dir if output_srt else tempfile.gettempdir()
        srt_path = os.path.join(srt_path, f"{get_filename(path)}.srt")
        
        print(
            f"Generating subtitles for {path}... This might take a while."
        )

        warnings.filterwarnings("ignore")
        result = transcribe(audio_path)
        warnings.filterwarnings("default")

        with open(srt_path, "w", encoding="utf-8") as srt:
            write_srt(result["segments"], file=srt)

        subtitles_path[path] = srt_path

    return subtitles_path


if __name__ == '__main__':
    main()
