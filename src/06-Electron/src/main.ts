import { app, BrowserWindow } from 'electron';
import * as path from 'path';

app.on('window-all-closed', () => app.quit());

app.on('ready', () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    center: true,
    darkTheme: true,
    resizable: false,
    autoHideMenuBar: true
  });
  mainWindow.loadFile(path.join(__dirname, '/frontend/index.html'));
  // mainWindow.webContents.openDevTools();
});
