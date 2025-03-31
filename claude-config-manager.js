// Claude Desktop Config Manager - Compact Version
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

// Configuration 
const CLAUDE_DIR = 'C:\\Users\\user\\AppData\\Roaming\\Claude';
const CONFIG_FILE_PATH = path.join(CLAUDE_DIR, 'claude_desktop_config.json');
const BACKUP_DIR = path.join(CLAUDE_DIR, 'config-backups');
const PRESET_DIR = path.join(CLAUDE_DIR, 'presets');

// Claude Desktop executable path (adjust as needed)
const CLAUDE_EXECUTABLE = 'C:\\Users\\user\\AppData\\Local\\AnthropicClaude\\Claude.exe';

// Setup directories
[BACKUP_DIR, PRESET_DIR].forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));

// UI helpers
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const c = { r: "\x1b[0m", g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", c: "\x1b[36m", m: "\x1b[35m", b: "\x1b[1m" };
const ui = {
  success: t => console.log(`${c.g}${t}${c.r}`),
  warning: t => console.log(`${c.y}${t}${c.r}`),
  error: t => console.log(`${c.r}${t}${c.r}`),
  info: t => console.log(`${c.c}${t}${c.r}`),
  header: t => console.log(`\n${c.b}${c.m}=== ${t} ===${c.r}`),
  menu: t => console.log(`${c.y}${t}${c.r}`)
};

// Core file operations
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
  } catch (error) {
    ui.error(`Failed to read config: ${error.message}`);
    process.exit(1);
  }
}

function writeConfig(config) {
  try {
    const backupPath = path.join(BACKUP_DIR, 'config-latest-backup.json');
    fs.writeFileSync(backupPath, fs.readFileSync(CONFIG_FILE_PATH));
    ui.success(`Backup created at: ${backupPath}`);
    
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
    ui.success(`Config updated at: ${CONFIG_FILE_PATH}`);
    return true;
  } catch (error) {
    ui.error(`Error writing config: ${error.message}`);
    return false;
  }
}

// Core functions for managing MCPs
function listMcps(config) {
  const mcpServers = config.mcpServers || {};
  const disabledMcpServers = config.disabledMcpServers || {};
  let index = 1;
  const mcpMap = new Map();
  
  ui.header('Current MCP Servers');
  ui.info('\nENABLED SERVERS:');
  Object.keys(mcpServers).forEach(key => {
    console.log(`${index}. ${c.g}[ENABLED]${c.r} ${key}`);
    mcpMap.set(index.toString(), { name: key, enabled: true });
    index++;
  });
  
  ui.info('\nDISABLED SERVERS:');
  Object.keys(disabledMcpServers).forEach(key => {
    console.log(`${index}. ${c.r}[DISABLED]${c.r} ${key}`);
    mcpMap.set(index.toString(), { name: key, enabled: false });
    index++;
  });
  
  return mcpMap;
}

function handleToggleMcp() {
  const config = readConfig();
  const mcpMap = listMcps(config);
  
  rl.question('\nEnter MCP number to toggle (or "b" for back): ', answer => {
    if (answer.toLowerCase() === 'b') return showMainMenu();
    
    const mcpInfo = mcpMap.get(answer);
    if (!mcpInfo) {
      ui.error('Invalid selection');
      return handleToggleMcp();
    }
    
    // Toggle MCP state
    if (!config.disabledMcpServers) config.disabledMcpServers = {};
    
    if (mcpInfo.enabled) {
      config.disabledMcpServers[mcpInfo.name] = config.mcpServers[mcpInfo.name];
      delete config.mcpServers[mcpInfo.name];
      ui.warning(`Disabled: ${mcpInfo.name}`);
    } else {
      config.mcpServers[mcpInfo.name] = config.disabledMcpServers[mcpInfo.name];
      delete config.disabledMcpServers[mcpInfo.name];
      ui.success(`Enabled: ${mcpInfo.name}`);
    }
    
    writeConfig(config);
    rl.question('\nToggle another? (y/n): ', ans => 
      ans.toLowerCase() === 'y' ? handleToggleMcp() : showMainMenu());
  });
}

// Preset management
function handlePresets(mode) {
  try {
    const files = fs.readdirSync(PRESET_DIR);
    const presets = files.filter(f => f.endsWith('.json'))
      .map(f => ({ name: f.replace('.json', ''), path: path.join(PRESET_DIR, f) }));
    
    if (presets.length === 0) {
      ui.warning('No presets found');
      return showMainMenu();
    }
    
    ui.header('Available Presets');
    presets.forEach((p, i) => ui.info(`${i+1}. ${p.name}`));
    
    if (mode === 'load') {
      ui.menu('\n1. Standard Load (replace all MCPs)');
      ui.menu('2. Smart Load (preserve new MCPs)');
      ui.menu('3. Back to Main Menu');
      
      rl.question('\nSelect load method: ', method => {
        if (method === '3' || method.toLowerCase() === 'b') return showMainMenu();
        
        if (method === '1' || method === '2') {
          rl.question('\nSelect preset to load: ', answer => {
            const idx = parseInt(answer) - 1;
            if (idx >= 0 && idx < presets.length) {
              try {
                const presetData = fs.readFileSync(presets[idx].path, 'utf8');
                const presetConfig = JSON.parse(presetData);
                
                if (method === '1') {
                  // Standard load - completely replace config
                  writeConfig(presetConfig);
                  ui.success(`Loaded preset: ${presets[idx].name}`);
                } else {
                  // Smart load - preserve new MCPs
                  smartLoadPreset(presetConfig);
                }
              } catch (e) {
                ui.error(`Failed to load preset: ${e.message}`);
              }
            } else {
              ui.error('Invalid selection');
            }
            showMainMenu();
          });
        } else {
          ui.error('Invalid option');
          handlePresets('load');
        }
      });
    }
  } catch (error) {
    ui.error(`Error: ${error.message}`);
    showMainMenu();
  }
}

// Smart load preset - preserves new MCPs (disabled by default)
function smartLoadPreset(presetConfig) {
  try {
    const currentConfig = readConfig();
    
    // Get all MCPs from current config
    const currentMcps = {
      ...currentConfig.mcpServers || {},
      ...currentConfig.disabledMcpServers || {}
    };
    
    // Get all MCPs from preset
    const presetMcps = {
      ...presetConfig.mcpServers || {},
      ...presetConfig.disabledMcpServers || {}
    };
    
    // Initialize new config with empty objects
    const newConfig = {
      mcpServers: {},
      disabledMcpServers: {}
    };
    
    // Track MCPs added since preset was created
    const newMcps = [];
    
    // Process all current MCPs
    Object.keys(currentMcps).forEach(mcp => {
      if (presetMcps[mcp]) {
        // MCP exists in preset - use preset's enabled/disabled status
        if (presetConfig.mcpServers && presetConfig.mcpServers[mcp]) {
          newConfig.mcpServers[mcp] = currentMcps[mcp];
        } else {
          newConfig.disabledMcpServers[mcp] = currentMcps[mcp];
        }
      } else {
        // MCP is new, not in preset - keep it disabled by default
        newConfig.disabledMcpServers[mcp] = currentMcps[mcp];
        newMcps.push(mcp);
      }
    });
    
    // Apply the new configuration
    writeConfig(newConfig);
    
    // Show summary
    ui.success(`Smart-loaded preset with ${Object.keys(newConfig.mcpServers).length} enabled and ${Object.keys(newConfig.disabledMcpServers).length} disabled MCPs`);
    
    if (newMcps.length > 0) {
      ui.info('\nNew MCPs found (not in preset) - disabled by default:');
      newMcps.forEach(mcp => ui.info(`- ${mcp}`));
    }
  } catch (error) {
    ui.error(`Error during smart load: ${error.message}`);
  }
}

function handleSavePreset() {
  rl.question('Enter name for this preset: ', name => {
    if (!name.trim()) {
      ui.error('Name cannot be empty');
      return handleSavePreset();
    }
    
    const config = readConfig();
    const presetPath = path.join(PRESET_DIR, `${name}.json`);
    
    try {
      fs.writeFileSync(presetPath, JSON.stringify(config, null, 2));
      ui.success(`Preset saved: ${presetPath}`);
    } catch (error) {
      ui.error(`Error saving preset: ${error.message}`);
    }
    
    showMainMenu();
  });
}

// Custom configuration
function handleCustomConfig() {
  const config = readConfig();
  const allMcps = [
    ...Object.keys(config.mcpServers || {}),
    ...Object.keys(config.disabledMcpServers || {})
  ].filter((v, i, a) => a.indexOf(v) === i).sort();
  
  const recommended = ['filesystem', 'mcp-installer']
    .filter(mcp => allMcps.includes(mcp));
  
  ui.header('Create Custom Configuration');
  ui.info('Select MCPs to enable:');
  
  allMcps.forEach((mcp, i) => {
    const isRecommended = recommended.includes(mcp);
    console.log(`${i+1}. ${mcp}${isRecommended ? c.y+' (recommended)'+c.r : ''}`);
  });
  
  ui.info('\nOptions:');
  ui.menu('- Enter numbers (e.g., "1,3,5")');
  ui.menu('- "r" for recommended');
  ui.menu('- "all" for all MCPs');
  ui.menu('- "b" to go back');
  
  rl.question('\nSelect MCPs: ', answer => {
    if (answer.toLowerCase() === 'b') return showMainMenu();
    
    let selected = [];
    
    if (answer.toLowerCase() === 'r') {
      selected = [...recommended];
    } else if (answer.toLowerCase() === 'all') {
      selected = [...allMcps];
    } else {
      selected = answer.split(',')
        .map(s => parseInt(s.trim()) - 1)
        .filter(i => i >= 0 && i < allMcps.length)
        .map(i => allMcps[i]);
    }
    
    // Build new configuration
    const allMcpsObj = { ...config.mcpServers, ...config.disabledMcpServers };
    config.mcpServers = {};
    config.disabledMcpServers = {};
    
    // Enable selected MCPs
    selected.forEach(mcp => {
      if (allMcpsObj[mcp]) {
        config.mcpServers[mcp] = allMcpsObj[mcp];
        delete allMcpsObj[mcp];
      }
    });
    
    // Disable the rest
    config.disabledMcpServers = allMcpsObj;
    
    writeConfig(config);
    ui.success(`Enabled ${Object.keys(config.mcpServers).length} MCPs, disabled ${Object.keys(config.disabledMcpServers).length} MCPs`);
    
    rl.question('\nSave as preset? (y/n): ', ans => 
      ans.toLowerCase() === 'y' ? handleSavePreset() : showMainMenu());
  });
}

// Backup & Restore functions
function handleBackups() {
  ui.header('Backup & Restore');
  ui.menu('1. Create Manual Backup');
  ui.menu('2. Restore Backup');
  ui.menu('3. Manage Backups');
  ui.menu('4. Back to Main Menu');
  
  rl.question('\nSelect option: ', answer => {
    switch(answer) {
      case '1': createBackup(); break;
      case '2': restoreBackup(); break;
      case '3': manageBackups(); break;
      case '4': showMainMenu(); break;
      default: ui.error('Invalid option'); handleBackups();
    }
  });
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `config-backup-${timestamp}.json`);
  
  try {
    fs.writeFileSync(backupPath, fs.readFileSync(CONFIG_FILE_PATH));
    ui.success(`Backup created: ${backupPath}`);
  } catch (error) {
    ui.error(`Error creating backup: ${error.message}`);
  }
  
  handleBackups();
}

function restoreBackup() {
  const backups = getBackups();
  
  if (backups.length === 0) {
    ui.warning('No backups found');
    return handleBackups();
  }
  
  ui.header('Available Backups');
  ui.menu('0. Latest automatic backup');
  backups.forEach((b, i) => {
    const name = b.replace('config-backup-', '').replace('.json', '');
    ui.info(`${i+1}. ${name}`);
  });
  
  rl.question('\nSelect backup (or "b" for back): ', answer => {
    if (answer.toLowerCase() === 'b') return handleBackups();
    
    let backupPath;
    if (answer === '0') {
      backupPath = path.join(BACKUP_DIR, 'config-latest-backup.json');
    } else {
      const idx = parseInt(answer) - 1;
      if (idx >= 0 && idx < backups.length) {
        backupPath = path.join(BACKUP_DIR, backups[idx]);
      } else {
        ui.error('Invalid selection');
        return restoreBackup();
      }
    }
    
    try {
      const tempPath = path.join(BACKUP_DIR, 'pre-restore-backup.json');
      fs.writeFileSync(tempPath, fs.readFileSync(CONFIG_FILE_PATH));
      ui.info(`Current config backed up to: ${tempPath}`);
      
      fs.writeFileSync(CONFIG_FILE_PATH, fs.readFileSync(backupPath));
      ui.success(`Restored from: ${backupPath}`);
    } catch (error) {
      ui.error(`Error restoring: ${error.message}`);
    }
    
    handleBackups();
  });
}

function getBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('config-backup-') && f.endsWith('.json'))
      .sort().reverse();
  } catch (error) {
    ui.error(`Error listing backups: ${error.message}`);
    return [];
  }
}

