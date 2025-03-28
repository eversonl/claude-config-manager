# Claude Desktop Config Manager

A lightweight, command-line tool for managing Claude Desktop MCP (Model Context Protocol) configurations. This tool makes it easy to toggle MCP servers on and off, create preset configurations, and manage backups.

## Features

- **Toggle MCP Servers**: Enable or disable individual MCP servers
- **Custom Configurations**: Select which MCPs to enable based on your needs
- **Preset Management**: Save and load configuration presets
- **Backup & Restore**: Create timestamped backups and restore when needed
- **Config Validation**: Check and fix JSON syntax or structure issues
- **Color-Coded Interface**: Easy-to-read, color-coded console interface

## Requirements

- Node.js (v12 or higher)
- Claude Desktop installed

## Installation

1. Clone this repository or download the `claude-config-manager.js` file
2. Open the file in a text editor
3. Update the `CLAUDE_DIR` value at the top to match your Claude installation path
4. Save the file

## Usage

Run the tool from the command line:

```
node claude-config-manager.js
```

### Main Menu Options

1. **Toggle MCP Servers**: Enable or disable individual MCPs
2. **Save Configuration as Preset**: Save your current configuration for later use
3. **Load Preset**: Load a previously saved configuration
4. **Create Custom Configuration**: Select which MCPs to enable, with intelligent recommendations
5. **Backup & Restore**: Create manual backups or restore from existing backups
6. **Check/Fix Config File**: Validate and repair your configuration file
7. **Enable All MCPs**: Quickly enable all available MCPs
8. **Exit**: Close the application

### Creating Custom Configurations

The tool provides intelligent recommendations for essential MCPs and allows you to create custom configurations:

- Enter specific numbers (e.g., "1,3,5") to select individual MCPs
- Enter "r" to use recommended essential MCPs
- Enter "all" to enable all available MCPs

### Backup & Restore

The tool automatically creates backups whenever you change your configuration and provides options to:

- Create manual timestamped backups
- Restore from any backup
- Manage (view/delete) existing backups

## How It Works

The tool directly manipulates the Claude Desktop configuration file, organizing MCPs into two categories:

- **mcpServers**: Active/enabled MCPs
- **disabledMcpServers**: Inactive/disabled MCPs

This organization allows Claude Desktop to only use enabled MCPs while keeping disabled ones readily available for future use.

## Troubleshooting

If you encounter JSON syntax errors in your configuration file, the tool's "Check/Fix Config File" option can automatically repair common issues like:

- Trailing commas
- Missing commas between properties
- Invalid structure

## License

MIT License - See LICENSE file for details
