import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ChangeTracker {
    linesChanged: number;
    filesModified: Set<string>;
    lastCommitTime: Date | null;
    lastReminderTime: Date | null;
}

export function activate(context: vscode.ExtensionContext) {
    const tracker: ChangeTracker = {
        linesChanged: 0,
        filesModified: new Set(),
        lastCommitTime: null,
        lastReminderTime: null
    };

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'commitRemind.showStatus';
    context.subscriptions.push(statusBarItem);

    // Initialize last commit time
    initializeLastCommitTime(tracker);

    // Update status bar periodically
    updateStatusBar(statusBarItem, tracker);
    const statusInterval = setInterval(() => updateStatusBar(statusBarItem, tracker), 10000);
    context.subscriptions.push(new vscode.Disposable(() => clearInterval(statusInterval)));

    // Track document changes
    const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (shouldTrackFile(event.document.uri)) {
            const config = vscode.workspace.getConfiguration('commitRemind');
            if (config.get('enableLineTracking')) {
                trackLineChanges(event, tracker);
            }
        }
    });

    // Track file saves
    const fileSaveListener = vscode.workspace.onDidSaveTextDocument((document) => {
        if (shouldTrackFile(document.uri)) {
            const config = vscode.workspace.getConfiguration('commitRemind');
            if (config.get('enableFileTracking')) {
                trackFileChanges(document, tracker);
            }
        }
        checkThresholds(tracker);
    });

    // Register commands
    const resetCommand = vscode.commands.registerCommand('commitRemind.resetCounters', () => {
        resetCounters(tracker);
        vscode.window.showInformationMessage('Commit remind counters reset!');
    });

    const statusCommand = vscode.commands.registerCommand('commitRemind.showStatus', () => {
        showCurrentStatus(tracker);
    });

    const commitCommand = vscode.commands.registerCommand('commitRemind.commitNow', async () => {
        await openSourceControl();
    });

    // Check for time-based reminders
    const timeInterval = setInterval(() => checkTimeThreshold(tracker), 60000); // Check every minute

    // Add all subscriptions
    context.subscriptions.push(
        documentChangeListener,
        fileSaveListener,
        resetCommand,
        statusCommand,
        commitCommand,
        new vscode.Disposable(() => clearInterval(timeInterval))
    );

    console.log('Commit Remind extension is now active!');
}

function shouldTrackFile(uri: vscode.Uri): boolean {
    const config = vscode.workspace.getConfiguration('commitRemind');
    const excludePatterns: string[] = config.get('excludePatterns', []);

    const relativePath = vscode.workspace.asRelativePath(uri);

    return !excludePatterns.some(pattern => {
        const glob = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        return glob.test(relativePath);
    });
}

function trackLineChanges(event: vscode.TextDocumentChangeEvent, tracker: ChangeTracker) {
    let linesChanged = 0;

    event.contentChanges.forEach(change => {
        const oldLineCount = change.range.end.line - change.range.start.line + 1;
        const newLineCount = change.text.split('\n').length;
        linesChanged += Math.abs(newLineCount - oldLineCount) + Math.min(oldLineCount, newLineCount);
    });

    tracker.linesChanged += linesChanged;
}

function trackFileChanges(document: vscode.TextDocument, tracker: ChangeTracker) {
    tracker.filesModified.add(document.uri.fsPath);
}

function checkThresholds(tracker: ChangeTracker) {
    const config = vscode.workspace.getConfiguration('commitRemind');
    const linesThreshold = config.get('linesThreshold', 200);
    const filesThreshold = config.get('filesThreshold', 3);

    const shouldRemindLines = config.get('enableLineTracking') && tracker.linesChanged >= linesThreshold;
    const shouldRemindFiles = config.get('enableFileTracking') && tracker.filesModified.size >= filesThreshold;

    if (shouldRemindLines || shouldRemindFiles) {
        showCommitReminder(tracker, shouldRemindLines, shouldRemindFiles);
    }
}

function checkTimeThreshold(tracker: ChangeTracker) {
    const config = vscode.workspace.getConfiguration('commitRemind');

    if (!config.get('enableTimeTracking')) {
        return;
    }

    const timeThreshold = config.get('timeThreshold', 60) * 60 * 1000; // Convert to milliseconds
    const now = new Date();

    if (tracker.lastCommitTime && (now.getTime() - tracker.lastCommitTime.getTime()) > timeThreshold) {
        // Avoid showing reminder too frequently
        if (!tracker.lastReminderTime || (now.getTime() - tracker.lastReminderTime.getTime()) > 10 * 60 * 1000) {
            showTimeBasedReminder(tracker);
        }
    }
}

