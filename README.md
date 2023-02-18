# Automatic subtitles your videos

This repository uses `ffmpeg` and [OpenAI's Whisper](https://openai.com/blog/whisper) to automatically generate and overlay subtitles on any video.

## About the fork

This repository is a fork of [m1guelpf's auto-subtitle](https://github.com/m1guelpf/auto-subtitle) with additional features added. I am trying to push some of the new features into the m1guelpf's repository.

The list of newly added features:

- Fix audio out of sync issue
- Wildcard support for filenames
- Convert audio to subtitles (output `.srt` files)
- Option to pick a language instead of using language auto detection
- Extract audio from videos in parallel
- Disable `condition_on_previous_text` by default to avoid stucking in failure loop (especially for videos with long intervals between talks), with option `--enhance-consistency` to enable it.
- Many more new command options

## Installation

To get started, you'll need Python 3.7 or newer. Install the binary by running the following command:

```bash
pip install git+https://github.com/RapDoodle/auto-subtitle.git
```

You'll also need to install [`ffmpeg`](https://ffmpeg.org/), which is available from most package managers:

```bash
# on Ubuntu or Debian
sudo apt update && sudo apt install ffmpeg

# on MacOS using Homebrew (https://brew.sh/)
brew install ffmpeg

# on Windows using Chocolatey (https://chocolatey.org/)
choco install ffmpeg
```

## Usage

The following command will generate a `subtitled/video.mp4` file contained the input video with overlayed subtitles.

    subtitle /path/to/video.mp4 --output-video -o subtitled/

Convert all `mp4` videos in the current directory to `.srt` subtitles and store it in the current directory

    subtitle *.mp4 --output-srt

The default setting (which selects the `small` model) works well for transcribing English. You can optionally use a bigger model for better results (especially with other languages). The available models are `tiny`, `tiny.en`, `base`, `base.en`, `small`, `small.en`, `medium`, `medium.en`, `large`.

    subtitle /path/to/video.mp4 --output-srt --model medium

Adding `--task translate` will translate the subtitles into English:

    subtitle /path/to/video.mp4 --output-srt --task translate

Run the following to view all available options:

    subtitle --help

## License

This script is open-source and licensed under the MIT License. For more details, check the [LICENSE](LICENSE) file.
