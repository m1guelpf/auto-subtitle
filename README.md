## Automatic subtitles for your videos

    This repository uses `ffmpeg` and [OpenAI's Whisper](https://openai.com/blog/whisper) to automatically generate and overlay subtitles on any video.
    Bigup to m1guelpf for releasing this tool
    Kudos for all the improvements made by RapDoodle

## Why forking it 

    Because it needed some fixes, installer, dependencies.... and I wanted also to make it more flexible

    The first iteration of this tool consistently failed generating spanish subtitles in movies that start with english songs,

    even though all the movie is in spanish... this should ifx it by manually forcing the language in the parameters.

## Advantages of this version (so far)

    - Can force subtitles to be generated in spanish
    - Updated dependencies
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
    pip install git+https://github.com/Sectumsempra82/auto-subtitle-plus.git
```

You'll also need to install [`ffmpeg`](https://ffmpeg.org/), which is available from most package managers:

#After careful testing, it is preferred to install ffpmpeg-python instead of the regular one in order to be able to use the -v parameter to embed subtitles in the video

 ```bash

pip install ffmpeg-python

```
if you don't need to use the -v option just go for the regular choco/brew/apt installers

```bash
# on Ubuntu or Debian
sudo apt update && sudo apt install ffmpeg

# on MacOS using Homebrew (https://brew.sh/)
brew install ffmpeg

# on Windows using Chocolatey (https://chocolatey.org/)
choco install ffmpeg
```

## How to make it use your GPU for 3x faster generations

Follow thsese instructions only if your gpu is powerful enough to be worth switching to torch-cuda

    - pip uninstall torch

    - pip cache purge
    
    - pip3 install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu116

    or for python 3.11

    - pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    
    Having a decent gpu can drammatically increase the performance
    
![image](https://user-images.githubusercontent.com/19196549/221421292-fc09b38e-c3aa-46e3-8684-e46c1e4cc691.png)
	

## Options

    -h, --help            show this help message and exit
    --model {tiny.en,tiny,base.en,base,small.en,small,medium.en,medium,large-v1,large-v2,large}
                          name of the Whisper model to use (default: small)
    --output-dir OUTPUT_DIR, -o OUTPUT_DIR
                          directory to save the outputs (default: .)
    --output-srt, -s      output the .srt file in the output directory (default: False)
    --output-audio, -a    output the audio extracted (default: False)
    --output-video, -v    generate video with embedded subtitles (default: False)
    --enhance-consistency
                          use the previous output as input to the next window to improve consistency (may stuck in a
                          failure loop) (default: False)
    --extract-workers EXTRACT_WORKERS
                          number of workers to extract audio (only useful when there are multiple videos) (default: 3)
    --verbose             print out the progress and debug messages (default: False)
    --task {transcribe,translate}
                          whether to perform X->X speech recognition ('transcribe') or X->English translation
                          ('translate') (default: transcribe)
    --language {af,am,ar,as,az,ba,be,bg,bn,bo,br,bs,ca,cs,cy,da,de,el,en,es,et,eu,fa,fi,fo,fr,gl,gu,ha,haw,he,hi,hr,ht,hu,hy,id,is,it,ja,jw,ka,kk,km,kn,ko,la,lb,ln,lo,lt,lv,mg,mi,mk,ml,mn,mr,ms,mt,my,ne,nl,nn,no,oc,pa,pl, ps,pt,ro,ru,sa,sd,si,sk,sl,sn,so,sq,sr,su,sv,sw,ta,te,tg,th,tk,tl,tr,tt,uk,ur,uz,vi,yi,yo,zh,Afrikaans,Albanian,Amharic,Arabic,Armenian,Assamese,Azerbaijani,Bashkir,Basque,Belarusian,Bengali,Bosnian,Breton,Bulgarian, Burmese,Castilian,Catalan,Chinese,Croatian,Czech,Danish,Dutch,English,Estonian,Faroese,Finnish,Flemish,French,Galician,Georgian,German,Greek,Gujarati,Haitian,Haitian Creole,Hausa,Hawaiian,Hebrew,Hindi,Hungarian,  Icelandic,Indonesian,Italian,Japanese,Javanese,Kannada,Kazakh,Khmer,Korean,Lao,Latin,Latvian,Letzeburgesch,Lingala,Lithuanian,Luxembourgish,Macedonian,Malagasy,Malay,Malayalam,Maltese,Maori,Marathi,Moldavian,Moldovan, Mongolian,Myanmar,Nepali,Norwegian,Nynorsk,Occitan,Panjabi,Pashto,Persian,Polish,Portuguese,Punjabi,Pushto,Romanian,Russian,Sanskrit,Serbian,Shona,Sindhi,Sinhala,Sinhalese,Slovak,Slovenian,Somali,Spanish,Sundanese,   Swahili,Swedish,Tagalog,Tajik,Tamil,Tatar,Telugu,Thai,Tibetan,Turkish,Turkmen,Ukrainian,Urdu,Uzbek,Valencian,Vietnamese,Welsh,Yiddish,Yoruba}
                          language spoken in the audio, specify None to perform language detection (default: None)
    --device DEVICE       device to use for PyTorch inference (default: cuda)


## Usage

The following command will generate a `subtitled/video.mp4` file contained the input video with overlayed subtitles.

    auto_subtitle_plus /path/to/video.mp4 --output-video -o subtitled/

Convert all `mp4` videos in the current directory to `.srt` subtitles and store it in the current directory

    auto_subtitle_plus *.mp4 --output-srt

---------------------- Recommended----------------

The following command will only generate an `.srt` file next to your video

    auto_subtitle_plus.exe 'video.avi' --model medium --output-srt

--------------------------------------------------

The default setting (which selects the `small` model) works well for transcribing English and Spanish to a certain extent.

--------------- NEW ------------------------------------------------------

You can use the --language parameter to force the output for the following languages:

Afrikaans
	- Albanian
	- Amharic
	- Arabic
	- Armenian
	- Assamese
	- Azerbaijani
	- Bashkir
	- Basque
	- Belarusian
	- Bengali
	- Bosnian
	- Breton
	- Bulgarian
	- Burmese
	- Castilian
	- Catalan
	- Chinese
	- Croatian
	- Czech
	- Danish
	- Dutch
	- English
	- Estonian
	- Faroese
	- Finnish
	- Flemish
	- French
	- Galician
	- Georgian
	- German
	- Greek
	- Gujarati
	- Haitian
	- Haitian Creole
	- Hausa
	- Hawaiian
	- Hebrew
	- Hindi
	- Hungarian
	- Icelandic
	- Indonesian
	- Italian
	- Japanese
	- Javanese
	- Kannada
	- Kazakh
	- Khmer
	- Korean
	- Lao
	- Latin
	- Latvian
	- Letzeburgesch
	- Lingala
	- Lithuanian
	- Luxembourgish
	- Macedonian
	- Malagasy
	- Malay
	- Malayalam
	- Maltese
	- Maori
	- Marathi
	- Moldavian
	- Moldovan
	- Mongolian
	- Myanmar
	- Nepali
	- Norwegian
	- Nynorsk
	- Occitan
	- Panjabi
	- Pashto
	- Persian
	- Polish
	- Portuguese
	- Punjabi
	- Pushto
	- Romanian
	- Russian
	- Sanskrit
	- Serbian
	- Shona
	- Sindhi
	- Sinhala
	- Sinhalese
	- Slovak
	- Slovenian
	- Somali
	- Spanish
	- Sundanese
	- Swahili
	- Swedish
	- Tagalog
	- Tajik
	- Tamil
	- Tatar
	- Telugu
	- Thai
	- Tibetan
	- Turkish
	- Turkmen
	- Ukrainian
	- Urdu
	- Uzbek
	- Valencian
	- Vietnamese
	- Welsh
	- Yiddish
	- Yorubaa


Further details on accuracy and models can be obtained here: https://github.com/openai/whisper#available-models-and-languages
--------------------------------------------------------------------------

You can optionally use a bigger model for better results (especially with other languages). The available models are `tiny`, `tiny.en`, `base`, `base.en`, `small`, `small.en`, `medium`, `medium.en`, `large`.

    auto_subtitle_plus.exe /path/to/video.mp4 --model medium 

Adding `--task translate` will translate the subtitles into English:

    auto_subtitle_plus.exe /path/to/video.mp4 --task translate

Run the following to view all available options:

    auto_subtitle_plus.exe --help

## License

This script is open-source and licensed under the MIT License. For more details, check the [LICENSE](LICENSE) file.
