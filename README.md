# spaste-server
Server for the [SPaste](https://paste.snurf.dev)

## Installation
This will build the server (with ui) and put it in dist as a standalone express app.
```bash
# Clone Repo
git clone https://github.com/SnurfDev/spaste-server
cd spaste-server

# Install Dependencies
npm install

# Build Server
npm run build

# Clone and build ui part
git clone https://github.com/SnurfDev/spaste-ui
cd spaste-ui
npm install
echo -n "Deploy on url (with http(s)): "
read durl
echo "VUE_APP_API_BASE=$durl/api/" > .env
npm run build

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