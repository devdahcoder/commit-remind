# Commit Remind

A VS Code extension that reminds developers to commit their code after reaching certain milestones, helping maintain better version control habits.

## Features

- **Line-based tracking**: Get reminded after modifying a certain number of lines (default: 200)
- **File-based tracking**: Get reminded after editing multiple files (default: 3)  
- **Time-based reminders**: Optional reminders based on time since last commit
- **Smart file filtering**: Automatically excludes common generated files and directories
- **Status bar integration**: See your progress at a glance
- **Quick actions**: Easy access to commit workflows directly from reminders

## How It Works

The extension tracks your coding activity in real-time:

1. **Line Changes**: Counts additions, deletions, and modifications across all files
2. **File Modifications**: Tracks unique files that have been saved with changes
3. **Time Tracking**: Monitors time elapsed since your last commit (optional)

When you hit a threshold, you'll get a friendly reminder with options to:
- Commit now (opens Source Control view)
- Remind later (snooze for a bit)
- Reset counters (if you want to start fresh)

## Configuration

Customize the extension through VS Code settings:

```json
{
  "commitRemind.linesThreshold": 200,
  "commitRemind.filesThreshold": 3,
  "commitRemind.timeThreshold": 60,
  "commitRemind.enableLineTracking": true,
  "commitRemind.enableFileTracking": true,
  "commitRemind.enableTimeTracking": false,
  "commitRemind.excludePatterns": [
    "**/*.log",
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**"
  ]
}
```

## Commands

- **Commit Remind: Reset Counters** - Manually reset tracking counters
- **Commit Remind: Show Current Status** - View current progress toward thresholds
- **Commit Remind: Commit Changes Now** - Quick access to source control

## Status Bar

The extension adds a status bar item showing:
- Current progress (percentage when approaching thresholds)
- Line and file counts in compact format
- Color coding: normal → prominent → warning as you approach limits

## Installation & Development

1. Clone this repository
2. Run `npm install` to install dependencies
3. Open in VS Code and press `F5` to run in Extension Development Host
4. Make changes and test in the development environment

## Building

```bash
npm run compile
```

Or for continuous compilation:
```bash
npm run watch
```

## Contributing

Feel free to open issues or submit pull requests to improve the extension!

## License

MIT License - feel free to use and modify as needed.