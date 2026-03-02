Add-Type -AssemblyName System.Drawing
$src = "D:\Esp32_projeler\akilli_cami\workshop\cami-tv\cami_tv_logo.png"
$img = [System.Drawing.Image]::FromFile($src)
$folders = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}
foreach ($f in $folders.Keys) {
    $size = $folders[$f]
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $size, $size)
    $g.Dispose()
    
    $path1 = "D:\Esp32_projeler\akilli_cami\workshop\cami-tv\android\app\src\main\res\$f\ic_launcher.png"
    $path2 = "D:\Esp32_projeler\akilli_cami\workshop\cami-tv\android\app\src\main\res\$f\ic_launcher_round.png"
    $bmp.Save($path1, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save($path2, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$bmp512 = New-Object System.Drawing.Bitmap(512, 512)
$g512 = [System.Drawing.Graphics]::FromImage($bmp512)
$g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g512.DrawImage($img, 0, 0, 512, 512)
$g512.Dispose()
$bmp512.Save("D:\Esp32_projeler\akilli_cami\workshop\cami-tv\web\img\cami_tv_logo.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Save("D:\Esp32_projeler\akilli_cami\workshop\cami-tv\android\app\src\main\assets\web\img\cami_tv_logo.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Dispose()
$img.Dispose()
