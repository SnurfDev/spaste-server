# spaste-server
Server for the [SPaste](https://paste.snurf.dev)

## Installation
This will build the server (with ui) and put it in dist as a standalone express app.
```bash
# Clone Repo
echo "Cloning and installing server (logs in install.log)"
git clone https://github.com/SnurfDev/spaste-server &> /dev/null
cd spaste-server

# Install Dependencies
npm install &>> install.log

# Build Server
npm run build &>> install.log

# Clone and build ui part
echo "Installing ui"
git clone https://github.com/SnurfDev/spaste-ui &>> ../install.log
cd spaste-ui
npm install &>> ../install.log
npm run build &>> ../install.log

echo "Cleaning Up"
# Copy Files and cleanup
mkdir ../dist/public/
cp -r ./dist/* ../dist/public/
cd ..
rm -rf ./spaste-ui

# Setup Credentials
mv .env.example .env
nano .env
```

## Running
```bash
npm start
```