# ==========================================================================
# Todo - Desktop Shortcut & Icon Creator (ASCII Safe & Auto-Resize)
# ==========================================================================

Add-Type -AssemblyName System.Drawing

$projectDir = "C:\Users\Administrator\.gemini\antigravity\scratch\handdrawn-todo"
$pngPath = "$projectDir\assets\icon.png"
$icoPath = "$projectDir\assets\icon.ico"

# Reconstruct "待办.vbs" using Unicode: '待' is 0x5F85, '办' is 0x529E
$vbsName = "$([char]0x5F85)$([char]0x529E).vbs"
$vbsPath = Join-Path $projectDir $vbsName

# 1. Resize PNG to 256x256 and convert to ICO
if (Test-Path $pngPath) {
    try {
        Write-Host "Resizing PNG to 256x256 and generating ICO..."
        $srcBmp = [System.Drawing.Bitmap]::FromFile($pngPath)
        $destBmp = New-Object System.Drawing.Bitmap(256, 256)
        $g = [System.Drawing.Graphics]::FromImage($destBmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($srcBmp, 0, 0, 256, 256)
        
        $ms = New-Object System.IO.MemoryStream
        $destBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $ms.ToArray()
        
        $ms.Close()
        $g.Dispose()
        $destBmp.Dispose()
        $srcBmp.Dispose()
        
        $pngSize = $pngBytes.Length
        [byte[]]$header = @(
            0x00, 0x00,           # Reserved
            0x01, 0x00,           # Type (1 = Icon)
            0x01, 0x00,           # Image count (1)
            0x00,                 # Width (0 = 256)
            0x00,                 # Height (0 = 256)
            0x00,                 # Color count (0)
            0x00,                 # Reserved
            0x01, 0x00,           # Color planes (1)
            0x20, 0x00,           # Bits per pixel (32)
            ($pngSize -band 0xff), (($pngSize -shr 8) -band 0xff), (($pngSize -shr 16) -band 0xff), (($pngSize -shr 24) -band 0xff), # Size of PNG data (4 bytes)
            0x16, 0x00, 0x00, 0x00 # Offset of PNG data (22 bytes)
        )
        
        $icoBytes = New-Object byte[] ($header.Length + $pngBytes.Length)
        [System.Array]::Copy($header, 0, $icoBytes, 0, $header.Length)
        [System.Array]::Copy($pngBytes, 0, $icoBytes, $header.Length, $pngBytes.Length)
        [System.IO.File]::WriteAllBytes($icoPath, $icoBytes)
        
        Write-Host "ICO icon successfully generated at: $icoPath"
    } catch {
        Write-Warning "Failed to generate ICO."
    }
} else {
    Write-Warning "icon.png not found. Skipping ICO generation."
}

# 2. Get User Desktop Path
$desktopDir = [System.Environment]::GetFolderPath("Desktop")

# Remove old "AI 待办.lnk" if exists
$oldLnkName = "$([char]0x41)$([char]0x49) $([char]0x5F85)$([char]0x529E).lnk"
$oldShortcutPath = Join-Path $desktopDir $oldLnkName
if (Test-Path $oldShortcutPath) {
    Remove-Item $oldShortcutPath -Force
    Write-Host "Removed old shortcut: $oldShortcutPath"
}

# Reconstruct "待办.lnk" using Unicode: '待' is 0x5F85, '办' is 0x529E
$lnkName = "$([char]0x5F85)$([char]0x529E).lnk"
$shortcutPath = Join-Path $desktopDir $lnkName

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
}

# 3. Create Desktop Shortcut
try {
    Write-Host "Creating desktop shortcut..."
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    
    $Shortcut.TargetPath = "wscript.exe"
    $Shortcut.Arguments = "`"$vbsPath`""
    $Shortcut.WorkingDirectory = $projectDir
    $Shortcut.Description = "Todo List"
    
    if (Test-Path $icoPath) {
        $Shortcut.IconLocation = $icoPath
    } else {
        $Shortcut.IconLocation = "shell32.dll,73"
    }
    
    $Shortcut.Save()
    Write-Host "Desktop shortcut created successfully."
    
    # 4. Refresh Windows Shell Icon Cache
    Write-Host "Refreshing Windows Icon Cache..."
    if (Get-Command "ie4uinit.exe" -ErrorAction SilentlyContinue) {
        ie4uinit.exe -show
    }
} catch {
    Write-Error "Failed to create shortcut."
}