function manageBackups() {
  const backups = getBackups();
  
  if (backups.length === 0) {
    ui.warning('No backups found');
    return handleBackups();
  }
  
  ui.header('Manage Backups');
  backups.forEach((b, i) => {
    const name = b.replace('config-backup-', '').replace('.json', '');
    ui.info(`${i+1}. ${name}`);
  });
  
  ui.menu('\n1. Delete specific backup');
  ui.menu('2. Delete all backups');
  ui.menu('3. Back');
  
  rl.question('\nSelect option: ', answer => {
    switch(answer) {
      case '1':
        rl.question('Enter backup number to delete: ', idx => {
          const index = parseInt(idx) - 1;
          if (index >= 0 && index < backups.length) {
            try {
              fs.unlinkSync(path.join(BACKUP_DIR, backups[index]));
              ui.success('Backup deleted');
            } catch (e) {
              ui.error(`Error: ${e.message}`);
            }
          } else {
            ui.error('Invalid selection');
          }
          manageBackups();
        });
        break;
      case '2':
        rl.question('Delete ALL backups? (y/n): ', confirm => {
          if (confirm.toLowerCase() === 'y') {
            let count = 0;
            backups.forEach(b => {
              try {
                fs.unlinkSync(path.join(BACKUP_DIR, b));
                count++;
              } catch (e) {}
            });
            ui.success(`Deleted ${count} backups`);
          }
          handleBackups();
        });
        break;
      case '3': handleBackups(); break;
      default: ui.error('Invalid option'); manageBackups();
    }
  });
}