function showCommitReminder(tracker: ChangeTracker, linesTriggered: boolean, filesTriggered: boolean) {
    let message = 'Time to commit your changes! ';

    if (linesTriggered) {
        message += `${tracker.linesChanged} lines modified. `;
    }
    if (filesTriggered) {
        message += `${tracker.filesModified.size} files changed.`;
    }

    const options = ['Commit Now', 'Remind Later', 'Reset Counters'];

    vscode.window.showWarningMessage(message, ...options).then(async (selection) => {
        switch (selection) {
            case 'Commit Now':
                await openSourceControl();
                resetCounters(tracker);
                break;
            case 'Remind Later':
                tracker.lastReminderTime = new Date();
                break;
            case 'Reset Counters':
                resetCounters(tracker);
                break;
        }
    });
}

function showTimeBasedReminder(tracker: ChangeTracker) {
    const config = vscode.workspace.getConfiguration('commitRemind');
    const timeThreshold = config.get('timeThreshold', 60);

    const message = `It's been over ${timeThreshold} minutes since your last commit. Consider committing your progress!`;
    const options = ['Commit Now', 'Remind Later'];

    vscode.window.showInformationMessage(message, ...options).then(async (selection) => {
        switch (selection) {
            case 'Commit Now':
                await openSourceControl();
                break;
            case 'Remind Later':
                tracker.lastReminderTime = new Date();
                break;
        }
    });
}

async function openSourceControl() {
    await vscode.commands.executeCommand('workbench.view.scm');
    await vscode.commands.executeCommand('git.openChange');
}

function resetCounters(tracker: ChangeTracker) {
    tracker.linesChanged = 0;
    tracker.filesModified.clear();
    tracker.lastCommitTime = new Date();
    tracker.lastReminderTime = null;
}

function showCurrentStatus(tracker: ChangeTracker) {
    const message = `Current Status:
Lines changed: ${tracker.linesChanged}
Files modified: ${tracker.filesModified.size}
Last commit: ${tracker.lastCommitTime ? tracker.lastCommitTime.toLocaleString() : 'Unknown'}`;

    vscode.window.showInformationMessage(message, 'Reset Counters', 'Commit Now').then(async (selection) => {
        if (selection === 'Reset Counters') {
            resetCounters(tracker);
        } else if (selection === 'Commit Now') {
            await openSourceControl();
        }
    });
}

function updateStatusBar(statusBarItem: vscode.StatusBarItem, tracker: ChangeTracker) {
    const config = vscode.workspace.getConfiguration('commitRemind');
    const linesThreshold = config.get('linesThreshold', 200);
    const filesThreshold = config.get('filesThreshold', 3);

    const linesProgress = Math.min(100, (tracker.linesChanged / linesThreshold) * 100);
    const filesProgress = Math.min(100, (tracker.filesModified.size / filesThreshold) * 100);

    const maxProgress = Math.max(linesProgress, filesProgress);

    if (maxProgress >= 80) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.text = `$(git-commit) ${Math.round(maxProgress)}% - Commit Soon!`;
    } else if (maxProgress >= 50) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        statusBarItem.text = `$(git-commit) ${Math.round(maxProgress)}%`;
    } else {
        statusBarItem.backgroundColor = undefined;
        statusBarItem.text = `$(git-commit) ${tracker.linesChanged}L ${tracker.filesModified.size}F`;
    }

    statusBarItem.tooltip = `Lines: ${tracker.linesChanged}/${linesThreshold}, Files: ${tracker.filesModified.size}/${filesThreshold}`;
    statusBarItem.show();
}

async function initializeLastCommitTime(tracker: ChangeTracker) {
    try {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const { stdout } = await execAsync('git log -1 --format=%ct', { cwd: workspaceRoot });
            const timestamp = parseInt(stdout.trim()) * 1000;
            tracker.lastCommitTime = new Date(timestamp);
        }
    } catch (error) {
        console.log('Could not get last commit time:', error);
        tracker.lastCommitTime = new Date(); // Default to now if git command fails
    }
}

export function deactivate() {
    console.log('Commit Remind extension deactivated');
}