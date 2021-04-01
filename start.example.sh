export LOGI_EMAIL="my_email"
export LOGI_PASS="my_password"
export DOWNLOAD_DIRECTORY="downloads"

export DEBUG="dsd"

# if settings file does not exist, create default one
# keeps your personal settings file out of git
if ! test -f "settings.json"; then
    cp settings.example.json settings.json
fi

npx tsc
node built/downloader.js