// Check & fix config
function checkConfig() {
  try {
    const content = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    try {
      const config = JSON.parse(content);
      ui.success('JSON syntax is valid');
      
      let issues = [];
      if (!config.mcpServers) issues.push('Missing mcpServers');
      if (config.disabledMcpServers && typeof config.disabledMcpServers !== 'object') 
        issues.push('Invalid disabledMcpServers');
      
      if (issues.length > 0) {
        ui.warning('Structure issues found:');
        issues.forEach(i => ui.warning(`- ${i}`));
        
        rl.question('Fix issues? (y/n): ', answer => {
          if (answer.toLowerCase() === 'y') {
            if (!config.mcpServers) config.mcpServers = {};
            if (config.disabledMcpServers && typeof config.disabledMcpServers !== 'object')
              config.disabledMcpServers = {};
            
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
            ui.success('Config fixed');
          }
          showMainMenu();
        });
      } else {
        ui.success('Config structure is valid');
        showMainMenu();
      }
    } catch (e) {
      ui.error('JSON syntax error');
      rl.question('Attempt to fix? (y/n): ', answer => {
        if (answer.toLowerCase() === 'y') {
          // Simple common fixes
          let fixed = content
            .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
            .replace(/(["\d])\s*\n\s*(["{[])/g, '$1,\n$2'); // Add missing commas
          
          try {
            const config = JSON.parse(fixed);
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
            ui.success('Fixed JSON syntax');
          } catch (e2) {
            ui.error('Could not fix automatically');
          }
        }
        showMainMenu();
      });
    }
  } catch (e) {
    ui.error(`Error reading file: ${e.message}`);
    showMainMenu();
  }
}

// Restart Claude Desktop
function restartClaudeDesktop() {
  // Check if Claude executable path exists
  if (!fs.existsSync(CLAUDE_EXECUTABLE)) {
    ui.error(`Claude executable not found at: ${CLAUDE_EXECUTABLE}`);
    ui.info('Please update the CLAUDE_EXECUTABLE path in the script configuration.');
    rl.question('\nPress Enter to return to the main menu', () => {
      showMainMenu();
    });
    return;
  }

  ui.header('Restart Claude Desktop');
  ui.info('This will close the current Claude Desktop instance and start a new one.');
  rl.question('Do you want to proceed? (y/n): ', answer => {
    if (answer.toLowerCase() === 'y') {
      ui.info('Attempting to restart Claude Desktop...');
      
      // Use taskkill to close Claude Desktop
      exec('taskkill /f /im Claude.exe', (error, stdout, stderr) => {
        if (error) {
          // It's OK if Claude wasn't running
          ui.info('Claude Desktop was not running or could not be closed.');
        } else {
          ui.success('Claude Desktop closed successfully.');
        }
        
        // Wait a moment before starting Claude again
        setTimeout(() => {
          ui.info('Starting Claude Desktop...');
          
          // Start Claude Desktop and detach the process
          const child = exec(`start "" "${CLAUDE_EXECUTABLE}"`, (error) => {
            if (error) {
              ui.error(`Failed to start Claude Desktop: ${error.message}`);
            }
          });
          
          // Don't wait for the process, just finish
          ui.success('Claude Desktop launch initiated!');
          ui.info('Note: Claude Desktop may take a moment to fully start.');
          ui.info('Exiting Config Manager...');
          
          // Exit after a brief pause
          setTimeout(() => {
            rl.close();
            process.exit(0);
          }, 1500);
        }, 1000);
      });
    } else {
      showMainMenu();
    }
  });
}

// Main menu
function showMainMenu() {
  ui.header('Claude Desktop Config Manager');
  ui.menu('1. Toggle MCP Servers');
  ui.menu('2. Save Configuration as Preset');
  ui.menu('3. Load Preset');
  ui.menu('4. Create Custom Configuration');
  ui.menu('5. Backup & Restore');
  ui.menu('6. Check/Fix Config File');
  ui.menu('7. Enable All MCPs');
  ui.menu('8. Restart Claude Desktop');
  ui.menu('9. Exit');
  
  rl.question('\nSelect option: ', answer => {
    switch(answer) {
      case '1': handleToggleMcp(); break;
      case '2': handleSavePreset(); break;
      case '3': handlePresets('load'); break;
      case '4': handleCustomConfig(); break;
      case '5': handleBackups(); break;
      case '6': checkConfig(); break;
      case '7': 
        const config = readConfig();
        if (config.disabledMcpServers) {
          Object.assign(config.mcpServers, config.disabledMcpServers);
          config.disabledMcpServers = {};
          writeConfig(config);
          ui.success('All MCPs enabled');
        }
        showMainMenu();
        break;
      case '8': restartClaudeDesktop(); break;
      case '9': rl.close(); break;
      default: ui.error('Invalid option'); showMainMenu();
    }
  });
}

// Start application
showMainMenu();
