# Ollama Chat UI

Simple web application for chatting with locally installed Ollama models. 
Visit https://sushanthr.github.io/ollama-ui/ or deploy this yourself.

## Features

- 🌐 **Web-based Interface**: Clean, modern, and responsive design
- 🔗 **Configurable Endpoint**: Easy configuration of Ollama server endpoint
- 📊 **Connection Status**: Visual indicator showing connection status
- 💬 **Multiple Chats**: Support for multiple concurrent chat sessions
- 🖼️ **Multimodal Support**: Upload and send images with text (for vision models)
- 🎯 **System Prompts**: Configure and save system prompts for different use cases
- 💾 **Local Storage**: Chat history stored locally in browser
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ⚡ **Real-time Streaming**: Live streaming responses from Ollama

## Quick Start

### 1. Deploy to GitHub Pages

1. Fork or clone this repository
2. Go to your repository settings
3. Navigate to "Pages" section
4. Select "Deploy from a branch" and choose `main` branch
5. Your app will be available at `https://yourusername.github.io/ollama-ui`

### 2. Set up Ollama

Make sure you have Ollama installed and running locally:

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model (example)
ollama pull llama3.2

# Start Ollama server (usually runs automatically)
ollama serve
```

### 3. Configure CORS (Important!)

Since the web app runs on GitHub Pages and needs to connect to your local Ollama server, you need to configure CORS:

#### Option 1: Environment Variable (Recommended)
```bash
# Set environment variable before starting Ollama
export OLLAMA_ORIGINS="https://yourusername.github.io"
ollama serve
```

#### Option 2: Ollama Configuration
Create or edit `~/.ollama/config.json`:
```json
{
  "origins": ["https://yourusername.github.io", "http://localhost:*"]
}
```

### 4. Access the Application

1. Open your deployed GitHub Pages URL
2. Click "Configure Settings"
3. Enter your Ollama endpoint (default: `http://localhost:11434`)
4. Test the connection
5. Select a default model
6. Save settings and start chatting!

## Usage Guide

### Settings Configuration

1. **Ollama Endpoint**: URL of your Ollama server (default: `http://localhost:11434`)
2. **Default Model**: Choose from available models on your Ollama server
3. **Test Connection**: Verify connectivity to your Ollama server

### Creating Chats

- Click "New Chat" to start a new conversation
- Each chat maintains its own history and settings
- Chat titles are automatically generated from the first message

### System Prompts

- Configure system prompts to guide AI behavior
- Save frequently used prompts as templates
- Apply different prompts to different chats

### Multimodal Support

- Click the image icon to upload images
- Supported formats: JPEG, PNG, GIF, WebP
- Works with vision-capable models (e.g., LLaVA)

### Chat Management

- View all chats in the sidebar
- Click any chat to switch to it
- Delete chats using the delete button
- Chat history is preserved in browser storage

## Supported Models

This application works with any Ollama model, including:

- **Text Models**: Llama 3.2, Mistral, CodeLlama, etc.
- **Vision Models**: LLaVA, Bakllava (for image + text)
- **Code Models**: CodeLlama, DeepSeek Coder, etc.
- **Custom Models**: Any model you've imported into Ollama

## Browser Compatibility

- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Local Development

To run locally for development:

1. Clone the repository
2. Open `index.html` in a web browser, or
3. Use a local server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx serve .
   
   # PHP
   php -S localhost:8000
   ```

## Troubleshooting

### Connection Issues

**Problem**: "Connection failed" error
**Solutions**:
- Ensure Ollama is running (`ollama serve`)
- Check if the endpoint URL is correct
- Verify CORS configuration
- Try accessing `http://localhost:11434/api/version` directly

### CORS Errors

**Problem**: CORS policy blocks requests
**Solutions**:
- Set `OLLAMA_ORIGINS` environment variable
- Configure Ollama with proper origins
- Use a local proxy if needed

### Models Not Loading

**Problem**: No models appear in settings
**Solutions**:
- Pull models using `ollama pull <model-name>`
- Verify connection to Ollama server
- Check Ollama logs for errors

### Image Upload Issues

**Problem**: Images not working
**Solutions**:
- Ensure you're using a vision-capable model
- Check image format (JPEG, PNG, GIF, WebP)
- Verify image size (large images may cause issues)

## Security Considerations

- This application runs entirely in the browser
- No data is sent to external servers
- Chat history is stored locally in browser storage
- Images are processed locally and sent directly to your Ollama server
- Always ensure your Ollama server is properly secured

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section above
- Review Ollama documentation
- Open an issue on GitHub

## Changelog

### v1.0.0
- Initial release
- Basic chat functionality
- Settings management
- System prompt support
- Image upload support
- Local storage persistence
- Responsive design
