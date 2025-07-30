#!/bin/bash

# Setup virtual display for Electron GUI testing in Codespaces
echo "🖥️  Setting up virtual display for Electron GUI testing..."

# Install required packages
sudo apt-get update
sudo apt-get install -y \
    xvfb \
    libasound2-dev \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libgbm1 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libatspi2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxss1

echo "✅ Virtual display packages installed"

# Create Xvfb startup script
cat > ~/.xinitrc << 'EOF'
#!/bin/sh
exec /usr/bin/xvfb-run -a -s "-screen 0 1024x768x24" "$@"
EOF

chmod +x ~/.xinitrc

# Add environment variables
echo "export DISPLAY=:99" >> ~/.bashrc
echo "export ELECTRON_ENABLE_LOGGING=1" >> ~/.bashrc

echo "✅ Virtual display setup complete!"
echo ""
echo "🚀 To test Electron app with virtual display:"
echo "   1. Start virtual display: Xvfb :99 -screen 0 1024x768x24 &"
echo "   2. Export display: export DISPLAY=:99"
echo "   3. Run app: npm start"
echo ""
echo "⚠️  Note: This enables GUI testing but you won't see the actual window"
echo "   Use screenshots or automated testing to verify functionality"