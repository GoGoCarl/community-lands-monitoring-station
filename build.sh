git log -n 1 --format='{ "version": "%h" }' > application/data/version.json
rm -rf builds
# electron-packager . MonitoringStation --platform=darwin --arch=x64 --out builds --version=0.33.1
electron-packager `pwd` MonitoringStation --platform=win32 --arch=x64 --out builds --version=1.4.0
cd builds
# zip -r MonitoringStation-darwin-x64-1.0.0.zip MonitoringStation-darwin-x64
cd MonitoringStation-win32-x64
zip -q -r --exclude=*.git* --exclude=*.DS_Store* --exclude=*.env* --exclude=*build*.sh* MonitoringStation.zip .
cd ..
cd ..
