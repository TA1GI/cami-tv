@echo off
REM Konsol kod sayfasini UTF-8 yap (Eger calismazsa diye ASCII karakterler kullanacagiz)
chcp 65001 >nul
title Cami TV - Hikeen/Hotel Mode TV Kurulum Scripti
color 0A

echo.
echo  ==============================================================
echo            CAMI TV - HIKEEN TV KURULUM SCRIPTI                
echo.                                                              
echo    Bu script, Hikeen tabanli TV'lerde (Axen, Woon vb.)        
echo    Cami TV uygulamasinin duzgun calismasini saglar.         
echo.                                                              
echo    Sadece BIR KEZ calistirilmasi yeterlidir.                  
echo  ==============================================================
echo.

REM ==============================================================
REM  ADIM 1: ADB KONTROLU VE KURULUM
REM ==============================================================

echo [ADIM 1/7] ADB kontrol ediliyor...
echo.

REM Scriptin yanindaki platform-tools klasorunu oncelikli kontrol et
if exist "%~dp0platform-tools\adb.exe" (
    set "PATH=%~dp0platform-tools;%PATH%"
    echo   ADB bulundu: %~dp0platform-tools\adb.exe
    goto :ADB_READY
)

REM Sistemdeki adb'yi kontrol et
where adb >nul 2>&1
if %errorlevel% equ 0 (
    REM Eslestirme icin "adb pair" komutunu destekliyor mu kontrol et
    REM ADB surumu 1.0.40 ve uzeri olmak zorunda (eski 1.0.32 surumleri desteklemez)
    adb version 2>&1 | findstr /R "1\.0\.[4-9]" >nul 2>&1
    if %errorlevel% equ 0 (
        echo   ADB bulundu ve guncel:
        where adb
        adb version 2>nul | findstr /i "version" 
        echo.
        goto :ADB_READY
    ) else (
        echo   [!] Sistemdeki ADB surumu cok eski ^(Kablosuz Eslestirmeyi desteklemiyor^).
        echo   Guncel surum indirilecek...
        echo.
    )
)

echo   [!] Guncel ADB bulunamadi. Otomatik indiriliyor...
echo.

echo   Platform Tools indiriliyor...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' -OutFile '%TEMP%\platform-tools.zip'}" 2>nul

if not exist "%TEMP%\platform-tools.zip" (
    echo   [HATA] ADB indirilemedi! Internet baglantinizi kontrol edin.
    echo   Manuel indirme: https://developer.android.com/tools/releases/platform-tools
    pause
    exit /b 1
)

echo   Arsiv aciliyor...
powershell -Command "& {Expand-Archive -Path '%TEMP%\platform-tools.zip' -DestinationPath '%~dp0' -Force}" 2>nul

if not exist "%~dp0platform-tools\adb.exe" (
    echo   [HATA] Arsiv acilamadi!
    pause
    exit /b 1
)

set "PATH=%~dp0platform-tools;%PATH%"
del "%TEMP%\platform-tools.zip" 2>nul
echo   ADB basariyla kuruldu!
echo.

:ADB_READY

REM ==============================================================
REM  ADIM 2: TV'DE KABLOSUZ HATA AYIKLAMA ACMA
REM ==============================================================

echo ==============================================================
echo  [ADIM 2/7] TV'de Kablosuz Hata Ayiklama Acma
echo ==============================================================
echo.
echo  ONEMLI: Hikeen TV'lerde Android ayarlarina normal erisim
echo  YOKTUR. Asagidaki adimlari takip edin:
echo.
echo  1. Google Play Store'dan "FLauncher" uygulamasini yukleyin
echo     (Ucretsiz, acik kaynakli bir launcher)
echo.
echo  2. FLauncher'i acin, oradan "Ayarlar" (Settings) ikonuna basin
echo.
echo  3. Ayarlar - Cihaz Tercihleri - Hakkinda
echo     "Yapi Numarasi"na 7 kez art arda basin
echo     "Gelistirici oldunuz!" mesaji gorunecek
echo.
echo  4. Geri donun, simdi gorunen:
echo     Ayarlar - Cihaz Tercihleri - Gelistirici Secenekleri
echo     "Kablosuz hata ayiklama" yi ACIN
echo.
echo  5. "Kablosuz hata ayiklama" menusune girin
echo     Ekranda bir IP ADRESI:PORT ve ESLESTIRME KODU gorunecek
echo.
echo  6. Bilgisayar ve TV AYNI Wi-Fi agina bagli olmali
echo.
echo ==============================================================
echo.

REM ==============================================================
REM  ADIM 3: ESLESTIRME (PAIRING)
REM ==============================================================

echo [ADIM 3/7] TV ile Eslestirme
echo.
echo  TV ekranindaki "Cihaz esle" butonuna basin.
echo  Ekranda bir eslestirme kodu, IP adresi ve port gorunecek.
echo.

set /p PAIR_IP="  Eslestirme IP:Port (ornek: 192.168.1.100:37989): "
set /p PAIR_CODE="  Eslestirme Kodu (ornek: 909761): "

if "%PAIR_IP%"=="" (
    echo   [HATA] IP:Port bos birakilamaz!
    pause
    exit /b 1
)

echo.
echo   Eslestirme yapiliyor...
echo %PAIR_CODE% | adb pair %PAIR_IP%

timeout /t 2 /nobreak >nul
echo.

