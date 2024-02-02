# spaste-server
Server for the SPaste Service

## Installation
```bash
# Clone Repo
git clone https://github.com/SnurfDev/spaste-server
cd spaste-server

# Install Dependencies
npm install

# Clone and build ui part
git clone https://github.com/SnurfDev/spaste-ui
cd spaste-ui
npm install
npm run build

# Copy Files and cleanup
mkdir ../public
cp -r ./dist/* ../public/
cd ..
rm -rf ./spaste-ui

# Setup Credentials
mv .env.example .env
nano .env

# Build Server
npm run build
```

## Running
```bash
npm start
```