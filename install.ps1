docker build -t auto-subtitle .
New-Item -Path "C:\autosub" -ItemType Directory -Force
Copy-Item -Path "autosub.ps1" -Destination "C:\autosub"
$UserPath = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
$NewPath = "$UserPath;C:\autosub"
[System.Environment]::SetEnvironmentVariable("PATH", $NewPath, [System.EnvironmentVariableTarget]::User)
