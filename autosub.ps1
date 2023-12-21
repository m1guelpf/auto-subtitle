param (
    [string]$model = "tiny",
    [string]$output_dir = "output",
    [bool]$srt_only = $false,
    [Parameter(Position=0, Mandatory=$false)]
    [string]$videoPath
)

function Show-Help {
    @"
Usage: autosub [-model <string>] [-output_dir <string>] [-srt_only <bool>] <videoPath>
       autosub --help

-model <string>: The model to use for subtitling. Available models are {tiny.en,tiny,base.en,base,small.en,small,medium.en,medium,large-v1,large-v2,large-v3,large}. Default is 'tiny'.
-output_dir <string>: The directory where the output file will be stored. Default is 'output'.
-srt_only <bool>: If set to $true, only generates SRT file. Default is $false.
-videoPath <string>: Full path to the video file to be processed.
--help: Shows this help message.

Example:
    autosub "C:\path\to\video.mp4" -model tiny -output_dir output_autosub -srt_only $true
    Runs the auto-subtitle container on 'video.mp4' using the 'tiny' model, outputs to 'output_autosub', and generates only the SRT file.
"@
}

if ($videoPath -eq "--help") {
    Show-Help
    exit
}

# Extract the directory path and video file name from the provided path
$videoDirectory = Split-Path -Parent $videoPath
$videoFile = Split-Path -Leaf $videoPath

# Construct the Docker command
$dockerCommand = "docker run -it --rm -v ${videoDirectory}:/usr/src/app/data --name my-running-app auto-subtitle auto_subtitle '/usr/src/app/data/$videoFile' --model $model --output_dir /usr/src/app/data/$output_dir"

# Add the srt_only flag if it's true
if ($srt_only -eq $true) {
    $dockerCommand += " --srt_only True"
}

# Run the Docker command
Invoke-Expression $dockerCommand