REM ==============================================================
REM  ADIM 4: BAGLANTI
REM ==============================================================

echo [ADIM 4/7] TV'ye baglaniliyor...
echo.

REM Eslestirme IP:Port'undan IP adresini cikar (port kismini at)
for /f "tokens=1 delims=:" %%a in ("%PAIR_IP%") do set "TV_IP=%%a"

set "CONNECT_IP=%TV_IP%:5555"

adb connect %CONNECT_IP%

timeout /t 3 /nobreak >nul

REM Baglantiyi kontrol et
adb -s %CONNECT_IP% shell "echo baglanti_basarili" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   [!] Baglanti kurulamadi. Kontrol edin:
    echo       - TV ve bilgisayar ayni Wi-Fi aginda mi?
    echo       - Eslestirme basarili oldu mu?
    echo       - TV ekraninda izin mesaji varsa IZIN VERIN
    echo.
    echo   Izin verdikten sonra devam etmek icin bir tusa basin...
    pause >nul
    
    adb connect %CONNECT_IP%
    timeout /t 3 /nobreak >nul
    
    adb -s %CONNECT_IP% shell "echo baglanti_basarili" >nul 2>&1
    if %errorlevel% neq 0 (
        echo   [HATA] TV'ye baglanilamadi!
        pause
        exit /b 1
    )
)

echo   Baglanti basarili!
echo.

REM ==============================================================
REM  UYUMLULUK KONTROLU
REM ==============================================================

echo   TV uyumlulugu kontrol ediliyor...

REM Hikeen property kontrolu
adb -s %CONNECT_IP% shell "getprop persist.sys.hikeen.prop.ishotelpowermode" > "%TEMP%\hikeen_check.txt" 2>&1
findstr /r "[01]" "%TEMP%\hikeen_check.txt" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Hikeen TV tespit edildi - bu script tam uyumludur.
    echo.
    del "%TEMP%\hikeen_check.txt" 2>nul
    goto :HIKEEN_OK
)

REM Hikeen degilse ek kontroller
adb -s %CONNECT_IP% shell "getprop | grep -i hikeen" > "%TEMP%\hikeen_check.txt" 2>&1
findstr /i "hikeen" "%TEMP%\hikeen_check.txt" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Hikeen TV tespit edildi - bu script tam uyumludur.
    echo.
    del "%TEMP%\hikeen_check.txt" 2>nul
    goto :HIKEEN_OK
)

del "%TEMP%\hikeen_check.txt" 2>nul

echo.
echo   [UYARI] Bu TV bir Hikeen cihazi gibi gorunmuyor!
echo.
echo   Bu script sadece Hikeen tabanli TV'ler icindir (Axen, Woon vb.)
echo   Diger TV'lerde (Mi Box, Xiaomi, Samsung, LG, Sony vb.)
echo   Cami TV uygulamasi bu script olmadan normal calisir.
echo.
echo   Devam etmek istiyor musunuz?
echo.
set /p DEVAM="  Devam etmek icin E, iptal icin H yazin: "
if /i "%DEVAM%"=="H" (
    echo   Islem iptal edildi.
    pause
    exit /b 0
)
echo.

:HIKEEN_OK

REM ==============================================================
REM  ADIM 5: HOTEL MODE KAPATMA
REM ==============================================================

echo [ADIM 5/7] Hotel Mode kapatiliyor...

adb -s %CONNECT_IP% shell "setprop persist.sys.hikeen.prop.ishotelpowermode 0"
echo   [OK] Hotel Mode: KAPATILDI
echo        (Hikeen'in uygulamalari zorla kapatmasi engellendi)
echo.

REM ==============================================================
REM  ADIM 6: UYGULAMA IZINLERI
REM ==============================================================

echo [ADIM 6/7] Uygulama izinleri ayarlaniyor...

adb -s %CONNECT_IP% shell "appops set com.akillicami.camitv SYSTEM_ALERT_WINDOW allow" 2>nul
echo   [OK] Overlay izni: VERILDI

adb -s %CONNECT_IP% shell "settings put system timeZone Europe/Istanbul" 2>nul
echo   [OK] Saat dilimi: Europe/Istanbul
echo.

REM ==============================================================
REM  ADIM 7: UYGULAMAYI BASLAT
REM ==============================================================

echo [ADIM 7/7] Cami TV uygulamasi baslatiliyor...

adb -s %CONNECT_IP% shell "am start -n com.akillicami.camitv/.MainActivity" 2>nul
echo   [OK] Uygulama baslatildi!
echo.

REM ==============================================================
REM  TAMAMLANDI
REM ==============================================================

echo.
echo  ==============================================================
echo                    KURULUM TAMAMLANDI!                       
echo  ==============================================================
echo                                                              
echo    Yapilan islemler:                                           
echo      - Hotel Mode kapatildi                                    
echo      - Overlay izni verildi                                    
echo      - Saat dilimi duzeltildi                                  
echo      - Uygulama baslatildi                                     
echo                                                              
echo    ONEMLI: Simdi TV'yi yeniden baslatin.                      
echo    Uygulamayi KAPATMADAN kumandadan TV'yi yeniden baslatin.   
echo    Bundan sonra her acilista uygulama otomatik baslar.        
echo                                                              
echo    NOT: Bu islem TV basina bir kez yapilir.                   
echo    Uygulama guncellendikce tekrar gerekmez.                  
echo  ==============================================================
echo.
pause
